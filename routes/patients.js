// routes/patients.js — Pasien (hewan).
import { Router } from 'express';
import db from '../db.js';
import { required, str, num, intId, found } from '../helpers.js';

const r = Router();

r.get('/', (req, res) => {
  const q = str(req.query.q);
  const ownerId = req.query.owner_id ? intId(req.query.owner_id) : null;
  const clauses = [];
  const params = [];
  if (q) {
    const like = `%${q}%`;
    clauses.push('(p.name LIKE ? OR p.species LIKE ? OR p.breed LIKE ? OR o.name LIKE ?)');
    params.push(like, like, like, like);
  }
  if (ownerId) {
    clauses.push('p.owner_id = ?');
    params.push(ownerId);
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  res.json(
    db.prepare(`
      SELECT p.*, o.name AS owner_name, o.phone AS owner_phone
      FROM patients p JOIN owners o ON o.id = p.owner_id
      ${where} ORDER BY p.name`).all(...params)
  );
});

r.get('/:id', (req, res) => {
  const id = intId(req.params.id);
  const p = found(
    db.prepare(`
      SELECT p.*, o.name AS owner_name, o.phone AS owner_phone, o.email AS owner_email, o.address AS owner_address
      FROM patients p JOIN owners o ON o.id = p.owner_id WHERE p.id = ?`).get(id),
    'Pasien tidak ditemukan.'
  );
  p.records = db.prepare('SELECT * FROM medical_records WHERE patient_id=? ORDER BY visit_date DESC, id DESC').all(id);
  p.vaccinations = db.prepare('SELECT * FROM vaccinations WHERE patient_id=? ORDER BY given_date DESC').all(id);
  p.appointments = db.prepare('SELECT * FROM appointments WHERE patient_id=? ORDER BY scheduled_at DESC').all(id);
  p.invoices = db.prepare('SELECT * FROM invoices WHERE patient_id=? ORDER BY invoice_date DESC, id DESC').all(id);
  res.json(p);
});

function body(b) {
  return {
    owner_id: intId(b.owner_id),
    name: str(b.name),
    species: str(b.species),
    breed: str(b.breed),
    sex: str(b.sex),
    birth_date: str(b.birth_date),
    color: str(b.color),
    weight: b.weight === '' || b.weight == null ? null : num(b.weight),
    microchip: str(b.microchip),
    sterilized: b.sterilized ? 1 : 0,
    allergies: str(b.allergies),
    notes: str(b.notes),
    active: b.active === 0 || b.active === false ? 0 : 1,
  };
}

r.post('/', (req, res) => {
  required(req.body, ['owner_id', 'name']);
  const v = body(req.body);
  found(db.prepare('SELECT id FROM owners WHERE id=?').get(v.owner_id), 'Pemilik tidak ditemukan.');
  const info = db.prepare(`INSERT INTO patients
    (owner_id,name,species,breed,sex,birth_date,color,weight,microchip,sterilized,allergies,notes,active)
    VALUES (@owner_id,@name,@species,@breed,@sex,@birth_date,@color,@weight,@microchip,@sterilized,@allergies,@notes,@active)`).run(v);
  res.status(201).json(db.prepare('SELECT * FROM patients WHERE id=?').get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const id = intId(req.params.id);
  found(db.prepare('SELECT id FROM patients WHERE id=?').get(id), 'Pasien tidak ditemukan.');
  required(req.body, ['owner_id', 'name']);
  const v = body(req.body);
  v.id = id;
  db.prepare(`UPDATE patients SET owner_id=@owner_id,name=@name,species=@species,breed=@breed,sex=@sex,
    birth_date=@birth_date,color=@color,weight=@weight,microchip=@microchip,sterilized=@sterilized,
    allergies=@allergies,notes=@notes,active=@active WHERE id=@id`).run(v);
  res.json(db.prepare('SELECT * FROM patients WHERE id=?').get(id));
});

r.delete('/:id', (req, res) => {
  const id = intId(req.params.id);
  db.prepare('DELETE FROM patients WHERE id=?').run(id);
  res.json({ ok: true });
});

export default r;
