---
judul: Manual Admin
aplikasi: ERP Internal PT Delta Anugrah
peran: Admin (lampiran: Super Admin)
versi_aplikasi: v0.0.2
edisi: Draf 1, November 2026
---

# Manual Admin

**ERP Internal PT Delta Anugrah**

| | |
|---|---|
| Untuk | Pemilik, kepala bagian, dan staf kantor pabrik dengan akun **Admin** |
| Lampiran | Tugas khusus **Super Admin** (tim IT) |
| Versi aplikasi | v0.0.2 |
| Edisi | Draf 1, November 2026 |
| Disusun oleh | Tim ERP Internal |

> **Cara memakai buku ini.** Bab 1 sampai 4 dibaca sekali saat mulai. Bab 5 sampai 8 dipakai saat mengisi data
> awal (barang, mesin, stok awal). Bab 9 sampai 16 adalah kerja harian, mingguan, dan bulanan. Bab 19 berisi
> tanya jawab "Kalau ... maka ...".

---

## Daftar isi

1. [Mengenal aplikasi dan peran](#1-mengenal-aplikasi-dan-peran)
2. [Masuk, bahasa, sandi, dan menu](#2-masuk-bahasa-sandi-dan-menu)
3. [Akun pengguna](#3-akun-pengguna)
4. [Data perusahaan](#4-data-perusahaan)
5. [Data barang](#5-data-barang)
6. [Mesin, kapasitas, dan resep (BOM)](#6-mesin-kapasitas-dan-resep-bom)
7. [Gudang, stok awal, dan stok opname](#7-gudang-stok-awal-dan-stok-opname)
8. [Pembelian](#8-pembelian)
9. [Penjualan](#9-penjualan)
10. [Perintah produksi dan pemantauan](#10-perintah-produksi-dan-pemantauan)
11. [Gudang harian dan surat jalan](#11-gudang-harian-dan-surat-jalan)
12. [Lampiran dan Dokumen Tanpa Lampiran](#12-lampiran-dan-dokumen-tanpa-lampiran)
13. [Biaya dan Biaya Bulanan](#13-biaya-dan-biaya-bulanan)
14. [Data Belum Lengkap](#14-data-belum-lengkap)
15. [Siap Order dan rencana produksi bulanan](#15-siap-order-dan-rencana-produksi-bulanan)
16. [SDM: karyawan, absen, dan cuti](#16-sdm-karyawan-absen-dan-cuti)
17. [Membatalkan dan memperbaiki dokumen](#17-membatalkan-dan-memperbaiki-dokumen)
18. [Jadwal kerja Admin](#18-jadwal-kerja-admin)
19. [Kalau ... maka ... (tanya jawab)](#19-kalau--maka--tanya-jawab)
20. [Daftar istilah](#20-daftar-istilah)
21. [Siapa yang dihubungi](#21-siapa-yang-dihubungi)
22. [Lampiran A: Super Admin](#lampiran-a-super-admin)

---

## 1. Mengenal aplikasi dan peran

Aplikasi ini mencatat seluruh kegiatan pabrik dalam satu tempat: barang, stok, pembelian, penjualan, produksi,
biaya, dan karyawan. Aplikasi dipakai untuk **satu perusahaan**, PT Delta Anugrah.

Ada tiga peran:

| Peran | Untuk siapa | Yang bisa dilakukan |
|---|---|---|
| **Produksi** | Operator dan petugas pabrik | Mencatat hasil produksi dan mengganti status mesin. Selebihnya hanya melihat |
| **Admin** | Pemilik dan kepala bagian | Pesanan, pembelian, gudang, barang, mesin, perintah produksi, biaya, karyawan, pengguna, perusahaan |
| **Super Admin** | Tim IT | Semua yang dilakukan Admin, ditambah pengaturan usaha dan pengaturan sistem (Lampiran A) |

**Pembagian kerja dengan Produksi.** Admin membuat perintah produksi dan memantau hasilnya. Hasil produksi diisi
oleh petugas pabrik di Input Harian. Admin melihat hasil tersebut, tetapi tidak mengubahnya.

**Aturan dasar yang berlaku di seluruh aplikasi:**

- **Stok tidak boleh minus.** Barang harus diterima dulu sebelum dipakai atau dikirim.
- **Dokumen kertas wajib difoto.** Pesanan, faktur, penerimaan, dan pembayaran harus punya lampiran sebelum dikirim
  (Bab 12).
- **Simpan dulu, lalu Kirim.** **Simpan** menyimpan draf. **Kirim** mengesahkan dokumen, dan baru saat itu stok atau
  uang tercatat.
- **Salah setelah dikirim?** Klik **Batalkan**, lalu **Amendemen** (Bab 17).

---

## 2. Masuk, bahasa, sandi, dan menu

### 2.1 Masuk ke aplikasi

1. Buka alamat aplikasi di browser (Chrome disarankan).
2. Ketik **email** dan **sandi**.
3. Klik **Continue**.

![Halaman masuk dan versi aplikasi di bawah kotak](gambar/adm-01-login.png)

Tulisan kecil di bawah kotak masuk (misalnya `v0.0.2`) adalah versi aplikasi. Sebutkan versi ini saat melaporkan
masalah.

### 2.2 Mengganti bahasa

1. Klik **judul menu** di pojok kiri atas menu samping (nama bagian yang sedang terbuka).
2. Pilih **Bahasa Indonesia**. Halaman dimuat ulang dalam Bahasa Indonesia.

Untuk kembali, pilih **English** di tempat yang sama.

![Menu judul dengan pilihan Bahasa Indonesia](gambar/adm-02-ganti-bahasa.png)

### 2.3 Mengganti sandi sendiri

1. Klik **nama Anda** di pojok kiri bawah, pilih **Pengaturan**.
2. Di bagian **Profil**, klik **Ubah Kata sandi**.
3. Ketik sandi baru di **Atur Kata Sandi Baru** (minimal 8 karakter).
4. Biarkan centang **Keluar dari semua perangkat setelah mengubah kata sandi**, lalu klik **Ubah Kata sandi**.

Sesi yang sedang dipakai tetap masuk. Perangkat lain otomatis keluar. Versi aplikasi juga tertera di bagian bawah
menu kiri jendela Pengaturan.

![Jendela Pengaturan, Ubah Kata sandi](gambar/adm-03-ubah-sandi.png)

### 2.4 Menu kiri

| Menu | Isinya |
|---|---|
| **Lantai Produksi** | Gambar 3D semua mesin dan statusnya |
| **Input Harian** | Hasil produksi per shift (Admin hanya melihat) |
| **Stok** | Barang, Mutasi Stok, Surat Jalan, Gudang, Saldo Stok, Kartu Stok, Merek, Dokumen Tanpa Lampiran |
| **Penjualan** | Pelanggan, Pesanan Penjualan, Faktur Penjualan, Pembayaran, Riwayat Penjualan |
| **Pembelian** | Pemasok, Permintaan Barang, Pesanan Pembelian, Penerimaan Barang, Faktur Pembelian, Harga Barang, Catatan Biaya, Biaya Bulanan |
| **Produksi** | Perintah Produksi, Rencana vs Aktual, Kapasitas Mesin, Resep Produk (BOM), Siap Order, Perkiraan Penjualan, MRP, Lama Produksi Barang |
| **Proyek** | Belum dipakai di pabrik |
| **SDM** | Karyawan, absen, shift, hari libur, cuti |
| **Pengaturan** | Pengguna, Perusahaan, Stok Awal & Stok Opname, Alasan Reject, Data Belum Lengkap |

![Menu kiri akun Admin](gambar/adm-04-menu-kiri.png)

Klik judul untuk membuka daftar halamannya, klik lagi untuk menutup. Modul yang tidak dipakai pabrik (misalnya CRM
dan Aset) dikunci dan tidak ditampilkan.

### 2.5 Beranda dan kartu

Setiap bagian punya **Beranda** berisi kartu. Setiap kartu memuat ikon, judul, angka, dan satu kalimat penjelasan,
misalnya kartu **Barang**: "Produk, bahan, dan kemasan". Kalau ragu, baca kalimatnya, lalu klik kartunya.

![Beranda Stok dengan kartu-kartu](gambar/adm-05-beranda-stok.png)

### 2.6 Menu Pengaturan

Beranda **Pengaturan** memuat kartu **Pengguna**, **Perusahaan**, **Stok Awal & Stok Opname**, **Alasan Reject**,
dan **Data Belum Lengkap**.

![Beranda Pengaturan](gambar/adm-06-beranda-pengaturan.png)

> **Catatan.** Halaman pengaturan usaha (Pengaturan Stok, Penjualan, Pembelian, Manufaktur, dan lainnya) hanya ada
> di menu Super Admin. Kalau perlu diubah, hubungi Super Admin.

---

## 3. Akun pengguna

### 3.1 Membuat akun baru

1. Buka **Pengaturan**, klik kartu **Pengguna**, lalu **+ Tambah Pengguna**.
2. Isi **Email** dan **Nama Depan**.
3. Isi **Atur Kata Sandi Baru** dengan sandi pertamanya. Ini wajib, karena aplikasi belum mengirim email.
4. Di **Profil Peran**, pilih **Produksi** (petugas pabrik) atau **Admin** (pimpinan dan kepala bagian).
5. Klik **Simpan**.
6. Di form yang terbuka, isi **Profil Modul** dengan nama yang sama (**Produksi** atau **Admin**).
7. Klik **Simpan** lagi.

![Form pengguna baru: email, nama, peran](gambar/adm-07-pengguna-baru.png)

![Profil Modul diisi sama dengan perannya](gambar/adm-08-profil-modul.png)

> **Peringatan.** Beri tahu sandi pertama langsung kepada orangnya, jangan lewat grup. Minta ia menggantinya setelah
> masuk pertama kali (Bab 2.3).

Kalau orang itu juga ikut absen, buat juga data **Karyawan** dengan **ID Pengguna** berisi email ini (Bab 16.2).

### 3.2 Mengganti sandi pengguna yang lupa

1. Buka **Pengaturan**, **Pengguna**, lalu buka akun orangnya.
2. Klik **Kata sandi**, lalu **Ubah Kata sandi**. Ketik sandi baru.
3. Beri tahu sandi baru langsung kepada orangnya.

![Form pengguna: ganti sandi dan centang Diaktifkan](gambar/adm-09-sandi-diaktifkan.png)

### 3.3 Karyawan berhenti bekerja

Buka akunnya, hilangkan centang **Diaktifkan**, lalu klik **Simpan**. Orang itu tidak bisa masuk lagi, tetapi
datanya tetap tersimpan. Jangan menghapus akun.

### 3.4 Batasan Admin

- Admin hanya bisa memberi peran **Produksi** atau **Admin**. Peran lain ditolak dengan pesan "Anda tidak bisa memberi
  peran ini", juga untuk akun sendiri.
- Akun Super Admin dan Administrator tidak bisa diubah Admin ("Hanya Super Admin yang bisa mengubah akun ini.").

![Pesan penolakan saat memberi peran lain](gambar/adm-10-tolak-peran.png)

---

## 4. Data perusahaan

1. Buka **Pengaturan**, klik kartu **Perusahaan**, buka **PT Delta Anugrah**.
2. Periksa nama (di judul form), singkatan, dan mata uang (IDR). Data ini jarang diubah.

![Form Perusahaan: singkatan dan mata uang](gambar/adm-11-perusahaan.png)

Logo perusahaan tampil di Lantai Produksi dan hasil cetak. Kolom logo tidak tampil di form ini, jadi logo dipasang
oleh tim IT.

> **Catatan.** Perusahaan tidak memungut PPN. Template pajak tersedia, tetapi kolom pajak di faktur dibiarkan kosong.

---

## 5. Data barang

Semua produk, bahan baku, kemasan, dan pigmen dicatat di **Stok > Barang**.

![Daftar barang dengan kolom Grup Barang](gambar/adm-12-daftar-barang.png)

### 5.1 Empat grup barang

| Grup Barang | Isinya | Satuan stok |
|---|---|---|
| **Barang Jadi** | Produk yang dibuat dan dijual | Pcs atau sesuai barang |
| **Bahan Baku** | Biji plastik, misalnya `BB-SEAL-CAP` | Kg |
| **Kemasan** | Plastik, karung, dus | Buah |
| **Pigmen** | Pewarna, template `PIGMEN` | Gram (dibeli per Kg) |

### 5.2 Template dan varian

**Template** adalah barang induk, misalnya `GAYUNG-LUMBA`. Template punya banyak **varian** yang dibedakan lewat
atribut, misalnya **Jenis** dan **Warna**. Centang **Memiliki Varian** menandai template.

![Template dengan atribut Jenis dan Warna](gambar/adm-13-template.png)

Kode varian tersusun dari kode template, jenis, dan warna, misalnya `GAYUNG-LUMBA-SPR-MRH`. Yang dijual dan disimpan
di stok selalu **varian**, bukan template.

![Daftar varian satu template](gambar/adm-14-varian.png)

### 5.3 Varian Seal Cap baru

Template `SEAL-CAP` punya atribut **Merk** (kode merek pelanggan) dan **Warna**.

1. Buka barang `SEAL-CAP`.
2. Klik **Buat**, lalu **Varian tunggal**.
3. Pilih **Merk** dan **Warna**. Nilai yang belum ada harus ditambahkan dulu di atributnya.
4. Klik **Buat**.
5. Di varian baru, isi tabel **Packing** (Bab 5.4), lalu **Simpan**.

![Dialog Varian tunggal Seal Cap](gambar/adm-15-varian-seal-cap.png)

Resep Seal Cap di Mesin 04 dan 14 dibuat ulang sendiri di belakang layar. Harga jual tidak perlu diisi, karena harga
Seal Cap mengikuti mesin (Bab 9.4).

### 5.4 Tabel Packing (kemasan per produk)

Di form barang produk, tabel **Packing** berisi kemasan yang dipakai:

- **Barang Kemasan**: barang grup Kemasan, misalnya `Plastik 35x50` atau `Karung`.
- **Isi per Kemasan (pcs)**: berapa buah muat dalam satu kemasan, lebih dari 0.

![Tabel Packing varian Seal Cap: plastik dan karung](gambar/adm-16-tabel-packing.png)

Tabel di template berlaku untuk semua variannya. Kalau varian punya baris sendiri, baris varian yang dipakai.

**Membuat barang kemasan baru:** **Stok > Barang > + Tambah Barang**, **Grup Barang** Kemasan, **Satuan Ukuran
Bawaan** Buah. Kemasan bersatuan Pcs ditolak di tabel Packing.

![Barang kemasan: grup Kemasan, satuan Buah](gambar/adm-17-barang-kemasan.png)

> **Penting.** Terima dulu stok kemasan di Gudang Bahan Baku sebelum mengisi tabel Packing. Tanpa stok itu, hasil
> produksi barang tersebut tidak bisa dicatat.

### 5.5 Pigmen

Pigmen punya satu template, `PIGMEN`: stok dalam **gram**, dibeli per **Kg**. Setiap warna punya satu varian dengan
**Rasio Pigmen (g per kg)**, yaitu gram pigmen untuk setiap kilogram bahan.

![Template PIGMEN: grup, satuan gram dan Kg](gambar/adm-18-pigmen-template.png)

**Membuat pigmen warna baru:**

1. Buka `PIGMEN`, klik **Buat**, lalu **Varian**.
2. Pilih **Warna**, isi **Rasio Pigmen (g per kg)** (lebih dari 0, biasanya 1).
3. Klik **Buat**, lalu **Simpan**.

![Membuat varian pigmen untuk warna baru](gambar/adm-19-pigmen-baru.png)

Resep produk dengan warna itu langsung memakai pigmen ini. Catatan oranye muncul kalau stoknya belum ada di Gudang
Bahan Baku. Warna Bening, Bening Transparan, Campur, dan Neutral memang tanpa pigmen.

![Catatan oranye: pigmen belum ada stok](gambar/adm-20-pigmen-catatan.png)

### 5.6 Daftar harga

Harga dicatat di **Pembelian > Harga Barang**, dalam dua daftar:

| Daftar Harga | Untuk |
|---|---|
| `Harga Pola 2026` | Harga jual |
| `Harga Bahan Baku` | Harga beli bahan, pigmen, kemasan |

Satu baris harga berlaku untuk satu barang dan satu **Satuan**, misalnya Lusin. Harga pigmen ditulis per Kg, misalnya
350.000.

![Harga Barang disaring ke satu daftar harga](gambar/adm-21-harga-barang.png)

> **Catatan.** Seal Cap tidak memerlukan harga jual di daftar harga. Harganya mengikuti mesin pada pesanan penjualan.

### 5.7 Merek Seal Cap

**Stok > Merek** memuat kode merek Seal Cap, masing-masing dengan **Insert (pcs)** dan **Deskripsi**. Ubah jumlah
insert kalau cetakannya berubah.

![Form Merek: Insert (pcs) dan Deskripsi](gambar/adm-22-merek.png)

### 5.8 Catatan oranye di form barang

Kalau data barang kurang, form barang menampilkan catatan oranye, satu baris per kekurangan. Klik tautannya untuk
langsung ke tempat perbaikannya, misalnya **Isi tabel Packing di barangnya** atau **Tambah harga jual**. Catatan ini
tidak menghalangi penyimpanan, tetapi sebaiknya segera dibereskan (Bab 14).

![Catatan oranye di form barang dengan tautan](gambar/adm-23-catatan-barang.png)

---

## 6. Mesin, kapasitas, dan resep (BOM)

### 6.1 Data mesin

Pabrik punya 14 mesin injeksi, **Mesin 01** sampai **Mesin 14**. Data mesin dibuka lewat pencarian "Stasiun Kerja",
atau dari Lantai Produksi: klik mesin, lalu **Buka mesin**.

Setiap mesin mencatat **No. Mesin** (urutan di lantai pabrik), **Merek Mesin**, **Model Mesin**, **Daya Jepit (Ton)**,
**Tahun Buat**, dan **Buatan**.

![Form mesin: nomor, merek, model, daya jepit](gambar/adm-24-mesin.png)

### 6.2 Mesin nonaktif

Mesin yang tidak dipakai diberi centang **Dinonaktifkan** (saat ini Mesin 01, 07, dan 09 sampai 13). Mesin ini tidak
bisa dipilih untuk perintah produksi baru dan tampil mati di Lantai Produksi.

Untuk mengaktifkan kembali: buka mesinnya, hapus centang **Dinonaktifkan**, klik **Simpan**.

![Mesin dengan centang Dinonaktifkan](gambar/adm-25-mesin-nonaktif.png)

### 6.3 Kapasitas Mesin

**Produksi > Kapasitas Mesin** mencatat kecepatan satu mesin membuat satu produk, beserta bahannya. Satu baris
berlaku untuk satu produk di satu mesin. Kalau barangnya template, baris berlaku untuk semua variannya.

| Kolom | Isinya |
|---|---|
| **Barang**, **Mesin** | Produk dan mesinnya |
| **Waktu Siklus (detik)** | Lama satu tembakan |
| **Kavitas** | Jumlah buah per tembakan |
| **Berat Produk (g)** | Berat satu buah |
| **Berat Runner (g)** | Berat runner per tembakan |
| **Runner Digiling** | Dicentang kalau runner digiling dan dipakai lagi |
| **Bahan** | Bahan baku, harus barang stok bersatuan Kg |
| **Masterbatch**, **Masterbatch %** | Masterbatch dan persennya dari campuran |

Bagian **Hasil hitungan** menghitung sendiri **Pcs per Jam** dan **Bahan per Pcs (g)**. Contoh Seal Cap di Mesin 04:
3.600 detik dibagi 14 detik dikali 20 kavitas, sekitar 5.143 buah per jam.

![Baris Kapasitas Mesin Seal Cap di Mesin 04](gambar/adm-26-kapasitas.png)

![Bagian Hasil hitungan: Pcs per Jam](gambar/adm-27-hasil-hitungan.png)

Pcs per Jam menjadi target di laporan Rencana vs Aktual. Baris ini juga sumber resep produk dan membatasi pilihan mesin
di perintah produksi.

### 6.4 Membuat resep (BOM) dari kapasitas

1. Buka baris Kapasitas Mesin.
2. Klik **Buat BOM**.
3. Pesan muncul: "BOM dibuat: ..., tetap: ..., dinonaktifkan: ...".

![Tombol Buat BOM dan pesan hasilnya](gambar/adm-28-buat-bom.png)

Sistem membuat satu resep untuk setiap varian di mesin itu. Resep yang sudah sesuai tidak diubah. Resep lama yang
tidak dipakai perintah produksi berjalan dinonaktifkan.

### 6.5 Isi resep

Buka **Produksi > Resep Produk (BOM)**. Satu resep berisi:

| Baris | Cara hitung | Satuan |
|---|---|---|
| Bahan baku | Dari berat produk dan runner | Kg |
| Pigmen sesuai warna | Berat bahan per buah dikali rasio pigmen | Gram |
| Setiap kemasan dari tabel Packing | 1 dibagi isi kemasan (angka pecahan) | Buah |

![Isi resep Seal Cap: bahan, pigmen, kemasan](gambar/adm-29-isi-bom.png)

Kalau pigmen atau tabel Packing diubah, resep diperbarui sendiri di belakang layar. Resep yang dibuat manual tidak
pernah diubah. Produk tanpa baris Kapasitas Mesin bisa diberi resep manual lewat **+ Tambah** di Resep Produk (BOM).

### 6.6 Impor Kapasitas Mesin dari Excel

Untuk banyak baris sekaligus:

1. Di daftar **Kapasitas Mesin**, klik **Impor dari Excel**. Dialog **Impor Kapasitas Mesin** terbuka.
2. Klik **File Excel atau CSV**, pilih **Perangkat Saya**, pilih file, klik **Unggah**.
3. Klik **Pratinjau**. Belum ada data yang ditulis.
4. Periksa kolom **Hasil**: **Baru**, **Berubah**, **Tidak berubah**, atau **Ditolak** (dengan **Alasan**).
5. Kalau sudah sesuai, klik **Terapkan**. Baris baru dan yang berubah disimpan, lalu resepnya dibuat.

![Dialog Impor Kapasitas Mesin, hasil Pratinjau](gambar/adm-30-impor-kapasitas.png)

> **Tips.** File boleh `.xlsx` atau `.csv`, paling besar 2 MB dan 2.000 baris. Tulis angka desimal dengan koma,
> misalnya `0,88`.

### 6.7 Alasan Reject

**Pengaturan > Alasan Reject** berisi pilihan alasan di form Hasil Produksi (Short Shot, Flashing, Belang / Warna,
Pecah / Retak, Bubble, Sink Mark, Lainnya). Tambah alasan baru di sana. Alasan yang tidak dipakai lagi cukup diberi
centang **Nonaktif**, jangan dihapus.

![Daftar Alasan Reject](gambar/adm-31-alasan-reject.png)

---

## 7. Gudang, stok awal, dan stok opname

### 7.1 Lima gudang pabrik

| Gudang | Isinya |
|---|---|
| Gudang Bahan Baku | Biji plastik, pigmen, kemasan |
| Gudang Produksi | Bahan yang sedang dipakai mesin |
| Gudang Barang Jadi | Produk siap kirim |
| Gudang Reject | Produk cacat |
| Gudang Pluit | Produk siap kirim yang disimpan di Pluit |

Barang dijual dari Gudang Barang Jadi atau Gudang Pluit. Nama gudang di layar diikuti singkatan perusahaan, misalnya
`Gudang Bahan Baku - DA`.

![Daftar lima gudang](gambar/adm-32-gudang.png)

### 7.2 Mengisi stok awal

Stok awal diisi sekali, sebelum aplikasi mulai dipakai.

1. Buka **Pengaturan**, klik kartu **Stok Awal & Stok Opname**, lalu klik tombol tambah.
2. **Tanggal Posting**: sehari sebelum aplikasi mulai dipakai.
3. **Tujuan**: `Persediaan pembukaan`. **Akun Selisih** terisi sendiri (`Temporary Opening`).
4. Di tabel **Item**, isi per baris: **Kode Item**, **Gudang**, **Kuantitas** (dalam satuan stok), dan **Tingkat
   Penilaian** (harga pokok per satuan).
5. Klik **Simpan**, lalu **Kirim** dan **Ya**.

![Stok awal: Tanggal Posting, Tujuan, Akun Selisih](gambar/adm-33-stok-awal-kepala.png)

![Tabel Item stok awal: barang, gudang, jumlah, harga](gambar/adm-34-stok-awal-item.png)

| Barang | Satuan Kuantitas |
|---|---|
| Biji plastik | Kg |
| Pigmen | Gram |
| Kemasan dan produk | Buah / Pcs |

Satu dokumen boleh berisi banyak barang dan banyak gudang. Stok awal tidak memerlukan lampiran.

### 7.3 Memeriksa stok

- **Stok > Saldo Stok**: stok terkini per barang dan per gudang. Saring dengan **Gudang** atau **Item**.
- **Stok > Kartu Stok**: riwayat keluar masuk satu barang. Kolom **Kuantitas Masuk**, Kuantitas Keluar, dan saldo.

![Saldo Stok disaring per gudang](gambar/adm-35-saldo-stok.png)

![Kartu Stok satu barang](gambar/adm-36-kartu-stok.png)

> **Tips.** Dari dokumen yang sudah dikirim, klik **Tampilan**, lalu **Kartu Stok** untuk langsung melihat stok yang
> berubah karena dokumen itu.

### 7.4 Stok opname bulanan

1. Hitung fisik barang di gudang.
2. Buka **Pengaturan > Stok Awal & Stok Opname**, klik tombol tambah.
3. **Tujuan**: `Rekonsiliasi Persediaan`.
4. Isi per baris: barang, gudang, **Kuantitas** hasil hitung. Periksa kolom selisih.
5. Klik **Simpan**, lalu **Kirim** dan **Ya**. Sistem menyamakan stok dengan hasil hitung.

![Stok opname: tujuan Rekonsiliasi Persediaan](gambar/adm-37-stok-opname.png)

> **Peringatan.** Kalau selisihnya besar, laporkan kepada atasan **sebelum** mengklik Kirim.

---

## 8. Pembelian

Urutan pembelian selalu sama: **Pesanan Pembelian, Penerimaan Barang, Faktur Pembelian, Pembayaran**.

![Beranda Pembelian dengan kartu-kartu](gambar/adm-38-beranda-pembelian.png)

### 8.1 Pemasok

Pemasok cukup dicatat sekali: **Pembelian > Pemasok > + Tambah Pemasok**, isi **Nama Supplier** dan **Grup Pemasok**
(misalnya Raw Material), lalu **Simpan**.

![Form pemasok baru](gambar/adm-39-pemasok.png)

### 8.2 Permintaan Barang

Kalau bahan hampir habis, gudang atau produksi membuat **Permintaan Barang**. Saring status **Pending**, buka satu,
lalu klik **Buat > Pesanan Pembelian**. Barangnya terisi sendiri. Pesanan juga boleh dibuat langsung tanpa
permintaan.

### 8.3 Pesanan Pembelian (PO)

1. **Pemasok**: pilih pemasoknya.
2. **Diperlukan Oleh**: tanggal paling lambat barang tiba. Tanggal ini tercetak sebagai TGL KIRIM.
3. Di tabel **Item**: barang dan **Kuantitas**. **Harga** terisi dari daftar `Harga Bahan Baku`, boleh diubah. **Gudang**
   terisi Gudang Bahan Baku.
4. Pigmen dipesan dengan **Satuan** `Kg`. Contoh: 2 Kg dengan harga 350.000 per Kg.
5. **Templat Pajak dan Biaya Pembelian** dibiarkan kosong.
6. Klik **Simpan**.

![Pesanan Pembelian: pemasok, tanggal, barang](gambar/adm-40-po-isi.png)

### 8.4 Melampirkan foto dan mengirim

Setelah disimpan, catatan oranye "Lampirkan foto atau hasil scan dokumen aslinya sebelum diajukan." muncul. Tanpa
foto, **Kirim** ditolak.

1. Klik **+** di samping **Lampiran** di sisi kiri form.
2. Pilih **Perangkat Saya**, pilih foto PO yang sudah dicap, klik **Unggah**.
3. Klik **Kirim**, lalu **Ya**.

![Catatan oranye lampiran pada pesanan](gambar/adm-41-catatan-lampiran.png)

![Tombol + di samping Lampiran dan dialog unggah](gambar/adm-42-lampirkan.png)

### 8.5 Mencetak PO

Klik **ikon printer**. Hasilnya langsung memakai format cetak PO: tabel NO., ORDER, QTY, SATUAN, TGL KIRIM, HARGA, dan
kotak TOTAL merah. Kirim hasil cetak ini kepada pemasok.

![Hasil cetak format PO](gambar/adm-43-cetak-po-beli.png)

### 8.6 Penerimaan Barang

Saat barang tiba:

1. Di pesanan, klik **Buat > Penerimaan Barang**.
2. Sesuaikan **Kuantitas** dengan barang yang benar-benar diterima. Barang rusak diisi di **Kuantitas Ditolak**.
3. Klik **Simpan**, lampirkan foto surat jalan pemasok, klik **Kirim** dan **Ya**.

![Penerimaan Barang: kuantitas dan kuantitas ditolak](gambar/adm-44-penerimaan.png)

Stok Gudang Bahan Baku langsung bertambah. Pigmen dibeli dalam Kg tetapi dicatat dalam gram: 2 Kg menambah stok 2.000
gram.

> **Catatan.** Barang dari pemasok tidak bisa diterima lewat Penerimaan Barang tanpa pesanan pembelian. Bahan yang
> masuk tanpa pesanan dicatat lewat Mutasi Stok (Bab 11.1).

### 8.7 Faktur Pembelian dan Pembayaran

1. Dari penerimaan, klik **Buat > Faktur Pembelian**.
2. Isi **Nomor Faktur Supplier** dan **Tanggal Faktur Supplier** sesuai faktur pemasok.
3. **Simpan**, lampirkan foto faktur, **Kirim**, **Ya**.
4. Setelah dibayar, dari faktur klik **Buat > Pembayaran**. Isi tanggal, jumlah, dan rekening atau kas.
5. **Simpan**, lampirkan foto bukti transfer, **Kirim**, **Ya**. Faktur tercatat lunas.

![Faktur Pembelian: nomor dan tanggal faktur pemasok](gambar/adm-45-faktur-beli.png)

![Pembayaran ke pemasok](gambar/adm-46-pembayaran-beli.png)

---

## 9. Penjualan

Urutan penjualan: **Pesanan Penjualan, Surat Jalan, Faktur Penjualan, Pembayaran**.

![Beranda Penjualan dengan kartu-kartu](gambar/adm-47-beranda-penjualan.png)

### 9.1 Pelanggan

**Penjualan > Pelanggan > + Tambah Pelanggan**, ketik **Nama Pelanggan**, biarkan kolom lain sesuai bawaan, klik
**Simpan**.

### 9.2 Pesanan Penjualan

1. **Penjualan > Pesanan Penjualan > + Tambah Pesanan Penjualan**.
2. Pilih **Pelanggan**. Isi **Tanggal pengiriman** yang dijanjikan.
3. **Daftar Harga** terisi sendiri: `Harga Pola 2026`.
4. Di tabel **Item**: barang dan **Kuantitas**. **Harga** terisi dari daftar harga, boleh diubah.
5. Kalau pelanggan memberi nomor PO, isi nomornya di kolom nomor PO pelanggan. Nomor ini tercetak di bagian atas.

![Pesanan Penjualan baru: pelanggan, tanggal, daftar harga](gambar/adm-48-so-baru.png)

### 9.3 Barang tanpa harga

Barang yang belum ada di daftar harga muncul dengan harga **0** dan catatan oranye "Baris 2: ... belum punya harga
jual."

1. Klik tautan **Tambah harga jual** di catatan itu.
2. Form harga baru terbuka dengan barang dan daftar harga terisi. Ketik harganya, klik **Simpan**.
3. Kembali ke pesanan, pilih ulang barangnya. Harga kini terisi.

![Catatan oranye harga jual nol dan tautannya](gambar/adm-49-so-harga-nol.png)

### 9.4 Seal Cap: harga mengikuti mesin

Harga Seal Cap tidak mengikuti daftar harga, tetapi mengikuti mesin yang membuatnya.

1. Pilih varian Seal Cap dan isi jumlahnya.
2. Buka detail baris, isi kolom **Mesin**. Pilihannya hanya mesin yang punya harga: Mesin 04 dan Mesin 14.
3. Harga berubah sendiri.

| Mesin | Harga per buah |
|---|---|
| Mesin 04 | Rp24 |
| Mesin 14 | Rp23 |

![Baris Seal Cap dengan kolom Mesin dan harga](gambar/adm-50-so-seal-cap.png)

Baris Seal Cap tanpa mesin ditolak saat disimpan ("pilih mesinnya, harganya ikut mesin").

### 9.5 Lampiran dan Kirim

Klik **Simpan**. Lampirkan foto PO pelanggan lewat **+** di samping **Lampiran**. Klik **Kirim**, lalu **Ya**.

### 9.6 Mengubah pesanan yang sudah dikirim

Klik **Perbarui Item**, ubah jumlah atau tanggal, lalu klik **Perbaruan**. Harga Seal Cap tetap terkunci mengikuti
mesin: mengubahnya ditolak dengan pesan "di Mesin 14 harganya 23, bukan 20".

![Dialog Perbarui Item dan pesan harga terkunci](gambar/adm-51-perbarui-item.png)

### 9.7 Mencetak pesanan

Klik **ikon printer**. Hasilnya memakai format cetak PO dengan kotak TOTAL merah. Untuk Seal Cap, nama mesinnya
tercetak merah setelah nama barang, misalnya " - Mesin 14".

![Hasil cetak pesanan dengan mesin Seal Cap merah](gambar/adm-52-cetak-so.png)

### 9.8 Surat Jalan, Faktur Penjualan, dan Pembayaran

1. Dari pesanan yang sudah dikirim, klik **Buat > Surat Jalan**. Pilih **Tetapkan Gudang Sumber**, **Simpan**, **Kirim**,
   **Ya** (langkah lengkap di Bab 11.3).
2. Dari surat jalan, klik **Buat > Faktur Penjualan**. **Templat Pajak dan Biaya Penjualan** dibiarkan kosong.
   **Simpan**, lampirkan foto faktur, **Kirim**, **Ya**.
3. Setelah pelanggan membayar, dari faktur klik **Buat > Pembayaran**. Isi tanggal, jumlah, dan rekening tujuan.
   **Simpan**, lampirkan bukti transfer, **Kirim**, **Ya**. Faktur tercatat lunas.

![Faktur Penjualan dari surat jalan](gambar/adm-53-faktur-jual.png)

### 9.9 Riwayat Penjualan

**Penjualan > Riwayat Penjualan** berisi jumlah terjual per barang per bulan dari catatan lama. Data ini dipakai untuk
perkiraan penjualan (Bab 15.2).

![Daftar Riwayat Penjualan](gambar/adm-54-riwayat-penjualan.png)

---

## 10. Perintah produksi dan pemantauan

### 10.1 Membuat Perintah Produksi dari Pesanan Penjualan

1. Buka pesanan yang sudah dikirim, klik **Buat**, pilih **Perintah Produksi**.
2. Di dialog, pilih barisnya, klik **Buat**.
3. Buka Perintah Produksi yang baru. Barang, jumlah, dan (untuk Seal Cap) **Mesin** mengikuti baris pesanan.
4. Periksa **Mesin**, lalu klik **Simpan**, **Kirim**, **Ya**.

![Dialog Buat Perintah Produksi dari pesanan](gambar/adm-55-wo-dari-so.png)

![Perintah Produksi Seal Cap dengan Mesin 04](gambar/adm-56-wo-mesin.png)

Setelah dikirim, perintah tampil di Lantai Produksi dan Input Harian.

### 10.2 Membuat Perintah Produksi langsung

1. **Produksi > Perintah Produksi > + Tambah Perintah Produksi**.
2. Pilih **Barang**, isi **Kuantitas untuk diproduksi**.
3. Klik kolom **Mesin**. Daftar hanya berisi mesin yang tercatat di Kapasitas Mesin untuk barang ini.
4. Klik **Simpan**. Kolom **BOM** terisi resep untuk mesin itu.
5. Klik **Kirim**, lalu **Ya**.

![Pilihan Mesin sesuai Kapasitas Mesin](gambar/adm-57-wo-pilih-mesin.png)

> **Catatan.** Mesin lain ditolak: "... tidak dibuat di Mesin 05. Mesin untuk barang ini: ...". Mesin nonaktif juga
> ditolak. Barang tanpa baris Kapasitas Mesin boleh dibuat di mesin mana pun. Untuk menambah mesin, tambah dulu
> barisnya di Kapasitas Mesin.

Selama masih draf, mengganti mesin lalu **Simpan** juga mengganti resepnya.

### 10.3 Catatan oranye di Perintah Produksi

Kalau kemasan atau pigmen barang belum diisi, muncul catatan oranye dengan tautan perbaikan, misalnya **Isi tabel
Packing di barangnya**. Catatan tidak menghalangi penyimpanan.

![Catatan oranye kemasan belum diisi](gambar/adm-58-wo-catatan.png)

### 10.4 Memindah mesin

Perintah yang sudah dikirim masih bisa dipindah ke mesin lain selama statusnya belum mulai atau sedang berjalan:
ganti **Mesin**, lalu klik **Perbaruan**. Seluruh targetnya ikut pindah. Setelah selesai, dihentikan, atau ditutup,
kolom **Mesin** terkunci.

### 10.5 Memantau di Lantai Produksi

Buka **Lantai Produksi**. Lampu hijau berarti berjalan, merah berkedip berarti ada masalah. Kartu **Perlu perhatian**
menampilkan mesin yang tidak berproduksi. Klik barisnya, kamera menuju mesin itu, dan panel kanan menampilkan perintah
produksinya.

![Lantai Produksi dari sisi Admin](gambar/adm-59-lantai-produksi.png)

Admin juga bisa mengganti status mesin lewat enam tombol di panel. Arti warna dan tombolnya sama dengan Manual
Operator Bab 4.

### 10.6 Melihat Input Harian dan Hasil Produksi

**Input Harian** menampilkan hasil per shift. Admin melihat halaman yang sama tanpa kotak isian. Tombol **Cetak** dan
**Excel** menghasilkan rekap seminggu penuh.

![Input Harian tanpa kotak isian](gambar/adm-60-input-harian-admin.png)

Klik angka bergaris bawah untuk membuka **Hasil Produksi**: jumlah bagus, tabel Reject, dan bagian Stock Entry. Admin
hanya melihat; tombol Batalkan dan Amendemen tidak ada.

### 10.7 Laporan Rencana vs Aktual

**Produksi > Rencana vs Aktual** membandingkan target dengan hasil. Bawaannya tujuh hari terakhir sampai kemarin,
**Kelompokkan per** Mesin + Hari.

- **Target dari** Perintah Produksi: jumlah perintah dibagi rata ke hari rencananya.
- **Target dari** Kapasitas: Pcs per Jam dikali jam jalan. Barang tanpa kapasitas ditulis **Tanpa kapasitas**.
- **Tercapai %**: hijau 100% ke atas, oranye mulai 85%, merah di bawahnya.
- Ada satu kolom untuk setiap alasan reject, dan grafik batang di atas tabel.

![Laporan Rencana vs Aktual dengan grafik](gambar/adm-61-rencana-aktual.png)

### 10.8 Menghentikan dan menutup

- **Status > Berhenti**: dihentikan sementara. Buka lagi dengan **Status > Re-terbuka**.
- **Status > Tutup**, lalu **Ya**: ditutup permanen. Perintah yang ditutup tidak bisa dilanjutkan.

![Menu Status: Berhenti, Re-terbuka, Tutup](gambar/adm-62-wo-status.png)

> **Catatan.** Admin tidak punya tombol **Selesai** dan **Catat Hasil**. Perintah selesai sendiri saat jumlah barang
> bagus di Input Harian sudah cukup.

---

## 11. Gudang harian dan surat jalan

![Beranda Stok untuk kegiatan gudang](gambar/adm-63-beranda-gudang.png)

### 11.1 Bahan masuk tanpa pesanan (Nota Penerimaan Barang)

1. **Stok > Mutasi Stok > + Tambah**.
2. **Jenis Entri Saham**: **Nota Penerimaan Barang**.
3. **Gudang Tujuan Bawaan**: Gudang Bahan Baku.
4. Di tabel **Item**: bahan, pigmen, kemasan, dan jumlahnya (Kg, gram, Buah).
5. **Simpan**. Lampirkan foto surat jalan pemasok. **Kirim**, **Ya**.

![Mutasi Stok jenis Nota Penerimaan Barang](gambar/adm-64-nota-penerimaan.png)

![Kartu Stok: Kuantitas Masuk setelah dikirim](gambar/adm-65-kartu-stok-masuk.png)

> **Penting.** Bahan, pigmen, dan kemasan harus ada stoknya di Gudang Bahan Baku. Tanpa itu, operator tidak bisa
> mencatat hasil produksi.

### 11.2 Pindah gudang (Transfer Barang)

1. **Stok > Mutasi Stok > + Tambah**, **Jenis Entri Saham**: **Transfer Barang**.
2. Isi **Gudang Sumber Bawaan** dan **Gudang Tujuan Bawaan**, misalnya Gudang Barang Jadi ke Gudang Pluit.
3. Isi barang dan jumlahnya. **Simpan**, **Kirim**, **Ya**. Tidak perlu foto.

![Mutasi Stok jenis Transfer Barang](gambar/adm-66-transfer-barang.png)

### 11.3 Surat Jalan

1. **Stok > Surat Jalan > + Tambah**. Pilih **Pelanggan**.
2. Isi barang dan jumlahnya di tabel **Item**.
3. **Tetapkan Gudang Sumber** (wajib): Gudang Barang Jadi atau Gudang Pluit. Semua baris ikut gudang ini.
4. **Simpan**, lalu **Kirim** dan **Ya** sebelum truk berangkat. Stok langsung berkurang.
5. Klik **ikon printer** untuk mencetak surat jalan.

![Surat Jalan: pelanggan, barang, Tetapkan Gudang Sumber](gambar/adm-67-surat-jalan.png)

Surat jalan boleh dikirim tanpa foto agar truk tidak menunggu. Setelah pelanggan menandatangani, lampirkan fotonya.
Selama belum ada, form menampilkan catatan oranye "Lampirkan surat jalan yang sudah ditandatangani."

![Catatan oranye surat jalan belum ditandatangani](gambar/adm-68-surat-jalan-ttd.png)

> **Peringatan.** Kalau stok tidak cukup, Kirim ditolak. Periksa stoknya dulu di Saldo Stok. Jangan memaksakan
> pengiriman.

---

## 12. Lampiran dan Dokumen Tanpa Lampiran

### 12.1 Dokumen yang wajib berfoto

| Dokumen | Foto yang dilampirkan | Kapan |
|---|---|---|
| Pesanan Penjualan | PO dari pelanggan | Sebelum Kirim |
| Faktur Penjualan | Faktur | Sebelum Kirim |
| Pesanan Pembelian | PO yang sudah dicap | Sebelum Kirim |
| Penerimaan Barang | Surat jalan pemasok | Sebelum Kirim |
| Faktur Pembelian | Faktur pemasok | Sebelum Kirim |
| Pembayaran | Bukti transfer | Sebelum Kirim |
| Mutasi Stok jenis Nota Penerimaan Barang | Surat jalan pemasok | Sebelum Kirim |
| Catatan Biaya jenis Sekali | Nota atau kuitansi | Sebelum Kirim |
| Surat Jalan | Surat jalan bertanda tangan pelanggan | **Sesudah** Kirim |

Tidak perlu foto: Hasil Produksi, Perintah Produksi, Resep, Transfer Barang, stok awal, dan stok opname.

> **Catatan.** Dokumen hasil Amendemen membawa lampirannya. Dokumen yang dibuat dari dokumen lain (misalnya Pesanan
> ke Surat Jalan) mulai tanpa lampiran.

### 12.2 Laporan Dokumen Tanpa Lampiran

**Stok > Dokumen Tanpa Lampiran** menampilkan dokumen yang sudah dikirim tetapi belum punya foto, terbaru di atas.

1. Klik dokumen di kolom **Dokumen**.
2. Lampirkan fotonya lewat **+** di samping **Lampiran**.
3. Kembali ke laporan dan segarkan. Dokumen itu hilang dari daftar.

![Laporan Dokumen Tanpa Lampiran](gambar/adm-69-dokumen-tanpa-lampiran.png)

Periksa laporan ini secara rutin, misalnya setiap Jumat.

---

## 13. Biaya dan Biaya Bulanan

Bagian ini hanya bisa dibuka Admin dan Super Admin.

### 13.1 Mencatat biaya

1. **Pembelian > Catatan Biaya > + Tambah Catatan Biaya**.
2. **Tanggal**, **Kategori** (Gaji Operator, Gaji Karyawan Tetap, Listrik, Bensin, Lainnya), **Jumlah** dalam rupiah.
3. **Ulang**: pilih salah satu (tabel di bawah).
4. **Simpan**. Untuk **Sekali**, lampirkan foto nota. **Kirim**, **Ya**.

![Catatan Biaya: kategori, jumlah, ulang](gambar/adm-70-catatan-biaya.png)

| Ulang | Dihitung di bulan | Foto |
|---|---|---|
| **Sekali** | Bulan tanggalnya saja | Wajib |
| **Tiap bulan** | Setiap bulan sejak bulan tanggalnya sampai bulan **Sampai** | Tidak |
| **Per shift mesin** | Jumlah dikali jumlah shift mesin sejak tanggalnya sampai **Sampai** | Tidak |

**Sampai** adalah hari terakhir biaya dihitung. Kosong berarti masih berjalan. Kategori baru ditambahkan lewat
**Kategori Biaya**. Kategori lama jangan dihapus.

### 13.2 Gaji operator per shift mesin

Gaji operator dicatat satu kali: Kategori **Gaji Operator**, Jumlah **105.000**, Ulang **Per shift mesin**, Tanggal =
hari produksi pertama.

Satu shift mesin = satu mesin yang punya hasil produksi pada satu tanggal dan satu shift. Dua perintah produksi di
mesin yang sama dalam shift yang sama tetap dihitung sekali.

![Catatan Biaya Gaji Operator per shift mesin](gambar/adm-71-gaji-operator.png)

### 13.3 Kenaikan gaji

Dua Gaji Operator per shift mesin tidak boleh tumpang tindih ("Akhiri dulu yang sebelumnya").

1. Buka catatan lama, isi **Sampai** dengan hari terakhir tarif lama, simpan.
2. Buat catatan baru dengan tarif baru, mulai hari berikutnya.

Bulan sebelumnya tetap memakai tarif lama.

### 13.4 Laporan Biaya Bulanan

1. **Pembelian > Biaya Bulanan**.
2. Pilih **Perusahaan** dan **Bulan** (tanggal mana saja di bulan itu).

Isi laporan:

- Satu baris untuk setiap kategori biaya.
- Di bawah Gaji Operator, satu baris menjorok per mesin: "... shift · ... hari 24 jam · ... hari 12 jam".
- Baris **Pigmen** dan **Kemasan** ("Dipakai produksi"): nilai yang dipakai produksi bulan itu, bukan yang dibeli.
- Baris **Total** paling bawah.

![Laporan Biaya Bulanan dengan rincian per mesin](gambar/adm-72-biaya-bulanan.png)

Kalau gaji operator belum dicatat untuk bulan itu, muncul pesan oranye dengan tautan **Tambah biaya Gaji Operator**.

---

## 14. Data Belum Lengkap

Aplikasi tetap berjalan walaupun data belum lengkap, tetapi sebagian perhitungan terlewat. Laporan **Pengaturan >
Data Belum Lengkap** mengumpulkan semuanya.

![Laporan Data Belum Lengkap](gambar/adm-73-data-belum-lengkap.png)

Kolomnya: **Pemeriksaan**, **Dokumen**, **Rincian**, **Cara membetulkan** (tautan tebal), dan **Akibatnya**.

| Pemeriksaan | Akibatnya | Tautan membuka |
|---|---|---|
| Kemasan belum diisi | Kemasan tidak terpakai, biayanya tidak dihitung | Form barang, langsung di tabel Packing |
| Pigmen warna ini belum ada | Pigmen tidak terpakai, biayanya tidak dihitung | Template PIGMEN dengan dialog varian, warna terisi |
| Harga jual belum ada | Baris pesanan mulai dari 0 | Harga Barang baru, barang dan daftar harga terisi |
| Biaya gaji operator belum ada | Gaji operator tidak masuk Biaya Bulanan | Catatan Biaya baru Gaji Operator |
| Kapasitas mesin belum ada | Semua mesin boleh, Rencana vs Aktual tanpa target | Kapasitas Mesin baru |
| Stok kosong | Pencatatan hasil produksi gagal | Pesanan Pembelian baru dengan barangnya |

1. Klik tautan tebal di kolom **Cara membetulkan**.
2. Form yang sesuai terbuka dan sudah terisi. Lengkapi, lalu **Simpan**.
3. Gunakan filter **Barang** untuk melihat satu barang beserta variannya.

![Form harga baru dari tautan Tambah harga jual](gambar/adm-74-tautan-perbaiki.png)

---

## 15. Siap Order dan rencana produksi bulanan

### 15.1 Siap Order (setiap Senin)

**Produksi > Siap Order**. Pilih **Perusahaan** dan bulan. Kosongkan **Gudang** agar stok dihitung dari Gudang Barang
Jadi ditambah Gudang Pluit.

| Kolom | Artinya |
|---|---|
| Stok | Stok sekarang (merah: habis, oranye: di bawah Stok Pengaman, hijau: aman) |
| Order Belum Dikirim | Pesanan yang belum dikirim |
| Perkiraan Bulan Ini | Angka perkiraan bulan ini |
| Sedang Diproduksi | Perintah produksi yang belum selesai |
| **Kurang** | Jumlah yang masih harus dibuat |
| **Mulai Paling Lambat** | Tanggal terakhir produksi harus dimulai |

![Laporan Siap Order dengan kolom Kurang dan Status](gambar/adm-75-siap-order.png)

| Status | Tindakan |
|---|---|
| **Telat** | Buat perintah produksi hari ini |
| **Mulai minggu ini** | Buat perintah produksi minggu ini |
| **Isi lama produksi** | Isi Lama Produksi Barang dulu (Bab 15.5) |
| **Terjadwal** | Masih ada waktu |
| **Aman** | Stok dan produksi cukup |

### 15.2 Perkiraan Penjualan

1. **Produksi > Perkiraan Penjualan > + Tambah Perkiraan Penjualan**.
2. **Perusahaan**, **Frekuensi** Bulanan, **Dari Tanggal** tanggal 1 bulan depan, jumlah periode 1, **Gudang tua**
   (gudang induk di atas lima gudang).
3. Pilih produk di **Item**, klik **Simpan**.
4. Klik **Isi dari Riwayat**. Angka diisi dari rata-rata tiga bulan terakhir. Produk tanpa riwayat diisi 0 dan
   disebut di pesan.
5. Isi angka produk tanpa riwayat, sesuaikan angka lain (promosi, pelanggan baru).
6. **Simpan**, **Kirim**, **Ya**.

![Perkiraan Penjualan setelah Isi dari Riwayat](gambar/adm-76-perkiraan.png)

### 15.3 Jadwal Produksi Induk

Di Perkiraan Penjualan yang sudah dikirim, klik **Buat > Jadwal Produksi Induk**. Pesanan terbuka bisa ikut dimasukkan
lewat tab **Order Penjualan** (**Dapatkan Pesanan Penjualan**, lalu **Dapatkan Permintaan Aktual**). Klik **Simpan**.

![Jadwal Produksi Induk, tab Order Penjualan](gambar/adm-77-jadwal-induk.png)

### 15.4 MRP: kebutuhan bahan

**Produksi > MRP**. Isi jadwal tadi dan **Gudang** induk. Laporan menampilkan barang yang harus dibuat dan bahan yang
harus dibeli per hari. Centang barisnya, lalu **Buat Pembelian / Perintah Kerja** untuk membuat dokumennya.

![Laporan MRP dengan tombol Buat Pembelian / Perintah Kerja](gambar/adm-78-mrp.png)

### 15.5 Lama Produksi Barang

1. **Produksi > Lama Produksi Barang > + Tambah Lama Produksi Barang**.
2. Pilih produk, isi kapasitas per hari (jumlah buah selesai sehari, semua mesin) dan **Waktu Buffer** (hari cadangan,
   misalnya 1).
3. **Simpan**. Siap Order kini bisa menghitung tanggal **Mulai Paling Lambat** untuk produk itu.

![Form Lama Produksi Barang](gambar/adm-79-lama-produksi.png)

**Urutan kerja setiap bulan:** Riwayat Penjualan, Perkiraan Penjualan, Jadwal Produksi Induk, MRP, lalu Perintah
Produksi.

---

## 16. SDM: karyawan, absen, dan cuti

> **Catatan.** Saat buku ini disusun, kantor masih memakai absen sidik jari. Bab ini disiapkan untuk saat SDM mulai
> dipakai.

### 16.1 Kartu halaman SDM

Beranda **SDM** punya delapan kartu: **Karyawan**, **Absen Masuk/Pulang**, **Kehadiran Hari Ini**, **Pengajuan Cuti
Baru**, **Jenis Shift**, **Jadwal Shift**, **Daftar Hari Libur**, dan **Jatah Cuti**. Bagian lain (rekrutmen,
penggajian, lembur) dikunci.

![Beranda SDM dengan delapan kartu](gambar/adm-80-beranda-sdm.png)

### 16.2 Karyawan baru

1. **Karyawan > + Tambah Karyawan**. Isi **Nama Depan**, **Jenis Kelamin**, **Tanggal Lahir**, **Tanggal Bergabung**.
   **Perusahaan** terisi sendiri.
2. Kalau karyawan punya akun aplikasi, pilih emailnya di **ID Pengguna** agar bisa absen lewat ponsel. **Simpan**.
3. **Jadwal Shift > + Tambah Jadwal Shift**: karyawannya, **Jenis Shift** Kantor, **Tanggal Mulai** hari pertamanya.
   **Simpan**, **Kirim**, **Ya**.
4. **Jatah Cuti > + Tambah Jatah Cuti**: jenis cuti Cuti Tahunan, 1 Januari sampai 31 Desember, 12 hari. **Simpan**,
   **Kirim**, **Ya**.

![Form karyawan baru](gambar/adm-81-karyawan-baru.png)

### 16.3 Jam kerja (Jenis Shift Kantor)

| Aturan | Nilai |
|---|---|
| Jam kerja | 08.00 sampai 17.00 |
| Terlambat | Absen masuk setelah 08.10 |
| Pulang cepat | Absen pulang sebelum 16.50 |
| Batas absen | Masuk mulai 07.00, pulang sampai 19.00 |

Jam shift Kantor dipasang ulang setiap aplikasi diperbarui. Jangan diubah manual. Kalau jam kantor berubah, hubungi
tim IT.

### 16.4 Absen dan kehadiran

- Karyawan absen lewat ponsel (alamat aplikasi ditambah `/hrms`, tombol **Check In** dan **Check Out**, dengan lokasi).
- Setiap absen tercatat di **Absen Masuk/Pulang**. Absen yang terlewat bisa ditambahkan petugas SDM di sana (**Tipe
  Log** IN atau OUT), pada hari yang sama.
- **Kehadiran** dibuat otomatis setiap jam. Hari kerja tanpa absen menjadi **Tidak Hadir**. Terlambat diberi tanda
  **Entri Terlambat**.

![Daftar Kehadiran dengan status dan tanda telat](gambar/adm-82-kehadiran.png)

### 16.5 Hari libur

Daftar hari libur dibuat otomatis setiap tahun (misalnya **Libur DA 2026**), berisi Sabtu dan Minggu. Libur nasional
dan cuti bersama diisi petugas SDM sesuai SKB tiga menteri:

1. Buka **Daftar Hari Libur**, buka daftar tahun itu.
2. Di tabel **Hari Libur**, klik **Tambah Baris**: **Tanggal** dan **Deskripsi** (misalnya "Idul Fitri").
3. **Simpan**.

Tombol **Get Local Holidays** bisa membantu, tetapi tetap cocokkan dengan SKB.

![Daftar Hari Libur dengan tabel Hari Libur](gambar/adm-83-hari-libur.png)

### 16.6 Pengajuan cuti

1. **Pengajuan Cuti Baru**: pilih karyawan, jenis cuti, tanggal mulai dan selesai, alasan. **Simpan**.
2. Setelah disetujui atasan, ubah **Status** menjadi **Disetujui**, lalu **Kirim** dan **Ya**.

| Jenis cuti | Keterangan |
|---|---|
| Cuti Tahunan | Memakai jatah 12 hari setahun |
| Sakit | Saat sakit |
| Izin | Keperluan pribadi, tidak dibayar |

Sabtu, Minggu, dan hari libur tidak mengurangi jatah. Kalau sisa jatah tidak cukup, pengajuan ditolak.

![Pengajuan cuti disetujui](gambar/adm-84-pengajuan-cuti.png)

**Setiap pagi:** buka Beranda SDM dan periksa kartu **Kehadiran Hari Ini**.

---

## 17. Membatalkan dan memperbaiki dokumen

1. Buka dokumen yang salah, klik **Batalkan**, lalu **Ya**. Stok dan catatan uang ikut dibatalkan.
2. Klik **Amendemen**. Salinan baru terbuka dengan lampirannya.
3. Perbaiki, lalu **Simpan**, **Kirim**, **Ya**.

![Tombol Batalkan dan Amendemen](gambar/adm-85-batalkan-amendemen.png)

> **Peringatan.** Kalau dokumen sudah punya dokumen lanjutan, batalkan mulai dari yang **terakhir**. Contoh
> penjualan: Pembayaran, lalu Faktur Penjualan, lalu Surat Jalan, lalu Pesanan Penjualan.

Hasil Produksi hanya bisa dibatalkan oleh akun Produksi (Manual Operator Bab 7).

---

## 18. Jadwal kerja Admin

| Kapan | Pekerjaan | Bab |
|---|---|---|
| Setiap pagi | Periksa Lantai Produksi dan Kehadiran Hari Ini | 10.5, 16.6 |
| Setiap ada PO | Pesanan Penjualan, lalu Perintah Produksi | 9, 10 |
| Setiap bahan datang | Penerimaan Barang atau Nota Penerimaan Barang | 8.6, 11.1 |
| Setiap kirim barang | Surat Jalan, lalu foto tanda tangan | 11.3 |
| Setiap ada biaya | Catatan Biaya | 13 |
| Setiap Senin | Siap Order | 15.1 |
| Setiap minggu | Dokumen Tanpa Lampiran, Data Belum Lengkap | 12, 14 |
| Setiap akhir bulan | Stok opname, Biaya Bulanan, rencana bulan depan | 7.4, 13.4, 15 |

---

## 19. Kalau ... maka ... (tanya jawab)

**Akun dan menu**

- **Kalau pengguna lupa sandi**, maka ganti sandinya di form pengguna (Bab 3.2) dan beri tahu langsung.
- **Kalau muncul "Anda tidak bisa memberi peran ini"**, maka Anda mencoba memberi peran selain Produksi atau Admin.
  Hubungi Super Admin.
- **Kalau pengguna baru tidak melihat menu yang benar**, maka periksa **Profil Peran** dan **Profil Modul**. Keduanya
  harus sama.
- **Kalau halaman pengaturan usaha tidak ada di menu**, maka itu wajar. Hanya Super Admin yang melihatnya.

**Barang, mesin, resep**

- **Kalau muncul "Baris ...: ... harus distok dalam satuan yang boleh pecahan"**, maka barang kemasannya bersatuan Pcs.
  Pakai barang kemasan bersatuan Buah.
- **Kalau muncul "Rasio pigmen harus lebih dari 0 g per kg."**, maka isi rasio, misalnya 1.
- **Kalau muncul "... harus barang stok dengan satuan Kg."** di Kapasitas Mesin, maka pilih bahan baku bersatuan Kg.
- **Kalau muncul "Isi bahan baris ini dulu sebelum membuat BOM."**, maka isi kolom **Bahan**.
- **Kalau impor Excel menulis Ditolak**, maka baca kolom **Alasan**, betulkan filenya, lalu Pratinjau lagi.
- **Kalau muncul "... bisa dibaca dua cara"** saat impor, maka tulis desimal dengan koma (`1,25`) atau tanpa titik
  (`1250`).

**Pembelian dan penjualan**

- **Kalau Kirim ditolak dengan "Lampirkan foto atau hasil scan dokumen aslinya sebelum diajukan."**, maka lampirkan
  fotonya dulu.
- **Kalau harga barang di pesanan 0**, maka barang belum ada di daftar harga. Klik **Tambah harga jual** di catatan
  oranye.
- **Kalau pesanan Seal Cap ditolak "pilih mesinnya, harganya ikut mesin"**, maka isi kolom **Mesin** di barisnya.
- **Kalau mengubah harga Seal Cap ditolak**, maka itu wajar. Harga Seal Cap mengikuti mesin.
- **Kalau Pembayaran tidak bisa disimpan karena rekening atau akun kas kosong**, maka minta Super Admin melengkapi akun
  kas dan bank perusahaan.

**Gudang dan produksi**

- **Kalau Kirim ditolak karena stok tidak cukup**, maka periksa Saldo Stok. Terima barangnya dulu, jangan dipaksa.
- **Kalau Surat Jalan tidak bisa disimpan**, maka isi **Tetapkan Gudang Sumber**.
- **Kalau operator melapor hasil produksi gagal dicatat karena stok**, maka terima bahan, pigmen, atau kemasan yang
  kurang di Gudang Bahan Baku (Bab 11.1).
- **Kalau muncul "... tidak dibuat di ... Mesin untuk barang ini: ..."**, maka pilih mesin dari daftar, atau tambah
  dulu baris Kapasitas Mesin.
- **Kalau muncul "... sedang tidak dipakai. Pilih mesin lain."**, maka mesin itu nonaktif. Pilih mesin lain atau
  aktifkan mesinnya.
- **Kalau muncul "Mesin hanya bisa diganti selama Work Order belum mulai atau sedang berjalan."**, maka perintah itu
  sudah selesai, dihentikan, atau ditutup.
- **Kalau perintah produksi tidak tampil di Lantai Produksi**, maka isi **Mesin** di perintahnya dan pastikan sudah
  dikirim.
- **Kalau operator tidak bisa membatalkan hasil karena perintah dihentikan**, maka buka dulu perintahnya dengan
  **Status > Re-terbuka**.
- **Kalau Siap Order menulis "Isi lama produksi"**, maka isi Lama Produksi Barang untuk produk itu.

**Biaya dan SDM**

- **Kalau muncul "Akhiri dulu yang sebelumnya"**, maka isi **Sampai** di Gaji Operator yang lama dulu.
- **Kalau Biaya Bulanan menulis "Gaji operator tidak dihitung di Biaya Bulanan."**, maka buat Catatan Biaya Gaji
  Operator per shift mesin.
- **Kalau pengajuan cuti ditolak karena jatah tidak cukup**, maka periksa Jatah Cuti karyawan itu.

---

## 20. Daftar istilah

| Istilah | Artinya |
|---|---|
| Amendemen | Salinan baru dari dokumen yang dibatalkan, untuk diperbaiki |
| Batalkan | Membatalkan dokumen yang sudah dikirim |
| BOM (Resep Produk) | Daftar bahan, pigmen, dan kemasan untuk membuat satu barang |
| Daftar Harga | Kumpulan harga: `Harga Pola` (jual), `Harga Bahan Baku` (beli) |
| Hasil Produksi | Catatan hasil satu mesin, satu shift, satu perintah produksi |
| Kapasitas Mesin | Kecepatan dan bahan satu produk di satu mesin |
| Kavitas | Jumlah buah per tembakan |
| Kirim | Mengesahkan dokumen. Stok dan uang baru tercatat |
| Lama Produksi Barang | Kapasitas harian dan hari cadangan satu produk |
| Mutasi Stok | Catatan pergerakan barang: masuk, pindah, keluar |
| MRP | Laporan kebutuhan bahan untuk rencana produksi |
| Nota Penerimaan Barang | Mutasi Stok untuk bahan masuk tanpa pesanan |
| Perintah Produksi | Perintah membuat sejumlah barang di satu mesin |
| Perkiraan Penjualan | Perkiraan jumlah terjual bulan depan |
| PO | Purchase Order: pesanan tertulis, dari pelanggan atau ke pemasok |
| Runner | Sisa plastik saluran cetakan per tembakan |
| Saldo Stok / Kartu Stok | Stok terkini / riwayat keluar masuk barang |
| Shift mesin | Satu mesin yang punya hasil pada satu tanggal dan satu shift |
| Siap Order | Laporan apakah pesanan bisa dikirim tepat waktu |
| Simpan | Menyimpan draf |
| Surat Jalan | Dokumen barang keluar ke pelanggan |
| Template / Varian | Barang induk / turunannya per jenis dan warna |
| Waktu siklus | Lama satu tembakan mesin, dalam detik |

---

## 21. Siapa yang dihubungi

| Keperluan | Hubungi |
|---|---|
| Pengaturan usaha, peran Super Admin, akun kas dan bank | Super Admin (tim IT): ..................................... |
| Aplikasi error, tidak bisa dibuka, semua akun terkunci | Tim IT: ..................................... |
| Keputusan harga, data barang, dan pelanggan | Pemilik: ..................................... |

Saat melapor, sebutkan versi aplikasi, halaman, langkah yang dilakukan, dan pesan yang muncul. Sertakan foto layar.

---

## Lampiran A: Super Admin

Super Admin punya seluruh akses Admin, ditambah fitur di bawah. Berikan peran ini hanya kepada tim IT.

### A.1 Halaman pengaturan usaha

Menu **Pengaturan** Super Admin memuat tujuh halaman: **Pengaturan Stok**, **Pengaturan Penjualan**, **Pengaturan
Pembelian**, **Pengaturan Manufaktur**, **Pengaturan Akun**, **Pengaturan Proyek**, dan **Pengaturan SDM**.

![Beranda Pengaturan Super Admin dengan tujuh halaman pengaturan](gambar/adm-86-sa-pengaturan.png)

Setelan yang sudah dipasang:

| Setelan | Nilai |
|---|---|
| Stok boleh minus | Tidak |
| Nilai stok | Masuk pertama keluar pertama (FIFO) |
| Penerimaan barang | Wajib dari pesanan pembelian |
| Produksi melebihi jumlah | Boleh sampai 10% |

![Pengaturan Stok: stok tidak boleh minus](gambar/adm-87-sa-pengaturan-stok.png)

> **Peringatan.** Setelan ini dipasang ulang setiap aplikasi diperbarui. Perubahan di layar bisa kembali seperti
> semula. Perubahan permanen dilakukan di kode aplikasi.

### A.2 Tombol Selesai di Perintah Produksi

Hanya Super Admin yang melihat tombol **Selesai** pada perintah produksi yang berjalan. Hasil lewat tombol ini tidak
masuk Input Harian dan Rencana vs Aktual. Pakai hanya untuk memperbaiki data. Hasil harian tetap dicatat di Input
Harian.

![Tombol Selesai pada perintah produksi](gambar/adm-88-sa-selesai.png)

### A.3 Kotak Sistem

Di layar Aplikasi (alamat `/desk`), kotak **Sistem** hanya untuk Super Admin. Isinya halaman **Build** dan **System
Settings** (zona waktu Asia/Jakarta, format tanggal, format angka, aturan sandi). Setelan ini juga dipasang ulang
setiap pembaruan.

![Kotak Sistem di layar Aplikasi](gambar/adm-89-sa-sistem.png)

### A.4 Modul yang dikunci

Modul yang tidak dipakai (CRM, Aset, Penggajian, dan lainnya) dikunci untuk semua peran, termasuk Super Admin. Modul
ini hanya bisa dibuka lewat kode aplikasi.

### A.5 Pengguna dan peran

- Petugas pabrik: **Produksi**. Pemilik dan kepala bagian: **Admin**. Tim IT: **Super Admin**.
- Isi **Profil Modul** sama dengan **Profil Peran**.
- Hanya Super Admin yang bisa memberi peran Super Admin dan mengubah akun Super Admin.
- Semua akun terkunci (termasuk Administrator): tim IT menjalankan `make akun` di server untuk memberi sandi baru.

![Pilihan Profil Peran: Produksi, Admin, Super Admin](gambar/adm-90-sa-profil-peran.png)

### A.6 Email

Aplikasi belum mengirim email. Selama itu, tombol yang butuh email disembunyikan. Begitu Super Admin memasang akun
email keluar sebagai bawaan, tombol tersebut muncul lagi.
