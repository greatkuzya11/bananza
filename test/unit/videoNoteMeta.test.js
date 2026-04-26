const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyVideoNoteFields,
  normalizeShapeSnapshot,
  parseShapeSnapshot,
} = require('../../videoNotes/meta');

test('parseShapeSnapshot rejects unsafe path data and normalizes valid snapshots', () => {
  const parsed = parseShapeSnapshot({
    id: 'banana-fat',
    version: '2',
    label: 'Banana',
    viewBox: '0 0 320 220',
    path: 'M0 0 L10 10 Z',
    clipPadding: 6,
  });
  assert.equal(parsed.id, 'banana-fat');
  assert.equal(parsed.version, '2');
  assert.equal(parsed.clipPadding, 6);
  assert.equal(parseShapeSnapshot({ id: 'x', viewBox: '0 0 10 10', path: '<svg>' }), null);
});

test('normalizeShapeSnapshot serializes only valid shape snapshots', () => {
  const normalized = normalizeShapeSnapshot({
    id: 'circle',
    label: 'Circle',
    viewBox: '0 0 320 220',
    path: 'M0 0 L10 10 Z',
  });
  assert.ok(normalized.includes('"id":"circle"'));
  assert.equal(normalizeShapeSnapshot({ id: 'bad', path: '<svg>' }), null);
});

test('applyVideoNoteFields decorates messages with video note metadata', () => {
  const base = { id: 9, text: null };
  const message = applyVideoNoteFields(base, {
    note_kind: 'video_note',
    duration_ms: 1234,
    shape_id: 'circle',
    shape_snapshot: JSON.stringify({
      id: 'circle',
      label: 'Circle',
      viewBox: '0 0 320 220',
      path: 'M0 0 L10 10 Z',
    }),
    transcription_file_id: 77,
  });

  assert.equal(message.is_video_note, true);
  assert.equal(message.media_note_kind, 'video_note');
  assert.equal(message.video_note_shape_id, 'circle');
  assert.equal(message.transcription_file_id, 77);
  assert.equal(message.video_note_shape_snapshot.id, 'circle');
});
