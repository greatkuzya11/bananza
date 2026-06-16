const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const Y = require('yjs');

const repoRoot = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const noBackup = args.has('--no-backup');
const chatArg = process.argv.slice(2).find((arg) => arg.startsWith('--chat-id='));
const chatIdFilter = chatArg ? Number(chatArg.slice('--chat-id='.length)) : 0;
const dbPath = path.join(repoRoot, 'bananza.db');
const uploadsDir = path.join(repoRoot, 'uploads');

function usage() {
  console.log([
    'Usage: node scripts/repair_document_image_assets.js [--apply] [--chat-id=ID] [--no-backup]',
    '',
    'Dry-run is the default. With --apply, missing document image assets are appended',
    'to the end of their document as inline images. Exact original positions cannot',
    'be recovered if the Yjs image nodes were already deleted.',
  ].join('\n'));
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}

function documentAssetUrl(storedName) {
  return `/uploads/${encodeURIComponent(String(storedName || ''))}/preview`;
}

function walkYTypes(type, visit) {
  if (!type || typeof type.toArray !== 'function') return;
  type.toArray().forEach((child) => {
    visit(child);
    walkYTypes(child, visit);
  });
}

function collectVisibleImages(fragment) {
  const images = [];
  walkYTypes(fragment, (node) => {
    if (!(node instanceof Y.XmlElement)) return;
    if (!['image', 'image_block', 'image_inline'].includes(node.nodeName)) return;
    images.push(node);
  });
  return images;
}

function assetKey(value) {
  const text = String(value || '').trim();
  return text || null;
}

function setImageAttrs(image, asset) {
  image.setAttribute('assetId', String(asset.id));
  image.setAttribute('src', documentAssetUrl(asset.stored_name));
  image.setAttribute('width', 420);
  image.setAttribute('x', 0);
  image.setAttribute('y', 0);
  image.setAttribute('zIndex', 1);
  image.setAttribute('caption', '');
  image.setAttribute('alt', asset.original_name || '');
}

function setAttrs(target, attrs = {}) {
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== null && value !== undefined) target.setAttribute(key, value);
  });
}

function appendRestoredImage(fragment, asset) {
  const paragraph = new Y.XmlElement('paragraph');
  fragment.push([paragraph]);
  const image = new Y.XmlElement('image');
  paragraph.push([image]);
  setImageAttrs(image, asset);
}

function wrapTopLevelInlineImages(fragment) {
  let wrapped = 0;
  for (let index = fragment.length - 1; index >= 0; index -= 1) {
    const node = fragment.get(index);
    if (!(node instanceof Y.XmlElement) || node.nodeName !== 'image') continue;
    const attrs = node.getAttributes();
    fragment.delete(index, 1);
    const paragraph = new Y.XmlElement('paragraph');
    fragment.insert(index, [paragraph]);
    const image = new Y.XmlElement('image');
    paragraph.push([image]);
    setAttrs(image, attrs);
    wrapped += 1;
  }
  return wrapped;
}

function countTopLevelInlineImages(fragment) {
  return fragment.toArray().filter((node) => node instanceof Y.XmlElement && node.nodeName === 'image').length;
}

function isEmptyParagraph(node) {
  if (!(node instanceof Y.XmlElement) || node.nodeName !== 'paragraph') return false;
  const children = node.toArray();
  if (!children.length) return true;
  return children.every((child) => child instanceof Y.XmlText && child.length === 0);
}

function removeTrailingEmptyParagraphs(fragment) {
  let removed = 0;
  while (fragment.length > 0) {
    const last = fragment.get(fragment.length - 1);
    if (!isEmptyParagraph(last)) break;
    fragment.delete(fragment.length - 1, 1);
    removed += 1;
  }
  return removed;
}

function backupDatabase() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(repoRoot, `bananza.db.before-document-image-repair-${stamp}`);
  fs.copyFileSync(dbPath, target);
  ['-wal', '-shm'].forEach((suffix) => {
    const source = `${dbPath}${suffix}`;
    if (fs.existsSync(source)) fs.copyFileSync(source, `${target}${suffix}`);
  });
  return target;
}

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

let backupPath = null;
if (apply && !noBackup) {
  backupPath = backupDatabase();
}

const db = new Database(dbPath);
try {
  const docs = db.prepare(`
    SELECT c.id, c.name, d.title, d.ydoc_state
    FROM documents d
    JOIN chats c ON c.id=d.chat_id
    ${chatIdFilter ? 'WHERE c.id=?' : ''}
    ORDER BY c.id
  `).all(...(chatIdFilter ? [chatIdFilter] : []));
  const assetsByChat = new Map();
  db.prepare(`
    SELECT da.id, da.chat_id, da.file_id, da.created_at,
      f.stored_name, f.original_name, f.mime_type
    FROM document_assets da
    JOIN files f ON f.id=da.file_id
    ${chatIdFilter ? 'WHERE da.chat_id=?' : ''}
    ORDER BY da.chat_id, da.id
  `).all(...(chatIdFilter ? [chatIdFilter] : [])).forEach((asset) => {
    if (!fs.existsSync(path.join(uploadsDir, path.basename(String(asset.stored_name || ''))))) {
      asset.missing_file = true;
    }
    if (!assetsByChat.has(asset.chat_id)) assetsByChat.set(asset.chat_id, []);
    assetsByChat.get(asset.chat_id).push(asset);
  });

  const updateDoc = db.prepare('UPDATE documents SET ydoc_state=?, updated_at=datetime(\'now\') WHERE chat_id=?');
  const results = [];

  const tx = db.transaction(() => {
    docs.forEach((doc) => {
      const assets = assetsByChat.get(doc.id) || [];
      if (!assets.length) return;

      const ydoc = new Y.Doc();
      if (doc.ydoc_state) Y.applyUpdate(ydoc, new Uint8Array(doc.ydoc_state));
      const fragment = ydoc.getXmlFragment('prosemirror');
      const images = collectVisibleImages(fragment);
      const visibleAssetIds = new Set();
      const visibleSrcs = new Set();
      let repairedAttrs = 0;

      images.forEach((image) => {
        const attrs = image.getAttributes();
        const id = assetKey(attrs.assetId);
        const src = assetKey(attrs.src);
        if (id) visibleAssetIds.add(id);
        if (src) visibleSrcs.add(src);
        const asset = id ? assets.find((row) => String(row.id) === id) : null;
        if (asset && !src) {
          image.setAttribute('src', documentAssetUrl(asset.stored_name));
          image.setAttribute('alt', attrs.alt || asset.original_name || '');
          repairedAttrs += 1;
        }
      });

      const missing = assets.filter((asset) => (
        !asset.missing_file
        && !visibleAssetIds.has(String(asset.id))
        && !visibleSrcs.has(documentAssetUrl(asset.stored_name))
      ));
      let removedEmptyParagraphs = 0;
      let wrappedTopLevelImages = 0;
      const topLevelInlineImages = countTopLevelInlineImages(fragment);

      if (apply && (missing.length || repairedAttrs || topLevelInlineImages)) {
        ydoc.transact(() => {
          wrappedTopLevelImages = wrapTopLevelInlineImages(fragment);
          if (missing.length) removedEmptyParagraphs = removeTrailingEmptyParagraphs(fragment);
          missing.forEach((asset) => appendRestoredImage(fragment, asset));
        });
        updateDoc.run(Buffer.from(Y.encodeStateAsUpdate(ydoc)), doc.id);
      }

      results.push({
        chat_id: doc.id,
        title: doc.title || doc.name,
        assets: assets.length,
        visible_images: images.length,
        missing_assets: missing.length,
        missing_files: assets.filter((asset) => asset.missing_file).length,
        repaired_attrs: repairedAttrs,
        removed_empty_trailing_paragraphs: removedEmptyParagraphs,
        wrapped_top_level_images: wrappedTopLevelImages,
      });
      ydoc.destroy();
    });
  });

  tx();

  console.log(JSON.stringify({
    applied: apply,
    backup: backupPath,
    documents: results,
  }, null, 2));
} finally {
  db.close();
}
