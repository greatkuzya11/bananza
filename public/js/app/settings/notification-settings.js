(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const settingsRoot = root.settings = root.settings || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createNotificationSettings(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const api = typeof opts.api === 'function' ? opts.api : async () => ({});
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);

    let notificationSettings = {
      push_enabled: false,
      notify_messages: true,
      notify_chat_invites: true,
      notify_reactions: true,
      notify_pins: true,
      notify_mentions: true,
    };
    let notificationSettingsLoaded = false;
    let pushDeviceSubscribed = false;

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

    function setNotificationStatus(message, type = '') {
      setInlineStatus('settingsNotificationsStatus', message, type);
    }

    function isLocalhost() {
      return ['localhost', '127.0.0.1', '[::1]'].includes(win.location.hostname);
    }

    function isPushSupported() {
      return Boolean(
        'serviceWorker' in win.navigator &&
        'PushManager' in win &&
        'Notification' in win &&
        (win.location.protocol === 'https:' || isLocalhost())
      );
    }

    function notificationPermissionLabel() {
      if (!('Notification' in win)) return '\u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F';
      if (win.Notification.permission === 'granted') return '\u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u044B';
      if (win.Notification.permission === 'denied') return '\u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u044B \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435';
      return '\u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0438\u0441\u044C';
    }

    function renderNotificationSettingsForm() {
      const supportEl = byId('settingsNotificationsSupport');
      const enabledInput = byId('settingsNotificationsEnabled');
      const messagesInput = byId('settingsNotifyMessages');
      const invitesInput = byId('settingsNotifyChatInvites');
      const callsInput = byId('settingsNotifyCalls');
      const reactionsInput = byId('settingsNotifyReactions');
      const pinsInput = byId('settingsNotifyPins');
      const mentionsInput = byId('settingsNotifyMentions');
      const enableBtn = byId('settingsPushEnable');
      const disableBtn = byId('settingsPushDisable');
      const testBtn = byId('settingsPushTest');
      if (!supportEl || !enabledInput || !messagesInput || !invitesInput || !reactionsInput) return;

      const supported = isPushSupported();
      const permission = 'Notification' in win ? win.Notification.permission : '';
      supportEl.classList.toggle('is-ready', supported && permission === 'granted' && pushDeviceSubscribed);
      supportEl.classList.toggle('is-error', !supported || permission === 'denied');
      supportEl.textContent = supported
        ? `\u0421\u0442\u0430\u0442\u0443\u0441: ${notificationPermissionLabel()}. \u042D\u0442\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E ${pushDeviceSubscribed ? '\u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u043E' : '\u043D\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u043E'}.`
        : 'Web Push \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D: \u043D\u0443\u0436\u0435\u043D HTTPS \u0438 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0441 Service Worker/Push API.';

      enabledInput.checked = !!notificationSettings.push_enabled;
      messagesInput.checked = !!notificationSettings.notify_messages;
      invitesInput.checked = !!notificationSettings.notify_chat_invites;
      if (callsInput) callsInput.checked = notificationSettings.notify_calls !== false;
      reactionsInput.checked = !!notificationSettings.notify_reactions;
      if (pinsInput) pinsInput.checked = notificationSettings.notify_pins !== false;
      if (mentionsInput) mentionsInput.checked = notificationSettings.notify_mentions !== false;

      if (enableBtn) enableBtn.disabled = !supported || permission === 'denied';
      if (disableBtn) disableBtn.disabled = !supported || !pushDeviceSubscribed;
      if (testBtn) testBtn.disabled = !supported || !pushDeviceSubscribed;
    }

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = win.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
      return outputArray;
    }

    async function ensurePushRegistration() {
      if (!isPushSupported()) throw new Error('Web Push \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 \u0438\u043B\u0438 \u0431\u0435\u0437 HTTPS');
      return win.navigator.serviceWorker.register('/sw.js');
    }

    async function refreshPushDeviceState() {
      if (!isPushSupported()) {
        pushDeviceSubscribed = false;
        renderNotificationSettingsForm();
        return false;
      }
      try {
        const registration = await win.navigator.serviceWorker.getRegistration('/sw.js');
        const subscription = await registration?.pushManager.getSubscription();
        pushDeviceSubscribed = !!subscription;
      } catch {
        pushDeviceSubscribed = false;
      }
      renderNotificationSettingsForm();
      return pushDeviceSubscribed;
    }

    async function loadNotificationSettings() {
      try {
        const data = await api('/api/notification-settings');
        notificationSettings = data.settings || notificationSettings;
        notificationSettingsLoaded = true;
      } catch {
        notificationSettingsLoaded = false;
      }
      await refreshPushDeviceState();
      return notificationSettings;
    }

    async function saveNotificationSettings(patch = {}) {
      const next = {
        ...notificationSettings,
        ...patch,
        notify_messages: byId('settingsNotifyMessages')?.checked ?? notificationSettings.notify_messages,
        notify_chat_invites: byId('settingsNotifyChatInvites')?.checked ?? notificationSettings.notify_chat_invites,
        notify_calls: byId('settingsNotifyCalls')?.checked ?? notificationSettings.notify_calls,
        notify_reactions: byId('settingsNotifyReactions')?.checked ?? notificationSettings.notify_reactions,
        notify_pins: byId('settingsNotifyPins')?.checked ?? notificationSettings.notify_pins,
        notify_mentions: byId('settingsNotifyMentions')?.checked ?? notificationSettings.notify_mentions,
      };
      if (Object.prototype.hasOwnProperty.call(patch, 'push_enabled')) {
        next.push_enabled = !!patch.push_enabled;
      } else {
        next.push_enabled = byId('settingsNotificationsEnabled')?.checked ?? notificationSettings.push_enabled;
      }
      setNotificationStatus('\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u044E...');
      try {
        const data = await api('/api/notification-settings', { method: 'PUT', body: next });
        notificationSettings = data.settings || next;
        notificationSettingsLoaded = true;
        renderNotificationSettingsForm();
        setNotificationStatus('\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E', 'success');
      } catch (e) {
        setNotificationStatus(e.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F', 'error');
        renderNotificationSettingsForm();
      }
      return notificationSettings;
    }

    async function enablePushNotifications() {
      if (!isPushSupported()) {
        setNotificationStatus('Web Push \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D: \u043D\u0443\u0436\u0435\u043D HTTPS \u0438 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430', 'error');
        renderNotificationSettingsForm();
        return;
      }
      try {
        setNotificationStatus('\u0417\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u044E \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435...');
        const permission = await win.Notification.requestPermission();
        if (permission !== 'granted') {
          setNotificationStatus('\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u044B \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435', 'error');
          renderNotificationSettingsForm();
          return;
        }

        const registration = await ensurePushRegistration();
        const keyData = await api('/api/push/vapid-public-key');
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
          });
        }
        const data = await api('/api/push/subscribe', {
          method: 'POST',
          body: { subscription: subscription.toJSON() },
        });
        notificationSettings = data.settings || { ...notificationSettings, push_enabled: true };
        pushDeviceSubscribed = true;
        renderNotificationSettingsForm();
        setNotificationStatus('\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u044B \u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435', 'success');
      } catch (e) {
        setNotificationStatus(e.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F', 'error');
        await refreshPushDeviceState();
      }
    }

    async function disablePushOnThisDevice() {
      if (!isPushSupported()) return;
      try {
        setNotificationStatus('\u041E\u0442\u043A\u043B\u044E\u0447\u0430\u044E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E...');
        const registration = await win.navigator.serviceWorker.getRegistration('/sw.js');
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await api('/api/push/subscribe', {
            method: 'DELETE',
            body: { endpoint: subscription.endpoint },
          });
          await subscription.unsubscribe();
        }
        pushDeviceSubscribed = false;
        renderNotificationSettingsForm();
        setNotificationStatus('\u042D\u0442\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E', 'success');
      } catch (e) {
        setNotificationStatus(e.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E', 'error');
        await refreshPushDeviceState();
      }
    }

    async function testPushNotification() {
      try {
        setNotificationStatus('\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u044E \u0442\u0435\u0441\u0442...');
        const data = await api('/api/push/test', {
          method: 'POST',
          body: { chatId: state.getCurrentChatId?.() || null },
        });
        setNotificationStatus(data.sent > 0 ? '\u0422\u0435\u0441\u0442\u043E\u0432\u043E\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E' : '\u0422\u0435\u0441\u0442 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D', data.sent > 0 ? 'success' : 'error');
      } catch (e) {
        setNotificationStatus(e.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0442\u0435\u0441\u0442', 'error');
      }
    }

    function bindEvents({ bindAsyncActionButtons } = {}) {
      const bindAsync = typeof bindAsyncActionButtons === 'function'
        ? bindAsyncActionButtons
        : () => {};
      bindAsync('settingsPushEnable', null, 'Enabling...', enablePushNotifications);
      bindAsync('settingsPushDisable', null, 'Disabling...', disablePushOnThisDevice);
      bindAsync('settingsPushTest', null, 'Testing...', testPushNotification);
      byId('settingsNotificationsEnabled')?.addEventListener('change', async (e) => {
        await saveNotificationSettings({ push_enabled: e.target.checked });
        if (e.target.checked && !pushDeviceSubscribed) {
          if (!isPushSupported()) {
            setNotificationStatus('\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B, \u043D\u043E \u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435 Web Push \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.', 'success');
          } else if (win.Notification.permission === 'denied') {
            setNotificationStatus('\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B, \u043D\u043E \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0437\u0430\u043F\u0440\u0435\u0442\u0438\u043B \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F. \u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0438\u0445 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0441\u0430\u0439\u0442\u0430.', 'success');
          } else {
            setNotificationStatus('\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B. \u0427\u0442\u043E\u0431\u044B \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u044C push \u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435, \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435\u00BB.', 'success');
          }
        }
      });
      ['settingsNotifyMessages', 'settingsNotifyChatInvites', 'settingsNotifyCalls', 'settingsNotifyReactions', 'settingsNotifyPins', 'settingsNotifyMentions'].forEach((id) => {
        byId(id)?.addEventListener('change', () => saveNotificationSettings());
      });
    }

    return {
      setNotificationStatus,
      notificationPermissionLabel,
      renderNotificationSettingsForm,
      loadNotificationSettings,
      saveNotificationSettings,
      enablePushNotifications,
      testPushNotification,
      disablePushOnThisDevice,
      refreshPushDeviceState,
      isPushSupported,
      bindEvents,
      getSettings: () => ({ ...notificationSettings }),
      isLoaded: () => notificationSettingsLoaded,
      isPushDeviceSubscribed: () => pushDeviceSubscribed,
    };
  }

  settingsRoot.notifications = {
    createNotificationSettings,
  };
})();
