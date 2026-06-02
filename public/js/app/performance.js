(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  const KNOWN_MEASURES = Object.freeze([
    ['bananza:startup-total', 'bananza:script-start', 'bananza:app-interactive'],
    ['bananza:runtime-create', 'bananza:runtime-create-start', 'bananza:runtime-create-end'],
    ['bananza:init-total', 'bananza:init-start', 'bananza:app-interactive'],
    ['bananza:auth-restore', 'bananza:auth-restore-start', 'bananza:auth-restore-end'],
    ['bananza:chats-load', 'bananza:chats-load-start', 'bananza:chats-load-end'],
    ['bananza:first-chat-list', 'bananza:script-start', 'bananza:chats-first-render'],
    ['bananza:time-to-interactive', 'bananza:script-start', 'bananza:app-interactive'],
    ['bananza:open-chat-total', 'bananza:open-chat-start', 'bananza:open-chat-end'],
    ['bananza:open-chat-data', 'bananza:open-chat-start', 'bananza:open-chat-data-ready'],
    ['bananza:open-chat-render', 'bananza:open-chat-data-ready', 'bananza:open-chat-first-render'],
  ]);

  const fallbackMarks = [];
  const fallbackMeasures = [];

  function nativePerformance() {
    return window.performance && typeof window.performance === 'object'
      ? window.performance
      : null;
  }

  function now() {
    const perf = nativePerformance();
    return typeof perf?.now === 'function' ? perf.now() : Date.now();
  }

  function cloneEntry(entry) {
    return {
      name: String(entry?.name || ''),
      entryType: String(entry?.entryType || ''),
      startTime: Number(entry?.startTime || 0),
      duration: Number(entry?.duration || 0),
    };
  }

  function isBananzaEntry(entry) {
    return String(entry?.name || '').startsWith('bananza:');
  }

  function nativeEntriesByType(type) {
    const perf = nativePerformance();
    if (typeof perf?.getEntriesByType !== 'function') return [];
    try {
      return perf.getEntriesByType(type).filter(isBananzaEntry).map(cloneEntry);
    } catch {
      return [];
    }
  }

  function fallbackEntriesByType(type) {
    return (type === 'mark' ? fallbackMarks : fallbackMeasures).map(cloneEntry);
  }

  function entriesByType(type) {
    const nativeEntries = nativeEntriesByType(type);
    return nativeEntries.length ? nativeEntries : fallbackEntriesByType(type);
  }

  function latestEntry(name, type = '') {
    const entries = type ? entriesByType(type) : getEntries();
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].name === name) return entries[index];
    }
    return null;
  }

  function mark(name) {
    const markName = String(name || '').trim();
    if (!markName) return null;
    const perf = nativePerformance();
    if (typeof perf?.mark === 'function') {
      try {
        perf.mark(markName);
        return latestEntry(markName, 'mark');
      } catch {}
    }
    const entry = { name: markName, entryType: 'mark', startTime: now(), duration: 0 };
    fallbackMarks.push(entry);
    return cloneEntry(entry);
  }

  function markOnce(name) {
    const markName = String(name || '').trim();
    if (!markName) return null;
    return latestEntry(markName, 'mark') || mark(markName);
  }

  function fallbackMeasure(name, start, end) {
    const startEntry = latestEntry(start, 'mark');
    const endEntry = latestEntry(end, 'mark');
    if (!startEntry || !endEntry) return null;
    const duration = Math.max(0, endEntry.startTime - startEntry.startTime);
    const entry = { name, entryType: 'measure', startTime: startEntry.startTime, duration };
    fallbackMeasures.push(entry);
    return cloneEntry(entry);
  }

  function measure(name, start, end) {
    const measureName = String(name || '').trim();
    const startName = String(start || '').trim();
    const endName = String(end || '').trim();
    if (!measureName || !startName || !endName) return null;
    const perf = nativePerformance();
    if (typeof perf?.measure === 'function') {
      try {
        perf.measure(measureName, startName, endName);
        return latestEntry(measureName, 'measure');
      } catch {}
    }
    return fallbackMeasure(measureName, startName, endName);
  }

  function measureKnown() {
    KNOWN_MEASURES.forEach(([name, start, end]) => {
      const startEntry = latestEntry(start, 'mark');
      const endEntry = latestEntry(end, 'mark');
      const measureEntry = latestEntry(name, 'measure');
      if (!startEntry || !endEntry) return;
      if (measureEntry && measureEntry.startTime >= startEntry.startTime) return;
      measure(name, start, end);
    });
  }

  function getEntries() {
    const perf = nativePerformance();
    if (typeof perf?.getEntries === 'function') {
      try {
        const entries = perf.getEntries().filter(isBananzaEntry).map(cloneEntry);
        if (entries.length) return entries;
      } catch {}
    }
    return [...fallbackMarks, ...fallbackMeasures].map(cloneEntry);
  }

  function getMeasures() {
    measureKnown();
    return entriesByType('measure');
  }

  function getSummary() {
    measureKnown();
    const marks = {};
    const measures = {};
    entriesByType('mark').forEach((entry) => {
      marks[entry.name] = entry.startTime;
    });
    entriesByType('measure').forEach((entry) => {
      measures[entry.name] = entry.duration;
    });
    return {
      marks,
      measures,
      entries: getEntries(),
    };
  }

  function resetForTests() {
    const perf = nativePerformance();
    if (typeof perf?.clearMarks === 'function') {
      try { perf.clearMarks(); } catch {}
    }
    if (typeof perf?.clearMeasures === 'function') {
      try { perf.clearMeasures(); } catch {}
    }
    fallbackMarks.length = 0;
    fallbackMeasures.length = 0;
  }

  root.performance = {
    mark,
    markOnce,
    measure,
    getEntries,
    getMeasures,
    getSummary,
    resetForTests,
  };
  root.perf = root.performance;
  root.performance.mark('bananza:script-start');
})();
