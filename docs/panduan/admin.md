# Panduan Admin

Untuk **Admin**. Admin bisa semua yang dikerjakan User (`user.md`), ditambah: perintah produksi (Work Order), barang, pemasok, resep (BOM),
stok awal dan stok opname, HR, akun pengguna, dan pengaturan usaha. Akun pengguna, stok awal dan opname, dan
pengaturan ada di ikon **Settings** di rel kiri; barang, pemasok dan BOM di modulnya (Stock, Buying,
Manufacturing); HR di aplikasi **HR**.

Ada tiga peran (**Role Profile**):

| Peran | Untuk siapa | Bisa |
|---|---|---|
| **User** | orang pabrik dan gudang | tiga kerjaan harian: hasil produksi, surat jalan, bahan baku masuk; status mesin; selebihnya cuma lihat (`user.md`) |
| **Admin** | pemilik dan kepala | semua yang User bisa, plus Work Order, BOM, data induk, penjualan, pembelian, proyek, HR, akun pengguna, pengaturan usaha |
| **Developer** | tim IT | semuanya, termasuk Build dan System Settings |

Ganti bahasa: klik nama kamu di pojok kanan atas, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

## Akun pengguna

### Tambah orang
1. **Settings → Users → + Add User**.
2. Isi **Email** dan **First Name**, lalu **Role Profiles**: `User` atau `Admin`. **Save**.
3. Di formnya: **Module Profile** sama dengan perannya (`User` atau `Admin`). **Save**.
4. Kalau dia ikut absen: buat **Employee** dengan **User ID** = email ini (`docs/panduan/absen.md`, Karyawan baru).

### Nonaktifkan atau ganti sandi
- Keluar kerja: buka usernya, hilangkan centang **Enabled**, **Save**. Datanya tetap ada.
- Lupa sandi: buka usernya, **Password → Reset Password** (link dikirim ke email), atau isi **Set New Password**
  di bagian Change Password, lalu **Save**.

### Yang tidak bisa
Admin hanya bisa memberi peran **User** atau **Admin**. Peran **Developer**, **System Manager**, atau peran lain
ditolak sistem ("You cannot give these roles"), juga untuk akun sendiri. Akun Developer dan Administrator tidak
bisa diubah Admin ("Only a Developer can change this account").

## Pengaturan usaha

Di **Settings**: **Company**, **Opening Stock & Stock Count** (Stock Reconciliation: stok awal dan stok
opname, `docs/panduan/gudang.md`), **Stock Settings**, **Selling Settings**, **Buying Settings**, **Manufacturing
Settings**, **Accounts Settings**, **Projects Settings**, **HR Settings**. Ubah hanya kalau tahu akibatnya; sistem
sudah diatur (pesanan dulu baru kirim atau terima, stok tidak boleh minus) dan setelan itu dipasang lagi tiap
pembaruan.

Perusahaan tidak PKP: template PPN ada, tapi tidak dipakai bawaan. Faktur hanya untuk mencatat.
