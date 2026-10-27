# Panduan Pembelian

Buat bagian Pembelian. Urutannya: **Material Request → Purchase Order → Purchase Receipt → Purchase Invoice**.
Barang tidak bisa diterima tanpa Purchase Order; sistem menolaknya.

Ganti bahasa: klik nama kamu di pojok kanan atas, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

> Gambar layar menyusul: diambil di `erp.localhost` setelah situs uji jadi (lihat `docs/TODO.md`).

## 1. Lihat permintaan barang (Material Request)

Produksi atau Gudang membuat **Material Request** kalau bahan mau habis. Buka **Buying → Material Request**,
saring yang statusnya **Pending**.

## 2. Pesan ke pemasok (Purchase Order)

1. Dari Material Request: **Create → Purchase Order**. Atau langsung **Buying → Purchase Order → + Add Purchase Order**.
2. Isi **Supplier** dan **Required By** (tanggal barang harus datang).
3. Di **Items**: barang, **Quantity**, **Rate**. Gudang tujuan bahan baku: **Gudang Bahan Baku**.
4. Pemasok kena PPN: **Purchase Taxes and Charges Template** pilih `PPN Masukan 11% - <singkatan perusahaan>`.
5. **Save**, lalu **Submit**. Kirim ke pemasok: **Print** atau **Email**.

![Purchase Order](gambar/pembelian-2.png)

## 3. Terima barang (Purchase Receipt)

Biasanya dikerjakan Gudang saat truk datang.

1. Di Purchase Order: **Create → Purchase Receipt**.
2. Ubah **Quantity** ke jumlah yang benar-benar datang. Barang rusak: isi **Rejected Quantity**.
3. **Save**, lalu **Submit**: stok gudang langsung bertambah.

![Purchase Receipt](gambar/pembelian-3.png)

## 4. Catat tagihan pemasok (Purchase Invoice)

1. Di Purchase Receipt: **Create → Purchase Invoice**.
2. Samakan nomor dan tanggal dengan faktur pemasok (**Supplier Invoice No**, **Supplier Invoice Date**).
3. **Save**, lalu **Submit**. Bayarnya nanti lewat **Create → Payment**.

## Kalau salah

Sudah Submit: **Cancel**, lalu **Amend**. Batalkan dari yang paling akhir dulu.
