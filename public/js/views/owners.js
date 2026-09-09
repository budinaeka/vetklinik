// views/owners.js — Daftar & kelola pemilik (klien).
import { api, esc, openModal, closeModal, confirmDialog, toast, tanggal } from '../util.js';
import { ownerForm, patientForm } from './forms.js';

export default async function owners(view) {
  const state = { q: '' };

  view.innerHTML = `
    <div class="page-head"><h2>Pemilik</h2><span class="spacer"></span>
      <button class="btn btn-primary" id="btn-add">+ Tambah Pemilik</button></div>
    <div class="toolbar"><div class="search"><input class="input" id="f-q" placeholder="Cari nama / no. HP / email..." /></div></div>
    <div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Nama</th><th>No. HP / WA</th><th>Email</th><th>Hewan</th><th></th></tr></thead>
      <tbody id="body"></tbody>
    </table></div></div>`;

  const body = view.querySelector('#body');

  async function load() {
    body.innerHTML = `<tr><td colspan="5" class="t-muted" style="text-align:center;padding:20px">Memuat…</td></tr>`;
    const list = await api.get('/api/owners' + (state.q ? `?q=${encodeURIComponent(state.q)}` : ''));
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="5" class="t-muted" style="text-align:center;padding:26px">Belum ada pemilik.</td></tr>`;
      return;
    }
    body.innerHTML = list
      .map(
        (o) => `<tr>
          <td class="t-strong row-link" data-view="${o.id}">${esc(o.name)}</td>
          <td>${esc(o.phone || '-')}</td>
          <td class="t-muted">${esc(o.email || '-')}</td>
          <td><span class="pill">${o.patient_count} hewan</span></td>
          <td class="num"><button class="btn-icon" data-view="${o.id}" title="Lihat">👁️</button><button class="btn-icon" data-edit="${o.id}" title="Edit">✏️</button><button class="btn-icon" data-del="${o.id}" title="Hapus">🗑️</button></td>
        </tr>`
      )
      .join('');
    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => ownerForm(list.find((x) => x.id == b.dataset.edit), load))
    );
    body.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewOwner(b.dataset.view)));
    body.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        const o = list.find((x) => x.id == b.dataset.del);
        const warn = o.patient_count > 0 ? ` Semua data ${o.patient_count} hewan miliknya juga akan ikut terhapus.` : '';
        if (await confirmDialog(`Hapus pemilik "${o.name}"?${warn}`)) {
          await api.del('/api/owners/' + o.id);
          toast('Pemilik dihapus.');
          load();
        }
      })
    );
  }

  async function viewOwner(id) {
    const o = await api.get('/api/owners/' + id);
    const pets = o.patients.length
      ? o.patients
          .map(
            (p) => `<tr class="row-link" data-pet="${p.id}"><td class="t-strong">${esc(p.name)}</td><td>${esc(p.species || '-')}</td><td>${esc(p.breed || '-')}</td></tr>`
          )
          .join('')
      : `<tr><td colspan="3" class="t-muted">Belum ada hewan terdaftar.</td></tr>`;
    openModal(
      `<div class="modal-head"><h3>${esc(o.name)}</h3><button class="x" data-close>&times;</button></div>
       <div class="modal-body">
         <dl class="dl">
           <dt>No. HP / WA</dt><dd>${esc(o.phone || '-')}</dd>
           <dt>Email</dt><dd>${esc(o.email || '-')}</dd>
           <dt>Alamat</dt><dd>${esc(o.address || '-')}</dd>
           ${o.notes ? `<dt>Catatan</dt><dd>${esc(o.notes)}</dd>` : ''}
           <dt>Terdaftar</dt><dd>${tanggal(o.created_at)}</dd>
         </dl>
         <div class="card-head" style="padding:12px 0 8px;border:none">Hewan Peliharaan <span class="spacer"></span>
           <button class="btn btn-ghost btn-sm" id="add-pet">+ Tambah Hewan</button></div>
         <div class="table-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Spesies</th><th>Ras</th></tr></thead><tbody>${pets}</tbody></table></div>
       </div>
       <div class="modal-foot"><button class="btn btn-ghost" data-close>Tutup</button><button class="btn btn-primary" id="edit-owner">Edit Pemilik</button></div>`,
      {
        width: '560px',
        onMount(card) {
          card.querySelectorAll('[data-pet]').forEach((tr) =>
            tr.addEventListener('click', () => {
              closeModal();
              location.hash = '#/patients/' + tr.dataset.pet;
            })
          );
          card.querySelector('#add-pet').addEventListener('click', () => {
            closeModal();
            patientForm(null, load, { ownerId: o.id });
          });
          card.querySelector('#edit-owner').addEventListener('click', () => {
            closeModal();
            ownerForm(o, load);
          });
        },
      }
    );
  }

  view.querySelector('#btn-add').addEventListener('click', () => ownerForm(null, load));
  let t;
  view.querySelector('#f-q').addEventListener('input', (e) => {
    clearTimeout(t);
    state.q = e.target.value.trim();
    t = setTimeout(load, 250);
  });

  await load();
}
