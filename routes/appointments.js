// routes/appointments.js — Janji temu / jadwal kunjungan.
import { Router } from 'express';
import db from '../db.js';
import { required, str, intId, found } from '../helpers.js';

const r = Router();

const SELECT = `
  SELECT a.*, p.name AS patient_name, p.species AS patient_species,
         o.name AS owner_name, o.phone AS owner_phone
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN owners o ON o.id = p.owner_id`;

r.get('/', (req, res) => {
  const date = str(req.query.date);
  const status = str(req.query.status);
  const q = str(req.query.q);
  const clauses = [];
  const params = [];
  if (date) {
    clauses.push('substr(a.scheduled_at,1,10) = ?');
    params.push(date);
  }
  if (status) {
    clauses.push('a.status = ?');
    params.push(status);
  }
  if (q) {
    const like = `%${q}%`;
    clauses.push('(p.name LIKE ? OR o.name LIKE ?)');
    params.push(like, like);
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  res.json(db.prepare(`${SELECT} ${where} ORDER BY a.scheduled_at`).all(...params));
});

r.get('/:id', (req, res) => {
  const id = intId(req.params.id);
  res.json(found(db.prepare(`${SELECT} WHERE a.id = ?`).get(id), 'Janji temu tidak ditemukan.'));
});

function body(b) {
  return {
    patient_id: intId(b.patient_id),
    scheduled_at: str(b.scheduled_at),
    type: str(b.type),
    status: str(b.status) || 'Menunggu',
    reason: str(b.reason),
    notes: str(b.notes),
  };
}

r.post('/', (req, res) => {
  required(req.body, ['patient_id', 'scheduled_at']);
  const v = body(req.body);
  const info = db.prepare(`INSERT INTO appointments (patient_id,scheduled_at,type,status,reason,notes)
    VALUES (@patient_id,@scheduled_at,@type,@status,@reason,@notes)`).run(v);
  res.status(201).json(db.prepare(`${SELECT} WHERE a.id=?`).get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const id = intId(req.params.id);
  found(db.prepare('SELECT id FROM appointments WHERE id=?').get(id), 'Janji temu tidak ditemukan.');
  required(req.body, ['patient_id', 'scheduled_at']);
  const v = body(req.body);
  v.id = id;
  db.prepare(`UPDATE appointments SET patient_id=@patient_id,scheduled_at=@scheduled_at,type=@type,
    status=@status,reason=@reason,notes=@notes WHERE id=@id`).run(v);
  res.json(db.prepare(`${SELECT} WHERE a.id=?`).get(id));
});

r.delete('/:id', (req, res) => {
  const id = intId(req.params.id);
  db.prepare('DELETE FROM appointments WHERE id=?').run(id);
  res.json({ ok: true });
});

export default r;
