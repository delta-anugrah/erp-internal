# Video Lengkap A3: Mesin dan Resep

- **Untuk siapa:** Admin baru yang memulai dari awal. Isi: mesin, kapasitas mesin per produk, resep produk (BOM) yang dibuat dari kapasitas, impor dari Excel, dan penguncian mesin pada Perintah Produksi.
- **Durasi target:** sekitar 5 menit 30 detik.
- **Login:** `admin@example.com` (Ayu Lestari, peran Admin), sandi akun contoh.
- **Data yang harus ada sebelum rekam:**
  - Data contoh (`buat_contoh`) dan data barang asli (`master.muat`, `penjualan.muat`, `mesin_barang.muat`) sudah dimuat, sehingga tersedia Workstation Mesin 01 sampai 14 (Mesin 01, 07, 09 sampai 13 nonaktif) dan baris Kapasitas Mesin Seal Cap di Mesin 04 dan 14.
  - Satu file Excel kapasitas di komputer. Saran: file kecil berisi baris Seal Cap yang sudah ada (Produk "Seal Cap", Mesin 04, Cycle Time 14, Cavity 20, Berat 0,88, Runner 0, Bahan BB-SEAL-CAP), agar hasilnya **Tidak berubah** dan tidak ada data baru. Contoh lain: `erp_internal/tests/data/kapasitas.xlsx`.
- **Bahasa tampilan:** Indonesia.
- **Bab (daftar isi):** Data mesin (baris 3), Mesin nonaktif (baris 5), Kapasitas Mesin (baris 7), Membuat resep (baris 13), Isi resep (baris 14), Impor dari Excel (baris 17), Mesin pada Perintah Produksi (baris 21).

| No | Detik | Di layar | Teks layar | Narasi |
|---|---|---|---|---|
| 1 | 0 | Halaman depan sudah login sebagai Ayu. Buka judul **Produksi**. | Mesin dan resep produk | Video ini membahas pengaturan mesin dan resep produk. Keduanya menentukan barang yang dibuat di setiap mesin dan bahan yang digunakan. |
| 2 | 14 | Kartu daftar isi: judul tiap bagian dengan menit mulainya (dibuat otomatis setelah rekam). | Daftar isi | Berikut daftar isi video ini. Anda dapat langsung melompat ke bagian yang Anda perlukan. |
| 3 | 22 | Buka daftar **Stasiun Kerja** (lewat pencarian atau dari Lantai Produksi, tombol **Buka mesin**). Tampil Mesin 01 sampai Mesin 14. | 14 mesin: Mesin 01 sampai 14 | Pabrik memiliki empat belas mesin injeksi, mulai dari Mesin nol satu hingga Mesin empat belas. |
| 4 | 36 | Buka **Mesin 04**. Zoom ke **No. Mesin**, **Merek Mesin**, **Model Mesin**, **Daya Jepit (Ton)**, **Tahun Buat**, **Buatan**. | Data setiap mesin | Setiap mesin memiliki nomor urut di lantai pabrik, merek, model, daya jepit, dan tahun pembuatan. |
| 5 | 52 | Buka **Mesin 07**. Zoom ke centang **Dinonaktifkan** dan status Off. | Mesin nonaktif tidak dapat digunakan | Mesin yang tidak digunakan diberi centang Dinonaktifkan. Mesin tersebut tidak dapat dipilih untuk perintah produksi baru dan tampil mati di lantai produksi. |
| 6 | 70 | Tunjuk centang **Dinonaktifkan**, jangan diubah. Lalu tunjuk tombol **Simpan**, jangan diklik. | Aktifkan kembali: hapus centang Dinonaktifkan | Apabila mesin akan digunakan kembali, hapus centang Dinonaktifkan. Lalu klik Simpan. |
| 7 | 82 | Di menu **Produksi**, klik **Kapasitas Mesin**. Daftar baris kapasitas terbuka. | Kapasitas Mesin: kecepatan dan bahan per mesin | Kapasitas Mesin mencatat kecepatan satu mesin dalam membuat satu produk, beserta bahan yang digunakan. |
| 8 | 96 | Buka baris Seal Cap di **Mesin 04**. Zoom ke **Barang** dan **Mesin**. | Satu baris untuk satu produk di satu mesin | Satu baris berlaku untuk satu produk di satu mesin. Apabila barangnya berupa template, baris ini berlaku untuk seluruh variannya. |
| 9 | 112 | Zoom ke **Waktu Siklus (detik)** 14, lalu ke **Kavitas** 20. | Waktu siklus dan kavitas | Waktu siklus adalah lama satu kali tembakan dalam detik. Kavitas adalah jumlah buah yang dihasilkan dalam satu tembakan. |
| 10 | 128 | Zoom ke **Berat Produk (g)** 0,88, **Berat Runner (g)** 0, **Runner Digiling**, lalu ke **Bahan** BB-SEAL-CAP, **Masterbatch** dan **Masterbatch %**. | Berat, runner, dan bahan | Berikutnya adalah berat satu buah dalam gram, berat runner per tembakan, dan bahan baku. Bahan harus berupa barang stok dengan satuan kilogram. |
| 11 | 148 | Zoom ke bagian **Hasil hitungan**: **Pcs per Jam** dan **Bahan per Pcs (g)**. | Jumlah pieces (pcs) per jam dihitung otomatis | Dari angka tersebut, sistem menghitung jumlah buah per jam secara otomatis, yaitu sekitar lima ribu seratus buah, serta bahan per buah. |
| 12 | 166 | Teks di tengah layar. | Digunakan untuk target dan resep | Jumlah buah per jam menjadi target pada laporan Rencana versus Aktual. Baris ini juga menjadi sumber resep produk. |
| 13 | 180 | Klik tombol **Buat BOM**. Zoom ke pesan "BOM dibuat: ..., tetap: ..., dinonaktifkan: ...". | Resep Bill of Materials (BOM) dibuat dari baris ini | Klik tombol Buat Bill of Materials. Sistem membuat satu resep untuk setiap varian di mesin ini, dan resep yang sudah sesuai tidak diubah. |
| 14 | 198 | Di menu **Produksi**, klik **Resep Produk (BOM)**. Buka satu BOM Seal Cap. Zoom ke kolom **Mesin** dan tabel **Item**. | Isi resep: bahan, pigmen, dan kemasan | Berikut isi resepnya, yaitu bahan baku, pigmen sesuai warna, dan kemasan dari tabel Packing barang tersebut. |
| 15 | 218 | Zoom per baris: `BB-SEAL-CAP` (Kg), pigmen (gram), lalu `Plastik 35x50` dan `Karung` (Buah, angka pecahan). | Kemasan per buah: satu dibagi isi kemasan | Pigmen dihitung dari berat bahan dikalikan rasio pigmen. Kemasan dihitung dari satu dibagi isi kemasan, sehingga angkanya berupa pecahan. |
| 16 | 238 | Teks di tengah layar. | Resep diperbarui secara otomatis | Apabila pigmen atau tabel Packing diubah, resep diperbarui secara otomatis di belakang layar. Resep yang dibuat secara manual tidak pernah diubah. |
| 17 | 254 | Kembali ke daftar **Kapasitas Mesin**. Klik tombol **Impor dari Excel**. Dialog **Impor Kapasitas Mesin** terbuka. | Banyak baris? Gunakan Impor dari Excel | Apabila barisnya banyak, Anda tidak perlu mengetiknya satu per satu. Klik Impor dari Excel. |
| 18 | 268 | Klik **File Excel atau CSV**, pilih **Perangkat Saya**, pilih file Excel, klik **Unggah**. Klik **Pratinjau**. Tabel muncul: **Baris**, **Hasil**, **Alasan**. | Pratinjau terlebih dahulu, belum ada data ditulis | Lampirkan file melalui Perangkat Saya, lalu klik Unggah. Klik Pratinjau. Pada tahap ini, belum ada data yang ditulis. |
| 19 | 288 | Zoom ke kolom **Hasil**: Baru, Berubah, Tidak berubah, Ditolak. Tunjuk satu alasan kalau ada yang Ditolak. | Baru, Berubah, Tidak berubah, Ditolak | Kolom Hasil menunjukkan status setiap baris. Baris yang ditolak disertai alasannya, misalnya barang atau mesin tidak ditemukan. |
| 20 | 306 | Klik **Terapkan**. Dialog tertutup. | Terapkan: simpan baris dan buat resep | Apabila sudah sesuai, klik Terapkan. Baris baru dan baris yang berubah akan disimpan, lalu resepnya dibuat seperti pada tombol Buat Bill of Materials. |
| 21 | 322 | Buka judul **Produksi**, klik **Perintah Produksi**, lalu **+ Tambah Perintah Produksi**. Pilih **Barang** satu varian Seal Cap. Klik kolom **Mesin**: pilihan cuma Mesin 04 dan Mesin 14. | Pilihan mesin mengikuti Kapasitas Mesin | Kapasitas Mesin juga membatasi pilihan mesin. Pada perintah produksi, hanya mesin yang tercatat untuk barang tersebut yang dapat dipilih. |
| 22 | 340 | Ketik **Mesin 05**, klik **Simpan**. Zoom ke pesan "... tidak dibuat di Mesin 05. Mesin untuk barang ini: ...". | Mesin lain akan ditolak | Apabila mesin lain dipilih, sistem akan menolak dan menyebutkan mesin yang diperbolehkan. Untuk menambah mesin, tambahkan terlebih dahulu barisnya di Kapasitas Mesin. |
| 23 | 358 | Pilih **Mesin 04**. Zoom ke kolom **BOM** yang terisi resep Mesin 04. Tutup tanpa simpan. | Resep mengikuti mesin | Setelah mesin dipilih, resep untuk mesin tersebut terisi secara otomatis. Barang tanpa baris kapasitas dapat dibuat di mesin mana pun. |
| 24 | 374 | Kembali ke halaman depan. Teks penutup di tengah layar. | Berikutnya: stok awal | Demikian pembahasan mesin dan resep, dan pada video berikutnya kita akan mengisi stok awal gudang. Sampai jumpa. |

## Catatan rekam

- Durasi narasi sekitar 6 menit apabila dibaca perlahan; baris 6 dan 12 boleh dipotong.
- Baris 3: Stasiun Kerja (Workstation) tidak tersedia sebagai kartu di halaman depan Produksi. Buka melalui pencarian di menu ("Stasiun Kerja") atau dari Lantai Produksi, klik mesin lalu **Buka mesin**.
- Baris 5 dan 6: jangan ubah centang **Dinonaktifkan**.
- Baris 11: angka pcs per jam Seal Cap Mesin 04 = 3.600 detik dibagi 14 detik dikali 20 kavitas, sekitar 5.143. Apabila angkanya berbeda di layar, sesuaikan narasinya.
- Baris 13: pada data yang sudah lengkap, hasilnya biasanya "BOM dibuat: 0, tetap: ...". Hal itu wajar. Narasi menyebut tombolnya "Buat Bill of Materials" agar suara tidak membaca singkatan.
- Baris 20: gunakan file yang barisnya **Tidak berubah** (lihat data di atas), agar tidak menambah baris dan resep baru. Apabila ada baris **Ditolak**, dialog tetap terbuka agar alasannya terbaca.
- Baris 22: Mesin 05 aktif tetapi tidak tercatat untuk Seal Cap. Apabila pesannya muncul saat memilih (bukan saat menyimpan), ikuti tampilan di layar.
- Baris 23: tutup tanpa menyimpan agar tidak ada draf perintah produksi yang tertinggal.
- Label mengikuti terjemahan bawaan ERPNext (Stasiun Kerja, Item, Dinonaktifkan). Apabila di layar berbeda, sesuaikan teks "Di layar".
