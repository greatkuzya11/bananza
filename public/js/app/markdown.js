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
    const renderSpoiler = typeof options.renderSpoiler === 'function'
      ? options.renderSpoiler
      : (contentHtml) => `<span class="markdown-spoiler"><span class="markdown-spoiler-content">${contentHtml}</span></span>`;

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
          { marker: '||', spoiler: true },
          { marker: '*', open: '<em>', close: '</em>' },
          { marker: '_', open: '<em>', close: '</em>' },
        ];
        const match = markers.find((item) => text.startsWith(item.marker, index));
        if (match) {
          const closing = findClosingMarker(text, match.marker, index + match.marker.length);
          if (closing > index + match.marker.length) {
            flushPlain(index);
            const inner = text.slice(index + match.marker.length, closing);
            const innerHtml = match.literal ? esc(inner) : render(inner, { allowLinks });
            html += match.spoiler ? renderSpoiler(innerHtml) : match.open + innerHtml + match.close;
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

  function parseFenceStart(line) {
    const match = String(line || '').match(/^\s*(`{3,})\s*([^`]*)$/);
    if (!match) return null;
    const language = String(match[2] || '').trim().split(/\s+/)[0] || '';
    return {
      markerLength: match[1].length,
      language: /^[a-z0-9][a-z0-9+._-]{0,31}$/i.test(language) ? language.toLowerCase() : '',
    };
  }

  function parseCodeBlock(lines, startIndex) {
    const opening = parseFenceStart(lines[startIndex]);
    if (!opening) return null;
    const closingPattern = new RegExp(`^\\s*\\\`{${opening.markerLength},}\\s*$`);
    const content = [];
    let index = startIndex + 1;
    while (index < lines.length && !closingPattern.test(lines[index])) {
      content.push(lines[index]);
      index += 1;
    }
    if (index < lines.length) index += 1;
    return { type: 'code', language: opening.language, content: content.join('\n'), nextIndex: index };
  }

  function parseListItem(line) {
    const match = String(line || '').match(/^([ \t]*)([-+*]|\d+[.)])\s+(.+)$/);
    if (!match) return null;
    const marker = match[2];
    const task = match[3].match(/^\[([ xX])\]\s+(.+)$/);
    return {
      indent: match[1].replace(/\t/g, '  ').length,
      ordered: /^\d/.test(marker),
      text: task ? task[2] : match[3],
      task: task ? task[1].toLowerCase() === 'x' : null,
    };
  }

  function parseList(lines, startIndex, indent = null) {
    const first = parseListItem(lines[startIndex]);
    if (!first) return null;
    const baseIndent = indent == null ? first.indent : indent;
    const ordered = first.ordered;
    const items = [];
    let index = startIndex;
    while (index < lines.length) {
      const item = parseListItem(lines[index]);
      if (!item || item.indent !== baseIndent || item.ordered !== ordered) break;
      const entry = { text: item.text, task: item.task, children: [] };
      index += 1;
      while (index < lines.length) {
        const nested = parseListItem(lines[index]);
        if (!nested || nested.indent <= baseIndent) break;
        const child = parseList(lines, index, nested.indent);
        if (!child) break;
        entry.children.push(child);
        index = child.nextIndex;
      }
      items.push(entry);
    }
    return { type: 'list', ordered, items, nextIndex: index };
  }

  function parseBlocks(source) {
    const text = String(source || '').replace(/\r\n?/g, '\n');
    if (!text) return [];
    const lines = text.split('\n');
    const blocks = [];
    let index = 0;

    function isBlockStart(lineIndex) {
      return Boolean(
        parseTable(lines, lineIndex)
        || parseFenceStart(lines[lineIndex])
        || String(lines[lineIndex] || '').match(/^\s*(#{2,4})\s+(.+?)\s*#*\s*$/)
        || parseListItem(lines[lineIndex])
        || String(lines[lineIndex] || '').match(/^\s*>\s?(.*)$/)
      );
    }

    while (index < lines.length) {
      const table = parseTable(lines, index);
      if (table) {
        blocks.push({ type: 'table', ...table });
        index = table.nextIndex;
        continue;
      }
      const code = parseCodeBlock(lines, index);
      if (code) {
        blocks.push(code);
        index = code.nextIndex;
        continue;
      }
      const heading = String(lines[index] || '').match(/^\s*(#{2,4})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
        index += 1;
        continue;
      }
      const list = parseList(lines, index);
      if (list) {
        blocks.push(list);
        index = list.nextIndex;
        continue;
      }
      const quote = String(lines[index] || '').match(/^\s*>\s?(.*)$/);
      if (quote) {
        const quoteLines = [];
        while (index < lines.length) {
          const next = String(lines[index] || '').match(/^\s*>\s?(.*)$/);
          if (!next) break;
          quoteLines.push(next[1]);
          index += 1;
        }
        blocks.push({ type: 'quote', lines: quoteLines });
        continue;
      }
      const paragraph = [];
      while (index < lines.length && (!paragraph.length || !isBlockStart(index))) {
        paragraph.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'paragraph', lines: paragraph });
    }
    return blocks;
  }

  function renderList(list, renderInline) {
    const tag = list.ordered ? 'ol' : 'ul';
    const items = list.items.map((item) => {
      const taskHtml = item.task == null ? '' : `<label class="markdown-task-label"><input class="markdown-task-checkbox" type="checkbox" disabled${item.task ? ' checked' : ''}><span class="markdown-task-text">${renderInline(item.text)}</span></label>`;
      const contentHtml = item.task == null ? renderInline(item.text) : taskHtml;
      const childrenHtml = item.children.map((child) => renderList(child, renderInline)).join('');
      return `<li${item.task == null ? '' : ' class="markdown-task-item"'}>${contentHtml}${childrenHtml}</li>`;
    }).join('');
    return `<${tag}>${items}</${tag}>`;
  }

  function render(source, options = {}) {
    const blocks = parseBlocks(source);
    if (!blocks.length) return { html: '', hasBlockFormatting: false };
    const renderInline = createInlineRenderer(options);
    const html = blocks.map((block) => {
      if (block.type === 'table') {
        const renderCells = (cells, tag) => cells.map((cell, cellIndex) => (
          `<${tag} class="markdown-table-align-${block.alignments[cellIndex]}">${renderInline(cell)}</${tag}>`
        )).join('');
        const headerHtml = renderCells(block.headers, 'th');
        const rowsHtml = block.rows.map((row) => `<tr>${renderCells(row, 'td')}</tr>`).join('');
        return `<div class="markdown-table-wrap"><table class="markdown-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
      }
      if (block.type === 'code') {
        const language = block.language ? ` data-language="${esc(block.language)}"` : '';
        return `<pre class="markdown-code-block"${language}><code>${esc(block.content)}</code></pre>`;
      }
      if (block.type === 'heading') return `<h${block.level}>${renderInline(block.text)}</h${block.level}>`;
      if (block.type === 'list') return renderList(block, renderInline);
      if (block.type === 'quote') return `<blockquote>${block.lines.map((line) => renderInline(line)).join('<br>')}</blockquote>`;
      return block.lines.map((line) => renderInline(line)).join('<br>');
    }).join('');
    const hasBlockFormatting = blocks.some((block) => block.type !== 'paragraph');
    return { html, hasBlockFormatting };
  }

  function flattenListText(list, lines) {
    list.items.forEach((item) => {
      const taskPrefix = item.task == null ? '' : (item.task ? '\u2611 ' : '\u2610 ');
      lines.push(taskPrefix + item.text);
      item.children.forEach((child) => flattenListText(child, lines));
    });
  }

  function toPlainText(source, options = {}) {
    const spoilerText = String(options.spoilerText || 'Spoiler');
    const segments = [];
    const pushText = (text, literal = false) => segments.push({ text: String(text || ''), literal });
    parseBlocks(source).forEach((block) => {
      if (block.type === 'table') {
        pushText(block.headers.join(' \u00b7 '));
        block.rows.forEach((row) => pushText(row.join(' \u00b7 ')));
      } else if (block.type === 'code') {
        pushText(block.content.replace(/\s+/g, ' ').trim(), true);
      } else if (block.type === 'heading') {
        pushText(block.text);
      } else if (block.type === 'list') {
        const listLines = [];
        flattenListText(block, listLines);
        listLines.forEach((line) => pushText(line));
      } else if (block.type === 'quote' || block.type === 'paragraph') {
        block.lines.forEach((line) => pushText(line));
      }
    });
    const stripInlineMarkup = (text) => String(text || '')
      .replace(/\|\|[^|\n]+?\|\|/g, spoilerText)
      .replace(/\[([^\]\n]+)\]\((?:https?:\/\/)[^)\s]+\)/gi, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
      .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1');
    return segments
      .map((segment) => segment.literal ? segment.text : stripInlineMarkup(segment.text))
      .join(' \u00b7 ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  root.markdown = Object.freeze({
    render,
    toPlainText,
  });
})();
