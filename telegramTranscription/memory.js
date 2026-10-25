// Memory is local to one Telegram bot, private chat and allowed user. Image bytes
// live in SQLite so pruning, deletion and backup do not leave orphaned files.
function createConversationMemory(db) {
  function history(job, limit) {
    return db.prepare(`SELECT id, update_id, role, text, image_mime_type, image_file_name,
        image_data IS NOT NULL AS has_image FROM telegram_conversation_messages
      WHERE telegram_bot_id=? AND telegram_chat_id=? AND telegram_user_id=? AND update_id<?
      ORDER BY update_id DESC, id DESC LIMIT ?`).all(
      job.telegram_bot_id, job.telegram_chat_id, job.telegram_user_id, job.update_id, limit,
    ).reverse();
  }

  function loadImage(job, id) {
    const row = db.prepare(`SELECT image_data, image_mime_type, image_file_name FROM telegram_conversation_messages
      WHERE id=? AND telegram_bot_id=? AND telegram_chat_id=? AND telegram_user_id=? AND update_id<?`).get(
      id, job.telegram_bot_id, job.telegram_chat_id, job.telegram_user_id, job.update_id,
    );
    return row?.image_data?.length ? {
      buffer: row.image_data, mimeType: row.image_mime_type, filename: row.image_file_name,
    } : null;
  }

  const save = db.transaction((job, revision, userImage, result) => {
    const settings = db.prepare('SELECT * FROM telegram_bots WHERE id=?').get(job.telegram_bot_id);
    if (!settings?.memory_enabled || Number(settings.memory_revision) !== Number(revision)) return;
    const insert = db.prepare(`INSERT OR IGNORE INTO telegram_conversation_messages(
      telegram_bot_id, telegram_chat_id, telegram_user_id, update_id, role, text,
      image_data, image_mime_type, image_file_name) VALUES(?,?,?,?,?,?,?,?,?)`);
    for (const [role, text, image] of [
      ['user', job.prompt_text || '', userImage],
      ['assistant', result.text || '', result.buffer?.length ? result : null],
    ]) {
      insert.run(job.telegram_bot_id, job.telegram_chat_id, job.telegram_user_id, job.update_id,
        role, text, image?.buffer || null, image?.mimeType || null, image?.filename || null);
    }
    db.prepare(`DELETE FROM telegram_conversation_messages
      WHERE telegram_bot_id=? AND telegram_chat_id=? AND telegram_user_id=? AND id NOT IN (
        SELECT id FROM telegram_conversation_messages
        WHERE telegram_bot_id=? AND telegram_chat_id=? AND telegram_user_id=?
        ORDER BY update_id DESC, id DESC LIMIT ?
      )`).run(job.telegram_bot_id, job.telegram_chat_id, job.telegram_user_id,
      job.telegram_bot_id, job.telegram_chat_id, job.telegram_user_id, settings.memory_message_limit);
  });
  return { history, loadImage, save };
}

module.exports = { createConversationMemory };
