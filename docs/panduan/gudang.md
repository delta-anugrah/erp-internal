# Panduan Gudang

Untuk **User** yang pegang stok: User mengisi bahan baku masuk dan surat jalan (`user.md`); pindah gudang dan
stok opname (Stock Reconciliation) dikerjakan **Admin**. Pabrik punya empat
gudang:

| Gudang | Isinya |
|---|---|
| Gudang Bahan Baku | biji plastik, pewarna, bahan penolong |
| Gudang Produksi | bahan yang sedang dipakai di mesin |
| Gudang Barang Jadi | produk siap kirim |
| Gudang Reject | produk cacat |

Stok tidak boleh minus: kalau sistem bilang stok kurang, cek dulu barangnya, jangan dipaksa.

Ganti bahasa: klik nama kamu di pojok kanan atas, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

## Harian

### Terima bahan baku
Pembelian (Purchase Order) belum dipakai (Mas Samuel, 2026-11-02), jadi bahan masuk dicatat langsung:
1. **Stock → Stock Entry → + Add Stock Entry**, **Stock Entry Type** `Material Receipt`.
2. **Default Target Warehouse**: `Gudang Bahan Baku`.
3. Di **Items**: bahan (misalnya biji plastik) dan jumlahnya dalam Kg. **Save**, **Submit**: stok bertambah.

User cuma bisa membuat jenis `Material Receipt`; jenis lain ditolak ("You may only record a Material Receipt").

### Kirim barang ke pelanggan
Surat jalan dibuat langsung, tanpa Sales Order (penjualan belum dipakai, Mas Samuel 2026-11-02):
1. **Stock → Delivery Note → + Add Delivery Note**.
2. **Customer**: pelanggannya (pelanggan baru dibuat Admin).
3. Di **Items**: barang, jumlah, dan gudang asal `Gudang Barang Jadi`. **Save**, lalu **Submit** sebelum truk
   berangkat: stok langsung berkurang. Cetak: **Print**.

Stok tidak cukup? Sistem menolak Submit. Cek stoknya dulu; stok tidak boleh minus.

### Pindah barang antar gudang (Admin)
1. **Stock → Stock Entry → + Add Stock Entry**, **Stock Entry Type** `Material Transfer`.
2. Isi **Default Source Warehouse** dan **Default Target Warehouse** (misalnya Bahan Baku ke Produksi).
3. Di **Items**: barang dan jumlah. **Save**, **Submit**.

![Stock Entry](gambar/gudang-1.png)

### Lihat stok
- Stok sekarang per gudang: **Stock → Stock Balance**.
- Riwayat keluar masuk satu barang: **Stock → Stock Ledger**, saring **Item**.

## Bulanan: stok opname (Admin)

1. Hitung fisik.
2. **Settings → Opening Stock & Stock Count → + Add Stock Reconciliation**, **Purpose** `Stock Reconciliation`.
3. Isi per baris: barang, gudang, **Quantity** hasil hitung. **Save**, **Submit**: sistem menyamakan stoknya.

Selisih besar? Laporkan dulu ke atasan sebelum Submit.
