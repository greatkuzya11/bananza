(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const shellRoot = root.shell = root.shell || {};
  const adapterRoot = shellRoot.mobileRuntimeAdapters = shellRoot.mobileRuntimeAdapters || {};

  function createMobileRuntimeAdapters(scope = {}) {
    with (scope) {
      function getMobileAppViewportHeight(...args) { return mobileComposerGuard?.getMobileAppViewportHeight?.(...args) || 0; }
      function getMobileAppViewportTopInset(...args) { return mobileComposerGuard?.getMobileAppViewportTopInset?.(...args) || 0; }
      function isIosMobileViewportTarget(...args) { return Boolean(mobileComposerGuard?.isIosMobileViewportTarget?.(...args)); }
      function isMobileViewportTarget(...args) { return Boolean(mobileComposerGuard?.isMobileViewportTarget?.(...args)); }
      function isIosWebkitMotionAllowed(...args) { return Boolean(mobileComposerGuard?.isIosWebkitMotionAllowed?.(...args)); }
      function forceIosAnimationMount(...args) { return mobileComposerGuard?.forceIosAnimationMount?.(...args); }
      function getMobileVisualViewportMetrics(...args) { return mobileComposerGuard?.getMobileVisualViewportMetrics?.(...args) || { top: 0, height: window.innerHeight || 0, width: window.innerWidth || 0, bottom: window.innerHeight || 0 }; }
      function getIosVisualViewportMetrics(...args) { return mobileComposerGuard?.getIosVisualViewportMetrics?.(...args) || getMobileVisualViewportMetrics(); }
      function getMobileViewportBaselineHeight(...args) { return mobileComposerGuard?.getMobileViewportBaselineHeight?.(...args) || 0; }
      function getIosViewportBaselineHeight(...args) { return mobileComposerGuard?.getIosViewportBaselineHeight?.(...args) || getMobileViewportBaselineHeight(); }
      function isMobileKeyboardOpen(...args) { return Boolean(mobileComposerGuard?.isMobileKeyboardOpen?.(...args)); }
      function isIosKeyboardOpen(...args) { return Boolean(mobileComposerGuard?.isIosKeyboardOpen?.(...args)); }
      function isMobileChatKeyboardLayoutActive(...args) { return Boolean(mobileComposerGuard?.isMobileChatKeyboardLayoutActive?.(...args)); }
      function isIosChatKeyboardLayoutActive(...args) { return Boolean(mobileComposerGuard?.isIosChatKeyboardLayoutActive?.(...args)); }
      function resetMobileKeyboardDock(...args) { return mobileComposerGuard?.resetMobileKeyboardDock?.(...args); }
      function getLockedMobileKeyboardViewportMetrics(...args) { return mobileComposerGuard?.getLockedMobileKeyboardViewportMetrics?.(...args); }
      function restoreMobileKeyboardDocumentScroll(...args) { return Boolean(mobileComposerGuard?.restoreMobileKeyboardDocumentScroll?.(...args)); }
      function syncMobileViewportLayoutState(...args) { return mobileComposerGuard?.syncMobileViewportLayoutState?.(...args); }
      function syncIosViewportLayoutState(...args) { return mobileComposerGuard?.syncIosViewportLayoutState?.(...args); }
      function queueMobileViewportLayoutSync(...args) { return mobileComposerGuard?.queueMobileViewportLayoutSync?.(...args); }
      function queueIosViewportLayoutSync(...args) { return mobileComposerGuard?.queueIosViewportLayoutSync?.(...args); }
      function isMobileComposerKeyboardOpen(...args) { return Boolean(mobileComposerGuard?.isMobileComposerKeyboardOpen?.(...args)); }
      function focusComposerKeepKeyboard(...args) { return mobileComposerGuard?.focusComposerKeepKeyboard?.(...args); }
      function restoreComposerFocusAfterMentionPicker(...args) { return Boolean(mobileComposerGuard?.restoreComposerFocusAfterMentionPicker?.(...args)); }
      function dismissMentionPickerAfterKeyboardClose(...args) { return Boolean(mobileComposerGuard?.dismissMentionPickerAfterKeyboardClose?.(...args)); }
      function preventMobileComposerBlur(...args) { return Boolean(mobileComposerGuard?.preventMobileComposerBlur?.(...args)); }
      function isMobileComposerSessionActive(...args) { return Boolean(mobileComposerGuard?.isMobileComposerSessionActive?.(...args)); }
      function setupMobileComposerGestureGuard(...args) { return mobileComposerGuard?.setupMobileComposerGestureGuard?.(...args); }
      function preserveMobileComposerOnPointerDown(...args) { return Boolean(mobileComposerGuard?.preserveMobileComposerOnPointerDown?.(...args)); }
      function dismissMobileComposer(...args) { return Boolean(mobileComposerGuard?.dismissMobileComposer?.(...args)); }
      function closeMobileComposerTransientUi(...args) { return mobileComposerGuard?.closeMobileComposerTransientUi?.(...args); }
      function hideAttachMenu(...args) { return mobileComposerGuard?.hideAttachMenu?.(...args); }
      function getMobileComposerSafeReturnFocusEl(...args) { return mobileComposerGuard?.getMobileComposerSafeReturnFocusEl?.(...args) || null; }
      function isTouchLikePointerEvent(...args) { return Boolean(mobileComposerGuard?.isTouchLikePointerEvent?.(...args)); }
      function isPickerDismissPassThroughTarget(...args) { return Boolean(mobileComposerGuard?.isPickerDismissPassThroughTarget?.(...args)); }
      function isFollowupClickSuppressPassThroughTarget(...args) { return Boolean(mobileComposerGuard?.isFollowupClickSuppressPassThroughTarget?.(...args)); }
      function consumeOutsidePickerDismissGesture(...args) { return mobileComposerGuard?.consumeOutsidePickerDismissGesture?.(...args); }
      function suppressSearchPanelFollowupClick(...args) { return mobileComposerGuard?.suppressSearchPanelFollowupClick?.(...args); }
      function suppressAvatarUserMenuFollowupClick(...args) { return mobileComposerGuard?.suppressAvatarUserMenuFollowupClick?.(...args); }
      function bindTouchSafeButtonActivation(...args) { return mobileComposerGuard?.bindTouchSafeButtonActivation?.(...args); }
      function shouldKeepComposerForMobileMessageInteraction(...args) { return Boolean(mobileComposerGuard?.shouldKeepComposerForMobileMessageInteraction?.(...args)); }
      function setupMobileMessageInteractionGuard(...args) { return mobileComposerGuard?.setupMobileMessageInteractionGuard?.(...args); }
      function shouldBypassLockedMobileViewportSync(...args) { return mobileComposerGuard?.shouldBypassLockedMobileViewportSync?.(...args) ?? true; }

      function getChatSettingsActionOpener() {
        return chatHeaderActionsShell?.getChatSettingsActionOpener?.()
          || chatSettingsActionBtn
          || chatInfoBtn
          || $('#chatSettingsActionBtn')
          || $('#chatInfoBtn');
      }
    
      function moveFocusOutOfChatHeaderActions() {
        return chatHeaderActionsShell?.moveFocusOutOfChatHeaderActions?.();
      }
    
      function syncChatHeaderActionsAccessibility() {
        return chatHeaderActionsShell?.syncChatHeaderActionsAccessibility?.();
      }
    
      function setChatHeaderActionsOpen(open) {
        if (chatHeaderActionsShell?.setChatHeaderActionsOpen) {
          return chatHeaderActionsShell.setChatHeaderActionsOpen(open);
        }
        chatHeaderActionsOpen = Boolean(open);
        return chatHeaderActionsOpen;
      }
    
      function toggleChatHeaderActions() {
        return chatHeaderActionsShell?.toggleChatHeaderActions?.() ?? setChatHeaderActionsOpen(!chatHeaderActionsOpen);
      }
    
      function closeChatHeaderActions() {
        return chatHeaderActionsShell?.closeChatHeaderActions?.() ?? setChatHeaderActionsOpen(false);
      }

      function shouldKeepEmojiPickerKeyboard(...args) { return composerEmojiPickerController?.shouldKeepEmojiPickerKeyboard?.(...args) || false; }
    
      function clearEmojiPickerKeyboardOpenStabilizer(...args) { return composerEmojiPickerController?.clearEmojiPickerKeyboardOpenStabilizer?.(...args); }
    
      function stabilizeEmojiPickerKeyboardOnOpen(...args) { return composerEmojiPickerController?.stabilizeEmojiPickerKeyboardOnOpen?.(...args) || false; }

      const __bananzaRuntimeExportNames = ["bindTouchSafeButtonActivation","clearEmojiPickerKeyboardOpenStabilizer","closeChatHeaderActions","closeMobileComposerTransientUi","consumeOutsidePickerDismissGesture","dismissMentionPickerAfterKeyboardClose","dismissMobileComposer","focusComposerKeepKeyboard","forceIosAnimationMount","getChatSettingsActionOpener","getIosViewportBaselineHeight","getIosVisualViewportMetrics","getLockedMobileKeyboardViewportMetrics","getMobileAppViewportHeight","getMobileAppViewportTopInset","getMobileComposerSafeReturnFocusEl","getMobileViewportBaselineHeight","getMobileVisualViewportMetrics","hideAttachMenu","isFollowupClickSuppressPassThroughTarget","isIosChatKeyboardLayoutActive","isIosKeyboardOpen","isIosMobileViewportTarget","isIosWebkitMotionAllowed","isMobileChatKeyboardLayoutActive","isMobileComposerKeyboardOpen","isMobileComposerSessionActive","isMobileKeyboardOpen","isMobileViewportTarget","isPickerDismissPassThroughTarget","isTouchLikePointerEvent","moveFocusOutOfChatHeaderActions","preserveMobileComposerOnPointerDown","preventMobileComposerBlur","queueIosViewportLayoutSync","queueMobileViewportLayoutSync","resetMobileKeyboardDock","restoreComposerFocusAfterMentionPicker","restoreMobileKeyboardDocumentScroll","setChatHeaderActionsOpen","setupMobileComposerGestureGuard","setupMobileMessageInteractionGuard","shouldBypassLockedMobileViewportSync","shouldKeepComposerForMobileMessageInteraction","shouldKeepEmojiPickerKeyboard","stabilizeEmojiPickerKeyboardOnOpen","suppressAvatarUserMenuFollowupClick","suppressSearchPanelFollowupClick","syncChatHeaderActionsAccessibility","syncIosViewportLayoutState","syncMobileViewportLayoutState","toggleChatHeaderActions"];
      const __bananzaRuntimeExports = {};
      __bananzaRuntimeExportNames.forEach((name) => {
        Object.defineProperty(__bananzaRuntimeExports, name, {
          configurable: true,
          enumerable: true,
          get() { return eval(name); },
          set(__bananzaRuntimeExportValue) { eval(name + ' = __bananzaRuntimeExportValue'); },
        });
      });
      return __bananzaRuntimeExports;
    }
  }

  adapterRoot.createMobileRuntimeAdapters = createMobileRuntimeAdapters;
})();
