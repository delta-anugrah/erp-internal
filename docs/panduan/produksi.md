# Panduan Produksi

Untuk **User** dan **Admin**; lama produksi (Item Lead Time) diisi **Admin**. **Sales History** juga
ada di menu **Selling**.
Alurnya:

1. sekali per produk: **lama produksi** dan **resep (BOM)**;
2. tiap bulan: **perkiraan penjualan → jadwal produksi → MRP → perintah produksi**;
3. tiap Senin: cek **Order Readiness** (Siap Order).

Ganti bahasa: klik nama kamu di pojok kanan atas, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

> Gambar layar lainnya menyusul (lihat `docs/TODO.md`).

## Lantai produksi (Production Floor)

Lihat 14 mesin injeksi sekaligus, sebagai gambar 3D, dan statusnya saat ini. Buka dari **Manufacturing → Production
Floor** (pilihan paling atas).

![Lantai produksi](gambar/produksi-1.png)

- **Warna lampu mesin**: hijau = jalan (Production), merah berkedip = Problem, biru dan agak gelap = Maintenance,
  mati dan lebih gelap = Off. Di atas tiap mesin ada nama dan Work Order yang sedang jalan.
- **Lihat dari sudut lain**: tarik pakai mouse untuk memutar, scroll untuk zoom, klik kanan lalu tarik untuk
  menggeser. Tombol **+**, **−** dan **rumah** (pojok kanan bawah) zoom dan mengembalikan tampilan awal.
- **Bar atas**: nama perusahaan, jam, dan titik **Live** (hijau = langsung ikut berubah; kalau tertulis
  **Updated jam:menit**, halamannya menyegarkan diri tiap menit). Kartu di bawahnya: jumlah mesin, yang jalan,
  yang bermasalah, Work Order yang jalan, dan hasil produksi.
- **Tabel mesin** (kiri bawah): klik satu baris, kamera terbang ke mesin itu. Panah di kanan atasnya melipat tabel.
- **Klik satu mesin**: panel di kanan menunjukkan detailnya dan link ke Work Order-nya. Enam tombol status mengubah
  status mesin itu (sama dengan mengubah **Status** di formulir Workstation-nya); **Open machine** membuka
  formulirnya.
- **Work Order di mesin mana?** Isi **Machine** di Work Order. Tanpa itu Work Order tidak muncul di lantai.
- Kalau browser tidak bisa menampilkan 3D, halaman menampilkan tabel biasa dengan isi yang sama.

## Sekali per produk

### Lama produksi (Item Lead Time)
1. **Manufacturing → Item Lead Time → + Add Item Lead Time**, pilih **Item** (produknya).
2. Isi **Capacity per Day**: berapa buah yang jadi sehari (semua mesin untuk produk itu).
3. Isi **Buffer Time**: hari cadangan (setting mesin, kirim ke gudang), misalnya `1`.
4. **Save**.

Tanpa lama produksi, Order Readiness menulis **Set lead time** dan tidak memberi tanggal mulai.

### Resep produk (BOM)
1. **Manufacturing → BOM → + Add BOM**, **Item** produknya, **Quantity** misalnya `1`.
2. Di **Items**: bahan dan jumlahnya untuk Quantity tadi, dalam satuan stok bahan (biji PP dalam Kg, kemasan dalam
   Pcs). Contoh ember: `0,25` Kg biji PP dan `1` kemasan.
3. **Save**, **Submit**. BOM pertama otomatis jadi BOM utama (**Is Default**).

Produk yang punya baris **Machine Capacity** tidak perlu BOM manual: buka barisnya, klik **Make BOMs**. Sistem
membuat satu BOM per varian per mesin (biji plastik dan masterbatch dihitung dari berat produk dan runner), lalu
menonaktifkan BOM lama dari baris itu yang tidak dipakai Work Order yang masih jalan. BOM buatan tangan tidak diubah.

## Tiap bulan

### 1. Perkiraan penjualan (Sales Forecast)
1. **Manufacturing → Sales Forecast → + Add Sales Forecast**.
2. **Company**, **Frequency** `Monthly`, **From Date** tanggal 1 bulan depan, **Number of Periods** misalnya
   `1` (atau `3` untuk tiga bulan).
3. **Parent Warehouse**: gudang induk perusahaan (yang di atas empat gudang).
4. Pilih produknya di **Items** (kotak pilih banyak), **Save**.
5. Klik **Fill from History**. Tiap produk diisi rata-rata 3 bulan penuh terakhir (riwayat penjualan + pesanan
   yang sudah di-submit), dibulatkan ke atas. Pesannya menyebut bulan yang dipakai.
6. Produk yang **belum punya riwayat** disebut di pesan dan diisi `0`: ketik angkanya sendiri.
7. Cek semua angka (bulan ini ada promo? pelanggan baru?), ubah kalau perlu, **Save**, **Submit**.

### 2. Jadwal produksi induk (Master Production Schedule)
Di Sales Forecast yang sudah di-submit: **Create → Master Production Schedule**. Kalau mau, tambahkan pesanan
terbuka di tab Sales Orders (**Get Sales Orders**) lalu **Get Actual Demand**. **Save**.

### 3. MRP
**Manufacturing → MRP** (Material Requirements Planning Report). Isi **MPS** dengan jadwal tadi (tanggalnya terisi
sendiri) dan **Warehouse** gudang induk perusahaan. Laporan menunjukkan berapa yang harus dibuat dan bahan yang harus
dibeli, per hari. Centang baris yang mau dibuat, klik **Make Purchase / Work Order**.

### 4. Perintah produksi (Work Order)
Gudang terisi sendiri: bahan dari Gudang Bahan Baku, proses di Gudang Produksi, hasil ke Gudang Barang Jadi.
1. Buka Work Order-nya, **Submit**.
2. Bahan diambil ke mesin: **Start** (Material Transfer for Manufacture), **Submit** Stock Entry-nya.
3. Produk selesai: **Finish** (Manufacture), isi jumlah yang jadi, **Submit**. Stok barang jadi bertambah, bahan
   berkurang sesuai BOM.

## Tiap Senin: Order Readiness (Siap Order)

**Manufacturing → Order Readiness** Satu baris per produk jadi, untuk bulan yang dipilih:

Pilih Company dan (kalau perlu) Warehouse milik company itu. Kalau muncul izin ditolak atau "Warehouse ... does
not belong to company", akunmu nggak boleh buka company atau gudang itu.


| Kolom | Artinya |
|---|---|
| Stock | stok di Gudang Barang Jadi |
| Open Orders | pesanan yang belum dikirim |
| Forecast This Month | angka perkiraan bulan ini |
| Ordered This Month | yang sudah dipesan bulan ini |
| In Production | Work Order yang belum selesai |
| Short | yang masih kurang dan harus dibuat |
| Latest Start | paling lambat mulai produksi tanggal ini |

Status, yang paling mendesak di atas:

- **Late**: tanggal mulai sudah lewat, langsung buat Work Order;
- **Start this week**: mulai dalam 7 hari;
- **Set lead time**: produk belum punya Item Lead Time, isi dulu;
- **Scheduled**: masih ada waktu;
- **OK**: stok dan produksi cukup.
