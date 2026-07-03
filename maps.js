const http = require('http');
const https = require('https');

const DEFAULT_MAP_SETTINGS = {
  enabled: false,
  provider: 'osm',
  tile_url_template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tile_attribution: '\u00A9 OpenStreetMap contributors',
  search_url: 'https://nominatim.openstreetmap.org/search',
  reverse_url: 'https://nominatim.openstreetmap.org/reverse',
  max_zoom: 19,
};

const geocodeCache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimRequestAt = 0;

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return Boolean(value);
  if (value === '0' || value === '1') return value === '1';
  return fallback;
}

function clampInteger(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function validCoordinate(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 1e7) / 1e7;
}

function cleanString(value, limit = 300) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, limit) : '';
}

function normalizeProvider(value) {
  const provider = cleanString(value, 32).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return provider || DEFAULT_MAP_SETTINGS.provider;
}

function normalizeHttpUrl(value, fallback) {
  const raw = cleanString(value, 500);
  const candidate = raw || fallback;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function normalizeTileTemplate(value, fallback = DEFAULT_MAP_SETTINGS.tile_url_template) {
  const template = cleanString(value, 500) || fallback;
  if (!template.includes('{z}') || !template.includes('{x}') || !template.includes('{y}')) return fallback;
  try {
    const probe = template
      .replaceAll('{z}', '1')
      .replaceAll('{x}', '1')
      .replaceAll('{y}', '1')
      .replaceAll('{s}', 'a');
    const url = new URL(probe);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return template;
  } catch {
    return fallback;
  }
}

function normalizeMapSettings(input = {}, existing = DEFAULT_MAP_SETTINGS) {
  const current = existing || DEFAULT_MAP_SETTINGS;
  return {
    enabled: boolValue(input.enabled, boolValue(current.enabled, false)),
    provider: normalizeProvider(input.provider ?? current.provider),
    tile_url_template: normalizeTileTemplate(input.tile_url_template ?? current.tile_url_template),
    tile_attribution: cleanString(input.tile_attribution ?? current.tile_attribution, 300)
      || DEFAULT_MAP_SETTINGS.tile_attribution,
    search_url: normalizeHttpUrl(input.search_url ?? current.search_url, DEFAULT_MAP_SETTINGS.search_url),
    reverse_url: normalizeHttpUrl(input.reverse_url ?? current.reverse_url, DEFAULT_MAP_SETTINGS.reverse_url),
    max_zoom: clampInteger(input.max_zoom ?? current.max_zoom, 1, 22, DEFAULT_MAP_SETTINGS.max_zoom),
  };
}

function rowToSettings(row) {
  if (!row) return { ...DEFAULT_MAP_SETTINGS, updated_at: null };
  return {
    enabled: Number(row.enabled) !== 0,
    provider: normalizeProvider(row.provider),
    tile_url_template: normalizeTileTemplate(row.tile_url_template),
    tile_attribution: cleanString(row.tile_attribution, 300) || DEFAULT_MAP_SETTINGS.tile_attribution,
    search_url: normalizeHttpUrl(row.search_url, DEFAULT_MAP_SETTINGS.search_url),
    reverse_url: normalizeHttpUrl(row.reverse_url, DEFAULT_MAP_SETTINGS.reverse_url),
    max_zoom: clampInteger(row.max_zoom, 1, 22, DEFAULT_MAP_SETTINGS.max_zoom),
    updated_at: row.updated_at || null,
  };
}

function publicSettings(settings) {
  const normalized = normalizeMapSettings(settings);
  return {
    enabled: normalized.enabled,
    provider: normalized.provider,
    tile_url_template: normalized.tile_url_template,
    tile_attribution: normalized.tile_attribution,
    max_zoom: normalized.max_zoom,
  };
}

function normalizeMessageLocation(input, { requireLocation = true } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    if (requireLocation) {
      const error = new Error('Invalid location payload');
      error.status = 400;
      throw error;
    }
    return null;
  }
  const latitude = validCoordinate(input.latitude ?? input.lat, -90, 90);
  const longitude = validCoordinate(input.longitude ?? input.lon ?? input.lng, -180, 180);
  if (latitude == null || longitude == null) {
    const error = new Error('Invalid location coordinates');
    error.status = 400;
    throw error;
  }
  return {
    latitude,
    longitude,
    zoom: clampInteger(input.zoom, 1, 22, 16),
    title: cleanString(input.title || input.name, 160) || null,
    address: cleanString(input.address || input.display_name, 300) || null,
    provider: normalizeProvider(input.provider),
  };
}

function locationPayload(row) {
  if (!row) return null;
  const location = normalizeMessageLocation(row, { requireLocation: false });
  if (!location) return null;
  return {
    ...location,
    created_at: row.created_at || null,
  };
}

function getJson(url, { userAgent, language = 'ru', timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = typeof url === 'string' ? new URL(url) : url;
    const transport = parsed.protocol === 'http:' ? http : https;
    const req = transport.get(parsed, {
      headers: {
        'User-Agent': userAgent || buildMapUserAgent(),
        'Accept': 'application/json',
        'Accept-Language': language || 'ru',
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Map provider returned HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Map provider returned invalid JSON'));
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Map provider request timeout')));
    req.on('error', reject);
  });
}

function buildMapUserAgent() {
  const contact = cleanString(process.env.BANANZA_MAP_CONTACT || process.env.VAPID_SUBJECT || '', 160);
  return contact ? `Bananza self-hosted chat (${contact})` : 'Bananza self-hosted chat';
}

function cacheKeyFor(url) {
  return String(url || '').trim();
}

function cachedJson(url, options = {}) {
  const key = cacheKeyFor(url);
  const now = Date.now();
  const cached = geocodeCache.get(key);
  if (cached && now - cached.at < 15 * 60 * 1000) return Promise.resolve(cached.data);
  nominatimQueue = nominatimQueue
    .catch(() => {})
    .then(async () => {
      const waitMs = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
      lastNominatimRequestAt = Date.now();
      const data = await getJson(url, options);
      geocodeCache.set(key, { at: Date.now(), data });
      return data;
    });
  return nominatimQueue;
}

function normalizeSearchResult(item) {
  const latitude = validCoordinate(item?.lat, -90, 90);
  const longitude = validCoordinate(item?.lon, -180, 180);
  if (latitude == null || longitude == null) return null;
  const title = cleanString(item.name || item.display_name, 160);
  const address = cleanString(item.display_name || title, 300);
  return {
    id: item.place_id || `${latitude},${longitude}`,
    latitude,
    longitude,
    title,
    address,
    type: cleanString(item.type || item.category, 80) || null,
    provider: 'osm',
  };
}

function normalizeReverseResult(item) {
  if (!item || typeof item !== 'object') return null;
  return normalizeSearchResult({
    ...item,
    name: item.name || item.display_name,
  });
}

function createMapFeature({ app, db, auth, adminOnly, rateLimit } = {}) {
  const mapLimiter = rateLimit
    ? rateLimit({ windowMs: 60_000, max: 90, message: { error: 'Too many map requests' } })
    : (_req, _res, next) => next();
  const getSettingsStmt = db.prepare('SELECT * FROM map_provider_settings WHERE id=1');
  const upsertSettingsStmt = db.prepare(`
    INSERT INTO map_provider_settings(
      id, enabled, provider, tile_url_template, tile_attribution, search_url, reverse_url, max_zoom, updated_at
    ) VALUES(1,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      enabled=excluded.enabled,
      provider=excluded.provider,
      tile_url_template=excluded.tile_url_template,
      tile_attribution=excluded.tile_attribution,
      search_url=excluded.search_url,
      reverse_url=excluded.reverse_url,
      max_zoom=excluded.max_zoom,
      updated_at=datetime('now')
  `);

  function getSettings() {
    return rowToSettings(getSettingsStmt.get());
  }

  function saveSettings(input) {
    const next = normalizeMapSettings(input, getSettings());
    upsertSettingsStmt.run(
      next.enabled ? 1 : 0,
      next.provider,
      next.tile_url_template,
      next.tile_attribution,
      next.search_url,
      next.reverse_url,
      next.max_zoom
    );
    return getSettings();
  }

  function requireEnabled(res) {
    const settings = getSettings();
    if (!settings.enabled) {
      res.status(403).json({ error: 'Maps are disabled', settings: publicSettings(settings) });
      return null;
    }
    return settings;
  }

  function languageFor(req) {
    const lang = cleanString(req.user?.ui_language || req.query?.lang || 'ru', 8).toLowerCase();
    return lang === 'en' ? 'en' : 'ru';
  }

  app.get('/api/maps/config', auth, (_req, res) => {
    res.json({ settings: publicSettings(getSettings()) });
  });

  app.get('/api/admin/maps/settings', auth, adminOnly, (_req, res) => {
    res.json({ settings: getSettings(), user_agent: buildMapUserAgent() });
  });

  app.put('/api/admin/maps/settings', auth, adminOnly, (req, res) => {
    res.json({ settings: saveSettings(req.body || {}), user_agent: buildMapUserAgent() });
  });

  app.get('/api/maps/search', auth, mapLimiter, async (req, res) => {
    const settings = requireEnabled(res);
    if (!settings) return;
    const q = cleanString(req.query.q, 80);
    if (q.length < 2) return res.json({ results: [] });
    try {
      const url = new URL(settings.search_url);
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '8');
      url.searchParams.set('addressdetails', '1');
      const language = languageFor(req);
      url.searchParams.set('accept-language', language);
      const data = await cachedJson(url, { language, userAgent: buildMapUserAgent() });
      const results = (Array.isArray(data) ? data : [])
        .map(normalizeSearchResult)
        .filter(Boolean)
        .slice(0, 8);
      res.json({ results });
    } catch (error) {
      res.status(502).json({ error: error.message || 'Map search failed' });
    }
  });

  app.get('/api/maps/reverse', auth, mapLimiter, async (req, res) => {
    const settings = requireEnabled(res);
    if (!settings) return;
    const latitude = validCoordinate(req.query.lat ?? req.query.latitude, -90, 90);
    const longitude = validCoordinate(req.query.lon ?? req.query.lng ?? req.query.longitude, -180, 180);
    if (latitude == null || longitude == null) return res.status(400).json({ error: 'Invalid location coordinates' });
    try {
      const url = new URL(settings.reverse_url);
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      const language = languageFor(req);
      url.searchParams.set('accept-language', language);
      const data = await cachedJson(url, { language, userAgent: buildMapUserAgent() });
      res.json({ result: normalizeReverseResult(data) || { latitude, longitude, provider: 'osm' } });
    } catch (error) {
      res.status(502).json({ error: error.message || 'Map reverse geocode failed' });
    }
  });

  return {
    getSettings,
    saveSettings,
    isEnabled: () => Boolean(getSettings().enabled),
  };
}

module.exports = {
  DEFAULT_MAP_SETTINGS,
  buildMapUserAgent,
  createMapFeature,
  locationPayload,
  normalizeMapSettings,
  normalizeMessageLocation,
};
