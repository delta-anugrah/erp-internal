# Panduan Absen dan Cuti

> Sementara (Mas Samuel, 2026-10-31 dan 2026-11-02): kantor absen pakai sidik jari, HR belum prioritas, dan
> peran **Produksi** tidak membuka HR. Panduan ini untuk nanti.

Untuk karyawan yang diberi peran Employee; bagian "Untuk Admin (HR)" dikerjakan **Admin**. Absen lewat HP, pakai lokasi. Jam kantor **08:00-17:00** (sampai Mas Samuel
menentukan lain), Sabtu dan Minggu libur.

Ganti bahasa: klik nama kamu di pojok kiri bawah menu samping, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

> Gambar layar menyusul: diambil di `erp.localhost` setelah situs uji jadi (lihat `docs/TODO.md`).

## Sekali saja: pasang di HP

1. Buka `https://erp-delta.usaha.ai/hrms` di Chrome (Android) atau Safari (iPhone), lalu masuk pakai email dan sandi
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

1. Di aplikasi HP: **Leaves** → **Request a Leave** (di komputer: **HR → New Leave Application**).
2. Pilih **Leave Type**:
   - **Cuti Tahunan**: jatahnya 12 hari setahun;
   - **Sakit**: lampirkan surat dokter kalau diminta HR;
   - **Izin**: keperluan pribadi, tidak dibayar.
3. Isi tanggal mulai (**From Date**) dan selesai (**To Date**), alasannya, lalu simpan.
4. Atasan menyetujui. Sabtu, Minggu dan hari libur tidak memotong jatah cuti.

Sisa jatah cuti kurang? Sistem menolak pengajuannya (contoh: minta 13 hari padahal jatahnya 12).

## Untuk Admin (HR)

### Tiap awal tahun: hari libur nasional
Sistem sudah membuat daftar libur tiap tahun, isinya baru Sabtu dan Minggu: **Libur DA 2026**, **Libur DA
2027**, dan seterusnya (DA = singkatan perusahaan). Libur nasional dan cuti bersama diisi HR sendiri dari
**SKB 3 Menteri** tahun itu:

1. **HR → Holiday List**, buka **Libur DA <tahun>**.
2. Di tabel **Holidays**, tambah satu baris per tanggal libur: **Date** dan **Description** (misalnya "Idul Fitri").
3. **Save**.

Tombol **Get Local Holidays** (pilih negara Indonesia) bisa membantu mengisi, tapi tetap cocokkan dengan SKB:
cuti bersama sering tidak ada di sana.

### Karyawan baru
1. **HR → Employee → + Add Employee**, isi nama, jenis kelamin, tanggal lahir, tanggal masuk,
   perusahaan, dan **User ID**-nya.
2. **HR → Shift Assignment → + Add Shift Assignment**: karyawannya, **Shift Type** `Kantor`, **Start Date** hari
   pertamanya. **Submit**.
3. **HR → Leave Allocation**: **Cuti Tahunan** 12 hari, 1 Januari sampai 31 Desember. **Submit**.

### Tiap pagi
Buka **HR**: kotak **Today's Attendance** menunjukkan berapa yang sudah hadir. Cek yang belum
absen.
