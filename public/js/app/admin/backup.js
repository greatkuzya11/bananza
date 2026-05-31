(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const admin = root.admin = root.admin || {};
  const backup = admin.backup = admin.backup || {};

  function createBackupController(options = {}) {
    const windowRef = options.window || window;
    const documentRef = options.document || document;
    const select = typeof options.$ === 'function'
      ? options.$
      : (selector) => documentRef.querySelector(selector);
    const api = options.api;
    const fetchImpl = options.fetch || windowRef.fetch?.bind(windowRef);
    const openModal = typeof options.openModal === 'function' ? options.openModal : () => {};
    const getTopModal = typeof options.getTopModal === 'function' ? options.getTopModal : () => null;
    const setInlineStatus = typeof options.setInlineStatus === 'function' ? options.setInlineStatus : () => {};
    const tx = typeof options.tx === 'function' ? options.tx : (text) => String(text == null ? '' : text);
    const esc = typeof options.esc === 'function' ? options.esc : (value) => String(value == null ? '' : value);
    const formatSize = typeof options.formatSize === 'function' ? options.formatSize : (value) => String(value || 0);
    const filenameFromContentDisposition = typeof options.filenameFromContentDisposition === 'function'
      ? options.filenameFromContentDisposition
      : (_header, fallback) => fallback;
    const getCurrentUser = typeof options.getCurrentUser === 'function' ? options.getCurrentUser : () => null;
    const getToken = typeof options.getToken === 'function' ? options.getToken : () => '';
    const onRestoreApplied = typeof options.onRestoreApplied === 'function' ? options.onRestoreApplied : () => {};

    let backupRestoreId = '';

    function setBackupExportStatus(message, type = '') {
      setInlineStatus('backupExportStatus', message, type);
    }

    function setBackupRestoreStatus(message, type = '') {
      setInlineStatus('backupRestoreStatus', message, type);
    }

    function syncBackupRestoreFileName() {
      const input = select('#backupRestoreFile');
      const nameEl = select('#backupRestoreFileName');
      if (!nameEl) return;
      const file = input?.files?.[0] || null;
      nameEl.textContent = file?.name || tx('No backup archive selected');
      nameEl.title = file?.name || '';
      nameEl.classList.toggle('is-selected', Boolean(file));
    }

    function resetBackupRestoreState({ clearFile = false } = {}) {
      backupRestoreId = '';
      const previewEl = select('#backupRestorePreview');
      if (previewEl) {
        previewEl.classList.add('hidden');
        previewEl.innerHTML = '';
      }
      if (clearFile && select('#backupRestoreFile')) select('#backupRestoreFile').value = '';
      if (select('#backupRestoreConfirm')) select('#backupRestoreConfirm').value = '';
      if (select('#backupRestorePassword')) select('#backupRestorePassword').value = '';
      if (select('#backupRestorePasswordConfirm')) select('#backupRestorePasswordConfirm').value = '';
      const currentUser = getCurrentUser();
      if (select('#backupRestoreUsername') && currentUser?.username) {
        select('#backupRestoreUsername').value = currentUser.username;
      }
      syncBackupRestoreFileName();
      setBackupRestoreStatus('');
    }

    function renderBackupRestorePreview(data = {}) {
      const previewEl = select('#backupRestorePreview');
      if (!previewEl) return;
      const manifest = data.manifest || {};
      const database = data.database || {};
      const uploads = data.uploads || {};
      const includes = data.includes || {};
      const createdAt = manifest.created_at ? new Date(manifest.created_at).toLocaleString() : '-';
      const appName = manifest.app?.name || 'bananza';
      const appVersion = manifest.app?.version || '-';
      const secrets = [
        includes.secret ? '.secret' : null,
        includes.vapid ? '.vapid.json' : null,
      ].filter(Boolean).join(', ') || tx('missing');
      const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
      previewEl.innerHTML = `
        <div><strong>${esc(tx('Archive looks valid'))}</strong></div>
        <div>${esc(tx('Created'))}: ${esc(createdAt)}</div>
        <div>${esc(tx('App'))}: ${esc(appName)} ${esc(appVersion)}</div>
        <div>${esc(tx('Database'))}: ${esc(tx('Users'))} ${Number(database.users || 0)}, ${esc(tx('Admins'))} ${Number(database.admins || 0)}, ${esc(tx('Chats'))} ${Number(database.chats || 0)}, ${esc(tx('Messages'))} ${Number(database.messages || 0)}, ${esc(tx('Files'))} ${Number(database.files || 0)}</div>
        <div>${esc(tx('Uploads'))}: ${Number(uploads.files || 0)} ${esc(tx('Files'))}, ${esc(formatSize(Number(uploads.bytes || 0)))}</div>
        <div>${esc(tx('Secrets'))}: ${esc(secrets)}</div>
        ${warnings.length ? `<div>${esc(warnings.map(tx).join(' '))}</div>` : ''}
        <div>${esc(tx('Backup archive is ready. Enter recovery admin credentials and RESTORE to continue.'))}</div>
      `;
      previewEl.classList.remove('hidden');
    }

    function openBackupExportModal() {
      openModal('backupExportModal', { replaceStack: getTopModal()?.id !== 'settingsModal' });
      setBackupExportStatus('');
      if (select('#backupExportStreamMode')) select('#backupExportStreamMode').checked = false;
      resetBackupRestoreState({ clearFile: true });
    }

    async function downloadBackupExport() {
      setBackupExportStatus('Preparing backup...', 'pending');
      try {
        const headers = {};
        const token = getToken();
        if (token) headers.Authorization = 'Bearer ' + token;
        const streamMode = Boolean(select('#backupExportStreamMode')?.checked);
        const exportUrl = streamMode ? '/api/admin/backup/export?mode=stream' : '/api/admin/backup/export';
        const res = await fetchImpl(exportUrl, { headers });
        if (!res.ok) {
          let data = {};
          try { data = await res.json(); } catch {}
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const fallbackName = `bananza-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;
        const filename = filenameFromContentDisposition(res.headers.get('content-disposition'), fallbackName);
        const url = windowRef.URL.createObjectURL(blob);
        const link = documentRef.createElement('a');
        link.href = url;
        link.download = filename;
        documentRef.body.appendChild(link);
        link.click();
        link.remove();
        windowRef.URL.revokeObjectURL(url);
        setBackupExportStatus('Backup download started', 'success');
      } catch (error) {
        setBackupExportStatus(error.message || 'Could not download backup', 'error');
      }
    }

    async function previewBackupRestore() {
      const file = select('#backupRestoreFile')?.files?.[0];
      if (!file) {
        setBackupRestoreStatus('Choose a backup archive first', 'error');
        return;
      }
      resetBackupRestoreState({ clearFile: false });
      setBackupRestoreStatus('Validating backup...', 'pending');
      try {
        const formData = new windowRef.FormData();
        formData.append('backup', file, file.name || 'bananza-backup.tar.gz');
        const data = await api('/api/admin/backup/restore/preview', {
          method: 'POST',
          body: formData,
        });
        backupRestoreId = data.restore_id || '';
        renderBackupRestorePreview(data);
        setBackupRestoreStatus('Backup archive is ready. Enter recovery admin credentials and RESTORE to continue.', 'success');
      } catch (error) {
        setBackupRestoreStatus(error.message || 'Could not validate backup archive', 'error');
      }
    }

    async function applyBackupRestore() {
      if (!backupRestoreId) {
        setBackupRestoreStatus('Validate archive before applying restore', 'error');
        return;
      }
      const username = (select('#backupRestoreUsername')?.value || '').trim();
      const password = select('#backupRestorePassword')?.value || '';
      const confirmPassword = select('#backupRestorePasswordConfirm')?.value || '';
      const confirm = (select('#backupRestoreConfirm')?.value || '').trim();
      if (password !== confirmPassword) {
        setBackupRestoreStatus('Passwords do not match', 'error');
        return;
      }
      setBackupRestoreStatus('Applying restore...', 'pending');
      try {
        await api('/api/admin/backup/restore/apply', {
          method: 'POST',
          body: {
            restore_id: backupRestoreId,
            confirm,
            recovery_admin: {
              username,
              password,
            },
          },
        });
        setBackupRestoreStatus('Restore staged. You will be signed out while the server restarts.', 'success');
        onRestoreApplied();
      } catch (error) {
        setBackupRestoreStatus(error.message || 'Could not apply backup restore', 'error');
      }
    }

    return {
      setBackupExportStatus,
      setBackupRestoreStatus,
      syncBackupRestoreFileName,
      resetBackupRestoreState,
      renderBackupRestorePreview,
      openBackupExportModal,
      downloadBackupExport,
      previewBackupRestore,
      applyBackupRestore,
    };
  }

  backup.createBackupController = createBackupController;
})();
