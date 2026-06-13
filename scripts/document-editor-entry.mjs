import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Schema } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes, wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { baseKeymap, chainCommands, exitCode, setBlockType, toggleMark } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { gapCursor } from 'prosemirror-gapcursor';
import { inputRules, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules';
import { dropCursor } from 'prosemirror-dropcursor';
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  tableEditing,
  tableNodeTypes,
  tableNodes,
} from 'prosemirror-tables';
import { redoCommand, undoCommand, yCursorPlugin, ySyncPlugin, yUndoPlugin } from 'y-prosemirror';

const DEFAULT_FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '32px'];
const DEFAULT_FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'SFMono-Regular, Consolas, monospace' },
];

function t(options, key) {
  const fn = typeof options.t === 'function' ? options.t : null;
  return fn ? fn(key) : key;
}

function normalizeCursorColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? String(color) : '#65aadd';
}

function createCollabCursor(user = {}) {
  const color = normalizeCursorColor(user.color);
  const cursor = document.createElement('span');
  cursor.className = 'document-collab-cursor';
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

function createDocumentSchema() {
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
  const fontSizeMark = {
    attrs: { size: {} },
    parseDOM: [{ style: 'font-size', getAttrs: (value) => ({ size: String(value || '').trim() }) }],
    toDOM: (mark) => ['span', { style: `font-size:${mark.attrs.size}` }, 0],
  };
  const fontFamilyMark = {
    attrs: { family: {} },
    parseDOM: [{ style: 'font-family', getAttrs: (value) => ({ family: String(value || '').trim() }) }],
    toDOM: (mark) => ['span', { style: `font-family:${mark.attrs.family}` }, 0],
  };
  const marks = basicSchema.spec.marks
    .addToEnd('underline', underlineMark)
    .addToEnd('font_size', fontSizeMark)
    .addToEnd('font_family', fontFamilyMark);
  const nodes = addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block')
    .append(tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {},
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

function button(options, className, label, titleKey, command) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `document-toolbar-btn ${className || ''}`.trim();
  btn.textContent = label;
  const title = t(options, titleKey);
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.addEventListener('click', () => command());
  return btn;
}

function select(options, titleKey, values, onChange) {
  const selectEl = document.createElement('select');
  selectEl.className = 'document-toolbar-select';
  selectEl.title = t(options, titleKey);
  selectEl.setAttribute('aria-label', t(options, titleKey));
  values.forEach((item) => {
    const option = document.createElement('option');
    if (typeof item === 'string') {
      option.value = item;
      option.textContent = item;
    } else {
      option.value = item.value;
      option.textContent = item.label;
    }
    selectEl.appendChild(option);
  });
  selectEl.addEventListener('change', () => onChange(selectEl.value));
  return selectEl;
}

function createTablePicker(options, viewRef) {
  const wrap = document.createElement('div');
  wrap.className = 'document-table-picker';
  const trigger = button(options, 'document-toolbar-table', '+', 'Insert table', () => {
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

function buildToolbar(options, toolbarEl, viewRef, schema) {
  if (!toolbarEl) return;
  toolbarEl.replaceChildren();
  const addSep = () => {
    const sep = document.createElement('span');
    sep.className = 'document-toolbar-separator';
    toolbarEl.appendChild(sep);
  };
  toolbarEl.appendChild(button(options, '', '<', 'Undo', () => run(viewRef.current, undoCommand)));
  toolbarEl.appendChild(button(options, '', '>', 'Redo', () => run(viewRef.current, redoCommand)));
  addSep();
  toolbarEl.appendChild(select(options, 'Heading', [
    { label: t(options, 'Text'), value: 'paragraph' },
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
  toolbarEl.appendChild(button(options, 'document-toolbar-bold', 'B', 'Bold', () => run(viewRef.current, toggleMark(schema.marks.strong))));
  toolbarEl.appendChild(button(options, 'document-toolbar-italic', 'I', 'Italic', () => run(viewRef.current, toggleMark(schema.marks.em))));
  toolbarEl.appendChild(button(options, 'document-toolbar-underline', 'U', 'Underline', () => run(viewRef.current, toggleMark(schema.marks.underline))));
  addSep();
  toolbarEl.appendChild(button(options, '', '-', 'Bullet list', () => run(viewRef.current, wrapInList(schema.nodes.bullet_list))));
  toolbarEl.appendChild(button(options, '', '1.', 'Ordered list', () => run(viewRef.current, wrapInList(schema.nodes.ordered_list))));
  addSep();
  toolbarEl.appendChild(select(options, 'Font size', [
    { label: t(options, 'Size'), value: '' },
    ...DEFAULT_FONT_SIZES,
  ], (value) => applyFontMark(viewRef.current, schema.marks.font_size, value ? { size: value } : null)));
  toolbarEl.appendChild(select(options, 'Font family', [
    { label: t(options, 'Font'), value: '' },
    ...DEFAULT_FONT_FAMILIES,
  ], (value) => applyFontMark(viewRef.current, schema.marks.font_family, value ? { family: value } : null)));
  addSep();
  toolbarEl.appendChild(createTablePicker(options, viewRef));
  toolbarEl.appendChild(button(options, '', '+R', 'Add row after', () => run(viewRef.current, addRowAfter)));
  toolbarEl.appendChild(button(options, '', 'R+', 'Add row before', () => run(viewRef.current, addRowBefore)));
  toolbarEl.appendChild(button(options, '', '+C', 'Add column after', () => run(viewRef.current, addColumnAfter)));
  toolbarEl.appendChild(button(options, '', 'C+', 'Add column before', () => run(viewRef.current, addColumnBefore)));
  toolbarEl.appendChild(button(options, '', 'R-', 'Delete row', () => run(viewRef.current, deleteRow)));
  toolbarEl.appendChild(button(options, '', 'C-', 'Delete column', () => run(viewRef.current, deleteColumn)));
  toolbarEl.appendChild(button(options, '', 'T-', 'Delete table', () => run(viewRef.current, deleteTable)));
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

  provider.awareness.setLocalStateField('user', {
    name: options.user?.name || 'User',
    color: options.user?.color || '#65aadd',
  });

  function emitStatus(status) {
    const count = provider.awareness ? provider.awareness.getStates().size : 0;
    options.onStatusChange?.(status, count);
  }

  provider.on('status', (event) => emitStatus(event.status === 'connected' ? 'online' : 'offline'));
  provider.awareness.on('change', () => emitStatus(provider.wsconnected ? 'online' : 'offline'));

  const state = EditorState.create({
    schema,
    plugins: [
      ySyncPlugin(yXmlFragment),
      yCursorPlugin(provider.awareness, {
        cursorBuilder: createCollabCursor,
        selectionBuilder: createCollabSelection,
      }),
      yUndoPlugin(),
      buildInputRules(schema),
      keymap({
        'Mod-z': undoCommand,
        'Mod-y': redoCommand,
        'Mod-Shift-z': redoCommand,
        'Enter': chainCommands(splitListItem(schema.nodes.list_item), baseKeymap.Enter),
        'Mod-[': liftListItem(schema.nodes.list_item),
        'Mod-]': sinkListItem(schema.nodes.list_item),
        'Shift-Ctrl-0': setBlockType(schema.nodes.paragraph),
        'Shift-Ctrl-1': setBlockType(schema.nodes.heading, { level: 1 }),
        'Shift-Ctrl-2': setBlockType(schema.nodes.heading, { level: 2 }),
        'Shift-Ctrl-3': setBlockType(schema.nodes.heading, { level: 3 }),
        'Mod-b': toggleMark(schema.marks.strong),
        'Mod-i': toggleMark(schema.marks.em),
        'Mod-u': toggleMark(schema.marks.underline),
        'Tab': sinkListItem(schema.nodes.list_item),
        'Shift-Tab': liftListItem(schema.nodes.list_item),
      }),
      keymap(baseKeymap),
      gapCursor(),
      dropCursor(),
      columnResizing({ cellMinWidth: 48 }),
      tableEditing(),
    ],
  });

  const view = new EditorView(editorEl, { state });
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
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      const next = String(titleInput.value || '').slice(0, 80);
      ydoc.transact(() => {
        yTitle.delete(0, yTitle.length);
        if (next) yTitle.insert(0, next);
      });
    });
  }
  emitStatus('offline');

  return {
    destroy() {
      yTitle.unobserve(syncTitleInput);
      provider.destroy();
      view.destroy();
      ydoc.destroy();
    },
    focus() {
      view.focus();
    },
    getTitle() {
      return yTitle.toString();
    },
    provider,
    view,
    ydoc,
  };
}

window.BananzaDocumentEditor = {
  createEditor,
};
