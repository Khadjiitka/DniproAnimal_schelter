# Dnipro Animals - Сайт притулку для тварин

Веб-сайт для волонтерської організації «Dnipro Animals» (м. Дніпро).
Розроблено на хакатоні KUT 2026 за 24 години.

---

## Що зроблено

### Фронтенд (index.html / index.css / index.js)
- Паралакс-шапка, секція «Про нас», команда, статистика, футер
- Динамічне завантаження тварин: спочатку запит до `/api/pets`, при недоступності - fallback на `pets.json`
- Картки тварин з модальним вікном (фото, стать, вік, вакцинація, опис)
- Форма заявки на адопцію прямо на сайті - дані зберігаються в БД
- Вбудований AI-чат з анімацією «три крапки» під час відповіді
- Модальні вікна: донат (IBAN + Monobank), стати волонтером, AI-консультант
- Адаптивна верстка (мобільні, планшети, десктоп)

### Бекенд (backend/)
- **Express API** - CRUD для тварин, заявки на адопцію, AI-чат, вебхук для Make.com
- **SQLite** - база даних через `better-sqlite3`, автоматичний seed із `pets.json` при першому запуску
- **Telegram-бот** - волонтери керують притулком прямо з телефону
- **Claude Haiku** - AI-консультант на сторінці, допомагає обрати тварину

### Telegram-бот - команди для волонтерів

| Команда | Дія |
|---|---|
| `/start` | Привітання та список команд |
| `/list` | Переглянути всіх тварин із БД |
| `/addpet` | Додати нову тварину (покроковий діалог із фото) |
| `/setstatus <id> <статус>` | Змінити статус тварини |
| `/adoptions` | Нові заявки на адопцію |

Доступні статуси: `Шукає родину` · `На адаптації` · `Прилаштована`

```
/setstatus 3 Прилаштована
```

### pets.json
Файл автоматично синхронізується з БД при кожному записі.
Це дозволяє сайту працювати і як статична GitHub Pages (без бекенду).

### Схема Make.com (Google Forms → сайт)
Альтернативний спосіб для волонтерів без технічних навичок:

```
Google Форма -> Make.com -> POST /api/webhook/makepet -> БД + pets.json
```

Поля форми: `name`, `type` (cat/dog), `age`, `gender`, `description`, `photo_url`, `vaccinated`

---

## Структура проєкту

```
DniproAnimal_schelter/
├── backend/
│   ├── server.js        Express API
│   ├── db.js            SQLite + seed із pets.json
│   ├── bot.js           Telegram-бот
│   ├── uploads/         Завантажені фото (у .gitignore)
│   ├── package.json
│   └── .env             Ваші ключі (у .gitignore) 
├── img/                 Статичні зображення
├── data/                SQLite файл (у .gitignore)
├── index.html
├── index.css
├── index.js
├── pets.json            Дані тварин (синхронізується з БД)
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Запуск через Docker

### 1. Клонуйте репозиторій

```bash
git clone https://github.com/Khadjiitka/DniproAnimal_schelter.git
cd DniproAnimal_schelter
```

### 2. Налаштуйте ключі

```bash
cp backend/.env.example backend/.env
```

Відредагуйте `backend/.env`:

```env
PORT=3000

# Telegram: створіть бота через @BotFather
TELEGRAM_BOT_TOKEN=1234567890:AAxxxxxx...

# ID чату/групи волонтерів (отримайте через @userinfobot)
TELEGRAM_CHAT_ID=-100123456789

# Claude API: console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...
```

> Без ключів сайт працює повністю. AI-чат повертає контакти замість відповіді, Telegram вимкнений.

### 3. Запустіть

```bash
docker compose up -d
```

Сайт доступний на **http://localhost:3000**

Подивитись логи:

```bash
docker compose logs -f
```

### 4. Зупинити контейнер (дані збережуться)

```bash
docker compose stop
```

Запустити знову:

```bash
docker compose start
```

### 5. Зупинити і видалити контейнер (дані збережуться у volumes)

```bash
docker compose down
```

### 6. Видалити повністю разом із базою даних і фото

```bash
docker compose down -v
```

> Прапор `-v` видаляє Docker volumes — базу SQLite і завантажені фото. Відновити неможливо.

---

## Локальний запуск без Docker

```bash
cd backend
npm install
node server.js
```

Сайт на **http://localhost:3000**

---

## API

| Метод | Endpoint | Опис |
|---|---|---|
| GET | `/api/pets` | Список тварин |
| GET | `/api/pets?type=cat` | Фільтр за видом |
| GET | `/api/pets?status=Шукає родину` | Фільтр за статусом |
| POST | `/api/pets` | Додати тварину (multipart/form-data) |
| PUT | `/api/pets/:id` | Оновити тварину |
| DELETE | `/api/pets/:id` | Видалити тварину |
| POST | `/api/adoptions` | Подати заявку на адопцію |
| GET | `/api/adoptions` | Список заявок |
| POST | `/api/chat` | AI-чат (body: `{ messages: [...] }`) |
| POST | `/api/webhook/makepet` | Вебхук для Make.com |
