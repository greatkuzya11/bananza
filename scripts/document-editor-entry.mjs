import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Schema } from 'prosemirror-model';
import { EditorState, NodeSelection, Plugin, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes, wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { baseKeymap, chainCommands, lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { gapCursor } from 'prosemirror-gapcursor';
import { inputRules, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules';
import { dropCursor } from 'prosemirror-dropcursor';
import { liftTarget } from 'prosemirror-transform';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  mergeCells,
  selectedRect,
  setCellAttr,
  splitCell,
  tableEditing,
  tableNodeTypes,
  tableNodes,
  toggleHeaderRow,
} from 'prosemirror-tables';
import { redoCommand, undoCommand, yCursorPlugin, ySyncPlugin, yUndoPlugin } from 'y-prosemirror';

const DEFAULT_FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '32px'];
const DEFAULT_FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'SFMono-Regular, Consolas, monospace' },
];
const DEFAULT_TEXT_COLORS = ['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc'];
const DEFAULT_HIGHLIGHT_COLORS = ['#f5d76e', '#86efac', '#93c5fd', '#f0abfc', '#fb7185'];

function t(options, key) {
  const fn = typeof options.t === 'function' ? options.t : null;
  return fn ? fn(key) : key;
}

function normalizeCursorColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? String(color) : '#65aadd';
}

function participantDisplayKey(user = {}, fallbackClientId = '') {
  const name = String(user.name || '').trim().toLowerCase();
  const color = normalizeCursorColor(user.color);
  if (name) return `name:${name}:${color}`;
  return `client:${fallbackClientId}`;
}

function sameParticipant(a = {}, b = {}, fallbackA = '', fallbackB = '') {
  const aId = String(a.id || '').trim();
  const bId = String(b.id || '').trim();
  if (aId && bId && aId === bId) return true;
  return participantDisplayKey(a, fallbackA) === participantDisplayKey(b, fallbackB);
}

function createAwarenessStateFilter(awareness, localUser = {}) {
  return (localClientId, clientId, state = {}) => {
    if (clientId === localClientId) return false;
    const user = state.user || {};
    if (!state.cursor || sameParticipant(user, localUser, clientId, localClientId)) return false;

    let primaryClientId = null;
    let primaryHasId = false;
    let primaryLastUpdated = -1;
    let primaryClock = -1;
    awareness.getStates().forEach((candidateState, candidateClientId) => {
      if (candidateClientId === localClientId || !candidateState?.cursor) return;
      const candidateUser = candidateState.user || {};
      if (!sameParticipant(candidateUser, user, candidateClientId, clientId)) return;
      if (sameParticipant(candidateUser, localUser, candidateClientId, localClientId)) return;
      const meta = awareness.meta?.get?.(candidateClientId) || {};
      const hasId = Boolean(String(candidateUser.id || '').trim());
      const lastUpdated = Number(meta.lastUpdated || 0);
      const clock = Number(meta.clock || 0);
      if (primaryClientId === null
        || (hasId && !primaryHasId)
        || (hasId === primaryHasId && lastUpdated > primaryLastUpdated)
        || (hasId === primaryHasId && lastUpdated === primaryLastUpdated && clock > primaryClock)
        || (hasId === primaryHasId && lastUpdated === primaryLastUpdated && clock === primaryClock && candidateClientId > primaryClientId)) {
        primaryClientId = candidateClientId;
        primaryHasId = hasId;
        primaryLastUpdated = lastUpdated;
        primaryClock = clock;
      }
    });
    return primaryClientId === clientId;
  };
}

function createCollabCursor(user = {}) {
  const color = normalizeCursorColor(user.color);
  const cursor = document.createElement('span');
  cursor.className = 'document-collab-cursor';
  cursor.dataset.documentUserId = String(user.id || '');
  cursor.style.setProperty('--document-cursor-color', color);
  cursor.appendChild(document.createTextNode('\u2060'));

  const label = document.createElement('span');
  label.className = 'document-collab-cursor-name';
  label.textContent = String(user.name || 'User').trim() || 'User';
  cursor.appendChild(label);
  cursor.appendChild(document.createTextNode('\u2060'));
  return cursor;
}

function createCollabSelection(user = {}) {
  const color = normalizeCursorColor(user.color);
  return {
    class: 'document-collab-selection',
    style: `--document-cursor-color:${color};background-color:${color}40`,
  };
}

function escAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeTextAlign(value) {
  const align = String(value || '').trim().toLowerCase();
  return ['left', 'center', 'right'].includes(align) ? align : null;
}

function textblockAttrs(dom) {
  return { align: normalizeTextAlign(dom?.style?.textAlign) };
}

function textblockDomAttrs(node, extraStyle = '') {
  const styles = [];
  const align = normalizeTextAlign(node.attrs.align);
  if (align) styles.push(`text-align:${align}`);
  if (extraStyle) styles.push(extraStyle);
  return styles.length ? { style: styles.join(';') } : {};
}

function markStyleValue(value) {
  return String(value || '').replace(/[;"<>]/g, '').trim();
}

function normalizeImageWidth(value, fallback = 420) {
  const number = Math.round(Number(value || 0));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(96, Math.min(4096, number));
}

function imageWidthFromDom(dom) {
  const raw = dom?.style?.width || dom?.getAttribute?.('width') || dom?.querySelector?.('img')?.getAttribute?.('width') || '';
  const match = String(raw || '').match(/(\d+(?:\.\d+)?)/);
  return normalizeImageWidth(match ? Number(match[1]) : 420);
}

function imageBlockAttrsFromDom(dom) {
  const img = dom?.matches?.('img') ? dom : (dom?.querySelector?.('img') || null);
  return {
    assetId: dom?.getAttribute?.('data-asset-id') || null,
    src: img?.getAttribute?.('src') || dom?.getAttribute?.('data-src') || '',
    width: imageWidthFromDom(dom),
    height: null,
    align: normalizeTextAlign(dom?.getAttribute?.('data-align') || dom?.style?.textAlign),
    x: 0,
    y: 0,
    zIndex: 1,
    caption: '',
    alt: img?.getAttribute?.('alt') || '',
  };
}

function imageCompatAttrsFromDom(dom) {
  const attrs = imageBlockAttrsFromDom(dom);
  const img = dom?.matches?.('img') ? dom : (dom?.querySelector?.('img') || null);
  return {
    ...attrs,
    title: img?.getAttribute?.('title') || null,
  };
}

function imageBlockDomAttrs(node) {
  const width = normalizeImageWidth(node.attrs.width);
  const align = normalizeTextAlign(node.attrs.align);
  const styles = [`width:${width}px`];
  if (align === 'center') styles.push('margin-left:auto', 'margin-right:auto');
  if (align === 'right') styles.push('margin-left:auto', 'margin-right:0');
  if (align === 'left') styles.push('margin-left:0', 'margin-right:auto');
  return {
    'data-document-image': 'true',
    'data-asset-id': node.attrs.assetId || '',
    'data-src': node.attrs.src || '',
    'data-align': align || '',
    class: 'document-image-node document-image-node--block',
    contenteditable: 'false',
    style: styles.join(';'),
  };
}

function imageInlineDomAttrs(node) {
  const width = normalizeImageWidth(node.attrs.width);
  return {
    'data-document-image': 'inline',
    'data-asset-id': node.attrs.assetId || '',
    'data-src': node.attrs.src || '',
    class: 'document-image-node document-image-node--inline',
    contenteditable: 'false',
    style: `width:${width}px`,
  };
}

function imageCompatDomAttrs(node) {
  const attrs = {
    src: node.attrs.src || '',
    alt: node.attrs.alt || '',
    title: node.attrs.title || '',
    draggable: 'false',
    'data-document-image': 'inline',
    'data-asset-id': node.attrs.assetId || '',
    'data-src': node.attrs.src || '',
    width: normalizeImageWidth(node.attrs.width),
  };
  if (!attrs.title) delete attrs.title;
  return attrs;
}

function createDocumentSchema() {
  const paragraphNode = {
    content: 'inline*',
    group: 'block',
    attrs: { align: { default: null } },
    parseDOM: [{ tag: 'p', getAttrs: textblockAttrs }],
    toDOM: (node) => ['p', textblockDomAttrs(node), 0],
  };
  const headingNode = {
    attrs: { level: { default: 1 }, align: { default: null } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
      tag: `h${level}`,
      getAttrs: (dom) => ({ level, align: normalizeTextAlign(dom?.style?.textAlign) }),
    })),
    toDOM: (node) => [`h${node.attrs.level}`, textblockDomAttrs(node), 0],
  };
  const underlineMark = {
    parseDOM: [
      { tag: 'u' },
      {
        style: 'text-decoration',
        getAttrs: (value) => String(value || '').includes('underline') ? null : false,
      },
    ],
    toDOM: () => ['u', 0],
  };
  const textColorMark = {
    attrs: { color: {} },
    parseDOM: [{ style: 'color', getAttrs: (value) => ({ color: markStyleValue(value) }) }],
    toDOM: (mark) => ['span', { style: `color:${markStyleValue(mark.attrs.color)}` }, 0],
  };
  const highlightMark = {
    attrs: { color: {} },
    parseDOM: [{ style: 'background-color', getAttrs: (value) => ({ color: markStyleValue(value) }) }],
    toDOM: (mark) => ['span', { style: `background-color:${markStyleValue(mark.attrs.color)}` }, 0],
  };
  const fontSizeMark = {
    attrs: { size: {} },
    parseDOM: [{ style: 'font-size', getAttrs: (value) => ({ size: markStyleValue(value) }) }],
    toDOM: (mark) => ['span', { style: `font-size:${markStyleValue(mark.attrs.size)}` }, 0],
  };
  const fontFamilyMark = {
    attrs: { family: {} },
    parseDOM: [{ style: 'font-family', getAttrs: (value) => ({ family: markStyleValue(value) }) }],
    toDOM: (mark) => ['span', { style: `font-family:${markStyleValue(mark.attrs.family)}` }, 0],
  };
  const marks = basicSchema.spec.marks
    .addToEnd('underline', underlineMark)
    .addToEnd('text_color', textColorMark)
    .addToEnd('highlight', highlightMark)
    .addToEnd('font_size', fontSizeMark)
    .addToEnd('font_family', fontFamilyMark);
  const taskListNode = {
    group: 'block',
    content: 'task_item+',
    parseDOM: [{ tag: 'ul[data-task-list]' }],
    toDOM: () => ['ul', { 'data-task-list': 'true' }, 0],
  };
  const taskItemNode = {
    attrs: { checked: { default: false } },
    content: 'paragraph block*',
    defining: true,
    parseDOM: [{
      tag: 'li[data-task-item]',
      getAttrs: (dom) => ({ checked: dom.getAttribute('data-checked') === 'true' }),
    }],
    toDOM: (node) => ['li', {
      'data-task-item': 'true',
      'data-checked': node.attrs.checked ? 'true' : 'false',
    }, ['span', { 'data-task-checkbox': 'true', contenteditable: 'false' }, node.attrs.checked ? '☑' : '☐'], ['div', 0]],
  };
  const imageBlockNode = {
    group: 'block',
    atom: true,
    selectable: true,
    isolating: true,
    attrs: {
      assetId: { default: null },
      src: { default: '' },
      width: { default: 420 },
      height: { default: null },
      align: { default: null },
      x: { default: 0 },
      y: { default: 0 },
      zIndex: { default: 1 },
      caption: { default: '' },
      alt: { default: '' },
    },
    parseDOM: [{
      tag: 'figure[data-document-image]',
      getAttrs: imageBlockAttrsFromDom,
    }],
    toDOM: (node) => ['figure', imageBlockDomAttrs(node), ['img', {
      src: node.attrs.src || '',
      alt: node.attrs.alt || '',
      draggable: 'false',
    }]],
  };
  const imageInlineNode = {
    inline: true,
    group: 'inline',
    atom: true,
    selectable: true,
    attrs: imageBlockNode.attrs,
    parseDOM: [{
      tag: 'span[data-document-image]',
      getAttrs: imageBlockAttrsFromDom,
    }],
    toDOM: (node) => ['span', imageInlineDomAttrs(node), ['img', {
      src: node.attrs.src || '',
      alt: node.attrs.alt || '',
      draggable: 'false',
    }]],
  };
  const imageCompatNode = {
    inline: true,
    group: 'inline',
    atom: true,
    selectable: true,
    draggable: true,
    attrs: {
      ...imageBlockNode.attrs,
      title: { default: null },
    },
    parseDOM: [
      { tag: 'span[data-document-image]', getAttrs: imageCompatAttrsFromDom },
      { tag: 'img[src]', getAttrs: imageCompatAttrsFromDom },
    ],
    toDOM: (node) => ['img', imageCompatDomAttrs(node)],
  };
  const baseNodes = basicSchema.spec.nodes
    .update('paragraph', paragraphNode)
    .update('heading', headingNode)
    .update('image', imageCompatNode);
  const nodes = addListNodes(baseNodes, 'paragraph block*', 'block')
    .append({
      task_list: taskListNode,
      task_item: taskItemNode,
      image_block: imageBlockNode,
      image_inline: imageInlineNode,
    })
    .append(tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {
        background: {
          default: null,
          getFromDOM: (dom) => dom.style.backgroundColor || null,
          setDOMAttr: (value, attrs) => {
            if (!value) return;
            attrs.style = `${attrs.style || ''};background-color:${markStyleValue(value)}`;
          },
        },
      },
    }));
  return new Schema({ nodes, marks });
}

function buildInputRules(schema) {
  const rules = [];
  if (schema.nodes.blockquote) rules.push(wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote));
  if (schema.nodes.ordered_list) rules.push(wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) }), (match, node) => node.childCount + node.attrs.order === Number(match[1])));
  if (schema.nodes.bullet_list) rules.push(wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list));
  if (schema.nodes.heading) {
    rules.push(textblockTypeInputRule(/^(#{1,3})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })));
  }
  return inputRules({ rules });
}

function createTable(schema, rows, cols) {
  const types = tableNodeTypes(schema);
  const rowNodes = [];
  const rowCount = Math.max(1, Math.min(12, Number(rows || 0)));
  const colCount = Math.max(1, Math.min(12, Number(cols || 0)));
  for (let row = 0; row < rowCount; row += 1) {
    const cells = [];
    for (let col = 0; col < colCount; col += 1) {
      cells.push(types.cell.createAndFill());
    }
    rowNodes.push(types.row.createChecked(null, cells));
  }
  return types.table.createChecked(null, rowNodes);
}

function run(view, command) {
  if (!view || typeof command !== 'function') return false;
  const handled = command(view.state, view.dispatch, view);
  if (handled) view.focus();
  return handled;
}

function removeMarkInSelection(view, markType) {
  const { state } = view;
  const { from, to, empty } = state.selection;
  const tr = state.tr.removeMark(from, empty ? to : to, markType);
  view.dispatch(tr.scrollIntoView());
}

function applyFontMark(view, markType, attrs) {
  if (!view || !markType) return false;
  if (!attrs) {
    removeMarkInSelection(view, markType);
    view.focus();
    return true;
  }
  return run(view, toggleMark(markType, attrs));
}

function markActive(state, markType) {
  if (!markType) return false;
  const { from, $from, to, empty } = state.selection;
  if (empty) return Boolean(markType.isInSet(state.storedMarks || $from.marks()));
  return state.doc.rangeHasMark(from, to, markType);
}

function blockActive(state, nodeType, attrs = {}) {
  const { $from, to, node } = state.selection;
  if (node) return node.hasMarkup(nodeType, attrs);
  return to <= $from.end() && $from.parent.type === nodeType
    && Object.entries(attrs).every(([key, value]) => $from.parent.attrs[key] === value);
}

function ancestorBlockActive(state, nodeType, attrs = {}) {
  const { $from, node } = state.selection;
  if (node?.hasMarkup(nodeType, attrs)) return true;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const current = $from.node(depth);
    if (current.type === nodeType
      && Object.entries(attrs).every(([key, value]) => current.attrs[key] === value)) {
      return true;
    }
  }
  return false;
}

function listActive(state, listType) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === listType) return true;
  }
  return false;
}

function listItemTypeForList(schema, listType) {
  return listType === schema.nodes.task_list ? schema.nodes.task_item : schema.nodes.list_item;
}

function currentListInfo(state, schema) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === schema.nodes.bullet_list
      || node.type === schema.nodes.ordered_list
      || node.type === schema.nodes.task_list) {
      return { depth, node, pos: $from.before(depth) };
    }
  }
  return null;
}

function convertListNode(schema, sourceList, targetListType) {
  const targetItemType = listItemTypeForList(schema, targetListType);
  const items = [];
  sourceList.forEach((item) => {
    const itemAttrs = targetItemType === schema.nodes.task_item ? { checked: false } : null;
    items.push(targetItemType.createChecked(itemAttrs, item.content));
  });
  return targetListType.createChecked(null, items);
}

function toggleListCommand(schema, listType) {
  return (state, dispatch, view) => {
    if (listActive(state, listType)) {
      return liftListItem(listItemTypeForList(schema, listType))(state, dispatch, view);
    }
    const current = currentListInfo(state, schema);
    if (current && current.node.type !== listType) {
      if (dispatch) {
        const replacement = convertListNode(schema, current.node, listType);
        dispatch(state.tr.replaceWith(current.pos, current.pos + current.node.nodeSize, replacement).scrollIntoView());
      }
      return true;
    }
    return wrapInList(listType)(state, dispatch, view);
  };
}

function nodeHasAlignAttr(node) {
  return Object.prototype.hasOwnProperty.call(node?.attrs || {}, 'align');
}

function isDocumentImageNode(node) {
  return node?.type?.name === 'image_block' || node?.type?.name === 'image_inline' || node?.type?.name === 'image';
}

function nearestAlignableTextblock($pos) {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node.isTextblock && nodeHasAlignAttr(node)) {
      return { node, pos: $pos.before(depth) };
    }
  }
  return null;
}

function collectTextAlignTargets(state) {
  const { selection } = state;
  const targets = new Map();
  const addTarget = (node, pos) => {
    if (!nodeHasAlignAttr(node)) return;
    targets.set(pos, node);
  };

  const fromParent = nearestAlignableTextblock(selection.$from);
  if (fromParent) addTarget(fromParent.node, fromParent.pos);
  const toParent = nearestAlignableTextblock(selection.$to);
  if (toParent) addTarget(toParent.node, toParent.pos);

  if (selection instanceof NodeSelection && isDocumentImageNode(selection.node) && nodeHasAlignAttr(selection.node)) {
    addTarget(selection.node, selection.from);
  }

  const from = Math.min(selection.from, selection.to);
  const to = Math.max(selection.from, selection.to);
  state.doc.nodesBetween(from, to, (node, pos) => {
    if ((node.isTextblock || isDocumentImageNode(node)) && nodeHasAlignAttr(node)) {
      addTarget(node, pos);
    }
  });

  return [...targets.entries()].sort((a, b) => a[0] - b[0]);
}

function textAlignActive(state, align) {
  const nextAlign = normalizeTextAlign(align);
  const target = collectTextAlignTargets(state)[0];
  return normalizeTextAlign(target?.[1]?.attrs?.align) === nextAlign;
}

function setTextAlignCommand(align) {
  const nextAlign = normalizeTextAlign(align);
  return (state, dispatch) => {
    let changed = false;
    let tr = state.tr;
    const targets = collectTextAlignTargets(state);
    targets.forEach(([pos, node]) => {
      if (normalizeTextAlign(node.attrs.align) === nextAlign) return;
      changed = true;
      if (dispatch) tr = tr.setNodeMarkup(pos, null, { ...node.attrs, align: nextAlign });
    });
    if (changed && dispatch) dispatch(tr.scrollIntoView());
    return changed;
  };
}

function toggleCodeBlockCommand(schema) {
  return (state, dispatch, view) => {
    if (!schema.nodes.code_block || !schema.nodes.paragraph) return false;
    const targetNode = blockActive(state, schema.nodes.code_block)
      ? schema.nodes.paragraph
      : schema.nodes.code_block;
    return setBlockType(targetNode)(state, dispatch, view);
  };
}

function toggleBlockquoteCommand(schema) {
  return (state, dispatch, view) => {
    if (!schema.nodes.blockquote) return false;
    if (ancestorBlockActive(state, schema.nodes.blockquote)) {
      return lift(state, dispatch, view);
    }
    return wrapIn(schema.nodes.blockquote)(state, dispatch, view);
  };
}

function liftSelectionOutOfAncestorNode(tr, nodeType) {
  let changed = false;
  for (let guard = 0; guard < 20; guard += 1) {
    const { $from, $to } = tr.selection;
    const range = $from.blockRange($to, (node) => node.type === nodeType);
    const target = range && liftTarget(range);
    if (target == null) break;
    tr.lift(range, target);
    changed = true;
  }
  return changed;
}

function clearFormattingCommand(schema) {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const { from, to } = state.selection;
    let tr = state.tr.removeMark(from, to);
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock) return;
      const attrs = Object.prototype.hasOwnProperty.call(node.attrs || {}, 'align')
        ? { ...node.attrs, align: null }
        : node.attrs;
      if ((node.type === schema.nodes.heading || node.type === schema.nodes.code_block) && schema.nodes.paragraph) {
        tr = tr.setNodeMarkup(pos, schema.nodes.paragraph, { align: null });
      } else if (attrs !== node.attrs) {
        tr = tr.setNodeMarkup(pos, null, attrs);
      }
    });
    if (schema.nodes.blockquote) {
      liftSelectionOutOfAncestorNode(tr, schema.nodes.blockquote);
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}

function taskListPlugin(schema) {
  return new Plugin({
    props: {
      handleClickOn(view, _pos, node, nodePos, event) {
        const target = event.target;
        if (!target?.closest?.('[data-task-checkbox]') || node.type !== schema.nodes.task_item) return false;
        event.preventDefault();
        const tr = view.state.tr.setNodeMarkup(nodePos, null, {
          ...node.attrs,
          checked: !node.attrs.checked,
        });
        view.dispatch(tr);
        return true;
      },
    },
  });
}

function editorError(options, key, fallback = key) {
  const message = t(options, key) || fallback;
  if (typeof options.onError === 'function') options.onError(message);
}

function isImageFile(file) {
  return Boolean(file && String(file.type || '').toLowerCase().startsWith('image/'));
}

function uniqueImageFiles(files = []) {
  const seen = new Set();
  return Array.from(files || []).filter((file) => {
    if (!isImageFile(file)) return false;
    const key = `${file.name || ''}:${file.size || 0}:${file.type || ''}:${file.lastModified || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function imageFilesFromTransfer(dataTransfer) {
  const files = [];
  Array.from(dataTransfer?.items || []).forEach((item) => {
    if (item.kind !== 'file' || !String(item.type || '').toLowerCase().startsWith('image/')) return;
    const file = item.getAsFile?.();
    if (file) files.push(file);
  });
  Array.from(dataTransfer?.files || []).forEach((file) => {
    if (isImageFile(file)) files.push(file);
  });
  return uniqueImageFiles(files);
}

function uploadImageUrlsFromHtml(html) {
  if (!html || typeof DOMParser === 'undefined') return [];
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(html || ''), 'text/html');
  const urls = [];
  parsed.querySelectorAll('img[src]').forEach((img) => {
    try {
      const url = new URL(img.getAttribute('src') || '', window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!/^\/uploads\/[^/]+(?:\/preview)?$/i.test(url.pathname)) return;
      urls.push(url.href);
    } catch (e) {}
  });
  return [...new Set(urls)];
}

function stripPastedImages(html) {
  return String(html || '').replace(/<img\b[^>]*>/gi, '');
}

function filenameFromUploadUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const encoded = parts[1] || 'document-image.png';
    return decodeURIComponent(encoded);
  } catch {
    return 'document-image.png';
  }
}

function fileFromBlob(blob, filename) {
  const name = String(filename || 'document-image.png').trim() || 'document-image.png';
  if (typeof File === 'function') {
    return new File([blob], name, { type: blob.type || 'image/png' });
  }
  blob.name = name;
  return blob;
}

async function imageFilesFromUrls(urls = []) {
  const files = [];
  for (const url of urls) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) continue;
    const blob = await response.blob();
    if (!String(blob.type || '').toLowerCase().startsWith('image/')) continue;
    files.push(fileFromBlob(blob, filenameFromUploadUrl(url)));
  }
  return files;
}

function imageNodeFromAsset(schema, asset) {
  const raw = asset?.asset || asset || {};
  const storedName = raw.stored_name || raw.storedName || '';
  const src = raw.src || raw.url || raw.client_file_url || (storedName ? `/uploads/${encodeURIComponent(storedName)}/preview` : '');
  if (!src) throw new Error('Image upload failed');
  const imageType = schema.nodes.image || schema.nodes.image_inline || schema.nodes.image_block;
  const attrs = {
    assetId: raw.id != null ? String(raw.id) : (raw.assetId || null),
    src,
    width: normalizeImageWidth(raw.width, 420),
    height: null,
    align: null,
    x: 0,
    y: 0,
    zIndex: 1,
    caption: '',
    alt: raw.original_name || raw.name || '',
    title: null,
  };
  const allowedAttrs = imageType.spec.attrs || {};
  const filteredAttrs = {};
  Object.keys(allowedAttrs).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) filteredAttrs[key] = attrs[key];
  });
  return imageType.createChecked(filteredAttrs);
}

function clampDocumentPos(doc, pos) {
  const number = Number(pos);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(doc.content.size, Math.round(number)));
}

function currentImageInsertPos(view) {
  if (!view?.state?.doc || !view.state.selection) return null;
  const { doc, selection } = view.state;
  if (selection instanceof NodeSelection && isDocumentImageNode(selection.node)) {
    return clampDocumentPos(doc, selection.to);
  }
  return clampDocumentPos(doc, selection.from ?? selection.anchor);
}

function selectInsertedNode(tr, nodeType, preferredPos, fallbackFrom) {
  const candidates = [
    preferredPos,
    Number(fallbackFrom || 0) - 1,
    Number(fallbackFrom || 0) - 2,
  ].filter((pos) => Number.isFinite(pos) && pos >= 0 && pos <= tr.doc.content.size);
  for (const pos of candidates) {
    const node = tr.doc.nodeAt(pos);
    if (node?.type === nodeType) {
      return tr.setSelection(NodeSelection.create(tr.doc, pos));
    }
  }
  return tr;
}

function insertImageNode(view, node, insertPos = null) {
  const safePos = clampDocumentPos(view.state.doc, insertPos);
  let tr = view.state.tr;
  let preferredPos = null;
  if (safePos != null) {
    try {
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(safePos)));
    } catch (e) {}
  }
  const beforeFrom = tr.selection.from;
  const wrapsInlineNode = node.isInline && !tr.selection.$from.parent.inlineContent;
  const insertionNode = wrapsInlineNode
    ? view.state.schema.nodes.paragraph?.create(null, node)
    : node;
  if (!insertionNode) return safePos ?? beforeFrom;
  tr = tr.replaceSelectionWith(insertionNode, false);
  preferredPos = Math.max(0, Math.min(tr.doc.content.size, beforeFrom));
  if (node.isInline) {
    const cursorPos = Math.max(0, Math.min(tr.doc.content.size, preferredPos + (wrapsInlineNode ? 1 : 0) + node.nodeSize));
    try {
      tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos));
    } catch (e) {
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)));
    }
  } else {
    tr = selectInsertedNode(tr, node.type, preferredPos, tr.selection.from);
  }
  tr = tr.scrollIntoView();
  view.dispatch(tr);
  view.focus();
  return Math.min(view.state.doc.content.size, preferredPos + (wrapsInlineNode ? 1 : 0) + node.nodeSize);
}

async function uploadAndInsertImage(view, files, options = {}, insertPos = null) {
  if (!view || typeof options.uploadImage !== 'function') return false;
  const imageFiles = uniqueImageFiles(files);
  if (!imageFiles.length) {
    editorError(options, 'Only images can be inserted');
    return false;
  }
  let nextPos = insertPos;
  for (const file of imageFiles) {
    try {
      const asset = await options.uploadImage(file, { source: 'document-editor' });
      const node = imageNodeFromAsset(view.state.schema, asset);
      nextPos = insertImageNode(view, node, nextPos);
    } catch (error) {
      const message = error?.message || t(options, 'Image upload failed') || 'Image upload failed';
      if (typeof options.onError === 'function') options.onError(message);
    }
  }
  return true;
}

async function uploadAndInsertImageUrls(view, urls, options = {}, insertPos = null) {
  try {
    const files = await imageFilesFromUrls(urls);
    if (!files.length) return false;
    return uploadAndInsertImage(view, files, options, insertPos);
  } catch (error) {
    const message = error?.message || t(options, 'Could not insert image') || 'Could not insert image';
    if (typeof options.onError === 'function') options.onError(message);
    return false;
  }
}

function imageInputPlugin(options, schema) {
  if (typeof options.uploadImage !== 'function' || !(schema.nodes.image || schema.nodes.image_inline || schema.nodes.image_block)) {
    return new Plugin({
      props: {
        transformPastedHTML: stripPastedImages,
      },
    });
  }
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const files = imageFilesFromTransfer(event.clipboardData);
        const insertPos = currentImageInsertPos(view);
        if (files.length) {
          event.preventDefault();
          uploadAndInsertImage(view, files, options, insertPos);
          return true;
        }
        const html = event.clipboardData?.getData?.('text/html') || '';
        const urls = uploadImageUrlsFromHtml(html);
        if (urls.length) {
          event.preventDefault();
          uploadAndInsertImageUrls(view, urls, options, insertPos);
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        const files = imageFilesFromTransfer(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        const coords = { left: event.clientX, top: event.clientY };
        const dropPos = view.posAtCoords(coords)?.pos ?? null;
        uploadAndInsertImage(view, files, options, dropPos);
        return true;
      },
      transformPastedHTML: stripPastedImages,
    },
  });
}

class DocumentImageNodeView {
  constructor(node, view, getPos) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.resizeState = null;
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleResizeMove = this.handleResizeMove.bind(this);
    this.handleResizeEnd = this.handleResizeEnd.bind(this);

    this.isInline = Boolean(node.isInline);
    this.dom = document.createElement(this.isInline ? 'span' : 'figure');
    this.dom.className = `document-image-node document-image-node--${this.isInline ? 'inline' : 'block'}`;
    this.dom.setAttribute('data-document-image', 'true');
    this.dom.setAttribute('contenteditable', 'false');

    this.img = document.createElement('img');
    this.img.draggable = false;
    this.dom.appendChild(this.img);

    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((corner) => {
      const handle = document.createElement('span');
      handle.className = `document-image-resize-handle document-image-resize-handle--${corner}`;
      handle.dataset.corner = corner;
      handle.setAttribute('aria-hidden', 'true');
      this.dom.appendChild(handle);
    });

    this.dom.addEventListener('pointerdown', this.handlePointerDown);
    this.update(node);
  }

  getCurrentPos() {
    try {
      const pos = this.getPos();
      return Number.isFinite(pos) ? pos : null;
    } catch {
      return null;
    }
  }

  maxImageWidth() {
    const container = this.dom.closest('td, th') || this.view?.dom || this.dom.closest('.ProseMirror');
    if (!container) return 4096;
    const styles = window.getComputedStyle(container);
    const padding = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
    return Math.max(96, Math.round((container.clientWidth || 4096) - padding));
  }

  clampWidth(value) {
    return Math.max(96, Math.min(this.maxImageWidth(), normalizeImageWidth(value)));
  }

  applyWidth(width) {
    const next = this.clampWidth(width);
    this.dom.style.width = `${next}px`;
    this.img.style.width = '100%';
    this.img.style.height = 'auto';
    return next;
  }

  applyAlignment() {
    if (this.isInline) return;
    const align = normalizeTextAlign(this.node.attrs.align);
    this.dom.dataset.align = align || '';
    this.dom.style.marginLeft = '';
    this.dom.style.marginRight = '';
    if (align === 'center') {
      this.dom.style.marginLeft = 'auto';
      this.dom.style.marginRight = 'auto';
    } else if (align === 'right') {
      this.dom.style.marginLeft = 'auto';
      this.dom.style.marginRight = '0';
    } else if (align === 'left') {
      this.dom.style.marginLeft = '0';
      this.dom.style.marginRight = 'auto';
    }
  }

  setNodeSelection() {
    const pos = this.getCurrentPos();
    if (pos == null) return;
    try {
      this.view.dispatch(this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)));
      this.view.focus();
    } catch (e) {}
  }

  handlePointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    const handle = event.target?.closest?.('.document-image-resize-handle');
    if (handle) {
      event.preventDefault();
      event.stopPropagation();
      this.setNodeSelection();
      const corner = String(handle.dataset.corner || '');
      this.resizeState = {
        corner,
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: this.dom.getBoundingClientRect().width || normalizeImageWidth(this.node.attrs.width),
        nextWidth: normalizeImageWidth(this.node.attrs.width),
      };
      try { handle.setPointerCapture?.(event.pointerId); } catch (e) {}
      window.addEventListener('pointermove', this.handleResizeMove, { passive: false });
      window.addEventListener('pointerup', this.handleResizeEnd, true);
      window.addEventListener('pointercancel', this.handleResizeEnd, true);
      this.dom.classList.add('is-resizing');
      return;
    }
    this.setNodeSelection();
  }

  handleResizeMove(event) {
    const state = this.resizeState;
    if (!state || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    const direction = state.corner.includes('left') ? -1 : 1;
    const dx = (event.clientX - state.startX) * direction;
    state.nextWidth = this.applyWidth(state.startWidth + dx);
  }

  handleResizeEnd(event) {
    const state = this.resizeState;
    if (!state || (event?.pointerId != null && event.pointerId !== state.pointerId)) return;
    window.removeEventListener('pointermove', this.handleResizeMove, { passive: false });
    window.removeEventListener('pointerup', this.handleResizeEnd, true);
    window.removeEventListener('pointercancel', this.handleResizeEnd, true);
    this.dom.classList.remove('is-resizing');
    this.resizeState = null;

    const nextWidth = this.clampWidth(state.nextWidth);
    const currentWidth = normalizeImageWidth(this.node.attrs.width);
    if (Math.abs(nextWidth - currentWidth) < 1) return;
    const pos = this.getCurrentPos();
    if (pos == null) return;
    try {
      const attrs = { ...this.node.attrs, width: nextWidth, height: null };
      let tr = this.view.state.tr.setNodeMarkup(pos, null, attrs);
      tr = tr.setSelection(NodeSelection.create(tr.doc, pos));
      this.view.dispatch(tr.scrollIntoView());
      this.view.focus();
    } catch (e) {}
  }

  update(node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.dom.dataset.assetId = node.attrs.assetId || '';
    this.dom.dataset.src = node.attrs.src || '';
    this.img.src = node.attrs.src || '';
    this.img.alt = node.attrs.alt || '';
    this.applyWidth(node.attrs.width);
    this.applyAlignment();
    return true;
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode', 'selected');
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode', 'selected');
  }

  stopEvent(event) {
    return Boolean(event.target?.closest?.('.document-image-resize-handle'));
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    this.dom.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handleResizeMove, { passive: false });
    window.removeEventListener('pointerup', this.handleResizeEnd, true);
    window.removeEventListener('pointercancel', this.handleResizeEnd, true);
  }
}

function promptText(options, key, initial = '') {
  return window.prompt(t(options, key), initial);
}

function setLinkCommand(options, schema) {
  return (state, dispatch, view) => {
    if (!schema.marks.link) return false;
    if (!dispatch || !view) return true;
    const current = schema.marks.link.isInSet(state.storedMarks || state.selection.$from.marks());
    const href = promptText(options, 'Link URL', current?.attrs?.href || 'https://');
    if (!href) return true;
    return toggleMark(schema.marks.link, { href, title: href })(state, dispatch, view);
  };
}

function removeLinkCommand(schema) {
  return (state, dispatch) => {
    if (!schema.marks.link) return false;
    const { from, to } = state.selection;
    if (dispatch) dispatch(state.tr.removeMark(from, to, schema.marks.link).scrollIntoView());
    return true;
  };
}

function selectedTableCellPositions(state, mode) {
  try {
    const rect = selectedRect(state);
    const width = rect.map.width;
    const height = rect.map.height;
    const positions = [];
    if (mode === 'row') {
      const row = rect.top;
      for (let col = 0; col < width; col += 1) positions.push(rect.tableStart + rect.map.map[row * width + col]);
    } else if (mode === 'column') {
      const col = rect.left;
      for (let row = 0; row < height; row += 1) positions.push(rect.tableStart + rect.map.map[row * width + col]);
    } else {
      for (let row = 0; row < height; row += 1) {
        for (let col = 0; col < width; col += 1) positions.push(rect.tableStart + rect.map.map[row * width + col]);
      }
    }
    return [...new Set(positions)];
  } catch {
    return [];
  }
}

function selectTablePartCommand(mode) {
  return (state, dispatch) => {
    const positions = selectedTableCellPositions(state, mode);
    if (!positions.length) return false;
    if (dispatch) {
      const first = state.doc.resolve(positions[0]);
      const last = state.doc.resolve(positions[positions.length - 1]);
      dispatch(state.tr.setSelection(new CellSelection(first, last)).scrollIntoView());
    }
    return true;
  };
}

function colorInput(options, titleKey, value, onChange) {
  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'document-toolbar-color';
  input.value = value;
  input.title = t(options, titleKey);
  input.setAttribute('aria-label', t(options, titleKey));
  input.addEventListener('input', () => onChange(input.value));
  return input;
}

function updateToolbarState(toolbarEl, view) {
  if (!toolbarEl || !view) return;
  toolbarEl.querySelectorAll('.document-toolbar-btn').forEach((btn) => {
    const can = btn.__documentCan;
    const active = btn.__documentActive;
    if (typeof can === 'function') {
      btn.disabled = !can(view.state, view);
    }
    if (typeof active === 'function') {
      btn.classList.toggle('active', Boolean(active(view.state, view)));
    }
  });
}

function toolbarStatePlugin(toolbarEl) {
  return new Plugin({
    view(view) {
      updateToolbarState(toolbarEl, view);
      return {
        update(nextView) {
          updateToolbarState(toolbarEl, nextView);
        },
      };
    },
  });
}

function selectionSnapshotFromView(view) {
  if (!view) return null;
  const { doc, selection } = view.state;
  const from = Number(selection.from || 0);
  const to = Number(selection.to || 0);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null;
  const text = doc.textBetween(from, to, '\n', '\n');
  if (!String(text || '').trim()) return null;
  return { from, to, text };
}

function selectionObserverPlugin(onSelectionChange) {
  return new Plugin({
    view(view) {
      const emit = () => {
        if (typeof onSelectionChange === 'function') onSelectionChange(selectionSnapshotFromView(view));
      };
      emit();
      return {
        update(nextView, prevState) {
          if (prevState && prevState.selection.eq(nextView.state.selection) && prevState.doc === nextView.state.doc) return;
          emit();
        },
        destroy() {
          if (typeof onSelectionChange === 'function') onSelectionChange(null);
        },
      };
    },
  });
}

function button(options, className, label, titleKey, command, config = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `document-toolbar-btn ${className || ''}`.trim();
  btn.textContent = label;
  const title = t(options, titleKey);
  btn.title = title;
  btn.setAttribute('aria-label', title);
  if (typeof config.can === 'function') btn.__documentCan = config.can;
  if (typeof config.active === 'function') btn.__documentActive = config.active;
  btn.addEventListener('click', () => command());
  return btn;
}

function commandButton(options, viewRef, className, label, titleKey, command, config = {}) {
  const can = config.can || ((state, view) => command(state, null, view));
  return button(options, className, label, titleKey, () => run(viewRef.current, command), {
    ...config,
    can,
  });
}

function select(options, titleKey, values, onChange) {
  const items = values.map((item) => (typeof item === 'string' ? { label: item, value: item } : item));
  const wrap = document.createElement('div');
  wrap.className = 'document-toolbar-dropdown';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'document-toolbar-select document-toolbar-dropdown-trigger';
  const title = t(options, titleKey);
  trigger.title = title;
  trigger.setAttribute('aria-label', title);
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.textContent = items[0]?.label || '';
  wrap.appendChild(trigger);

  const panel = document.createElement('div');
  panel.className = 'document-toolbar-dropdown-panel';
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('aria-label', title);
  let selectedValue = items[0]?.value || '';

  const close = () => {
    wrap.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    wrap.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    positionFloatingPanel(trigger, panel);
  };

  items.forEach((item) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'document-toolbar-dropdown-option';
    option.textContent = item.label;
    option.setAttribute('role', 'option');
    option.addEventListener('click', () => {
      selectedValue = item.value;
      trigger.textContent = item.label;
      panel.querySelectorAll('.document-toolbar-dropdown-option').forEach((node) => {
        node.classList.toggle('active', node === option);
        node.setAttribute('aria-selected', node === option ? 'true' : 'false');
      });
      close();
      onChange(selectedValue);
    });
    option.classList.toggle('active', item.value === selectedValue);
    option.setAttribute('aria-selected', item.value === selectedValue ? 'true' : 'false');
    panel.appendChild(option);
  });
  wrap.appendChild(panel);

  trigger.addEventListener('click', () => {
    if (wrap.classList.contains('open')) close();
    else open();
  });
  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) close();
  });
  window.addEventListener('resize', () => {
    if (wrap.classList.contains('open')) positionFloatingPanel(trigger, panel);
  }, { passive: true });
  return wrap;
}

function createTablePicker(options, viewRef) {
  const wrap = document.createElement('div');
  wrap.className = 'document-table-picker';
  const trigger = button(options, 'document-toolbar-table', '▦', 'Insert table', () => {
    wrap.classList.toggle('open');
  });
  wrap.appendChild(trigger);

  const panel = document.createElement('div');
  panel.className = 'document-table-picker-panel';
  const label = document.createElement('div');
  label.className = 'document-table-picker-label';
  label.textContent = '1 x 1';
  panel.appendChild(label);
  const grid = document.createElement('div');
  grid.className = 'document-table-picker-grid';
  const cells = [];
  let selectedRows = 1;
  let selectedCols = 1;
  for (let row = 1; row <= 8; row += 1) {
    for (let col = 1; col <= 8; col += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'document-table-picker-cell';
      cell.addEventListener('mouseenter', () => {
        selectedRows = row;
        selectedCols = col;
        label.textContent = `${row} x ${col}`;
        cells.forEach((item) => {
          item.classList.toggle('active', Number(item.dataset.row) <= row && Number(item.dataset.col) <= col);
        });
      });
      cell.addEventListener('click', () => {
        const view = viewRef.current;
        if (!view) return;
        const table = createTable(view.state.schema, selectedRows, selectedCols);
        view.dispatch(view.state.tr.replaceSelectionWith(table).scrollIntoView());
        view.focus();
        wrap.classList.remove('open');
      });
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      grid.appendChild(cell);
      cells.push(cell);
    }
  }
  panel.appendChild(grid);
  wrap.appendChild(panel);
  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) wrap.classList.remove('open');
  });
  return wrap;
}

function positionFloatingPanel(trigger, panel) {
  const rect = trigger.getBoundingClientRect();
  const gap = 8;
  const panelWidth = panel.offsetWidth || 220;
  const panelHeight = panel.offsetHeight || 160;
  const left = Math.max(gap, Math.min(rect.left, window.innerWidth - panelWidth - gap));
  const belowTop = rect.bottom + gap;
  const aboveTop = rect.top - panelHeight - gap;
  const top = belowTop + panelHeight <= window.innerHeight - gap ? belowTop : Math.max(gap, aboveTop);
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function createTableActionsMenu(options, viewRef, schema) {
  const wrap = document.createElement('div');
  wrap.className = 'document-table-actions';
  const panel = document.createElement('div');
  panel.className = 'document-table-actions-panel';

  const trigger = button(options, 'document-toolbar-table-menu', '⋯', 'Table options', () => {
    wrap.classList.toggle('open');
    if (wrap.classList.contains('open')) positionFloatingPanel(trigger, panel);
  });
  wrap.appendChild(trigger);

  const addAction = (label, titleKey, command, config = {}) => {
    const can = config.can || ((state, view) => command(state, null, view));
    const btn = button(options, '', label, titleKey, () => {
      run(viewRef.current, command);
      wrap.classList.remove('open');
    }, { ...config, can });
    panel.appendChild(btn);
  };

  addAction('＋↧', 'Add row after', addRowAfter);
  addAction('＋↥', 'Add row before', addRowBefore);
  addAction('＋↦', 'Add column after', addColumnAfter);
  addAction('＋↤', 'Add column before', addColumnBefore);
  addAction('−↕', 'Delete row', deleteRow);
  addAction('−↔', 'Delete column', deleteColumn);
  addAction('🗑', 'Delete table', deleteTable);
  addAction('⤢', 'Merge cells', mergeCells);
  addAction('⤡', 'Split cell', splitCell);
  addAction('🏷', 'Toggle header row', toggleHeaderRow);
  addAction('↕', 'Select row', selectTablePartCommand('row'));
  addAction('↔', 'Select column', selectTablePartCommand('column'));
  addAction('▦', 'Select table', selectTablePartCommand('table'));
  panel.appendChild(colorInput(options, 'Cell background', '#1e2c3a', (value) => run(viewRef.current, setCellAttr('background', value))));

  wrap.appendChild(panel);
  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) wrap.classList.remove('open');
  });
  window.addEventListener('resize', () => {
    if (wrap.classList.contains('open')) positionFloatingPanel(trigger, panel);
  }, { passive: true });
  return wrap;
}

function createImageUploadButton(options, viewRef) {
  const wrap = document.createElement('span');
  wrap.className = 'document-image-upload';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.hidden = true;
  let pendingInsertPos = null;
  const captureInsertPos = () => {
    const pos = currentImageInsertPos(viewRef.current);
    if (pos != null) pendingInsertPos = pos;
  };
  const btn = button(options, 'document-toolbar-image', '\u{1F5BC}', 'Insert image', () => {
    captureInsertPos();
    input.click();
  });
  btn.addEventListener('pointerdown', captureInsertPos, { capture: true });
  btn.addEventListener('mousedown', (event) => {
    captureInsertPos();
    event.preventDefault();
  }, { capture: true });
  input.addEventListener('change', () => {
    const view = viewRef.current;
    const insertPos = pendingInsertPos ?? currentImageInsertPos(view);
    pendingInsertPos = null;
    if (view && input.files?.length) {
      uploadAndInsertImage(view, input.files, options, insertPos);
    }
    input.value = '';
  });
  wrap.appendChild(btn);
  wrap.appendChild(input);
  return wrap;
}

function setupToolbarScrollBehavior(toolbarEl) {
  if (!toolbarEl) return;

  let hideTimer = 0;
  let dragging = false;
  let moved = false;
  let suppressClick = false;
  let pointerId = null;
  let pendingDrag = false;
  let startX = 0;
  let startScrollLeft = 0;
  let lastMoveTime = 0;
  let lastMoveScrollLeft = 0;
  let velocity = 0;
  let inertiaFrame = 0;

  const DRAG_SCROLL_MULTIPLIER = 1.35;
  const INERTIA_FRICTION = 0.92;
  const MIN_INERTIA_VELOCITY = 0.04;
  const MAX_INERTIA_VELOCITY = 2.8;

  const canScroll = () => toolbarEl.scrollWidth - toolbarEl.clientWidth > 2;
  const maxScrollLeft = () => Math.max(0, toolbarEl.scrollWidth - toolbarEl.clientWidth);
  const clampScrollLeft = (value) => Math.max(0, Math.min(maxScrollLeft(), value));

  const getGeometry = () => {
    const rect = toolbarEl.getBoundingClientRect();
    const maxScroll = Math.max(0, toolbarEl.scrollWidth - toolbarEl.clientWidth);
    const inset = 8;
    const trackWidth = Math.max(32, toolbarEl.clientWidth - inset * 2);
    const thumbWidth = Math.max(34, Math.round(trackWidth * toolbarEl.clientWidth / Math.max(toolbarEl.scrollWidth, 1)));
    const maxLeft = Math.max(0, trackWidth - thumbWidth);
    return {
      inset,
      maxLeft,
      maxScroll,
      rect,
      thumbWidth: Math.min(trackWidth, thumbWidth),
      trackWidth,
    };
  };

  const updateThumb = () => {
    const thumb = ensureThumb();
    const geometry = getGeometry();
    const isVisible = geometry.rect.width > 0
      && geometry.rect.height > 0
      && geometry.rect.bottom >= 0
      && geometry.rect.top <= window.innerHeight;
    const overflow = geometry.maxScroll > 0 && isVisible;
    toolbarEl.classList.toggle('is-overflowing', overflow);
    if (!overflow) {
      thumb.hidden = true;
      return;
    }
    thumb.hidden = false;
    const left = geometry.rect.left + geometry.inset + Math.round(geometry.maxLeft * (toolbarEl.scrollLeft / geometry.maxScroll));
    const top = geometry.rect.bottom - 6;
    thumb.style.left = `${Math.round(left)}px`;
    thumb.style.top = `${Math.round(top)}px`;
    thumb.style.width = `${geometry.thumbWidth}px`;
  };

  const reveal = () => {
    updateThumb();
    if (!canScroll()) return;
    toolbarEl.classList.add('is-scroll-active');
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!dragging) toolbarEl.classList.remove('is-scroll-active');
    }, 900);
  };

  const stopInertia = () => {
    if (!inertiaFrame) return;
    window.cancelAnimationFrame(inertiaFrame);
    inertiaFrame = 0;
  };

  const startInertia = (initialVelocity) => {
    stopInertia();
    if (!canScroll() || Math.abs(initialVelocity) < MIN_INERTIA_VELOCITY) return;
    let currentVelocity = Math.max(-MAX_INERTIA_VELOCITY, Math.min(MAX_INERTIA_VELOCITY, initialVelocity));
    let previousTime = 0;

    const step = (time) => {
      if (!previousTime) previousTime = time;
      const dt = Math.min(32, Math.max(1, time - previousTime));
      previousTime = time;
      const before = toolbarEl.scrollLeft;
      const next = clampScrollLeft(before + currentVelocity * dt);
      toolbarEl.scrollLeft = next;
      reveal();

      const hitEdge = next <= 0 || next >= maxScrollLeft() || next === before;
      currentVelocity *= Math.pow(INERTIA_FRICTION, dt / 16.67);
      if (hitEdge || Math.abs(currentVelocity) < MIN_INERTIA_VELOCITY) {
        inertiaFrame = 0;
        return;
      }
      inertiaFrame = window.requestAnimationFrame(step);
    };

    inertiaFrame = window.requestAnimationFrame(step);
  };

  const finishDrag = (withInertia = false) => {
    if (!pendingDrag && !dragging) return;
    const releaseVelocity = velocity;
    const shouldInert = withInertia && moved;
    pendingDrag = false;
    dragging = false;
    pointerId = null;
    toolbarEl.classList.remove('is-dragging');
    reveal();
    if (shouldInert) startInertia(releaseVelocity);
  };

  const ensureThumb = () => {
    let thumb = toolbarEl.__documentScrollThumb || null;
    if (!thumb || thumb.parentElement !== toolbarEl) {
      thumb = document.createElement('span');
      thumb.className = 'document-toolbar-scrollbar';
      thumb.setAttribute('aria-hidden', 'true');
      toolbarEl.__documentScrollThumb = thumb;
      toolbarEl.appendChild(thumb);
    }
    return thumb;
  };

  ensureThumb();
  if (toolbarEl.__documentScrollBehaviorBound) {
    toolbarEl.__documentUpdateScrollThumb?.();
    return;
  }
  toolbarEl.__documentScrollBehaviorBound = true;

  toolbarEl.__documentUpdateScrollThumb = updateThumb;

  toolbarEl.addEventListener('scroll', reveal, { passive: true });
  toolbarEl.addEventListener('wheel', (event) => {
    if (!canScroll()) return;
    reveal();
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    toolbarEl.scrollLeft += event.deltaY;
    event.preventDefault();
  }, { passive: false });
  toolbarEl.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.pointerType !== 'mouse' || !canScroll()) return;
    if (event.target?.closest?.('select, input, .document-toolbar-dropdown, .document-table-picker-panel, .document-table-actions-panel')) return;
    stopInertia();
    pendingDrag = true;
    dragging = false;
    moved = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = toolbarEl.scrollLeft;
    lastMoveTime = event.timeStamp || window.performance.now();
    lastMoveScrollLeft = toolbarEl.scrollLeft;
    velocity = 0;
    toolbarEl.classList.add('is-scroll-active');
    reveal();
  });
  window.addEventListener('pointermove', (event) => {
    if (!pendingDrag || event.pointerId !== pointerId) return;
    if (event.buttons !== 1) {
      finishDrag(false);
      return;
    }
    const dx = event.clientX - startX;
    if (Math.abs(dx) > 4) {
      moved = true;
      dragging = true;
      toolbarEl.classList.add('is-dragging');
    }
    if (!moved) return;
    const nextScrollLeft = clampScrollLeft(startScrollLeft - dx * DRAG_SCROLL_MULTIPLIER);
    const now = event.timeStamp || window.performance.now();
    const dt = Math.max(1, now - lastMoveTime);
    velocity = (nextScrollLeft - lastMoveScrollLeft) / dt;
    lastMoveTime = now;
    lastMoveScrollLeft = nextScrollLeft;
    toolbarEl.scrollLeft = nextScrollLeft;
    event.preventDefault();
    reveal();
  }, { passive: false });
  window.addEventListener('pointerup', (event) => {
    if (pointerId !== null && event.pointerId === pointerId && moved) suppressClick = true;
    finishDrag(true);
  }, true);
  window.addEventListener('pointercancel', () => finishDrag(false), true);
  toolbarEl.addEventListener('mousemove', reveal, { passive: true });
  toolbarEl.addEventListener('pointerleave', () => {
    if (dragging) return;
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => toolbarEl.classList.remove('is-scroll-active'), 250);
  });
  toolbarEl.addEventListener('click', (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(toolbarEl);
  } else {
    window.addEventListener('resize', updateThumb);
  }
  window.addEventListener('scroll', updateThumb, { passive: true, capture: true });
  updateThumb();
}

function buildToolbar(options, toolbarEl, viewRef, schema) {
  if (!toolbarEl) return;
  toolbarEl.replaceChildren();
  const addSep = () => {
    const sep = document.createElement('span');
    sep.className = 'document-toolbar-separator';
    toolbarEl.appendChild(sep);
  };
  toolbarEl.appendChild(commandButton(options, viewRef, '', '↶', 'Undo', undoCommand));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '↷', 'Redo', redoCommand));
  addSep();
  toolbarEl.appendChild(select(options, 'Heading', [
    { label: '¶', value: 'paragraph' },
    { label: 'H1', value: 'h1' },
    { label: 'H2', value: 'h2' },
    { label: 'H3', value: 'h3' },
  ], (value) => {
    const view = viewRef.current;
    if (!view) return;
    if (value === 'paragraph') run(view, setBlockType(schema.nodes.paragraph));
    else run(view, setBlockType(schema.nodes.heading, { level: Number(value.slice(1)) }));
  }));
  addSep();
  toolbarEl.appendChild(commandButton(options, viewRef, 'document-toolbar-bold', '𝐁', 'Bold', toggleMark(schema.marks.strong), {
    active: (state) => markActive(state, schema.marks.strong),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, 'document-toolbar-italic', '𝐼', 'Italic', toggleMark(schema.marks.em), {
    active: (state) => markActive(state, schema.marks.em),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, 'document-toolbar-underline', 'U̲', 'Underline', toggleMark(schema.marks.underline), {
    active: (state) => markActive(state, schema.marks.underline),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, 'document-toolbar-code', '⌨', 'Inline code', toggleMark(schema.marks.code), {
    active: (state) => markActive(state, schema.marks.code),
  }));
  toolbarEl.appendChild(colorInput(options, 'Text color', DEFAULT_TEXT_COLORS[0], (value) => applyFontMark(viewRef.current, schema.marks.text_color, { color: value })));
  toolbarEl.appendChild(colorInput(options, 'Highlight', DEFAULT_HIGHLIGHT_COLORS[0], (value) => applyFontMark(viewRef.current, schema.marks.highlight, { color: value })));
  addSep();
  toolbarEl.appendChild(commandButton(options, viewRef, '', '⇤', 'Align left', setTextAlignCommand('left'), {
    active: (state) => textAlignActive(state, 'left'),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '↔', 'Align center', setTextAlignCommand('center'), {
    active: (state) => textAlignActive(state, 'center'),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '⇥', 'Align right', setTextAlignCommand('right'), {
    active: (state) => textAlignActive(state, 'right'),
  }));
  addSep();
  toolbarEl.appendChild(commandButton(options, viewRef, '', '•', 'Bullet list', toggleListCommand(schema, schema.nodes.bullet_list), {
    active: (state) => listActive(state, schema.nodes.bullet_list),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '№', 'Ordered list', toggleListCommand(schema, schema.nodes.ordered_list), {
    active: (state) => listActive(state, schema.nodes.ordered_list),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '☑', 'Checklist', toggleListCommand(schema, schema.nodes.task_list), {
    active: (state) => listActive(state, schema.nodes.task_list),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '❝', 'Quote', toggleBlockquoteCommand(schema), {
    active: (state) => ancestorBlockActive(state, schema.nodes.blockquote),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '💻', 'Code block', toggleCodeBlockCommand(schema), {
    active: (state) => blockActive(state, schema.nodes.code_block),
  }));
  addSep();
  if (typeof options.uploadImage === 'function') {
    toolbarEl.appendChild(createImageUploadButton(options, viewRef));
  }
  toolbarEl.appendChild(commandButton(options, viewRef, '', '🔗', 'Insert link', setLinkCommand(options, schema), {
    active: (state) => markActive(state, schema.marks.link),
  }));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '✂', 'Remove link', removeLinkCommand(schema)));
  toolbarEl.appendChild(commandButton(options, viewRef, '', '🧹', 'Clear formatting', clearFormattingCommand(schema)));
  addSep();
  toolbarEl.appendChild(select(options, 'Font size', [
    { label: 'A↕', value: '' },
    ...DEFAULT_FONT_SIZES,
  ], (value) => applyFontMark(viewRef.current, schema.marks.font_size, value ? { size: value } : null)));
  toolbarEl.appendChild(select(options, 'Font family', [
    { label: '𝐅', value: '' },
    ...DEFAULT_FONT_FAMILIES,
  ], (value) => applyFontMark(viewRef.current, schema.marks.font_family, value ? { family: value } : null)));
  addSep();
  toolbarEl.appendChild(createTablePicker(options, viewRef));
  toolbarEl.appendChild(createTableActionsMenu(options, viewRef, schema));
  setupToolbarScrollBehavior(toolbarEl);
  updateToolbarState(toolbarEl, viewRef.current);
}

function createEditor(options = {}) {
  const editorEl = options.editorEl;
  if (!editorEl) throw new Error('editorEl is required');
  const titleInput = options.titleInput || null;
  const toolbarEl = options.toolbarEl || null;
  const schema = createDocumentSchema();
  const ydoc = new Y.Doc();
  const yXmlFragment = ydoc.getXmlFragment('prosemirror');
  const yTitle = ydoc.getText('title');
  const viewRef = { current: null };
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsBase = options.wsBase || '/doc-ws';
  const serverUrl = options.wsUrl || `${protocol}//${window.location.host}${wsBase}`;
  const params = {};
  if (options.token) params.token = options.token;
  if (options.guestToken) params.guestToken = options.guestToken;
  const provider = new WebsocketProvider(serverUrl, options.room, ydoc, { params });
  let destroyed = false;
  let ready = false;
  let readyResolve = null;
  const readyPromise = new Promise((resolve) => { readyResolve = resolve; });
  const readyTimer = window.setTimeout(() => markReady(), 800);

  function markReady() {
    if (ready || destroyed) return;
    ready = true;
    window.clearTimeout(readyTimer);
    readyResolve?.();
    options.onReady?.();
  }

  const localUser = {
    id: options.user?.id || '',
    name: options.user?.name || 'User',
    color: options.user?.color || '#65aadd',
  };

  provider.awareness.setLocalStateField('user', localUser);

  function emitStatus(status) {
    const count = provider.awareness ? provider.awareness.getStates().size : 0;
    options.onStatusChange?.(status, count);
  }

  const handleProviderStatus = (event) => emitStatus(event.status === 'connected' ? 'online' : 'offline');
  const handleAwarenessChange = () => emitStatus(provider.wsconnected ? 'online' : 'offline');
  const handleProviderSync = (synced) => {
    if (synced !== false) markReady();
  };

  provider.on('status', handleProviderStatus);
  provider.on('sync', handleProviderSync);
  provider.awareness.on('change', handleAwarenessChange);

  const state = EditorState.create({
    schema,
    plugins: [
      ySyncPlugin(yXmlFragment),
      yCursorPlugin(provider.awareness, {
        awarenessStateFilter: createAwarenessStateFilter(provider.awareness, localUser),
        cursorBuilder: createCollabCursor,
        selectionBuilder: createCollabSelection,
      }),
        yUndoPlugin(),
        buildInputRules(schema),
        imageInputPlugin(options, schema),
        keymap({
        'Mod-z': undoCommand,
        'Mod-y': redoCommand,
        'Mod-Shift-z': redoCommand,
        'Enter': chainCommands(splitListItem(schema.nodes.task_item, { checked: false }), splitListItem(schema.nodes.list_item), baseKeymap.Enter),
        'Mod-[': chainCommands(liftListItem(schema.nodes.task_item), liftListItem(schema.nodes.list_item)),
        'Mod-]': chainCommands(sinkListItem(schema.nodes.task_item), sinkListItem(schema.nodes.list_item)),
        'Shift-Ctrl-0': setBlockType(schema.nodes.paragraph),
        'Shift-Ctrl-1': setBlockType(schema.nodes.heading, { level: 1 }),
        'Shift-Ctrl-2': setBlockType(schema.nodes.heading, { level: 2 }),
        'Shift-Ctrl-3': setBlockType(schema.nodes.heading, { level: 3 }),
        'Mod-b': toggleMark(schema.marks.strong),
        'Mod-i': toggleMark(schema.marks.em),
        'Mod-u': toggleMark(schema.marks.underline),
        'Tab': chainCommands(goToNextCell(1), sinkListItem(schema.nodes.task_item), sinkListItem(schema.nodes.list_item)),
        'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(schema.nodes.task_item), liftListItem(schema.nodes.list_item)),
      }),
      keymap(baseKeymap),
      gapCursor(),
      dropCursor(),
      taskListPlugin(schema),
      selectionObserverPlugin(options.onSelectionChange),
      toolbarStatePlugin(toolbarEl),
      columnResizing({ cellMinWidth: 48 }),
      tableEditing(),
    ],
  });

  const view = new EditorView(editorEl, {
    state,
    nodeViews: {
      image: (node, editorView, getPos) => new DocumentImageNodeView(node, editorView, getPos),
      image_block: (node, editorView, getPos) => new DocumentImageNodeView(node, editorView, getPos),
      image_inline: (node, editorView, getPos) => new DocumentImageNodeView(node, editorView, getPos),
    },
  });
  viewRef.current = view;
  buildToolbar(options, toolbarEl, viewRef, schema);

  function syncTitleInput() {
    if (!titleInput) return;
    const value = yTitle.toString() || options.initialTitle || '';
    if (document.activeElement !== titleInput && titleInput.value !== value) {
      titleInput.value = value;
    }
  }

  yTitle.observe(syncTitleInput);
  syncTitleInput();
  const handleTitleInput = () => {
    if (!titleInput) return;
    const next = String(titleInput.value || '').slice(0, 80);
    ydoc.transact(() => {
      yTitle.delete(0, yTitle.length);
      if (next) yTitle.insert(0, next);
    });
  };
  if (titleInput) {
    titleInput.addEventListener('input', handleTitleInput);
  }
  emitStatus('offline');

  return {
    destroy() {
      destroyed = true;
      window.clearTimeout(readyTimer);
      if (titleInput) titleInput.removeEventListener('input', handleTitleInput);
      yTitle.unobserve(syncTitleInput);
      provider.off('status', handleProviderStatus);
      provider.off('sync', handleProviderSync);
      provider.awareness.off('change', handleAwarenessChange);
      provider.destroy();
      view.destroy();
      ydoc.destroy();
    },
    focus() {
      view.focus();
    },
    getSelectionSnapshot() {
      return selectionSnapshotFromView(view);
    },
    getTitle() {
      return yTitle.toString();
    },
    replaceSelectionText(snapshot, text) {
      if (!snapshot || !view) return false;
      const from = Math.max(0, Math.min(Number(snapshot.from || 0), view.state.doc.content.size));
      const to = Math.max(0, Math.min(Number(snapshot.to || 0), view.state.doc.content.size));
      if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return false;
      const currentText = view.state.doc.textBetween(from, to, '\n', '\n');
      if (currentText !== String(snapshot.text || '')) return false;
      view.dispatch(view.state.tr.insertText(String(text || ''), from, to).scrollIntoView());
      view.focus();
      return true;
    },
    provider,
    ready: readyPromise,
    view,
    ydoc,
  };
}

window.BananzaDocumentEditor = {
  createEditor,
};
