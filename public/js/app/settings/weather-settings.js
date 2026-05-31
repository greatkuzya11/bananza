(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const settingsRoot = root.settings = root.settings || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createWeatherSettings(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const actions = objectOrDefault(opts.actions);
    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    let weatherSettings = { enabled: false, refresh_minutes: 30, location: null };
    let weatherSettingsLoaded = false;
    let selectedWeatherLocation = null;
    let weatherSearchResults = [];
    let weatherTimer = null;
    let weatherSearchTimer = null;

    function $(selector, rootEl = doc) {
      if (typeof dom.$ === 'function') return dom.$(selector, rootEl);
      return rootEl?.querySelector?.(selector) || null;
    }

    function byId(id) {
      return doc.getElementById(id);
    }

    function setInlineStatus(targetIds, message, type = '') {
      if (typeof actions.setInlineStatus === 'function') {
        actions.setInlineStatus(targetIds, message, type);
        return;
      }
      const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
      ids.forEach((id) => {
        const el = byId(id);
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
        el.classList.toggle('is-pending', type === 'pending');
      });
    }

    function weatherLocationLabel(location) {
      if (!location) return '';
      return [location.name, location.admin1, location.country].filter(Boolean).join(', ');
    }

    function weatherIcon(code, isDay) {
      if (code === 0) return isDay ? '\u2600\uFE0F' : '\uD83C\uDF19';
      if (code === 1 || code === 2) return isDay ? '\uD83C\uDF24\uFE0F' : '\u2601\uFE0F';
      if (code === 3) return '\u2601\uFE0F';
      if (code === 45 || code === 48) return '\uD83C\uDF2B\uFE0F';
      if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '\uD83C\uDF27\uFE0F';
      if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '\u2744\uFE0F';
      if (code >= 95) return '\u26C8\uFE0F';
      return '\uD83C\uDF21\uFE0F';
    }

    function formatWeatherValue(value, fallback, precision = 0) {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      const rounded = precision ? (Math.round(n * 10) / 10).toFixed(1) : String(Math.round(n));
      return rounded.replace(/\.0$/, '').replace('.', ',');
    }

    function renderWeatherWidget(data) {
      const weatherWidget = dom.weatherWidget || byId('weatherWidget');
      if (!weatherWidget) return;
      if (!weatherSettings.enabled || !weatherSettings.location) {
        weatherWidget.classList.add('hidden');
        return;
      }
      const temp = `${formatWeatherValue(data?.temperature, '--')}\u00B0`;
      const wind = `${formatWeatherValue(data?.wind_speed, '--', 1)} \u043C/\u0441`;
      const icon = data ? weatherIcon(Number(data.weather_code), data.is_day) : '\u26C5';
      weatherWidget.classList.remove('hidden', 'is-loading', 'is-error');
      weatherWidget.setAttribute('role', 'button');
      weatherWidget.tabIndex = 0;
      weatherWidget.classList.toggle('interactive', !weatherWidget.classList.contains('hidden'));
      if (!data) weatherWidget.classList.add('is-error');
      weatherWidget.title = data
        ? `Weather: ${weatherLocationLabel(weatherSettings.location)}`
        : 'Weather unavailable';
      weatherWidget.innerHTML = `<span class="weather-widget-icon">${icon}</span><span>${temp}</span><span>${wind}</span>`;
    }

    function setWeatherStatus(message, type = '') {
      setInlineStatus('settingsWeatherStatus', message, type);
    }

    function renderWeatherSettingsForm(draft = {}) {
      const enabledInput = byId('settingsWeatherEnabled');
      const controls = byId('settingsWeatherControls');
      const refreshInput = byId('settingsWeatherRefresh');
      const selectedEl = byId('settingsWeatherSelected');
      if (!enabledInput || !controls || !refreshInput || !selectedEl) return;
      const enabled = draft.enabled ?? weatherSettings.enabled;
      enabledInput.checked = !!enabled;
      controls.classList.toggle('hidden', !enabledInput.checked);
      refreshInput.value = draft.refresh_minutes ?? weatherSettings.refresh_minutes ?? 30;
      selectedWeatherLocation = selectedWeatherLocation || weatherSettings.location;
      const label = weatherLocationLabel(selectedWeatherLocation);
      selectedEl.textContent = label ? `Selected: ${label}` : 'No city selected';
    }

    function renderWeatherSearchResults(results) {
      const wrap = byId('settingsWeatherResults');
      if (!wrap) return;
      weatherSearchResults = results || [];
      if (!weatherSearchResults.length) {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
        return;
      }
      wrap.innerHTML = weatherSearchResults.map((item, index) => {
        const title = esc(weatherLocationLabel(item));
        const details = [item.country_code, item.population ? `pop. ${item.population}` : '']
          .filter(Boolean).join(' &middot; ');
        return `<button type="button" class="weather-result-item" data-index="${index}">
        <span>${title}</span>
        ${details ? `<small>${esc(details)}</small>` : ''}
      </button>`;
      }).join('');
      wrap.classList.remove('hidden');
    }

    function scheduleWeatherRefresh() {
      win.clearTimeout(weatherTimer);
      if (!weatherSettings.enabled || !weatherSettings.location) return;
      const minutes = Math.min(180, Math.max(10, Number(weatherSettings.refresh_minutes) || 30));
      weatherTimer = win.setTimeout(() => {
        loadCurrentWeather(false);
      }, minutes * 60 * 1000);
    }

    async function loadWeatherSettings() {
      try {
        const data = await api('/api/weather/settings');
        weatherSettings = data.settings || weatherSettings;
        selectedWeatherLocation = weatherSettings.location;
        weatherSettingsLoaded = true;
        renderWeatherSettingsForm();
      } catch {
        weatherSettingsLoaded = false;
      }
      return weatherSettings;
    }

    async function loadCurrentWeather(force = false) {
      const weatherWidget = dom.weatherWidget || byId('weatherWidget');
      win.clearTimeout(weatherTimer);
      if (!weatherSettings.enabled || !weatherSettings.location) {
        renderWeatherWidget(null);
        return null;
      }
      weatherWidget?.classList.add('is-loading');
      try {
        const data = await api(`/api/weather/current${force ? '?force=1' : ''}`);
        if (!data || !data.enabled) {
          weatherSettings = data?.settings || weatherSettings;
          weatherSettingsLoaded = true;
          renderWeatherWidget(null);
          return data || null;
        }
        weatherSettings = data.settings || weatherSettings;
        selectedWeatherLocation = weatherSettings.location;
        weatherSettingsLoaded = true;
        renderWeatherWidget(data);
        renderWeatherSettingsForm();
        setWeatherStatus(force ? `Updated ${new Date(data.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '', 'success');
        return data;
      } catch (e) {
        renderWeatherWidget(null);
        if (force) setWeatherStatus(e.message || 'Weather update failed', 'error');
        return null;
      } finally {
        weatherWidget?.classList.remove('is-loading');
        scheduleWeatherRefresh();
      }
    }

    async function searchWeatherLocations() {
      const input = byId('settingsWeatherSearch');
      if (!input) return;
      const q = input.value.trim();
      if (q.length < 2) {
        renderWeatherSearchResults([]);
        setWeatherStatus('Type at least 2 characters');
        return;
      }
      setWeatherStatus('Searching...');
      try {
        const data = await api(`/api/weather/search?q=${encodeURIComponent(q)}`);
        renderWeatherSearchResults(data.results || []);
        setWeatherStatus(data.results?.length ? '' : 'No cities found');
      } catch (e) {
        renderWeatherSearchResults([]);
        setWeatherStatus(e.message || 'Weather search failed', 'error');
      }
    }

    async function saveWeatherSettings() {
      const enabled = !!byId('settingsWeatherEnabled')?.checked;
      const refreshInput = byId('settingsWeatherRefresh');
      const refreshMinutes = Math.min(180, Math.max(10, Number(refreshInput?.value) || 30));
      const location = selectedWeatherLocation || weatherSettings.location;
      if (enabled && !location) {
        setWeatherStatus('Choose a city first', 'error');
        return;
      }
      setWeatherStatus('Saving...');
      try {
        const data = await api('/api/weather/settings', {
          method: 'PUT',
          body: { enabled, location, refresh_minutes: refreshMinutes },
        });
        weatherSettings = data.settings || weatherSettings;
        selectedWeatherLocation = weatherSettings.location;
        weatherSettingsLoaded = true;
        renderWeatherSettingsForm();
        setWeatherStatus('Saved', 'success');
        if (weatherSettings.enabled) await loadCurrentWeather(true);
        else {
          win.clearTimeout(weatherTimer);
          renderWeatherWidget(null);
        }
      } catch (e) {
        setWeatherStatus(e.message || 'Weather settings save failed', 'error');
      }
      return weatherSettings;
    }

    function bindEvents({ bindAsyncActionButtons, withActionButtons } = {}) {
      const bindAsync = typeof bindAsyncActionButtons === 'function'
        ? bindAsyncActionButtons
        : () => {};
      const withButtons = typeof withActionButtons === 'function'
        ? withActionButtons
        : (targetIds, label, task) => Promise.resolve().then(task);

      byId('settingsWeatherEnabled')?.addEventListener('change', async (e) => {
        byId('settingsWeatherControls')?.classList.toggle('hidden', !e.target.checked);
        if (!e.target.checked) await saveWeatherSettings();
      });
      bindAsync('settingsWeatherSearchBtn', null, 'Searching...', searchWeatherLocations);
      byId('settingsWeatherSearch')?.addEventListener('input', () => {
        win.clearTimeout(weatherSearchTimer);
        if (byId('settingsWeatherSearch').value.trim().length < 2) {
          renderWeatherSearchResults([]);
          return;
        }
        weatherSearchTimer = win.setTimeout(searchWeatherLocations, 350);
      });
      byId('settingsWeatherSearch')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          withButtons('settingsWeatherSearchBtn', 'Searching...', searchWeatherLocations).catch(() => {});
        }
      });
      byId('settingsWeatherResults')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.weather-result-item');
        if (!btn) return;
        selectedWeatherLocation = weatherSearchResults[+btn.dataset.index] || null;
        renderWeatherSettingsForm({
          enabled: byId('settingsWeatherEnabled')?.checked,
          refresh_minutes: byId('settingsWeatherRefresh')?.value,
        });
        renderWeatherSearchResults([]);
        setWeatherStatus(selectedWeatherLocation ? 'City selected, save settings' : '', selectedWeatherLocation ? 'success' : '');
      });
      bindAsync('settingsWeatherSave', null, 'Saving...', saveWeatherSettings);
      bindAsync('settingsWeatherRefreshNow', null, 'Refreshing...', saveWeatherSettings);
    }

    function bindWidget() {
      const weatherWidget = dom.weatherWidget || byId('weatherWidget');
      if (!weatherWidget) return;
      weatherWidget.addEventListener('click', () => {
        if (!weatherSettings.enabled || !weatherSettings.location) return;
        loadCurrentWeather(true).catch(() => {});
      });
      weatherWidget.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          weatherWidget.click();
        }
      });
    }

    return {
      weatherLocationLabel,
      weatherIcon,
      formatWeatherValue,
      renderWeatherWidget,
      setWeatherStatus,
      renderWeatherSettingsForm,
      renderWeatherSearchResults,
      scheduleWeatherRefresh,
      loadWeatherSettings,
      loadCurrentWeather,
      searchWeatherLocations,
      saveWeatherSettings,
      bindEvents,
      bindWidget,
      getWeatherSettings: () => ({ ...weatherSettings }),
      isWeatherSettingsLoaded: () => weatherSettingsLoaded,
      getSelectedWeatherLocation: () => selectedWeatherLocation ? { ...selectedWeatherLocation } : null,
      getWeatherSearchResults: () => weatherSearchResults.slice(),
    };
  }

  settingsRoot.weather = {
    createWeatherSettings,
  };
})();
