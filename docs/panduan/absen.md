# Panduan Absen dan Cuti

Buat semua karyawan kantor. Absen lewat HP, pakai lokasi. Jam kantor **08:00-17:00** (sampai Mas Samuel
menentukan lain), Sabtu dan Minggu libur.

Ganti bahasa: klik nama kamu di pojok kanan atas, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

> Gambar layar menyusul: diambil di `erp.localhost` setelah situs uji jadi (lihat `docs/TODO.md`).

## Sekali saja: pasang di HP

1. Buka `https://erp.<domain>/hrms` di Chrome (Android) atau Safari (iPhone), lalu masuk pakai email dan sandi
   kamu.
2. Android: menu titik tiga → **Add to Home screen**. iPhone: tombol bagikan → **Add to Home Screen**.
3. Sekarang ada ikon di layar HP. Pakai ikon itu tiap hari, seperti aplikasi biasa.

## Tiap hari: absen masuk dan pulang

1. Buka ikonnya, tekan **Check In** saat sampai kantor.
2. HP minta izin lokasi: pilih **Izinkan** (Allow). Tanpa lokasi, absen ditolak.
3. Saat pulang, tekan **Check Out**.

Yang perlu diingat:
- Absen masuk bisa mulai jam 07:00. Lewat dari **08:10** dihitung **telat**.
- Pulang sebelum **16:50** dihitung **pulang cepat**.
- Absen pulang masih bisa sampai jam 19:00.
- Kehadiran dibuat otomatis oleh sistem tiap jam, dari absen masuk dan pulang. Tidak perlu isi apa-apa lagi.
- Hari kerja tanpa absen sama sekali jadi **Absent** (tidak hadir). Sabtu, Minggu dan hari libur tidak.
- Lupa absen? Bilang ke HR hari itu juga, supaya dibetulkan sebelum dihitung tidak hadir.

## Ajukan cuti

1. Di aplikasi HP: **Leaves** → **Request a Leave** (di komputer: **Leaves → New Leave Application**).
2. Pilih **Leave Type**:
   - **Cuti Tahunan**: jatahnya 12 hari setahun;
   - **Sakit**: lampirkan surat dokter kalau diminta HR;
   - **Izin**: keperluan pribadi, tidak dibayar.
3. Isi tanggal mulai (**From Date**) dan selesai (**To Date**), alasannya, lalu simpan.
4. Atasan menyetujui. Sabtu, Minggu dan hari libur tidak memotong jatah cuti.

Sisa jatah cuti kurang? Sistem menolak pengajuannya (contoh: minta 13 hari padahal jatahnya 12).

## Untuk HR

### Tiap awal tahun: hari libur nasional
Sistem sudah membuat daftar libur tiap tahun, isinya baru Sabtu dan Minggu: **Libur CKT 2026**, **Libur CKT
2027**, dan seterusnya (CKT = singkatan perusahaan kantor). Libur nasional dan cuti bersama diisi HR sendiri dari
**SKB 3 Menteri** tahun itu:

1. **Leaves → Holiday List**, buka **Libur CKT <tahun>**.
2. Di tabel **Holidays**, tambah satu baris per tanggal libur: **Date** dan **Description** (misalnya "Idul Fitri").
3. **Save**.

Tombol **Get Local Holidays** (pilih negara Indonesia) bisa membantu mengisi, tapi tetap cocokkan dengan SKB:
cuti bersama sering tidak ada di sana.

### Karyawan baru
1. **Shift & Attendance → Employee → + Add Employee**, isi nama, jenis kelamin, tanggal lahir, tanggal masuk,
   perusahaan kantor, dan **User ID**-nya.
2. **Shift Assignment → + Add Shift Assignment**: karyawannya, **Shift Type** `Kantor`, **Start Date** hari
   pertamanya. **Submit**.
3. **Leaves → Leave Allocation**: **Cuti Tahunan** 12 hari, 1 Januari sampai 31 Desember. **Submit**.

### Tiap pagi
Buka **Shift & Attendance**: kotak **Today's Attendance** menunjukkan berapa yang sudah hadir. Cek yang belum
absen.
