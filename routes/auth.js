// routes/auth.js — Login, logout, sesi saat ini, ganti sandi (publik + self).
import { Router } from 'express';
import db from '../db.js';
import { required } from '../helpers.js';
import { verifyPassword, hashPassword } from '../security.js';
import {
  createSession, destroySession, setSessionCookie, clearSessionCookie,
  currentToken, requireAuth,
} from '../auth.js';

const r = Router();

const findByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const byId = db.prepare('SELECT * FROM users WHERE id = ?');
const touchLogin = db.prepare("UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?");
const setPassword = db.prepare('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?');

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role, must_change: u.must_change };
}

function badRequest(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

// POST /login  {username, password}
r.post('/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const fail = () => {
    const e = new Error('Username atau sandi salah.');
    e.status = 401;
    throw e;
  };
  if (!username || !password) fail();
  const u = findByUsername.get(username);
  if (!u || !u.active) fail();
  if (!verifyPassword(password, u.password_hash)) fail();

  const token = createSession(u.id);
  setSessionCookie(res, token);
  touchLogin.run(u.id);
  res.json(publicUser(u));
});

// POST /logout — idempoten (tak wajib sesi valid).
r.post('/logout', (req, res) => {
  destroySession(currentToken(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

// GET /me — data sesi aktif.
r.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

// POST /change-password  {current_password, new_password}
r.post('/change-password', requireAuth, (req, res) => {
  required(req.body, ['current_password', 'new_password']);
  const newPw = String(req.body.new_password);
  if (newPw.length < 6) throw badRequest('Sandi baru minimal 6 karakter.');
  const u = byId.get(req.user.id);
  if (!u || !verifyPassword(String(req.body.current_password), u.password_hash)) {
    throw badRequest('Sandi lama salah.');
  }
  setPassword.run(hashPassword(newPw), u.id);
  res.json({ ok: true });
});

export default r;
