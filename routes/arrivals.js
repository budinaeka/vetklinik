// routes/arrivals.js — Kedatangan pasien / antrian ruang tunggu (check-in).
import { Router } from 'express';
import db from '../db.js';
import { required, str, intId, found } from '../helpers.js';

const r = Router();

const STATUSES = ['Menunggu', 'Diperiksa', 'Selesai', 'Pulang'];

const SELECT = `
  SELECT a.*, p.name AS patient_name, p.species AS patient_species,
         o.id AS owner_id, o.name AS owner_name, o.phone AS owner_phone,
         ap.scheduled_at AS appt_time, ap.type AS appt_type
  FROM arrivals a
  JOIN patients p ON p.id = a.patient_id
  JOIN owners o ON o.id = p.owner_id
  LEFT JOIN appointments ap ON ap.id = a.appointment_id`;

// Waktu lokal "YYYY-MM-DD HH:MM" untuk nilai bawaan waktu datang.
function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

r.get('/', (req, res) => {
  const date = str(req.query.date);
  const status = str(req.query.status);
  const clauses = [];
  const params = [];
  if (date) {
    clauses.push('substr(a.arrived_at,1,10) = ?');
    params.push(date);
  }
  if (status) {
    clauses.push('a.status = ?');
    params.push(status);
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  res.json(db.prepare(`${SELECT} ${where} ORDER BY a.arrived_at`).all(...params));
});

r.get('/:id', (req, res) => {
  const id = intId(req.params.id);
  res.json(found(db.prepare(`${SELECT} WHERE a.id = ?`).get(id), 'Data kedatangan tidak ditemukan.'));
});

function body(b) {
  const status = STATUSES.includes(str(b.status)) ? str(b.status) : 'Menunggu';
  return {
    patient_id: intId(b.patient_id),
    appointment_id: b.appointment_id ? intId(b.appointment_id) : null,
    arrived_at: str(b.arrived_at) || nowLocal(),
    status,
    complaint: str(b.complaint),
    notes: str(b.notes),
  };
}

r.post('/', (req, res) => {
  required(req.body, ['patient_id']);
  const v = body(req.body);
  // Bila langsung dibuat pada status lanjut, catat perkiraan waktunya.
  v.called_at = ['Diperiksa', 'Selesai', 'Pulang'].includes(v.status) ? v.arrived_at : null;
  v.finished_at = ['Selesai', 'Pulang'].includes(v.status) ? v.arrived_at : null;
  const info = db.prepare(`INSERT INTO arrivals
    (patient_id, appointment_id, arrived_at, status, complaint, notes, called_at, finished_at)
    VALUES (@patient_id,@appointment_id,@arrived_at,@status,@complaint,@notes,@called_at,@finished_at)`).run(v);
  res.status(201).json(db.prepare(`${SELECT} WHERE a.id=?`).get(info.lastInsertRowid));
});

// Ubah status antrian saja (satu klik: Menunggu → Diperiksa → Selesai → Pulang).
r.put('/:id/status', (req, res) => {
  const id = intId(req.params.id);
  const status = str(req.body.status);
  if (!STATUSES.includes(status)) {
    const e = new Error('Status tidak valid.');
    e.status = 400;
    throw e;
  }
  const cur = found(db.prepare('SELECT * FROM arrivals WHERE id=?').get(id), 'Data kedatangan tidak ditemukan.');
  const sets = ['status=@status'];
  const v = { id, status };
  if (['Diperiksa', 'Selesai', 'Pulang'].includes(status) && !cur.called_at) {
    sets.push("called_at=datetime('now','localtime')");
  }
  if (['Selesai', 'Pulang'].includes(status) && !cur.finished_at) {
    sets.push("finished_at=datetime('now','localtime')");
  }
  db.prepare(`UPDATE arrivals SET ${sets.join(', ')} WHERE id=@id`).run(v);
  res.json(db.prepare(`${SELECT} WHERE a.id=?`).get(id));
});

r.put('/:id', (req, res) => {
  const id = intId(req.params.id);
  found(db.prepare('SELECT id FROM arrivals WHERE id=?').get(id), 'Data kedatangan tidak ditemukan.');
  required(req.body, ['patient_id']);
  const v = body(req.body);
  v.id = id;
  db.prepare(`UPDATE arrivals SET patient_id=@patient_id, appointment_id=@appointment_id,
    arrived_at=@arrived_at, status=@status, complaint=@complaint, notes=@notes WHERE id=@id`).run(v);
  res.json(db.prepare(`${SELECT} WHERE a.id=?`).get(id));
});

r.delete('/:id', (req, res) => {
  const id = intId(req.params.id);
  db.prepare('DELETE FROM arrivals WHERE id=?').run(id);
  res.json({ ok: true });
});

export default r;
