const TelegramBot = require('node-telegram-bot-api');

let bot = null;
let db = null;

const sessions = {};

function isAdmin(userId) {
  const admins = (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
  if (admins.length === 0) return String(userId) === String(process.env.TELEGRAM_CHAT_ID);
  return admins.includes(String(userId));
}

function init(database) {
  db = database;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || token === 'your_bot_token_here') {
    console.warn('[Bot] TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.');
    return null;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('[Bot] Telegram bot started');

  registerHandlers();
  return bot;
}

function registerHandlers() {
  bot.onText(/\/start/, (msg) => {
    const name = msg.from.first_name || 'Волонтере';
    bot.sendMessage(msg.chat.id,
      `👋 Привіт, ${name}!\n\n` +
      `Я — бот притулку *Dnipro Animals*.\n\n` +
      `📋 Команди:\n` +
      `/list — список тварин\n` +
      `/addpet — додати нову тварину\n` +
      `/setstatus — змінити статус тварини\n` +
      `/adoptions — нові заявки на адопцію\n` +
      `/help — допомога`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `🐾 *Dnipro Animals Bot*\n\n` +
      `*/list* — переглянути всіх тварин\n` +
      `*/addpet* — додати нову тварину (покроково)\n` +
      `*/setstatus <id> <статус>* — змінити статус\n` +
      `  Статуси: \`Шукає родину\`, \`На адаптації\`, \`Прилаштована\`\n` +
      `*/adoptions* — список нових заявок\n`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/list/, (msg) => {
    const pets = db.prepare('SELECT * FROM pets ORDER BY created_at DESC').all();
    if (!pets.length) {
      return bot.sendMessage(msg.chat.id, '😿 Тварин поки немає в базі.');
    }
    const text = pets.map(p =>
      `${p.type === 'cat' ? '🐱' : '🐶'} *${p.name}* (ID: ${p.id})\n` +
      `   Стать: ${p.gender || '—'} | Вік: ${p.age || '—'}\n` +
      `   Статус: ${p.status}`
    ).join('\n\n');
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/adoptions/, (msg) => {
    const adoptions = db.prepare(
      "SELECT * FROM adoptions WHERE status = 'Нова' ORDER BY created_at DESC LIMIT 10"
    ).all();
    if (!adoptions.length) {
      return bot.sendMessage(msg.chat.id, '📭 Нових заявок немає.');
    }
    const text = adoptions.map(a =>
      `📋 *Заявка #${a.id}*\n` +
      `   Тварина: ${a.pet_name || `ID ${a.pet_id}`}\n` +
      `   Ім'я: ${a.applicant_name}\n` +
      `   Телефон: ${a.phone || '—'}\n` +
      `   Email: ${a.email || '—'}\n` +
      `   Повідомлення: ${a.message || '—'}\n` +
      `   Дата: ${new Date(a.created_at).toLocaleString('uk-UA')}`
    ).join('\n\n');
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/setstatus (\d+) (.+)/, (msg, match) => {
    if (!isAdmin(msg.from.id)) {
      return bot.sendMessage(msg.chat.id, '⛔ Тільки адміністратори можуть змінювати статус тварин.');
    }
    const id = parseInt(match[1]);
    const status = match[2].trim();
    const allowed = ['Шукає родину', 'На адаптації', 'Прилаштована'];
    if (!allowed.includes(status)) {
      return bot.sendMessage(msg.chat.id,
        `❌ Невідомий статус.\nДозволені: ${allowed.map(s => `\`${s}\``).join(', ')}`,
        { parse_mode: 'Markdown' }
      );
    }
    const info = db.prepare('UPDATE pets SET status = ? WHERE id = ?').run(status, id);
    if (info.changes === 0) {
      return bot.sendMessage(msg.chat.id, `❌ Тварину з ID ${id} не знайдено.`);
    }
    syncPetsJson();
    bot.sendMessage(msg.chat.id, `✅ Статус тварини #${id} змінено на: *${status}*`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/addpet/, (msg) => {
    const chatId = msg.chat.id;
    sessions[chatId] = { step: 'type', data: {} };
    bot.sendMessage(chatId,
      '🐾 Додаємо нову тварину!\n\nКого додаємо?',
      {
        reply_markup: {
          keyboard: [['🐱 Кіт', '🐶 Собака']],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      }
    );
  });

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const session = sessions[chatId];
    if (!session || msg.text?.startsWith('/')) return;

    const { step, data } = session;

    if (step === 'type') {
      if (msg.text?.includes('Кіт') || msg.text?.toLowerCase() === 'cat') {
        data.type = 'cat';
      } else if (msg.text?.includes('Собака') || msg.text?.toLowerCase() === 'dog') {
        data.type = 'dog';
      } else {
        return bot.sendMessage(chatId, 'Оберіть: 🐱 Кіт або 🐶 Собака');
      }
      session.step = 'name';
      bot.sendMessage(chatId, `Як звуть ${data.type === 'cat' ? 'котика' : 'собаку'}?`, {
        reply_markup: { remove_keyboard: true }
      });

    } else if (step === 'name') {
      data.name = msg.text?.trim();
      session.step = 'age';
      bot.sendMessage(chatId, 'Скільки років? (наприклад: 2 роки, 6 місяців)');

    } else if (step === 'age') {
      data.age = msg.text?.trim();
      session.step = 'gender';
      bot.sendMessage(chatId, 'Стать:', {
        reply_markup: {
          keyboard: [['Хлопчик', 'Дівчинка']],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });

    } else if (step === 'gender') {
      data.gender = msg.text?.trim();
      session.step = 'vaccinated';
      bot.sendMessage(chatId, 'Вакцинований(а)?', {
        reply_markup: {
          keyboard: [['Так', 'Ні']],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });

    } else if (step === 'vaccinated') {
      data.vaccinated = msg.text?.trim();
      session.step = 'description';
      bot.sendMessage(chatId, 'Напишіть короткий опис тваринки:', {
        reply_markup: { remove_keyboard: true }
      });

    } else if (step === 'description') {
      data.description = msg.text?.trim();
      session.step = 'photo';
      bot.sendMessage(chatId, 'Надішліть фото тваринки (або напишіть "пропустити"):');

    } else if (step === 'photo') {
      if (msg.photo) {
        const photo = msg.photo[msg.photo.length - 1];
        data.photo_file_id = photo.file_id;
        data.photo = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${photo.file_id}`;
      } else {
        data.photo = null;
      }
      savePet(chatId, data);
    }
  });
}

function savePet(chatId, data) {
  try {
    const result = db.prepare(`
      INSERT INTO pets (name, type, age, gender, description, photo, status, vaccinated)
      VALUES (@name, @type, @age, @gender, @description, @photo, @status, @vaccinated)
    `).run({
      name: data.name,
      type: data.type,
      age: data.age || null,
      gender: data.gender || null,
      description: data.description || null,
      photo: data.photo || null,
      status: 'Шукає родину',
      vaccinated: data.vaccinated || 'Ні'
    });

    syncPetsJson();
    delete sessions[chatId];

    bot.sendMessage(chatId,
      `✅ *${data.name}* успішно додано до бази!\nID: ${result.lastInsertRowid}\nСтатус: Шукає родину`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    bot.sendMessage(chatId, `❌ Помилка при збереженні: ${e.message}`);
  }
}

function syncPetsJson() {
  try {
    const path = require('path');
    const fs = require('fs');
    const pets = db.prepare('SELECT * FROM pets ORDER BY id').all();
    const jsonPath = path.join(__dirname, '..', 'pets.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ pets }, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Bot] Could not sync pets.json:', e.message);
  }
}

function notifyAdoption(adoption) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chatId || chatId === 'your_volunteer_chat_id_here') return;

  const text =
    `🔔 *Нова заявка на адопцію!*\n\n` +
    `🐾 Тварина: ${adoption.pet_name || `ID ${adoption.pet_id}`}\n` +
    `👤 Ім'я: ${adoption.applicant_name}\n` +
    `📞 Телефон: ${adoption.phone || '—'}\n` +
    `📧 Email: ${adoption.email || '—'}\n` +
    `💬 Повідомлення: ${adoption.message || '—'}`;

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(console.error);
}

module.exports = { init, notifyAdoption, syncPetsJson };
