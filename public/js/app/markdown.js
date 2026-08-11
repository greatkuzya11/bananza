(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isSafeHttpUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function findClosingMarker(source, marker, fromIndex) {
    let index = source.indexOf(marker, fromIndex);
    while (index >= 0) {
      if (source[index - 1] !== '\\') return index;
      index = source.indexOf(marker, index + marker.length);
    }
    return -1;
  }

  function createInlineRenderer(options = {}) {
    const renderPlain = typeof options.renderPlain === 'function' ? options.renderPlain : esc;
    const renderLink = typeof options.renderLink === 'function'
      ? options.renderLink
      : (url, labelHtml) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`;

    function render(source, { allowLinks = true } = {}) {
      const text = String(source || '');
      let html = '';
      let plainStart = 0;
      let index = 0;

      function flushPlain(end) {
        if (end > plainStart) html += renderPlain(text.slice(plainStart, end));
      }

      while (index < text.length) {
        if (allowLinks && text[index] === '[') {
          const labelEnd = text.indexOf(']', index + 1);
          const urlStart = labelEnd >= 0 && text[labelEnd + 1] === '(' ? labelEnd + 2 : -1;
          const urlEnd = urlStart >= 0 ? text.indexOf(')', urlStart) : -1;
          if (labelEnd > index + 1 && urlEnd > urlStart && !/\s/.test(text.slice(urlStart, urlEnd))) {
            const url = text.slice(urlStart, urlEnd);
            if (isSafeHttpUrl(url)) {
              flushPlain(index);
              html += renderLink(url, render(text.slice(index + 1, labelEnd), { allowLinks: false }));
              index = urlEnd + 1;
              plainStart = index;
              continue;
            }
          }
        }

        const markers = [
          { marker: '**', open: '<strong>', close: '</strong>' },
          { marker: '~~', open: '<del>', close: '</del>' },
          { marker: '`', open: '<code>', close: '</code>', literal: true },
          { marker: '*', open: '<em>', close: '</em>' },
          { marker: '_', open: '<em>', close: '</em>' },
        ];
        const match = markers.find((item) => text.startsWith(item.marker, index));
        if (match) {
          const closing = findClosingMarker(text, match.marker, index + match.marker.length);
          if (closing > index + match.marker.length) {
            flushPlain(index);
            const inner = text.slice(index + match.marker.length, closing);
            html += match.open + (match.literal ? esc(inner) : render(inner, { allowLinks })) + match.close;
            index = closing + match.marker.length;
            plainStart = index;
            continue;
          }
        }

        index += 1;
      }
      flushPlain(text.length);
      return html;
    }

    return render;
  }

  function render(source, options = {}) {
    const text = String(source || '').replace(/\r\n?/g, '\n');
    if (!text) return { html: '', hasBlockFormatting: false };
    const renderInline = createInlineRenderer(options);
    const lines = text.split('\n');
    const chunks = [];
    let textLines = [];
    let hasBlockFormatting = false;

    function flushText() {
      if (!textLines.length) return;
      chunks.push(textLines.map((line) => renderInline(line)).join('<br>'));
      textLines = [];
    }

    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      const heading = line.match(/^\s*(#{2,4})\s+(.+?)\s*#*\s*$/);
      const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      const quote = line.match(/^\s*>\s?(.*)$/);

      if (heading) {
        flushText();
        const level = heading[1].length;
        chunks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        hasBlockFormatting = true;
        index += 1;
        continue;
      }

      if (unordered || ordered) {
        flushText();
        const type = unordered ? 'ul' : 'ol';
        const itemPattern = unordered ? /^\s*[-+*]\s+(.+)$/ : /^\s*\d+[.)]\s+(.+)$/;
        const items = [];
        while (index < lines.length) {
          const item = lines[index].match(itemPattern);
          if (!item) break;
          items.push(`<li>${renderInline(item[1])}</li>`);
          index += 1;
        }
        chunks.push(`<${type}>${items.join('')}</${type}>`);
        hasBlockFormatting = true;
        continue;
      }

      if (quote) {
        flushText();
        const quoteLines = [];
        while (index < lines.length) {
          const item = lines[index].match(/^\s*>\s?(.*)$/);
          if (!item) break;
          quoteLines.push(renderInline(item[1]));
          index += 1;
        }
        chunks.push(`<blockquote>${quoteLines.join('<br>')}</blockquote>`);
        hasBlockFormatting = true;
        continue;
      }

      textLines.push(line);
      index += 1;
    }
    flushText();

    return { html: chunks.join(''), hasBlockFormatting };
  }

  function toPlainText(source) {
    const text = String(source || '').replace(/\r\n?/g, '\n');
    if (!text) return '';
    const lines = text.split('\n').map((line) => line
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*#{2,4}\s+/, '')
      .replace(/^\s*(?:[-+*]|\d+[.)])\s+/, ''));
    const withoutLinks = lines.join(' · ')
      .replace(/\[([^\]\n]+)\]\((?:https?:\/\/)[^)\s]+\)/gi, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
      .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1');
    return withoutLinks.replace(/\s+/g, ' ').trim();
  }

  root.markdown = Object.freeze({
    render,
    toPlainText,
  });
})();
