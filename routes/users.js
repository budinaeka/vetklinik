// routes/users.js — Manajemen pengguna (khusus Admin; guard dipasang di server.js).
import { Router } from 'express';
import db from '../db.js';
import { required, intId, str, found } from '../helpers.js';
import { hashPassword } from '../security.js';

const r = Router();
const ROLES = ['admin', 'dokter', 'resepsionis'];

const listStmt = db.prepare('SELECT * FROM users ORDER BY role, username');
const byId = db.prepare('SELECT * FROM users WHERE id = ?');
const insStmt = db.prepare(
  'INSERT INTO users (username, name, role, password_hash, active, must_change) VALUES (?,?,?,?,1,0)'
);
const activeAdmins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1");
const delSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');

function activeAdminCount() {
  return activeAdmins.get().n;
}

function publicUser(u) {
  return {
    id: u.id, username: u.username, name: u.name, role: u.role,
    active: u.active, must_change: u.must_change,
    last_login_at: u.last_login_at, created_at: u.created_at,
  };
}

function err(status, msg) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

function validRole(role) {
  const rr = str(role);
  if (!ROLES.includes(rr)) throw err(400, 'Peran tidak valid.');
  return rr;
}

// GET / — daftar pengguna (tanpa hash).
r.get('/', (req, res) => {
  res.json(listStmt.all().map(publicUser));
});

// POST / — buat pengguna.  {username, name, role, password}
r.post('/', (req, res) => {
  required(req.body, ['username', 'name', 'role', 'password']);
  const username = String(req.body.username).trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
    throw err(400, 'Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.');
  }
  const password = String(req.body.password);
  if (password.length < 6) throw err(400, 'Sandi minimal 6 karakter.');
  const role = validRole(req.body.role);
  const name = str(req.body.name);

  try {
    const info = insStmt.run(username, name, role, hashPassword(password));
    res.status(201).json(publicUser(byId.get(info.lastInsertRowid)));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw err(409, 'Username sudah dipakai.');
    throw e;
  }
});

// PUT /:id — ubah nama / peran / status aktif.  {name, role, active}
r.put('/:id', (req, res) => {
  const id = intId(req.params.id);
  const u = found(byId.get(id), 'Pengguna tidak ditemukan.');

  const name = str(req.body.name) || u.name;
  const role = req.body.role !== undefined ? validRole(req.body.role) : u.role;
  const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : u.active;

  // Cegah mengunci diri sendiri.
  if (req.user && req.user.id === id && !active) {
    throw err(409, 'Tidak bisa menonaktifkan akun Anda sendiri.');
  }
  // Pastikan selalu ada minimal satu admin aktif.
  const wasActiveAdmin = u.role === 'admin' && u.active === 1;
  const willBeActiveAdmin = role === 'admin' && active === 1;
  if (wasActiveAdmin && !willBeActiveAdmin && activeAdminCount() <= 1) {
    throw err(409, 'Tidak bisa menurunkan peran atau menonaktifkan admin aktif terakhir.');
  }

  db.prepare('UPDATE users SET name=?, role=?, active=? WHERE id=?').run(name, role, active, id);
  if (!active) delSessions.run(id); // dinonaktifkan → cabut semua sesinya
  res.json(publicUser(byId.get(id)));
});

// PUT /:id/password — reset sandi (oleh admin).  {new_password}
r.put('/:id/password', (req, res) => {
  const id = intId(req.params.id);
  found(byId.get(id), 'Pengguna tidak ditemukan.');
  required(req.body, ['new_password']);
  const pw = String(req.body.new_password);
  if (pw.length < 6) throw err(400, 'Sandi minimal 6 karakter.');

  // Paksa ganti sandi saat login berikutnya + cabut sesi lama.
  db.prepare('UPDATE users SET password_hash=?, must_change=1 WHERE id=?').run(hashPassword(pw), id);
  delSessions.run(id);
  res.json({ ok: true });
});

// DELETE /:id — hapus pengguna (sesi ikut terhapus via CASCADE).
r.delete('/:id', (req, res) => {
  const id = intId(req.params.id);
  const u = found(byId.get(id), 'Pengguna tidak ditemukan.');
  if (req.user && req.user.id === id) throw err(409, 'Tidak bisa menghapus akun Anda sendiri.');
  if (u.role === 'admin' && u.active === 1 && activeAdminCount() <= 1) {
    throw err(409, 'Tidak bisa menghapus admin aktif terakhir.');
  }
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  res.json({ ok: true });
});

export default r;
