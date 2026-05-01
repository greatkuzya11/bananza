const fs = require('fs');
const path = require('path');

const VIDEO_POSTER_SUFFIX = '.poster.jpg';
const VIDEO_POSTER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
]);

function normalizeVideoPosterMime(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function isSupportedVideoPosterMime(value) {
  return VIDEO_POSTER_MIME_TYPES.has(normalizeVideoPosterMime(value));
}

function getVideoPosterStoredName(storedName) {
  const baseName = path.basename(String(storedName || '').trim());
  return baseName ? `${baseName}${VIDEO_POSTER_SUFFIX}` : '';
}

function getVideoPosterPath(uploadsDir, storedName) {
  const posterStoredName = getVideoPosterStoredName(storedName);
  return posterStoredName ? path.join(uploadsDir, posterStoredName) : '';
}

function getVideoPosterUrl(storedName) {
  const baseName = path.basename(String(storedName || '').trim());
  return baseName ? `/uploads/${encodeURIComponent(baseName)}/poster` : '';
}

function hasVideoPoster(uploadsDir, storedName) {
  const posterPath = getVideoPosterPath(uploadsDir, storedName);
  return Boolean(posterPath && fs.existsSync(posterPath));
}

function saveVideoPosterFromPath({ uploadsDir, storedName, sourcePath } = {}) {
  const posterPath = getVideoPosterPath(uploadsDir, storedName);
  if (!posterPath || !sourcePath) return false;
  fs.copyFileSync(sourcePath, posterPath);
  return true;
}

function saveVideoPosterFromBuffer({ uploadsDir, storedName, buffer } = {}) {
  const posterPath = getVideoPosterPath(uploadsDir, storedName);
  if (!posterPath || !Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  fs.writeFileSync(posterPath, buffer);
  return true;
}

function duplicateVideoPoster({ uploadsDir, sourceStoredName, targetStoredName } = {}) {
  const sourcePath = getVideoPosterPath(uploadsDir, sourceStoredName);
  const targetPath = getVideoPosterPath(uploadsDir, targetStoredName);
  if (!sourcePath || !targetPath || !fs.existsSync(sourcePath)) return false;
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function deleteVideoPoster(uploadsDir, storedName, { sync = false } = {}) {
  const posterPath = getVideoPosterPath(uploadsDir, storedName);
  if (!posterPath || !fs.existsSync(posterPath)) return false;
  if (sync) {
    try {
      fs.unlinkSync(posterPath);
    } catch {
      return false;
    }
    return true;
  }
  fs.unlink(posterPath, () => {});
  return true;
}

module.exports = {
  VIDEO_POSTER_SUFFIX,
  deleteVideoPoster,
  duplicateVideoPoster,
  getVideoPosterPath,
  getVideoPosterStoredName,
  getVideoPosterUrl,
  hasVideoPoster,
  isSupportedVideoPosterMime,
  normalizeVideoPosterMime,
  saveVideoPosterFromBuffer,
  saveVideoPosterFromPath,
};
