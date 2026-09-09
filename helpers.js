// helpers.js — util kecil untuk validasi & konversi di sisi server.

// Lempar error 400 bila ada field wajib yang kosong.
export function required(obj, fields) {
  const missing = fields.filter(
    (f) => obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === ''
  );
  if (missing.length) {
    const e = new Error('Field wajib belum diisi: ' + missing.join(', '));
    e.status = 400;
    throw e;
  }
}

// Angka aman (mengembalikan default bila bukan angka).
export function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// Integer aman untuk parameter :id.
export function intId(v) {
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n <= 0) {
    const e = new Error('ID tidak valid.');
    e.status = 400;
    throw e;
  }
  return n;
}

// String yang dirapikan (trim) atau null.
export function str(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Lempar 404 bila baris tidak ditemukan.
export function found(row, pesan = 'Data tidak ditemukan.') {
  if (!row) {
    const e = new Error(pesan);
    e.status = 404;
    throw e;
  }
  return row;
}
