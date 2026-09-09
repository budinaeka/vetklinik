// routes/records.js — Rekam medis (SOAP + tanda vital).
import { Router } from 'express';
import db from '../db.js';
import { required, str, num, intId, found } from '../helpers.js';

const r = Router();

r.get('/', (req, res) => {
  const patientId = req.query.patient_id ? intId(req.query.patient_id) : null;
  if (patientId) {
    return res.json(
      db.prepare('SELECT * FROM medical_records WHERE patient_id=? ORDER BY visit_date DESC, id DESC').all(patientId)
    );
  }
  res.json(
    db.prepare(`
      SELECT m.*, p.name AS patient_name, p.species AS patient_species, o.name AS owner_name
      FROM medical_records m
      JOIN patients p ON p.id = m.patient_id
      JOIN owners o ON o.id = p.owner_id
      ORDER BY m.visit_date DESC, m.id DESC LIMIT 200`).all()
  );
});

r.get('/:id', (req, res) => {
  const id = intId(req.params.id);
  res.json(found(db.prepare('SELECT * FROM medical_records WHERE id=?').get(id), 'Rekam medis tidak ditemukan.'));
});

function body(b) {
  return {
    patient_id: intId(b.patient_id),
    appointment_id: b.appointment_id ? intId(b.appointment_id) : null,
    visit_date: str(b.visit_date),
    weight: b.weight === '' || b.weight == null ? null : num(b.weight),
    temperature: b.temperature === '' || b.temperature == null ? null : num(b.temperature),
    subjective: str(b.subjective),
    objective: str(b.objective),
    assessment: str(b.assessment),
    plan: str(b.plan),
    vet_name: str(b.vet_name),
  };
}

r.post('/', (req, res) => {
  required(req.body, ['patient_id', 'visit_date']);
  const v = body(req.body);
  const info = db.prepare(`INSERT INTO medical_records
    (patient_id,appointment_id,visit_date,weight,temperature,subjective,objective,assessment,plan,vet_name)
    VALUES (@patient_id,@appointment_id,@visit_date,@weight,@temperature,@subjective,@objective,@assessment,@plan,@vet_name)`).run(v);
  if (v.weight != null) db.prepare('UPDATE patients SET weight=? WHERE id=?').run(v.weight, v.patient_id); // berat terbaru
  res.status(201).json(db.prepare('SELECT * FROM medical_records WHERE id=?').get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const id = intId(req.params.id);
  found(db.prepare('SELECT id FROM medical_records WHERE id=?').get(id), 'Rekam medis tidak ditemukan.');
  required(req.body, ['patient_id', 'visit_date']);
  const v = body(req.body);
  v.id = id;
  db.prepare(`UPDATE medical_records SET patient_id=@patient_id,appointment_id=@appointment_id,visit_date=@visit_date,
    weight=@weight,temperature=@temperature,subjective=@subjective,objective=@objective,assessment=@assessment,
    plan=@plan,vet_name=@vet_name WHERE id=@id`).run(v);
  res.json(db.prepare('SELECT * FROM medical_records WHERE id=?').get(id));
});

r.delete('/:id', (req, res) => {
  const id = intId(req.params.id);
  db.prepare('DELETE FROM medical_records WHERE id=?').run(id);
  res.json({ ok: true });
});

export default r;
