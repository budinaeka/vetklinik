// auth.js — Sesi berbasis DB (cookie HttpOnly) + middleware autentikasi & peran.
import db from './db.js';
import { randomToken } from './security.js';

const COOKIE = 'vk_session';
const SESSION_DAYS = 7;

// Bersihkan sesi kedaluwarsa saat boot (housekeeping ringan).
db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now','localtime')").run();

const insSession = db.prepare(
  `INSERT INTO sessions (token, user_id, expires_at)
   VALUES (?, ?, datetime('now','localtime','+${SESSION_DAYS} days'))`
);
const delSession = db.prepare('DELETE FROM sessions WHERE token = ?');
const getSessionUser = db.prepare(
  `SELECT u.id, u.username, u.name, u.role, u.active, u.must_change
     FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now','localtime')`
);

// Parse header Cookie manual (tanpa cookie-parser).
export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function currentToken(req) {
  return parseCookies(req)[COOKIE] || null;
}

export function createSession(userId) {
  const token = randomToken();
  insSession.run(token, userId);
  return token;
}

export function destroySession(token) {
  if (token) delSession.run(token);
}

export function sessionUser(token) {
  if (!token) return null;
  return getSessionUser.get(token) || null;
}

export function setSessionCookie(res, token) {
  // Tanpa Secure: LAN klinik memakai HTTP. SameSite=Lax cukup untuk CSRF dasar.
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

// Middleware: wajib login (dan akun masih aktif).
export function requireAuth(req, res, next) {
  const token = currentToken(req);
  const user = sessionUser(token);
  if (!user || !user.active) {
    const e = new Error('Silakan masuk terlebih dahulu.');
    e.status = 401;
    return next(e);
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

// Middleware factory: wajib salah satu peran.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const e = new Error('Anda tidak punya akses ke fitur ini.');
      e.status = 403;
      return next(e);
    }
    next();
  };
}
