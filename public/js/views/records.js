// views/records.js — Daftar rekam medis (riwayat pemeriksaan).
import { api, esc, tanggal, spesiesEmoji, confirmDialog, toast } from '../util.js';
import { recordForm } from './forms.js';

export default async function records(view) {
  const state = { q: '' };
  let all = [];

  view.innerHTML = `
    <div class="page-head"><h2>Rekam Medis</h2><span class="sub">Riwayat pemeriksaan terbaru</span><span class="spacer"></span>
      <button class="btn btn-primary" id="btn-add">+ Rekam Medis</button></div>
    <div class="toolbar"><div class="search"><input class="input" id="f-q" placeholder="Cari pasien / pemilik / diagnosis..." /></div></div>
    <div id="list"></div>`;

  const listEl = view.querySelector('#list');

  function render() {
    const q = state.q.toLowerCase();
    const rows = all.filter(
      (r) =>
        !q ||
        (r.patient_name || '').toLowerCase().includes(q) ||
        (r.owner_name || '').toLowerCase().includes(q) ||
        (r.assessment || '').toLowerCase().includes(q)
    );
    if (!rows.length) {
      listEl.innerHTML = `<div class="card"><div class="empty"><span class="big">📋</span>Belum ada rekam medis.</div></div>`;
      return;
    }
    listEl.innerHTML = `<div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Tanggal</th><th>Pasien</th><th>Diagnosis / Terapi</th><th>Dokter</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr>
            <td class="t-strong">${tanggal(r.visit_date)}</td>
            <td><a href="#/patients/${r.patient_id}">${spesiesEmoji(r.patient_species)} ${esc(r.patient_name)}</a><div class="t-muted">${esc(r.owner_name)}</div></td>
            <td>${esc(r.assessment || '-')}${r.plan ? `<div class="t-muted">${esc(r.plan)}</div>` : ''}</td>
            <td class="t-muted">${esc(r.vet_name || '-')}</td>
            <td class="num"><button class="btn-icon" data-edit="${r.id}" title="Edit">✏️</button><button class="btn-icon" data-del="${r.id}" title="Hapus">🗑️</button></td>
          </tr>`
        )
        .join('')}</tbody></table></div></div>`;
    listEl.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = all.find((x) => x.id == b.dataset.edit);
        recordForm(r, load, { patientId: r.patient_id, patientName: r.patient_name });
      })
    );
    listEl.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await confirmDialog('Hapus rekam medis ini?')) {
          await api.del('/api/records/' + b.dataset.del);
          toast('Rekam medis dihapus.');
          load();
        }
      })
    );
  }

  async function load() {
    listEl.innerHTML = `<div class="loading">Memuat…</div>`;
    all = await api.get('/api/records');
    render();
  }

  view.querySelector('#btn-add').addEventListener('click', () => recordForm(null, load));
  let t;
  view.querySelector('#f-q').addEventListener('input', (e) => {
    clearTimeout(t);
    state.q = e.target.value.trim();
    t = setTimeout(render, 150);
  });

  await load();
}
