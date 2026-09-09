// server.js — Aplikasi Express: sajikan frontend statis + REST API.
import { loadEnv } from './env.js';
loadEnv(); // muat .env (mis. ANTHROPIC_API_KEY) sebelum apa pun

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

import owners from './routes/owners.js';
import patients from './routes/patients.js';
import appointments from './routes/appointments.js';
import arrivals from './routes/arrivals.js';
import records from './routes/records.js';
import vaccinations from './routes/vaccinations.js';
import invoices from './routes/invoices.js';
import dashboard from './routes/dashboard.js';
import settings from './routes/settings.js';
import asisten from './routes/asisten.js';
import komunikasi from './routes/komunikasi.js';
import authRoutes from './routes/auth.js';
import users from './routes/users.js';
import { requireAuth, requireRole } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));

// --- Autentikasi (publik: login/logout/me/change-password) ---
app.use('/api/auth', authRoutes);

// Semua endpoint /api lain wajib login.
app.use('/api', requireAuth);

// --- REST API ---
app.use('/api/owners', owners);
app.use('/api/patients', patients);
app.use('/api/appointments', appointments);
app.use('/api/arrivals', arrivals);
app.use('/api/records', requireRole('admin', 'dokter'), records);
app.use('/api/vaccinations', requireRole('admin', 'dokter'), vaccinations);
app.use('/api/invoices', invoices);
app.use('/api/settings', settings);
app.use('/api/dashboard', dashboard);
app.use('/api/asisten', requireRole('admin', 'dokter'), asisten);
app.use('/api/komunikasi', komunikasi);
app.use('/api/users', requireRole('admin'), users);

// API 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

// --- Frontend statis ---
app.use(express.static(path.join(__dirname, 'public')));

// Error handler terpusat
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Terjadi kesalahan pada server.' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Cari alamat IP LAN (IPv4, non-internal) agar staf lain tahu alamat aksesnya.
function alamatJaringan() {
  const hasil = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) hasil.push(net.address);
    }
  }
  return hasil;
}

app.listen(PORT, HOST, () => {
  console.log('\n  🐾  VetKlinik berjalan');
  console.log(`      Lokal    : http://localhost:${PORT}`);
  const ips = alamatJaringan();
  if (ips.length) {
    ips.forEach((ip, i) => console.log(`      ${i === 0 ? 'Jaringan ' : '         '}: http://${ip}:${PORT}  (untuk diakses staf lain di jaringan yang sama)`));
  } else {
    console.log(`      Jaringan : (tidak terdeteksi — pastikan komputer terhubung ke jaringan klinik)`);
  }
  console.log('');
});
