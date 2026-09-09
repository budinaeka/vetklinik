// routes/invoices.js — Kasir & tagihan (invoice + item + total otomatis).
import { Router } from 'express';
import db from '../db.js';
import { required, str, num, intId, found } from '../helpers.js';

const r = Router();

// Status ditentukan otomatis dari jumlah yang sudah dibayar.
function computeStatus(paid, total) {
  if (paid <= 0) return 'Belum Bayar';
  if (paid >= total) return 'Lunas';
  return 'Sebagian';
}

r.get('/', (req, res) => {
  const q = str(req.query.q);
  const status = str(req.query.status);
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push('i.status = ?');
    params.push(status);
  }
  if (q) {
    const like = `%${q}%`;
    clauses.push('(i.invoice_no LIKE ? OR p.name LIKE ? OR o.name LIKE ?)');
    params.push(like, like, like);
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  res.json(
    db.prepare(`
      SELECT i.*, p.name AS patient_name, o.name AS owner_name
      FROM invoices i
      LEFT JOIN patients p ON p.id = i.patient_id
      LEFT JOIN owners o ON o.id = i.owner_id
      ${where} ORDER BY i.invoice_date DESC, i.id DESC`).all(...params)
  );
});

function getFull(id) {
  const inv = found(
    db.prepare(`
      SELECT i.*, p.name AS patient_name, p.species AS patient_species,
             o.name AS owner_name, o.phone AS owner_phone, o.address AS owner_address, o.email AS owner_email
      FROM invoices i
      LEFT JOIN patients p ON p.id = i.patient_id
      LEFT JOIN owners o ON o.id = i.owner_id
      WHERE i.id = ?`).get(id),
    'Tagihan tidak ditemukan.'
  );
  inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id').all(id);
  return inv;
}

r.get('/:id', (req, res) => {
  res.json(getFull(intId(req.params.id)));
});

function nextInvoiceNo() {
  const year = new Date().getFullYear();
  const row = db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE invoice_no LIKE ?').get(`INV-${year}-%`);
  return `INV-${year}-${String(row.n + 1).padStart(4, '0')}`;
}

const saveTx = db.transaction((inv, items, id) => {
  let subtotal = 0;
  const cleanItems = items.map((it) => {
    const qty = num(it.qty, 1);
    const unit = num(it.unit_price, 0);
    const amount = qty * unit;
    subtotal += amount;
    return { description: str(it.description) || '-', category: str(it.category), qty, unit_price: unit, amount };
  });
  const discount = num(inv.discount, 0);
  const tax = num(inv.tax, 0);
  const total = Math.max(0, subtotal - discount + tax);
  const paid = num(inv.paid, 0);
  const data = {
    patient_id: inv.patient_id,
    owner_id: inv.owner_id,
    invoice_date: inv.invoice_date,
    status: computeStatus(paid, total),
    discount,
    tax,
    total,
    paid,
    payment_method: str(inv.payment_method),
    notes: str(inv.notes),
  };

  let invoiceId = id;
  if (id) {
    data.id = id;
    db.prepare(`UPDATE invoices SET patient_id=@patient_id,owner_id=@owner_id,invoice_date=@invoice_date,
      status=@status,discount=@discount,tax=@tax,total=@total,paid=@paid,payment_method=@payment_method,notes=@notes
      WHERE id=@id`).run(data);
    db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(id);
  } else {
    data.invoice_no = nextInvoiceNo();
    invoiceId = db.prepare(`INSERT INTO invoices
      (invoice_no,patient_id,owner_id,invoice_date,status,discount,tax,total,paid,payment_method,notes)
      VALUES (@invoice_no,@patient_id,@owner_id,@invoice_date,@status,@discount,@tax,@total,@paid,@payment_method,@notes)`).run(data).lastInsertRowid;
  }
  const insItem = db.prepare(
    'INSERT INTO invoice_items (invoice_id,description,category,qty,unit_price,amount) VALUES (?,?,?,?,?,?)'
  );
  for (const it of cleanItems) insItem.run(invoiceId, it.description, it.category, it.qty, it.unit_price, it.amount);
  return invoiceId;
});

function parseInvoice(b) {
  return {
    patient_id: b.patient_id ? intId(b.patient_id) : null,
    owner_id: b.owner_id ? intId(b.owner_id) : null,
    invoice_date: str(b.invoice_date),
    discount: b.discount,
    tax: b.tax,
    paid: b.paid,
    payment_method: b.payment_method,
    notes: b.notes,
  };
}

r.post('/', (req, res) => {
  required(req.body, ['invoice_date']);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const id = saveTx(parseInvoice(req.body), items, null);
  res.status(201).json(getFull(id));
});

r.put('/:id', (req, res) => {
  const id = intId(req.params.id);
  found(db.prepare('SELECT id FROM invoices WHERE id=?').get(id), 'Tagihan tidak ditemukan.');
  required(req.body, ['invoice_date']);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  saveTx(parseInvoice(req.body), items, id);
  res.json(getFull(id));
});

r.delete('/:id', (req, res) => {
  const id = intId(req.params.id);
  db.prepare('DELETE FROM invoices WHERE id=?').run(id);
  res.json({ ok: true });
});

export default r;
