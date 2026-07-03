(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const settingsRoot = root.settings = root.settings || {};

  const DEFAULT_SETTINGS = {
    enabled: false,
    provider: 'osm',
    tile_url_template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tile_attribution: '\u00A9 OpenStreetMap contributors',
    search_url: 'https://nominatim.openstreetmap.org/search',
    reverse_url: 'https://nominatim.openstreetmap.org/reverse',
    max_zoom: 19,
  };

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function t(key, params) {
    return window.BananzaI18n?.t ? window.BananzaI18n.t(key, params) : String(key || '');
  }

  function createMapSettings(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const actions = objectOrDefault(opts.actions);

    let mapSettings = { ...DEFAULT_SETTINGS };
    let userAgent = '';
    let loaded = false;
    let eventsBound = false;

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
        el.textContent = message ? t(message) : '';
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
        el.classList.toggle('is-pending', type === 'pending');
      });
    }

    function normalizeSettings(value = {}) {
      return {
        ...DEFAULT_SETTINGS,
        ...objectOrDefault(value),
        enabled: Boolean(value.enabled),
        max_zoom: Math.min(22, Math.max(1, Math.round(Number(value.max_zoom) || DEFAULT_SETTINGS.max_zoom))),
      };
    }

    function setMapsStatus(message, type = '') {
      setInlineStatus('settingsMapsStatus', message, type);
    }

    function renderMapSettingsForm() {
      const settings = normalizeSettings(mapSettings);
      const enabledInput = byId('settingsMapsEnabled');
      const controls = byId('settingsMapsControls');
      if (enabledInput) enabledInput.checked = Boolean(settings.enabled);
      controls?.classList.remove('hidden');
      const values = {
        settingsMapsProvider: settings.provider,
        settingsMapsTileUrl: settings.tile_url_template,
        settingsMapsAttribution: settings.tile_attribution,
        settingsMapsSearchUrl: settings.search_url,
        settingsMapsReverseUrl: settings.reverse_url,
        settingsMapsMaxZoom: settings.max_zoom,
        settingsMapsUserAgent: userAgent,
      };
      Object.entries(values).forEach(([id, value]) => {
        const el = byId(id);
        if (el) el.value = value == null ? '' : String(value);
      });
    }

    function getMapSettingsFromForm() {
      return {
        enabled: Boolean(byId('settingsMapsEnabled')?.checked),
        provider: byId('settingsMapsProvider')?.value || DEFAULT_SETTINGS.provider,
        tile_url_template: byId('settingsMapsTileUrl')?.value || DEFAULT_SETTINGS.tile_url_template,
        tile_attribution: byId('settingsMapsAttribution')?.value || DEFAULT_SETTINGS.tile_attribution,
        search_url: byId('settingsMapsSearchUrl')?.value || DEFAULT_SETTINGS.search_url,
        reverse_url: byId('settingsMapsReverseUrl')?.value || DEFAULT_SETTINGS.reverse_url,
        max_zoom: Number(byId('settingsMapsMaxZoom')?.value || DEFAULT_SETTINGS.max_zoom),
      };
    }

    async function loadMapSettings() {
      try {
        const data = await api('/api/admin/maps/settings');
        mapSettings = normalizeSettings(data.settings || mapSettings);
        userAgent = data.user_agent || userAgent;
        loaded = true;
        renderMapSettingsForm();
      } catch (error) {
        loaded = false;
        setMapsStatus(error.message || 'Map settings load failed', 'error');
      }
      return mapSettings;
    }

    async function saveMapSettings() {
      setMapsStatus('Saving...', 'pending');
      try {
        const data = await api('/api/admin/maps/settings', {
          method: 'PUT',
          body: getMapSettingsFromForm(),
        });
        mapSettings = normalizeSettings(data.settings || mapSettings);
        userAgent = data.user_agent || userAgent;
        loaded = true;
        renderMapSettingsForm();
        setMapsStatus('Saved', 'success');
        await Promise.resolve(actions.onSettingsSaved?.(mapSettings)).catch(() => {});
      } catch (error) {
        setMapsStatus(error.message || 'Map settings save failed', 'error');
      }
      return mapSettings;
    }

    async function testMapSearch() {
      const query = (byId('settingsMapsTestQuery')?.value || 'Kaliningrad').trim();
      if (!query) {
        setMapsStatus('Type a place to test', 'error');
        return null;
      }
      setMapsStatus('Searching...', 'pending');
      try {
        const data = await api(`/api/maps/search?q=${encodeURIComponent(query)}`);
        const count = Array.isArray(data.results) ? data.results.length : 0;
        setMapsStatus(count ? t('Found {count} places', { count }) : 'No places found', count ? 'success' : '');
        return data;
      } catch (error) {
        setMapsStatus(error.message || 'Map search failed', 'error');
        return null;
      }
    }

    function bindMapActionButton(id, pendingLabel, task, withButtons) {
      const button = byId(id);
      if (!button || button.dataset.bananzaMapSettingsBound === '1') return;
      button.dataset.bananzaMapSettingsBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        withButtons(id, pendingLabel, task).catch((error) => {
          setMapsStatus(error.message || 'Map settings save failed', 'error');
        });
      });
    }

    function bindEvents({ withActionButtons } = {}) {
      if (eventsBound) return;
      eventsBound = true;
      const withButtons = typeof withActionButtons === 'function'
        ? withActionButtons
        : (_targetIds, _label, task) => Promise.resolve().then(task);
      byId('settingsMapsEnabled')?.addEventListener('change', (event) => {
        byId('settingsMapsControls')?.classList.remove('hidden');
      });
      bindMapActionButton('settingsMapsSaveBtn', 'Saving...', saveMapSettings, withButtons);
      bindMapActionButton('settingsMapsTestBtn', 'Searching...', testMapSearch, withButtons);
      byId('settingsMapsTestQuery')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        withButtons('settingsMapsTestBtn', 'Searching...', testMapSearch).catch(() => {});
      });
    }

    return {
      bindEvents,
      getSettings: () => ({ ...mapSettings }),
      isLoaded: () => loaded,
      loadMapSettings,
      loadSettings: loadMapSettings,
      renderMapSettingsForm,
      saveMapSettings,
      saveSettings: saveMapSettings,
      setMapsStatus,
      testMapSearch,
    };
  }

  settingsRoot.maps = {
    createMapSettings,
  };
})();
