# Video Lengkap A4: Stok Awal

- **Untuk siapa:** Admin baru yang memulai dari awal. Isi: lima gudang pabrik, pengisian stok awal, stok opname bulanan, dan cara melihat stok setelahnya.
- **Durasi target:** sekitar 4 menit.
- **Login:** `admin@example.com` (Ayu Lestari, peran Admin), sandi akun contoh.
- **Data yang harus ada sebelum rekam:**
  - Data contoh (`buat_contoh`) dan data barang asli (`master.muat`, `penjualan.muat`, `mesin_barang.muat`) sudah dimuat, sehingga tersedia lima gudang (singkatan perusahaan `CPL`), bahan `BB-SEAL-CAP`, dan barang kemasan `Karung`.
  - Satu varian produk yang memiliki stok di Gudang Barang Jadi (untuk contoh stok opname).
- **Bahasa tampilan:** Indonesia.
- **Bab (daftar isi):** Lima gudang pabrik (baris 3), Mengisi stok awal (baris 6), Memeriksa hasilnya (baris 12), Stok opname bulanan (baris 15).

| No | Detik | Di layar | Teks layar | Narasi |
|---|---|---|---|---|
| 1 | 0 | Halaman depan sudah login sebagai Ayu. Buka judul **Stok**, klik kartu **Gudang**. | Stok awal diisi sekali sebelum mulai | Video ini membahas pengisian stok awal, yaitu jumlah barang yang sudah ada di gudang sebelum aplikasi mulai digunakan. |
| 2 | 14 | Kartu daftar isi: judul tiap bagian dengan menit mulainya (dibuat otomatis setelah rekam). | Daftar isi | Berikut daftar isi video ini. Anda dapat langsung melompat ke bagian yang Anda perlukan. |
| 3 | 22 | Daftar gudang terbuka. Zoom ke lima gudang, lalu ke Gudang Bahan Baku dan Gudang Produksi. | Terdapat 5 gudang pabrik | Pabrik memiliki lima gudang. Gudang Bahan Baku untuk biji plastik, pigmen, dan kemasan, sedangkan Gudang Produksi untuk bahan yang sedang digunakan mesin. |
| 4 | 42 | Zoom ke Gudang Barang Jadi, Gudang Reject, Gudang Pluit. | Barang dijual dari Barang Jadi atau Pluit | Gudang Barang Jadi untuk produk siap kirim, Gudang Reject untuk produk cacat, dan Gudang Pluit untuk produk yang disimpan di Pluit. |
| 5 | 60 | Teks di tengah layar. | Stok tidak boleh minus | Perlu diingat, stok tidak boleh minus. Oleh karena itu, stok awal harus diisi sebelum barang digunakan atau dikirim. |
| 6 | 72 | Buka judul **Pengaturan**, klik kartu **Stok Awal & Stok Opname**. Daftar terbuka. Klik **+ Tambah Rekonsiliasi Persediaan**. | Stok Awal & Stok Opname di Pengaturan | Stok awal diisi melalui menu Pengaturan, pada kartu Stok Awal dan Stok Opname. Buka kartu tersebut, lalu klik tombol Tambah. |
| 7 | 86 | Isi **Tanggal Posting** sehari sebelum mulai pakai. Pilih **Tujuan** `Persediaan pembukaan`. Zoom ke **Akun Selisih** yang berisi `Temporary Opening - CPL`. | Tujuan: Persediaan pembukaan (stok awal) | Isi tanggal sehari sebelum aplikasi mulai digunakan. Pilih tujuan Persediaan pembukaan, yang berarti stok awal. Akun selisih akan terisi secara otomatis. |
| 8 | 104 | Di tabel **Item** baris 1: **Kode Item** `BB-SEAL-CAP`, **Gudang** `Gudang Bahan Baku - CPL`, **Kuantitas** 500, **Tingkat Penilaian** 13.500. | Barang, gudang, jumlah, dan harga pokok | Isi setiap baris dengan barang, gudang, jumlah dalam satuan stok, dan harga pokok per satuan. Biji plastik ini dihitung dalam kilogram. |
| 9 | 124 | Baris 2: `Karung`, `Gudang Bahan Baku - CPL`, **Kuantitas** 200, **Tingkat Penilaian** 3.500. Baris 3: satu varian produk di `Gudang Pluit - CPL`. | Satu dokumen dapat memuat banyak gudang | Satu dokumen dapat memuat banyak barang dan banyak gudang. Kemasan dan produk sama-sama dihitung per buah. |
| 10 | 142 | Teks di tengah layar. | Jumlah pigmen diisi dalam gram | Untuk pigmen, jumlahnya ditulis dalam gram, karena stok pigmen dihitung dalam gram. |
| 11 | 154 | Klik **Simpan**, lalu **Kirim**, lalu **Ya** pada konfirmasi. Status jadi terkirim. | Simpan, lalu Kirim | Klik Simpan, lalu klik Kirim dan Ya. Stok baru bertambah setelah dokumen dikirim. Stok awal tidak memerlukan foto lampiran. |
| 12 | 170 | Buka judul **Stok**, klik kartu **Saldo Stok**. Isi **Gudang** `Gudang Bahan Baku - CPL`. Zoom ke baris `BB-SEAL-CAP` dan `Karung`. | Periksa hasilnya di Saldo Stok | Selanjutnya, periksa hasilnya di Saldo Stok. Pilih gudangnya, dan jumlah yang tadi diisi sudah tercatat. |
| 13 | 188 | Kosongkan **Gudang**, isi **Item** salah satu barang. Zoom ke stok per gudang. | Saldo Stok: per barang dan per gudang | Saldo Stok menampilkan stok terkini per barang dan per gudang. Laporan ini dapat disaring berdasarkan gudang atau barang. |
| 14 | 204 | Klik kartu **Kartu Stok** di halaman Stok. Saring **Item** `BB-SEAL-CAP`. Zoom ke baris stok awal. | Kartu Stok: riwayat keluar masuk | Untuk melihat riwayat keluar masuk barang, buka Kartu Stok dan saring barangnya. Stok awal tadi tercatat pada baris pertama. |
| 15 | 222 | Kembali ke **Stok Awal & Stok Opname**, klik **+ Tambah Rekonsiliasi Persediaan**. Pilih **Tujuan** `Rekonsiliasi Persediaan`. | Stok opname dilakukan setiap bulan | Halaman yang sama digunakan untuk stok opname setiap bulan. Hitung terlebih dahulu barang di gudang, lalu pilih tujuan Rekonsiliasi Persediaan. |
| 16 | 240 | Isi satu baris: varian produk, `Gudang Barang Jadi - CPL`, **Kuantitas** hasil hitung. Zoom ke kolom selisih. | Isi jumlah hasil penghitungan | Isi barang, gudang, dan jumlah hasil penghitungan. Setelah dokumen dikirim, sistem menyesuaikan stok dengan angka tersebut. |
| 17 | 258 | Tunjuk tombol **Kirim**, jangan diklik. Teks di tengah layar: "Salah setelah dikirim? Batalkan, lalu Amendemen." | Selisih besar? Laporkan terlebih dahulu | Apabila selisihnya besar, laporkan terlebih dahulu kepada atasan sebelum mengklik Kirim. Apabila terdapat kesalahan setelah dikirim, klik Batalkan, lalu gunakan Amendemen. |
| 18 | 274 | Kembali ke halaman depan. Teks penutup di tengah layar. | Berikutnya: pembelian | Stok awal telah terisi, dan pada video berikutnya kita akan mempelajari pembelian bahan dari pemasok. Sampai jumpa. |

## Catatan rekam

- Durasi narasi sekitar 4 menit 30 detik apabila dibaca perlahan.
- Baris 6 dan 15: apabila tombol tambah di daftar bertuliskan lain (misalnya hanya **+ Tambah**), ikuti tampilan di layar.
- Baris 7: apabila **Akun Selisih** tidak terisi otomatis, pilih `Temporary Opening - CPL`.
- Baris 9: gunakan varian produk yang tersedia; angka boleh disesuaikan.
- Baris 11 menambah stok yang sebenarnya. Setelah rekaman, klik **Batalkan** pada dokumen stok awal tersebut.
- Baris 17: jangan klik **Kirim** pada stok opname; tutup lalu hapus drafnya.
- Barang dalam jumlah banyak dapat juga diimpor melalui file (`docs/impor.md` bagian 4); hal ini tidak ditampilkan di video karena belum dipastikan Admin dapat membuka Data Import.
- Label mengikuti terjemahan bawaan ERPNext (Tanggal Posting, Tujuan, Persediaan pembukaan, Rekonsiliasi Persediaan, Akun Selisih, Item, Kode Item, Gudang, Kuantitas, Tingkat Penilaian, Simpan, Kirim). Apabila di layar berbeda, sesuaikan teks "Di layar".
