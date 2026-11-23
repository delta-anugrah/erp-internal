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
| `Default Unit of Measure` | satuan stok: `Pcs`, `Lusin`, `Gross`, `Karton`, `Ball`, `Ball Kecil`, `Dus`, `Ikat`, `Pack`, `Sak`, `Roll` atau `Kg` (hanya `Kg` boleh pecahan) |
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
PT Delta Anugrah,31-12-2026,Opening Stock,Temporary Opening - CPL,EMB-10,Gudang Barang Jadi - CPL,120,9000
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
PT Delta Anugrah,EMB-10,01-08-2026,2400
```

Satu perusahaan, satu barang, satu bulan = satu baris. File yang sama diimpor dua kali tidak menggandakan angka:
baris yang sudah ada ditolak (*Sales history for EMB-10 in 08-2026 already exists.*) dan status impornya bukan
**Success**. Mau membetulkan angka bulan yang sudah ada? Buka barisnya di **Sales History** dan ubah `Qty`, atau
impor dengan **Import Type** `Update Existing Records`.

Cek setelah impor: total per bulan di **Sales History** (Report view, group by Month) sama dengan file Samuel.

## 6. Kapasitas mesin (`kapasitas.xlsx`)

Kapasitas per produk per mesin (waktu siklus, cavity, berat, bahan) dari Excel Samuel, tanpa Data Import. Buka
**Machine Capacity** (menu Manufacturing), tombol **Import from Excel**: lampirkan file `.xlsx` atau `.csv`
(maksimal 2 MB dan 2000 baris), klik **Preview**, cek tabelnya, lalu **Apply**. Sebelum Apply tidak ada yang
ditulis. Yang boleh: Manufacturing Manager (profil Admin dan Developer). Contoh file yang dites ada di
`erp_internal/tests/data/kapasitas.xlsx` (dibuat ulang dengan `tools/contoh_kapasitas.py`; `test_impor_kapasitas.py`
mengimpornya sungguhan).

**Baris judul** = baris pertama (dari 10 baris terisi pertama) yang memuat minimal 2 judul yang dikenal, jadi
judul besar atau baris kosong di atas judul kolom tidak masalah. Kalau tidak ada, file ditolak dengan pesan jelas.

**Judul kolom dibaca dari artinya**, bukan urutannya. Besar kecil huruf, spasi, tanda baca diabaikan (`Cycle Time
(detik)` = `cycletimedetik`), `%` dibaca "persen". Kolom yang judulnya tidak dikenal diabaikan dan disebut di
atas tabel. Daftar nama lain ada di `KOLOM_IMPOR` (`planning/impor_kapasitas.py`); nama baru = tambah di tabel itu.

| Isi | Judul yang dikenal (sebagian) |
|---|---|
| kode barang | `Kode Barang`, `Item Code`, `SKU` |
| produk | `Produk`, `Nama Produk`, `Product` |
| jenis | `Jenis`, `Tipe`, `Type` |
| mesin | `Mesin`, `No Mesin`, `Machine` |
| waktu siklus (detik) | `Cycle Time`, `CT`, `Siklus`, `Cycle (detik)` |
| cavity | `Cavity`, `Cav`, `Jumlah Cavity` |
| berat produk (gram) | `Berat`, `Gram`, `Berat Produk`, `Weight` |
| berat runner (gram per tembakan) | `Runner`, `Sprue`, `Berat Runner` |
| bahan | `Bahan`, `Material`, `PP/HDPE` |
| masterbatch dan persennya | `Masterbatch`; `MB %`, `Persen MB` |

**Cara mencocokkan baris:**

- **Barang**: kalau ada `Kode Barang`, itu yang dipakai. Kalau tidak: `Produk` + `Jenis`. `Produk` dicocokkan
  dengan nama barang template (besar kecil huruf tidak berpengaruh); pasangan produk + jenis yang `master.PISAH`
  pisahkan (Sendok Makan Pack/Ball) menunjuk templatenya sendiri; ejaan jenis disamakan lewat `master.SAMA` ("Warna
  DX" = DX). Jenis yang tidak dimiliki varian mana pun ditolak. Jenis kosong = baris untuk seluruh template.
- **Mesin**: angka di selnya dipakai sebagai `Machine No.` (`3`, `03`, `Mesin 03` sama saja); kalau tidak ada
  angka, dicocokkan dengan nama mesin. Dua mesin bernomor sama ditolak.
- **Bahan dan masterbatch**: kode barang atau nama barang. Bahan yang tidak ada **ditolak, tidak dibuatkan**, supaya
  salah ketik tidak menambah barang stok. Satuannya harus Kg (aturan Machine Capacity).
- **Angka**: `2,5` dan `2.5` = 2,5; `1.250,5` dan `1,250.5` = 1250,5. `1.250` dan `1,250` bisa berarti seribu dua
  ratus lima puluh atau satu seperempat, jadi **ditolak**; tulis `1250` atau `1,25`.

**Hasil per baris** (nomor baris = nomor baris di Excel, termasuk baris judul dan baris kosong di atasnya):

| Hasil | Arti |
|---|---|
| New | baris kapasitas baru |
| Changed | sudah ada (barang + jenis + mesin sama) tapi angka atau bahan di file beda; kolom yang beda disebut di Reason |
| Unchanged | sudah sama persis; tidak ditulis |
| Refused | ditolak, alasannya di kolom Reason (barang, mesin atau bahan tidak ada, angka tidak jelas, nilai ditolak form, baris kembar dalam file) |

**Apply** menulis baris New dan Changed, lalu membuat BOM-nya seperti tombol **Make BOMs** (`kapasitas.buat_bom_kapasitas`);
baris Unchanged tidak disentuh. Kalau satu baris gagal saat Apply (padahal lolos Preview), baris itu dibatalkan
seluruhnya, ditandai Refused dengan pesan kesalahannya, dan baris lain jalan terus. File yang sama diimpor dua kali:
kali kedua semuanya Unchanged dan tidak ada BOM baru. Baris kapasitas yang sudah dinonaktifkan tidak diaktifkan
lagi oleh impor. Selesai Apply, dialog tertutup sendiri, kecuali ada baris Refused: tabelnya tetap terbuka supaya
alasannya bisa dibaca.

## Excel penjualan Samuel (`penjualan.py`)

Di situs asli (`make setup`, di server atau lokal; README "Run it on your computer"), tiga pemuat Samuel
(`master`, `penjualan`, `mesin_barang`) jalan otomatis **sekali**, begitu setup wizard selesai (otomatis atau diisi
sendiri di browser; `erp_internal.wizard.lanjutkan`, penanda `erp_data_samuel`). Kalau wizard diisi sendiri,
jalankan `make up` (lokal) atau `make setup` (server) begitu wizard selesai: perintah itu yang memuat datanya; job
latar juga memuat, tapi baru setelah job wizard sendiri selesai, bisa lama. Update berikutnya (`make
update-local`, versi baru di server) tidak memuat ulang, jadi editan di aplikasi aman. Memuat ulang setelah Samuel
kirim file baru: jalankan `muat` per pemuat seperti di bawah (lokal lewat `docker compose -p erp-local
--project-directory .local -f deploy/server/docker-compose.yml run --rm tools bash -c 'bench --site "$SITE"
execute erp_internal.master.muat'`, begitu juga `penjualan` lalu `mesin_barang`).

Excel Samuel 2026-10-29 (penjualan Januari-September 2026 dan spesifikasi barang) ada di
`erp_internal/data/penjualan_2026.json`. Jalankan **sesudah** `master.muat` (barangnya dari sana):

```bash
cd ~/Desktop/Projects/erp-internal-bench
bench --site erp.localhost execute erp_internal.penjualan.muat
```

Yang dibuat (dijalankan dua kali = sama saja, `ditulis` 0):

| Apa | Isi |
|---|---|
| Tipe dan barang baru | yang dijual di Excel tapi tidak ada di daftar harga (`produk_baru`): Gayung Lumba Soft, Gayung Bajigur DX Soft, Gantungan Folding Soft, Gantungan Dinda Hitam, Toples Nastar 1/2 Kg (`TOPLES-NASTAR`), Sendok Bebek Catering (`SENDOK-BEBEK`, stok dalam `Ball Kecil`). Warnanya tebakan, belum ada harga (`docs/menunggu-samuel.md` baris 14) |
| Bahan baku | 7 barang di grup `Bahan Baku`, stok dalam Kg (`BB-PP-WARNA`, `BB-PP-HITAM`, ...), harga per kg sebagai valuation rate dan di daftar harga beli `Harga Bahan Baku` (jadi daftar harga bawaan Purchase Order selama Buying Settings masih "Standard Buying") |
| Riwayat penjualan | Sales History per varian per bulan, dalam satuan stok (Lusin x 12, Gross x 144). Excel tidak memisah warna, jadi angkanya dibagi rata ke warna-warna tipe itu (sisa pembagian ke varian pertama menurut kode). Sendok Panjang JSW = Sendok Makan Pack |
| Stok minimum | `safety_stock` tiap varian = setengah rata-rata penjualan sebulan, dibulatkan ke atas (`STOK_MIN_BULAN`); dipakai Order Readiness |

Cek: total per baris Excel per bulan sama dengan jumlah Sales History varian-variannya (`test_penjualan`).
Baris **Total** di Excel tidak menghitung baris 1 (Gantungan Dinda Super); di sini semua baris dihitung.
Angka baru dari Samuel: ubah file JSON-nya, jalankan lagi.

## Daftar barang per mesin Samuel (`mesin_barang.py`)

Sheet "Mesin & Kapasitas" dari Excel Samuel 2026-11-02 (mesin mana mencetak barang apa) ada di
`erp_internal/data/mesin_barang.json`. Jalankan **sesudah** `master.muat` dan `penjualan.muat`:

```bash
cd ~/Desktop/Projects/erp-internal-bench
bench --site erp.localhost execute erp_internal.mesin_barang.muat
```

Yang dibuat (dijalankan dua kali = sama saja, `ditulis` 0):

| Apa | Isi |
|---|---|
| Machine Capacity | satu baris per template + Jenis per mesin (31 pasangan di sheet = 54 baris di mesin 2, 3, 4, 5, 6, 8). Cycle time, berat per pcs (kg di Excel, disimpan gram) dan bahan dari `spesifikasi` di `penjualan_2026.json`; runner 0 karena belum ada angkanya |
| Cavity | "( 4 )" di belakang nama = jumlah cavity cetakan di mesin itu, mengalahkan angka di spesifikasi; tanpa angka pakai spesifikasi |
| BOM | `buat_bom_kapasitas` per baris: satu BOM per varian per mesin |

- Nama di sheet dipetakan ke barang di bagian `barang` file JSON: `[template, Jenis, no spesifikasi]`. Nama yang
  dipetakan ke `[]` belum punya barang dan muncul di `catatan`. "Gantungan DX" = Gantungan Dinda DX; Body PLN
  dibuang dari daftar, sudah tidak dibuat (Samuel 2026-11-02).
- Barang dari beberapa bagian = satu barang di satu mesin, satu set per putaran (Samuel 2026-11-02): Toples Nastar
  (body + tutup) di Mesin 05, 30 + 10 = 40 detik; Gantungan Folding di mesin yang mencetak stiknya (2, 3, 6),
  stik + batok + tongkat = 56 + 36 + 43 = 135 detik.
- Pasangan yang hilang dari file baru tidak dihapus: centang `Disabled` di baris Machine Capacity-nya.

## Data induk Samuel: katalog dan mesin (`master.py`)

Barang jadi Dinda House Ware, daftar harganya dan mesin injection tidak lewat CSV, tapi lewat importer sendiri
yang membaca file dari Samuel apa adanya:

- `erp_internal/data/katalog.json`: daftar harga "POLA PLASTIK TAHUN 2026" (20 produk, tipe, warna, harga per
  lusin/gross/ball/dus/pack, kemasan). Harga tidak mengikat (sewaktu-waktu dapat berubah).
- `erp_internal/data/mesin.json`: 14 mesin injection moulding (merek, tonase, negara, tahun, model).

```bash
cd ~/Desktop/Projects/erp-internal-bench
bench --site erp.localhost execute erp_internal.master.muat
```

Hasilnya angka (`template`, `varian`, `harga`, `mesin`), berapa record yang ditulis kali ini (`ditulis`, 0 kalau
tidak ada yang berubah) dan `catatan`: hal yang file-nya tidak jelas. Dijalankan dua kali = sama saja.

Yang dibuat:

| Apa | Isi |
|---|---|
| Barang (template + varian) | satu template per produk di grup `Barang Jadi`, merek `Dinda House Ware`; varian **hanya** kombinasi yang ada di daftar (atribut `Jenis`, `Warna`, dan `Ukuran` untuk Toples Dinda). Kode: `GAYUNG-LUMBA` → `GAYUNG-LUMBA-SPR-MRH` |
| Satuan | stok dalam `Pcs`; `Lusin` = 12, `Gross` = 144; `Ball`/`Dus`/`Ikat` per varian dari teks kemasan, misalnya "1 Ball (20 Lusin)" = 240 Pcs |
| Daftar harga | `Harga Pola 2026` (jual, IDR), satu Item Price per varian per satuan yang ada harganya; jadi daftar harga bawaan Sales Order dan Delivery Note selama Selling Settings masih "Standard Selling" |
| Mesin | Workstation `Mesin 01`..`Mesin 14`, tipe `Injection Moulding`; nomor urut lantai (`Machine No.`), merek, model, tonase, tahun, negara. Mesin dengan `"aktif": false` di `mesin.json` (1, 7, 9-14, Samuel 2026-11-02) jadi `Disabled` dan status `Off`: tidak bisa dipilih untuk Work Order baru |

Pilihan model:

- **Sendok Makan** jadi dua template: `SENDOK-MAKAN-PACK` (stok dalam `Pack`, 1 Dus = 250 Pack) dan
  `SENDOK-MAKAN` (curah, stok `Pcs`, 1 Ball = 20 Gross). Isi sendok per pack tidak ada di daftar.
- **Toples Dinda** satu template dengan atribut `Ukuran` (1 KG, 1,5 KG). "Toples (UK: 1 1/2 KG)" produk sendiri
  (`TOPLES-1.5KG`).
- Ejaan disamakan (`master.SAMA`): "Orens" → Orange, "Warna DX" → DX, "Super & Dx warna" → Super & DX.
- Kemasan tanpa isi ("per ball", "Perball") diambil dari perbandingan harga kalau hasilnya bulat (misalnya Baskom
  Dinda 303 DX: 544.500 / 30.250 = 18 Lusin), dan dicatat di `catatan` supaya dicek Samuel.
- Varian boleh punya kemasan sendiri (`setup.PENGATURAN_VARIAN`, Item Variant Settings `allow_different_uom`):
  Gantungan Dinda Super 1 Dus = 3 Gross, DX 1 Dus = 5 Gross.

### Kalau Samuel kirim file baru

1. Timpa `erp_internal/data/katalog.json` dan/atau `mesin.json` (format sama). Produk baru tanpa kode di
   `master.KODE` dapat kode dari namanya (huruf besar); warna atau tipe baru tanpa singkatan di
   `master.SINGKATAN` dapat singkatan dari hurufnya. Tambahkan dulu ke tabel itu kalau mau kodenya rapi.
2. Jalankan `muat` di atas, baca `catatan`.
3. Judul file menentukan nama daftar harga: "... TAHUN 2027" membuat `Harga Pola 2027` baru, yang lama tetap ada. Daftar bawaan Sales Order dan Delivery Note tidak ikut pindah: ganti sendiri di Selling Settings.
   Harga di daftar itu yang sudah tidak ada di file dihapus.
4. Yang **tidak** dihapus: barang dan mesin yang hilang dari file (mungkin sudah dipakai transaksi). Nonaktifkan
   manual (Item `Disabled`); mesin yang tidak dipakai: `"aktif": false` di `mesin.json`, lalu jalankan lagi. Singkatan atribut yang sudah ada juga tidak diubah, karena
   mengubahnya mengganti kode semua varian.

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
