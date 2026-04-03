const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'shelter.db');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS pets (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    type      TEXT    NOT NULL CHECK(type IN ('cat', 'dog')),
    age       TEXT,
    gender    TEXT,
    description TEXT,
    photo     TEXT,
    status    TEXT    DEFAULT 'Шукає родину',
    vaccinated TEXT   DEFAULT 'Так',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS adoptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id          INTEGER,
    pet_name        TEXT,
    applicant_name  TEXT NOT NULL,
    phone           TEXT,
    email           TEXT,
    message         TEXT,
    status          TEXT DEFAULT 'Нова',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id)
  );
`);

const petsCount = db.prepare('SELECT COUNT(*) as count FROM pets').get();
if (petsCount.count === 0) {
  const seedPath = path.join(__dirname, '..', 'pets.json');
  if (fs.existsSync(seedPath)) {
    try {
      const { pets } = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const insert = db.prepare(`
        INSERT INTO pets (name, type, age, gender, description, photo, status, vaccinated)
        VALUES (@name, @type, @age, @gender, @description, @photo, @status, @vaccinated)
      `);
      const insertMany = db.transaction((items) => {
        for (const pet of items) insert.run(pet);
      });
      insertMany(pets);
      console.log(`[DB] Seeded ${pets.length} pets from pets.json`);
    } catch (e) {
      console.warn('[DB] Could not seed from pets.json:', e.message);
    }
  }
}

module.exports = db;
