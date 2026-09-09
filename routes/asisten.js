// routes/asisten.js — Asisten Kasus (VetClaw versi ringan).
// Chatbot AI untuk membantu dokter hewan berdiskusi seputar kasus:
// diagnosis banding, toksikologi, keamanan obat per-spesies, dsb.
// Menggunakan Claude (Anthropic) via SDK resmi.
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';

const r = Router();

// Model bisa diganti lewat env ASISTEN_MODEL (default: Claude Opus 5).
const MODEL = process.env.ASISTEN_MODEL || 'claude-opus-5';

// Klien dibuat sekali (lazy) — membaca ANTHROPIC_API_KEY dari environment.
let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}
function terkonfigurasi() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// ---------------------------------------------------------------------------
// Instruksi sistem: asisten klinis yang mengutamakan SPESIES & KESELAMATAN.
// ---------------------------------------------------------------------------
const BASE_PROMPT = `Anda adalah "Asisten Kasus", asisten klinis untuk DOKTER HEWAN di Indonesia.
Anda membantu diskusi kasus: diagnosis banding, triase, toksikologi, keamanan & dosis obat, dan interpretasi temuan klinis.

PRINSIP UTAMA (wajib dipatuhi):
1. SPESIES DAHULU. Rekomendasi obat/dosis sangat bergantung spesies — "dosis yang menyelamatkan anjing bisa mematikan kucing". Bila spesies (atau berat badan untuk dosis) belum diketahui, TANYAKAN dulu sebelum memberi angka.
2. KESELAMATAN. Tandai bahaya spesifik-spesies dengan jelas, mis. parasetamol/asetaminofen & permetrin TOKSIK untuk kucing; cokelat (teobromin), bawang, xylitol, dan anggur berbahaya untuk anjing. Untuk kasus keracunan/kegawatan, arahkan penanganan langsung/rujukan segera.
3. BUKAN PENGGANTI PENILAIAN KLINIS. Jawaban Anda adalah alat bantu pengambilan keputusan (kerangka penalaran), BUKAN diagnosis final. Keputusan akhir tetap ada pada dokter hewan yang memeriksa langsung. Selalu ingatkan verifikasi dosis dari sumber resmi (mis. formularium/label produk).
4. Konteks Indonesia: rabies adalah perhatian penting pada anjing/kucing/kera — pertimbangkan riwayat gigitan & status vaksinasi bila relevan.

GAYA JAWABAN:
- Bahasa Indonesia, ringkas, dan terstruktur (gunakan poin/subjudul bila membantu).
- Untuk kasus: beri kemungkinan diagnosis banding (urut dari paling mungkin), langkah diagnostik yang disarankan, dan tata laksana awal — secukupnya, tidak bertele-tele.
- Sebutkan "tanda bahaya" (red flags) yang menuntut penanganan segera bila ada.
- Jangan mengarang fakta. Bila tidak yakin atau data kurang, katakan dan sebutkan data apa yang diperlukan.`;

function hitungUmur(birth) {
  if (!birth) return null;
  const [y, m, d] = String(birth).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months--;
  if (months < 0) return null;
  const yy = Math.floor(months / 12);
  const mm = months % 12;
  if (yy === 0) return `${mm} bulan`;
  if (mm === 0) return `${yy} tahun`;
  return `${yy} tahun ${mm} bulan`;
}

// Rangkai konteks pasien dari database untuk pertanyaan "seputar kasus ini".
function konteksPasien(patientId) {
  const p = db
    .prepare(
      `SELECT p.*, o.name AS owner_name FROM patients p
       JOIN owners o ON o.id = p.owner_id WHERE p.id = ?`
    )
    .get(patientId);
  if (!p) return '';

  const recs = db
    .prepare(
      `SELECT * FROM medical_records WHERE patient_id = ? ORDER BY visit_date DESC, id DESC LIMIT 3`
    )
    .all(patientId);
  const vaccs = db
    .prepare(
      `SELECT * FROM vaccinations WHERE patient_id = ? ORDER BY given_date DESC LIMIT 5`
    )
    .all(patientId);

  const baris = [];
  baris.push('=== KONTEKS PASIEN (dari rekam klinik; gunakan sebagai latar, verifikasi bila perlu) ===');
  baris.push(`Nama: ${p.name}`);
  baris.push(`Spesies: ${p.species || '-'}${p.breed ? ' / ras ' + p.breed : ''}`);
  baris.push(`Kelamin: ${p.sex || '-'}${p.sterilized ? ' (steril)' : ''}`);
  const umur = hitungUmur(p.birth_date);
  if (umur) baris.push(`Umur: ${umur}`);
  if (p.weight) baris.push(`Berat: ${p.weight} kg`);
  if (p.allergies) baris.push(`Alergi: ${p.allergies}`);
  if (p.notes) baris.push(`Catatan: ${p.notes}`);

  if (vaccs.length) {
    baris.push('Vaksinasi terakhir:');
    for (const v of vaccs) {
      baris.push(
        `- ${v.vaccine_name} (diberi ${v.given_date}${v.next_due_date ? ', jatuh tempo ' + v.next_due_date : ''})`
      );
    }
  }
  if (recs.length) {
    baris.push('Rekam medis terbaru (SOAP):');
    for (const rec of recs) {
      const parts = [];
      if (rec.subjective) parts.push('S: ' + rec.subjective);
      if (rec.objective) parts.push('O: ' + rec.objective);
      if (rec.assessment) parts.push('A: ' + rec.assessment);
      if (rec.plan) parts.push('P: ' + rec.plan);
      const tv = [];
      if (rec.weight) tv.push(`BB ${rec.weight}kg`);
      if (rec.temperature) tv.push(`Suhu ${rec.temperature}°C`);
      baris.push(`- [${rec.visit_date}${tv.length ? ' · ' + tv.join(', ') : ''}] ${parts.join(' | ')}`);
    }
  }
  return baris.join('\n');
}

// Status: apakah asisten sudah dikonfigurasi (ada API key)?
r.get('/status', (req, res) => {
  res.json({ configured: terkonfigurasi(), model: MODEL });
});

// Tanya asisten. Body: { messages: [{role,content}], patientId? }
r.post('/tanya', async (req, res, next) => {
  try {
    const { messages, patientId } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      const e = new Error('Tidak ada pesan untuk diproses.');
      e.status = 400;
      throw e;
    }

    // Bangun instruksi sistem (+ konteks pasien bila dipilih).
    let system = BASE_PROMPT;
    if (patientId) {
      const ctx = konteksPasien(Number(patientId));
      if (ctx) system += '\n\n' + ctx;
    }

    // Normalisasi riwayat percakapan; batasi agar hemat token.
    const riwayat = messages
      .slice(-16)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 6000),
      }))
      .filter((m) => m.content.trim());

    const msg = await getClient().messages.create({
      model: MODEL,
      max_tokens: 6000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system,
      messages: riwayat,
    });

    if (msg.stop_reason === 'refusal') {
      return res.json({
        reply:
          'Maaf, permintaan ini tidak dapat saya proses. Mohon ajukan pertanyaan klinis dengan cara yang berbeda.',
      });
    }

    const reply = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    res.json({ reply: reply || '(Asisten tidak memberikan jawaban. Coba ulangi pertanyaan.)' });
  } catch (err) {
    // Pesan ramah bila API key belum diatur / tidak valid.
    const status = err && err.status;
    if (!terkonfigurasi() || status === 401 || status === 403) {
      const e = new Error(
        'Asisten AI belum dikonfigurasi. Setel kunci ANTHROPIC_API_KEY di server (lihat README bagian "Asisten Kasus").'
      );
      e.status = 400;
      return next(e);
    }
    if (status === 429) {
      const e = new Error('Terlalu banyak permintaan ke layanan AI. Coba lagi sebentar.');
      e.status = 429;
      return next(e);
    }
    next(err);
  }
});

export default r;
