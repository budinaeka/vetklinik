// routes/komunikasi.js — Komunikasi WhatsApp (OpenVPM "communications" versi ringan).
// Pendekatan RINGAN: tidak memakai WhatsApp Business API / gateway berbayar.
// Frontend membuat tautan wa.me (klik-untuk-chat); endpoint ini hanya:
//   - menyediakan "saran pesan" (vaksinasi jatuh tempo & tagihan belum lunas), dan
//   - mencatat riwayat pesan yang dikirim staf.
import { Router } from 'express';
import db from '../db.js';
import { required, str, intId } from '../helpers.js';

const r = Router();

function isoDay(d) {
  // Tanggal lokal (YYYY-MM-DD) tanpa pergeseran zona waktu.
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Riwayat komunikasi (opsional difilter per pasien).
r.get('/', (req, res) => {
  const patientId = req.query.patient_id ? intId(req.query.patient_id) : null;
  const where = patientId ? 'WHERE c.patient_id = ?' : '';
  const params = patientId ? [patientId] : [];
  res.json(
    db.prepare(`
      SELECT c.*, o.name AS owner_name, p.name AS patient_name, p.species AS patient_species
      FROM communications c
      LEFT JOIN owners o ON o.id = c.owner_id
      LEFT JOIN patients p ON p.id = c.patient_id
      ${where}
      ORDER BY c.id DESC LIMIT 100`).all(...params)
  );
});

// Saran pesan otomatis: vaksinasi jatuh tempo/terlambat + tagihan belum lunas.
r.get('/suggestions', (req, res) => {
  const today = new Date();
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const iso30 = isoDay(in30);

  const vaccinations = db.prepare(`
    SELECT v.id, v.vaccine_name, v.next_due_date,
           p.id AS patient_id, p.name AS patient_name, p.species AS patient_species,
           o.id AS owner_id, o.name AS owner_name, o.phone AS owner_phone
    FROM vaccinations v
    JOIN patients p ON p.id = v.patient_id
    JOIN owners o ON o.id = p.owner_id
    WHERE v.next_due_date IS NOT NULL AND v.next_due_date <= ?
    ORDER BY v.next_due_date`).all(iso30);

  const invoices = db.prepare(`
    SELECT i.id, i.invoice_no, i.invoice_date, i.total, i.paid, i.status,
           p.id AS patient_id, p.name AS patient_name, p.species AS patient_species,
           o.id AS owner_id, o.name AS owner_name, o.phone AS owner_phone
    FROM invoices i
    LEFT JOIN patients p ON p.id = i.patient_id
    LEFT JOIN owners o ON o.id = i.owner_id
    WHERE i.status != 'Lunas'
    ORDER BY i.invoice_date DESC LIMIT 50`).all();

  res.json({ vaccinations, invoices, today: isoDay(today) });
});

// Catat pesan terkirim (dipanggil frontend setelah membuka WhatsApp).
r.post('/', (req, res) => {
  required(req.body, ['message']);
  const data = {
    owner_id: req.body.owner_id ? intId(req.body.owner_id) : null,
    patient_id: req.body.patient_id ? intId(req.body.patient_id) : null,
    category: str(req.body.category) || 'umum',
    phone: str(req.body.phone),
    message: str(req.body.message),
    status: str(req.body.status) || 'Terkirim',
  };
  const info = db.prepare(`INSERT INTO communications
    (owner_id, patient_id, category, phone, message, status)
    VALUES (@owner_id,@patient_id,@category,@phone,@message,@status)`).run(data);
  res.status(201).json(
    db.prepare(`
      SELECT c.*, o.name AS owner_name, p.name AS patient_name, p.species AS patient_species
      FROM communications c
      LEFT JOIN owners o ON o.id = c.owner_id
      LEFT JOIN patients p ON p.id = c.patient_id
      WHERE c.id = ?`).get(info.lastInsertRowid)
  );
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM communications WHERE id=?').run(intId(req.params.id));
  res.json({ ok: true });
});

export default r;
