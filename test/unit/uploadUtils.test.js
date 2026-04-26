const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GENERAL_UPLOAD_LIMIT_BYTES,
  GENERAL_UPLOAD_LIMIT_LABEL,
  classifyUpload,
  isPreviewableFileType,
} = require('../../uploadUtils');

test('classifyUpload keeps previewable media on trusted mime and extension lists', () => {
  assert.equal(classifyUpload({ mimeType: 'image/svg+xml', originalName: 'diagram.svg' }), 'image');
  assert.equal(classifyUpload({ mimeType: 'application/xml', originalName: 'diagram.svg' }), 'image');
  assert.equal(classifyUpload({ mimeType: 'application/octet-stream', originalName: 'photo.avif' }), 'image');
  assert.equal(classifyUpload({ mimeType: 'audio/x-wav', originalName: 'voice.wav' }), 'audio');
  assert.equal(classifyUpload({ mimeType: '', originalName: 'clip.mov' }), 'video');
});

test('classifyUpload falls back to document for unsafe or unsupported inline types', () => {
  assert.equal(classifyUpload({ mimeType: 'text/html', originalName: 'index.html' }), 'document');
  assert.equal(classifyUpload({ mimeType: 'application/xml', originalName: 'feed.xml' }), 'document');
  assert.equal(classifyUpload({ mimeType: 'image/heic', originalName: 'photo.heic' }), 'document');
  assert.equal(classifyUpload({ mimeType: 'application/octet-stream', originalName: 'archive.psd' }), 'document');
});

test('upload limits and previewable type checks stay aligned with universal attachments policy', () => {
  assert.equal(GENERAL_UPLOAD_LIMIT_BYTES, 1024 * 1024 * 1024);
  assert.equal(GENERAL_UPLOAD_LIMIT_LABEL, '1 GB');
  assert.equal(isPreviewableFileType('image'), true);
  assert.equal(isPreviewableFileType('audio'), true);
  assert.equal(isPreviewableFileType('video'), true);
  assert.equal(isPreviewableFileType('document'), false);
});
