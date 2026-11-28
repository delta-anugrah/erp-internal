# Panduan Proyek

Untuk **Admin**. Peran **Produksi** tidak membuka Projects (Mas Samuel: Produksi cuma mencatat
hasil produksi); bagian "Untuk User" di bawah berlaku untuk akun yang diberi peran Projects User dan Employee. Alurnya: **proyek → tugas → timesheet harian**. Dari timesheet kelihatan
berapa jam yang sudah dipakai tiap tugas.

Ganti bahasa: klik judul menu di pojok kiri atas menu samping (nama bagian yang terbuka, misalnya **Produksi**), pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

> Gambar layar menyusul: diambil di `erp.localhost` setelah situs uji jadi (lihat `docs/TODO.md`).

## Untuk Admin

### Buat proyek
1. **Projects → Project → + Add Project**.
2. Isi **Project Name**, **Company**, dan perkiraan mulai dan selesai (**Expected Start Date**,
   **Expected End Date**).
3. **Save**.

### Pecah jadi tugas
1. Di proyeknya, buka **Task → + Add Task** (atau **Projects → Task → + Add Task**, lalu pilih **Project**).
2. Isi **Subject** (nama tugasnya), perkiraan tanggal, dan **Expected Time (in hours)** (perkiraan jam kerja) kalau ada.
3. **Save**, lalu di sisi kiri **Assigned To → +**: pilih karyawan yang mengerjakan. Dia dapat pemberitahuan dan
   tugas itu muncul di daftarnya.

### Tiap minggu (misalnya Jumat sore)
1. **Projects** → kotak **Open Projects**: apakah tiap proyek yang jalan masih **Open** dan tanggalnya masih masuk
   akal.
2. Buka tiap proyek: **% Completed** dan tugas yang lewat tanggal (**Overdue**).
3. **Projects → Timesheet**, filter minggu ini: apakah semua orang mengisi tiap hari kerja. Yang kosong, tanyakan.
4. Tugas yang selesai: buka, ubah **Status** jadi **Completed**, **Save**.

## Untuk User

### Lihat tugas kamu
**Projects** → kotak **My Open Tasks**: tugas yang diberikan ke kamu dan belum selesai.

### Isi timesheet tiap hari
1. **Projects** → **New Timesheet** (atau **Projects → Timesheet → + Add Timesheet**).
2. **Employee**: nama kamu (biasanya sudah terisi).
3. Di tabel **Time Sheets**, satu baris per pekerjaan:
   - **Activity Type**: `Pengembangan`, `Rapat`, `Dukungan Klien` atau `Administrasi`;
   - **From Time**: jam mulai, dan **Hrs**: berapa jam (misalnya `2`);
   - **Project** dan **Task**: proyek dan tugasnya.
4. **Save**, lalu **Submit** di akhir hari. Setelah di-submit, jamnya masuk ke tugas dan proyek.
   Kamu cuma bisa submit timesheet atas namamu sendiri. Kalau muncul "You can only submit your own timesheet",
   cek kolom Employee. Admin bisa submit milik orang lain.

Salah isi setelah submit? Minta Admin membatalkannya (**Cancel**) dan membetulkannya (**Amend**).
