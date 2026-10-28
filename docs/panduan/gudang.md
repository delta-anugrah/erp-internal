# Panduan Gudang

Untuk **User** yang pegang stok. Stok opname (Stock Reconciliation) cuma bisa **Admin**. Pabrik punya empat
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

### Terima barang dari pemasok
Buka Purchase Order-nya: **Create → Purchase Receipt**, isi jumlah yang datang, **Save**, **Submit**
(`docs/panduan/pembelian.md`, langkah 3).

### Kirim barang ke pelanggan
Delivery Note dibuat dari pesanan (`docs/panduan/penjualan.md`). Yang pegang gudang menyiapkan barang sesuai surat jalan, lalu memastikan
Delivery Note sudah di-**Submit** sebelum truk berangkat.

### Pindah barang antar gudang
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
