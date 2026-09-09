// routes/vaccinations.js — Riwayat & jadwal vaksinasi.
import { Router } from 'express';
import db from '../db.js';
import { required, str, intId, found } from '../helpers.js';

const r = Router();

r.get('/', (req, res) => {
  const patientId = req.query.patient_id ? intId(req.query.patient_id) : null;
  if (patientId) {
    return res.json(db.prepare('SELECT * FROM vaccinations WHERE patient_id=? ORDER BY given_date DESC').all(patientId));
  }
  // Semua vaksin dengan jadwal jatuh tempo (untuk pengingat)
  res.json(
    db.prepare(`
      SELECT v.*, p.name AS patient_name, p.species AS patient_species,
             o.name AS owner_name, o.phone AS owner_phone
      FROM vaccinations v
      JOIN patients p ON p.id = v.patient_id
      JOIN owners o ON o.id = p.owner_id
      WHERE v.next_due_date IS NOT NULL
      ORDER BY v.next_due_date`).all()
  );
});

function body(b) {
  return {
    patient_id: intId(b.patient_id),
    vaccine_name: str(b.vaccine_name),
    given_date: str(b.given_date),
    next_due_date: str(b.next_due_date),
    batch_no: str(b.batch_no),
    vet_name: str(b.vet_name),
    notes: str(b.notes),
  };
}

r.post('/', (req, res) => {
  required(req.body, ['patient_id', 'vaccine_name', 'given_date']);
  const v = body(req.body);
  const info = db.prepare(`INSERT INTO vaccinations
    (patient_id,vaccine_name,given_date,next_due_date,batch_no,vet_name,notes)
    VALUES (@patient_id,@vaccine_name,@given_date,@next_due_date,@batch_no,@vet_name,@notes)`).run(v);
  res.status(201).json(db.prepare('SELECT * FROM vaccinations WHERE id=?').get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const id = intId(req.params.id);
  found(db.prepare('SELECT id FROM vaccinations WHERE id=?').get(id), 'Data vaksinasi tidak ditemukan.');
  required(req.body, ['patient_id', 'vaccine_name', 'given_date']);
  const v = body(req.body);
  v.id = id;
  db.prepare(`UPDATE vaccinations SET patient_id=@patient_id,vaccine_name=@vaccine_name,given_date=@given_date,
    next_due_date=@next_due_date,batch_no=@batch_no,vet_name=@vet_name,notes=@notes WHERE id=@id`).run(v);
  res.json(db.prepare('SELECT * FROM vaccinations WHERE id=?').get(id));
});

r.delete('/:id', (req, res) => {
  const id = intId(req.params.id);
  db.prepare('DELETE FROM vaccinations WHERE id=?').run(id);
  res.json({ ok: true });
});

export default r;
