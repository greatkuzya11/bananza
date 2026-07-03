(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeFeaturePrimitives = function composeFeaturePrimitives(scope = {}) {
    with (scope) {
      const publishRuntimeApi = (api) => {
        const targetScope = __bananzaRuntimeScope;
        Object.keys(api || {}).forEach((name) => {
          if (!Object.prototype.hasOwnProperty.call(targetScope, name)) {
            targetScope[name] = api[name];
          }
        });
        return api;
      };

      const composerFactories = window.BananzaApp?.composer || {};
      const composerStateFactory = composerFactories.state?.createComposerState;
      const composerTextFactory = composerFactories.text?.createComposerTextController;
      const composerReplyEditFactory = composerFactories.replyEdit?.createReplyEditController;
      const composerFilesFactory = composerFactories.files?.createComposerFilesController;
      const composerLocationFactory = composerFactories.location?.createComposerLocationController;
      const composerSendFactory = composerFactories.send?.createComposerSendController;
      const composerEmojiPickerFactory = composerFactories.emojiPicker?.createEmojiPickerController;
      const composerMentionsFactory = composerFactories.mentions?.createMentionPickerController;
      const composerTypingDragDropFactory = composerFactories.typingDragDrop?.createTypingDragDropController;
      const pollComposerFactory = composerFactories.pollComposer?.createPollComposerController;
      const interactionFactories = window.BananzaApp?.interactions || {};
      const searchControllerFactory = interactionFactories.search?.createSearchController;
      const reactionControllerFactory = interactionFactories.reactions?.createReactionController;
      const floatingMessageActionsFactory = interactionFactories.floatingActions?.createFloatingMessageActions;
      const mediaViewerFactory = interactionFactories.mediaViewer?.createMediaViewer;
      const contextMenusFactory = interactionFactories.contextMenus?.createContextMenus;
      const forwardingControllerFactory = interactionFactories.forwarding?.createForwardingController;
      if (typeof composerStateFactory !== 'function'
        || typeof composerTextFactory !== 'function'
        || typeof composerReplyEditFactory !== 'function'
        || typeof composerFilesFactory !== 'function'
        || typeof composerLocationFactory !== 'function'
        || typeof composerSendFactory !== 'function'
        || typeof composerEmojiPickerFactory !== 'function'
        || typeof composerMentionsFactory !== 'function'
        || typeof composerTypingDragDropFactory !== 'function'
        || typeof pollComposerFactory !== 'function') {
        throw new Error('BananzaApp composer modules are required before app.js');
      }
      if (typeof searchControllerFactory !== 'function'
        || typeof reactionControllerFactory !== 'function'
        || typeof floatingMessageActionsFactory !== 'function'
        || typeof mediaViewerFactory !== 'function'
        || typeof contextMenusFactory !== 'function'
        || typeof forwardingControllerFactory !== 'function') {
        throw new Error('BananzaApp interaction modules are required before app.js');
      }
      const composerStateController = composerStateFactory({
        storage: localStorage,
        maxDraftLength: MAX_MSG,
        getCurrentUser: () => currentUser,
      });
      let composerTextController = null;
      let composerReplyEditController = null;
      let composerFilesController = null;
      let composerLocationController = null;
      let composerSendController = null;
      let composerEmojiPickerController = null;
      let composerMentionsController = null;
      let composerTypingDragDropController = null;
      let pollComposerController = null;
      let searchController = null;
      let reactionController = null;
      let floatingMessageActionsController = null;
      let mediaViewerController = null;
      let contextMenusController = null;
      let forwardingController = null;

      function clamp(value, min, max) {
        return floatingMessageActionsController?.clamp?.(value, min, max) ?? Math.max(min, Math.min(value, max));
      }
      return window.BananzaApp.boot.composition.createEvalExports(["publishRuntimeApi","composerFactories","composerStateFactory","composerTextFactory","composerReplyEditFactory","composerFilesFactory","composerLocationFactory","composerSendFactory","composerEmojiPickerFactory","composerMentionsFactory","composerTypingDragDropFactory","pollComposerFactory","interactionFactories","searchControllerFactory","reactionControllerFactory","floatingMessageActionsFactory","mediaViewerFactory","contextMenusFactory","forwardingControllerFactory","composerStateController","composerTextController","composerReplyEditController","composerFilesController","composerLocationController","composerSendController","composerEmojiPickerController","composerMentionsController","composerTypingDragDropController","pollComposerController","searchController","reactionController","floatingMessageActionsController","mediaViewerController","contextMenusController","forwardingController","clamp"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
