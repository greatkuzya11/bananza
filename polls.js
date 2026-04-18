const POLL_CLOSE_PRESETS = Object.freeze({
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
});
const POLL_STYLES = new Set(['pulse', 'stack', 'orbit']);

function normalizePollStyle(style) {
  return POLL_STYLES.has(style) ? style : 'pulse';
}

function toDbDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseDbDate(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  const normalized = source.includes('T') ? source : source.replace(' ', 'T');
  const withZone = /[zZ]$|[+\-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const time = Date.parse(withZone);
  return Number.isNaN(time) ? null : time;
}

function intId(value) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(intId).filter(Boolean))];
}

function createPollService({ db, sendToUser }) {
  const pollStateStmt = db.prepare(`
    SELECT
      p.message_id,
      p.created_by,
      p.style,
      p.allows_multiple,
      p.show_voters,
      p.closes_at,
      p.closed_at,
      p.closed_by,
      p.created_at,
      m.chat_id,
      m.user_id as message_user_id,
      c.created_by as chat_created_by
    FROM polls p
    JOIN messages m ON m.id=p.message_id
    JOIN chats c ON c.id=m.chat_id
    WHERE p.message_id=?
  `);
  const chatMembersStmt = db.prepare('SELECT user_id FROM chat_members WHERE chat_id=?');
  const insertPollStmt = db.prepare(`
    INSERT INTO polls(message_id, created_by, style, allows_multiple, show_voters, closes_at)
    VALUES(?,?,?,?,?,?)
  `);
  const insertOptionStmt = db.prepare(`
    INSERT INTO poll_options(message_id, position, text)
    VALUES(?,?,?)
  `);
  const closePollStmt = db.prepare(`
    UPDATE polls
    SET closed_at=datetime('now'),
        closed_by=?
    WHERE message_id=? AND closed_at IS NULL
  `);
  const deleteVotesByUserStmt = db.prepare('DELETE FROM poll_votes WHERE message_id=? AND user_id=?');
  const insertVoteStmt = db.prepare(`
    INSERT OR IGNORE INTO poll_votes(message_id, option_id, user_id)
    VALUES(?,?,?)
  `);
  const deletePollVotesStmt = db.prepare('DELETE FROM poll_votes WHERE message_id=?');
  const deletePollOptionsStmt = db.prepare('DELETE FROM poll_options WHERE message_id=?');
  const deletePollStmt = db.prepare('DELETE FROM polls WHERE message_id=?');
  const votersStmt = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.avatar_color,
      u.avatar_url,
      COALESCE(u.is_ai_bot, 0) as is_ai_bot,
      pv.created_at as voted_at
    FROM poll_votes pv
    JOIN users u ON u.id=pv.user_id
    WHERE pv.message_id=? AND pv.option_id=?
    ORDER BY pv.created_at ASC, pv.user_id ASC
  `);

  function pollStateForMessage(messageId) {
    return pollStateStmt.get(messageId) || null;
  }

  function buildPollPayloads(messageIds, viewerUserId = null) {
    const ids = uniqueIds(messageIds);
    if (ids.length === 0) return new Map();

    const placeholders = ids.map(() => '?').join(',');
    const pollRows = db.prepare(`
      SELECT
        p.message_id,
        p.created_by,
        p.style,
        p.allows_multiple,
        p.show_voters,
        p.closes_at,
        p.closed_at,
        p.closed_by,
        p.created_at,
        m.chat_id,
        c.created_by as chat_created_by
      FROM polls p
      JOIN messages m ON m.id=p.message_id
      JOIN chats c ON c.id=m.chat_id
      WHERE p.message_id IN (${placeholders})
      ORDER BY p.message_id ASC
    `).all(...ids);
    if (pollRows.length === 0) return new Map();

    const optionRows = db.prepare(`
      SELECT id, message_id, position, text
      FROM poll_options
      WHERE message_id IN (${placeholders})
      ORDER BY message_id ASC, position ASC, id ASC
    `).all(...ids);
    const totalRows = db.prepare(`
      SELECT message_id, COUNT(*) as total_votes, COUNT(DISTINCT user_id) as total_voters
      FROM poll_votes
      WHERE message_id IN (${placeholders})
      GROUP BY message_id
    `).all(...ids);
    const countRows = db.prepare(`
      SELECT message_id, option_id, COUNT(*) as vote_count
      FROM poll_votes
      WHERE message_id IN (${placeholders})
      GROUP BY message_id, option_id
    `).all(...ids);
    const myVoteRows = intId(viewerUserId)
      ? db.prepare(`
          SELECT message_id, option_id
          FROM poll_votes
          WHERE user_id=? AND message_id IN (${placeholders})
          ORDER BY message_id ASC, option_id ASC
        `).all(intId(viewerUserId), ...ids)
      : [];

    const optionsByMessage = new Map();
    for (const row of optionRows) {
      const list = optionsByMessage.get(Number(row.message_id)) || [];
      list.push(row);
      optionsByMessage.set(Number(row.message_id), list);
    }

    const totalsByMessage = new Map(totalRows.map((row) => [
      Number(row.message_id),
      {
        total_votes: Number(row.total_votes) || 0,
        total_voters: Number(row.total_voters) || 0,
      },
    ]));
    const countsByKey = new Map(countRows.map((row) => [
      `${Number(row.message_id)}:${Number(row.option_id)}`,
      Number(row.vote_count) || 0,
    ]));
    const myVotesByMessage = new Map();
    for (const row of myVoteRows) {
      const key = Number(row.message_id);
      const list = myVotesByMessage.get(key) || [];
      list.push(Number(row.option_id));
      myVotesByMessage.set(key, list);
    }

    const result = new Map();
    for (const row of pollRows) {
      const messageId = Number(row.message_id);
      const totals = totalsByMessage.get(messageId) || { total_votes: 0, total_voters: 0 };
      const myOptionIds = myVotesByMessage.get(messageId) || [];
      const optionIdSet = new Set(myOptionIds);
      const options = (optionsByMessage.get(messageId) || []).map((option) => ({
        id: Number(option.id),
        text: option.text,
        position: Number(option.position) || 0,
        vote_count: countsByKey.get(`${messageId}:${Number(option.id)}`) || 0,
        voted_by_me: optionIdSet.has(Number(option.id)),
      }));
      result.set(messageId, {
        created_by: Number(row.created_by) || 0,
        closed_by: row.closed_by == null ? null : Number(row.closed_by),
        style: normalizePollStyle(row.style),
        allows_multiple: Number(row.allows_multiple) !== 0,
        show_voters: Number(row.show_voters) !== 0,
        closes_at: row.closes_at || null,
        closed_at: row.closed_at || null,
        created_at: row.created_at || null,
        is_closed: !!row.closed_at,
        total_votes: totals.total_votes,
        total_voters: totals.total_voters,
        my_option_ids: myOptionIds,
        options,
      });
    }

    return result;
  }

  function attachPollMetadata(messages, viewerUserId = null, { ensureClosed = true, broadcastOnClose = false } = {}) {
    if (!Array.isArray(messages) || messages.length === 0) return [];
    const ids = uniqueIds(messages.map((message) => message?.id));
    if (ensureClosed && ids.length) {
      syncExpiredPolls(ids, { broadcast: broadcastOnClose });
    }
    const payloads = buildPollPayloads(ids, viewerUserId);
    return messages.map((message) => {
      const next = { ...message };
      next.poll = payloads.get(Number(message.id)) || null;
      return next;
    });
  }

  function syncExpiredPolls(messageIds, { broadcast = false } = {}) {
    const ids = uniqueIds(messageIds);
    if (!ids.length) return [];
    const now = Date.now();
    const expired = ids
      .map((messageId) => pollStateForMessage(messageId))
      .filter((row) => row && !row.closed_at && row.closes_at && (() => {
        const closesAt = parseDbDate(row.closes_at);
        return closesAt != null && closesAt <= now;
      })());
    if (!expired.length) return [];

    db.transaction((rows) => {
      rows.forEach((row) => closePollStmt.run(null, row.message_id));
    })(expired);

    if (broadcast) {
      expired.forEach((row) => broadcastPollUpdated(row.chat_id, row.message_id));
    }
    return expired.map((row) => Number(row.message_id));
  }

  function getPollPayload(messageId, viewerUserId = null, { ensureClosed = true, broadcastOnClose = false } = {}) {
    const id = intId(messageId);
    if (!id) return null;
    if (ensureClosed) syncExpiredPolls([id], { broadcast: broadcastOnClose });
    return buildPollPayloads([id], viewerUserId).get(id) || null;
  }

  function createPollData({ messageId, createdBy, style = 'pulse', allowsMultiple = false, showVoters = false, closesAt = null, options = [] } = {}) {
    const id = intId(messageId);
    const authorId = intId(createdBy);
    const normalizedOptions = (Array.isArray(options) ? options : []).map((text) => String(text || '').trim()).filter(Boolean);
    if (!id || !authorId || normalizedOptions.length < 2) {
      throw new Error('Invalid poll payload');
    }
    db.transaction(() => {
      insertPollStmt.run(id, authorId, normalizePollStyle(style), allowsMultiple ? 1 : 0, showVoters ? 1 : 0, closesAt || null);
      normalizedOptions.forEach((text, index) => {
        insertOptionStmt.run(id, index, text);
      });
    })();
    return id;
  }

  function replaceVotes(messageId, userId, optionIds = []) {
    const id = intId(messageId);
    const voterId = intId(userId);
    if (!id || !voterId) throw new Error('Invalid vote payload');

    const state = pollStateForMessage(id);
    if (!state) {
      const error = new Error('Poll not found');
      error.code = 'not_found';
      throw error;
    }
    syncExpiredPolls([id], { broadcast: true });
    const fresh = pollStateForMessage(id);
    if (!fresh) {
      const error = new Error('Poll not found');
      error.code = 'not_found';
      throw error;
    }
    if (fresh.closed_at) {
      const error = new Error('Poll is closed');
      error.code = 'closed';
      throw error;
    }

    const normalizedOptionIds = uniqueIds(optionIds);
    if (!Number(fresh.allows_multiple) && normalizedOptionIds.length > 1) {
      const error = new Error('Single-choice poll accepts only one option');
      error.code = 'too_many';
      throw error;
    }

    const optionRows = db.prepare('SELECT id FROM poll_options WHERE message_id=? ORDER BY position ASC, id ASC').all(id);
    const allowed = new Set(optionRows.map((row) => Number(row.id)));
    if (normalizedOptionIds.some((optionId) => !allowed.has(optionId))) {
      const error = new Error('Poll option not found');
      error.code = 'bad_option';
      throw error;
    }

    db.transaction(() => {
      deleteVotesByUserStmt.run(id, voterId);
      normalizedOptionIds.forEach((optionId) => {
        insertVoteStmt.run(id, optionId, voterId);
      });
    })();
    return {
      chatId: Number(fresh.chat_id) || 0,
      poll: getPollPayload(id, voterId, { ensureClosed: false }),
    };
  }

  function closePoll(messageId, closedBy = null) {
    const id = intId(messageId);
    if (!id) {
      const error = new Error('Invalid poll');
      error.code = 'invalid';
      throw error;
    }
    syncExpiredPolls([id], { broadcast: false });
    const before = pollStateForMessage(id);
    if (!before) {
      const error = new Error('Poll not found');
      error.code = 'not_found';
      throw error;
    }
    if (!before.closed_at) {
      closePollStmt.run(intId(closedBy) || null, id);
    }
    const after = pollStateForMessage(id);
    return {
      changed: !before.closed_at,
      chatId: Number(after.chat_id) || 0,
      poll: getPollPayload(id, null, { ensureClosed: false }),
    };
  }

  function getVoters(messageId, optionId) {
    const id = intId(messageId);
    const voteOptionId = intId(optionId);
    if (!id || !voteOptionId) return [];
    return votersStmt.all(id, voteOptionId).map((row) => ({
      id: Number(row.id) || 0,
      username: row.username,
      display_name: row.display_name,
      avatar_color: row.avatar_color,
      avatar_url: row.avatar_url,
      is_ai_bot: Number(row.is_ai_bot) || 0,
      voted_at: row.voted_at,
    }));
  }

  function deletePollData(messageId) {
    const id = intId(messageId);
    if (!id) return false;
    db.transaction(() => {
      deletePollVotesStmt.run(id);
      deletePollOptionsStmt.run(id);
      deletePollStmt.run(id);
    })();
    return true;
  }

  function broadcastPollUpdated(chatId, messageId) {
    const resolvedChatId = intId(chatId);
    const resolvedMessageId = intId(messageId);
    if (!resolvedChatId || !resolvedMessageId || typeof sendToUser !== 'function') return;
    const members = chatMembersStmt.all(resolvedChatId);
    members.forEach((member) => {
      const userId = intId(member.user_id);
      if (!userId) return;
      const poll = getPollPayload(resolvedMessageId, userId, { ensureClosed: false });
      if (!poll) return;
      sendToUser(userId, {
        type: 'poll_updated',
        chatId: resolvedChatId,
        messageId: resolvedMessageId,
        poll,
      });
    });
  }

  return {
    createPollData,
    attachPollMetadata,
    broadcastPollUpdated,
    closePoll,
    deletePollData,
    getPollPayload,
    getVoters,
    pollStateForMessage,
    replaceVotes,
    syncExpiredPolls,
  };
}

module.exports = {
  POLL_CLOSE_PRESETS,
  createPollService,
  parseDbDate,
  toDbDate,
};
