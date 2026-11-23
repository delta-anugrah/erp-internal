# Panduan Penjualan

> **Belum dipakai** (Mas Samuel, 2026-11-02): surat jalan dibuat langsung tanpa Sales Order (`gudang.md`, "Kirim
> barang ke pelanggan"). Panduan ini untuk nanti, dan cuma **Admin** yang bisa membuka menu Selling.

Untuk **Admin**. Urutannya: **Sales Order → Delivery Note → Sales Invoice → Payment Entry**.

Tampilan aslinya bahasa Inggris. Mau bahasa Indonesia: klik nama kamu di pojok kanan atas, pilih
**Bahasa Indonesia**. Nama tombol di panduan ini ditulis seperti di tampilan bahasa Inggris.

## 1. Catat pesanan pelanggan (Sales Order)

1. Buka **Selling → Sales Order → + Add Sales Order**.
2. Isi **Customer**, **Delivery Date** (tanggal kirim yang dijanjikan).
3. Di tabel **Items**: pilih barang, isi **Quantity**. **Rate** (harga satuan) terisi sendiri dari daftar harga
   `Harga Pola 2026`; ubah kalau harganya beda. Rate 0 berarti barang itu belum punya harga di daftar.
   Kalau pelanggan pesan per karton, pilih **UOM** `Karton`; sistem menghitung isinya sendiri.
4. Klik **Save**, cek lagi. **Lampirkan foto atau scan dokumen aslinya** (pesanan dari pelanggan) lewat
   **Attach** di kanan form; selama belum ada lampiran, form menampilkan catatan oranye dan **Submit** ditolak.
5. Klik **Submit**. Pesanan yang belum di-Submit belum dihitung.
6. Cetak: **Print**. Hasilnya langsung format PO Samuel (tabel NO., ORDER, QTY, SATUAN, TGL KIRIM, HARGA dan kotak
   TOTAL merah). Nomor di atasnya adalah **Customer's Purchase Order** kalau diisi, kalau kosong nomor Sales Order.

![Sales Order](gambar/penjualan-1.png)

## 2. Kirim barang (Delivery Note)

1. Di Sales Order yang sudah Submit: **Create → Delivery Note**.
2. Cek jumlah yang benar-benar dikirim hari ini (boleh sebagian; sisanya tetap di pesanan).
3. Cek **Source Warehouse** (wajib): `Gudang Barang Jadi` atau `Gudang Pluit`, sesuai tempat barangnya diambil.
   **Save**, lalu **Submit**: stok langsung berkurang.
4. Cetak surat jalan: **Print**.
5. Surat jalan boleh di-Submit tanpa lampiran. Setelah pelanggan menandatangani, lampirkan fotonya lewat **Attach**
   (bisa setelah Submit). Yang belum dilampiri muncul di laporan **Stock → Missing Documents**.

Stok tidak cukup? Sistem menolak Submit. Cek stoknya dulu; stok tidak boleh minus.

![Delivery Note](gambar/penjualan-2.png)

## 3. Tagih pelanggan (Sales Invoice)

1. Di Delivery Note yang sudah Submit: **Create → Sales Invoice**.
2. Faktur cuma untuk mencatat (perusahaan tidak PKP): **Sales Taxes and Charges Template** dibiarkan kosong.
3. **Save**, cek totalnya, **Attach** foto atau scan fakturnya, lalu **Submit** (tanpa lampiran ditolak). Cetak
   dengan **Print**.

![Sales Invoice](gambar/penjualan-3.png)

## 4. Catat pembayaran (Payment Entry)

1. Di Sales Invoice: **Create → Payment**.
2. Isi tanggal dan jumlah yang diterima, pilih rekening atau kas. **Save**, **Attach** bukti pembayarannya (foto atau scan), lalu **Submit**.

## Kalau salah

- Belum Submit: ubah saja, lalu **Save**.
- Sudah Submit: **Cancel**, lalu **Amend** untuk membuat versi yang benar. Batalkan dari yang paling akhir dulu
  (pembayaran, faktur, surat jalan, baru pesanan).
