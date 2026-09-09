// views/users.js — Manajemen Pengguna (khusus Admin).
import { api, esc, toast, confirmDialog, roleBadge, tanggalWaktu, store } from '../util.js';
import { userForm, resetPasswordForm } from './forms.js';

export default async function users(view) {
  view.innerHTML = `
    <div class="page-head">
      <h2>Manajemen Pengguna</h2>
      <span class="sub">Kelola akun &amp; hak akses staf klinik</span>
      <span class="spacer"></span>
      <button class="btn btn-primary" id="btn-add">+ Tambah Pengguna</button>
    </div>
    <div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Status</th><th>Login Terakhir</th><th></th></tr></thead>
      <tbody id="body"></tbody>
    </table></div></div>`;

  const body = view.querySelector('#body');

  async function load() {
    body.innerHTML = `<tr><td colspan="6" class="t-muted" style="text-align:center;padding:20px">Memuat…</td></tr>`;
    const list = await api.get('/api/users');
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="6" class="t-muted" style="text-align:center;padding:26px">Belum ada pengguna.</td></tr>`;
      return;
    }
    body.innerHTML = list
      .map((u) => {
        const me = store.user && store.user.id === u.id;
        const status = u.active
          ? '<span class="badge badge-ok">Aktif</span>'
          : '<span class="badge badge-muted">Nonaktif</span>';
        const flags =
          (me ? ' <span class="pill">Anda</span>' : '') +
          (u.must_change ? ' <span class="pill" title="Wajib ganti sandi">🔑 wajib ganti</span>' : '');
        return `<tr>
          <td class="t-strong">${esc(u.name)}${flags}</td>
          <td>${esc(u.username)}</td>
          <td>${roleBadge(u.role)}</td>
          <td>${status}</td>
          <td>${u.last_login_at ? tanggalWaktu(u.last_login_at) : '<span class="t-muted">Belum pernah</span>'}</td>
          <td class="num" style="white-space:nowrap">
            <button class="btn-icon" data-edit="${u.id}" title="Edit">✏️</button>
            <button class="btn-icon" data-reset="${u.id}" title="Reset sandi">🔑</button>
            <button class="btn-icon" data-del="${u.id}" title="Hapus">🗑️</button>
          </td>
        </tr>`;
      })
      .join('');

    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => userForm(list.find((x) => x.id == b.dataset.edit), load))
    );
    body.querySelectorAll('[data-reset]').forEach((b) =>
      b.addEventListener('click', () => resetPasswordForm(list.find((x) => x.id == b.dataset.reset), load))
    );
    body.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        const u = list.find((x) => x.id == b.dataset.del);
        if (await confirmDialog(`Hapus pengguna "${u.name}" (@${u.username})? Tindakan ini tidak bisa dibatalkan.`)) {
          try {
            await api.del('/api/users/' + u.id);
            toast('Pengguna dihapus.');
            load();
          } catch (err) {
            toast(err.message, 'error');
          }
        }
      })
    );
  }

  view.querySelector('#btn-add').addEventListener('click', () => userForm(null, load));
  await load();
}
