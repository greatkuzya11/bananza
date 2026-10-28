const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { initMessageAttachmentsSchema, createMessageAttachments } = require('../../messageAttachments');

test('attachment schema upgrades legacy messages without losing files and rolls back invalid albums', () => {
  const db = new Database(':memory:');
  try {
    db.pragma('foreign_keys = ON');
    db.exec(`CREATE TABLE files(id INTEGER PRIMARY KEY, original_name TEXT, stored_name TEXT,
      mime_type TEXT, size INTEGER, type TEXT, uploaded_by INTEGER);
      CREATE TABLE messages(id INTEGER PRIMARY KEY, file_id INTEGER REFERENCES files(id));
      CREATE TABLE document_assets(file_id INTEGER);
      CREATE TABLE voice_messages(transcription_file_id INTEGER);
      INSERT INTO files VALUES(1,'old.png','old.png','image/png',3,'image',7);
      INSERT INTO files VALUES(2,'new.txt','new.txt','text/plain',5,'document',7);
      INSERT INTO messages VALUES(1,1);`);
    initMessageAttachmentsSchema(db);
    initMessageAttachmentsSchema(db);
    const service = createMessageAttachments(db);
    assert.equal(service.get(1)[0].file_name, 'old.png');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM message_attachments').get().count, 0);
    assert.deepEqual(service.validate({ fileId: 1 }, 7), [1]);
    assert.throws(() => service.validate({ fileIds: [1] }, 8), /not available/);
    assert.throws(() => service.validate({ fileIds: [1, 1] }, 7), /unique/);
    assert.throws(() => db.transaction(() => {
      db.prepare('INSERT INTO messages VALUES(2,1)').run();
      service.save(2, [1, 999]);
    })(), /FOREIGN KEY/);
    assert.equal(db.prepare('SELECT * FROM messages WHERE id=2').get(), undefined);
    db.prepare('INSERT INTO messages VALUES(3,2)').run();
    service.save(3, [2, 1]);
    assert.deepEqual(service.get(3).map(file => file.file_id), [2, 1]);
    db.prepare('DELETE FROM messages WHERE id=3').run();
    assert.equal(service.isReferenced(1), true);
    assert.equal(service.isReferenced(2), false);
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
    assert.deepEqual(db.pragma('foreign_key_check'), []);
  } finally { db.close(); }
});
