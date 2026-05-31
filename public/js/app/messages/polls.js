(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const messagesRoot = root.messages = root.messages || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createPollMessageRenderer(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const ui = objectOrDefault(opts.ui);
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const esc = typeof opts.esc === 'function' ? opts.esc : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value ?? ''));
    const initials = typeof opts.initials === 'function' ? opts.initials : (typeof formatters.initials === 'function' ? formatters.initials : (name) => String(name || '').slice(0, 1).toUpperCase());
    const formatTime = typeof opts.formatTime === 'function' ? opts.formatTime : (typeof formatters.formatTime === 'function' ? formatters.formatTime : (value) => String(value || ''));
    const formatDate = typeof opts.formatDate === 'function' ? opts.formatDate : (typeof formatters.formatDate === 'function' ? formatters.formatDate : (value) => String(value || ''));
    const formatRelativeDuration = typeof opts.formatRelativeDuration === 'function' ? opts.formatRelativeDuration : (typeof formatters.formatRelativeDuration === 'function' ? formatters.formatRelativeDuration : () => '');
    const formatPollDeadline = typeof opts.formatPollDeadline === 'function' ? opts.formatPollDeadline : (typeof formatters.formatPollDeadline === 'function' ? formatters.formatPollDeadline : () => '');
    const normalizePollStyle = typeof opts.normalizePollStyle === 'function' ? opts.normalizePollStyle : (typeof ui.normalizePollStyle === 'function' ? ui.normalizePollStyle : (style) => String(style || 'pulse'));
    const setPollStyleSurface = typeof opts.setPollStyleSurface === 'function' ? opts.setPollStyleSurface : (typeof ui.setPollStyleSurface === 'function' ? ui.setPollStyleSurface : () => {});
    const t = typeof opts.t === 'function' ? opts.t : (key) => String(key || '');
    const messagesEl = dom.messagesEl || doc.getElementById('messages');
    const pollVotersModal = dom.pollVotersModal || doc.getElementById('pollVotersModal');
    const pollVotersMeta = dom.pollVotersMeta || doc.getElementById('pollVotersMeta');
    const pollVotersTitle = dom.pollVotersTitle || doc.getElementById('pollVotersTitle');
    const pollVotersStatus = dom.pollVotersStatus || doc.getElementById('pollVotersStatus');
    const pollVotersList = dom.pollVotersList || doc.getElementById('pollVotersList');
    const getCurrentUser = typeof state.getCurrentUser === 'function' ? state.getCurrentUser : () => null;
    const getCurrentChatId = typeof state.getCurrentChatId === 'function' ? state.getCurrentChatId : () => null;
    const getChatById = typeof state.getChatById === 'function' ? state.getChatById : () => null;
    const PULSE_INLINE_VOTER_LIMIT = Number(opts.PULSE_INLINE_VOTER_LIMIT || 5);
    const PULSE_VOTER_POPOVER_AUTOHIDE_MS = Number(opts.PULSE_VOTER_POPOVER_AUTOHIDE_MS || 5000);
    const PULSE_PREVIEW_AVATAR_COLORS = Object.freeze(['#6f7f95', '#758cab', '#6a879b', '#8276a8', '#748b85']);
    const pollVotePending = new Set();
    const pollClosePending = new Set();
    let pollVotersState = null;
    let pulseInlineVotersCache = new Map();
    let pulseInlineVotersPending = new Map();
    let pulseInlineVotersRevision = new Map();
    let expandedPulseVoterOptions = new Set();
    let activePulseVoterPopover = null;

    function normalizePoll(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const myOptionIds = [...new Set((Array.isArray(raw.my_option_ids) ? raw.my_option_ids : raw.myOptionIds || [])
        .map((value) => Number(value || 0))
        .filter((value) => Number.isInteger(value) && value > 0))];
      return {
        created_by: Number(raw.created_by || raw.createdBy || 0),
        closed_by: raw.closed_by == null && raw.closedBy == null ? null : Number(raw.closed_by || raw.closedBy || 0),
        style: normalizePollStyle(raw.style),
        allows_multiple: Boolean(raw.allows_multiple ?? raw.allowsMultiple),
        show_voters: Boolean(raw.show_voters ?? raw.showVoters),
        closes_at: raw.closes_at || raw.closesAt || null,
        closed_at: raw.closed_at || raw.closedAt || null,
        created_at: raw.created_at || raw.createdAt || null,
        is_closed: Boolean(raw.is_closed ?? raw.isClosed ?? raw.closed_at ?? raw.closedAt),
        total_votes: Number(raw.total_votes || raw.totalVotes || 0),
        total_voters: Number(raw.total_voters || raw.totalVoters || 0),
        my_option_ids: myOptionIds,
        options: (Array.isArray(raw.options) ? raw.options : []).map((option, index) => ({
          id: Number(option.id || 0),
          text: String(option.text || '').trim(),
          position: Number(option.position ?? index),
          vote_count: Number(option.vote_count || option.voteCount || 0),
          voted_by_me: Boolean(option.voted_by_me ?? option.votedByMe ?? myOptionIds.includes(Number(option.id || 0))),
        })).filter((option) => option.id > 0),
      };
    }
    
    
    
    function isPollMessage(msg) {
      return Boolean(normalizePoll(msg?.poll));
    }
    
    
    
    function isPulsePoll(pollOrMessage) {
      const poll = pollOrMessage?.poll ? normalizePoll(pollOrMessage.poll) : normalizePoll(pollOrMessage);
      return normalizePollStyle(poll?.style) === 'pulse';
    }
    
    
    
    function pulseInlineVotersCacheKey(messageId, optionId) {
      return `${Number(messageId || 0)}:${Number(optionId || 0)}`;
    }
    
    
    
    function getPulseInlineVotersRevision(messageId) {
      return Number(pulseInlineVotersRevision.get(Number(messageId || 0)) || 0);
    }
    
    
    
    function invalidatePulseInlineVotersForMessage(messageId) {
      const resolvedMessageId = Number(messageId || 0);
      if (!resolvedMessageId) return;
      const prefix = `${resolvedMessageId}:`;
      pulseInlineVotersRevision.set(resolvedMessageId, getPulseInlineVotersRevision(resolvedMessageId) + 1);
      [...pulseInlineVotersCache.keys()].forEach((key) => {
        if (key.startsWith(prefix)) pulseInlineVotersCache.delete(key);
      });
    }
    
    
    
    function getPulseVoterDisplayName(voter) {
      const displayName = String(voter?.display_name || '').trim();
      if (displayName) return displayName;
      const username = String(voter?.username || '').trim();
      if (username) return `@${username}`;
      return 'User';
    }
    
    
    
    function isPulseVoterOptionExpanded(messageId, optionId) {
      return expandedPulseVoterOptions.has(pulseInlineVotersCacheKey(messageId, optionId));
    }
    
    
    
    function getPulseVoterPopoverElement(popover = activePulseVoterPopover) {
      if (!messagesEl || !popover) return null;
      const key = pulseInlineVotersCacheKey(popover.messageId, popover.optionId);
      const slot = messagesEl.querySelector(`[data-poll-inline-voters="${key}"]`);
      if (!(slot instanceof Element)) return null;
      return slot.querySelector(`[data-poll-voter-popover][data-poll-voter-id="${Number(popover.voterId || 0)}"]`);
    }
    
    
    
    function schedulePulseVoterPopoverAutoHide(popover = activePulseVoterPopover) {
      if (!popover) return;
      clearTimeout(popover.autoHideTimer);
      popover.autoHideTimer = setTimeout(() => {
        if (activePulseVoterPopover !== popover) return;
        clearActivePulseVoterPopover();
      }, PULSE_VOTER_POPOVER_AUTOHIDE_MS);
    }
    
    
    
    function mountPulseVoterPopover(popover = activePulseVoterPopover) {
      if (!popover || activePulseVoterPopover !== popover) return;
      const el = getPulseVoterPopoverElement(popover);
      if (!(el instanceof HTMLElement)) return;
      schedulePulseVoterPopoverAutoHide(popover);
      actions.openFloatingSurface(el);
    }
    
    
    
    function clearActivePulseVoterPopover({ skipRefresh = false, immediate = false } = {}) {
      const current = activePulseVoterPopover;
      if (!current) return;
      clearTimeout(current.autoHideTimer);
      current.autoHideTimer = null;
      const finalize = () => {
        clearTimeout(current.autoHideTimer);
        current.autoHideTimer = null;
        if (activePulseVoterPopover === current) activePulseVoterPopover = null;
        if (!skipRefresh) refreshPulseInlineVoterSlots(current.messageId, current.optionId);
      };
      const el = getPulseVoterPopoverElement(current);
      if (!(el instanceof HTMLElement) || skipRefresh) {
        finalize();
        return;
      }
      actions.closeFloatingSurface(el, { immediate, onAfterClose: finalize });
    }
    
    
    
    function clearActivePulseVoterPopoverForMessage(messageId, { skipRefresh = false } = {}) {
      if (!activePulseVoterPopover || Number(activePulseVoterPopover.messageId) !== Number(messageId || 0)) return;
      clearActivePulseVoterPopover({ skipRefresh });
    }
    
    
    
    function bindPulseInlineVoterControls(scope, messageId) {
      const resolvedMessageId = Number(messageId || 0);
      if (!(scope instanceof Element) || !resolvedMessageId) return;
      scope.querySelectorAll('[data-poll-voter-avatar]').forEach((btn) => {
        if (btn.dataset.boundPulseVoterAvatar === '1') return;
        btn.dataset.boundPulseVoterAvatar = '1';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePulseVoterPopover(
            resolvedMessageId,
            Number(btn.dataset.pollOptionId || 0),
            Number(btn.dataset.pollVoterId || btn.dataset.pollVoterAvatar || 0)
          );
        });
      });
      scope.querySelectorAll('[data-poll-voter-more]').forEach((btn) => {
        if (btn.dataset.boundPulseVoterMore === '1') return;
        btn.dataset.boundPulseVoterMore = '1';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePulseVoterOptionExpanded(resolvedMessageId, Number(btn.dataset.pollOptionId || 0));
        });
      });
    }
    
    
    
    function togglePulseVoterOptionExpanded(messageId, optionId) {
      const resolvedMessageId = Number(messageId || 0);
      const resolvedOptionId = Number(optionId || 0);
      if (!resolvedMessageId || !resolvedOptionId) return;
      const key = pulseInlineVotersCacheKey(resolvedMessageId, resolvedOptionId);
      const next = new Set(expandedPulseVoterOptions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      expandedPulseVoterOptions = next;
      clearActivePulseVoterPopover({ skipRefresh: true });
      refreshPulseInlineVoterSlots(resolvedMessageId, resolvedOptionId);
    }
    
    
    
    function togglePulseVoterPopover(messageId, optionId, voterId) {
      const resolvedMessageId = Number(messageId || 0);
      const resolvedOptionId = Number(optionId || 0);
      const resolvedVoterId = Number(voterId || 0);
      if (!resolvedMessageId || !resolvedOptionId || !resolvedVoterId) return;
      const previous = activePulseVoterPopover;
      const isSame =
        previous &&
        Number(previous.messageId) === resolvedMessageId &&
        Number(previous.optionId) === resolvedOptionId &&
        Number(previous.voterId) === resolvedVoterId;
      if (isSame) {
        clearActivePulseVoterPopover();
        return;
      }
      if (previous) {
        const sameSlot =
          Number(previous.messageId) === resolvedMessageId &&
          Number(previous.optionId) === resolvedOptionId;
        clearActivePulseVoterPopover({ skipRefresh: sameSlot, immediate: true });
      }
      const next = { messageId: resolvedMessageId, optionId: resolvedOptionId, voterId: resolvedVoterId, autoHideTimer: null };
      activePulseVoterPopover = next;
      refreshPulseInlineVoterSlots(resolvedMessageId, resolvedOptionId);
      mountPulseVoterPopover(next);
    }
    
    
    
    function getPollCompactFooterMeta(poll) {
      if (!poll) return null;
      if (poll.is_closed) {
        return { label: 'Closed', tone: 'closed' };
      }
      if (!poll.closes_at) return null;
      const relative = formatRelativeDuration(poll.closes_at);
      return {
        label: relative ? `Ends in ${relative}` : `Ends ${formatTime(poll.closes_at)}`,
        tone: 'deadline',
      };
    }
    
    
    
    function canClosePollMessage(msg) {
      const poll = normalizePoll(msg?.poll);
      if (!getCurrentUser() || !poll || poll.is_closed) return false;
      const chat = getChatById(msg?.chat_id || msg?.chatId || getCurrentChatId());
      return Boolean(
        getCurrentUser().is_admin ||
        Number(poll.created_by || 0) === Number(getCurrentUser().id || 0) ||
        Number(chat?.created_by || 0) === Number(getCurrentUser().id || 0)
      );
    }
    
    
    
    function buildOptimisticPollState(poll, nextOptionIds) {
      const previousSet = new Set((poll?.my_option_ids || []).map((id) => Number(id)));
      const nextSet = new Set((Array.isArray(nextOptionIds) ? nextOptionIds : []).map((id) => Number(id)));
      const wasVoter = previousSet.size > 0;
      const willVoter = nextSet.size > 0;
      return {
        ...poll,
        total_votes: Math.max(0, Number(poll.total_votes || 0) - previousSet.size + nextSet.size),
        total_voters: Math.max(0, Number(poll.total_voters || 0) - (wasVoter ? 1 : 0) + (willVoter ? 1 : 0)),
        my_option_ids: [...nextSet],
        options: (poll.options || []).map((option) => ({
          ...option,
          vote_count: Math.max(
            0,
            Number(option.vote_count || 0) - (previousSet.has(Number(option.id)) ? 1 : 0) + (nextSet.has(Number(option.id)) ? 1 : 0)
          ),
          voted_by_me: nextSet.has(Number(option.id)),
        })),
      };
    }
    
    
    
    function nextPollVoteSelection(poll, optionId) {
      const selected = new Set((poll?.my_option_ids || []).map((id) => Number(id)));
      const id = Number(optionId || 0);
      if (!id) return [];
      if (poll?.allows_multiple) {
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        return [...selected];
      }
      if (selected.has(id)) return [];
      return [id];
    }
    
    
    
    function replaceRenderedPollCard(row, nextMsg) {
      if (!row || !nextMsg?.poll) return false;
      const currentCard = row.querySelector('.poll-card');
      if (!currentCard) return false;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderPollCard(nextMsg, { liveUpdate: true }).trim();
      const nextCard = wrapper.firstElementChild;
      if (!nextCard) return false;
      currentCard.replaceWith(nextCard);
      row.__messageData = { ...nextMsg };
      row.classList.toggle('poll-message', Boolean(!nextMsg.is_deleted && nextMsg.poll));
      bindPollControls(row);
      hydratePulseInlineVoters(row);
      return true;
    }
    
    
    
    function applyPollUpdate(chatId, messageId, poll) {
      const normalizedPoll = normalizePoll(poll);
      if (!normalizedPoll) return;
      const id = Number(messageId || 0);
      if (!id) return;
      clearActivePulseVoterPopoverForMessage(id, { skipRefresh: true });
      if (isPulsePoll(normalizedPoll) && normalizedPoll.show_voters) {
        invalidatePulseInlineVotersForMessage(id);
      }
      const resolvedChatId = Number(chatId || getCurrentChatId() || 0);
      if (resolvedChatId && window.messageCache?.patchMessage) {
        window.messageCache.patchMessage(resolvedChatId, id, { poll: normalizedPoll }).catch(() => {});
      }
      const row = messagesEl.querySelector(`[data-msg-id="${id}"]`);
      if (!row || Number(getCurrentChatId() || 0) !== resolvedChatId) return;
      const nextMsg = { ...(row.__messageData || {}), poll: normalizedPoll };
      if (!replaceRenderedPollCard(row, nextMsg)) {
        actions.replaceRenderedMessage(nextMsg);
      }
    }
    
    
    
    async function togglePollVote(messageId, optionId) {
      const row = messagesEl.querySelector(`[data-msg-id="${messageId}"]`);
      const msg = row?.__messageData || {};
      const poll = normalizePoll(msg.poll);
      if (!poll || poll.is_closed || pollVotePending.has(Number(messageId))) return;
      const nextSelection = nextPollVoteSelection(poll, optionId);
      const optimisticPoll = buildOptimisticPollState(poll, nextSelection);
      pollVotePending.add(Number(messageId));
      applyPollUpdate(msg.chat_id, messageId, optimisticPoll);
      try {
        const data = await api(`/api/messages/${messageId}/poll-vote`, {
          method: 'POST',
          body: { optionIds: nextSelection },
        });
        pollVotePending.delete(Number(messageId));
        if (data?.poll) applyPollUpdate(msg.chat_id, messageId, data.poll);
      } catch (error) {
        pollVotePending.delete(Number(messageId));
        if (error?.poll) applyPollUpdate(msg.chat_id, messageId, error.poll);
        else applyPollUpdate(msg.chat_id, messageId, poll);
        actions.showCenterToast(error.message || 'Could not update vote');
      }
    }
    
    
    
    async function closePollMessage(messageId) {
      const row = messagesEl.querySelector(`[data-msg-id="${messageId}"]`);
      const msg = row?.__messageData || {};
      if (!canClosePollMessage(msg) || pollClosePending.has(Number(messageId))) return;
      pollClosePending.add(Number(messageId));
      applyPollUpdate(msg.chat_id, messageId, { ...normalizePoll(msg.poll), is_closed: false });
      try {
        const data = await api(`/api/messages/${messageId}/poll-close`, { method: 'POST' });
        pollClosePending.delete(Number(messageId));
        if (data?.poll) applyPollUpdate(msg.chat_id, messageId, data.poll);
      } catch (error) {
        pollClosePending.delete(Number(messageId));
        applyPollUpdate(msg.chat_id, messageId, msg.poll);
        actions.showCenterToast(error.message || 'Could not close poll');
      }
    }
    
    
    
    function pollAccentVar(index = 0) {
      return `var(--poll-accent-${(Number(index || 0) % 6) + 1})`;
    }
    
    
    
    function buildPollRenderState(message, { preview = false, liveUpdate = false } = {}) {
      const poll = normalizePoll(message?.poll);
      if (!poll) return null;
      const messageId = preview ? 0 : Number(message?.id || 0);
      const totalVotes = Math.max(0, Number(poll.total_votes || 0));
      const interactionLocked = preview || pollVotePending.has(messageId) || pollClosePending.has(messageId);
      return {
        preview,
        liveUpdate,
        messageId,
        poll,
        totalVotes,
        canClose: !preview && canClosePollMessage(message),
        interactionLocked,
        options: (poll.options || []).map((option, index) => {
          const voteCount = Math.max(0, Number(option.vote_count || 0));
          return {
            ...option,
            index,
            accentVar: pollAccentVar(index),
            selected: !!option.voted_by_me,
            voteCount,
            percentage: totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0,
            voteLabel: voteCount === 1 ? '1 vote' : `${voteCount} votes`,
            voterLabel: voteCount === 1 ? '1 voter' : `${voteCount} voters`,
            mark: poll.allows_multiple ? '\u2713' : '\u25cf',
          };
        }),
      };
    }
    
    
    
    function buildPollOrbitGradient(options = [], totalVotes = 0) {
      if (!totalVotes) return 'conic-gradient(rgba(255,255,255,.08) 0deg 360deg)';
      let current = 0;
      const segments = [];
      options.forEach((option) => {
        const share = Number(option.voteCount || 0) / totalVotes;
        if (share <= 0) return;
        const next = current + share * 360;
        segments.push(`${option.accentVar} ${current.toFixed(2)}deg ${next.toFixed(2)}deg`);
        current = next;
      });
      if (current < 360) segments.push(`rgba(255,255,255,.08) ${current.toFixed(2)}deg 360deg`);
      return `conic-gradient(${segments.join(', ')})`;
    }
    
    
    
    function renderPollCloseButton(state, extraClass = '') {
      if (!state.canClose) return '';
      return `<button type="button" class="poll-close-btn${extraClass ? ` ${extraClass}` : ''}" data-poll-close="${state.messageId}" ${state.poll.is_closed || state.interactionLocked ? 'disabled' : ''}>Close</button>`;
    }
    
    
    
    function renderPollCompactFooter(state, extraClass = '') {
      const meta = getPollCompactFooterMeta(state?.poll);
      const closeButton = renderPollCloseButton(state);
      if (!meta && !closeButton) return '';
      return `
        <div class="poll-card-footer poll-card-footer--minimal${extraClass ? ` ${extraClass}` : ''}">
          ${meta ? `<span class="poll-card-footer-meta is-${meta.tone}">${esc(meta.label)}</span>` : ''}
          ${closeButton}
        </div>
      `;
    }
    
    
    
    function renderPollVotersButton(state, option, label = 'View voters') {
      if (!state.poll.show_voters) return '<span></span>';
      return `<button
        type="button"
        class="poll-option-voters"
        data-poll-voters="${state.messageId}"
        data-poll-option-id="${Number(option.id)}"
        ${state.preview || option.voteCount === 0 ? 'disabled' : ''}
      >${label}</button>`;
    }
    
    
    
    function renderPulseInlineVoterAvatar(voter, { placeholder = false, messageId = 0, optionId = 0 } = {}) {
      const background = esc(voter?.avatar_color || '#6f7f95');
      const name = getPulseVoterDisplayName(voter);
      const title = placeholder ? '' : esc(name);
      const avatarHtml = !placeholder && voter?.avatar_url
        ? `<span class="poll-pulse-voter-avatar" style="--poll-inline-avatar-bg:${background};" title="${title}">
            <img class="avatar-img" src="${esc(voter.avatar_url)}" alt="${title}" loading="lazy" onerror="this.remove()">
          </span>`
        : `<span class="poll-pulse-voter-avatar${placeholder ? ' poll-pulse-voter-avatar--placeholder' : ''}" style="--poll-inline-avatar-bg:${background};"${title ? ` title="${title}"` : ''}>${placeholder ? '' : esc(initials(voter?.display_name || voter?.username || 'V'))}</span>`;
      if (placeholder) {
        return `<span class="poll-pulse-voter-entry">${avatarHtml}</span>`;
      }
      const voterId = Number(voter?.id || 0);
      const popoverOpen = Boolean(
        activePulseVoterPopover &&
        Number(activePulseVoterPopover.messageId) === Number(messageId) &&
        Number(activePulseVoterPopover.optionId) === Number(optionId) &&
        Number(activePulseVoterPopover.voterId) === voterId
      );
      return `
        <span class="poll-pulse-voter-entry">
          <button
            type="button"
            class="poll-pulse-voter-avatar-btn"
            data-poll-voter-avatar="${voterId}"
            data-poll-option-id="${Number(optionId)}"
            data-poll-voter-id="${voterId}"
            aria-label="${title}"
            title="${title}"
          >
            ${avatarHtml}
          </button>
          ${popoverOpen ? `<span class="poll-pulse-voter-popover hidden" data-poll-voter-popover data-poll-option-id="${Number(optionId)}" data-poll-voter-id="${voterId}">${esc(name)}</span>` : ''}
        </span>
      `;
    }
    
    
    
    function renderPulseInlineVoterStack(voters = [], totalCount = 0, { preview = false, messageId = 0, optionId = 0 } = {}) {
      const resolvedTotal = Math.max(0, Number(totalCount || voters.length || 0));
      if (resolvedTotal <= 0) return '';
      const overflow = Math.max(0, resolvedTotal - PULSE_INLINE_VOTER_LIMIT);
      const canExpand = overflow > 0;
      const expanded = !preview && canExpand && isPulseVoterOptionExpanded(messageId, optionId);
      const visible = preview || !expanded
        ? (Array.isArray(voters) ? voters : []).slice(0, PULSE_INLINE_VOTER_LIMIT)
        : (Array.isArray(voters) ? voters : []);
      const label = resolvedTotal === 1 ? '1 voter' : `${resolvedTotal} voters`;
      const toggleHtml = canExpand
        ? (
          preview
            ? `<span class="poll-pulse-voter-more is-static" aria-hidden="true">+${overflow}</span>`
            : `<button
                type="button"
                class="poll-pulse-voter-more${expanded ? ' is-expanded' : ''}"
                data-poll-voter-more="${pulseInlineVotersCacheKey(messageId, optionId)}"
                data-poll-option-id="${Number(optionId)}"
                aria-expanded="${expanded ? 'true' : 'false'}"
                aria-label="${expanded ? `Collapse ${overflow} extra voters` : `Show ${overflow} more voters`}"
              >${expanded ? `&minus;${overflow}` : `+${overflow}`}</button>`
        )
        : '';
      return `
        <span class="poll-pulse-voter-stack${expanded ? ' is-expanded' : ''}" aria-label="${esc(label)}">
          ${visible.map((voter) => renderPulseInlineVoterAvatar(voter, { placeholder: preview || !!voter?.placeholder, messageId, optionId })).join('')}
          ${toggleHtml}
        </span>
      `;
    }
    
    
    
    function buildPulsePreviewVoters(totalCount = 0) {
      const resolvedTotal = Math.max(0, Number(totalCount || 0));
      return Array.from({ length: Math.min(resolvedTotal, PULSE_INLINE_VOTER_LIMIT) }, (_, index) => ({
        placeholder: true,
        avatar_color: PULSE_PREVIEW_AVATAR_COLORS[index % PULSE_PREVIEW_AVATAR_COLORS.length],
      }));
    }
    
    
    
    function renderPulseInlineVoterSummaryContent({ messageId = 0, poll = null, option = null, preview = false } = {}) {
      const voteCount = Math.max(0, Number((option?.voteCount ?? option?.vote_count) || 0));
      const fallbackLabel = esc(option?.voterLabel || (voteCount === 1 ? '1 voter' : `${voteCount} voters`));
      if (!poll || !option) return `<span class="poll-pulse-voter-count">${fallbackLabel}</span>`;
      if (!poll.show_voters) {
        return `<span class="poll-pulse-voter-count">${fallbackLabel}</span>`;
      }
      if (preview) {
        const previewVoters = buildPulsePreviewVoters(voteCount);
        return previewVoters.length
          ? renderPulseInlineVoterStack(previewVoters, voteCount, { preview: true, messageId, optionId: option.id })
          : `<span class="poll-pulse-voter-count">${fallbackLabel}</span>`;
      }
      const cachedVoters = pulseInlineVotersCache.get(pulseInlineVotersCacheKey(messageId, option.id));
      if (Array.isArray(cachedVoters) && cachedVoters.length) {
        return renderPulseInlineVoterStack(cachedVoters, voteCount, { messageId, optionId: option.id });
      }
      return `<span class="poll-pulse-voter-count">${fallbackLabel}</span>`;
    }
    
    
    
    function renderPulseInlineVoterSummary(state, option) {
      const messageId = state.preview ? 0 : state.messageId;
      const key = state.preview ? '' : pulseInlineVotersCacheKey(messageId, option.id);
      return `<span class="poll-pulse-voter-summary"${key ? ` data-poll-inline-voters="${key}" data-poll-option-id="${Number(option.id)}"` : ''}>
        ${renderPulseInlineVoterSummaryContent({ messageId, poll: state.poll, option, preview: state.preview })}
      </span>`;
    }
    
    
    
    function refreshPulseInlineVoterSlots(messageId, optionId = null) {
      if (!messagesEl) return;
      const resolvedMessageId = Number(messageId || 0);
      if (!resolvedMessageId) return;
      const selector = optionId
        ? `[data-poll-inline-voters="${pulseInlineVotersCacheKey(resolvedMessageId, optionId)}"]`
        : `[data-poll-inline-voters^="${resolvedMessageId}:"]`;
      messagesEl.querySelectorAll(selector).forEach((slot) => {
        const row = slot.closest('.msg-row');
        const poll = normalizePoll(row?.__messageData?.poll);
        const resolvedOptionId = Number(optionId || slot.dataset.pollOptionId || 0);
        const option = (poll?.options || []).find((item) => Number(item.id) === resolvedOptionId);
        if (!poll || !isPulsePoll(poll) || !option) return;
        slot.innerHTML = renderPulseInlineVoterSummaryContent({
          messageId: resolvedMessageId,
          poll,
          option,
          preview: false,
        });
        bindPulseInlineVoterControls(slot, resolvedMessageId);
        if (
          activePulseVoterPopover &&
          Number(activePulseVoterPopover.messageId) === resolvedMessageId &&
          Number(activePulseVoterPopover.optionId) === resolvedOptionId
        ) {
          mountPulseVoterPopover(activePulseVoterPopover);
        }
      });
    }
    
    
    
    function ensurePulseInlineVoters(messageId, optionId) {
      const resolvedMessageId = Number(messageId || 0);
      const resolvedOptionId = Number(optionId || 0);
      if (!resolvedMessageId || !resolvedOptionId) return Promise.resolve([]);
      const cacheKey = pulseInlineVotersCacheKey(resolvedMessageId, resolvedOptionId);
      if (pulseInlineVotersCache.has(cacheKey)) {
        refreshPulseInlineVoterSlots(resolvedMessageId, resolvedOptionId);
        return Promise.resolve(pulseInlineVotersCache.get(cacheKey) || []);
      }
      const revision = getPulseInlineVotersRevision(resolvedMessageId);
      const pendingKey = `${cacheKey}:${revision}`;
      if (pulseInlineVotersPending.has(pendingKey)) {
        return pulseInlineVotersPending.get(pendingKey);
      }
      const request = api(`/api/messages/${resolvedMessageId}/poll-voters?optionId=${resolvedOptionId}`)
        .then((data) => {
          const voters = Array.isArray(data?.voters) ? data.voters : [];
          if (getPulseInlineVotersRevision(resolvedMessageId) !== revision) return voters;
          pulseInlineVotersCache.set(cacheKey, voters);
          refreshPulseInlineVoterSlots(resolvedMessageId, resolvedOptionId);
          return voters;
        })
        .catch(() => [])
        .finally(() => {
          pulseInlineVotersPending.delete(pendingKey);
        });
      pulseInlineVotersPending.set(pendingKey, request);
      return request;
    }
    
    
    
    function hydratePulseInlineVoters(row) {
      const messageId = Number(row?.dataset?.msgId || row?.__messageData?.id || 0);
      const poll = normalizePoll(row?.__messageData?.poll);
      if (!row || !messageId || !poll || !isPulsePoll(poll) || !poll.show_voters) return;
      if (!row.isConnected) {
        if (!row.__pulseInlineHydrateScheduled) {
          row.__pulseInlineHydrateScheduled = true;
          requestAnimationFrame(() => {
            row.__pulseInlineHydrateScheduled = false;
            hydratePulseInlineVoters(row);
          });
        }
        return;
      }
      (poll.options || []).forEach((option) => {
        if (Math.max(0, Number(option.vote_count || 0)) <= 0) return;
        ensurePulseInlineVoters(messageId, Number(option.id)).catch(() => {});
      });
    }
    
    
    
    function renderPulsePollCard(state) {
      const optionsHtml = state.options.map((option) => `
        <div class="poll-pulse-option${option.selected ? ' selected' : ''}" style="--poll-option-accent:${option.accentVar};">
          <span class="poll-pulse-option-glow"></span>
          <div
            class="poll-pulse-option-main"
            data-poll-vote="${state.messageId}"
            data-poll-option-id="${Number(option.id)}"
            role="button"
            tabindex="${state.poll.is_closed || state.interactionLocked ? '-1' : '0'}"
            aria-disabled="${state.poll.is_closed || state.interactionLocked ? 'true' : 'false'}"
          >
            <span class="poll-pulse-option-text">${esc(option.text)}</span>
            <span class="poll-pulse-progress" aria-hidden="true">
              <span class="poll-pulse-progress-track">
                <span class="poll-pulse-progress-fill" style="width:${option.percentage}%"></span>
                <span class="poll-pulse-progress-percent">${option.percentage}%</span>
              </span>
            </span>
            ${renderPulseInlineVoterSummary(state, option)}
          </div>
        </div>
      `).join('');
    
      return `
        <div class="poll-card poll-card--pulse${state.preview ? ' is-preview' : ''}${state.liveUpdate ? ' is-live-update' : ''}">
          <div class="poll-pulse-options">${optionsHtml}</div>
          ${renderPollCompactFooter(state)}
        </div>
      `;
    }
    
    
    
    function renderStackPollCard(state) {
      const optionsHtml = state.options.map((option) => `
        <div class="poll-stack-option${option.selected ? ' selected' : ''}" style="--poll-option-accent:${option.accentVar};">
          <button
            type="button"
            class="poll-stack-option-main"
            data-poll-vote="${state.messageId}"
            data-poll-option-id="${Number(option.id)}"
            ${state.poll.is_closed || state.interactionLocked ? 'disabled' : ''}
          >
            <span class="poll-stack-option-top">
              <span class="poll-stack-option-left">
                <span class="poll-stack-option-dot"></span>
                <span class="poll-stack-option-text">${esc(option.text)}</span>
              </span>
              <span class="poll-stack-option-right">
                <span class="poll-stack-option-percent">${option.percentage}%</span>
                <span class="poll-stack-option-check${state.poll.allows_multiple ? ' multi' : ''}">${option.selected ? option.mark : ''}</span>
              </span>
            </span>
            <span class="poll-stack-option-bar"><i style="width:${option.percentage}%"></i></span>
          </button>
          <div class="poll-stack-option-footer">
            <span class="poll-stat-chip">${option.voteLabel}</span>
            ${renderPollVotersButton(state, option)}
          </div>
        </div>
      `).join('');
    
      return `
        <div class="poll-card poll-card--stack${state.preview ? ' is-preview' : ''}${state.liveUpdate ? ' is-live-update' : ''}">
          <div class="poll-stack-options">${optionsHtml}</div>
          ${renderPollCompactFooter(state)}
        </div>
      `;
    }
    
    
    
    function renderOrbitPollCard(state) {
      const orbitGradient = buildPollOrbitGradient(state.options, state.totalVotes);
      const optionsHtml = state.options.map((option) => `
        <div class="poll-orbit-option${option.selected ? ' selected' : ''}" style="--poll-option-accent:${option.accentVar};">
          <button
            type="button"
            class="poll-orbit-option-main"
            data-poll-vote="${state.messageId}"
            data-poll-option-id="${Number(option.id)}"
            ${state.poll.is_closed || state.interactionLocked ? 'disabled' : ''}
          >
            <span class="poll-orbit-option-swatch">${option.index + 1}</span>
            <span class="poll-orbit-option-copy">
              <strong>${esc(option.text)}</strong>
              <small>${option.voteLabel}</small>
            </span>
            <span class="poll-orbit-option-side">
              <em>${option.percentage}%</em>
              <span class="poll-orbit-option-check${state.poll.allows_multiple ? ' multi' : ''}" aria-hidden="true"></span>
            </span>
          </button>
          <span class="poll-orbit-option-bar"><i style="width:${option.percentage}%"></i></span>
          ${state.poll.show_voters ? `<div class="poll-orbit-option-footer">${renderPollVotersButton(state, option, 'Voters')}</div>` : ''}
        </div>
      `).join('');
    
      return `
        <div class="poll-card poll-card--orbit${state.preview ? ' is-preview' : ''}${state.liveUpdate ? ' is-live-update' : ''}">
          <div class="poll-orbit-hero poll-orbit-hero--solo">
            <div class="poll-orbit-chart" style="--poll-orbit-chart:${orbitGradient};">
              <div class="poll-orbit-chart-center">
                <strong>${state.totalVotes || 0}</strong>
                <small>${state.totalVotes === 1 ? 'vote' : 'votes'}</small>
              </div>
            </div>
          </div>
          <div class="poll-orbit-options">${optionsHtml}</div>
          ${renderPollCompactFooter(state)}
        </div>
      `;
    }
    
    
    
    function resetPollVotersModal() {
      pollVotersState = null;
      setPollStyleSurface(pollVotersModal, 'pulse');
      if (pollVotersTitle) pollVotersTitle.textContent = 'Voters';
      if (pollVotersMeta) {
        pollVotersMeta.innerHTML = '';
        pollVotersMeta.classList.add('hidden');
      }
      if (pollVotersStatus) {
        pollVotersStatus.textContent = '';
        pollVotersStatus.classList.remove('is-error', 'is-success');
      }
      if (pollVotersList) pollVotersList.innerHTML = '';
    }
    
    
    
    async function openPollVotersModal(messageId, optionId) {
      const row = messagesEl.querySelector(`[data-msg-id="${messageId}"]`);
      const msg = row?.__messageData || {};
      const poll = normalizePoll(msg.poll);
      const option = (poll?.options || []).find((item) => Number(item.id) === Number(optionId));
      const optionIndex = Math.max(0, (poll?.options || []).findIndex((item) => Number(item.id) === Number(optionId)));
      if (!poll || !poll.show_voters || !option) return;
      setPollStyleSurface(pollVotersModal, poll.style);
      pollVotersState = { messageId: Number(messageId), optionId: Number(optionId) };
      if (pollVotersTitle) pollVotersTitle.textContent = `Voters: ${option.text}`;
      if (pollVotersMeta) {
        pollVotersMeta.innerHTML = `
          <span class="poll-voters-chip" style="--poll-option-accent:${pollAccentVar(optionIndex)};">${Math.max(0, Number(option.vote_count || 0))} votes</span>
          <span class="poll-voters-chip">${poll.allows_multiple ? 'Multiple choice' : 'Single choice'}</span>
          <span class="poll-voters-chip">${esc(formatPollDeadline(poll))}</span>
        `;
        pollVotersMeta.classList.remove('hidden');
      }
      if (pollVotersStatus) {
        pollVotersStatus.textContent = 'Loading...';
        pollVotersStatus.classList.remove('is-error', 'is-success');
      }
      if (pollVotersList) pollVotersList.innerHTML = '';
      actions.syncChatAreaMetrics();
      actions.openModal('pollVotersModal');
      try {
        const data = await api(`/api/messages/${messageId}/poll-voters?optionId=${optionId}`);
        if (!pollVotersState || pollVotersState.messageId !== Number(messageId) || pollVotersState.optionId !== Number(optionId)) return;
        const voters = Array.isArray(data?.voters) ? data.voters : [];
        if (pollVotersStatus) pollVotersStatus.textContent = voters.length ? '' : 'No voters yet';
        if (pollVotersList) {
          pollVotersList.innerHTML = voters.map((voter) => `
            <div class="poll-voter-item">
              ${actions.avatarHtml(voter.display_name, voter.avatar_color, voter.avatar_url, 32)}
              <div class="poll-voter-meta">
                <span class="poll-voter-name">${esc(voter.display_name || voter.username || 'User')}</span>
                <span class="poll-voter-time">${esc(voter.voted_at ? `${formatDate(voter.voted_at)} ${formatTime(voter.voted_at)}` : '')}</span>
              </div>
            </div>
          `).join('') || '<div class="settings-hint">No voters yet</div>';
        }
      } catch (error) {
        if (pollVotersStatus) {
          pollVotersStatus.textContent = error.message || 'Could not load voters';
          pollVotersStatus.classList.add('is-error');
        }
      }
    }
    
    
    
    function renderPollCard(message, options = {}) {
      const state = buildPollRenderState(message, options);
      if (!state) return '';
      const style = normalizePollStyle(state.poll?.style);
      if (style === 'stack') return renderStackPollCard(state);
      if (style === 'orbit') return renderOrbitPollCard(state);
      return renderPulsePollCard(state);
    }
    
    

    function bindPollControls(row) {
      const messageId = Number(row?.dataset?.msgId || row?.__messageData?.id || 0);
      if (!row || !messageId) return;
      row.querySelectorAll('[data-poll-vote]').forEach((control) => {
        const activateVote = (e) => {
          if (control.matches(':disabled') || control.getAttribute('aria-disabled') === 'true') return;
          e.stopPropagation();
          togglePollVote(messageId, Number(control.dataset.pollOptionId || 0));
        };
        control.addEventListener('click', activateVote);
        if (!(control instanceof HTMLButtonElement)) {
          control.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            activateVote(e);
          });
        }
      });
      row.querySelectorAll('[data-poll-voters]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openPollVotersModal(messageId, Number(btn.dataset.pollOptionId || 0));
        });
      });
      bindPulseInlineVoterControls(row, messageId);
      const pollCloseBtn = row.querySelector('[data-poll-close]');
      if (pollCloseBtn) {
        pollCloseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closePollMessage(messageId);
        });
      }
    }

    return {
      normalizePoll,
      isPollMessage,
      isPulsePoll,
      pulseInlineVotersCacheKey,
      getPulseInlineVotersRevision,
      invalidatePulseInlineVotersForMessage,
      getPulseVoterDisplayName,
      isPulseVoterOptionExpanded,
      getPulseVoterPopoverElement,
      schedulePulseVoterPopoverAutoHide,
      mountPulseVoterPopover,
      bindPollControls,
      bindPulseInlineVoterControls,
      togglePulseVoterOptionExpanded,
      togglePulseVoterPopover,
      getPollCompactFooterMeta,
      canClosePollMessage,
      buildOptimisticPollState,
      nextPollVoteSelection,
      hydratePulseInlineVoters,
      clearActivePulseVoterPopover,
      clearActivePulseVoterPopoverForMessage,
      resetPollVotersModal,
      openPollVotersModal,
      renderPollCard,
      pollAccentVar,
      buildPollRenderState,
      buildPollOrbitGradient,
      renderPollCloseButton,
      renderPollCompactFooter,
      renderPollVotersButton,
      renderPulseInlineVoterAvatar,
      renderPulseInlineVoterStack,
      buildPulsePreviewVoters,
      renderPulseInlineVoterSummaryContent,
      renderPulseInlineVoterSummary,
      refreshPulseInlineVoterSlots,
      ensurePulseInlineVoters,
      renderPulsePollCard,
      renderStackPollCard,
      renderOrbitPollCard,
      applyPollUpdate,
      replaceRenderedPollCard,
      togglePollVote,
      closePollMessage,
      getState: () => ({ pollVotePending, pollClosePending, pollVotersState, pulseInlineVotersCache, pulseInlineVotersPending, pulseInlineVotersRevision, expandedPulseVoterOptions, activePulseVoterPopover }),
    };
  }

  messagesRoot.polls = {
    createPollMessageRenderer,
  };
})();
