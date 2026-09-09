// db.js — Inisialisasi database SQLite, skema, dan data contoh awal.
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { hashPassword } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'klinik.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Skema
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS owners (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS patients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  species     TEXT,
  breed       TEXT,
  sex         TEXT,
  birth_date  TEXT,
  color       TEXT,
  weight      REAL,
  microchip   TEXT,
  sterilized  INTEGER DEFAULT 0,
  allergies   TEXT,
  notes       TEXT,
  active      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients(owner_id);

CREATE TABLE IF NOT EXISTS appointments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  scheduled_at  TEXT NOT NULL,
  type          TEXT,
  status        TEXT DEFAULT 'Menunggu',
  reason        TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_time ON appointments(scheduled_at);

CREATE TABLE IF NOT EXISTS medical_records (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id     INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  visit_date     TEXT NOT NULL,
  weight         REAL,
  temperature    REAL,
  subjective     TEXT,
  objective      TEXT,
  assessment     TEXT,
  plan           TEXT,
  vet_name       TEXT,
  created_at     TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_records_patient ON medical_records(patient_id);

CREATE TABLE IF NOT EXISTS vaccinations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vaccine_name  TEXT NOT NULL,
  given_date    TEXT NOT NULL,
  next_due_date TEXT,
  batch_no      TEXT,
  vet_name      TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_vacc_patient ON vaccinations(patient_id);
CREATE INDEX IF NOT EXISTS idx_vacc_due ON vaccinations(next_due_date);

CREATE TABLE IF NOT EXISTS invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no     TEXT,
  patient_id     INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  owner_id       INTEGER REFERENCES owners(id) ON DELETE SET NULL,
  invoice_date   TEXT NOT NULL,
  status         TEXT DEFAULT 'Belum Bayar',
  discount       REAL DEFAULT 0,
  tax            REAL DEFAULT 0,
  total          REAL DEFAULT 0,
  paid           REAL DEFAULT 0,
  payment_method TEXT,
  notes          TEXT,
  created_at     TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_invoice_patient ON invoices(patient_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category    TEXT,
  qty         REAL DEFAULT 1,
  unit_price  REAL DEFAULT 0,
  amount      REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS communications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id   INTEGER REFERENCES owners(id) ON DELETE SET NULL,
  patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  channel    TEXT DEFAULT 'WhatsApp',
  category   TEXT,
  phone      TEXT,
  message    TEXT,
  status     TEXT DEFAULT 'Terkirim',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_comm_owner ON communications(owner_id);
CREATE INDEX IF NOT EXISTS idx_comm_patient ON communications(patient_id);

CREATE TABLE IF NOT EXISTS arrivals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id     INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  arrived_at     TEXT NOT NULL,
  status         TEXT DEFAULT 'Menunggu',
  complaint      TEXT,
  notes          TEXT,
  called_at      TEXT,
  finished_at    TEXT,
  created_at     TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_arr_patient ON arrivals(patient_id);
CREATE INDEX IF NOT EXISTS idx_arr_arrived ON arrivals(arrived_at);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'resepsionis',
  password_hash TEXT NOT NULL,
  active        INTEGER DEFAULT 1,
  must_change   INTEGER DEFAULT 0,
  last_login_at TEXT,
  created_at    TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

// ---------------------------------------------------------------------------
// Default pengaturan klinik
// ---------------------------------------------------------------------------
const defaultSettings = {
  clinic_name: 'Klinik Hewan Sehat',
  clinic_address: 'Jl. Merdeka No. 10, Jakarta',
  clinic_phone: '021-1234567',
  clinic_email: 'halo@kliniksehat.id',
  clinic_vet: 'drh. Budi Santoso',
};
const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
);
for (const [k, v] of Object.entries(defaultSettings)) {
  if (!getSetting.get(k)) setSetting.run(k, v);
}

// ---------------------------------------------------------------------------
// Data contoh (hanya saat database benar-benar baru / tabel owners kosong)
// ---------------------------------------------------------------------------
const ownerCount = db.prepare('SELECT COUNT(*) AS n FROM owners').get().n;
if (ownerCount === 0) {
  seedDemoData();
}

// Data contoh "hari ini" (janji temu + kedatangan pasien). Dijalankan sekali saja,
// ditandai lewat settings, agar tab Kedatangan langsung berisi data untuk dicoba.
if (!getSetting.get('arrivals_seeded')) {
  seedTodayDemo();
  setSetting.run('arrivals_seeded', '1');
}

// ---------------------------------------------------------------------------
// Akun admin bawaan (hanya saat belum ada pengguna sama sekali).
// Kredensial: admin / admin123 — WAJIB diganti saat login pertama (must_change).
// ---------------------------------------------------------------------------
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  db.prepare(
    'INSERT INTO users (username, name, role, password_hash, active, must_change) VALUES (?,?,?,?,1,1)'
  ).run('admin', 'Administrator', 'admin', hashPassword('admin123'));
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}
function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function seedDemoData() {
  const today = new Date();
  const insertOwner = db.prepare(
    'INSERT INTO owners (name, phone, email, address) VALUES (?, ?, ?, ?)'
  );
  const insertPatient = db.prepare(`INSERT INTO patients
    (owner_id, name, species, breed, sex, birth_date, color, weight, sterilized, allergies)
    VALUES (@owner_id,@name,@species,@breed,@sex,@birth_date,@color,@weight,@sterilized,@allergies)`);
  const insertAppt = db.prepare(`INSERT INTO appointments
    (patient_id, scheduled_at, type, status, reason) VALUES (?,?,?,?,?)`);
  const insertVacc = db.prepare(`INSERT INTO vaccinations
    (patient_id, vaccine_name, given_date, next_due_date, batch_no, vet_name) VALUES (?,?,?,?,?,?)`);
  const insertRecord = db.prepare(`INSERT INTO medical_records
    (patient_id, visit_date, weight, temperature, subjective, objective, assessment, plan, vet_name)
    VALUES (@patient_id,@visit_date,@weight,@temperature,@subjective,@objective,@assessment,@plan,@vet_name)`);

  const tx = db.transaction(() => {
    const o1 = insertOwner.run('Siti Rahmawati', '0812-3456-7890', 'siti@email.com', 'Jl. Kenanga No. 5, Bandung').lastInsertRowid;
    const o2 = insertOwner.run('Andi Wijaya', '0857-1111-2222', 'andi.w@email.com', 'Jl. Melati No. 12, Bandung').lastInsertRowid;
    const o3 = insertOwner.run('Dewi Lestari', '0821-9999-0000', '', 'Jl. Anggrek No. 3, Cimahi').lastInsertRowid;

    const p1 = insertPatient.run({ owner_id: o1, name: 'Milo', species: 'Kucing', breed: 'Domestik', sex: 'Jantan', birth_date: '2022-03-15', color: 'Oranye', weight: 4.2, sterilized: 1, allergies: '' }).lastInsertRowid;
    const p2 = insertPatient.run({ owner_id: o1, name: 'Luna', species: 'Kucing', breed: 'Persia', sex: 'Betina', birth_date: '2021-07-01', color: 'Putih', weight: 3.8, sterilized: 0, allergies: 'Seafood' }).lastInsertRowid;
    const p3 = insertPatient.run({ owner_id: o2, name: 'Rocky', species: 'Anjing', breed: 'Golden Retriever', sex: 'Jantan', birth_date: '2020-01-20', color: 'Emas', weight: 28.5, sterilized: 0, allergies: '' }).lastInsertRowid;
    const p4 = insertPatient.run({ owner_id: o3, name: 'Kiki', species: 'Kelinci', breed: 'Anggora', sex: 'Betina', birth_date: '2023-05-10', color: 'Abu-abu', weight: 1.6, sterilized: 0, allergies: '' }).lastInsertRowid;

    // Janji temu hari ini & mendatang
    insertAppt.run(p1, `${iso(today)} 09:00`, 'Vaksinasi', 'Menunggu', 'Vaksin rabies tahunan');
    insertAppt.run(p3, `${iso(today)} 10:30`, 'Kontrol', 'Menunggu', 'Kontrol pasca operasi');
    insertAppt.run(p2, `${iso(today)} 13:00`, 'Konsultasi', 'Diperiksa', 'Nafsu makan menurun');
    insertAppt.run(p4, `${iso(addDays(today, 2))} 11:00`, 'Grooming', 'Menunggu', 'Grooming rutin');

    // Vaksinasi (ada yang akan jatuh tempo & terlambat)
    insertVacc.run(p1, 'Rabies', iso(addDays(today, -350)), iso(addDays(today, 15)), 'RB-2231', 'drh. Budi Santoso');
    insertVacc.run(p3, 'Rabies', iso(addDays(today, -380)), iso(addDays(today, -15)), 'RB-2190', 'drh. Budi Santoso');
    insertVacc.run(p2, 'Tricat', iso(addDays(today, -200)), iso(addDays(today, 40)), 'TC-1180', 'drh. Budi Santoso');

    // Contoh rekam medis
    insertRecord.run({
      patient_id: p2, visit_date: iso(addDays(today, -3)), weight: 3.8, temperature: 39.1,
      subjective: 'Nafsu makan menurun sejak 2 hari, lesu.',
      objective: 'Membran mukosa pucat, dehidrasi ringan (~5%). Suhu 39,1°C.',
      assessment: 'Suspek gangguan pencernaan / gastritis.',
      plan: 'Infus RL, ranitidin, diet lunak. Kontrol 3 hari.',
      vet_name: 'drh. Budi Santoso',
    });

    return { o1, p1, p2, p3 };
  });

  const ids = tx();

  // Contoh tagihan LUNAS untuk pasien Luna
  const insertInvoice = db.prepare(`INSERT INTO invoices
    (invoice_no, patient_id, owner_id, invoice_date, status, discount, tax, total, paid, payment_method)
    VALUES (@invoice_no,@patient_id,@owner_id,@invoice_date,@status,@discount,@tax,@total,@paid,@payment_method)`);
  const insertItem = db.prepare(`INSERT INTO invoice_items
    (invoice_id, description, category, qty, unit_price, amount) VALUES (?,?,?,?,?,?)`);

  const invTx = db.transaction(() => {
    const items = [
      ['Konsultasi Dokter Hewan', 'Jasa', 1, 75000],
      ['Cairan Infus RL', 'Obat', 1, 45000],
      ['Injeksi Ranitidin', 'Obat', 2, 25000],
    ];
    const subtotal = items.reduce((s, [, , q, p]) => s + q * p, 0);
    const total = subtotal; // tanpa diskon/pajak
    const invId = insertInvoice.run({
      invoice_no: `INV-${today.getFullYear()}-0001`,
      patient_id: ids.p2, owner_id: ids.o1, invoice_date: iso(addDays(today, -3)),
      status: 'Lunas', discount: 0, tax: 0, total, paid: total, payment_method: 'Tunai',
    }).lastInsertRowid;
    for (const [desc, cat, q, price] of items) {
      insertItem.run(invId, desc, cat, q, price, q * price);
    }
  });
  invTx();
}

// Pastikan ada janji temu HARI INI + beberapa kedatangan pasien, agar modul
// "Janji Temu & Kedatangan Pasien" langsung ada isinya saat pertama dibuka.
function seedTodayDemo() {
  const patients = db.prepare('SELECT id FROM patients ORDER BY id LIMIT 4').all();
  if (patients.length === 0) return;
  const pid = (i) => (patients[i] || patients[0]).id;

  const now = new Date();
  const isoT = iso(now);
  const p2 = (n) => String(n).padStart(2, '0');
  // Timestamp "menit lalu" yang tetap jatuh di tanggal hari ini.
  const stamp = (mins) => {
    const d = new Date(now.getTime() - mins * 60000);
    const sameDay = iso(d) === isoT;
    const hh = sameDay ? d.getHours() : 0;
    const mm = sameDay ? d.getMinutes() : 5;
    return `${isoT} ${p2(hh)}:${p2(mm)}`;
  };

  // 1) Janji temu hari ini (dibuat hanya bila belum ada), untuk tab Janji + check-in.
  let todays = db.prepare("SELECT id, patient_id FROM appointments WHERE substr(scheduled_at,1,10)=?").all(isoT);
  if (todays.length === 0) {
    const insAppt = db.prepare('INSERT INTO appointments (patient_id, scheduled_at, type, status, reason) VALUES (?,?,?,?,?)');
    const txA = db.transaction(() => {
      insAppt.run(pid(0), `${isoT} 09:00`, 'Vaksinasi', 'Menunggu', 'Vaksin rabies tahunan');
      insAppt.run(pid(1), `${isoT} 10:30`, 'Konsultasi', 'Menunggu', 'Nafsu makan menurun');
      insAppt.run(pid(2), `${isoT} 11:15`, 'Kontrol', 'Menunggu', 'Kontrol pasca operasi');
    });
    txA();
    todays = db.prepare("SELECT id, patient_id FROM appointments WHERE substr(scheduled_at,1,10)=?").all(isoT);
  }
  const apptOf = {};
  for (const a of todays) if (!(a.patient_id in apptOf)) apptOf[a.patient_id] = a.id;

  // 2) Kedatangan pasien hari ini. Pasien ke-3 sengaja belum "datang" agar
  //    tombol check-in di tab Janji bisa dicoba; pasien ke-4 sebagai walk-in.
  const insArr = db.prepare(`INSERT INTO arrivals
    (patient_id, appointment_id, arrived_at, status, complaint, called_at, finished_at)
    VALUES (?,?,?,?,?,?,?)`);
  const rows = [
    [pid(0), 85, 'Selesai',   'Vaksin rabies tahunan', 70, 15],
    [pid(1), 45, 'Diperiksa', 'Nafsu makan menurun', 15, null],
    [pid(3), 12, 'Menunggu',  'Gatal & garuk berlebih (walk-in)', null, null],
  ];
  const txB = db.transaction(() => {
    for (const [p, arr, status, complaint, called, finished] of rows) {
      insArr.run(
        p,
        apptOf[p] || null,
        stamp(arr),
        status,
        complaint,
        called != null ? stamp(called) : null,
        finished != null ? stamp(finished) : null
      );
    }
  });
  txB();
}

export default db;
