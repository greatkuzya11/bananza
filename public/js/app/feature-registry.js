(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const loader = root.featureLoader;
  if (!loader || typeof loader.registerFeature !== 'function') {
    throw new Error('BananzaApp feature loader is required before feature-registry.js');
  }

  const AI_ADMIN_SCRIPT_VERSION = '20260609-chat-settings-events';
  const aiAdminScript = (file) => `/js/app/ai-admin/${file}.js?v=${AI_ADMIN_SCRIPT_VERSION}`;

  loader.registerFeature('admin', [
    '/js/app/admin/bot-audit.js',
    '/js/app/admin/backup.js',
    '/js/app/admin/users.js',
  ], { preload: 'admin-idle' });

  loader.registerFeature('ai-admin', [
    aiAdminScript('shared'),
    aiAdminScript('openai'),
    aiAdminScript('openai-runtime'),
    aiAdminScript('yandex'),
    aiAdminScript('deepseek'),
    aiAdminScript('qwen'),
    aiAdminScript('local-providers-runtime'),
    aiAdminScript('grok'),
    aiAdminScript('grok-runtime'),
    aiAdminScript('context-convert'),
    aiAdminScript('chatshot'),
    aiAdminScript('context-chatshot-runtime'),
    aiAdminScript('grok-image-risk'),
    aiAdminScript('grok-image-risk-runtime'),
    aiAdminScript('modals'),
    aiAdminScript('events'),
    aiAdminScript('controller'),
  ], { preload: 'manual' });

  loader.registerFeature('ai-admin-runtime', [
    aiAdminScript('openai-runtime'),
    aiAdminScript('local-providers-runtime'),
    aiAdminScript('grok-runtime'),
    aiAdminScript('context-chatshot-runtime'),
    aiAdminScript('grok-image-risk-runtime'),
  ], { preload: 'manual' });

  loader.registerFeature('openai-runtime', [
    aiAdminScript('openai-runtime'),
  ], { preload: 'interaction' });

  loader.registerFeature('local-providers-runtime', [
    aiAdminScript('local-providers-runtime'),
  ], { preload: 'interaction' });

  loader.registerFeature('grok-runtime', [
    aiAdminScript('grok-runtime'),
  ], { preload: 'interaction' });

  loader.registerFeature('context-chatshot-runtime', [
    aiAdminScript('context-chatshot-runtime'),
  ], { preload: 'manual' });

  loader.registerFeature('grok-risk-runtime', [
    aiAdminScript('grok-image-risk-runtime'),
  ], { preload: 'manual' });

  loader.registerFeature('ai-admin-events', [
    aiAdminScript('events'),
  ], { preload: 'admin-idle' });

  loader.registerFeature('ai-admin-ui', [
    aiAdminScript('shared'),
    aiAdminScript('openai'),
    aiAdminScript('yandex'),
    aiAdminScript('deepseek'),
    aiAdminScript('qwen'),
    aiAdminScript('grok'),
    aiAdminScript('context-convert'),
    aiAdminScript('chatshot'),
    aiAdminScript('grok-image-risk'),
    aiAdminScript('modals'),
    aiAdminScript('events'),
    aiAdminScript('controller'),
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
