# Language Video Factory

Автоматизований генератор коротких навчальних відео для вивчення іноземних мов. Проєкт використовує дані з Excel, генерує озвучення та зображення, а потім створює готові відео для TikTok, Instagram Reels та YouTube Shorts.

## Можливості

- Генерація навчальних відео з перекладами та озвученням.
- Підтримка шести мов: української, англійської, польської, французької, німецької та іспанської.
- Три режими контенту: `default`, `simple` та `quiz`.
- Два візуальні дизайни: `default` та `minimal`.
- Генерація зображень через Cloudflare Workers AI.
- Синтез мовлення через Python-пакет `edge-tts`.
- Вибір одного або кількох слів, фільтрація за категорією та рівнем.
- Попередній перегляд параметрів перед генерацією (`--dry-run`).
- Примусова перегенерація відео (`--force`).
- Автоматизовані тести для основних модулів.

## Технології

- Node.js та JavaScript (ES Modules)
- Python та `edge-tts`
- FFmpeg та ffprobe
- ExcelJS для читання Excel
- Cloudflare Workers AI для генерації зображень

## Вимоги

Для запуску проєкту потрібні:

- Node.js та npm.
- Python із підтримкою встановлення пакетів через pip.
- FFmpeg разом із ffprobe, доступні через `PATH`.
- Інтернет-з'єднання для генерації зображень та озвучення.
- Облікові дані Cloudflare Workers AI для генерації зображень.

Поточне перевірене середовище розробки: Node.js 24.18.0, Python 3.14 та `edge-tts` 7.3.1.

## Встановлення

### 1. Отримання проєкту

Клонуй репозиторій або відкрий його локальну копію. Перейди до кореневої папки `language-video-factory`.

### 2. Встановлення залежностей Node.js

У терміналі PowerShell виконай:

```powershell
npm install
```

### 3. Встановлення залежностей Python

Виконай:

```powershell
python -m pip install -r requirements.txt
```

У `requirements.txt` зафіксовано версію `edge-tts==7.3.1`.

### 4. Перевірка FFmpeg

Виконай:

```powershell
ffmpeg -version
ffprobe -version
```

Обидві команди повинні виконуватися без помилок. Якщо команда не знайдена, встанови FFmpeg і додай його папку `bin` до системного `PATH`.

### 5. Налаштування змінних середовища

У корені проєкту є `.env.example`. Використовуй його як шаблон для локального файлу `.env`.

Якщо `.env` ще не створено, виконай:

```powershell
Copy-Item .env.example .env
```

Заповни потрібні змінні для Cloudflare Workers AI, зокрема:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Використовуй власні облікові дані й ніколи не додавай секрети до Git. Файл `.env` має залишатися локальним.

## Формат Excel

Вхідний файл:

```text
data/words.xlsx
```

Перша таблиця Excel повинна містити такі заголовки:

| Колонка | Призначення |
|---|---|
| `id` | Унікальний ідентифікатор слова |
| `category` | Категорія, наприклад `Transport` |
| `uk` | Український переклад |
| `en` | Англійський переклад |
| `pl` | Польський переклад |
| `fr` | Французький переклад |
| `de` | Німецький переклад |
| `es` | Іспанський переклад |
| `imagePrompt` | Опис зображення для генерації |
| `level` | Рівень складності, наприклад `A1` |

Усі перелічені поля обов'язкові. Заголовки повинні збігатися з назвами вище.

Приклад даних:

| id | category | uk | en | pl | fr | de | es | imagePrompt | level |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Transport | велосипед | Bicycle | Rower | Vélo | Fahrrad | Bicicleta | modern bicycle isolated on white background | A1 |
| 2 | Food | яблуко | Apple | Jabłko | Pomme | Apfel | Manzana | red apple isolated on white background | A1 |

## Запуск

### Згенерувати відео для всіх слів

```powershell
npm start
```

### Вибрати одне слово

```powershell
npm start -- --word=Bicycle
```

### Вибрати кілька слів

```powershell
npm start -- --words=Bicycle,Apple
```

### Фільтрація за категорією

```powershell
npm start -- --category=Transport
```

### Фільтрація за рівнем

```powershell
npm start -- --level=A1
```

### Комбінація фільтрів

```powershell
npm start -- --category=Transport --level=A1
```

Можна поєднувати `--words` із категорією, рівнем і параметрами оформлення.

### Вибір режиму та дизайну

Звичайний режим:

```powershell
npm start -- --word=Bicycle --content=default --design=default
```

Simple:

```powershell
npm start -- --word=Bicycle --content=simple --design=minimal
```

Quiz:

```powershell
npm start -- --word=Bicycle --content=quiz --design=minimal
```

### Попередній перегляд без генерації

```powershell
npm start -- --category=Transport --content=quiz --design=minimal --dry-run
```

Команда прочитає Excel, застосує фільтри та покаже план генерації, але не запускатиме Pipeline.

### Примусова перегенерація відео

```powershell
npm start -- --word=Bicycle --content=quiz --design=minimal --force
```

Цей параметр примусово перегенеровує вибрані відео, навіть якщо вихідні файли вже існують. Готові зображення та аудіо повторно використовуються, якщо вони доступні.

`--dry-run` та `--force` не можна використовувати одночасно.

### Довідка

```powershell
npm start -- --help
```

Короткий варіант:

```powershell
npm start -- -h
```

## Результати генерації

Основні каталоги:

```text
output/
├── audio/
├── images/
├── temp/
└── videos/
```

Приклад вихідних відео:

```text
output/videos/bicycle.mp4
output/videos/bicycle-quiz-minimal.mp4
output/videos/bicycle-simple-minimal.mp4
```

Стандартний режим використовує сумісну назву без суфікса. Для інших комбінацій режиму й дизайну створюються окремі файли.

## Тестування

Запустити весь набір автоматизованих тестів:

```powershell
npm test
```

Альтернативна команда:

```powershell
npm run test:all
```

Для перевірки окремих компонентів можна запускати відповідні команди `test:*` з `package.json`, наприклад:

```powershell
npm run test:excel-reader
npm run test:flags
npm run test:runtime-video-options
npm run test:output-path-service
npm run test:pipeline-normal
npm run test:pipeline-quiz
npm run test:pipeline-simple
```

Деякі тести створюють тестові відео або аудіофайли в каталозі `output`.

## Безпека

- Не додавай `.env` до репозиторію.
- Не публікуй API-токени та інші секрети.
- Для налаштування нового середовища використовуй `.env.example`.
- Перевіряй доступність FFmpeg, Python та необхідних сервісів перед запуском генерації.

## Статус проєкту

Проєкт перебуває в активній розробці. Архітектура та функціональність можуть змінюватися в міру додавання нових можливостей.