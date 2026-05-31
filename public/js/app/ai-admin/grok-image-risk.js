(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const shared = aiAdmin.shared;
  if (!shared?.createDomAccess) throw new Error('BananzaApp.aiAdmin.shared is required before grok-image-risk.js');

  const aiImageRiskApi = window.BananzaAiImageRisk || null;

  function escapeRegExpText(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      image_risk_filter_enabled: source.image_risk_filter_enabled ?? source.ai_bot_image_risk_filter_enabled ?? true,
      document_default_format: String(source.document_default_format || 'md').toLowerCase() === 'txt' ? 'txt' : 'md',
    };
  }

  function extractMentionTokensFromText(text) {
    const tokens = [];
    const re = /@([a-zA-Z0-9_][a-zA-Z0-9_-]{0,31})/g;
    let match;
    while ((match = re.exec(String(text || '')))) {
      const prev = match.index > 0 ? String(text || '')[match.index - 1] : '';
      if (prev && /[A-Za-z0-9_.-]/.test(prev)) continue;
      tokens.push(String(match[1] || '').toLowerCase());
    }
    return [...new Set(tokens)];
  }

  function getDirectPrivateAiBotTarget(loadedTargets = [], currentChat = null) {
    const peer = currentChat?.type === 'private' ? currentChat.private_user : null;
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
      display_name: peer.display_name || currentChat.name || '',
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

  function createGrokImageRiskController(options = {}) {
    const dom = options.dom || {};
    const services = options.services || {};
    const loadMentionTargets = options.loadMentionTargets || (() => Promise.resolve([]));
    const getCurrentChat = options.getCurrentChat || (() => window.BananzaAppBridge?.getCurrentChat?.() || null);
    const riskApi = options.aiImageRiskApi || aiImageRiskApi;
    let confirmResolver = null;
    const retryPending = new Set();

    async function resolveComposerUniversalBotTarget(text = '', replySnapshot = null) {
      const tokens = extractMentionTokensFromText(text);
      const targets = await loadMentionTargets();
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
      const directPrivateTarget = getDirectPrivateAiBotTarget(targets, getCurrentChat());
      if (isUniversalBotTarget(directPrivateTarget)) return directPrivateTarget;
      return null;
    }

    async function resolveTriggeredGrokImageBot(text, replySnapshot = null) {
      const tokens = extractMentionTokensFromText(text);
      const targets = await loadMentionTargets();
      const byToken = new Map();
      targets.forEach((target) => {
        const token = String(target.token || target.mention || '').toLowerCase();
        if (token && !byToken.has(token)) byToken.set(token, target);
      });
      for (const token of tokens) {
        const target = byToken.get(token);
        if (isGrokImageBotTarget(target)) return target;
      }
      if (isGrokImageBotTarget(replySnapshot)) return buildReplyBotTarget(replySnapshot);
      const directPrivateTarget = getDirectPrivateAiBotTarget(targets, getCurrentChat());
      if (isGrokImageBotTarget(directPrivateTarget)) return directPrivateTarget;
      return null;
    }

    async function analyzeOutgoingGrokImageRisk(text, replySnapshot = null, composerAiOverride = {}) {
      if (!riskApi?.analyzeAiImageRisk) return { risky: false, matches: [], prompt: '', target: null };
      const overrideTarget = composerAiOverride?.ai_override_target || null;
      const overrideMode = String(composerAiOverride?.ai_response_mode_hint || '').toLowerCase();
      let target = null;
      if (grokUniversalTargetAllowsImage(overrideTarget) && overrideMode !== 'text' && overrideMode !== 'document') {
        target = overrideTarget;
      }
      if (!target) target = await resolveTriggeredGrokImageBot(text, replySnapshot);
      if (!target) {
        const universalTarget = await resolveComposerUniversalBotTarget(text, replySnapshot);
        const sameOverrideTarget = Number(overrideTarget?.bot_id || overrideTarget?.ai_bot_id || 0)
          && Number(overrideTarget?.bot_id || overrideTarget?.ai_bot_id || 0) === Number(universalTarget?.bot_id || universalTarget?.ai_bot_id || 0);
        const universalMode = sameOverrideTarget ? overrideMode : 'auto';
        if (grokUniversalTargetAllowsImage(universalTarget) && universalMode !== 'text' && universalMode !== 'document') {
          target = universalTarget;
        }
      }
      if (!target) return { risky: false, matches: [], prompt: '', target: null };
      if (target.image_risk_filter_enabled === false || target.ai_bot_image_risk_filter_enabled === false) {
        return { risky: false, matches: [], prompt: '', target };
      }
      const prompt = stripTriggeredBotMention(text, target);
      if (!prompt) return { risky: false, matches: [], prompt: '', target };
      const result = riskApi.analyzeAiImageRisk(prompt);
      return { ...result, prompt, target };
    }

    function renderGrokImageRiskTerms(matches = []) {
      const termsEl = shared.createDomAccess(dom).byId('grokImageRiskTerms');
      if (!termsEl) return;
      const terms = matches
        .map((item) => String(item?.term || '').trim())
        .filter(Boolean)
        .slice(0, 6);
      if (!terms.length) {
        termsEl.innerHTML = '';
        termsEl.classList.add('hidden');
        return;
      }
      termsEl.innerHTML = terms.map((term) => `<span class="grok-risk-term">${shared.esc(term)}</span>`).join('');
      termsEl.classList.remove('hidden');
    }

    function handleGrokImageRiskModalClosed() {
      renderGrokImageRiskTerms([]);
      if (!confirmResolver) return;
      const resolve = confirmResolver;
      confirmResolver = null;
      resolve(false);
    }

    function openGrokImageRiskConfirm(matches = []) {
      const modal = shared.createDomAccess(dom).byId('grokImageRiskConfirmModal');
      if (!modal) return Promise.resolve(true);
      if (confirmResolver) {
        const resolvePending = confirmResolver;
        confirmResolver = null;
        resolvePending(false);
      }
      renderGrokImageRiskTerms(matches);
      services.modals?.open?.('grokImageRiskConfirmModal', { replaceStack: false });
      return new Promise((resolve) => {
        confirmResolver = resolve;
      });
    }

    function confirmRisk(value) {
      if (!confirmResolver) return false;
      const resolve = confirmResolver;
      confirmResolver = null;
      renderGrokImageRiskTerms([]);
      resolve(Boolean(value));
      return true;
    }

    async function retryGrokImageRiskPrompt(row, button = null) {
      const noticeId = Number(row?.dataset?.msgId || row?.__messageData?.id || 0);
      if (!noticeId || retryPending.has(noticeId)) return null;
      retryPending.add(noticeId);
      if (button) {
        button.disabled = true;
        button.classList.add('is-pending');
      }
      try {
        return await options.api?.(`/api/messages/${noticeId}/grok-image-risk-retry`, { method: 'POST' });
      } finally {
        retryPending.delete(noticeId);
        if (button) {
          button.disabled = false;
          button.classList.remove('is-pending');
        }
      }
    }

    return {
      analyzeOutgoingGrokImageRisk,
      buildReplyBotTarget,
      confirmRisk,
      getDirectPrivateAiBotTarget: (targets = []) => getDirectPrivateAiBotTarget(targets, getCurrentChat()),
      getRetryPending: () => new Set(retryPending),
      getUniversalBotModes,
      grokUniversalTargetAllowsImage,
      handleGrokImageRiskModalClosed,
      isGrokImageBotTarget,
      isGrokUniversalBotTarget,
      isUniversalBotTarget,
      openGrokImageRiskConfirm,
      renderGrokImageRiskTerms,
      resolveComposerUniversalBotTarget,
      resolveTriggeredGrokImageBot,
      retryGrokImageRiskPrompt,
      stripTriggeredBotMention,
    };
  }

  let defaultController = null;

  function getDefaultController() {
    if (!defaultController) {
      defaultController = createGrokImageRiskController({
        api: (...args) => window.BananzaAppBridge?.api?.(...args),
        loadMentionTargets: (...args) => window.BananzaAppBridge?.__testing?.loadMentionTargets?.(...args) || Promise.resolve([]),
        services: { modals: window.BananzaAppBridge },
      });
    }
    return defaultController;
  }

  aiAdmin.grokImageRisk = {
    analyzeOutgoingGrokImageRisk: (...args) => getDefaultController().analyzeOutgoingGrokImageRisk(...args),
    buildReplyBotTarget,
    createGrokImageRiskController,
    getDefaultController,
    getDirectPrivateAiBotTarget,
    getUniversalBotModes,
    grokUniversalTargetAllowsImage,
    handleGrokImageRiskModalClosed: (...args) => getDefaultController().handleGrokImageRiskModalClosed(...args),
    isGrokImageBotTarget,
    isGrokUniversalBotTarget,
    isUniversalBotTarget,
    openGrokImageRiskConfirm: (...args) => getDefaultController().openGrokImageRiskConfirm(...args),
    renderGrokImageRiskTerms: (...args) => getDefaultController().renderGrokImageRiskTerms(...args),
    resolveComposerUniversalBotTarget: (...args) => getDefaultController().resolveComposerUniversalBotTarget(...args),
    resolveTriggeredGrokImageBot: (...args) => getDefaultController().resolveTriggeredGrokImageBot(...args),
    retryGrokImageRiskPrompt: (...args) => getDefaultController().retryGrokImageRiskPrompt(...args),
    stripTriggeredBotMention,
  };
})();
