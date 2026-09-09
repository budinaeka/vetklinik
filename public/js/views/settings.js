// views/settings.js — Pengaturan klinik.
import { api, esc, store, toast, formData } from '../util.js';

export default async function settings(view) {
  const s = await api.get('/api/settings');
  view.innerHTML = `
    <div class="page-head"><h2>Pengaturan Klinik</h2><span class="sub">Informasi ini tampil pada kop struk/tagihan yang dicetak.</span></div>
    <div class="card card-pad" style="max-width:640px">
      <form id="form">
        <div class="field"><label>Nama Klinik</label><input class="input" name="clinic_name" value="${esc(s.clinic_name)}" /></div>
        <div class="field"><label>Alamat</label><textarea name="clinic_address">${esc(s.clinic_address)}</textarea></div>
        <div class="form-row">
          <div class="field"><label>Telepon</label><input class="input" name="clinic_phone" value="${esc(s.clinic_phone)}" /></div>
          <div class="field"><label>Email</label><input class="input" name="clinic_email" value="${esc(s.clinic_email)}" /></div>
        </div>
        <div class="field"><label>Dokter Penanggung Jawab</label><input class="input" name="clinic_vet" value="${esc(s.clinic_vet)}" placeholder="drh. Nama Dokter" /></div>
        <button class="btn btn-primary" type="submit">Simpan Pengaturan</button>
      </form>
    </div>
    <div class="card card-pad" style="max-width:640px;margin-top:16px">
      <div style="font-weight:700;margin-bottom:6px">ℹ️ Tentang</div>
      <p class="t-muted" style="margin:0">VetKlinik adalah sistem manajemen klinik hewan versi ringan, terinspirasi dari proyek open-source
      <b>OpenVPM</b>, dan disesuaikan untuk klinik hewan &amp; pusat kesehatan hewan di Indonesia (Rupiah, format tanggal Indonesia, pengingat vaksinasi rabies).</p>
    </div>`;

  view.querySelector('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const saved = await api.put('/api/settings', formData(e.target));
      store.settings = saved;
      document.getElementById('brandName').textContent = saved.clinic_name || 'VetKlinik';
      toast('Pengaturan disimpan.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
