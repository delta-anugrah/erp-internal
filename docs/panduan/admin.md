# Panduan Admin

Untuk **Admin**. Admin melihat hasil produksi yang dicatat Produksi (`user.md`; mengisinya tidak bisa), dan
mengerjakan: perintah produksi (Work Order), surat jalan dan bahan masuk (`gudang.md`), barang, pemasok, resep
(BOM), stok awal dan stok opname, HR, akun pengguna, dan pengaturan usaha. Akun pengguna, stok awal dan opname, dan
pengaturan ada di menu **Settings** di kiri; barang, pemasok dan BOM di modulnya (Stock, Buying,
Manufacturing); HR di menu **HR**.

Ada tiga peran (**Role Profile**):

| Peran | Untuk siapa | Bisa |
|---|---|---|
| **Produksi** | orang pabrik | cuma mencatat hasil produksi dan status mesin; lihat Work Order, Machine Capacity, Plan vs Actual (`user.md`) |
| **Admin** | pemilik dan kepala | lihat hasil produksi; Work Order, BOM, stok, surat jalan, data induk, penjualan, pembelian, proyek, HR, akun pengguna, pengaturan usaha |
| **Super Admin** | tim IT | semuanya kecuali modul yang dikunci, termasuk Build, System Settings, dan **Finish** di Work Order |

Ganti bahasa: klik nama kamu di pojok kanan atas, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

Modul yang tidak dipakai (CRM, Assets, Quality, Support, Payroll, dan lain-lain) dikunci, begitu juga bagian HR yang
tidak dipakai (rekrutmen, penilaian kinerja, training, klaim biaya, perjalanan dinas, lembur, dan lain-lain; absen,
shift dan cuti tetap jalan): tidak ada di menu, tidak
muncul di pencarian, dan tidak bisa dibuka lewat alamat. Kalau suatu hari dibutuhkan, tim IT membukanya
(hapus dari daftar di kode, lalu migrate).

Versi aplikasi (misalnya `v0.0.1`) ada di bawah kotak login dan di bagian bawah menu kiri **My Settings**. Sebut
versinya kalau melaporkan masalah.

## Dokumen asli dilampirkan

Dokumen kertas harus ada foto atau scan-nya sebelum di-Submit: Sales Order, Sales Invoice, Purchase Order, Purchase
Receipt, Purchase Invoice, Payment Entry, dan Stock Entry **Material Receipt**. Tanpa lampiran, sistem menolak
("Attach a photo or scan of the real document before you submit.") dan formnya menampilkan catatan oranye. Catatan
produksi (Production Entry, Work Order, BOM, Stock Entry Manufacture dan Repack), stok opname, dan Delivery Note
tidak diwajibkan; surat jalan dilampiri setelah ditandatangani. Dokumen hasil Amend membawa lampirannya; dokumen yang
dibuat dari dokumen lain (Sales Order ke Delivery Note, Purchase Order ke Purchase Receipt) mulai tanpa lampiran.

Laporan **Stock → Missing Documents** menampilkan dokumen yang sudah di-Submit tapi belum ada lampirannya, plus semua
surat jalan yang belum dilampiri. Tindak lanjutnya dari situ.

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
