const path = require('path');

const GENERAL_UPLOAD_LIMIT_BYTES = 1024 * 1024 * 1024;
const GENERAL_UPLOAD_LIMIT_LABEL = '1 GB';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
  'image/bmp',
]);

const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/flac',
  'audio/x-flac',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-m4v',
]);

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.avif',
  '.bmp',
]);

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.flac',
  '.weba',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.ogv',
  '.m4v',
]);

const GENERIC_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
]);

function normalizeMimeType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function getFileExtension(filename) {
  return path.extname(String(filename || '')).trim().toLowerCase();
}

function classifyByExtension(ext) {
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return 'document';
}

function classifyUpload({ mimeType = '', originalName = '' } = {}) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  const ext = getFileExtension(originalName);

  if (IMAGE_MIME_TYPES.has(normalizedMimeType)) return 'image';
  if (AUDIO_MIME_TYPES.has(normalizedMimeType)) return 'audio';
  if (VIDEO_MIME_TYPES.has(normalizedMimeType)) return 'video';
  if (ext === '.svg' && (normalizedMimeType === 'application/xml' || normalizedMimeType === 'text/xml')) {
    return 'image';
  }

  if (GENERIC_MIME_TYPES.has(normalizedMimeType)) {
    return classifyByExtension(ext);
  }

  return 'document';
}

function isPreviewableFileType(type) {
  return type === 'image' || type === 'audio' || type === 'video';
}

module.exports = {
  AUDIO_EXTENSIONS,
  AUDIO_MIME_TYPES,
  GENERAL_UPLOAD_LIMIT_BYTES,
  GENERAL_UPLOAD_LIMIT_LABEL,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_TYPES,
  classifyUpload,
  getFileExtension,
  isPreviewableFileType,
  normalizeMimeType,
};
