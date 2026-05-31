(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const modals = aiAdmin.modals = aiAdmin.modals || {};
  const modalMethodNames = [
    "openAiBotSettingsModal",
    "openOpenAiTextBotsModal",
    "openOpenAiUniversalBotsModal",
    "openOpenAiImageBotsModal",
    "openYandexAiSettingsModal",
    "openDeepseekAiSettingsModal",
    "openDeepseekTextBotsModal",
    "openQwenAiSettingsModal",
    "openQwenTextBotsModal",
    "openGrokAiSettingsModal",
    "openGrokTextBotsModal",
    "openGrokImageBotsModal",
    "openGrokUniversalBotsModal",
    "openContextConvertBotsModal",
    "openChatShotBotsModal"
  ];

  function callBridge(name, args) {
    const bridge = window.BananzaAppBridge;
    const method = bridge && bridge[name];
    if (typeof method === 'function') return method.apply(bridge, Array.from(args || []));
    return undefined;
  }

  modalMethodNames.forEach((name) => {
    if (typeof modals[name] !== 'function') {
      modals[name] = function modalBridgeDelegator() {
        return callBridge(name, arguments);
      };
    }
  });

  modals.ensureDeepseekTextBotsModalContent = modals.ensureDeepseekTextBotsModalContent || function ensureDeepseekTextBotsModalContent() {};
  modals.ensureQwenTextBotsModalContent = modals.ensureQwenTextBotsModalContent || function ensureQwenTextBotsModalContent() {};
  modals.createAiAdminModals = modals.createAiAdminModals || function createAiAdminModals() { return modals; };

})();
