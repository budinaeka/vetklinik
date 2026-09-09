// routes/dashboard.js — Ringkasan untuk halaman beranda.
import { Router } from 'express';
import db from '../db.js';

const r = Router();

function isoDay(d) {
  // Tanggal lokal (YYYY-MM-DD) tanpa pergeseran zona waktu.
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

r.get('/', (req, res) => {
  const today = new Date();
  const iso = isoDay(today);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const iso30 = isoDay(in30);
  const monthStart = iso.slice(0, 7) + '-01';

  const counts = {
    patients: db.prepare('SELECT COUNT(*) n FROM patients WHERE active=1').get().n,
    owners: db.prepare('SELECT COUNT(*) n FROM owners').get().n,
    appts_today: db.prepare('SELECT COUNT(*) n FROM appointments WHERE substr(scheduled_at,1,10)=?').get(iso).n,
    unpaid: db.prepare("SELECT COUNT(*) n FROM invoices WHERE status!='Lunas'").get().n,
  };

  const revenue_month = db
    .prepare('SELECT COALESCE(SUM(paid),0) s FROM invoices WHERE invoice_date>=?')
    .get(monthStart).s;
  const unpaid_total = db
    .prepare("SELECT COALESCE(SUM(total-paid),0) s FROM invoices WHERE status!='Lunas'")
    .get().s;

  const appts_today = db.prepare(`
    SELECT a.*, p.name AS patient_name, p.species AS patient_species, o.name AS owner_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN owners o ON o.id = p.owner_id
    WHERE substr(a.scheduled_at,1,10)=? ORDER BY a.scheduled_at`).all(iso);

  const vacc_due = db.prepare(`
    SELECT v.*, p.name AS patient_name, o.name AS owner_name, o.phone AS owner_phone
    FROM vaccinations v
    JOIN patients p ON p.id = v.patient_id
    JOIN owners o ON o.id = p.owner_id
    WHERE v.next_due_date IS NOT NULL AND v.next_due_date <= ?
    ORDER BY v.next_due_date`).all(iso30);

  const recent_invoices = db.prepare(`
    SELECT i.*, p.name AS patient_name, o.name AS owner_name
    FROM invoices i
    LEFT JOIN patients p ON p.id = i.patient_id
    LEFT JOIN owners o ON o.id = i.owner_id
    ORDER BY i.id DESC LIMIT 5`).all();

  res.json({ counts, revenue_month, unpaid_total, appts_today, vacc_due, recent_invoices, today: iso });
});

export default r;
