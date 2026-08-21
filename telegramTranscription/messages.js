const TEXT = {
  ru: {
    start: (id) => `BananZa расшифровывает голосовые сообщения и аудиофайлы.\n\nВаш Telegram ID: ${id}\nПередайте его администратору BananZa для добавления в список доступа.`,
    startImage: (id) => `BananZa создаёт изображения по текстовому описанию.\n\nВаш Telegram ID: ${id}\nПередайте его администратору BananZa для добавления в список доступа.`,
    startCombined: (id) => `BananZa расшифровывает аудио и создаёт изображения по текстовому описанию.\n\nВаш Telegram ID: ${id}\nПередайте его администратору BananZa для добавления в список доступа.`,
    help: 'Отправьте голосовое сообщение или аудиофайл: WAV, MP3, M4A, OGG/Opus или WebM.',
    helpImage: 'Отправьте текстовое описание — BananZa создаст по нему одно изображение.',
    helpCombined: 'Отправьте голосовое сообщение или аудиофайл для расшифровки либо текстовое описание для создания изображения.',
    denied: (id) => `Доступ к расшифровке не разрешён.\nВаш Telegram ID: ${id}`,
    privateOnly: 'Бот принимает аудио только в личном чате.',
    unsupported: 'Пришлите голосовое сообщение или поддерживаемый аудиофайл.',
    unsupportedImage: 'Пришлите текстовое описание изображения.',
    unsupportedCombined: 'Пришлите аудиофайл для расшифровки или текстовое описание изображения.',
    transcriptionDisabled: 'Транскрибация аудио сейчас выключена.',
    imageGenerationDisabled: 'Генерация изображений сейчас выключена.',
    imageBotUnavailable: 'Выбранный image-бот недоступен. Обратитесь к администратору BananZa.',
    promptTooLong: 'Описание слишком длинное. Максимум — 4000 символов.',
    tooLarge: 'Файл слишком большой. Максимальный размер — 20 МБ.',
    busy: 'Очередь занята. Дождитесь завершения предыдущих расшифровок.',
    accepted: 'Файл принят, расшифровываю…',
    imageAccepted: 'Описание принято, создаю изображение…',
    imageFromTranscriptAccepted: 'Расшифровка готова, создаю изображение…',
    imageReady: 'Изображение готово.',
    imageFailed: 'Не удалось создать или отправить изображение. Попробуйте ещё раз.',
    imageRiskRejected: 'Описание отклонено фильтром безопасности выбранного image-бота.',
    imageTooLarge: 'Готовое изображение слишком большое для отправки через Telegram.',
    failed: 'Не удалось расшифровать файл. Попробуйте отправить его ещё раз.',
    contextWarning: 'Контекстный бот не обработал текст, поэтому отправлена исходная расшифровка.',
  },
  en: {
    start: (id) => `BananZa transcribes voice messages and audio files.\n\nYour Telegram ID: ${id}\nSend it to the BananZa administrator to be added to the access list.`,
    startImage: (id) => `BananZa creates images from text descriptions.\n\nYour Telegram ID: ${id}\nSend it to the BananZa administrator to be added to the access list.`,
    startCombined: (id) => `BananZa transcribes audio and creates images from text descriptions.\n\nYour Telegram ID: ${id}\nSend it to the BananZa administrator to be added to the access list.`,
    help: 'Send a voice message or an audio file: WAV, MP3, M4A, OGG/Opus, or WebM.',
    helpImage: 'Send a text description and BananZa will create one image from it.',
    helpCombined: 'Send a voice message or audio file for transcription, or a text description to create an image.',
    denied: (id) => `Transcription access is not allowed.\nYour Telegram ID: ${id}`,
    privateOnly: 'The bot accepts audio only in a private chat.',
    unsupported: 'Send a voice message or a supported audio file.',
    unsupportedImage: 'Send a text description of the image.',
    unsupportedCombined: 'Send audio for transcription or a text description of the image.',
    transcriptionDisabled: 'Audio transcription is currently disabled.',
    imageGenerationDisabled: 'Image generation is currently disabled.',
    imageBotUnavailable: 'The selected image bot is unavailable. Contact the BananZa administrator.',
    promptTooLong: 'The description is too long. Maximum length is 4000 characters.',
    tooLarge: 'The file is too large. Maximum size is 20 MB.',
    busy: 'The queue is busy. Wait for earlier transcriptions to finish.',
    accepted: 'File accepted. Transcribing…',
    imageAccepted: 'Description accepted. Creating the image…',
    imageFromTranscriptAccepted: 'Transcription is ready. Creating the image…',
    imageReady: 'The image is ready.',
    imageFailed: 'Could not create or send the image. Try again.',
    imageRiskRejected: 'The description was rejected by the selected image bot safety filter.',
    imageTooLarge: 'The generated image is too large to send through Telegram.',
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
