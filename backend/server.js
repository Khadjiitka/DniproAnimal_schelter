require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const Groq = require('groq-sdk');

const db = require('./db');
const { init: initBot, notifyAdoption, syncPetsJson } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, '..')));

const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `pet_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

let groq = null;
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
  groq = new Groq({ apiKey: process.env.ANTHROPIC_API_KEY });
}


app.get('/api/pets', (req, res) => {
  let query = 'SELECT * FROM pets WHERE 1=1';
  const params = [];

  if (req.query.type) {
    query += ' AND type = ?';
    params.push(req.query.type);
  }
  if (req.query.status) {
    query += ' AND status = ?';
    params.push(req.query.status);
  }
  query += ' ORDER BY created_at DESC';

  const pets = db.prepare(query).all(...params);
  res.json({ pets });
});

app.get('/api/pets/:id', (req, res) => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return res.status(404).json({ error: 'Not found' });
  res.json(pet);
});

app.post('/api/pets', upload.single('photo'), (req, res) => {
  const { name, type, age, gender, description, status, vaccinated, photo_url } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  if (!['cat', 'dog'].includes(type)) {
    return res.status(400).json({ error: 'type must be cat or dog' });
  }

  const photo = req.file
    ? `/uploads/${req.file.filename}`
    : (photo_url || null);

  const result = db.prepare(`
    INSERT INTO pets (name, type, age, gender, description, photo, status, vaccinated)
    VALUES (@name, @type, @age, @gender, @description, @photo, @status, @vaccinated)
  `).run({
    name,
    type,
    age: age || null,
    gender: gender || null,
    description: description || null,
    photo,
    status: status || 'Шукає родину',
    vaccinated: vaccinated || 'Ні'
  });

  syncPetsJson();
  const newPet = db.prepare('SELECT * FROM pets WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newPet);
});

app.put('/api/pets/:id', upload.single('photo'), (req, res) => {
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id);
  if (!pet) return res.status(404).json({ error: 'Not found' });

  const { name, type, age, gender, description, status, vaccinated } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : (req.body.photo_url || pet.photo);

  db.prepare(`
    UPDATE pets SET
      name = @name, type = @type, age = @age, gender = @gender,
      description = @description, photo = @photo,
      status = @status, vaccinated = @vaccinated
    WHERE id = @id
  `).run({
    id: req.params.id,
    name: name || pet.name,
    type: type || pet.type,
    age: age ?? pet.age,
    gender: gender ?? pet.gender,
    description: description ?? pet.description,
    photo,
    status: status || pet.status,
    vaccinated: vaccinated ?? pet.vaccinated
  });

  syncPetsJson();
  res.json(db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.id));
});

app.delete('/api/pets/:id', (req, res) => {
  const info = db.prepare('DELETE FROM pets WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  syncPetsJson();
  res.json({ success: true });
});

app.post('/api/adoptions', (req, res) => {
  const { pet_id, pet_name, applicant_name, phone, email, message } = req.body;

  if (!applicant_name) {
    return res.status(400).json({ error: 'applicant_name is required' });
  }

  const result = db.prepare(`
    INSERT INTO adoptions (pet_id, pet_name, applicant_name, phone, email, message)
    VALUES (@pet_id, @pet_name, @applicant_name, @phone, @email, @message)
  `).run({
    pet_id: pet_id || null,
    pet_name: pet_name || null,
    applicant_name,
    phone: phone || null,
    email: email || null,
    message: message || null
  });

  const adoption = db.prepare('SELECT * FROM adoptions WHERE id = ?').get(result.lastInsertRowid);

  notifyAdoption(adoption);

  res.status(201).json({ success: true, id: result.lastInsertRowid });
});

app.get('/api/adoptions', (req, res) => {
  const adoptions = db.prepare(
    'SELECT * FROM adoptions ORDER BY created_at DESC LIMIT 50'
  ).all();
  res.json({ adoptions });
});


const SYSTEM_PROMPT = `Ти — дружній консультант притулку для тварин "Dnipro Animals" у Дніпрі.
Твоя задача — допомагати відвідувачам сайту знайти ідеального домашнього улюбленця та відповідати на питання про адопцію.

Про притулок:
- Ми рятуємо безпритульних собак і котів, лікуємо та вакцинуємо їх
- Всі тварини проходять ветеринарний огляд і адаптацію перед адопцією
- Адопція безкоштовна
- Контакти: dniproanimals@ukr.net, +380 (99) 000-00-00 (10:00–20:00)

Процес адопції:
1. Переглянути доступних тварин на сайті
2. Натиснути "Забрати пухнастика" та заповнити заявку
3. Волонтери зв'яжуться протягом 24 годин
4. Знайомство з твариною та підписання договору

Поради щодо вибору:
- Кіт підходить для менших квартир, більш самостійний
- Собака потребує регулярних прогулянок і більше уваги
- Запитай у відвідувача про умови проживання і стиль життя

Відповідай тільки українською мовою. Будь теплим, дружнім та корисним.
Якщо питання не стосується притулку — ввічливо поверни розмову до теми тварин.
Відповіді повинні бути короткими (2-4 речення), але корисними.`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  if (!groq) {
    return res.json({
      reply: 'Вибачте, AI-консультант зараз недоступний. Зв\'яжіться з нами: dniproanimals@ukr.net або +380 (99) 000-00-00'
    });
  }

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 512,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.slice(-10)
      ]
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (e) {
    console.error('[Chat] Groq error:', e.message);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

app.post('/api/webhook/makepet', (req, res) => {
  const { name, type, age, gender, description, photo_url, vaccinated } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });

  db.prepare(`
    INSERT INTO pets (name, type, age, gender, description, photo, status, vaccinated)
    VALUES (@name, @type, @age, @gender, @description, @photo, @status, @vaccinated)
  `).run({
    name, type, age: age || null, gender: gender || null,
    description: description || null, photo: photo_url || null,
    status: 'Шукає родину', vaccinated: vaccinated || 'Ні'
  });

  syncPetsJson();
  res.json({ success: true });
});

initBot(db);

app.listen(PORT, () => {
  console.log(`\n🐾 Dnipro Animals server running at http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/pets`);
  console.log(`   AI Chat: ${groq ? 'enabled (Groq)' : 'disabled (no API key)'}`);
  console.log(`   Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_bot_token_here' ? 'enabled' : 'disabled'}`);
});
