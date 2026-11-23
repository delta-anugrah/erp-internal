# Panduan Admin

Untuk **Admin**. Admin bisa semua yang dikerjakan Produksi (`user.md`), ditambah: perintah produksi (Work Order), barang, pemasok, resep (BOM),
stok awal dan stok opname, HR, akun pengguna, dan pengaturan usaha. Akun pengguna, stok awal dan opname, dan
pengaturan ada di menu **Settings** di kiri; barang, pemasok dan BOM di modulnya (Stock, Buying,
Manufacturing); HR di menu **HR**.

Ada tiga peran (**Role Profile**):

| Peran | Untuk siapa | Bisa |
|---|---|---|
| **Produksi** | orang pabrik dan gudang | tiga kerjaan harian: hasil produksi, surat jalan, bahan baku masuk; status mesin; selebihnya cuma lihat (`user.md`) |
| **Admin** | pemilik dan kepala | semua yang Produksi bisa, plus Work Order, BOM, data induk, penjualan, pembelian, proyek, HR, akun pengguna, pengaturan usaha |
| **Super Admin** | tim IT | semuanya kecuali modul yang dikunci, termasuk Build dan System Settings |

Ganti bahasa: klik nama kamu di pojok kanan atas, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

Modul yang tidak dipakai (CRM, Assets, Quality, Support, Payroll, dan lain-lain) dikunci, begitu juga bagian HR yang
tidak dipakai (rekrutmen, penilaian kinerja, training, klaim biaya, perjalanan dinas, lembur, dan lain-lain; absen,
shift dan cuti tetap jalan): tidak ada di menu, tidak
muncul di pencarian, dan tidak bisa dibuka lewat alamat. Kalau suatu hari dibutuhkan, tim IT membukanya
(hapus dari daftar di kode, lalu migrate).

Versi aplikasi (misalnya `v0.0.1`) ada di bawah kotak login dan di bagian bawah menu kiri **My Settings**. Sebut
versinya kalau melaporkan masalah.

## Akun pengguna

### Tambah orang
1. **Settings → Users → + Add User**.
2. Isi **Email** dan **First Name**, lalu **Role Profiles**: `Produksi` atau `Admin`. **Save**.
3. Di formnya: **Module Profile** sama dengan perannya (`Produksi` atau `Admin`). **Save**.
4. Kalau dia ikut absen: buat **Employee** dengan **User ID** = email ini (`docs/panduan/absen.md`, Karyawan baru).

### Nonaktifkan atau ganti sandi
- Keluar kerja: buka usernya, hilangkan centang **Enabled**, **Save**. Datanya tetap ada.
- Lupa sandi: buka usernya, **Password → Reset Password** (link dikirim ke email), atau isi **Set New Password**
  di bagian Change Password, lalu **Save**.

### Yang tidak bisa
Admin hanya bisa memberi peran **Produksi** atau **Admin**. Peran **Super Admin**, **System Manager**, atau peran lain
ditolak sistem ("You cannot give these roles"), juga untuk akun sendiri. Akun Super Admin dan Administrator tidak
bisa diubah Admin ("Only a Super Admin can change this account").

## Pengaturan usaha

Di **Settings**: **Company**, **Opening Stock & Stock Count** (Stock Reconciliation: stok awal dan stok
opname, `docs/panduan/gudang.md`), **Stock Settings**, **Selling Settings**, **Buying Settings**, **Manufacturing
Settings**, **Accounts Settings**, **Projects Settings**, **HR Settings**. Ubah hanya kalau tahu akibatnya; sistem
sudah diatur (pesanan dulu baru kirim atau terima, stok tidak boleh minus) dan setelan itu dipasang lagi tiap
pembaruan.

Perusahaan tidak PKP: template PPN ada, tapi tidak dipakai bawaan. Faktur hanya untuk mencatat.
