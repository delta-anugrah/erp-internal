# Panduan Admin

Untuk **Admin**. Admin bisa semua yang dikerjakan User (panduan lain), ditambah: barang, pemasok, resep (BOM),
stok opname, HR, akun pengguna, dan pengaturan usaha. Semua ada di ikon **Settings** di rel kiri.

Ada tiga peran (**Role Profile**):

| Peran | Untuk siapa | Bisa |
|---|---|---|
| **User** | semua karyawan | kerja harian: stok, pesanan, surat jalan, terima barang, faktur (catatan), produksi, timesheet, absen dan cuti sendiri |
| **Admin** | pemilik dan kepala | semua yang User bisa, plus data induk, HR, akun pengguna, pengaturan usaha |
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

Di **Settings**: **Company**, **Stock Settings**, **Selling Settings**, **Buying Settings**, **Manufacturing
Settings**, **Accounts Settings**, **Projects Settings**, **HR Settings**. Ubah hanya kalau tahu akibatnya; sistem
sudah diatur (pesanan dulu baru kirim atau terima, stok tidak boleh minus) dan setelan itu dipasang lagi tiap
pembaruan.

Perusahaan tidak PKP: template PPN ada, tapi tidak dipakai bawaan. Faktur hanya untuk mencatat.
