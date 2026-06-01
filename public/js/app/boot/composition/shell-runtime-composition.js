(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeShellRuntime = function composeShellRuntime(scope = {}) {
    with (scope) {
      const shellRuntimeApi = window.BananzaApp?.shell?.shellRuntimeAdapter?.createShellRuntimeAdapter?.(createRuntimeProxyScope()) || {};
      const {
        handleDragEnter, handleDragOver, handleDragLeave, handleDrop, renderTypingBar, showTyping, hideTyping, normalizeRecentEmojiValue,
        isValidRecentEmojiValue, normalizeRecentEmojiList, mergeRecentEmojiLists, getRecentEmojiStorageKey, getRecentEmojiCategory, loadLocalRecentEmojis, persistLocalRecentEmojis, loadRecentEmojis,
        rememberRecentEmoji, syncRecentEmojiToServer, getEmojiPickerCategories, isCustomEmojiCategory, getEmojiCategoryItems, getEmojiCategoryLabel, renderEmojiGridItemHtml, renderEmojiGridItemsHtml,
        renderEmojiPickerGrid, setEmojiPickerCategory, initEmojiPicker, syncEmojiPickerButton, positionEmojiPicker, openEmojiPicker, closeEmojiPicker, dismissEmojiPickerOutsideGesture,
        toggleEmojiPicker, getSelectableFolderChats, getSelectedNewFolderChatIds, renderNewFolderChatList, resetNewFolderForm, normalizeNewChatModalTab, getNewChatModalActiveTab, getNewChatTabPane,
        prepareNewChatTabContent, createNewChatTabPreview, applyNewChatModalTab, setNewChatModalTab, initNewChatTabSwipePager, openNewChatModal, openAdminModal, openAdminBotAuditModal,
        setBackupExportStatus, setBackupRestoreStatus, syncBackupRestoreFileName, resetBackupRestoreState, renderBackupRestorePreview, openBackupExportModal, downloadBackupExport, previewBackupRestore,
        applyBackupRestore, openSettingsModal, openLanguageSettingsModal, openThemeSettingsModal, openVisualModeSettingsModal, openPollStyleSettingsModal, openAnimationSettingsModal, openMobileFontSettingsModal,
        openWeatherSettingsModal, openNotificationSettingsModal, openSoundSettingsModal, openAiBotSettingsModal, openOpenAiTextBotsModal, openOpenAiUniversalBotsModal, openOpenAiImageBotsModal, openYandexAiSettingsModal,
        openDeepseekAiSettingsModal, openDeepseekTextBotsModal, openQwenAiSettingsModal, openQwenTextBotsModal, resetManagedModalScroll, openGrokAiSettingsModal, openGrokTextBotsModal, openGrokImageBotsModal,
        openGrokUniversalBotsModal, resetChangePasswordFields, openChangePasswordModal, openChatInfoModal, setProfileStatus, getProfileSelectedColor, setProfileAvatarUploadPending, renderProfileAvatarPreview,
        syncProfileColorSelection, renderProfileColorPicker, renderProfileEditor, openMenuDrawer, uploadProfileAvatar, removeProfileAvatar, saveProfileChanges, setupProfileEvents,
        getVisibleComposerToolCount, getComposerInputWidthForMode, getNormalComposerInputWidth, measureMsgInputScrollHeight, getComposerInputTextMetrics, renderComposerRichPreviewContent, syncComposerRichPreview, autoResize,
        animateSendButton, animateBackButton, resetBackButtonNavigationState, deferBackButtonNavigationRelease, animateChatHeaderActionButton, prefersReducedMotion, cancelPendingSidebarReveal, isMobileChatHistoryState,
        isResolvedMobileChatScene, normalizeMobileChatListHistoryState, revealSidebarFromChat, navigateBackToChatList, setupPasswordPreviewToggles, createRuntimeEventScope, NEW_CHAT_MODAL_TABS, AVATAR_COLORS,
        setupEvents,
      } = shellRuntimeApi;
      publishRuntimeApi(shellRuntimeApi);
      return window.BananzaApp.boot.composition.createEvalExports(["shellRuntimeApi","handleDragEnter","handleDragOver","handleDragLeave","handleDrop","renderTypingBar","showTyping","hideTyping","normalizeRecentEmojiValue","isValidRecentEmojiValue","normalizeRecentEmojiList","mergeRecentEmojiLists","getRecentEmojiStorageKey","getRecentEmojiCategory","loadLocalRecentEmojis","persistLocalRecentEmojis","loadRecentEmojis","rememberRecentEmoji","syncRecentEmojiToServer","getEmojiPickerCategories","isCustomEmojiCategory","getEmojiCategoryItems","getEmojiCategoryLabel","renderEmojiGridItemHtml","renderEmojiGridItemsHtml","renderEmojiPickerGrid","setEmojiPickerCategory","initEmojiPicker","syncEmojiPickerButton","positionEmojiPicker","openEmojiPicker","closeEmojiPicker","dismissEmojiPickerOutsideGesture","toggleEmojiPicker","getSelectableFolderChats","getSelectedNewFolderChatIds","renderNewFolderChatList","resetNewFolderForm","normalizeNewChatModalTab","getNewChatModalActiveTab","getNewChatTabPane","prepareNewChatTabContent","createNewChatTabPreview","applyNewChatModalTab","setNewChatModalTab","initNewChatTabSwipePager","openNewChatModal","openAdminModal","openAdminBotAuditModal","setBackupExportStatus","setBackupRestoreStatus","syncBackupRestoreFileName","resetBackupRestoreState","renderBackupRestorePreview","openBackupExportModal","downloadBackupExport","previewBackupRestore","applyBackupRestore","openSettingsModal","openLanguageSettingsModal","openThemeSettingsModal","openVisualModeSettingsModal","openPollStyleSettingsModal","openAnimationSettingsModal","openMobileFontSettingsModal","openWeatherSettingsModal","openNotificationSettingsModal","openSoundSettingsModal","openAiBotSettingsModal","openOpenAiTextBotsModal","openOpenAiUniversalBotsModal","openOpenAiImageBotsModal","openYandexAiSettingsModal","openDeepseekAiSettingsModal","openDeepseekTextBotsModal","openQwenAiSettingsModal","openQwenTextBotsModal","resetManagedModalScroll","openGrokAiSettingsModal","openGrokTextBotsModal","openGrokImageBotsModal","openGrokUniversalBotsModal","resetChangePasswordFields","openChangePasswordModal","openChatInfoModal","setProfileStatus","getProfileSelectedColor","setProfileAvatarUploadPending","renderProfileAvatarPreview","syncProfileColorSelection","renderProfileColorPicker","renderProfileEditor","openMenuDrawer","uploadProfileAvatar","removeProfileAvatar","saveProfileChanges","setupProfileEvents","getVisibleComposerToolCount","getComposerInputWidthForMode","getNormalComposerInputWidth","measureMsgInputScrollHeight","getComposerInputTextMetrics","renderComposerRichPreviewContent","syncComposerRichPreview","autoResize","animateSendButton","animateBackButton","resetBackButtonNavigationState","deferBackButtonNavigationRelease","animateChatHeaderActionButton","prefersReducedMotion","cancelPendingSidebarReveal","isMobileChatHistoryState","isResolvedMobileChatScene","normalizeMobileChatListHistoryState","revealSidebarFromChat","navigateBackToChatList","setupPasswordPreviewToggles","createRuntimeEventScope","NEW_CHAT_MODAL_TABS","AVATAR_COLORS","setupEvents"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
