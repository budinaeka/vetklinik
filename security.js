// security.js — Hashing sandi & token acak (modul murni, tanpa import db).
// Memakai crypto bawaan Node (scrypt) — tanpa dependency tambahan.
import crypto from 'crypto';

// Hash sandi: scrypt + salt acak 16-byte. Disimpan sebagai "saltHex:hashHex".
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

// Verifikasi sandi terhadap nilai tersimpan. Aman-waktu (timingSafeEqual).
export function verifyPassword(pw, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  let salt, expected;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  let actual;
  try {
    actual = crypto.scryptSync(String(pw), salt, expected.length);
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

// Token sesi acak (opaque) — 32 byte, heksadesimal.
export function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}
