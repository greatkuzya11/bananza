/* Shared appearance catalog. Safe to require on the server; no runtime dependencies. */
(function (root, factory) {
  const appearance = factory();
  if (typeof module === 'object' && module.exports) module.exports = appearance;
  if (root && root.document) {
    root.BananzaAppearance = appearance;
    let saved;
    try { saved = appearance.read(root.localStorage); } catch (_) { saved = appearance.normalize(null); }
    appearance.apply(root.document, saved, false);
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const themes = [
    { id: 'bananza', name: 'BananZa', note: 'Classic blue', colors: ['#17212b', '#5eb5f7'], own: '#2b5278', other: '#182533' },
    { id: 'banan-hero', name: 'Banan Hero', note: 'Grass + signal', colors: ['#15171a', '#ffd33f'], own: '#496436', other: '#202228' },
    { id: 'midnight-ocean', name: 'Midnight Ocean', note: 'Navy + teal', colors: ['#071823', '#2dd4bf'], own: '#14506a', other: '#102434' },
    { id: 'nord-aurora', name: 'Nord Aurora', note: 'Graphite + aurora', colors: ['#2e3440', '#88c0d0'], own: '#3b5f75', other: '#293340' },
    { id: 'rose-pine', name: 'Rose Pine', note: 'Plum + rose', colors: ['#191724', '#eb6f92'], own: '#3a2a4a', other: '#221f33' },
    { id: 'dracula-neon', name: 'Dracula Neon', note: 'Violet + pink', colors: ['#282a36', '#ff79c6'], own: '#4b3a69', other: '#242636' },
    { id: 'tokyo-night', name: 'Tokyo Night', note: 'Ink + electric blue', colors: ['#1a1b26', '#7aa2f7'], own: '#2b4d7d', other: '#202437' },
    { id: 'pearl', name: 'Pearl', note: 'Pearl + blue', light: true, colors: ['#eef3f8', '#3563d9'], own: '#dce7ff', other: '#ffffff' },
    { id: 'mint', name: 'Mint', note: 'Mint + jade', light: true, colors: ['#edf7f2', '#167568'], own: '#d3eee5', other: '#ffffff' },
    { id: 'lavender', name: 'Lavender', note: 'Lavender + iris', light: true, colors: ['#f3effa', '#7453bc'], own: '#e8ddf8', other: '#ffffff' },
    { id: 'banan-cream', name: 'Banan Cream', note: 'Cream + banana', light: true, colors: ['#faf5e8', '#8a6412'], own: '#f5e5b1', other: '#fffdf7' },
  ];
  const modes = [
    { id: 'classic', name: 'Classic', note: 'Classic flat theme surfaces.' },
    { id: 'rich', name: 'Rich Banan UX', note: 'Layered gradients, glass cards and theme-colored glow.' },
    { id: 'glass', name: 'Glass', note: 'Frosted surfaces, soft highlights and rounded controls.' },
  ];
  themes.forEach(theme => { Object.freeze(theme.colors); Object.freeze(theme); });
  modes.forEach(Object.freeze);
  Object.freeze(themes); Object.freeze(modes);
  const themeIds = Object.freeze(themes.map(theme => theme.id));
  const modeIds = Object.freeze(modes.map(mode => mode.id));
  const storageKey = 'bananzaAppearance';
  function normalize(value) {
    return {
      theme: themeIds.includes(value?.theme) ? value.theme : 'bananza',
      mode: modeIds.includes(value?.mode) ? value.mode : 'classic',
    };
  }
  function read(storage) {
    try {
      const user = JSON.parse(storage?.getItem('user') || 'null');
      if (user) return normalize({ theme: user.ui_theme, mode: user.ui_visual_mode });
      return normalize(JSON.parse(storage?.getItem(storageKey) || 'null'));
    } catch (_) { return normalize(null); }
  }
  function apply(doc, value, persist = true) {
    const next = normalize(value);
    const el = doc.documentElement;
    el.dataset.uiTheme = next.theme;
    el.dataset.visualMode = next.mode;
    el.dataset.colorScheme = themes.find(theme => theme.id === next.theme)?.light ? 'light' : 'dark';
    if (persist) {
      try { doc.defaultView?.localStorage?.setItem(storageKey, JSON.stringify(next)); } catch (_) {}
    }
    return next;
  }
  return Object.freeze({ themes, modes, themeIds, modeIds, storageKey, normalize, read, apply });
});
