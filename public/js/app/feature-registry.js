(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const loader = root.featureLoader;
  if (!loader || typeof loader.registerFeature !== 'function') {
    throw new Error('BananzaApp feature loader is required before feature-registry.js');
  }

  loader.registerFeature('admin', [
    '/js/app/admin/bot-audit.js',
    '/js/app/admin/backup.js',
    '/js/app/admin/users.js',
  ], { preload: 'admin-idle' });

  loader.registerFeature('ai-admin', [
    '/js/app/ai-admin/shared.js',
    '/js/app/ai-admin/openai.js',
    '/js/app/ai-admin/openai-runtime.js',
    '/js/app/ai-admin/yandex.js',
    '/js/app/ai-admin/deepseek.js',
    '/js/app/ai-admin/qwen.js',
    '/js/app/ai-admin/local-providers-runtime.js',
    '/js/app/ai-admin/grok.js',
    '/js/app/ai-admin/grok-runtime.js',
    '/js/app/ai-admin/context-convert.js',
    '/js/app/ai-admin/chatshot.js',
    '/js/app/ai-admin/context-chatshot-runtime.js',
    '/js/app/ai-admin/grok-image-risk.js',
    '/js/app/ai-admin/grok-image-risk-runtime.js',
    '/js/app/ai-admin/modals.js',
    '/js/app/ai-admin/events.js',
    '/js/app/ai-admin/controller.js',
  ], { preload: 'manual' });

  loader.registerFeature('ai-admin-runtime', [
    '/js/app/ai-admin/openai-runtime.js',
    '/js/app/ai-admin/local-providers-runtime.js',
    '/js/app/ai-admin/grok-runtime.js',
    '/js/app/ai-admin/context-chatshot-runtime.js',
    '/js/app/ai-admin/grok-image-risk-runtime.js',
  ], { preload: 'manual' });

  loader.registerFeature('openai-runtime', [
    '/js/app/ai-admin/openai-runtime.js',
  ], { preload: 'interaction' });

  loader.registerFeature('local-providers-runtime', [
    '/js/app/ai-admin/local-providers-runtime.js',
  ], { preload: 'interaction' });

  loader.registerFeature('grok-runtime', [
    '/js/app/ai-admin/grok-runtime.js',
  ], { preload: 'interaction' });

  loader.registerFeature('context-chatshot-runtime', [
    '/js/app/ai-admin/context-chatshot-runtime.js',
  ], { preload: 'manual' });

  loader.registerFeature('grok-risk-runtime', [
    '/js/app/ai-admin/grok-image-risk-runtime.js',
  ], { preload: 'manual' });

  loader.registerFeature('ai-admin-events', [
    '/js/app/ai-admin/events.js',
  ], { preload: 'admin-idle' });

  loader.registerFeature('ai-admin-ui', [
    '/js/app/ai-admin/shared.js',
    '/js/app/ai-admin/openai.js',
    '/js/app/ai-admin/yandex.js',
    '/js/app/ai-admin/deepseek.js',
    '/js/app/ai-admin/qwen.js',
    '/js/app/ai-admin/grok.js',
    '/js/app/ai-admin/context-convert.js',
    '/js/app/ai-admin/chatshot.js',
    '/js/app/ai-admin/grok-image-risk.js',
    '/js/app/ai-admin/modals.js',
    '/js/app/ai-admin/events.js',
    '/js/app/ai-admin/controller.js',
  ], { preload: 'admin-idle' });

  loader.registerFeature('settings', [
    '/js/app/settings/ui-settings.js',
    '/js/app/settings/weather-settings.js',
    '/js/app/settings/notification-settings.js',
    '/js/app/settings/sound-settings.js',
    '/js/app/settings/settings-modal.js',
  ], { preload: 'idle' });

  loader.registerFeature('media-viewer', [
    '/js/app/interactions/media-viewer.js',
  ], { preload: 'interaction' });

  loader.registerFeature('profile-avatar-camera', [
    '/js/app/shell/profile-avatar-camera.js',
  ], { preload: 'interaction' });

  loader.registerFeature('search', [
    '/js/app/interactions/search.js',
  ], { preload: 'interaction' });

  loader.registerFeature('interactions', [
    '/js/app/interactions/search.js',
    '/js/app/interactions/reactions.js',
    '/js/app/interactions/floating-actions.js',
    '/js/app/interactions/media-viewer.js',
    '/js/app/interactions/context-menus.js',
    '/js/app/interactions/forwarding.js',
  ], { preload: 'manual' });
})();
