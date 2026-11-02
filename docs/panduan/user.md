# Panduan User

Untuk **User** (orang pabrik dan gudang). User mengisi tiga hal tiap hari; selebihnya cuma bisa **dilihat**.
Perintah produksi (Work Order), resep (BOM), barang, pelanggan dan mesin dibuat **Admin** (Mas Samuel, 2026-11-02).

Ganti bahasa: klik nama kamu di pojok kanan atas, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

## Yang diisi User

| Kerjaan | Di mana | Panduan |
|---|---|---|
| Hasil produksi per shift (bagus dan reject) | **Manufacturing → Production Entry**, atau tombol **Record Output** di Work Order | `produksi.md`, "Catat hasil produksi" |
| Surat jalan (kirim barang ke pelanggan) | **Stock → Delivery Note** | `gudang.md`, "Kirim barang ke pelanggan" |
| Bahan baku masuk | **Stock → Stock Entry**, jenis `Material Receipt` | `gudang.md`, "Terima bahan baku" |

User juga boleh ganti **status mesin** (Production, Idle, Problem, dan lainnya) di **Production Floor**.
Mesin yang tidak aktif (1, 7, 9-14) tetap Off: tombolnya menolak dengan catatan, minta Admin mengaktifkannya.

## Yang cuma dilihat

- **Production Floor**: mesin mana jalan, mana bermasalah.
- **Work Order**: perintah produksi dan progresnya.
- Stok: **Stock Balance**, **Stock Ledger**, **Item**, **Warehouse**.
- Laporan: **Plan vs Actual**, **Order Readiness**.

Ada yang perlu dibuat atau diubah di luar tiga kerjaan itu (Work Order baru, pindah gudang, barang baru)? Minta ke
Admin. Kalau dicoba, sistem menolak dengan pesan izin (misalnya "You may only record a Material Receipt").
