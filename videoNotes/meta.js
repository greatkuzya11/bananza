function parseShapeSnapshot(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    const version = typeof parsed.version === 'string' ? parsed.version.trim() : '';
    const label = typeof parsed.label === 'string' ? parsed.label.trim() : '';
    const viewBox = typeof parsed.viewBox === 'string' ? parsed.viewBox.trim() : '';
    const path = typeof parsed.path === 'string' ? parsed.path.trim() : '';
    if (!id || !viewBox || !path || !isSafePathData(path)) return null;
    const next = {
      id,
      version: version || '1',
      label: label || id,
      viewBox,
      path,
      clipPadding: Number.isFinite(Number(parsed.clipPadding)) ? Number(parsed.clipPadding) : 0,
    };
    if (typeof parsed.previewTransform === 'string' && parsed.previewTransform.trim()) {
      next.previewTransform = parsed.previewTransform.trim();
    }
    return next;
  } catch {
    return null;
  }
}

function isSafePathData(value) {
  const source = String(value || '').trim();
  if (!source) return false;
  if (/[<>"'`\u2026]/.test(source)) return false;
  return /^[MmZzLlHhVvCcSsQqTtAaEe0-9+\-.,\s]+$/.test(source);
}

function normalizeShapeSnapshot(value) {
  const parsed = parseShapeSnapshot(value);
  return parsed ? JSON.stringify(parsed) : null;
}

function applyVideoNoteFields(message, voiceRow) {
  const next = { ...message };
  const noteKind = voiceRow ? String(voiceRow.note_kind || 'voice') : null;
  const shapeSnapshot = voiceRow ? parseShapeSnapshot(voiceRow.shape_snapshot) : null;

  next.media_note_kind = noteKind;
  next.media_note_duration_ms = voiceRow ? voiceRow.duration_ms : null;
  next.is_video_note = noteKind === 'video_note';
  next.video_note_shape_id = voiceRow ? (voiceRow.shape_id || shapeSnapshot?.id || null) : null;
  next.video_note_shape_snapshot = shapeSnapshot;
  next.video_note_shape_snapshot_raw = voiceRow ? (voiceRow.shape_snapshot || null) : null;
  next.transcription_file_id = voiceRow ? (voiceRow.transcription_file_id || null) : null;
  return next;
}

module.exports = {
  applyVideoNoteFields,
  normalizeShapeSnapshot,
  parseShapeSnapshot,
};
