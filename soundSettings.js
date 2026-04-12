const DEFAULT_SOUND_SETTINGS = {
  sounds_enabled: true,
  volume: 55,
  play_send: true,
  play_incoming: true,
  play_notifications: true,
  play_reactions: true,
  play_invites: true,
  play_voice: true,
  play_mentions: true,
};

function boolValue(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return !!value;
  if (value === '0' || value === '1') return value === '1';
  return fallback;
}

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SOUND_SETTINGS.volume;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function normalizeSoundSettings(row) {
  if (!row) return { ...DEFAULT_SOUND_SETTINGS };
  return {
    sounds_enabled: !!row.sounds_enabled,
    volume: clampVolume(row.volume),
    play_send: !!row.play_send,
    play_incoming: !!row.play_incoming,
    play_notifications: !!row.play_notifications,
    play_reactions: !!row.play_reactions,
    play_invites: !!row.play_invites,
    play_voice: !!row.play_voice,
    play_mentions: row.play_mentions == null ? true : !!row.play_mentions,
  };
}

function createSoundSettingsFeature({ app, db, auth }) {
  const getStmt = db.prepare('SELECT * FROM user_sound_settings WHERE user_id=?');
  const upsertStmt = db.prepare(`
    INSERT INTO user_sound_settings (
      user_id, sounds_enabled, volume, play_send, play_incoming, play_notifications,
      play_reactions, play_invites, play_voice, play_mentions, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      sounds_enabled=excluded.sounds_enabled,
      volume=excluded.volume,
      play_send=excluded.play_send,
      play_incoming=excluded.play_incoming,
      play_notifications=excluded.play_notifications,
      play_reactions=excluded.play_reactions,
      play_invites=excluded.play_invites,
      play_voice=excluded.play_voice,
      play_mentions=excluded.play_mentions,
      updated_at=datetime('now')
  `);

  function getSettings(userId) {
    return normalizeSoundSettings(getStmt.get(userId));
  }

  function saveSettings(userId, input = {}) {
    const current = getSettings(userId);
    const next = {
      sounds_enabled: boolValue(input.sounds_enabled, current.sounds_enabled),
      volume: Object.prototype.hasOwnProperty.call(input, 'volume') ? clampVolume(input.volume) : current.volume,
      play_send: boolValue(input.play_send, current.play_send),
      play_incoming: boolValue(input.play_incoming, current.play_incoming),
      play_notifications: boolValue(input.play_notifications, current.play_notifications),
      play_reactions: boolValue(input.play_reactions, current.play_reactions),
      play_invites: boolValue(input.play_invites, current.play_invites),
      play_voice: boolValue(input.play_voice, current.play_voice),
      play_mentions: boolValue(input.play_mentions, current.play_mentions),
    };
    upsertStmt.run(
      userId,
      next.sounds_enabled ? 1 : 0,
      next.volume,
      next.play_send ? 1 : 0,
      next.play_incoming ? 1 : 0,
      next.play_notifications ? 1 : 0,
      next.play_reactions ? 1 : 0,
      next.play_invites ? 1 : 0,
      next.play_voice ? 1 : 0,
      next.play_mentions ? 1 : 0
    );
    return getSettings(userId);
  }

  app.get('/api/sound-settings', auth, (req, res) => {
    res.json({ settings: getSettings(req.user.id) });
  });

  app.put('/api/sound-settings', auth, (req, res) => {
    res.json({ settings: saveSettings(req.user.id, req.body || {}) });
  });

  return { getSettings, saveSettings };
}

module.exports = { createSoundSettingsFeature, DEFAULT_SOUND_SETTINGS, normalizeSoundSettings };
