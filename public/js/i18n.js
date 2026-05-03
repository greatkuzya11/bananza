(function () {
  'use strict';

  const STORAGE_KEY = 'bananza.uiLanguage';
  const SUPPORTED = new Set(['ru', 'en']);
  const DEFAULT_LANGUAGE = 'ru';

  const RU = {
    'BananZa Login': 'BananZa - вход',
    'Self-hosted messenger': 'Локальный мессенджер',
    'Sign In': 'Войти',
    'Sign Up': 'Регистрация',
    'Username': 'Имя пользователя',
    'Password': 'Пароль',
    'Confirm Password': 'Подтвердите пароль',
    'Display Name': 'Отображаемое имя',
    'Display Name (optional)': 'Отображаемое имя (необязательно)',
    'Create Account': 'Создать аккаунт',
    'First registered user becomes admin': 'Первый зарегистрированный пользователь станет админом',
    'Registration Successful!': 'Регистрация успешна!',
    'Welcome to BananZa. Redirecting to chat...': 'Добро пожаловать в BananZa. Переходим в чат...',
    'Go to Chat': 'Перейти в чат',
    'Show password': 'Показать пароль',
    'Passwords do not match': 'Пароли не совпадают',
    'Error': 'Ошибка',
    'Registration failed': '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f',
    'Login failed': '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0439\u0442\u0438',
    'Too many attempts': '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a',
    'Too many messages': '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439',
    'Too many uploads': '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0437\u0430\u0433\u0440\u0443\u0437\u043e\u043a',
    'Too many push requests': '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e push-\u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432',
    'Username and password required': '\u041d\u0443\u0436\u043d\u044b \u043b\u043e\u0433\u0438\u043d \u0438 \u043f\u0430\u0440\u043e\u043b\u044c',
    'Username: 3-20 characters': '\u041b\u043e\u0433\u0438\u043d: 3-20 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432',
    'Username: letters, numbers, underscores only': '\u041b\u043e\u0433\u0438\u043d: \u0442\u043e\u043b\u044c\u043a\u043e \u0431\u0443\u043a\u0432\u044b, \u0446\u0438\u0444\u0440\u044b \u0438 \u043d\u0438\u0436\u043d\u0435\u0435 \u043f\u043e\u0434\u0447\u0435\u0440\u043a\u0438\u0432\u0430\u043d\u0438\u0435',
    'Password: 6-100 characters': '\u041f\u0430\u0440\u043e\u043b\u044c: 6-100 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432',
    'Username taken': '\u041b\u043e\u0433\u0438\u043d \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442',
    'Server error': '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430',
    'Invalid credentials': '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043b\u043e\u0433\u0438\u043d \u0438\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c',
    'Account blocked': '\u0410\u043a\u043a\u0430\u0443\u043d\u0442 \u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d',
    'Unauthorized': '\u041d\u0443\u0436\u0435\u043d \u0432\u0445\u043e\u0434 \u0432 \u0430\u043a\u043a\u0430\u0443\u043d\u0442',
    'Blocked': '\u0417\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043e',
    'Invalid token': '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0442\u043e\u043a\u0435\u043d',
    'Admin only': '\u0422\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u0430\u0434\u043c\u0438\u043d\u0430',
    'Unknown interface language': '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u044f\u0437\u044b\u043a \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430',
    'Push server keys are not configured': 'Push-\u043a\u043b\u044e\u0447\u0438 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u044b',
    'Invalid push subscription': '\u041d\u0435\u0432\u0435\u0440\u043d\u0430\u044f push-\u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0430',
    'Endpoint is required': '\u041d\u0443\u0436\u0435\u043d endpoint',
    'No active push subscription for this account': '\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430 \u043d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0439 push-\u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0438',

    'Menu': 'Меню',
    'Refresh chats': 'Обновить чаты',
    'Search chats': 'Поиск чатов',
    'Chat folders': 'Папки чатов',
    'New chat': 'Новый чат',
    'Search chats...': 'Искать чаты...',
    'Close search': 'Закрыть поиск',
    'Pull to refresh': 'Потяните для обновления',
    'Weather': 'Погода',
    'Settings': 'Настройки',
    'Welcome to BananZa': 'Добро пожаловать в BananZa',
    'Select a chat to start messaging': 'Выберите чат, чтобы начать переписку',
    'Back to chats': 'Назад к чатам',
    'Search messages': 'Поиск сообщений',
    'Search messages...': 'Искать сообщения...',
    'Chat settings': 'Настройки чата',
    'Load earlier messages': 'Загрузить ранние сообщения',
    'Loading newer messages...': 'Загружаем новые сообщения...',
    'AI mode': 'AI-режим',
    'Mode': 'Режим',
    'Document format': 'Формат документа',
    'Markdown (.md)': 'Markdown (.md)',
    'Plain text (.txt)': 'Обычный текст (.txt)',
    'Attach file': 'Прикрепить файл',
    'Create poll': 'Создать опрос',
    'Emoji': 'Эмодзи',
    'Message...': 'Сообщение...',
    'Open mentions': 'Открыть упоминания',
    'Send': 'Отправить',
    'Scroll to bottom': 'Вниз к последним',
    'Transform text': 'Преобразовать текст',
    'Drop file to upload': 'Перетащите файл для загрузки',
    '📎 Drop file to upload': '📎 Перетащите файл для загрузки',

    'New Chat': 'Новый чат',
    'Private': 'Личный',
    'Group': 'Группа',
    'Folder': 'Папка',
    'Group name': 'Название группы',
    'Folder name': 'Название папки',
    'Find chats...': 'Найти чаты...',
    'Create Group': 'Создать группу',
    'Create Folder': 'Создать папку',
    'Manage folders': 'Управление папками',
    'Manual folders': 'Ручные папки',
    'Auto folders': 'Автопапки',
    'Save': 'Сохранить',

    'Admin Panel': 'Панель администратора',
    'Bot Audit': 'Аудит ботов',
    'Profile': 'Профиль',
    'Avatar Color': 'Цвет аватара',
    'Logout': 'Выйти',
    'Change Password': 'Сменить пароль',
    'Current Password': 'Текущий пароль',
    'New Password': 'Новый пароль',
    'Confirm New Password': 'Подтвердите новый пароль',

    'Send by Enter': 'Отправка по Enter',
    '⌨ Send by Enter': '⌨ Отправка по Enter',
    'When off, press Ctrl+Enter to send. Enter adds a new line.': 'Если выключено, Ctrl+Enter отправляет, Enter добавляет новую строку.',
    'Restore scroll position': 'Восстанавливать позицию прокрутки',
    '📌 Restore scroll position': '📌 Восстанавливать позицию прокрутки',
    'When on, returns to where you left off. When off, always scrolls to the latest message.': 'Если включено, чат вернется к месту, где вы остановились. Если выключено, откроется последнее сообщение.',
    'Open last chat on reload': 'Открывать последний чат при перезагрузке',
    '💬 Open last chat on reload': '💬 Открывать последний чат при перезагрузке',
    'When off, reload opens the chat list instead of the last opened chat.': 'Если выключено, после перезагрузки откроется список чатов.',
    'Theme': 'Тема',
    '🎨 Theme': '🎨 Тема',
    'Rich Banan UX': 'Насыщенный Banan UX',
    '🍌 Rich Banan UX': '🍌 Насыщенный Banan UX',
    'Animation': 'Анимация',
    '✨ Animation': '✨ Анимация',
    'Font Size (mobile)': 'Размер шрифта (мобильный)',
    '🔠 Font Size (mobile)': '🔠 Размер шрифта (мобильный)',
    '⛅ Weather': '⛅ Погода',
    'Notifications': 'Уведомления',
    '🔔 Notifications': '🔔 Уведомления',
    'Уведомления': 'Уведомления',
    '🔔 Уведомления': '🔔 Уведомления',
    'Sounds': 'Звуки',
    '🔊 Sounds': '🔊 Звуки',
    'Звуки': 'Звуки',
    '🔊 Звуки': '🔊 Звуки',
    '🔑 Change Password': '🔑 Сменить пароль',
    '🛡 Admin Panel': '🛡 Панель администратора',
    '🤖 OpenAI AI': '🤖 OpenAI AI',
    'AI-Яндекс': 'AI-Яндекс',
    '🐓 AI-Яндекс': '🐓 AI-Яндекс',
    '🐋 DeepSeek AI': '🐋 DeepSeek AI',
    '𝕏 Grok AI': '𝕏 Grok AI',
    'Interface language': 'Язык интерфейса',
    '🌐 Interface language': '🌐 Язык интерфейса',
    'Interface language: Russian': 'Язык интерфейса: русский',
    'Interface language: English': 'Язык интерфейса: английский',
    'Language saved': 'Язык сохранен',
    'Language save failed': 'Не удалось сохранить язык',
    'Russian': 'Русский',
    'English': 'English',
    'Application interface in Russian': 'Интерфейс приложения на русском языке',
    'Application interface in English': 'Интерфейс приложения на английском языке',

    'Choose Poll Style': 'Выбор стиля опроса',
    'Selected poll style': 'Выбранный стиль опроса',
    'Poll Style: Pulse': 'Стиль опроса: Pulse',
    'Pulse': 'Pulse',
    'Stack': 'Stack',
    'Orbit': 'Orbit',
    'Hero gradients and bold result cards': 'Яркие градиенты и крупные карточки результатов',
    'Compact rows with dense readable stats': 'Компактные строки с плотной и понятной статистикой',
    'Mini chart with colorful legend blocks': 'Мини-график с цветной легендой',
    'Applies to this poll only': 'Применяется только к этому опросу',
    'Create Poll': 'Создать опрос',
    'Question': 'Вопрос',
    'What should we vote on?': 'За что голосуем?',
    'Options': 'Варианты',
    '2-10 options': '2-10 вариантов',
    'Add option': 'Добавить вариант',
    'Allow multiple answers': 'Разрешить несколько ответов',
    'Show who voted': 'Показывать, кто голосовал',
    'Auto-close': 'Автозакрытие',
    'No timer': 'Без таймера',
    '1 hour': '1 час',
    '4 hours': '4 часа',
    '24 hours': '24 часа',
    '3 days': '3 дня',
    '7 days': '7 дней',
    'Send Poll': 'Отправить опрос',
    'Voters': 'Голосовавшие',
    'No voters yet': 'Голосов пока нет',

    'Keeps your selected theme colors, but changes the depth, gradients and surfaces.': 'Сохраняет цвета темы, но меняет глубину, градиенты и поверхности.',
    'Off': 'Выкл.',
    'On': 'Вкл.',
    'Classic flat theme surfaces.': 'Классические плоские поверхности темы.',
    'Layered gradients, glass cards and theme-colored glow.': 'Слоистые градиенты, стеклянные карточки и подсветка в цвет темы.',
    'Classic blue': 'Классический синий',
    'Grass + signal': 'Трава + сигнал',
    'Navy + teal': 'Морской + бирюзовый',
    'Graphite + aurora': 'Графит + аврора',
    'Plum + rose': 'Слива + роза',
    'Violet + pink': 'Фиолетовый + розовый',
    'Ink + electric blue': 'Чернила + электрический синий',
    'Soft': 'Мягкая',
    'Lift': 'Подъем',
    'Zoom': 'Зум',
    'Slide': 'Слайд',
    'Fade': 'Затухание',
    'None': 'Без анимации',
    'Stronger lift with a smooth modal feel.': 'Более заметный подъем и плавное ощущение модалки.',
    'More vertical travel and a clearer close motion.': 'Больше вертикального движения и понятное закрытие.',
    'Content pops from scale with a dense backdrop.': 'Контент появляется из масштаба с плотной подложкой.',
    'More obvious upward slide, closer to a sheet feel.': 'Более явный слайд вверх, ближе к sheet-интерфейсу.',
    'Pure fade, but slower and more noticeable than before.': 'Чистое затухание, медленнее и заметнее прежнего.',
    'Instant open/close with no animation.': 'Мгновенное открытие и закрытие без анимации.',
    'Speed': 'Скорость',
    '1 = slower, 10 = faster, 8 = current': '1 = медленнее, 10 = быстрее, 8 = текущее',
    'Mobile Font Size': 'Размер шрифта на мобильных',
    'Size': 'Размер',
    'Applies only in mobile layout. 5 = current size.': 'Применяется только в мобильной раскладке. 5 = текущий размер.',
    'Show weather': 'Показывать погоду',
    'City': 'Город',
    'Type a city...': 'Введите город...',
    'Search': 'Найти',
    'No city selected': 'Город не выбран',
    'Refresh interval, minutes': 'Интервал обновления, минуты',
    'Save weather': 'Сохранить погоду',
    'Update now': 'Обновить сейчас',

    'Enable on this device': 'Включить на этом устройстве',
    'Disable device': 'Отключить устройство',
    'Test notification': 'Проверить уведомление',
    'For Android and background web, browser permission and an active subscription on this device are required.': 'Для Android и свернутого веба нужны разрешение браузера и активная подписка этого устройства.',
    'Receive push notifications': 'Получать push-уведомления',
    'New messages': 'Новые сообщения',
    'Chat invites': 'Приглашения в чат',
    'Reactions to my messages': 'Реакции на мои сообщения',
    'Message pins': 'Закрепления сообщений',
    'Mentions of me': 'Упоминания меня',
    'Enable sounds': 'Включить звуки',
    'Volume': 'Громкость',
    'Send sound': 'Отправка',
    'Incoming chat': 'Входящее в чате',
    'Preview': 'Прослушать',
    'Check all': 'Проверить все',
    'Voice recording': 'Голосовая запись',
    'Voice and transcription': 'Голос и расшифровка',
    'Enable voice messages': 'Включить голосовые сообщения',
    'Transcribe right after recording': 'Расшифровывать сразу после записи',
    'Fallback to OpenAI': 'Fallback на OpenAI',
    'Voice message interface': 'Интерфейс голосовых сообщений',
    'Active provider': 'Активный провайдер',
    'Choose a provider. Its model appears in the block below.': 'Выберите провайдер. Модель для него появится в блоке ниже.',
    'Minimum recording length, ms': 'Минимальная длина записи, мс',
    'Maximum recording length, ms': 'Максимальная длина записи, мс',
    'Transcription timeout, ms': 'Таймаут расшифровки, мс',
    'Queue concurrency': 'Concurrency очереди',
    'Vosk model': 'Модель Vosk',
    'Vosk model path (optional)': 'Путь к модели Vosk (необязательно)',
    'OpenAI model': 'Модель OpenAI',
    'Grok model': 'Модель Grok',
    'Language': 'Язык',
    'OpenAI API key': 'API-ключ OpenAI',
    'Grok API key': 'API-ключ Grok',
    'Enter a new key': 'Введите новый ключ',
    'Replace key': 'Заменить ключ',
    'Test model': 'Проверить модель',
    'Loading settings...': 'Загрузка настроек...',
    'Could not load settings': 'Не удалось загрузить настройки',
    'No available options': 'Нет доступных вариантов',
    'Compact': 'Компактный',
    'Full': 'Полный',
    'Saved key {key}': 'Сохранен ключ {key}',
    'Key saved: {key}': 'Ключ сохранен: {key}',
    'Key not saved': 'Ключ не сохранен',
    'not selected': 'не выбрана',
    'Choose an OpenAI model below. A saved API key is required for testing.': 'Выберите модель OpenAI ниже. Для проверки нужен сохраненный API-ключ.',
    'Choose a Grok STT profile below. A saved Grok API key is required for testing.': 'Выберите профиль Grok STT ниже. Для проверки нужен сохраненный API-ключ Grok.',
    'Choose a Vosk model below, then press Test model.': 'Выберите модель Vosk ниже и затем нажмите «Проверить модель».',
    'Selected now: {provider} / {model}': 'Сейчас выбрано: {provider} / {model}',
    'Test {provider}: {model}': 'Проверить {provider}: {model}',
    'Saving settings...': 'Сохранение настроек...',
    'Settings saved': 'Настройки сохранены',
    'Delete saved OpenAI API key?': 'Удалить сохраненный OpenAI API-ключ?',
    'Delete saved Grok API key?': 'Удалить сохраненный Grok API-ключ?',
    'Deleting key...': 'Удаление ключа...',
    'Key deleted': 'Ключ удален',
    'Could not delete key': 'Не удалось удалить ключ',
    'Testing model...': 'Проверка модели...',
    'Model test failed': 'Проверка модели завершилась ошибкой',
    'Model test passed': 'Проверка модели прошла успешно',
    'Last model test': 'Последняя проверка модели',
    'Status': 'Статус',
    'success': 'успешно',
    'error': 'ошибка',
    'Provider': 'Провайдер',
    'Model': 'Модель',
    'Response time': 'Время ответа',
    'Tested': 'Проверено',
    'ms': 'мс',
    'Text': 'Текст',
    'Could not get text': 'Не удалось получить текст',
    'Retry': 'Повторить',
    'To text': 'В текст',
    'Voice message': 'Голосовое сообщение',
    'Recording in progress': 'Идет запись',
    'Sending voice message': 'Отправка голосового сообщения',
    'Preparing voice message': 'Подготовка голосового сообщения',
    'Hold to record voice message': 'Удерживайте для записи голоса',
    'Could not start recording': 'Не удалось начать запись',
    'Could not send voice message': 'Не удалось отправить голосовое сообщение',
    'Recording is too short': 'Слишком короткая запись',
    'Microphone is not supported by this browser': 'Микрофон не поддерживается браузером',
    'AudioContext is unavailable': 'AudioContext недоступен',
    'Recording video': 'Идет запись видео',
    'Hold to record video': 'Удерживайте для записи видео',
    'Hold to record audio': 'Удерживайте для записи аудио',
    'Video note': 'Видео-заметка',
    'Could not send message': 'Не удалось отправить сообщение',
    'Camera is unavailable in this browser': 'Камера недоступна в этом браузере',
    'MediaRecorder does not support video recording': 'MediaRecorder не поддерживает запись видео',
    'Video note record failed': 'Не удалось записать видео-заметку',
    'Sending video note': 'Отправка видео-заметки...',

    'Chat Info': 'Информация о чате',
    'Members': 'Участники',
    'Add Member': 'Добавить участника',
    'Compact view (all messages on one side)': 'Компактный вид (все сообщения с одной стороны)',
    'Chat Background': 'Фон чата',
    'Background Style': 'Стиль фона',
    'Cover': 'Заполнить',
    'Contain': 'Вместить',
    'Tile': 'Плитка',
    'Center fit': 'По центру',
    'Remove background': 'Удалить фон',
    'Anyone can unpin any pinned message': 'Любой может откреплять закрепленные сообщения',
    'When off, only the person who pinned the message and admins can unpin it.': 'Если выключено, откреплять могут только автор закрепления и админы.',
    'Context transform': 'Преобразование контекста',
    'Enable AI context transform in this chat': 'Включить AI-преобразование контекста в этом чате',
    'When enabled, members can run assigned convert bots on draft text and editable human messages. Bot assignment itself is still managed by admins in AI settings.': 'Если включено, участники могут запускать назначенных ботов преобразования для черновиков и редактируемых сообщений. Назначение ботов управляется админами в AI-настройках.',
    'Pins': 'Закрепления',

    'Bot settings': 'Настройки ботов',
    'Global settings': 'Глобальные настройки',
    'Interactive actions': 'Интерактивные действия',
    'Enable AI bots': 'Включить AI-ботов',
    'Enable DeepSeek AI bots': 'Включить DeepSeek AI-ботов',
    'Enable Grok AI bots': 'Включить Grok AI-ботов',
    'Enable Yandex AI bots': 'Включить Yandex AI-ботов',
    'Enabled': 'Включен',
    'Enabled in chat': 'Включен в чате',
    'Available in all chats': 'Доступен во всех чатах',
    'Auto react on mention': 'Автореакция на упоминание',
    'Name': 'Имя',
    'Mention': 'Упоминание',
    'Response model': 'Модель ответа',
    'Summary model': 'Модель сводки',
    'Embedding model': 'Модель embeddings',
    'Image model': 'Модель изображений',
    'Image size': 'Размер изображения',
    'Image quality': 'Качество изображения',
    'Image background': 'Фон изображения',
    'Image output': 'Формат изображения',
    'Image aspect ratio': 'Соотношение сторон изображения',
    'Image resolution': 'Разрешение изображения',
    'Aspect ratio': 'Соотношение сторон',
    'Resolution': 'Разрешение',
    'Temperature': 'Температура',
    'Summary temperature': 'Температура сводки',
    'Max tokens': 'Макс. токенов',
    'Chunk size': 'Размер чанка',
    'Retrieval top-K': 'Retrieval top-K',
    'Base URL': 'Base URL',
    'API key': 'API-ключ',
    'OpenAI API key': 'OpenAI API-ключ',
    'Yandex API key': 'Yandex API-ключ',
    'DeepSeek API key': 'DeepSeek API-ключ',
    'Grok API key': 'Grok API-ключ',
    'Save settings': 'Сохранить настройки',
    'Refresh models': 'Обновить модели',
    'Delete key': 'Удалить ключ',
    'Test key': 'Проверить ключ',
    'New bot': 'Новый бот',
    'New image bot': 'Новый image-бот',
    'New universal bot': 'Новый универсальный бот',
    'New convert bot': 'Новый бот преобразования',
    'Save bot': 'Сохранить бота',
    'Save image bot': 'Сохранить image-бота',
    'Save for chat': 'Сохранить для чата',
    'Disable': 'Отключить',
    'Test': 'Проверить',
    'Export JSON': 'Выгрузить JSON',
    'Import JSON': 'Загрузить JSON',
    'Remove avatar': 'Удалить аватар',
    'Change avatar': 'Сменить аватар',
    'Bot avatar': 'Аватар бота',
    'Image bot avatar': 'Аватар image-бота',
    'Universal bot avatar': 'Аватар универсального бота',
    'The image is stored separately from JSON persona settings.': 'Картинка хранится отдельно от JSON-настроек персонажа.',
    'Style': 'Стиль',
    'Tone': 'Тон',
    'Behavior rules': 'Правила поведения',
    'Speech patterns': 'Речевые паттерны',
    'Transform prompt': 'Промпт преобразования',
    'Context': 'Контекст',
    'Chat': 'Чат',
    'Bot': 'Бот',
    'Simple context': 'Простой контекст',
    'Hybrid memory': 'Гибридная память',
    'Text': 'Текст',
    'Image': 'Изображение',
    'Document': 'Документ',
    'File': 'Файл',
    'Camera': 'Камера',
    'Gallery': 'Галерея',
    'Poll': 'Опрос',
    'Live preview': 'Живой предпросмотр',
    'Test mode': 'Тестовый режим',
    'Test document': 'Тестовый документ',
    'Reasoning': 'Reasoning',
    'Data logging': 'Логирование данных',
    'DISABLED': 'DISABLED',
    'ENABLED_HIDDEN': 'ENABLED_HIDDEN',

    'Open text bots': 'Открыть текстовых ботов',
    'Open image bots': 'Открыть image-ботов',
    'Open universal bots': 'Открыть универсальных ботов',
    'Open convert bots': 'Открыть ботов преобразования',
    'OpenAI Text Bots': 'Текстовые боты OpenAI',
    'OpenAI Universal Bots': 'Универсальные боты OpenAI',
    'DeepSeek Text Bots': 'Текстовые боты DeepSeek',
    'Grok text bots': 'Текстовые боты Grok',
    'Grok image bots': 'Image-боты Grok',
    'Grok universal bots': 'Универсальные боты Grok',
    'Context Convert Bots': 'Боты преобразования контекста',
    'Convert bots': 'Боты преобразования',
    'Convert bots in chats': 'Боты преобразования в чатах',
    'DeepSeek bots and persona': 'Боты DeepSeek и персона',
    'DeepSeek bots in chats': 'Боты DeepSeek в чатах',
    'Yandex bots and persona': 'Боты Yandex и персона',
    'Yandex bots in chats': 'Боты Yandex в чатах',
    'Global DeepSeek settings': 'Глобальные настройки DeepSeek',
    'Global Grok settings': 'Глобальные настройки Grok',
    'Global Yandex settings': 'Глобальные настройки Yandex',
    'Open separate windows for OpenAI text bots, universal bots, and context convert bots.': 'Открывает отдельные окна для текстовых ботов OpenAI, универсальных ботов и ботов преобразования.',
    'Open separate windows for DeepSeek text bots and context convert bots.': 'Открывает отдельные окна для текстовых ботов DeepSeek и ботов преобразования.',
    'Open separate windows for Yandex text bots and context convert bots.': 'Открывает отдельные окна для текстовых ботов Yandex и ботов преобразования.',
    'Open separate windows for Grok text bots, image bots, universal bots, and context convert bots.': 'Открывает отдельные окна для текстовых ботов Grok, image-ботов, универсальных ботов и ботов преобразования.',
    'Enables polls, poll votes, reactions, and pinning for all OpenAI text and universal bots.': 'Включает опросы, голоса, реакции и закрепления для всех текстовых и универсальных ботов OpenAI.',
    'Enables polls, poll votes, reactions, and pinning for all DeepSeek bots.': 'Включает опросы, голоса, реакции и закрепления для всех ботов DeepSeek.',
    'Enables polls, poll votes, reactions, and pinning for all Yandex bots.': 'Включает опросы, голоса, реакции и закрепления для всех ботов Yandex.',
    'Enables polls, poll votes, reactions, and pinning for all Grok text and universal bots.': 'Включает опросы, голоса, реакции и закрепления для всех текстовых и универсальных ботов Grok.',
    'Use the OpenAI "Interactive actions" switch above to enable polls, votes, reactions, and pinning for all OpenAI text bots.': 'Используйте переключатель OpenAI "Интерактивные действия" выше, чтобы включить опросы, голоса, реакции и закрепления для всех текстовых ботов OpenAI.',
    'Use the OpenAI "Interactive actions" switch above to enable polls, votes, reactions, and pinning for all OpenAI universal bots.': 'Используйте переключатель OpenAI "Интерактивные действия" выше, чтобы включить опросы, голоса, реакции и закрепления для всех универсальных ботов OpenAI.',
    'Use the DeepSeek "Interactive actions" switch above to enable polls, votes, reactions, and pinning for all DeepSeek bots.': 'Используйте переключатель DeepSeek "Интерактивные действия" выше, чтобы включить опросы, голоса, реакции и закрепления для всех ботов DeepSeek.',
    'Use the Yandex "Interactive actions" switch above to enable polls, votes, reactions, and pinning for all Yandex bots.': 'Используйте переключатель Yandex "Интерактивные действия" выше, чтобы включить опросы, голоса, реакции и закрепления для всех ботов Yandex.',
    'Use the Grok "Interactive actions" switch above to enable polls, votes, reactions, and pinning for all Grok text bots.': 'Используйте переключатель Grok "Интерактивные действия" выше, чтобы включить опросы, голоса, реакции и закрепления для всех текстовых ботов Grok.',
    'Use the Grok "Interactive actions" switch above to enable polls, votes, reactions, and pinning for all Grok universal bots.': 'Используйте переключатель Grok "Интерактивные действия" выше, чтобы включить опросы, голоса, реакции и закрепления для всех универсальных ботов Grok.',
    'Universal OpenAI bots can answer with text, generate or edit images, and optionally return a document attachment.': 'Универсальные боты OpenAI отвечают текстом, генерируют или редактируют изображения и могут вернуть документ.',
    'Universal Grok bots can answer with text, analyze images, generate new images, and edit a supported source image.': 'Универсальные боты Grok отвечают текстом, анализируют изображения, генерируют новые изображения и редактируют поддерживаемый источник.',
    'Image bots always use simple mode and answer with one generated image saved to local uploads.': 'Image-боты всегда используют простой режим и отвечают одним сгенерированным изображением, сохраненным в локальные загрузки.',
    'Convert bots receive only the source text and return only the transformed text without dialogue, persona, mentions, or memory.': 'Боты преобразования получают только исходный текст и возвращают только преобразованный текст без диалога, персоны, упоминаний и памяти.',
    'Chat members can use these bots only when the chat-level context transform feature is enabled.': 'Участники чата могут использовать этих ботов только если в чате включено преобразование контекста.',
    'This prompt may be rejected by Grok image moderation, and rejected requests can still be billable. Send it anyway?': 'Этот промпт может быть отклонен модерацией Grok Image, а отклоненные запросы могут тарифицироваться. Отправить все равно?',
    'Yes, send': 'Да, отправить',
    'No, cancel': 'Нет, отменить',

    'Saving...': 'Сохраняем...',
    'Saved': 'Сохранено',
    'Loading...': 'Загрузка...',
    'Refreshing...': 'Обновляем...',
    'Searching...': 'Ищем...',
    'Updated': 'Обновлено',
    'No cities found': 'Города не найдены',
    'Choose a city first': 'Сначала выберите город',
    'Type at least 2 characters': 'Введите минимум 2 символа',
    'Could not save settings': 'Не удалось сохранить настройки',
    'Could not update setting': 'Не удалось обновить настройку',
    'Polls are not available in notes chat.': 'Опросы недоступны в заметках.',
    'Finish editing before creating a poll.': 'Завершите редактирование перед созданием опроса.',
    'Remove pending attachments before creating a poll.': 'Удалите ожидающие вложения перед созданием опроса.',
    'Could not update vote': 'Не удалось обновить голос',
    'Could not close poll': 'Не удалось закрыть опрос',
    'Pinned message not found': 'Закрепленное сообщение не найдено',
    'Message pinned': 'Сообщение закреплено',
    'Could not pin message': 'Не удалось закрепить сообщение',
    'Only the pin owner or admin can unpin this': 'Открепить может только автор закрепления или админ',
    'Message unpinned': 'Сообщение откреплено',
    'Could not unpin message': 'Не удалось открепить сообщение',
    'No OpenAI universal bots yet. Create the first one.': 'Универсальных OpenAI-ботов пока нет. Создайте первого.',
    'No DeepSeek bots yet. Create the first one.': 'DeepSeek-ботов пока нет. Создайте первого.',
    'No Yandex bots yet. Create the first one.': 'Yandex-ботов пока нет. Создайте первого.',
    'No Grok text bots yet. Create the first one.': 'Текстовых Grok-ботов пока нет. Создайте первого.',
    'No Grok image bots yet. Create the first one.': 'Grok-ботов для изображений пока нет. Создайте первого.',
    'No Grok universal bots yet. Create the first one.': 'Универсальных Grok-ботов пока нет. Создайте первого.',
    'No convert bots yet. Create the first one.': 'Ботов преобразования пока нет. Создайте первого.',
    'Delete OpenAI API key for AI bots?': 'Удалить OpenAI API key для AI-ботов?',
    'Delete DeepSeek API key for AI bots?': 'Удалить DeepSeek API key для AI-ботов?',
    'Delete Yandex API key for AI bots?': 'Удалить Yandex API key для AI-ботов?',
    'Delete Grok API key for AI bots?': 'Удалить Grok API key для AI-ботов?',
    'Disable this OpenAI universal bot in all chats?': 'Отключить этого универсального OpenAI-бота во всех чатах?',
    'Disable this DeepSeek bot in all chats?': 'Отключить этого DeepSeek-бота во всех чатах?',
    'Disable this Yandex bot in all chats?': 'Отключить этого Yandex-бота во всех чатах?',
    'Disable this Grok universal bot in all chats?': 'Отключить этого универсального Grok-бота во всех чатах?',
    'Disable this Grok {kind} bot in all chats?': 'Отключить этого Grok-бота ({kind}) во всех чатах?',
    'text': 'текст',
    'image': 'изображение',
    'Disable this convert bot in all chats?': 'Отключить этого бота преобразования во всех чатах?',
    'Could not open hidden chat': 'Не удалось открыть скрытый чат',
    'Image copied': 'Изображение скопировано',
    'Text copied': 'Текст скопирован',
    'Could not copy text': 'Не удалось скопировать текст',
    'Link copied': 'Ссылка скопирована',
    'Could not copy link': 'Не удалось скопировать ссылку',
    'Download started': 'Скачивание началось',
    'Action failed': 'Действие не удалось',
    'Folder created': 'Папка создана',
    'Folder name': 'Название папки',
    'Folder renamed': 'Папка переименована',
    'Delete folder "{name}"?': 'Удалить папку «{name}»?',
    'Folder deleted': 'Папка удалена',
    'Folder moved up': 'Папка выше',
    'Folder moved down': 'Папка ниже',
    'Chat pinned in folder': 'Чат закреплен в папке',
    'Chat unpinned from folder': 'Чат откреплен от папки',
    'Chat moved up in folder': 'Чат выше в папке',
    'Chat moved down in folder': 'Чат ниже в папке',
    'No manual folders yet': 'Пока нет ручных папок',
    'Chat pinned': 'Чат закреплен',
    'Chat unpinned': 'Чат откреплен',
    'Could not pin chat': 'Не удалось закрепить чат',
    'Could not unpin chat': 'Не удалось открепить чат',
    'Moved up': 'Перемещено выше',
    'Moved down': 'Перемещено ниже',
    'Could not move pinned chat': 'Не удалось переместить закрепленный чат',
    'Notifications enabled': 'Уведомления включены',
    'Notifications disabled': 'Уведомления выключены',
    'Sound enabled': 'Звук включен',
    'Sound disabled': 'Звук выключен',
    'Could not update chat preferences': 'Не удалось обновить настройки чата',
    'Chat hidden': 'Чат скрыт',
    'Could not hide chat': 'Не удалось скрыть чат',
    'Leave this chat?': 'Выйти из этого чата?',
    'You left the chat': 'Вы вышли из чата',
    'Could not leave chat': 'Не удалось выйти из чата',
    'Delete chat, all messages and media permanently?': 'Удалить чат, все сообщения и медиа без восстановления?',
    'Chat deleted': 'Чат удален',
    'Could not delete chat': 'Не удалось удалить чат',
    'Clear chat history for all members?': 'Очистить историю чата для всех участников?',
    'History cleared': 'История очищена',
    'Could not clear history': 'Не удалось очистить историю',
    'Chat removed from folder': 'Чат удален из папки',
    'No matching chats found': 'Подходящих чатов не найдено',
    'Message forwarded': 'Сообщение переслано',
    'Saved to notes': 'Сохранено в заметки',
    'Could not save to notes': 'Не удалось сохранить в заметки',
    'Original message deleted': 'Оригинальное сообщение удалено',
    'Source text for test transform:': 'Исходный текст для тестового преобразования:',
    'Can you rewrite this text to sound clearer and more concise?': 'Можешь переписать этот текст яснее и короче?',
    'Transform with AI': 'Преобразовать через AI',
    'Could not transform text': 'Не удалось преобразовать текст',
    'Could not transform message': 'Не удалось преобразовать сообщение',
    'Your account has been blocked by an administrator.': 'Ваш аккаунт заблокирован администратором.',
    'Could not open chat': 'Не удалось открыть чат',
    'Private chat': 'Личный чат',
    'Jump to pinned message': 'Перейти к закрепленному сообщению',
    'Retry': 'Повторить',
    'Message too long': 'Сообщение слишком длинное',
    'Text cannot be empty': 'Текст не может быть пустым',
    'Delete this message?': 'Удалить это сообщение?',
    'Finish editing before attaching files.': 'Завершите редактирование перед прикреплением файлов.',
    'Finish or remove pending attachments before editing a message.': 'Завершите или удалите ожидающие вложения перед редактированием сообщения.',
    'File too large': 'Файл слишком большой',
    'File too large: {name} (max {max})': 'Файл слишком большой: {name} (макс. {max})',
    'Could not open folder': 'Не удалось открыть папку',
    'Could not update folder': 'Не удалось обновить папку',
    'Could not create folder': 'Не удалось создать папку',
    'Could not save folders': 'Не удалось сохранить папки',
    'Enter group name': 'Введите название группы',
    'Enter folder name': 'Введите название папки',
    'Logout?': 'Выйти?',
    'Fill in all fields': 'Заполните все поля',
    'New passwords do not match': 'Новые пароли не совпадают',
    'Password must be at least 6 characters': 'Пароль должен быть не короче 6 символов',
    'Password changed successfully!': 'Пароль изменен!',
    'Close': 'Закрыть',
    'Recording...': 'Запись...',
    'Play video note': 'Воспроизвести видеозаметку',
    'Pause video note': 'Пауза видеозаметки',
    'Switch video note to circle': 'Переключить видеозаметку в круг',
    'Switch video note to banana': 'Переключить видеозаметку в банан',
    'Transcript': 'Расшифровка',
    'Transcription...': 'Расшифровка...',
    'Transcription hidden': 'Расшифровка скрыта',
    'Transcription error': 'Ошибка расшифровки',
    'Could not start transcription': 'Не удалось запустить расшифровку',
    'No chat API access': 'Нет доступа к API чата',
    'offline': 'не в сети',
  };

  const EN = {};
  Object.keys(RU).forEach((key) => { EN[key] = key; });
  Object.assign(EN, {
    'BananZa Login': 'BananZa - Login',
    'AI-Яндекс': 'Yandex AI',
    '🐓 AI-Яндекс': '🐓 Yandex AI',
    'Уведомления': 'Notifications',
    '🔔 Уведомления': '🔔 Notifications',
    'Звуки': 'Sounds',
    '🔊 Звуки': '🔊 Sounds',
    'English': 'English',
    'Russian': 'Russian',
  });

  const ALIASES = {
    'Автопапки': 'Auto folders',
    'Ручные папки': 'Manual folders',
    'Включить на этом устройстве': 'Enable on this device',
    'Отключить устройство': 'Disable device',
    'Проверить уведомление': 'Test notification',
    'Для Android и свернутого веба нужны разрешение браузера и активная подписка этого устройства.': 'For Android and background web, browser permission and an active subscription on this device are required.',
    'Получать push-уведомления': 'Receive push notifications',
    'Новые сообщения': 'New messages',
    'Приглашения в чат': 'Chat invites',
    'Реакции на мои сообщения': 'Reactions to my messages',
    'Закрепления сообщений': 'Message pins',
    'Упоминания меня': 'Mentions of me',
    'Включить звуки': 'Enable sounds',
    'Громкость': 'Volume',
    'Отправка': 'Send sound',
    'Входящее в чате': 'Incoming chat',
    'Прослушать': 'Preview',
    'Проверить все': 'Check all',
    'Голосовая запись': 'Voice recording',
    'Сохранить настройки': 'Save settings',
    'Обновить модели': 'Refresh models',
    'Удалить ключ': 'Delete key',
    'Новый бот': 'New bot',
    'Сохранить бота': 'Save bot',
    'Отключить': 'Disable',
    'Проверить': 'Test',
    'Выгрузить JSON': 'Export JSON',
    'Загрузить JSON': 'Import JSON',
    'Аватар бота': 'Bot avatar',
    'Картинка хранится отдельно от характера и не попадает в JSON.': 'The image is stored separately from JSON persona settings.',
    'Удалить аватар': 'Remove avatar',
    'Сменить аватар': 'Change avatar',
    'Глобальные настройки': 'Global settings',
    'Включить AI-ботов': 'Enable AI bots',
    'Боты отвечают только на @mention или reply на сообщение конкретного бота.': 'Bots answer only to @mention or reply to that specific bot.',
    'Embedding model глобальная для долговременной памяти: все боты используют один vector index.': 'The embedding model is global for long-term memory: all bots use one vector index.',
    'Hybrid memory достраивает долговременную память в фоне. Simple context не удаляет уже созданную память.': 'Hybrid memory builds long-term memory in the background. Simple context does not delete existing memory.',
    'DeepSeek в этой версии работает только как text-only провайдер. OCR, vision, audio/STT и native hybrid memory не включены, потому что в официальном API для них нет подтверждённой документации.': 'In this version DeepSeek works only as a text-only provider. OCR, vision, audio/STT, and native hybrid memory are not enabled because official API documentation does not confirm them.',
    'DeepSeek-боты отвечают только на @mention или reply. Hybrid memory для них недоступен, поэтому здесь всегда используется только simple context.': 'DeepSeek bots answer only to @mention or reply. Hybrid memory is unavailable, so this always uses simple context.',
    'Выбирайте `deepseek-chat` для обычного текстового режима и `deepseek-reasoner` для reasoning-сценариев. Hybrid memory для DeepSeek отключён.': 'Use `deepseek-chat` for regular text mode and `deepseek-reasoner` for reasoning scenarios. Hybrid memory is disabled for DeepSeek.',
    'Идентификатор каталога (Folder ID)': 'Folder ID',
    'Идентификатор каталога вводится в поле Folder ID выше. Он нужен для сборки modelUri вида gpt://<folder_ID>/yandexgpt/latest.': 'Enter the folder ID in the Folder ID field above. It is used to build a modelUri like gpt://<folder_ID>/yandexgpt/latest.',
  };

  const CATALOG = { ru: RU, en: EN };
  const literalToKey = new Map();

  function normalizeLanguage(language) {
    const next = String(language || '').trim().toLowerCase();
    return SUPPORTED.has(next) ? next : DEFAULT_LANGUAGE;
  }

  function addLiteral(value, key) {
    const literal = String(value || '').replace(/\s+/g, ' ').trim();
    if (literal) literalToKey.set(literal, key);
  }

  Object.keys(RU).forEach((key) => {
    addLiteral(key, key);
    addLiteral(RU[key], key);
    addLiteral(EN[key], key);
  });
  Object.entries(ALIASES).forEach(([literal, key]) => addLiteral(literal, key));

  let language = normalizeLanguage(localStorage.getItem(STORAGE_KEY) || document.documentElement?.lang);
  const listeners = new Set();
  let observer = null;

  function interpolate(template, params = {}) {
    let text = String(template == null ? '' : template);
    Object.entries(params || {}).forEach(([key, value]) => {
      text = text.replaceAll(`{${key}}`, String(value ?? ''));
    });
    return text;
  }

  function t(key, params = {}) {
    const normalizedKey = literalToKey.get(String(key || '').replace(/\s+/g, ' ').trim()) || key;
    const table = CATALOG[language] || CATALOG[DEFAULT_LANGUAGE];
    return interpolate(table[normalizedKey] || CATALOG[DEFAULT_LANGUAGE][normalizedKey] || normalizedKey || '', params);
  }

  function translateText(value, params = {}) {
    const raw = String(value == null ? '' : value);
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (!trimmed) return raw;
    const key = literalToKey.get(trimmed);
    if (key) return preserveOuterWhitespace(raw, t(key, params));

    const decorated = trimmed.match(/^([^\p{L}\p{N}]+)\s*(.+)$/u);
    if (decorated && literalToKey.has(decorated[2])) {
      return preserveOuterWhitespace(raw, `${decorated[1]} ${t(literalToKey.get(decorated[2]), params)}`);
    }

    const richMatch = trimmed.match(/^Rich Banan UX:\s*(On|Off|Вкл\.|Выкл\.)$/i);
    if (richMatch) {
      return preserveOuterWhitespace(raw, `${t('Rich Banan UX')}: ${t(richMatch[1] === 'On' || richMatch[1] === 'Вкл.' ? 'On' : 'Off')}`);
    }
    const animationMatch = trimmed.match(/^Animation:\s*([^,]+),\s*(\d+)\/10$/i);
    if (animationMatch) {
      return preserveOuterWhitespace(raw, `${t('Animation')}: ${t(animationMatch[1])}, ${animationMatch[2]}/10`);
    }
    const pollStyleMatch = trimmed.match(/^Poll Style:\s*(.+)$/i);
    if (pollStyleMatch) {
      return preserveOuterWhitespace(raw, `${t('Selected poll style')}: ${t(pollStyleMatch[1])}`);
    }
    const fileTooLargeMatch = trimmed.match(/^File too large:\s*(.+)\s+\(max\s+(.+)\)$/i);
    if (fileTooLargeMatch) {
      return preserveOuterWhitespace(raw, t('File too large: {name} (max {max})', {
        name: fileTooLargeMatch[1],
        max: fileTooLargeMatch[2],
      }));
    }
    const deleteFolderMatch = trimmed.match(/^Удалить папку «(.+)»\?$/);
    if (deleteFolderMatch) {
      return preserveOuterWhitespace(raw, t('Delete folder "{name}"?', { name: deleteFolderMatch[1] }));
    }
    const disableGrokKindMatch = trimmed.match(/^Disable this Grok (text|image) bot in all chats\?$/i);
    if (disableGrokKindMatch) {
      return preserveOuterWhitespace(raw, t('Disable this Grok {kind} bot in all chats?', {
        kind: t(disableGrokKindMatch[1].toLowerCase()),
      }));
    }
    return raw;
  }

  function preserveOuterWhitespace(original, translated) {
    const prefix = String(original).match(/^\s*/)?.[0] || '';
    const suffix = String(original).match(/\s*$/)?.[0] || '';
    return `${prefix}${translated}${suffix}`;
  }

  function shouldSkipNode(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    if (!el) return true;
    if (el.closest('[data-i18n-skip], .msg-text, .msg-reply-text, .link-preview, .chat-list, .user-list, .admin-user-list, .chat-title, #chatTitle, #currentUserInfo')) return true;
    const tag = el.tagName;
    return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA';
  }

  function applyTextNode(node) {
    if (!node || shouldSkipNode(node)) return;
    const next = translateText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function applyElementAttributes(el) {
    if (!el || el.nodeType !== 1 || shouldSkipNode(el)) return;
    const attrMap = [
      ['data-i18n-title', 'title'],
      ['data-i18n-placeholder', 'placeholder'],
      ['data-i18n-aria-label', 'aria-label'],
      ['data-i18n-value', 'value'],
    ];
    if (el.dataset?.i18n) el.textContent = t(el.dataset.i18n);
    attrMap.forEach(([dataAttr, attr]) => {
      const key = el.getAttribute(dataAttr);
      if (key) el.setAttribute(attr, t(key));
    });
    ['title', 'placeholder', 'aria-label'].forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const current = el.getAttribute(attr);
      const next = translateText(current);
      if (next !== current) el.setAttribute(attr, next);
    });
  }

  function applyStaticDom(root = document) {
    const target = root?.nodeType ? root : document;
    if (target.nodeType === 3) {
      applyTextNode(target);
      return;
    }
    if (target.nodeType === 1) applyElementAttributes(target);
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(applyTextNode);
    const elements = target.querySelectorAll ? target.querySelectorAll('*') : [];
    elements.forEach(applyElementAttributes);
    document.documentElement.lang = language;
    if (document.title) {
      document.title = location.pathname.endsWith('/login.html') ? `🍌 ${t('BananZa Login')}` : '🍌 BananZa';
    }
  }

  function setLanguage(nextLanguage, { persist = true, notify = true } = {}) {
    const normalized = normalizeLanguage(nextLanguage);
    if (language === normalized) {
      applyStaticDom(document);
      return language;
    }
    language = normalized;
    document.documentElement.lang = language;
    if (persist) localStorage.setItem(STORAGE_KEY, language);
    applyStaticDom(document);
    if (notify) {
      listeners.forEach((listener) => {
        try { listener(language); } catch (error) {}
      });
      window.dispatchEvent(new CustomEvent('bananza:languagechange', { detail: { language } }));
    }
    return language;
  }

  function onChange(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function startObserver() {
    if (observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => applyStaticDom(node));
        if (mutation.type === 'attributes') applyElementAttributes(mutation.target);
      });
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['title', 'placeholder', 'aria-label', 'data-i18n', 'data-i18n-title', 'data-i18n-placeholder', 'data-i18n-aria-label'],
    });
  }

  function wrapDialogs() {
    const nativeAlert = window.alert?.bind(window);
    const nativeConfirm = window.confirm?.bind(window);
    const nativePrompt = window.prompt?.bind(window);
    if (nativeAlert) window.alert = (message) => nativeAlert(translateText(message));
    if (nativeConfirm) window.confirm = (message) => nativeConfirm(translateText(message));
    if (nativePrompt) window.prompt = (message, value) => nativePrompt(translateText(message), value);
  }

  window.BananzaI18n = {
    t,
    text: translateText,
    setLanguage,
    getLanguage: () => language,
    normalizeLanguage,
    applyStaticDom,
    onChange,
    catalog: CATALOG,
    storageKey: STORAGE_KEY,
  };

  wrapDialogs();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyStaticDom(document);
      startObserver();
    }, { once: true });
  } else {
    applyStaticDom(document);
    startObserver();
  }
})();
