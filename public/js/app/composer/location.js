(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  const DEFAULT_MAP_CONFIG = {
    enabled: false,
    provider: 'osm',
    tile_url_template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tile_attribution: '\u00A9 OpenStreetMap contributors',
    max_zoom: 19,
  };
  const LAST_LOCATION_KEY = 'bananza:last-location-picker';

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function t(key, params) {
    return window.BananzaI18n?.t ? window.BananzaI18n.t(key, params) : String(key || '');
  }

  function createComposerLocationController(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const services = objectOrDefault(opts.services);
    const outbox = objectOrDefault(services.messages?.outbox || opts.outbox);
    const storage = opts.storage || win.localStorage;

    let mapConfig = { ...DEFAULT_MAP_CONFIG };
    let configLoaded = false;
    let pickerMap = null;
    let pickerMarker = null;
    let selectedLocation = null;
    let searchResults = [];
    let reverseSeq = 0;

    function byId(id) {
      return doc.getElementById(id);
    }

    function esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function normalizeConfig(value = {}) {
      return {
        ...DEFAULT_MAP_CONFIG,
        ...objectOrDefault(value),
        enabled: Boolean(value.enabled),
        max_zoom: Math.min(22, Math.max(1, Math.round(Number(value.max_zoom) || DEFAULT_MAP_CONFIG.max_zoom))),
      };
    }

    function normalizeLocation(value = {}) {
      const latitude = Number(value.latitude ?? value.lat);
      const longitude = Number(value.longitude ?? value.lon ?? value.lng);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
      return {
        latitude,
        longitude,
        zoom: Math.min(mapConfig.max_zoom || 19, Math.max(1, Math.round(Number(value.zoom) || 16))),
        title: String(value.title || value.name || '').trim().slice(0, 160) || null,
        address: String(value.address || value.display_name || '').trim().slice(0, 300) || null,
        provider: String(value.provider || mapConfig.provider || 'osm').trim() || 'osm',
      };
    }

    function locationLabel(location) {
      if (!location) return '';
      return String(location.title || location.address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`).trim();
    }

    function setStatus(message, type = '') {
      const status = byId('locationPickerStatus');
      if (!status) return;
      status.textContent = message ? t(message) : '';
      status.classList.toggle('is-error', type === 'error');
      status.classList.toggle('is-success', type === 'success');
      status.classList.toggle('is-pending', type === 'pending');
    }

    function setSelectedLabel() {
      const selected = byId('locationPickerSelected');
      if (!selected) return;
      if (!selectedLocation) {
        selected.textContent = t('No location selected');
        return;
      }
      selected.textContent = locationLabel(selectedLocation);
    }

    function updateSendState() {
      const sendBtn = byId('locationPickerSendBtn');
      if (sendBtn) sendBtn.disabled = !selectedLocation;
    }

    function syncAttachMenuLocation() {
      const item = byId('attachMenuLocation');
      if (!item) return;
      item.classList.toggle('hidden', !mapConfig.enabled);
      item.hidden = !mapConfig.enabled;
    }

    async function loadMapConfig({ force = false } = {}) {
      if (configLoaded && !force) return mapConfig;
      try {
        const data = await api('/api/maps/config');
        mapConfig = normalizeConfig(data.settings || data || {});
        configLoaded = true;
      } catch {
        mapConfig = normalizeConfig(mapConfig);
        configLoaded = false;
      }
      root.maps = root.maps || {};
      root.maps.config = { ...mapConfig };
      root.maps.getConfig = () => ({ ...mapConfig });
      root.maps.loadConfig = loadMapConfig;
      syncAttachMenuLocation();
      return mapConfig;
    }

    function isMapsEnabled() {
      return Boolean(mapConfig.enabled);
    }

    function getInitialCenter() {
      try {
        const saved = normalizeLocation(JSON.parse(storage.getItem(LAST_LOCATION_KEY) || 'null') || {});
        if (saved) return { center: [saved.latitude, saved.longitude], zoom: saved.zoom || 14 };
      } catch {}
      return { center: [20, 0], zoom: 2 };
    }

    function createTileLayer(map) {
      if (!win.L || !map) return null;
      return win.L.tileLayer(mapConfig.tile_url_template || DEFAULT_MAP_CONFIG.tile_url_template, {
        maxZoom: mapConfig.max_zoom || DEFAULT_MAP_CONFIG.max_zoom,
        attribution: mapConfig.tile_attribution || DEFAULT_MAP_CONFIG.tile_attribution,
      }).addTo(map);
    }

    function ensurePickerMap() {
      if (!win.L) {
        setStatus('Map library failed to load', 'error');
        return null;
      }
      const mapEl = byId('locationPickerMap');
      if (!mapEl) return null;
      if (pickerMap) return pickerMap;
      const initial = getInitialCenter();
      pickerMap = win.L.map(mapEl, {
        zoomControl: true,
        attributionControl: true,
      }).setView(initial.center, initial.zoom);
      createTileLayer(pickerMap);
      pickerMap.on('click', (event) => {
        selectLocation({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
          zoom: pickerMap.getZoom() || 16,
          provider: mapConfig.provider || 'osm',
        }, { reverse: true });
      });
      return pickerMap;
    }

    function placeMarker(location) {
      const map = ensurePickerMap();
      if (!map || !win.L || !location) return;
      const latLng = [location.latitude, location.longitude];
      if (!pickerMarker) {
        pickerMarker = win.L.marker(latLng, { draggable: true }).addTo(map);
        pickerMarker.on('dragend', () => {
          const pos = pickerMarker.getLatLng();
          selectLocation({
            latitude: pos.lat,
            longitude: pos.lng,
            zoom: map.getZoom() || location.zoom || 16,
            provider: mapConfig.provider || 'osm',
          }, { reverse: true });
        });
      } else {
        pickerMarker.setLatLng(latLng);
      }
      map.setView(latLng, Math.max(location.zoom || 16, map.getZoom() || 2));
    }

    async function reverseSelected(location) {
      const seq = ++reverseSeq;
      try {
        const data = await api(`/api/maps/reverse?lat=${encodeURIComponent(location.latitude)}&lon=${encodeURIComponent(location.longitude)}`);
        if (seq !== reverseSeq) return;
        const normalized = normalizeLocation(data.result || {});
        if (!normalized) return;
        selectedLocation = {
          ...selectedLocation,
          title: normalized.title || selectedLocation.title,
          address: normalized.address || selectedLocation.address,
        };
        setSelectedLabel();
      } catch {}
    }

    function selectLocation(location, { reverse = false, moveMap = true } = {}) {
      const normalized = normalizeLocation(location);
      if (!normalized) return false;
      selectedLocation = normalized;
      if (moveMap) placeMarker(normalized);
      setSelectedLabel();
      updateSendState();
      try { storage.setItem(LAST_LOCATION_KEY, JSON.stringify(normalized)); } catch {}
      if (reverse && !normalized.address) reverseSelected(normalized);
      return true;
    }

    function renderSearchResults(results) {
      const wrap = byId('locationPickerResults');
      if (!wrap) return;
      searchResults = Array.isArray(results) ? results.map(normalizeLocation).filter(Boolean) : [];
      if (!searchResults.length) {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
        return;
      }
      wrap.innerHTML = searchResults.map((item, index) => `
        <button type="button" class="weather-result-item location-result-item" data-index="${index}">
          <span>${esc(locationLabel(item))}</span>
          ${item.address && item.address !== item.title ? `<small>${esc(item.address)}</small>` : ''}
        </button>
      `).join('');
      wrap.classList.remove('hidden');
    }

    async function searchLocations() {
      const input = byId('locationPickerSearch');
      const q = String(input?.value || '').trim();
      if (q.length < 2) {
        renderSearchResults([]);
        setStatus('Type at least 2 characters');
        return [];
      }
      setStatus('Searching...', 'pending');
      try {
        const data = await api(`/api/maps/search?q=${encodeURIComponent(q)}`);
        renderSearchResults(data.results || []);
        setStatus(searchResults.length ? '' : 'No places found');
        return searchResults;
      } catch (error) {
        renderSearchResults([]);
        setStatus(error.message || 'Map search failed', 'error');
        return [];
      }
    }

    function useCurrentLocation() {
      if (!navigator.geolocation) {
        setStatus('Geolocation is unavailable', 'error');
        return;
      }
      setStatus('Locating...', 'pending');
      navigator.geolocation.getCurrentPosition((position) => {
        const coords = position.coords || {};
        selectLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          zoom: 16,
          provider: mapConfig.provider || 'osm',
        }, { reverse: true });
        setStatus('');
      }, (error) => {
        setStatus(error.message || 'Could not get current location', 'error');
      }, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      });
    }

    async function openLocationPicker() {
      if (state.editTo) {
        (actions.alert || alert)('Finish editing before sending a location.');
        return false;
      }
      if ((state.pendingFiles || []).length > 0) {
        (actions.alert || alert)('Remove pending attachments before sending a location.');
        return false;
      }
      const config = await loadMapConfig({ force: !configLoaded });
      if (!config.enabled) {
        (actions.alert || alert)('Maps are disabled.');
        return false;
      }
      selectedLocation = null;
      renderSearchResults([]);
      setSelectedLabel();
      updateSendState();
      setStatus('');
      byId('locationPickerSearch') && (byId('locationPickerSearch').value = '');
      actions.openModal?.('locationPickerModal', { replaceStack: false, opener: byId('attachMenuLocation') || byId('attachBtn') });
      win.requestAnimationFrame(() => {
        const map = ensurePickerMap();
        map?.invalidateSize?.();
      });
      return true;
    }

    async function sendSelectedLocation() {
      if (!selectedLocation) return null;
      const queue = outbox.queueLocationOutbox || actions.queueLocationOutbox;
      if (typeof queue !== 'function') {
        setStatus('Location sender is unavailable', 'error');
        return null;
      }
      const item = await queue({ location: selectedLocation });
      actions.closeModal?.('locationPickerModal');
      return item;
    }

    function bindEvents({ bindAsyncActionButtons, withActionButtons } = {}) {
      const withButtons = typeof withActionButtons === 'function'
        ? withActionButtons
        : (_targetIds, _label, task) => Promise.resolve().then(task);
      if (typeof bindAsyncActionButtons === 'function') {
        bindAsyncActionButtons('locationPickerSearchBtn', null, 'Searching...', searchLocations);
        bindAsyncActionButtons('locationPickerSendBtn', null, 'Sending...', sendSelectedLocation);
      } else {
        byId('locationPickerSearchBtn')?.addEventListener('click', () => {
          withButtons('locationPickerSearchBtn', 'Searching...', searchLocations).catch(() => {});
        });
        byId('locationPickerSendBtn')?.addEventListener('click', () => {
          withButtons('locationPickerSendBtn', 'Sending...', sendSelectedLocation).catch(() => {});
        });
      }
      byId('locationPickerSearch')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        withButtons('locationPickerSearchBtn', 'Searching...', searchLocations).catch(() => {});
      });
      byId('locationPickerResults')?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-index]');
        if (!btn) return;
        const location = searchResults[Number(btn.dataset.index) || 0];
        if (location) selectLocation(location, { reverse: false });
      });
      byId('locationPickerUseCurrentBtn')?.addEventListener('click', useCurrentLocation);
    }

    const publicApi = {
      bindEvents,
      getMapConfig: () => ({ ...mapConfig }),
      isMapsEnabled,
      loadMapConfig,
      openLocationPicker,
      searchLocations,
      selectLocation,
      sendSelectedLocation,
      syncAttachMenuLocation,
    };

    root.maps = root.maps || {};
    root.maps.getConfig = publicApi.getMapConfig;
    root.maps.loadConfig = loadMapConfig;

    return publicApi;
  }

  composerRoot.location = {
    createComposerLocationController,
  };
})();
