# Panduan Produksi (akun Produksi)

Untuk akun **Produksi** (orang pabrik). Produksi cuma mencatat **hasil produksi**; selebihnya cuma bisa **dilihat**.
Perintah produksi (Work Order), resep (BOM), barang, mesin, surat jalan dan bahan masuk dikerjakan **Admin** (Mas
Samuel, 2026-11-23). Menu Produksi cuma **Manufacturing**.

Ganti bahasa: klik nama kamu di pojok kiri bawah menu samping, pilih **Bahasa Indonesia**. Nama tombol di sini ditulis seperti
di tampilan bahasa Inggris.

## Yang diisi Produksi

| Kerjaan | Di mana | Panduan |
|---|---|---|
| Hasil produksi per shift (barang bagus) | **Daily Input** (menu paling atas), atau tombol **Record Output** di Work Order | `produksi.md`, "Input harian" |
| Reject (jarang) | form **Production Entry** lewat `/desk/production-entry` | `produksi.md`, "Lewat form Production Entry (reject)" |

Stok bergerak sendiri saat Production Entry di-Submit (barang jadi masuk, bahan keluar); Produksi tidak membuat
Stock Entry sendiri.

Produksi juga boleh ganti **status mesin** (Production, Idle, Problem, dan lainnya) di **Production Floor**.
Mesin yang tidak aktif (1, 7, 9-13) tetap Off: tombolnya menolak dengan catatan, minta Admin mengaktifkannya.

## Yang cuma dilihat

- **Production Floor**: mesin mana jalan, mana bermasalah.
- **Work Order**: perintah produksi dan progresnya.
- **Machine Capacity**: kapasitas mesin per produk.
- Laporan: **Plan vs Actual**.

Ada yang perlu dibuat atau diubah di luar itu (Work Order baru, surat jalan, bahan masuk, barang baru)? Minta ke
Admin.
