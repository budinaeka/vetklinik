// views/asisten.js — Asisten Kasus (VetClaw versi ringan): tanya-jawab AI seputar kasus.
import { api, esc, spesiesEmoji, toast } from '../util.js';

// Contoh pertanyaan untuk memulai (tampil saat percakapan masih kosong).
const CONTOH = [
  'Anjing 12 kg tidak sengaja makan cokelat batang. Berapa dosis toksik teobromin & apa yang harus dilakukan?',
  'Kucing demam, nafsu makan turun, dan mata berair. Apa diagnosis bandingnya?',
  'Obat pereda nyeri apa yang AMAN untuk kucing, dan mana yang berbahaya?',
  'Anjing lokal belum vaksin rabies tergigit anjing liar. Langkah penanganannya?',
];

// Konversi teks jawaban (markdown ringan) menjadi HTML yang aman (di-escape dulu).
function mdToHtml(raw) {
  const inline = (t) =>
    esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let list = null;
  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      closeList();
      continue;
    }
    let m;
    if ((m = t.match(/^#{1,4}\s+(.*)$/))) {
      closeList();
      html += `<div class="md-h">${inline(m[1])}</div>`;
    } else if ((m = t.match(/^[-*•]\s+(.*)$/))) {
      if (list !== 'ul') {
        closeList();
        html += '<ul>';
        list = 'ul';
      }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) {
      if (list !== 'ol') {
        closeList();
        html += '<ol>';
        list = 'ol';
      }
      html += `<li>${inline(m[2])}</li>`;
    } else {
      closeList();
      html += `<p>${inline(t)}</p>`;
    }
  }
  closeList();
  return html;
}

export default async function asisten(view, patientId) {
  // Ambil status konfigurasi & daftar pasien (untuk pengaitan kasus) secara paralel.
  const [status, patients] = await Promise.all([
    api.get('/api/asisten/status').catch(() => ({ configured: false })),
    api.get('/api/patients').catch(() => []),
  ]);

  const messages = []; // { role: 'user'|'assistant'|'error', content }
  let busy = false;
  let selectedPatient = patientId ? String(patientId) : '';

  const patientOptions = [
    '<option value="">— Tanpa pasien (pertanyaan umum) —</option>',
    ...patients.map(
      (p) =>
        `<option value="${p.id}">${esc(p.name)} — ${esc(p.species || 'Hewan')}${
          p.owner_name ? ' (' + esc(p.owner_name) + ')' : ''
        }</option>`
    ),
  ].join('');

  view.innerHTML = `
    <div class="page-head">
      <h2>🤖 Asisten Kasus</h2>
      <span class="sub">Diskusi kasus berbasis AI — diagnosis banding, toksikologi, keamanan obat.</span>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" id="clear" title="Mulai percakapan baru">🗑️ Bersihkan</button>
    </div>

    ${
      status.configured
        ? ''
        : `<div class="alert alert-warn">⚙️ Asisten AI belum dikonfigurasi. Setel <code>ANTHROPIC_API_KEY</code> di server (lihat README bagian <b>Asisten Kasus</b>) lalu jalankan ulang. Anda tetap bisa mengetik, namun jawaban belum akan muncul.</div>`
    }

    <div class="alert alert-warn" style="background:var(--info-bg);color:var(--info);border-color:#bfdbfe">
      ⚕️ Jawaban bersifat <b>bantuan referensi</b>, bukan pengganti pemeriksaan & diagnosis dokter hewan berlisensi. Selalu verifikasi dosis dari sumber resmi.
    </div>

    <div class="toolbar">
      <div class="field" style="margin:0;flex:1;min-width:240px">
        <label style="font-size:12px">Kaitkan dengan pasien (opsional)</label>
        <select id="pat" class="input">${patientOptions}</select>
      </div>
    </div>

    <div class="card chat">
      <div class="chat-log" id="log"></div>
      <div class="chat-input">
        <textarea id="ask" rows="1" placeholder="Tulis pertanyaan atau uraian kasus… (Enter untuk kirim, Shift+Enter untuk baris baru)"></textarea>
        <button class="btn btn-primary" id="send" title="Kirim">➤</button>
      </div>
    </div>`;

  const logEl = view.querySelector('#log');
  const askEl = view.querySelector('#ask');
  const sendEl = view.querySelector('#send');
  const patEl = view.querySelector('#pat');
  patEl.value = selectedPatient;

  function patientLabel() {
    if (!patEl.value) return '';
    const p = patients.find((x) => String(x.id) === String(patEl.value));
    return p ? `${spesiesEmoji(p.species)} ${p.name}` : '';
  }

  function renderLog() {
    if (messages.length === 0) {
      const chips = CONTOH.map(
        (q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`
      ).join('');
      logEl.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty-ic">🐾</div>
          <div class="chat-empty-title">Ada kasus yang ingin didiskusikan?</div>
          <div class="t-muted" style="margin-bottom:14px">Sebutkan spesies, umur/berat, dan tanda klinis untuk jawaban terbaik. Coba salah satu contoh:</div>
          <div class="chips">${chips}</div>
        </div>`;
      return;
    }
    logEl.innerHTML = messages
      .map((m) => {
        if (m.role === 'user') {
          return `<div class="msg msg-user"><div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
        }
        if (m.role === 'error') {
          return `<div class="msg msg-ai"><div class="msg-av">⚠️</div><div class="bubble bubble-err">${esc(m.content)}</div></div>`;
        }
        return `<div class="msg msg-ai"><div class="msg-av">🤖</div><div class="bubble md">${mdToHtml(m.content)}</div></div>`;
      })
      .join('');
    if (busy) {
      logEl.insertAdjacentHTML(
        'beforeend',
        `<div class="msg msg-ai"><div class="msg-av">🤖</div><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>`
      );
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function send(text) {
    text = (text || '').trim();
    if (!text || busy) return;
    messages.push({ role: 'user', content: text });
    askEl.value = '';
    askEl.style.height = 'auto';
    busy = true;
    sendEl.disabled = true;
    renderLog();
    try {
      const body = { messages: messages.filter((m) => m.role !== 'error') };
      if (patEl.value) body.patientId = Number(patEl.value);
      const res = await api.post('/api/asisten/tanya', body);
      messages.push({ role: 'assistant', content: res.reply || '(kosong)' });
    } catch (err) {
      messages.push({ role: 'error', content: err.message || 'Gagal menghubungi asisten.' });
    } finally {
      busy = false;
      sendEl.disabled = false;
      renderLog();
      askEl.focus();
    }
  }

  // Auto-resize textarea.
  askEl.addEventListener('input', () => {
    askEl.style.height = 'auto';
    askEl.style.height = Math.min(askEl.scrollHeight, 160) + 'px';
  });
  // Enter untuk kirim (Shift+Enter = baris baru).
  askEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(askEl.value);
    }
  });
  sendEl.addEventListener('click', () => send(askEl.value));

  // Klik contoh pertanyaan (delegasi karena log sering dirender ulang).
  logEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) send(chip.dataset.q);
  });

  view.querySelector('#clear').addEventListener('click', () => {
    if (busy) return;
    messages.length = 0;
    renderLog();
    askEl.focus();
  });

  patEl.addEventListener('change', () => {
    const lbl = patientLabel();
    if (lbl) toast(`Kasus dikaitkan dengan ${lbl}`);
  });

  renderLog();
  askEl.focus();
}
