# Video Lengkap A2: Data Barang

- **Untuk siapa:** Admin baru yang memulai dari awal. Isi: seluruh hal tentang data barang, mulai dari template dan varian hingga harga, kemasan, pigmen, dan merek Seal Cap.
- **Durasi target:** sekitar 6 menit.
- **Login:** `admin@example.com` (Ayu Lestari, peran Admin), sandi akun contoh.
- **Data yang harus ada sebelum rekam:**
  - Data contoh (`buat_contoh`) dan data barang asli (`master.muat`, `penjualan.muat`, `mesin_barang.muat`) sudah dimuat, sehingga tersedia template `GAYUNG-LUMBA`, `SEAL-CAP` dengan 17 varian (misalnya `SEAL-CAP-MHG-CKM` "Seal Cap MHG Coklat Muda"), barang kemasan `Plastik 35x50` dan `Karung`, template `PIGMEN`, daftar harga `Harga Pola 2026` dan `Harga Bahan Baku`, serta Merek MHG, APP, BEN.
  - Satu barang produk yang memiliki catatan oranye di formnya (laporan Data Belum Lengkap menyebut sekitar 23 barang tanpa kemasan dan 20 tanpa harga; pilih salah satunya).
  - Satu warna produk yang belum memiliki pigmen (laporan Data Belum Lengkap, baris "Pigmen warna ini belum ada").
- **Bahasa tampilan:** Indonesia.
- **Bab (daftar isi):** Grup barang (baris 3), Template dan varian (baris 4), Varian Seal Cap (baris 6), Tabel Packing dan kemasan (baris 8), Pigmen (baris 12), Daftar harga (baris 16), Merek Seal Cap (baris 19), Catatan oranye (baris 20).

| No | Detik | Di layar | Teks layar | Narasi |
|---|---|---|---|---|
| 1 | 0 | Halaman depan sudah login sebagai Ayu. Buka judul **Stok**, klik kartu **Barang**. Daftar barang terbuka. | Data barang: produk, bahan, dan kemasan | Video ini membahas data barang. Seluruh produk, bahan baku, kemasan, dan pigmen dicatat di halaman Barang. |
| 2 | 15 | Kartu daftar isi: judul tiap bagian dengan menit mulainya (dibuat otomatis setelah rekam). | Daftar isi | Berikut daftar isi video ini. Anda dapat langsung melompat ke bagian yang Anda perlukan. |
| 3 | 23 | Zoom ke kolom **Grup Barang** di daftar: Barang Jadi, Bahan Baku, Kemasan, Pigmen. | 4 grup: Barang Jadi, Bahan Baku, Kemasan, Pigmen | Setiap barang termasuk dalam satu grup. Produk masuk ke Barang Jadi, biji plastik ke Bahan Baku, serta terdapat grup Kemasan dan Pigmen. |
| 4 | 40 | Buka template `GAYUNG-LUMBA`. Zoom ke centang **Memiliki Varian**, lalu ke tabel atribut **Jenis** dan **Warna**. | Template adalah induk, varian adalah turunannya | Barang ini merupakan template, yaitu barang induk. Satu template memiliki banyak varian yang dibedakan melalui atribut, seperti Jenis dan Warna. |
| 5 | 58 | Klik tombol **Lihat varian** (atau buka daftar barang yang disaring ke template ini). Tunjuk kode `GAYUNG-LUMBA-SPR-MRH`. | Kode varian: kode template, jenis, dan warna | Kode varian tersusun dari kode template, jenis, dan warna. Barang yang dijual dan disimpan di stok selalu variannya, bukan templatenya. |
| 6 | 76 | Buka template `SEAL-CAP`. Zoom ke atribut **Merk** dan **Warna**. | Seal Cap: atribut Merk dan Warna | Seal Cap juga merupakan template. Atributnya adalah Merk, yaitu kode merek pelanggan, serta Warna. |
| 7 | 90 | Klik **Buat** lalu **Varian tunggal**. Dialog terbuka, tunjuk pilihan **Merk** dan **Warna**. Tutup dialog tanpa membuat. | Varian baru: Buat, lalu Varian tunggal | Untuk merek atau warna baru, klik Buat lalu Varian tunggal. Pada dialog ini, pilih merk dan warnanya. Nilai yang belum tersedia perlu ditambahkan terlebih dahulu pada atributnya. |
| 8 | 110 | Buka varian `SEAL-CAP-MHG-CKM`. Gulir ke tabel **Packing**: dua baris, **Plastik 35x50** dan **Karung**, dengan kolom **Barang Kemasan** dan **Isi per Kemasan (pcs)**. | Tabel Packing: kemasan dan isinya | Di bagian bawah terdapat tabel Packing, yang setiap barisnya berisi barang kemasan dan jumlah buah di dalamnya. Seal Cap memiliki dua kemasan, yaitu plastik dan karung. |
| 9 | 130 | Zoom ke kolom **Isi per Kemasan (pcs)**. Lalu kembali ke template `GAYUNG-LUMBA`, tunjuk tabel **Packing** di template. | Tabel di template berlaku untuk semua varian | Tabel pada template berlaku untuk seluruh variannya. Apabila varian memiliki baris sendiri, baris milik varian tersebut yang digunakan. |
| 10 | 148 | Buka barang `Karung`. Zoom ke **Grup Barang** Kemasan dan **Satuan Ukuran Bawaan** Buah. | Barang kemasan: grup Kemasan, satuan Buah | Barang kemasan dibuat dengan grup Kemasan dan satuan Buah. Kemasan dengan satuan Pieces akan ditolak pada tabel Packing. |
| 11 | 164 | Teks di tengah layar, lalu kembali ke daftar barang. | Terima stok kemasan sebelum mengisi tabel Packing | Penting, terima terlebih dahulu stok kemasan di Gudang Bahan Baku. Tanpa stok tersebut, hasil produksi barang itu tidak dapat dicatat. |
| 12 | 180 | Buka template `PIGMEN`. Zoom ke **Grup Barang** Pigmen, satuan stok **Gram**, dan satuan beli **Kg**. | Pigmen: stok dalam gram, dibeli per kilogram (Kg) | Pigmen memiliki satu template bernama PIGMEN. Stoknya dihitung dalam gram, sedangkan pembeliannya per kilogram. |
| 13 | 198 | Buka satu varian pigmen, misalnya warna Hijau. Zoom ke **Rasio Pigmen (g per kg)**: 1. | Satu varian untuk setiap warna, beserta rasionya | Setiap warna memiliki satu varian pigmen. Rasio menunjukkan jumlah gram pigmen untuk setiap kilogram bahan. |
| 14 | 214 | Kembali ke template `PIGMEN`. Klik **Buat** lalu **Varian**. Pilih **Warna** yang belum punya pigmen, isi **Rasio Pigmen (g per kg)** 1. Klik **Buat**, lalu **Simpan**. | Pigmen baru: Buat, Varian, lalu pilih warna | Untuk warna baru, buka PIGMEN, lalu klik Buat dan pilih Varian tunggal. Pilih warnanya, lalu klik Buat. Isi rasionya, yang harus lebih besar dari nol, lalu klik Simpan. |
| 15 | 234 | Zoom ke catatan oranye setelah simpan: "... belum ada stoknya di Gudang Bahan Baku ...". | Terima stok pigmen baru terlebih dahulu | Setelah pigmen dibuat, resep produk dengan warna tersebut langsung menggunakannya. Catatan oranye ini mengingatkan bahwa stoknya belum tersedia. |
| 16 | 250 | Buka halaman **Harga Barang** (alamat `/desk/item-price`; tidak ada di menu). Saring **Daftar Harga** `Harga Pola 2026`, lalu `Harga Bahan Baku`. | Dua daftar harga: jual dan beli | Harga barang dicatat dalam dua daftar. Harga Pola dua ribu dua puluh enam untuk harga jual, dan Harga Bahan Baku untuk harga beli. |
| 17 | 270 | Buka satu baris harga jual: **Barang**, **Daftar Harga**, **Satuan** (misalnya Lusin), **Harga**. Tutup. Buka satu baris harga pigmen: Satuan `Kg`, Harga 350.000. | Satu harga untuk setiap barang dan satuan | Satu baris harga berlaku untuk satu barang dan satu satuan. Harga pigmen ditulis per kilogram, misalnya tiga ratus lima puluh ribu rupiah. |
| 18 | 292 | Teks di tengah layar. | Seal Cap tidak memerlukan harga jual | Seal Cap tidak memerlukan harga jual di daftar harga, karena harganya mengikuti mesin pada pesanan penjualan. |
| 19 | 304 | Buka judul **Stok**, klik kartu **Merek**. Buka merek `APP`. Zoom ke **Insert (pcs)** dan **Deskripsi**. | Merek: kode merek dan jumlah insert | Halaman Merek memuat kode merek Seal Cap, masing-masing dengan jumlah insert cetakan dan keterangannya. Jumlah insert dapat diubah apabila terjadi perubahan. |
| 20 | 324 | Kembali ke daftar barang, buka barang produk yang punya catatan oranye. Zoom ke catatan oranye di atas form, satu baris per kekurangan. | Catatan oranye: data yang belum lengkap | Apabila ada data yang kurang, form barang menampilkan catatan oranye. Setiap kekurangan ditampilkan dalam satu baris. |
| 21 | 342 | Klik link **Isi tabel Packing di barangnya**: form bergulir ke tabel Packing. Lalu klik link **Tambah harga jual**: form harga baru terbuka, barang dan daftar harga sudah terisi. Tutup tanpa simpan. | Klik tautan untuk langsung memperbaikinya | Klik tautan pada catatan tersebut untuk langsung menuju tempat perbaikannya. Catatan ini tidak menghalangi penyimpanan, tetapi sebaiknya segera diselesaikan. |
| 22 | 362 | Kembali ke halaman depan. Teks penutup di tengah layar. | Berikutnya: mesin dan resep | Demikian pembahasan data barang, dan pada video berikutnya kita akan mengatur mesin serta resep produk. Sampai jumpa. |

## Catatan rekam

- Durasi narasi sekitar 6 menit apabila dibaca perlahan.
- Baris 5: apabila tombol daftar varian berbeda di layar, buka daftar Barang dan saring **Varian Dari** = `GAYUNG-LUMBA`.
- Baris 7: tutup dialog tanpa membuat varian, agar data tidak bertambah.
- Baris 14 membuat varian PIGMEN baru dan memicu pembuatan ulang resep di belakang layar. Setelah rekaman, nonaktifkan (centang **Dinonaktifkan**) varian pigmen tersebut; resepnya akan dibuat ulang tanpa pigmen.
- Baris 16: **Harga Barang** adalah terjemahan bawaan ERPNext untuk Item Price.
- Baris 21: tautan yang muncul bergantung pada barangnya; gunakan tautan yang ada di layar dan sesuaikan narasinya (daftar tautan: Isi tabel Packing di barangnya, Buat pigmen warna ini, Tambah harga jual, Tambah baris Kapasitas Mesin, Pesan barangnya).
- Label mengikuti terjemahan bawaan ERPNext (Memiliki Varian, Satuan Ukuran Bawaan, Deskripsi, Satuan, Harga, Daftar Harga, Varian tunggal). Tombol **Lihat varian** belum dipastikan labelnya; ikuti tampilan di layar.
