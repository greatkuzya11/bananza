(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const messagesRoot = root.messages = root.messages || {};

  const DEFAULT_MAP_CONFIG = {
    enabled: false,
    provider: 'osm',
    tile_url_template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tile_attribution: '\u00A9 OpenStreetMap contributors',
    max_zoom: 19,
  };

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function t(key, params) {
    return window.BananzaI18n?.t ? window.BananzaI18n.t(key, params) : String(key || '');
  }

  function createLocationMessageRenderer(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const doc = opts.document || document;
    const actions = objectOrDefault(opts.actions);
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value ?? ''));

    let viewerMap = null;
    let viewerMarker = null;

    function byId(id) {
      return doc.getElementById(id);
    }

    function normalizeConfig(value = {}) {
      return {
        ...DEFAULT_MAP_CONFIG,
        ...objectOrDefault(value),
        enabled: Boolean(value.enabled),
        max_zoom: Math.min(22, Math.max(1, Math.round(Number(value.max_zoom) || DEFAULT_MAP_CONFIG.max_zoom))),
      };
    }

    function getMapConfig() {
      const supplied = actions.getMapConfig?.() || root.maps?.getConfig?.() || root.maps?.config || DEFAULT_MAP_CONFIG;
      return normalizeConfig(supplied);
    }

    function normalizeLocation(value = {}) {
      const source = value.location && typeof value.location === 'object' ? value.location : value;
      const latitude = Number(source.latitude ?? source.lat);
      const longitude = Number(source.longitude ?? source.lon ?? source.lng);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
      const config = getMapConfig();
      return {
        latitude,
        longitude,
        zoom: Math.min(config.max_zoom || 19, Math.max(1, Math.round(Number(source.zoom) || 16))),
        title: String(source.title || source.name || '').trim().slice(0, 160) || null,
        address: String(source.address || source.display_name || '').trim().slice(0, 300) || null,
        provider: String(source.provider || config.provider || 'osm').trim() || 'osm',
      };
    }

    function locationLabel(location) {
      if (!location) return t('Location');
      return String(location.title || location.address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`).trim();
    }

    function osmLink(location) {
      if (!location) return 'https://www.openstreetmap.org/';
      const zoom = Math.min(19, Math.max(1, Number(location.zoom) || 16));
      return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(location.latitude)}&mlon=${encodeURIComponent(location.longitude)}#map=${zoom}/${encodeURIComponent(location.latitude)}/${encodeURIComponent(location.longitude)}`;
    }

    function renderLocationCard(msg) {
      const location = normalizeLocation(msg);
      if (!location) return '';
      const config = getMapConfig();
      const label = locationLabel(location);
      const details = location.address && location.address !== label
        ? location.address
        : `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
      return `
        <button type="button" class="location-card" data-location-card="1" data-lat="${esc(location.latitude)}" data-lon="${esc(location.longitude)}" data-zoom="${esc(location.zoom)}">
          ${config.enabled ? '<span class="location-card-map" aria-hidden="true"></span>' : '<span class="location-card-fallback-map" aria-hidden="true">&#128205;</span>'}
          <span class="location-card-body">
            <strong>${esc(label)}</strong>
            <small>${esc(details)}</small>
            <em>${esc(t('Open map'))}</em>
          </span>
        </button>
      `;
    }

    function createTileLayer(map, config = getMapConfig()) {
      if (!win.L || !map) return null;
      return win.L.tileLayer(config.tile_url_template || DEFAULT_MAP_CONFIG.tile_url_template, {
        maxZoom: config.max_zoom || DEFAULT_MAP_CONFIG.max_zoom,
        attribution: config.tile_attribution || DEFAULT_MAP_CONFIG.tile_attribution,
      }).addTo(map);
    }

    function hydrateCardMap(card, location) {
      const mapEl = card?.querySelector?.('.location-card-map');
      const config = getMapConfig();
      if (!mapEl || !win.L || !config.enabled || mapEl.__leafletMap) return;
      const map = win.L.map(mapEl, {
        attributionControl: true,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      }).setView([location.latitude, location.longitude], location.zoom || 16);
      createTileLayer(map, config);
      win.L.marker([location.latitude, location.longitude], { interactive: false }).addTo(map);
      mapEl.__leafletMap = map;
      win.requestAnimationFrame(() => map.invalidateSize());
    }

    function setViewerStatus(message, type = '') {
      const status = byId('locationViewerStatus');
      if (!status) return;
      status.textContent = message ? t(message) : '';
      status.classList.toggle('is-error', type === 'error');
      status.classList.toggle('is-success', type === 'success');
    }

    function ensureViewerMap(location) {
      const mapEl = byId('locationViewerMap');
      const config = getMapConfig();
      if (!mapEl || !win.L || !config.enabled) return null;
      if (!viewerMap) {
        viewerMap = win.L.map(mapEl).setView([location.latitude, location.longitude], location.zoom || 16);
        createTileLayer(viewerMap, config);
      } else {
        viewerMap.setView([location.latitude, location.longitude], location.zoom || 16);
      }
      if (!viewerMarker) viewerMarker = win.L.marker([location.latitude, location.longitude]).addTo(viewerMap);
      else viewerMarker.setLatLng([location.latitude, location.longitude]);
      win.requestAnimationFrame(() => viewerMap.invalidateSize());
      return viewerMap;
    }

    function openLocationViewer(locationSource) {
      const location = normalizeLocation(locationSource);
      if (!location) return false;
      const title = byId('locationViewerTitle');
      const details = byId('locationViewerDetails');
      const openLink = byId('locationViewerOpenLink');
      const copyBtn = byId('locationViewerCopyBtn');
      const link = osmLink(location);
      if (title) title.textContent = locationLabel(location);
      if (details) {
        details.textContent = [
          location.address && location.address !== location.title ? location.address : '',
          `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        ].filter(Boolean).join('\n');
      }
      if (openLink) openLink.href = link;
      if (copyBtn) {
        copyBtn.onclick = async (event) => {
          event.preventDefault();
          const text = `${locationLabel(location)}\n${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}\n${link}`;
          const copied = await Promise.resolve(actions.copyTextToClipboard?.(text)).catch(() => false);
          setViewerStatus(copied ? 'Copied' : 'Could not copy', copied ? 'success' : 'error');
        };
      }
      setViewerStatus('');
      actions.openModal?.('locationViewerModal', { replaceStack: false });
      win.requestAnimationFrame(() => ensureViewerMap(location));
      return true;
    }

    function bindLocationCards(row, msg) {
      const location = normalizeLocation(msg);
      if (!location || !row) return;
      const card = row.querySelector('[data-location-card]');
      if (!card) return;
      win.requestAnimationFrame(() => hydrateCardMap(card, location));
      card.addEventListener('contextmenu', () => {
        row.__suppressLocationClickUntil = Date.now() + 900;
      });
      card.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const suppressUntil = Math.max(
          Number(row.__suppressLocationClickUntil || 0),
          Number(row.__suppressMediaClickUntil || 0)
        );
        if (Date.now() < suppressUntil) return;
        openLocationViewer(location);
      });
    }

    function resetViewerMap() {
      if (viewerMap) {
        try { viewerMap.remove(); } catch {}
      }
      viewerMap = null;
      viewerMarker = null;
    }

    return {
      bindLocationCards,
      locationLabel,
      normalizeLocation,
      openLocationViewer,
      osmLink,
      renderLocationCard,
      resetViewerMap,
    };
  }

  messagesRoot.locations = {
    createLocationMessageRenderer,
  };
})();
