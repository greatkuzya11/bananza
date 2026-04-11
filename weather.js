const https = require('https');

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_REFRESH_MINUTES = 30;
const MIN_REFRESH_MINUTES = 10;
const MAX_REFRESH_MINUTES = 180;
const weatherCache = new Map();

function getJson(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Bananza weather widget' },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Weather API returned HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Weather API returned invalid JSON'));
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Weather request timeout')));
    req.on('error', reject);
  });
}

function clampRefreshMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_REFRESH_MINUTES;
  return Math.min(MAX_REFRESH_MINUTES, Math.max(MIN_REFRESH_MINUTES, Math.round(n)));
}

function validCoordinate(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function normalizeLocation(input) {
  if (!input || typeof input !== 'object') return null;
  const latitude = validCoordinate(input.latitude, -90, 90);
  const longitude = validCoordinate(input.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;
  const name = String(input.name || input.location_name || '').trim().slice(0, 100);
  if (!name) return null;
  return {
    name,
    country: String(input.country || '').trim().slice(0, 100) || null,
    admin1: String(input.admin1 || '').trim().slice(0, 100) || null,
    latitude,
    longitude,
    timezone: String(input.timezone || '').trim().slice(0, 100) || null,
  };
}

function rowToSettings(row) {
  if (!row) {
    return {
      enabled: false,
      refresh_minutes: DEFAULT_REFRESH_MINUTES,
      location: null,
      updated_at: null,
    };
  }
  const hasLocation = Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) && row.location_name;
  return {
    enabled: !!row.enabled,
    refresh_minutes: clampRefreshMinutes(row.refresh_minutes),
    location: hasLocation ? {
      name: row.location_name,
      country: row.country,
      admin1: row.admin1,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      timezone: row.timezone,
    } : null,
    updated_at: row.updated_at,
  };
}

function normalizeGeocodingResult(item) {
  const location = normalizeLocation({
    name: item.name,
    country: item.country,
    admin1: item.admin1,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone,
  });
  if (!location) return null;
  return {
    id: item.id,
    ...location,
    country_code: item.country_code || null,
    population: item.population || null,
  };
}

function getSettingsRow(db, userId) {
  return db.prepare('SELECT * FROM user_weather_settings WHERE user_id=?').get(userId);
}

function createWeatherFeature({ app, db, auth, rateLimit }) {
  const weatherLimiter = rateLimit
    ? rateLimit({ windowMs: 60_000, max: 90, message: { error: 'Too many weather requests' } })
    : (_req, _res, next) => next();

  app.get('/api/weather/settings', auth, (req, res) => {
    res.json({ settings: rowToSettings(getSettingsRow(db, req.user.id)) });
  });

  app.put('/api/weather/settings', auth, (req, res) => {
    const body = req.body || {};
    const enabled = !!body.enabled;
    const refreshMinutes = clampRefreshMinutes(body.refresh_minutes);
    const existing = rowToSettings(getSettingsRow(db, req.user.id));
    const nextLocation = normalizeLocation(body.location) || existing.location;
    if (enabled && !nextLocation) {
      return res.status(400).json({ error: 'Choose a city first' });
    }
    db.prepare(`
      INSERT INTO user_weather_settings (
        user_id, enabled, location_name, country, admin1, latitude, longitude, timezone, refresh_minutes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        enabled=excluded.enabled,
        location_name=excluded.location_name,
        country=excluded.country,
        admin1=excluded.admin1,
        latitude=excluded.latitude,
        longitude=excluded.longitude,
        timezone=excluded.timezone,
        refresh_minutes=excluded.refresh_minutes,
        updated_at=datetime('now')
    `).run(
      req.user.id,
      enabled ? 1 : 0,
      nextLocation ? nextLocation.name : null,
      nextLocation ? nextLocation.country : null,
      nextLocation ? nextLocation.admin1 : null,
      nextLocation ? nextLocation.latitude : null,
      nextLocation ? nextLocation.longitude : null,
      nextLocation ? nextLocation.timezone : null,
      refreshMinutes
    );
    const settings = rowToSettings(getSettingsRow(db, req.user.id));
    res.json({ settings });
  });

  app.get('/api/weather/search', auth, weatherLimiter, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.json({ results: [] });
      if (q.length > 80) return res.status(400).json({ error: 'Search query is too long' });
      const url = new URL(GEOCODING_URL);
      url.searchParams.set('name', q);
      url.searchParams.set('count', '8');
      url.searchParams.set('language', 'ru');
      url.searchParams.set('format', 'json');
      const data = await getJson(url);
      const results = (data.results || []).map(normalizeGeocodingResult).filter(Boolean);
      res.json({ results });
    } catch (e) {
      res.status(502).json({ error: e.message || 'Weather search failed' });
    }
  });

  app.get('/api/weather/current', auth, weatherLimiter, async (req, res) => {
    try {
      const settings = rowToSettings(getSettingsRow(db, req.user.id));
      if (!settings.enabled || !settings.location) {
        return res.json({ enabled: false, settings });
      }

      const force = req.query.force === '1';
      const cacheKey = `${req.user.id}:${settings.location.latitude.toFixed(4)}:${settings.location.longitude.toFixed(4)}`;
      const ttlMs = settings.refresh_minutes * 60 * 1000;
      const cached = weatherCache.get(cacheKey);
      if (!force && cached && Date.now() - cached.cachedAt < ttlMs) {
        return res.json(cached.payload);
      }

      const url = new URL(FORECAST_URL);
      url.searchParams.set('latitude', settings.location.latitude);
      url.searchParams.set('longitude', settings.location.longitude);
      url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m,is_day');
      url.searchParams.set('wind_speed_unit', 'ms');
      url.searchParams.set('timezone', 'auto');
      url.searchParams.set('forecast_days', '1');
      const data = await getJson(url);
      const current = data.current || {};
      const payload = {
        enabled: true,
        settings,
        location: settings.location,
        temperature: Number(current.temperature_2m),
        weather_code: Number(current.weather_code),
        is_day: Number(current.is_day) === 1,
        wind_speed: Number(current.wind_speed_10m),
        weather_time: current.time || null,
        fetched_at: new Date().toISOString(),
      };
      weatherCache.set(cacheKey, { cachedAt: Date.now(), payload });
      res.json(payload);
    } catch (e) {
      res.status(502).json({ error: e.message || 'Weather update failed' });
    }
  });
}

module.exports = { createWeatherFeature };
