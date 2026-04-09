function applyVoiceFields(message, voiceRow) {
  const next = { ...message };
  if (!voiceRow) {
    next.is_voice_note = false;
    next.voice_duration_ms = null;
    next.voice_sample_rate = null;
    next.transcription_status = null;
    next.transcription_text = null;
    next.transcription_provider = null;
    next.transcription_model = null;
    next.transcription_error = null;
    next.auto_requested = 0;
    return next;
  }

  next.is_voice_note = true;
  next.voice_duration_ms = voiceRow.duration_ms;
  next.voice_sample_rate = voiceRow.sample_rate;
  next.transcription_status = voiceRow.transcription_status;
  next.transcription_text = voiceRow.transcription_text;
  next.transcription_provider = voiceRow.transcription_provider;
  next.transcription_model = voiceRow.transcription_model;
  next.transcription_error = voiceRow.transcription_error;
  next.auto_requested = voiceRow.auto_requested;
  return next;
}

function attachVoiceMetadata(db, messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const ids = messages.map((message) => Number(message.id)).filter(Boolean);
  if (ids.length === 0) return messages.map((message) => applyVoiceFields(message, null));

  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT message_id, duration_ms, sample_rate, transcription_status, transcription_text,
      transcription_provider, transcription_model, transcription_error, auto_requested
    FROM voice_messages
    WHERE message_id IN (${placeholders})
  `).all(...ids);

  const byId = new Map(rows.map((row) => [row.message_id, row]));
  return messages.map((message) => applyVoiceFields(message, byId.get(Number(message.id)) || null));
}

module.exports = { attachVoiceMetadata };
