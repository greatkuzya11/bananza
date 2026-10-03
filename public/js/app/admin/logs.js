(function () {
  'use strict';
  const root = window.BananzaApp = window.BananzaApp || {};
  const admin = root.admin = root.admin || {};

  function createLogsController(options) {
    const doc = options.document || document;
    const win = options.window || window;
    const select = (id) => doc.getElementById(id);
    const tx = options.tx;
    const request = options.fetch || win.fetch.bind(win);
    const view = select('adminLogsEntries');
    let entries = [];
    let controller = null;
    let reconnectTimer = null;
    let renderTimer = null;
    let active = false;
    let paused = false;
    let generation = 0;
    let failures = 0;
    let downloadController = null;

    const connectionStatus = (key) => { select('adminLogsConnection').textContent = tx(key); };
    function render() {
      renderTimer = null;
      if (paused) return;
      const level = select('adminLogsLevel').value;
      const query = select('adminLogsSearch').value.toLocaleLowerCase();
      const fragment = doc.createDocumentFragment();
      for (const entry of entries) {
        if (level && entry.level !== level) continue;
        const text = `${entry.time} [${entry.level}] [${entry.source}] ${entry.message}${entry.fields ? ' ' + JSON.stringify(entry.fields) : ''}${entry.truncated ? ' ' + tx('Log entry truncated') : ''}`;
        if (query && !text.toLocaleLowerCase().includes(query)) continue;
        const row = doc.createElement('div');
        row.className = 'admin-log-entry';
        row.dataset.level = entry.level;
        row.textContent = text;
        fragment.appendChild(row);
      }
      view.replaceChildren(fragment);
      select('adminLogsCount').textContent = tx('Loaded log entries: {count}', { count: entries.length });
      if (select('adminLogsAutoScroll').checked) view.scrollTop = view.scrollHeight;
    }
    function scheduleRender() {
      if (!paused && !renderTimer) renderTimer = win.setTimeout(render, 100);
    }
    function stopConnection() {
      controller?.abort();
      controller = null;
      win.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    function close() {
      active = false;
      generation++;
      stopConnection();
      downloadController?.abort();
      win.clearTimeout(renderTimer);
      renderTimer = null;
      entries = [];
      view.replaceChildren();
    }
    function deny() {
      close();
      connectionStatus('Log access denied');
    }
    function handleEvent(event, data) {
      if (event === 'reset') { entries = []; scheduleRender(); }
      if (event === 'entry') {
        entries.push(data);
        if (entries.length > 2000) entries.splice(0, entries.length - 2000);
        scheduleRender();
      }
      if (event === 'status') {
        select('adminLogsWriting').textContent = tx(data.writing ? 'Log file is being written' : 'Log file unavailable; retrying');
        select('adminLogsDropped').textContent = data.dropped ? tx('Dropped log entries: {count}', { count: data.dropped }) : '';
      }
      if (event === 'denied') deny();
    }
    async function connect(run) {
      if (!active || run !== generation) return;
      const token = options.getToken();
      if (!token || !options.getCurrentUser()?.is_admin) { deny(); return; }
      const current = new win.AbortController();
      controller = current;
      let reader;
      try {
        const response = await request('/api/admin/logs/stream', {
          headers: { Authorization: 'Bearer ' + token }, signal: current.signal, cache: 'no-store',
        });
        if (!active || run !== generation) return;
        if (response.status === 401 || response.status === 403) { deny(); return; }
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        connectionStatus('Logs connected');
        reader = response.body.getReader();
        const decoder = new win.TextDecoder();
        let buffer = '';
        while (active && run === generation) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const event = /^event: (.+)$/m.exec(frame)?.[1];
            const payload = /^data: (.+)$/m.exec(frame)?.[1];
            if (event && payload) { handleEvent(event, JSON.parse(payload)); failures = 0; }
            if (!active || run !== generation) break;
          }
          if (buffer.length > 1024 * 1024) throw new Error('Invalid stream frame');
        }
      } catch (error) {
        if (current.signal.aborted || !active || run !== generation) return;
      } finally {
        try { await reader?.cancel(); } catch {}
        current.abort();
      }
      if (active && run === generation) {
        connectionStatus('Logs reconnecting; recent entries will reload');
        failures++;
        reconnectTimer = win.setTimeout(() => connect(run), Math.min(10000, 1000 * 2 ** Math.min(failures - 1, 4)));
      }
    }
    function open() {
      close();
      if (!options.getCurrentUser()?.is_admin) { deny(); return; }
      active = true;
      paused = false;
      failures = 0;
      select('adminLogsPause').textContent = tx('Pause log display');
      select('adminLogsPause').setAttribute('data-i18n', 'Pause log display');
      select('adminLogsPause').setAttribute('aria-pressed', 'false');
      select('adminLogsWriting').textContent = '';
      select('adminLogsDropped').textContent = '';
      select('adminLogsActionStatus').textContent = '';
      connectionStatus('Logs connecting');
      options.openModal('adminLogsModal', { replaceStack: false });
      render();
      void connect(generation);
    }
    async function download() {
      if (downloadController) return;
      downloadController = new win.AbortController();
      const run = generation;
      const button = select('adminLogsDownload');
      button.disabled = true;
      select('adminLogsActionStatus').textContent = '';
      try {
        const response = await request('/api/admin/logs/download', {
          headers: { Authorization: 'Bearer ' + options.getToken() }, signal: downloadController.signal,
        });
        if (response.status === 401 || response.status === 403) { deny(); return; }
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        if (!active || run !== generation) return;
        const url = win.URL.createObjectURL(blob);
        const link = doc.createElement('a');
        link.href = url;
        link.download = 'bananza.log';
        doc.body.appendChild(link);
        link.click();
        link.remove();
        win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
      } catch {
        if (active && run === generation) select('adminLogsActionStatus').textContent = tx('Could not download log file');
      } finally { downloadController = null; button.disabled = false; }
    }
    select('adminLogsOpenBtn').addEventListener('click', open);
    select('adminLogsPause').addEventListener('click', () => {
      paused = !paused;
      select('adminLogsPause').textContent = tx(paused ? 'Resume log display' : 'Pause log display');
      select('adminLogsPause').setAttribute('data-i18n', paused ? 'Resume log display' : 'Pause log display');
      select('adminLogsPause').setAttribute('aria-pressed', String(paused));
      if (!paused) render();
    });
    select('adminLogsLevel').addEventListener('change', render);
    select('adminLogsSearch').addEventListener('input', scheduleRender);
    select('adminLogsAutoScroll').addEventListener('change', () => { if (!paused) render(); });
    select('adminLogsDownload').addEventListener('click', download);
    win.addEventListener('pagehide', close);
    win.addEventListener('storage', (event) => { if (event.key === 'token' && event.newValue !== options.getToken()) close(); });
    return { open, close };
  }
  admin.logs = { createLogsController };
})();
