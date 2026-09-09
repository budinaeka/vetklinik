// views/vaccinations.js — Jadwal & pengingat vaksinasi.
import { api, esc, tanggal, selisihHari, confirmDialog, toast } from '../util.js';
import { vaccineForm } from './forms.js';

function dueBadge(iso) {
  const d = selisihHari(iso);
  if (d == null) return '';
  if (d < 0) return `<span class="badge badge-danger">Terlambat ${Math.abs(d)} hr</span>`;
  if (d === 0) return `<span class="badge badge-wait">Hari ini</span>`;
  if (d <= 30) return `<span class="badge badge-wait">${d} hari lagi</span>`;
  return `<span class="badge badge-muted">${d} hari lagi</span>`;
}

export default async function vaccinations(view) {
  const state = { filter: 'all' };
  let all = [];

  view.innerHTML = `
    <div class="page-head"><h2>Vaksinasi</h2><span class="sub">Jadwal & pengingat vaksinasi</span><span class="spacer"></span>
      <button class="btn btn-primary" id="btn-add">+ Catat Vaksinasi</button></div>
    <div class="toolbar">
      <select class="filter-select" id="f-filter">
        <option value="all">Semua terjadwal</option>
        <option value="overdue">Terlambat</option>
        <option value="soon">≤ 30 hari lagi</option>
      </select>
    </div>
    <div id="list"></div>`;

  const listEl = view.querySelector('#list');

  function render() {
    let rows = all.slice();
    if (state.filter === 'overdue') rows = rows.filter((v) => selisihHari(v.next_due_date) < 0);
    if (state.filter === 'soon')
      rows = rows.filter((v) => {
        const d = selisihHari(v.next_due_date);
        return d != null && d >= 0 && d <= 30;
      });
    if (!rows.length) {
      listEl.innerHTML = `<div class="card"><div class="empty"><span class="big">💉</span>Tidak ada jadwal vaksinasi.</div></div>`;
      return;
    }
    listEl.innerHTML = `<div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Pasien</th><th>Vaksin</th><th>Diberikan</th><th>Jadwal Berikutnya</th><th></th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (v) => `<tr>
            <td><a href="#/patients/${v.patient_id}">${esc(v.patient_name)}</a><div class="t-muted">${esc(v.owner_name)}${v.owner_phone ? ' · ' + esc(v.owner_phone) : ''}</div></td>
            <td><span class="badge badge-teal">${esc(v.vaccine_name)}</span></td>
            <td>${tanggal(v.given_date)}</td>
            <td class="t-strong">${tanggal(v.next_due_date)}</td>
            <td>${dueBadge(v.next_due_date)}</td>
            <td class="num"><button class="btn-icon" data-edit="${v.id}" title="Edit">✏️</button><button class="btn-icon" data-del="${v.id}" title="Hapus">🗑️</button></td>
          </tr>`
        )
        .join('')}</tbody></table></div></div>`;
    listEl.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const v = all.find((x) => x.id == b.dataset.edit);
        vaccineForm(v, load, { patientId: v.patient_id, patientName: v.patient_name });
      })
    );
    listEl.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await confirmDialog('Hapus data vaksinasi ini?')) {
          await api.del('/api/vaccinations/' + b.dataset.del);
          toast('Data vaksinasi dihapus.');
          load();
        }
      })
    );
  }

  async function load() {
    listEl.innerHTML = `<div class="loading">Memuat…</div>`;
    all = await api.get('/api/vaccinations');
    render();
  }

  view.querySelector('#btn-add').addEventListener('click', () => vaccineForm(null, load));
  view.querySelector('#f-filter').addEventListener('change', (e) => {
    state.filter = e.target.value;
    render();
  });

  await load();
}
