const path = require('path');

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.mp4', '.ogg', '.oga', '.opus', '.webm']);

function extensionForMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase().split(';')[0].trim();
  if (mime === 'audio/wav' || mime === 'audio/x-wav' || mime === 'audio/wave') return '.wav';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return '.mp3';
  if (mime === 'audio/mp4' || mime === 'audio/x-m4a') return '.m4a';
  if (mime === 'audio/webm') return '.webm';
  if (mime === 'audio/ogg' || mime === 'audio/opus') return '.ogg';
  return '';
}

function safeAudioExtension(fileName, mimeType, fallback = '.ogg') {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (AUDIO_EXTENSIONS.has(ext)) return ext;
  return extensionForMime(mimeType) || fallback;
}

function extractTelegramAudio(message = {}) {
  if (message.voice?.file_id) {
    return {
      kind: 'voice',
      file_id: String(message.voice.file_id),
      file_unique_id: String(message.voice.file_unique_id || ''),
      file_name: `voice-${message.message_id || Date.now()}.ogg`,
      mime_type: message.voice.mime_type || 'audio/ogg',
      file_size: message.voice.file_size == null ? null : Number(message.voice.file_size),
      duration_seconds: Number(message.voice.duration || 0),
      extension: '.ogg',
    };
  }
  if (message.audio?.file_id) {
    const mime = String(message.audio.mime_type || 'audio/mpeg');
    const fileName = String(message.audio.file_name || `audio-${message.message_id || Date.now()}`);
    return {
      kind: 'audio',
      file_id: String(message.audio.file_id),
      file_unique_id: String(message.audio.file_unique_id || ''),
      file_name: fileName,
      mime_type: mime,
      file_size: message.audio.file_size == null ? null : Number(message.audio.file_size),
      duration_seconds: Number(message.audio.duration || 0),
      extension: safeAudioExtension(fileName, mime, '.mp3'),
    };
  }
  const document = message.document;
  if (!document?.file_id) return null;
  const mime = String(document.mime_type || '').toLowerCase();
  const fileName = String(document.file_name || 'audio');
  const ext = path.extname(fileName).toLowerCase();
  if (!mime.startsWith('audio/') && !AUDIO_EXTENSIONS.has(ext)) return null;
  const extension = safeAudioExtension(fileName, mime, '');
  if (!extension) return null;
  return {
    kind: 'document',
    file_id: String(document.file_id),
    file_unique_id: String(document.file_unique_id || ''),
    file_name: fileName,
    mime_type: mime || 'application/octet-stream',
    file_size: document.file_size == null ? null : Number(document.file_size),
    duration_seconds: 0,
    extension,
  };
}

function splitUnicodeText(value, maxLength = 4000) {
  const chars = Array.from(String(value || '').trim());
  const limit = Math.max(1, Math.floor(Number(maxLength) || 4000));
  const parts = [];
  let offset = 0;
  while (offset < chars.length) {
    let end = Math.min(chars.length, offset + limit);
    if (end < chars.length) {
      const minimum = offset + Math.floor(limit * 0.55);
      let boundary = -1;
      for (let cursor = end; cursor > minimum; cursor -= 1) {
        if (chars[cursor - 1] === '\n') {
          boundary = cursor;
          break;
        }
        if (boundary < 0 && /\s/u.test(chars[cursor - 1])) boundary = cursor;
      }
      if (boundary > offset) end = boundary;
    }
    const part = chars.slice(offset, end).join('').trim();
    if (part) parts.push(part);
    offset = end;
    while (offset < chars.length && /\s/u.test(chars[offset])) offset += 1;
  }
  return parts;
}

module.exports = {
  AUDIO_EXTENSIONS,
  safeAudioExtension,
  extractTelegramAudio,
  splitUnicodeText,
};

