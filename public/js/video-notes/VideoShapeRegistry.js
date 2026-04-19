(function () {
  'use strict';

  const ns = window.BananzaVideoNotes = window.BananzaVideoNotes || {};

  const SAFE_FALLBACK_SHAPE = Object.freeze({
    id: 'banana-fat',
    version: 1,
    label: 'Banana Fat',
    viewBox: '0 0 320 220',
    path: 'M23 124C33 73 76 36 138 27C214 17 281 53 301 109C311 137 305 166 285 188C257 214 205 221 144 213C95 207 59 186 35 150C28 140 24 132 23 124Z',
    clipPadding: 12,
    previewTransform: '',
  });

  function clonePreset(preset) {
    return preset ? JSON.parse(JSON.stringify(preset)) : null;
  }

  function normalizeViewBox(value) {
    const source = String(value || '').trim();
    return source || '0 0 320 220';
  }

  function normalizeClipPadding(value) {
    const next = Number(value || 0);
    return Number.isFinite(next) ? Math.max(0, next) : 0;
  }

  function parseViewBox(value) {
    const parts = String(value || '')
      .trim()
      .split(/[\s,]+/)
      .map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part)) || parts[2] <= 0 || parts[3] <= 0) {
      return { x: 0, y: 0, width: 320, height: 220 };
    }
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }

  function isSafePathData(value) {
    const source = String(value || '').trim();
    if (!source) return false;
    if (/[<>"'`\u2026]/.test(source)) return false;
    return /^[MmZzLlHhVvCcSsQqTtAaEe0-9+\-.,\s]+$/.test(source);
  }

  function toSolidOuterPathData(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    const firstCloseIndex = source.search(/[Zz]/);
    if (firstCloseIndex < 0) return source;
    const outerPath = source.slice(0, firstCloseIndex + 1).trim();
    const tail = source.slice(firstCloseIndex + 1);
    return /[Mm]/.test(tail) ? outerPath : source;
  }

  function tokenizePath(path) {
    return String(path || '').match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) || [];
  }

  function formatPathNumber(value) {
    const rounded = Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
    if (Object.is(rounded, -0)) return '0';
    return String(rounded).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function collectPathBounds(path) {
    const tokens = tokenizePath(path);
    const isCommand = (token) => /^[A-Za-z]$/.test(token);
    const points = [];
    let index = 0;
    let command = '';
    let x = 0;
    let y = 0;

    function takeNumber() {
      if (index >= tokens.length || isCommand(tokens[index])) throw new Error('Expected path number');
      return Number(tokens[index++]);
    }

    function addPoint(px, py) {
      if (Number.isFinite(px) && Number.isFinite(py)) points.push([px, py]);
    }

    while (index < tokens.length) {
      if (isCommand(tokens[index])) command = tokens[index++];
      if (!command) throw new Error('Expected path command');
      const relative = command === command.toLowerCase();
      const lower = command.toLowerCase();

      if (lower === 'z') continue;
      if (lower === 'm' || lower === 'l' || lower === 't') {
        while (index < tokens.length && !isCommand(tokens[index])) {
          const nx = takeNumber();
          const ny = takeNumber();
          x = relative ? x + nx : nx;
          y = relative ? y + ny : ny;
          addPoint(x, y);
        }
        continue;
      }
      if (lower === 'h') {
        while (index < tokens.length && !isCommand(tokens[index])) {
          const nx = takeNumber();
          x = relative ? x + nx : nx;
          addPoint(x, y);
        }
        continue;
      }
      if (lower === 'v') {
        while (index < tokens.length && !isCommand(tokens[index])) {
          const ny = takeNumber();
          y = relative ? y + ny : ny;
          addPoint(x, y);
        }
        continue;
      }
      if (lower === 'c') {
        while (index < tokens.length && !isCommand(tokens[index])) {
          const values = [takeNumber(), takeNumber(), takeNumber(), takeNumber(), takeNumber(), takeNumber()];
          const p1 = relative ? [x + values[0], y + values[1]] : [values[0], values[1]];
          const p2 = relative ? [x + values[2], y + values[3]] : [values[2], values[3]];
          const p3 = relative ? [x + values[4], y + values[5]] : [values[4], values[5]];
          addPoint(p1[0], p1[1]);
          addPoint(p2[0], p2[1]);
          addPoint(p3[0], p3[1]);
          x = p3[0];
          y = p3[1];
        }
        continue;
      }
      if (lower === 's' || lower === 'q') {
        while (index < tokens.length && !isCommand(tokens[index])) {
          const values = [takeNumber(), takeNumber(), takeNumber(), takeNumber()];
          const p1 = relative ? [x + values[0], y + values[1]] : [values[0], values[1]];
          const p2 = relative ? [x + values[2], y + values[3]] : [values[2], values[3]];
          addPoint(p1[0], p1[1]);
          addPoint(p2[0], p2[1]);
          x = p2[0];
          y = p2[1];
        }
        continue;
      }
      return null;
    }

    if (!points.length) return null;
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  function fitPathIntoViewBoxIfNeeded(path, viewBoxValue, clipPadding) {
    const viewBox = parseViewBox(viewBoxValue);
    const bounds = collectPathBounds(path);
    if (!bounds) return path;
    const overflow = (
      bounds.minX < viewBox.x - 1
      || bounds.maxX > viewBox.x + viewBox.width + 1
      || bounds.minY < viewBox.y - 1
      || bounds.maxY > viewBox.y + viewBox.height + 1
    );
    if (!overflow) return path;

    const padding = Math.min(Math.max(Number(clipPadding || 0), 0), Math.min(viewBox.width, viewBox.height) / 6);
    const targetMinX = viewBox.x + padding;
    const targetMinY = viewBox.y + padding;
    const targetWidth = Math.max(1, viewBox.width - padding * 2);
    const targetHeight = Math.max(1, viewBox.height - padding * 2);
    const sourceWidth = Math.max(1, bounds.maxX - bounds.minX);
    const sourceHeight = Math.max(1, bounds.maxY - bounds.minY);
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const offsetX = targetMinX - bounds.minX * scaleX;
    const offsetY = targetMinY - bounds.minY * scaleY;
    const tokens = tokenizePath(path);
    const isCommand = (token) => /^[A-Za-z]$/.test(token);
    const output = [];
    let index = 0;

    function takeNumber() {
      if (index >= tokens.length || isCommand(tokens[index])) throw new Error('Expected path number');
      return Number(tokens[index++]);
    }

    function point(relative) {
      const px = takeNumber();
      const py = takeNumber();
      return relative
        ? [formatPathNumber(px * scaleX), formatPathNumber(py * scaleY)]
        : [formatPathNumber(px * scaleX + offsetX), formatPathNumber(py * scaleY + offsetY)];
    }

    try {
      while (index < tokens.length) {
        const command = tokens[index++];
        if (!isCommand(command)) throw new Error('Expected path command');
        output.push(command);
        const relative = command === command.toLowerCase();
        const lower = command.toLowerCase();
        if (lower === 'z') continue;
        if (lower === 'm' || lower === 'l' || lower === 't') {
          while (index < tokens.length && !isCommand(tokens[index])) output.push(...point(relative));
          continue;
        }
        if (lower === 'h') {
          while (index < tokens.length && !isCommand(tokens[index])) {
            const px = takeNumber();
            output.push(formatPathNumber(relative ? px * scaleX : px * scaleX + offsetX));
          }
          continue;
        }
        if (lower === 'v') {
          while (index < tokens.length && !isCommand(tokens[index])) {
            const py = takeNumber();
            output.push(formatPathNumber(relative ? py * scaleY : py * scaleY + offsetY));
          }
          continue;
        }
        if (lower === 'c') {
          while (index < tokens.length && !isCommand(tokens[index])) {
            output.push(...point(relative), ...point(relative), ...point(relative));
          }
          continue;
        }
        if (lower === 's' || lower === 'q') {
          while (index < tokens.length && !isCommand(tokens[index])) output.push(...point(relative), ...point(relative));
          continue;
        }
        return path;
      }
      return output.join(' ').replace(/\s+([zZ])/g, '$1').replace(/([A-Za-z])\s+/g, '$1');
    } catch {
      return path;
    }
  }

  function encodeSvgData(svg) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  class VideoShapeRegistry {
    constructor(presets = []) {
      this.presets = new Map();
      this.maskCache = new Map();
      presets.forEach((preset) => {
        if (!preset?.id || !preset?.path) return;
        this.presets.set(String(preset.id), this.normalizeSnapshot(preset));
      });
    }

    getDefault() {
      return clonePreset(this.presets.get('banana-fat') || this.presets.values().next().value || SAFE_FALLBACK_SHAPE);
    }

    getPreset(id) {
      return clonePreset(this.presets.get(String(id || '')) || this.getDefault());
    }

    normalizeSnapshot(snapshot, fallbackId = 'banana-fat') {
      const fallback = this.presets.get(String(fallbackId || ''))
        || this.presets.get('banana-fat')
        || this.presets.values().next().value
        || SAFE_FALLBACK_SHAPE;
      const source = snapshot && typeof snapshot === 'object' ? snapshot : fallback;
      const fallbackPath = isSafePathData(fallback.path) ? fallback.path : SAFE_FALLBACK_SHAPE.path;
      const sourcePath = String(source.path || fallbackPath || '').trim();
      const hasSafeSourcePath = isSafePathData(sourcePath);
      const shapeSource = hasSafeSourcePath ? source : fallback;
      const viewBox = normalizeViewBox(shapeSource.viewBox || fallback.viewBox);
      const clipPadding = normalizeClipPadding(shapeSource.clipPadding != null ? shapeSource.clipPadding : fallback.clipPadding);
      const path = fitPathIntoViewBoxIfNeeded(
        toSolidOuterPathData(hasSafeSourcePath ? sourcePath : fallbackPath),
        viewBox,
        clipPadding
      );
      return {
        id: String(shapeSource.id || fallback.id || 'banana-fat'),
        version: Number(shapeSource.version || fallback.version || 1),
        label: String(shapeSource.label || fallback.label || 'Shape'),
        viewBox,
        path,
        clipPadding,
        previewTransform: String(shapeSource.previewTransform || fallback.previewTransform || ''),
      };
    }

    snapshotFor(shapeId) {
      return this.normalizeSnapshot(this.getPreset(shapeId), shapeId);
    }

    snapshotFromMessage(message) {
      const source = message?.video_note_shape_snapshot || message?.video_note_shape_snapshot_raw || null;
      return this.normalizeSnapshot(source, message?.video_note_shape_id || message?.shape_id || 'banana-fat');
    }

    getMaskUrl(snapshot) {
      const normalized = this.normalizeSnapshot(snapshot);
      const cacheKey = JSON.stringify(normalized);
      if (this.maskCache.has(cacheKey)) return this.maskCache.get(cacheKey);
      const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${normalized.viewBox}" preserveAspectRatio="none">`,
        '<rect width="100%" height="100%" fill="transparent"/>',
        `<path fill="white" d="${normalized.path}"/>`,
        '</svg>',
      ].join('');
      const dataUrl = encodeSvgData(svg);
      this.maskCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
  }

  ns.VideoShapeRegistry = VideoShapeRegistry;
})();
