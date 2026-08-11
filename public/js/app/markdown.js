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

  function splitTableCells(line) {
    const source = String(line || '').trim();
    if (!source.includes('|')) return null;
    const withoutOuterPipes = source
      .replace(/^\|\s?/, '')
      .replace(/\s?\|$/, '');
    const cells = withoutOuterPipes.split('|').map((cell) => cell.trim());
    return cells.length >= 2 ? cells : null;
  }

  function parseTableDivider(line, columnCount) {
    const cells = splitTableCells(line);
    if (!cells || cells.length !== columnCount) return null;
    const alignments = cells.map((cell) => {
      if (!/^:?-{3,}:?$/.test(cell)) return null;
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
      if (cell.endsWith(':')) return 'right';
      return 'left';
    });
    return alignments.includes(null) ? null : alignments;
  }

  function parseTable(lines, startIndex) {
    const headers = splitTableCells(lines[startIndex]);
    if (!headers) return null;
    const alignments = parseTableDivider(lines[startIndex + 1], headers.length);
    if (!alignments) return null;
    const rows = [];
    let index = startIndex + 2;
    while (index < lines.length) {
      const row = splitTableCells(lines[index]);
      if (!row || row.length !== headers.length) break;
      rows.push(row);
      index += 1;
    }
    return rows.length ? { headers, alignments, rows, nextIndex: index } : null;
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
      const table = parseTable(lines, index);
      const heading = line.match(/^\s*(#{2,4})\s+(.+?)\s*#*\s*$/);
      const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      const quote = line.match(/^\s*>\s?(.*)$/);

      if (table) {
        flushText();
        const renderCells = (cells, tag) => cells.map((cell, cellIndex) => (
          `<${tag} class="markdown-table-align-${table.alignments[cellIndex]}">${renderInline(cell)}</${tag}>`
        )).join('');
        const headerHtml = renderCells(table.headers, 'th');
        const rowsHtml = table.rows.map((row) => `<tr>${renderCells(row, 'td')}</tr>`).join('');
        chunks.push(`<div class="markdown-table-wrap"><table class="markdown-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`);
        hasBlockFormatting = true;
        index = table.nextIndex;
        continue;
      }

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
    const sourceLines = text.split('\n');
    const tableNormalizedLines = [];
    for (let index = 0; index < sourceLines.length;) {
      const table = parseTable(sourceLines, index);
      if (table) {
        tableNormalizedLines.push(table.headers.join(' · '));
        table.rows.forEach((row) => tableNormalizedLines.push(row.join(' · ')));
        index = table.nextIndex;
        continue;
      }
      tableNormalizedLines.push(sourceLines[index]);
      index += 1;
    }
    const lines = tableNormalizedLines.map((line) => line
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
