const TEXT = {
  ru: {
    start: (id) => `BananZa расшифровывает голосовые сообщения и аудиофайлы.\n\nВаш Telegram ID: ${id}\nПередайте его администратору BananZa для добавления в список доступа.`,
    help: 'Отправьте голосовое сообщение или аудиофайл: WAV, MP3, M4A, OGG/Opus или WebM.',
    denied: (id) => `Доступ к расшифровке не разрешён.\nВаш Telegram ID: ${id}`,
    privateOnly: 'Бот принимает аудио только в личном чате.',
    unsupported: 'Пришлите голосовое сообщение или поддерживаемый аудиофайл.',
    tooLarge: 'Файл слишком большой. Максимальный размер — 20 МБ.',
    busy: 'Очередь занята. Дождитесь завершения предыдущих расшифровок.',
    accepted: 'Файл принят, расшифровываю…',
    failed: 'Не удалось расшифровать файл. Попробуйте отправить его ещё раз.',
    contextWarning: 'Контекстный бот не обработал текст, поэтому отправлена исходная расшифровка.',
  },
  en: {
    start: (id) => `BananZa transcribes voice messages and audio files.\n\nYour Telegram ID: ${id}\nSend it to the BananZa administrator to be added to the access list.`,
    help: 'Send a voice message or an audio file: WAV, MP3, M4A, OGG/Opus, or WebM.',
    denied: (id) => `Transcription access is not allowed.\nYour Telegram ID: ${id}`,
    privateOnly: 'The bot accepts audio only in a private chat.',
    unsupported: 'Send a voice message or a supported audio file.',
    tooLarge: 'The file is too large. Maximum size is 20 MB.',
    busy: 'The queue is busy. Wait for earlier transcriptions to finish.',
    accepted: 'File accepted. Transcribing…',
    failed: 'Could not transcribe the file. Try sending it again.',
    contextWarning: 'The context bot failed, so the raw transcript was sent.',
  },
};

function telegramLanguage(languageCode) {
  return String(languageCode || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

function telegramText(languageCode, key, ...args) {
  const value = TEXT[telegramLanguage(languageCode)]?.[key] || TEXT.en[key] || key;
  return typeof value === 'function' ? value(...args) : value;
}

module.exports = { telegramLanguage, telegramText };

