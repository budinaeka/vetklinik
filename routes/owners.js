// routes/owners.js — Pemilik hewan (klien).
import { Router } from 'express';
import db from '../db.js';
import { required, str, intId, found } from '../helpers.js';

const r = Router();

const LIST = `
  SELECT o.*, (SELECT COUNT(*) FROM patients p WHERE p.owner_id = o.id) AS patient_count
  FROM owners o`;

r.get('/', (req, res) => {
  const q = str(req.query.q);
  if (q) {
    const like = `%${q}%`;
    return res.json(
      db.prepare(`${LIST} WHERE o.name LIKE ? OR o.phone LIKE ? OR o.email LIKE ? ORDER BY o.name`)
        .all(like, like, like)
    );
  }
  res.json(db.prepare(`${LIST} ORDER BY o.name`).all());
});

r.get('/:id', (req, res) => {
  const id = intId(req.params.id);
  const owner = found(db.prepare('SELECT * FROM owners WHERE id = ?').get(id), 'Pemilik tidak ditemukan.');
  owner.patients = db.prepare('SELECT * FROM patients WHERE owner_id = ? ORDER BY name').all(id);
  res.json(owner);
});

r.post('/', (req, res) => {
  required(req.body, ['name']);
  const b = req.body;
  const info = db
    .prepare('INSERT INTO owners (name, phone, email, address, notes) VALUES (?,?,?,?,?)')
    .run(str(b.name), str(b.phone), str(b.email), str(b.address), str(b.notes));
  res.status(201).json(db.prepare('SELECT * FROM owners WHERE id = ?').get(info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const id = intId(req.params.id);
  found(db.prepare('SELECT id FROM owners WHERE id = ?').get(id), 'Pemilik tidak ditemukan.');
  required(req.body, ['name']);
  const b = req.body;
  db.prepare('UPDATE owners SET name=?, phone=?, email=?, address=?, notes=? WHERE id=?')
    .run(str(b.name), str(b.phone), str(b.email), str(b.address), str(b.notes), id);
  res.json(db.prepare('SELECT * FROM owners WHERE id = ?').get(id));
});

r.delete('/:id', (req, res) => {
  const id = intId(req.params.id);
  db.prepare('DELETE FROM owners WHERE id = ?').run(id); // pasien terkait ikut terhapus (CASCADE)
  res.json({ ok: true });
});

export default r;
