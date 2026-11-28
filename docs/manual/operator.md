---
judul: Manual Operator Produksi
aplikasi: ERP Internal PT Delta Anugrah
peran: Produksi
versi_aplikasi: v0.0.2
edisi: Draf 1, November 2026
---

# Manual Operator Produksi

**ERP Internal PT Delta Anugrah**

| | |
|---|---|
| Untuk | Operator dan petugas pabrik dengan akun **Produksi** |
| Versi aplikasi | v0.0.2 |
| Edisi | Draf 1, November 2026 |
| Disusun oleh | Tim ERP Internal |

> **Cara memakai buku ini.** Baca Bab 1 sampai 3 sekali sebelum mulai bekerja. Setelah itu, buka Bab 4 dan 5 setiap
> kali Anda perlu mencatat hasil produksi. Kalau ada masalah, lihat Bab 12 (Kalau ... maka ...).

---

## Daftar isi

1. [Mengenal aplikasi](#1-mengenal-aplikasi)
2. [Masuk, bahasa, dan sandi](#2-masuk-bahasa-dan-sandi)
3. [Tiga menu utama](#3-tiga-menu-utama)
4. [Lantai Produksi dan status mesin](#4-lantai-produksi-dan-status-mesin)
5. [Input Harian: mencatat hasil setiap shift](#5-input-harian-mencatat-hasil-setiap-shift)
6. [Mencatat reject lewat form Hasil Produksi](#6-mencatat-reject-lewat-form-hasil-produksi)
7. [Membatalkan dan memperbaiki (Batalkan dan Amendemen)](#7-membatalkan-dan-memperbaiki-batalkan-dan-amendemen)
8. [Cetak dan Excel rekap mingguan](#8-cetak-dan-excel-rekap-mingguan)
9. [Laporan Rencana vs Aktual](#9-laporan-rencana-vs-aktual)
10. [Membaca Perintah Produksi](#10-membaca-perintah-produksi)
11. [Memakai aplikasi di ponsel](#11-memakai-aplikasi-di-ponsel)
12. [Kalau ... maka ... (tanya jawab)](#12-kalau--maka--tanya-jawab)
13. [Daftar istilah](#13-daftar-istilah)
14. [Siapa yang dihubungi](#14-siapa-yang-dihubungi)

---

## 1. Mengenal aplikasi

Aplikasi ini menggantikan lembar Excel harian di pabrik. Dengan akun **Produksi**, Anda melakukan dua hal:

1. Menjaga **status mesin** di halaman **Lantai Produksi**.
2. Mencatat **hasil produksi** setiap shift di halaman **Input Harian**.

Semua hal lain, misalnya membuat perintah produksi, menambah barang, atau mengubah data mesin, dikerjakan oleh
**Admin**. Halaman lain yang Anda buka hanya untuk dilihat.

**Rutinitas setiap shift:**

| Kapan | Apa yang dilakukan | Di mana |
|---|---|---|
| Awal shift | Periksa status mesin, betulkan kalau salah | Lantai Produksi |
| Selama shift | Mesin rusak atau dirawat: ganti statusnya | Lantai Produksi |
| Akhir shift | Ketik jumlah barang bagus per perintah produksi | Input Harian |
| Ada reject | Catat reject beserta alasannya | Form Hasil Produksi |

> **Tips.** Anda tidak perlu menghafal semua tombol. Cukup ingat dua halaman: Lantai Produksi dan Input Harian.

---

## 2. Masuk, bahasa, dan sandi

### 2.1 Masuk ke aplikasi

1. Buka alamat aplikasi yang diberikan Admin di browser (Chrome disarankan).
2. Ketik **email** dan **sandi** yang diberikan Admin.
3. Klik **Continue**.

![Halaman masuk dengan kotak email dan sandi](gambar/op-01-login.png)

Tulisan kecil di bawah kotak masuk (misalnya `v0.0.2`) adalah **versi aplikasi**. Sebutkan versi ini setiap kali
Anda melaporkan masalah.

![Tulisan versi aplikasi di bawah kotak masuk](gambar/op-02-login-versi.png)

Setelah masuk, Anda melihat dua ikon: **ERP** dan **Lantai Produksi**. Klik **ERP** untuk membuka menu kerja.

![Layar Aplikasi dengan ikon ERP dan Lantai Produksi](gambar/op-03-layar-aplikasi.png)

> **Lupa sandi?** Halaman masuk menulis "Lupa password? Minta Admin untuk mengganti password Anda." Aplikasi belum
> mengirim email, jadi hubungi Admin. Admin akan memberi sandi baru secara langsung.

### 2.2 Mengganti bahasa

Tampilan awal bisa berbahasa Inggris. Untuk mengganti ke Bahasa Indonesia:

1. Klik **judul menu** di pojok kiri atas menu samping. Judul ini adalah nama bagian yang sedang terbuka, misalnya
   **Manufacturing** atau **Produksi**.
2. Pilih **Bahasa Indonesia**.
3. Halaman dimuat ulang. Menu dan tombol kini berbahasa Indonesia.

![Menu judul terbuka dengan pilihan Bahasa Indonesia](gambar/op-04-ganti-bahasa.png)

Untuk kembali ke bahasa Inggris, caranya sama. Pilihan di tempat yang sama kini bertuliskan **English**.

> **Catatan.** Buku ini memakai nama tombol dalam Bahasa Indonesia. Kalau layar Anda masih berbahasa Inggris,
> ganti bahasanya dulu.

### 2.3 Mengganti sandi

Ganti sandi dari Admin dengan sandi yang hanya Anda ketahui.

1. Klik **nama Anda** di pojok kiri bawah, lalu pilih **Pengaturan**.
2. Jendela Pengaturan terbuka di bagian **Profil**. Klik **Ubah Kata sandi**.
3. Ketik sandi baru di **Atur Kata Sandi Baru** (minimal 8 karakter).
4. Biarkan centang **Keluar dari semua perangkat setelah mengubah kata sandi**.
5. Klik **Ubah Kata sandi** sekali lagi.
6. Muncul tanda hijau "Kata sandi diubah".

![Jendela Pengaturan, bagian Profil](gambar/op-05-pengaturan-profil.png)

![Jendela kecil Ubah Kata sandi](gambar/op-06-ubah-sandi.png)

Perangkat yang sedang Anda pakai tetap masuk. Perangkat lain yang memakai akun Anda otomatis keluar.

> **Tips.** Versi aplikasi juga tertera di bagian bawah menu kiri jendela Pengaturan.

### 2.4 Keluar dari aplikasi

Klik **nama Anda** di pojok kiri bawah, lalu pilih **Keluar**. Lakukan ini kalau komputer dipakai bergantian.

> **Peringatan.** Jangan pernah memberikan sandi Anda kepada orang lain. Setiap angka yang Anda simpan tercatat
> atas nama akun Anda.

---

## 3. Tiga menu utama

Menu Anda ada di sisi kiri layar. Isinya hanya tiga:

| Menu | Gunanya |
|---|---|
| **Lantai Produksi** | Melihat semua mesin dan mengganti statusnya |
| **Input Harian** | Mencatat hasil produksi setiap shift |
| **Produksi** | Beranda dengan kartu: Perintah Produksi, Rencana vs Aktual, Kapasitas Mesin |

![Menu kiri akun Produksi](gambar/op-07-menu-kiri.png)

Klik judul **Produksi**, lalu **Beranda**, untuk membuka halaman depan Produksi. Setiap kartu memuat ikon, judul,
dan satu kalimat penjelasan. Klik kartu untuk membuka halamannya.

![Beranda Produksi dengan kartu-kartu](gambar/op-08-beranda-produksi.png)

**Yang hanya bisa dilihat:** Perintah Produksi, Kapasitas Mesin, dan data mesin. Anda tidak melihat tombol tambah
atau ubah di halaman tersebut.

![Kapasitas Mesin, semua kolom terkunci](gambar/op-09-kapasitas-lihat.png)

**Yang tidak tersedia:** menu Stok, Penjualan, Pembelian, dan SDM. Itu bukan bagian dari tugas operator. Kalau
Anda butuh perintah produksi baru, barang baru, atau perubahan data, sampaikan kepada Admin.

---

## 4. Lantai Produksi dan status mesin

### 4.1 Membuka Lantai Produksi

1. Klik **Lantai Produksi** di menu kiri.
2. Kartu "Memuat lantai produksi…" muncul sebentar.
3. Gambar 3D pabrik dengan empat belas mesin tampil.

![Lantai Produksi: gambar 3D empat belas mesin](gambar/op-10-lantai-produksi.png)

> **Catatan.** Kalau browser tidak bisa menampilkan gambar 3D, halaman menampilkan tabel biasa dengan isi yang sama.

### 4.2 Bagian-bagian layar

**Bar atas.** Berisi tombol panah kembali, logo dan nama perusahaan, jam, dan titik **Live**.

- Titik **Live** hijau: layar langsung berubah setiap ada perubahan status.
- Tulisan **Diperbarui** beserta jamnya: layar memperbarui diri setiap menit.

![Bar atas: nama perusahaan, jam, dan titik Live](gambar/op-11-bar-atas.png)

**Kartu angka.** Di bawah bar atas ada ringkasan pabrik: **Mesin**, **Berjalan** (utilisasi), **Masalah**,
**Perintah Produksi berjalan**, dan **Hasil** dibanding rencana.

![Deretan kartu angka](gambar/op-12-kartu-angka.png)

**Tabel mesin.** Di kiri atas ada daftar semua mesin. Klik satu baris, kamera langsung menuju mesin tersebut. Panah
di pojok tabel melipat dan membuka tabel.

![Tabel mesin di kiri atas](gambar/op-13-tabel-mesin.png)

**Kartu Perlu perhatian.** Di bawah tabel ada daftar mesin yang tidak sedang berproduksi, yang paling mendesak di
atas. Kalau semua mesin berjalan, tertulis **Semua mesin berjalan**.

![Kartu Perlu perhatian](gambar/op-14-perlu-perhatian.png)

> **Catatan.** Orang, barang yang jatuh, dan isi tong hanyalah animasi. Tulisan "Operator dan komponen adalah
> simulasi" mengingatkan hal ini. Data yang sebenarnya hanya status mesin, perintah produksi, dan angka pada kartu.

### 4.3 Arti warna lampu mesin

| Status (tombol) | Lampu | Artinya |
|---|---|---|
| **Produksi** | Hijau | Mesin berjalan dan membuat barang |
| **Pengaturan** | Kuning berkedip pelan | Mesin sedang disiapkan, misalnya ganti cetakan |
| **Menganggur** | Kuning diam, mesin lebih redup | Mesin siap, tetapi tidak berjalan |
| **Masalah** | Merah berkedip | Mesin rusak dan berhenti |
| **Pemeliharaan** | Biru, mesin lebih gelap | Mesin sedang diperbaiki atau dirawat |
| **Mati** | Abu-abu, gelap | Mesin dimatikan |

Cincin di lantai sekitar mesin ikut berwarna sesuai statusnya.

![Contoh lampu hijau, merah, dan abu-abu di lantai](gambar/op-15-warna-lampu.png)

### 4.4 Mengganti status mesin

1. Klik mesinnya di gambar, atau klik barisnya di tabel mesin.
2. Panel kanan terbuka: nama mesin, merek, perintah produksi yang berjalan, dan enam tombol status.
3. Klik tombol status yang sesuai, misalnya **Masalah**.
4. Lampu mesin berubah. Semua pengguna langsung melihat perubahan ini.
5. Klik **Tutup** untuk menutup panel.

![Panel kanan dengan enam tombol status](gambar/op-16-panel-status.png)

![Mesin berstatus Masalah, lampu merah](gambar/op-17-status-masalah.png)

Setelah mesin berjalan kembali, buka panelnya lagi dan klik **Produksi**. Lampu kembali hijau.

> **Penting.** Selalu kembalikan status ke **Produksi** setelah masalah selesai. Status yang salah membuat laporan
> dan Admin salah membaca kondisi pabrik.

### 4.5 Mesin yang tidak aktif

Beberapa mesin sedang tidak dipakai (saat ini Mesin 01, 07, dan 09 sampai 13). Mesin ini selalu tampil **Mati**
dan menolak perubahan status. Panel menulis catatan, misalnya:

"Mesin 01 tidak aktif. Admin bisa mengaktifkannya di Workstation-nya."

![Catatan mesin tidak aktif di panel](gambar/op-18-mesin-tidak-aktif.png)

Kalau mesin itu akan dipakai lagi, minta Admin mengaktifkannya.

### 4.6 Tautan di panel

- **Tautan perintah produksi**: membuka perintah produksi yang sedang berjalan di mesin itu (hanya dilihat).
- **Buka mesin**: membuka data mesin (hanya dilihat).

### 4.7 Melihat dari sudut lain

| Gerakan | Hasilnya |
|---|---|
| Tarik dengan mouse | Memutar tampilan |
| Gulir (scroll) | Memperbesar atau memperkecil |
| Klik kanan lalu tarik | Menggeser tampilan |
| Tombol **+** dan **−** (kanan bawah) | Memperbesar dan memperkecil |
| Tombol rumah (kanan bawah) | Kembali ke tampilan awal |

![Tombol +, −, dan rumah di pojok kanan bawah](gambar/op-19-tombol-kamera.png)

Untuk keluar dari Lantai Produksi, klik **tombol panah kembali** di pojok kiri atas.

---

## 5. Input Harian: mencatat hasil setiap shift

### 5.1 Mengenal lembar Input Harian

Klik **Input Harian** di menu kiri. Bentuknya menyerupai lembar Excel harian yang biasa Anda isi.

- **Satu kotak** = satu perintah produksi.
- **Satu baris** = satu tanggal.
- **Kolom Shift 1** (pukul 08.00 sampai 20.00) dan **kolom Shift 2** (pukul 20.00 sampai 08.00).
- Baris **TOTAL** berwarna hijau di bawah setiap kotak.

![Lembar Input Harian satu minggu](gambar/op-20-input-harian.png)

Bagian atas setiap kotak berisi **No.Po.** (nomor pesanan pelanggan, atau nomor perintah produksi), barang, Merk,
Warna, Packing, dan mesin (sel merah muda di kanan). Kotak perintah produksi yang sudah selesai diberi tanda kuning
**CLOSE/DONE**.

![Kepala satu kotak perintah produksi](gambar/op-21-kepala-kotak.png)

> **Penting.** Shift 2 dicatat pada **tanggal malam itu dimulai**. Contoh: Shift 2 yang mulai Senin pukul 20.00 dan
> selesai Selasa pukul 08.00 dicatat di baris **Senin**.

### 5.2 Pindah minggu dan saring mesin

- Tombol **‹** dan **›**: pindah ke minggu sebelumnya atau berikutnya.
- Tombol **Minggu ini**: kembali ke minggu berjalan.
- Filter mesin: tampilkan kotak satu mesin saja. Pilih **Semua mesin** untuk melihat semua lagi.

![Tombol minggu dan filter mesin](gambar/op-22-minggu-filter.png)

### 5.3 Mengisi nama teknisi

1. Klik kotak **Teknisi Pagi**, hapus isinya, ketik nama teknisi Shift 1.
2. Klik kotak **Teknisi Malam**, ketik nama teknisi Shift 2.

Nama ini tersimpan pada setiap angka yang Anda ketik setelahnya. Kotak teknisi terisi nama terakhir yang dipakai;
ganti hanya kalau orangnya berbeda.

![Kotak Tanggal, Teknisi Pagi, dan Teknisi Malam](gambar/op-23-teknisi.png)

### 5.4 Mengetik jumlah barang bagus

1. Cari kotak perintah produksi yang benar (lihat nomor, barang, dan mesinnya).
2. Di baris tanggal hari ini, klik sel **Shift 1** atau **Shift 2**.
3. Ketik **jumlah barang bagus**. Boleh memakai titik ribuan, misalnya `1.250` atau `13.384`.
4. Tekan **Enter** atau **Tab**.
5. Angka langsung tersimpan saat Anda pindah kotak. **TOTAL** ikut bertambah.

![Mengetik 1.250 di sel Shift 1](gambar/op-24-ketik-angka.png)

![TOTAL bertambah setelah angka tersimpan](gambar/op-25-total-naik.png)

> **Peringatan.** Ketik angka bulat saja. Jangan memakai koma atau tanda minus. Isi hanya barang **bagus**. Reject
> dicatat terpisah (Bab 6).

> **Tips.** Setelah Anda menyimpan angka, stok barang jadi dan pemakaian bahan bergerak sendiri. Anda tidak perlu
> mencatat apa pun di gudang.

### 5.5 Mengisi Keterangan

Kejadian penting (ganti cetakan, mesin berhenti, bahan telat) ditulis di kolom **Keterangan**.

1. Klik kolom **Keterangan** pada baris tanggal itu.
2. Ketik keterangannya, misalnya "Ganti cetakan jam 10".
3. Tekan **Enter**.

![Kolom Keterangan berisi catatan kejadian](gambar/op-26-keterangan.png)

> **Catatan.** Keterangan hanya bisa disimpan pada tanggal yang sudah berisi angka. Isi angkanya dulu.

### 5.6 Mencatat hari sebelumnya

Kalau Anda lupa mencatat hasil kemarin:

1. Klik **+ Tambah tanggal** di kotak perintah produksinya.
2. Pilih tanggalnya di kalender.
3. Baris baru muncul. Isi Shift 1 atau Shift 2 seperti biasa.

![Tombol + Tambah tanggal dan kalender](gambar/op-27-tambah-tanggal.png)

Tanggal tidak boleh di masa depan dan tidak boleh sebelum perintah produksi dibuat.

### 5.7 Mengganti atau menghapus angka

- **Salah ketik:** klik selnya, ketik angka yang benar, tekan Enter. Hasil lama dibatalkan otomatis dan diganti.
- **Tidak jadi:** kosongkan selnya (atau ketik `0`), tekan Enter. Hasil di sel itu dibatalkan.

![Mengganti angka di sel yang sudah terisi](gambar/op-28-ganti-angka.png)

> **Catatan.** Angka pada perintah produksi yang sudah **CLOSE/DONE** masih bisa diganti. Perintahnya akan kembali
> berjalan sampai jumlahnya cukup lagi. Tanggal baru tidak bisa ditambahkan di kotak yang sudah selesai.

### 5.8 Angka bergaris bawah

Angka yang bergaris bawah tidak bisa diketik langsung. Angka ini dicatat lewat form **Hasil Produksi**, biasanya
karena ada reject, ada lebih dari satu catatan di sel itu, atau jam jalan mesin berbeda dari panjang shift.

1. Klik angka bergaris bawah itu.
2. Form **Hasil Produksi** terbuka.
3. Perbaiki lewat form tersebut (Bab 7).

![Angka bergaris bawah di Input Harian](gambar/op-29-angka-garis-bawah.png)

### 5.9 Kalau angka ditolak

Kalau angka ditolak, pesan merah muncul di bawah selnya dan angka yang Anda ketik tetap ada. Baca pesannya. Penyebab
yang paling sering ada di Bab 12.

![Pesan merah di bawah sel yang ditolak](gambar/op-30-pesan-tolak.png)

---

## 6. Mencatat reject lewat form Hasil Produksi

Reject (barang cacat) tidak dicatat di Input Harian. Reject dicatat lewat form **Hasil Produksi**, satu form untuk
satu mesin, satu shift, dan satu perintah produksi.

> **Penting: jangan mencatat barang bagus dua kali.**
> Barang bagus selalu diketik di Input Harian. Di form ini isi **Jumlah Bagus** dengan `0`, lalu isi rejectnya saja.

### 6.1 Membuka form Hasil Produksi baru

Form ini tidak ada di menu. Bukalah lewat alamatnya:

1. Di kolom alamat browser, ketik alamat aplikasi diikuti `/desk/production-entry`, lalu tekan Enter.
2. Klik **+ Tambah Hasil Produksi**.

![Daftar Hasil Produksi dengan tombol tambah](gambar/op-31-hasil-produksi-daftar.png)

### 6.2 Mengisi form

1. **Perintah Produksi**: pilih perintah produksinya. **Mesin** terisi sendiri.
2. **Tanggal**: tanggal shift itu (tidak boleh besok).
3. **Shift**: pilih **Shift 1** atau **Shift 2**.
4. **Jam Jalan**: terisi 12 jam. Kurangi kalau mesin hanya berjalan sebagian waktu.
5. **Jumlah Bagus**: ketik `0` (barang bagus sudah diketik di Input Harian).
6. Di tabel **Reject**, satu baris untuk setiap alasan:
   - Klik **Tambah Baris** (atau pakai baris kosong yang sudah ada).
   - **Alasan**: pilih salah satu, misalnya Short Shot, Flashing, Belang / Warna, Pecah / Retak, Bubble, Sink Mark,
     atau Lainnya.
   - Isi jumlahnya, misalnya `35`.
7. **Jumlah Reject** dihitung sendiri dari semua baris.

![Form Hasil Produksi: perintah, mesin, tanggal, shift, jam jalan](gambar/op-32-form-hasil-atas.png)

![Tabel Reject dengan pilihan Alasan](gambar/op-33-tabel-reject.png)

> **Peringatan.** Jangan biarkan baris reject kosong atau berisi `0`. Hapus baris yang tidak dipakai, karena form
> tidak bisa disimpan dengan baris seperti itu.

### 6.3 Simpan dan Kirim

1. Klik **Simpan**.
2. Klik **Kirim**, lalu jawab **Ya**.

![Form Hasil Produksi setelah dikirim, status Dikirim](gambar/op-34-hasil-terkirim.png)

Saat dikirim, stok bergerak sendiri:

| Yang terjadi | Ke mana |
|---|---|
| Barang bagus | Gudang Barang Jadi, dihitung ke perintah produksi |
| Barang reject | Gudang Reject, **tidak** dihitung ke perintah produksi |
| Bahan, pigmen, kemasan | Keluar dari gudang bahan sesuai resep (reject tidak memakai kemasan) |

Perintah produksi baru selesai kalau jumlah barang **bagus** sudah cukup. Reject tidak ikut dihitung.

---

## 7. Membatalkan dan memperbaiki (Batalkan dan Amendemen)

Hasil Produksi yang sudah dikirim tidak bisa diubah langsung. Caranya:

1. Buka Hasil Produksi yang salah (misalnya dengan mengklik angka bergaris bawah di Input Harian).
2. Klik **Batalkan**, lalu jawab **Ya**. Stok ikut dikembalikan.
3. Klik **Amendemen**. Salinan baru terbuka.
4. Perbaiki isinya, klik **Simpan**, lalu **Kirim** dan **Ya**.

![Tombol Batalkan pada Hasil Produksi yang sudah dikirim](gambar/op-35-batalkan.png)

![Tombol Amendemen setelah dibatalkan](gambar/op-36-amendemen.png)

> **Catatan.** Kalau perintah produksinya sedang **dihentikan** oleh Admin, hasilnya tidak bisa dibatalkan. Minta
> Admin membuka kembali perintah tersebut.

---

## 8. Cetak dan Excel rekap mingguan

Di bagian atas Input Harian ada dua tombol:

- **Cetak**: membuka rekap minggu yang tampil di jendela baru, ukuran A4 mendatar, lalu jendela cetak muncul.
- **Excel**: mengunduh file `input-harian-<dari>-<sampai>.xlsx` dengan susunan seperti lembar Excel lama.

![Tombol Cetak dan Excel di atas Input Harian](gambar/op-37-cetak-excel.png)

![Halaman cetak rekap mingguan A4 mendatar](gambar/op-38-halaman-cetak.png)

Isinya selalu semua mesin pada minggu itu, meskipun filter mesin sedang dipilih.

> **Tips.** Kalau jendela cetak tidak muncul, browser memblokir pop-up. Izinkan pop-up untuk situs aplikasi, lalu
> klik **Cetak** lagi.

---

## 9. Laporan Rencana vs Aktual

Laporan ini membandingkan target dengan hasil yang dicatat.

1. Klik judul **Produksi**, lalu **Beranda**, lalu kartu **Rencana vs Aktual**.
2. Filter **Dari Tanggal** dan **Sampai Tanggal** otomatis tujuh hari terakhir sampai kemarin.
3. **Mesin**, **Barang**, dan **Shift** boleh dikosongkan atau diisi untuk menyaring.
4. **Kelompokkan per** mengatur susunan baris: Mesin, Mesin + Hari, Hari, Barang, Perintah Produksi, atau Shift.
5. **Target dari** memilih sumber target: dari perintah produksi, atau dari Kapasitas mesin.

![Filter laporan Rencana vs Aktual](gambar/op-39-rva-filter.png)

| Kolom | Artinya |
|---|---|
| Target | Rencana |
| Bagus | Jumlah barang bagus yang dicatat |
| Reject | Jumlah reject yang dicatat |
| Reject % | Reject dibagi (bagus + reject) |
| Tercapai % | Bagus dibagi target |
| (nama alasan) | Satu kolom untuk setiap alasan reject |

Warna **Tercapai %**:

- **Hijau**: 100% atau lebih, target tercapai.
- **Oranye**: 85% sampai di bawah 100%, hampir tercapai.
- **Merah**: di bawah 85%, masih jauh dari target.

![Kolom Tercapai % berwarna hijau, oranye, dan merah](gambar/op-40-rva-warna.png)

> **Catatan.** Tulisan **Tanpa kapasitas** berarti barang itu belum punya data kecepatan mesin, jadi tidak punya
> target. Beri tahu Admin.

---

## 10. Membaca Perintah Produksi

Perintah Produksi adalah perintah dari Admin untuk membuat sejumlah barang di satu mesin.

1. Klik judul **Produksi**, lalu **Beranda**, lalu kartu **Perintah Produksi Berjalan**.
2. Buka satu perintah.

Yang perlu Anda baca:

| Bagian | Artinya |
|---|---|
| Status | Belum mulai, berjalan, selesai, dihentikan, atau ditutup |
| Barang | Barang yang dibuat |
| Jumlah | Jumlah yang harus dibuat |
| Jumlah yang sudah dibuat | Barang bagus yang sudah tercatat |
| **Mesin** | Mesin tempat barang ini dibuat |

![Perintah Produksi: status, jumlah, dan mesin](gambar/op-41-perintah-produksi.png)

**Catatan oranye** di atas form berarti data barangnya belum lengkap, misalnya kemasan atau pigmen belum diisi. Beri
tahu Admin.

**Tombol Catat Hasil** membuka Input Harian langsung di kotak perintah itu. Klik **Tampilkan semua** untuk melihat
semua kotak lagi.

![Tombol Catat Hasil di Perintah Produksi](gambar/op-42-catat-hasil.png)

> **Catatan.** Anda tidak melihat harga bahan di perintah produksi. Ini memang disembunyikan, bukan kesalahan.

---

## 11. Memakai aplikasi di ponsel

Input Harian bisa dipakai di ponsel.

1. Buka alamat aplikasi di Chrome (Android) atau Safari (iPhone).
2. Masuk seperti biasa, buka **Input Harian**.
3. Di layar sempit, kolom **Merk** dan **Warna** disembunyikan agar Shift 1 dan Shift 2 tetap muat.

![Input Harian di layar ponsel](gambar/op-43-ponsel-input.png)

Di ponsel, panel mesin di Lantai Produksi tampil sebagai lembar dari bawah layar, dan tabel mesin serta kartu Perlu
perhatian terlipat. Ketuk judulnya untuk membuka.

> **Tips.** Kalau tabel terlalu lebar, geser tabelnya ke samping dengan jari.

---

## 12. Kalau ... maka ... (tanya jawab)

**Masuk dan akun**

- **Kalau lupa sandi**, maka hubungi Admin. Admin memberi sandi baru secara langsung.
- **Kalau muncul "Sesi kamu mungkin sudah berakhir: masuk lagi."**, maka masuk lagi dengan email dan sandi Anda.
- **Kalau tampilan berbahasa Inggris**, maka klik judul menu di pojok kiri atas dan pilih **Bahasa Indonesia**.

**Lantai Produksi**

- **Kalau tombol status menolak dengan catatan "... tidak aktif"**, maka mesin itu sedang tidak dipakai. Minta Admin
  mengaktifkannya.
- **Kalau muncul "Status tidak dapat diubah." atau "Server tidak dapat dihubungi. Coba lagi."**, maka periksa
  koneksi internet, lalu coba lagi.
- **Kalau Lantai Produksi lama sekali memuat**, maka tutup tab lain dan program yang tidak dipakai, lalu muat ulang
  halaman.
- **Kalau perintah produksi tidak tampil di mesinnya**, maka mesin di perintah itu belum diisi. Beri tahu Admin.

**Input Harian**

- **Kalau muncul "Belum ada mesin: Admin mengisinya di Work Order."**, maka minta Admin mengisi mesin di perintah
  produksinya.
- **Kalau muncul "Isi jumlah pcs utuh, misalnya 13.384."**, maka hapus koma atau tanda minus, ketik angka bulat.
- **Kalau muncul "Tanggalnya tidak boleh sebelum Work Order dibuat"**, maka pilih tanggal yang benar, atau tanya Admin.
- **Kalau muncul "Isi angkanya dulu: keterangan butuh entri untuk disimpan."**, maka isi jumlah bagus dulu, baru
  keterangannya.
- **Kalau muncul "Angka bergaris bawah dicatat lewat form Production Entry: ubah di sana."**, maka klik angkanya dan
  perbaiki di form Hasil Produksi.
- **Kalau angka ditolak karena perintah produksi sudah dihentikan atau ditutup**, maka hubungi Admin.
- **Kalau angka ditolak karena melebihi jumlah yang boleh dibuat**, maka periksa angkanya. Perintah produksi boleh
  lebih paling banyak 10%. Kalau memang lebih, beri tahu Admin.
- **Kalau muncul "Tidak ada koneksi: coba lagi."**, maka angka belum tersimpan. Tunggu koneksi kembali, lalu tekan
  Enter lagi di sel itu.
- **Kalau tidak ada kotak isian sama sekali**, maka pastikan Anda masuk dengan akun Produksi.

**Hasil Produksi dan reject**

- **Kalau Kirim ditolak karena stok bahan, pigmen, atau kemasan kurang**, maka tidak ada stok yang berubah. Beri tahu
  Admin agar bahan diterima dulu di Gudang Bahan Baku.
- **Kalau muncul "Perintah Produksi ... jalan di ... Ganti dulu mesin di Perintah Produksi."**, maka mesin di form
  berbeda dengan mesin di perintah. Minta Admin memindahkan mesinnya.
- **Kalau muncul "Isi jumlah bagus atau minimal satu reject."**, maka isi salah satunya.
- **Kalau muncul "Baris ...: jumlah reject harus lebih dari 0."**, maka isi jumlahnya atau hapus baris itu.
- **Kalau muncul "Jam jalan harus lebih dari 0 dan paling banyak 24."**, maka betulkan **Jam Jalan**.
- **Kalau muncul "Buka lagi dulu Perintah Produksi ..."**, maka perintah itu dihentikan. Minta Admin membukanya kembali.
- **Kalau alasan reject yang dibutuhkan tidak ada**, maka minta Admin menambahkannya. Sementara itu pakai **Lainnya**
  dan tulis penjelasannya di **Catatan**.

**Cetak**

- **Kalau muncul "Izinkan pop-up untuk situs ini agar bisa mencetak."**, maka izinkan pop-up di browser, lalu klik
  **Cetak** lagi.

---

## 13. Daftar istilah

| Istilah | Artinya |
|---|---|
| Amendemen | Membuat salinan baru dari dokumen yang sudah dibatalkan, untuk diperbaiki |
| Batalkan | Membatalkan dokumen yang sudah dikirim. Stok ikut kembali |
| Cavity / Kavitas | Jumlah buah yang dihasilkan dalam satu tembakan mesin |
| CLOSE/DONE | Tanda kuning: perintah produksi sudah selesai |
| Hasil Produksi | Catatan hasil satu mesin, satu shift, satu perintah produksi |
| Input Harian | Lembar mingguan untuk mencatat barang bagus per shift |
| Jam Jalan | Lama mesin berjalan dalam satu shift (bawaan 12 jam) |
| Kapasitas Mesin | Kecepatan satu mesin membuat satu produk |
| Kirim | Mengesahkan dokumen. Setelah dikirim, stok bergerak |
| Lantai Produksi | Gambar 3D semua mesin dan statusnya |
| No.Po. | Nomor pesanan pelanggan (atau nomor perintah produksi) |
| Perintah Produksi | Perintah Admin untuk membuat sejumlah barang di satu mesin |
| Reject | Barang cacat. Masuk Gudang Reject dan tidak dihitung ke perintah |
| Rencana vs Aktual | Laporan target dibanding hasil |
| Shift 1 / Shift 2 | Pukul 08.00 sampai 20.00 / pukul 20.00 sampai 08.00 |
| Simpan | Menyimpan dokumen sebagai draf. Stok belum bergerak |
| Teknisi | Orang yang menjalankan mesin di shift itu |
| Waktu siklus | Lama satu kali tembakan mesin, dalam detik |

---

## 14. Siapa yang dihubungi

| Keperluan | Hubungi |
|---|---|
| Lupa sandi, akun terkunci | Admin pabrik: ..................................... |
| Perintah produksi baru atau salah | Admin pabrik |
| Mesin perlu diaktifkan atau dipindah | Admin pabrik |
| Bahan, pigmen, atau kemasan habis | Admin pabrik |
| Aplikasi error atau tidak bisa dibuka | Tim IT (Super Admin): ..................................... |

Saat melapor, sebutkan: **versi aplikasi**, halaman yang dibuka, apa yang Anda klik, dan pesan yang muncul. Foto
layar sangat membantu.
