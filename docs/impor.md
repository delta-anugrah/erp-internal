# Panduan impor data

Cara memasukkan data lama (barang, pelanggan, pemasok, stok awal) sekaligus lewat file CSV, bukan diketik satu-satu.
Contoh file yang sudah dites ada di `erp_internal/tests/data/` (`test_impor.py` mengimpornya sungguhan).

## Urutan

Harus berurutan, karena yang belakang menunjuk yang depan:

1. **Barang** (Item)
2. **Pelanggan** (Customer)
3. **Pemasok** (Supplier)
4. **Stok awal** (Stock Reconciliation), bertanggal **sehari sebelum go-live**
5. **Riwayat penjualan** (Sales History), paling tidak 3 bulan sebelum bulan go-live

## Cara impor

1. Buka **Data Import → + Add Data Import**.
2. **Document Type**: misalnya `Item`. **Import Type**: `Insert New Records`.
   Untuk stok awal centang juga **Submit After Import**.
3. **Save**, lalu unggah file CSV di **Import File**.
4. Cek pratinjau dan peringatan di bawahnya. Kalau bersih, jalankan impornya dari tombol di bawah form.

> Belum dicek di situs: v16.53 menampilkan Data Import sebagai wizard bertahap, jadi nama tombolnya (misalnya
> **Start Import**, **Export Errored Rows**) dan judul kolom template dicocokkan lagi dengan **Download Template**
> begitu `erp.localhost` jadi.

Template kosong bisa diunduh dari tombol **Download Template** di form yang sama. Header di bawah ditulis seperti
yang diberikan untuk pengguna berbahasa Inggris. Kalau kamu memakai tampilan bahasa Indonesia, judul kolom di
template ikut berbahasa Indonesia; dua-duanya diterima.

## Aturan menulis angka dan tanggal

- Angka ditulis polos, **tanpa titik ribuan**: `15000`, bukan `15.000`. Pecahan boleh `2.5` atau `2,5`.
  Angka yang bisa dibaca dua arti (`1.234`) ditolak.
- Tanggal: `dd-mm-yyyy`, misalnya `31-12-2026`.
- Kode dan nama harus sama persis dengan yang sudah ada (huruf besar kecil boleh beda).

## 1. Barang (`barang.csv`)

| Kolom | Isi |
|---|---|
| `Item Code` | kode barang, unik |
| `Item Name` | nama barang |
| `Item Group` | `Barang Jadi`, `Bahan Baku`, `Bahan Penolong`, `Kemasan` atau `Sparepart` |
| `Default Unit of Measure` | satuan stok: `Pcs`, `Lusin`, `Karton`, `Sak`, `Roll` atau `Kg` |
| `Maintain Stock` | `1` untuk barang yang distok |
| `Safety Stock` | stok minimum |
| `UOM (uoms)` | satuan lain, misalnya `Karton` |
| `Conversion Factor (uoms)` | isi satuan lain dalam satuan stok, misalnya `24` |

```csv
Item Code,Item Name,Item Group,Default Unit of Measure,Maintain Stock,Safety Stock,UOM (uoms),Conversion Factor (uoms)
EMB-10,Ember 10 L,Barang Jadi,Pcs,1,50,Karton,24
```

Satu barang punya dua satuan lain (Karton dan Lusin)? Tambah baris di bawahnya, kolom-kolom barang dikosongkan,
cuma `UOM (uoms)` dan `Conversion Factor (uoms)` yang diisi.

## 2. Pelanggan (`pelanggan.csv`)

| Kolom | Isi |
|---|---|
| `Customer Name` | nama pelanggan |
| `Customer Type` | `Company` atau `Individual` |
| `Customer Group` | misalnya `Commercial` (harus grup paling bawah, bukan `All Customer Groups`) |
| `Territory` | misalnya `Indonesia` |

```csv
Customer Name,Customer Type,Customer Group,Territory
Toko Maju Jaya,Company,Commercial,Indonesia
```

## 3. Pemasok (`pemasok.csv`)

| Kolom | Isi |
|---|---|
| `Supplier Name` | nama pemasok |
| `Supplier Group` | misalnya `Raw Material` atau `Local` |

```csv
Supplier Name,Supplier Group
PT Biji Plastik Nusantara,Raw Material
```

## 4. Stok awal (`stok_awal.csv`)

Satu file = satu dokumen stok awal. Baris pertama berisi data dokumen dan barang pertama; baris berikutnya cuma
kolom barang (kolom dokumen dikosongkan). Centang **Submit After Import**.

| Kolom | Isi |
|---|---|
| `Company` | nama perusahaan pabrik |
| `Posting Date` | sehari sebelum go-live, `dd-mm-yyyy` |
| `Purpose` | `Opening Stock` |
| `Difference Account` | `Temporary Opening - <singkatan>` |
| `Item Code (Items)` | kode barang |
| `Warehouse (Items)` | misalnya `Gudang Barang Jadi - <singkatan>` |
| `Quantity (Items)` | jumlah dalam satuan stok |
| `Valuation Rate (Items)` | harga pokok per satuan stok |

```csv
Company,Posting Date,Purpose,Difference Account,Item Code (Items),Warehouse (Items),Quantity (Items),Valuation Rate (Items)
PT Contoh Plastik,31-12-2026,Opening Stock,Temporary Opening - CPL,EMB-10,Gudang Barang Jadi - CPL,120,9000
,,,,BIJI-PP,Gudang Bahan Baku - CPL,500,15000
```

File tes `stok_awal.csv` tidak punya kolom `Posting Date`, supaya tes tidak bergantung tanggal; tanpa kolom itu
tanggalnya hari impor.

## 5. Riwayat penjualan (`riwayat.csv`)

Jumlah terjual per bulan, per perusahaan dan barang, dari catatan lama. Dipakai tombol **Fill from History** di
Sales Forecast. Riwayat **tidak** diimpor sebagai Sales Order, karena nanti terbaca sebagai order yang belum dikirim.

| Kolom | Isi |
|---|---|
| `Company` | nama perusahaan pabrik |
| `Item` | kode barang (barang stok) |
| `Month` | tanggal berapa pun di bulan itu, `dd-mm-yyyy`; disimpan sebagai tanggal 1 |
| `Qty` | jumlah terjual bulan itu, dalam **satuan stok** (Karton diubah ke Pcs dulu) |

```csv
Company,Item,Month,Qty
PT Contoh Plastik,EMB-10,01-08-2026,2400
```

Satu perusahaan, satu barang, satu bulan = satu baris. File yang sama diimpor dua kali tidak menggandakan angka:
baris yang sudah ada ditolak (*Sales history for EMB-10 in 08-2026 already exists.*) dan status impornya bukan
**Success**. Mau membetulkan angka bulan yang sudah ada? Buka barisnya di **Sales History** dan ubah `Qty`, atau
impor dengan **Import Type** `Update Existing Records`.

Cek setelah impor: total per bulan di **Sales History** (Report view, group by Month) sama dengan file Samuel.

## Kalau ada yang salah

Ada dua jenis kesalahan:

1. **Ditolak sebelum mulai.** Sistem mengecek semua isian dulu. Kalau ada nilai yang tidak dikenal (misalnya
   `Item Group` yang belum ada), tidak ada satu baris pun yang masuk dan statusnya tetap **Pending**. Peringatannya
   menyebut nilainya, kolomnya dan nomor barisnya, misalnya: *"Barang Jadii" is not a valid Item Group — row 2*.
   Nomor baris = nomor baris di Excel (baris 1 adalah judul kolom, jadi data pertama = baris 2).
   Pilihannya:
   - betulkan file, unggah ulang di **Import File**, **Start Import** lagi; atau
   - di tabel **Value Mappings**, arahkan nilai yang salah ke nilai yang benar (atau centang **Create New** kalau
     memang perlu dibuat), **Save**, **Start Import** lagi.
2. **Gagal per baris saat impor.** Baris yang lolos tetap masuk, yang gagal dicatat di **Import Log** (nomor baris
   dan pesannya). Statusnya **Partial Success**. Klik **Export Errored Rows**, betulkan file itu, lalu impor file
   itu saja.

## Setelah impor

Cocokkan jumlahnya dengan file Samuel:

- jumlah barang, pelanggan dan pemasok di daftar masing-masing sama dengan jumlah baris file;
- lima barang acak: stok di **Stock Balance** sama dengan hitungan fisik.
