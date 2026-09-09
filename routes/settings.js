// routes/settings.js — Pengaturan klinik (dipakai di kop struk/invoice).
import { Router } from 'express';
import db from '../db.js';
import { str } from '../helpers.js';
import { requireRole } from '../auth.js';

const r = Router();

const ALLOWED = ['clinic_name', 'clinic_address', 'clinic_phone', 'clinic_email', 'clinic_vet'];

function all() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const { key, value } of rows) obj[key] = value;
  return obj;
}

r.get('/', (req, res) => res.json(all()));

r.put('/', requireRole('admin'), (req, res) => {
  const up = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction(() => {
    for (const k of ALLOWED) if (k in req.body) up.run(k, str(req.body[k]) || '');
  });
  tx();
  res.json(all());
});

export default r;
