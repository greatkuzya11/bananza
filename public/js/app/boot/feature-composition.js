(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  const FEATURE_COMPOSITION_STEPS = [
    ['composition.composeFeaturePrimitives', 'composeFeaturePrimitives'],
    ['composition.composeDomShell', 'composeDomShell'],
    ['composition.composeRuntimeProxyScope', 'composeRuntimeProxyScope'],
    ['composition.composeAiAdmin', 'composeAiAdmin'],
    ['composition.composeUiShellAdapters', 'composeUiShellAdapters'],
    ['composition.composeAdminSettings', 'composeAdminSettings'],
    ['composition.composeFolders', 'composeFolders'],
    ['composition.composeChatList', 'composeChatList'],
    ['composition.composeOpenChat', 'composeOpenChat'],
    ['composition.composeMessages', 'composeMessages'],
    ['composition.composeComposer', 'composeComposer'],
    ['composition.composeShellRuntime', 'composeShellRuntime'],
    ['composition.composeInteractions', 'composeInteractions'],
  ];

  function composeFeatureRuntime(scope = {}) {
    scope.__bananzaRuntimeScope = scope;
    const runtimeExports = {};

    FEATURE_COMPOSITION_STEPS.forEach(([label, methodName]) => {
      const step = compositionRoot.requireCompositionStep(label, compositionRoot[methodName]);
      const stepExports = step(scope) || {};
      compositionRoot.installRuntimeExports(scope, stepExports);
      compositionRoot.mergeRuntimeExports(runtimeExports, stepExports);
    });

    return runtimeExports;
  }

  bootRoot.composeFeatureRuntime = composeFeatureRuntime;
})();
