(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};

  function createLegacyGrokImageRiskRuntime(scope = {}) {
    with (scope) {
      async function retryGrokImageRiskPrompt(row, button = null) {
        const noticeId = Number(row?.dataset?.msgId || row?.__messageData?.id || 0);
        if (!noticeId || grokImageRiskRetryPending.has(noticeId)) return;
        grokImageRiskRetryPending.add(noticeId);
        if (button) {
          button.disabled = true;
          button.classList.add('is-pending');
        }
        try {
          const message = await api(`/api/messages/${noticeId}/grok-image-risk-retry`, { method: 'POST' });
          if (message) {
            if (Number(message.chat_id || message.chatId || 0) === Number(currentChatId || 0)) {
              appendTimelineItems([message]);
              scrollToBottom();
            }
            showCenterToast(t('Sent again'));
            playAppSound('send');
          }
        } catch (e) {
          showCenterToast(e.message || t('Could not send again'));
        } finally {
          grokImageRiskRetryPending.delete(noticeId);
          if (button) {
            button.disabled = false;
            button.classList.remove('is-pending');
          }
        }
      }
    
      async function jumpToSavedOriginal(message) {
        const originalId = Number(message?.saved_from_message_id || 0);
        if (!originalId) {
          showCenterToast('\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e');
          return false;
        }
    
        try {
          const target = await api(`/api/messages/${originalId}/jump-target`);
          const chatId = Number(target?.chatId || 0);
          const messageId = Number(target?.messageId || originalId);
          if (!chatId || !messageId) throw new Error('Original message deleted');
          if (!chats.find(c => Number(c.id) === chatId)) await loadChats({ silent: true });
          await openChat(chatId, {
            anchorMessageId: messageId,
            suppressHistoryPush: chatId === Number(currentChatId || 0),
            source: 'saved_original',
          });
          if (scrollToMessage(messageId)) return true;
          showCenterToast('\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e');
          return false;
        } catch (e) {
          showCenterToast('\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e');
          return false;
        }
      }
    
      function normalizeMentionTarget(...args) { return composerMentionsController?.normalizeMentionTarget?.(...args) || null; }
    
      function escapeRegExpText(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    
      function extractMentionTokensFromText(text) {
        const source = String(text || '');
        const tokens = [];
        const re = /@([a-zA-Z0-9_][a-zA-Z0-9_-]{0,31})/g;
        let match;
        while ((match = re.exec(source))) {
          const prev = match.index > 0 ? source[match.index - 1] : '';
          if (prev && /[A-Za-z0-9_.-]/.test(prev)) continue;
          tokens.push(String(match[1] || '').toLowerCase());
        }
        return [...new Set(tokens)];
      }
    
      function isGrokImageBotTarget(target) {
        if (!target) return false;
        return String(target.bot_provider || target.ai_bot_provider || '').toLowerCase() === 'grok'
          && String(target.bot_kind || target.ai_bot_kind || '').toLowerCase() === 'image';
      }
    
      function isUniversalBotTarget(target) {
        if (!target) return false;
        const provider = String(target.bot_provider || target.ai_bot_provider || '').toLowerCase();
        const kind = String(target.bot_kind || target.ai_bot_kind || '').toLowerCase();
        return (provider === 'openai' || provider === 'grok') && kind === 'universal';
      }
    
      function isGrokUniversalBotTarget(target) {
        if (!target) return false;
        return String(target.bot_provider || target.ai_bot_provider || '').toLowerCase() === 'grok'
          && String(target.bot_kind || target.ai_bot_kind || '').toLowerCase() === 'universal';
      }
    
      function grokUniversalTargetAllowsImage(target) {
        if (!isGrokUniversalBotTarget(target)) return false;
        return target.allow_image_generate !== false || target.allow_image_edit !== false;
      }
    
      function buildReplyBotTarget(replySnapshot, loadedTarget = null) {
        const source = loadedTarget || replySnapshot || {};
        const token = String(source.token || source.mention || source.ai_bot_mention || '').replace(/^@+/, '').trim();
        return {
          ...source,
          token,
          mention: token,
          display_name: source.display_name || '',
          bot_id: Number(source.bot_id || source.ai_bot_id) || 0,
          bot_provider: source.bot_provider || source.ai_bot_provider || '',
          bot_kind: source.bot_kind || source.ai_bot_kind || '',
          allow_text: source.allow_text ?? true,
          allow_image_generate: source.allow_image_generate ?? true,
          allow_image_edit: source.allow_image_edit ?? true,
          allow_document: source.allow_document ?? false,
          allow_poll_create: source.allow_poll_create ?? false,
          allow_poll_vote: source.allow_poll_vote ?? false,
          allow_react: source.allow_react ?? false,
          allow_pin: source.allow_pin ?? false,
          image_risk_filter_enabled: source.image_risk_filter_enabled ?? source.ai_bot_image_risk_filter_enabled ?? true,
          document_default_format: String(source.document_default_format || 'md').toLowerCase() === 'txt' ? 'txt' : 'md',
        };
      }
    
      function getDirectPrivateAiBotTarget(loadedTargets = []) {
        const chat = getChatById(currentChatId);
        const peer = chat?.type === 'private' ? chat.private_user : null;
        if (!peer || Number(peer.is_ai_bot || 0) === 0) return null;
        const peerUserId = Number(peer.id || peer.user_id || 0);
        const peerBotId = Number(peer.ai_bot_id || peer.bot_id || 0);
        const loaded = (loadedTargets || []).find((target) => {
          const targetUserId = Number(target.user_id || target.id || 0);
          const targetBotId = Number(target.bot_id || target.ai_bot_id || 0);
          return (peerUserId && targetUserId === peerUserId) || (peerBotId && targetBotId === peerBotId);
        }) || null;
        return buildReplyBotTarget({
          user_id: peerUserId,
          display_name: peer.display_name || chat.name || '',
          ai_bot_id: peerBotId,
          ai_bot_mention: peer.ai_bot_mention || peer.username || '',
          ai_bot_provider: peer.ai_bot_provider || '',
          ai_bot_kind: peer.ai_bot_kind || '',
          ai_bot_image_risk_filter_enabled: peer.ai_bot_image_risk_filter_enabled ?? true,
        }, loaded);
      }
    
      function getUniversalBotModes(target) {
        if (!isUniversalBotTarget(target)) return [];
        const provider = String(target.bot_provider || target.ai_bot_provider || '').toLowerCase();
        const allowText = target.allow_text !== false;
        const allowImage = target.allow_image_generate !== false || target.allow_image_edit !== false;
        const allowDocument = provider === 'openai' && target.allow_document !== false;
        const modes = ['auto'];
        if (allowText) modes.push('text');
        if (allowImage) modes.push('image');
        if (allowDocument) modes.push('document');
        return [...new Set(modes)];
      }
    
      async function resolveComposerUniversalBotTarget(text = '', replySnapshot = null) {
        const chatId = Number(currentChatId || 0);
        if (!chatId) return null;
        const tokens = extractMentionTokensFromText(text);
        const targets = await loadMentionTargets(chatId);
        const byToken = new Map();
        const byId = new Map();
        targets.forEach((target) => {
          const token = String(target.token || target.mention || '').toLowerCase();
          if (token && !byToken.has(token)) byToken.set(token, target);
          const botId = Number(target.bot_id || 0);
          if (botId && !byId.has(botId)) byId.set(botId, target);
        });
        for (const token of tokens) {
          const target = byToken.get(token);
          if (isUniversalBotTarget(target)) return target;
        }
        if (replySnapshot && isUniversalBotTarget(replySnapshot)) {
          const loadedTarget = byId.get(Number(replySnapshot.ai_bot_id || replySnapshot.bot_id || 0)) || null;
          return buildReplyBotTarget(replySnapshot, loadedTarget);
        }
        const directPrivateTarget = getDirectPrivateAiBotTarget(targets);
        if (isUniversalBotTarget(directPrivateTarget)) return directPrivateTarget;
        return null;
      }
    
      function renderComposerAiOverride() {
        if (!composerAiOverrideEl || !composerAiOverrideModeEl) return;
        const target = composerAiOverrideState.target;
        if (!isUniversalBotTarget(target)) {
          composerAiOverrideEl.classList.add('hidden');
          composerAiOverrideState.mode = 'auto';
          composerAiOverrideState.documentFormat = 'md';
          return;
        }
        const modes = getUniversalBotModes(target);
        composerAiOverrideEl.classList.remove('hidden');
        if (composerAiOverrideLabel) {
          const name = target.display_name || target.token || target.mention || 'AI bot';
          composerAiOverrideLabel.textContent = `${name} response`;
        }
        if (composerAiOverrideHint) {
          const provider = String(target.bot_provider || '').toLowerCase();
          composerAiOverrideHint.textContent = provider === 'openai' ? 'Text, image, document' : 'Text or image';
        }
        composerAiOverrideModeEl.innerHTML = modes.map((mode) => {
          const label = mode === 'auto'
            ? 'Auto'
            : mode === 'text'
              ? 'Text'
              : mode === 'image'
                ? 'Image'
                : 'Document';
          return `<option value="${mode}">${label}</option>`;
        }).join('');
        if (!modes.includes(composerAiOverrideState.mode)) composerAiOverrideState.mode = 'auto';
        composerAiOverrideModeEl.value = composerAiOverrideState.mode;
        const showDocument = composerAiOverrideState.mode === 'document' && modes.includes('document');
        composerAiOverrideDocumentWrap?.classList.toggle('hidden', !showDocument);
        if (composerAiOverrideDocumentFormatEl) {
          const nextFormat = String(composerAiOverrideState.documentFormat || target.document_default_format || 'md').toLowerCase() === 'txt' ? 'txt' : 'md';
          composerAiOverrideState.documentFormat = nextFormat;
          composerAiOverrideDocumentFormatEl.value = nextFormat;
        }
      }
    
      async function updateComposerAiOverrideState() {
        if (!composerAiOverrideEl) return;
        const seq = ++composerAiOverrideSeq;
        const text = getComposerTextValue();
        const replySnapshot = getReplySnapshot();
        try {
          const target = await resolveComposerUniversalBotTarget(text, replySnapshot);
          if (seq !== composerAiOverrideSeq) return;
          const previousTargetId = Number(composerAiOverrideState.target?.bot_id || 0);
          const nextTargetId = Number(target?.bot_id || 0);
          if (previousTargetId !== nextTargetId) {
            composerAiOverrideState.mode = 'auto';
            composerAiOverrideState.documentFormat = target?.document_default_format || 'md';
          }
          composerAiOverrideState.target = target;
        } catch (e) {
          if (seq !== composerAiOverrideSeq) return;
          composerAiOverrideState.target = null;
          composerAiOverrideState.mode = 'auto';
          composerAiOverrideState.documentFormat = 'md';
        }
        renderComposerAiOverride();
      }
    
      function getComposerAiOverridePayload() {
        const target = composerAiOverrideState.target;
        if (!isUniversalBotTarget(target)) return {};
        const modes = getUniversalBotModes(target);
        const mode = modes.includes(composerAiOverrideState.mode) ? composerAiOverrideState.mode : 'auto';
        const payload = {
          ai_response_mode_hint: mode,
          ai_override_target: target,
        };
        if (mode === 'document') {
          payload.ai_document_format_hint = String(composerAiOverrideState.documentFormat || target.document_default_format || 'md').toLowerCase() === 'txt' ? 'txt' : 'md';
        }
        return payload;
      }
    
      function stripTriggeredBotMention(text, target) {
        const original = String(text || '').trim();
        if (!original || !target) return original;
        const patterns = [
          target.token ? new RegExp(`@${escapeRegExpText(target.token)}\\b`, 'ig') : null,
          target.mention ? new RegExp(`@${escapeRegExpText(target.mention)}\\b`, 'ig') : null,
          target.display_name ? new RegExp(`@${escapeRegExpText(target.display_name)}\\b`, 'ig') : null,
        ].filter(Boolean);
        let next = original;
        patterns.forEach((pattern) => {
          next = next.replace(pattern, ' ');
        });
        next = next.replace(/\s+/g, ' ').replace(/^[\s,.:;!?-]+/, '').trim();
        return next || original;
      }
    
      async function resolveTriggeredGrokImageBot(text, replySnapshot = null) {
        const tokens = extractMentionTokensFromText(text);
        const findTarget = (targets) => {
          const byToken = new Map();
          targets.forEach((target) => {
            const token = String(target.token || target.mention || '').toLowerCase();
            if (token && !byToken.has(token)) byToken.set(token, target);
          });
          for (const token of tokens) {
            const target = byToken.get(token);
            if (isGrokImageBotTarget(target)) return target;
          }
          return null;
        };
        const targets = await loadMentionTargets(currentChatId);
        const directTarget = findTarget(targets);
        if (directTarget) return directTarget;
        if (tokens.length) {
          const staleAiTarget = targets.some((target) => {
            const token = String(target.token || target.mention || '').toLowerCase();
            return token && tokens.includes(token)
              && Boolean(target.is_ai_bot)
              && (!String(target.bot_provider || '').trim() || !String(target.bot_kind || '').trim());
          });
          if (staleAiTarget) {
            const refreshedTargets = await loadMentionTargets(currentChatId, { force: true });
            const refreshedTarget = findTarget(refreshedTargets);
            if (refreshedTarget) return refreshedTarget;
          }
        }
        if (isGrokImageBotTarget(replySnapshot)) {
          return {
            token: String(replySnapshot.ai_bot_mention || replySnapshot.mention || '').replace(/^@+/, '').trim(),
            mention: String(replySnapshot.ai_bot_mention || replySnapshot.mention || '').replace(/^@+/, '').trim(),
            display_name: replySnapshot.display_name || '',
            bot_id: Number(replySnapshot.ai_bot_id) || 0,
            bot_provider: replySnapshot.ai_bot_provider || '',
            bot_kind: replySnapshot.ai_bot_kind || '',
          };
        }
        const directPrivateTarget = getDirectPrivateAiBotTarget(targets);
        if (isGrokImageBotTarget(directPrivateTarget)) return directPrivateTarget;
        return null;
      }
    
      async function analyzeOutgoingGrokImageRisk(text, replySnapshot = null, composerAiOverride = {}) {
        if (!aiImageRiskApi?.analyzeAiImageRisk) return { risky: false, matches: [], prompt: '', target: null };
        const overrideTarget = composerAiOverride?.ai_override_target || null;
        const overrideMode = String(composerAiOverride?.ai_response_mode_hint || '').toLowerCase();
        let target = null;
        if (
          grokUniversalTargetAllowsImage(overrideTarget)
          && overrideMode !== 'text'
          && overrideMode !== 'document'
        ) {
          target = overrideTarget;
        }
        if (!target) target = await resolveTriggeredGrokImageBot(text, replySnapshot);
        if (!target) {
          const universalTarget = await resolveComposerUniversalBotTarget(text, replySnapshot);
          const sameOverrideTarget = Number(overrideTarget?.bot_id || overrideTarget?.ai_bot_id || 0)
            && Number(overrideTarget?.bot_id || overrideTarget?.ai_bot_id || 0) === Number(universalTarget?.bot_id || universalTarget?.ai_bot_id || 0);
          const universalMode = sameOverrideTarget ? overrideMode : 'auto';
          if (
            grokUniversalTargetAllowsImage(universalTarget)
            && universalMode !== 'text'
            && universalMode !== 'document'
          ) {
            target = universalTarget;
          }
        }
        if (!target) return { risky: false, matches: [], prompt: '', target: null };
        if (target.image_risk_filter_enabled === false || target.ai_bot_image_risk_filter_enabled === false) {
          return { risky: false, matches: [], prompt: '', target };
        }
        const prompt = stripTriggeredBotMention(text, target);
        if (!prompt) return { risky: false, matches: [], prompt: '', target };
        const result = aiImageRiskApi.analyzeAiImageRisk(prompt);
        return { ...result, prompt, target };
      }
    
      function renderGrokImageRiskTerms(matches = []) {
        if (!grokImageRiskTerms) return;
        const terms = matches
          .map((item) => String(item?.term || '').trim())
          .filter(Boolean)
          .slice(0, 6);
        if (!terms.length) {
          grokImageRiskTerms.innerHTML = '';
          grokImageRiskTerms.classList.add('hidden');
          return;
        }
        grokImageRiskTerms.innerHTML = terms.map((term) => `<span class="grok-risk-term">${esc(term)}</span>`).join('');
        grokImageRiskTerms.classList.remove('hidden');
      }
    
      function openGrokImageRiskConfirm(matches = []) {
        if (!grokImageRiskConfirmModal) return Promise.resolve(true);
        if (grokImageRiskConfirmResolver) {
          const resolvePending = grokImageRiskConfirmResolver;
          grokImageRiskConfirmResolver = null;
          resolvePending(false);
        }
        renderGrokImageRiskTerms(matches);
        openModal('grokImageRiskConfirmModal', { replaceStack: false, opener: sendBtn });
        return new Promise((resolve) => {
          grokImageRiskConfirmResolver = resolve;
        });
      }
    

      return {
        retryGrokImageRiskPrompt, jumpToSavedOriginal, normalizeMentionTarget, escapeRegExpText, extractMentionTokensFromText, isGrokImageBotTarget, isUniversalBotTarget, isGrokUniversalBotTarget,
        grokUniversalTargetAllowsImage, buildReplyBotTarget, getDirectPrivateAiBotTarget, getUniversalBotModes, resolveComposerUniversalBotTarget, renderComposerAiOverride, updateComposerAiOverrideState, getComposerAiOverridePayload,
        stripTriggeredBotMention, resolveTriggeredGrokImageBot, analyzeOutgoingGrokImageRisk, renderGrokImageRiskTerms, openGrokImageRiskConfirm,
      };
    }
  }

  aiAdmin.grokImageRiskRuntime = { createLegacyGrokImageRiskRuntime };
})();
