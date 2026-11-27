# Video Lengkap A8: Gudang dan Kirim Barang

- **Untuk siapa:** Admin baru yang belum pernah memakai sistem. Isi: seluruh fitur gudang, mulai dari bahan masuk hingga barang dikirim kepada pelanggan.
- **Durasi target:** sekitar 5 menit.
- **Login:** `admin@example.com` (Ayu Lestari, peran Admin), sandi akun contoh.
- **Data yang harus tersedia sebelum perekaman:**
  - Data contoh (`buat_contoh`) dan data barang asli (`master.muat`, `penjualan.muat`, `mesin_barang.muat`) sudah dimuat, sehingga tersedia barang `BB-SEAL-CAP`, barang contoh `CTH-` dengan stok di Gudang Barang Jadi, dan pelanggan contoh.
  - Satu file foto di komputer: foto surat jalan dari pemasok.
  - Satu file foto lainnya: surat jalan yang sudah ditandatangani pelanggan (foto apa pun dapat digunakan untuk demo).
- **Bahasa tampilan:** Indonesia.
- **Bab (daftar isi):** Lima gudang (baris 3), Bahan masuk (baris 4), Pindah gudang (baris 9), Surat Jalan (baris 11), Foto tanda tangan pelanggan (baris 16), Saldo Stok dan Kartu Stok (baris 18), Dokumen Tanpa Lampiran (baris 20), Stok opname (baris 22).

| No | Detik | Di layar | Teks layar | Narasi |
|---|---|---|---|---|
| 1 | 0 | Halaman depan sudah login sebagai Ayu. Klik menu kiri **Stok**. Zoom ke kartu **Mutasi Stok**, **Surat Jalan**, **Barang**, **Gudang**, **Saldo Stok**, **Kartu Stok**, **Dokumen Tanpa Lampiran**. | Gudang: barang masuk, pindah, dan keluar | Dalam video ini, Anda akan mempelajari seluruh kegiatan gudang. Kegiatannya meliputi bahan masuk, perpindahan gudang, hingga pengiriman barang kepada pelanggan. |
| 2 | 16 | Kartu daftar isi: judul tiap bagian dengan menit mulainya (dibuat otomatis setelah rekam). | Daftar isi | Berikut daftar isi video ini. Anda dapat langsung melompat ke bagian yang Anda perlukan. |
| 3 | 24 | Klik kartu **Gudang**. Daftar gudang: Gudang Bahan Baku, Gudang Produksi, Gudang Barang Jadi, Gudang Reject, lalu Gudang Pluit. | Terdapat 5 gudang pabrik | Pabrik memiliki lima gudang, yaitu bahan baku, produksi, barang jadi, dan reject. Gudang kelima adalah Gudang Pluit, untuk barang jadi yang disimpan di Pluit. |
| 4 | 40 | Kembali ke **Stok**, klik **Mutasi Stok**, lalu **+ Tambah**. Klik kolom **Jenis Entri Saham**, tunjuk pilihan **Nota Penerimaan Barang** dan **Transfer Barang**. | Mutasi Stok mencatat pergerakan barang | Seluruh pergerakan barang di gudang dicatat melalui Mutasi Stok. Jenis yang paling sering digunakan adalah barang masuk dan perpindahan gudang. |
| 5 | 56 | Pilih **Nota Penerimaan Barang**. Isi **Gudang Tujuan Bawaan**: Gudang Bahan Baku. Di tabel **Item**, pilih `BB-SEAL-CAP`, jumlah 100. | Nota Penerimaan Barang: bahan masuk tanpa pesanan | Untuk bahan yang masuk tanpa pesanan pembelian, pilih Nota Penerimaan Barang dengan gudang tujuan Gudang Bahan Baku. Kemudian isi bahan dan jumlahnya dalam kilogram. |
| 6 | 74 | Klik **Simpan**. Zoom ke catatan oranye "Lampirkan foto atau hasil scan dokumen aslinya sebelum diajukan." Klik **Kirim**: ditolak. | Tanpa foto surat jalan, pengiriman ditolak | Klik Simpan. Catatan oranye ini mengingatkan bahwa barang masuk wajib dilengkapi foto surat jalan dari pemasok. Klik Kirim, dan sistem menolaknya karena fotonya belum ada. |
| 7 | 90 | Klik **+** di samping **Lampiran** di sidebar kiri form. Klik **Perangkat Saya**, pilih foto surat jalan pemasok, klik **Unggah**. Catatan hilang. Klik **Kirim**, lalu **Ya**. | Lampirkan foto, lalu kirim | Klik tanda tambah di samping Lampiran. Pilih Perangkat Saya, pilih fotonya, lalu klik Unggah. Klik Kirim, lalu Ya, dan stok bahan di Gudang Bahan Baku langsung bertambah. |
| 8 | 108 | Teks di layar: bahan, pigmen, kemasan. Kursor menunjuk baris barang di Mutasi Stok tadi. | Tanpa stok bahan, hasil produksi tidak tercatat | Pigmen dan kemasan juga harus diterima di Gudang Bahan Baku. Tanpa stok tersebut, hasil produksi tidak dapat dicatat karena stok tidak boleh minus. |
| 9 | 124 | **Stok**, **Mutasi Stok**, **+ Tambah**. Pilih **Transfer Barang**. **Gudang Sumber Bawaan**: Gudang Barang Jadi. **Gudang Tujuan Bawaan**: Gudang Pluit. | Transfer Barang: perpindahan antargudang | Untuk memindahkan barang, pilih Transfer Barang. Isi gudang asal dan gudang tujuan, misalnya dari Gudang Barang Jadi ke Gudang Pluit. |
| 10 | 140 | Di **Item**, pilih barang contoh `CTH-`, jumlah 50. Klik **Simpan**, lalu **Kirim** dan **Ya**. | Perpindahan gudang tidak memerlukan foto | Isi barang dan jumlahnya. Klik Simpan, lalu Kirim dan Ya. Perpindahan gudang tidak memerlukan foto. |
| 11 | 156 | **Stok**, kartu **Surat Jalan**, **+ Tambah**. Pilih **Pelanggan**. | Surat Jalan: barang keluar ke pelanggan | Barang yang dikirim kepada pelanggan dicatat dalam Surat Jalan. Pilih pelanggannya terlebih dahulu. |
| 12 | 168 | Isi barang `CTH-` di tabel **Item**, jumlah 20. Kosongkan **Tetapkan Gudang Sumber**, klik **Simpan**: ditolak. | Gudang asal wajib dipilih | Isi barang dan jumlahnya. Gudang asal wajib dipilih, jadi tanpa gudang asal surat jalan ditolak saat disimpan. |
| 13 | 182 | Klik **Tetapkan Gudang Sumber**, tunjuk pilihan Gudang Barang Jadi dan Gudang Pluit. Pilih **Gudang Pluit**. Zoom ke kolom gudang di baris barang: ikut Gudang Pluit. | Pilih Gudang Barang Jadi atau Gudang Pluit | Pilih Gudang Barang Jadi apabila barang berasal dari pabrik, atau Gudang Pluit apabila berasal dari Pluit. Seluruh baris barang akan mengikuti gudang tersebut. |
| 14 | 198 | Klik **Simpan**, lalu **Kirim** dan **Ya**. Klik ikon printer. | Kirim dokumen sebelum truk berangkat | Klik Simpan, lalu Kirim dan Ya, sebelum truk berangkat. Stok langsung berkurang. Klik ikon printer untuk mencetak surat jalannya. |
| 15 | 214 | Teks di layar: "Stok tidak cukup? Kirim ditolak." | Stok kurang? Periksa terlebih dahulu | Apabila stok tidak mencukupi, sistem akan menolak. Periksa stok terlebih dahulu dan jangan memaksakan pengiriman. |
| 16 | 226 | Kembali ke form Surat Jalan. Zoom ke catatan oranye "Lampirkan surat jalan yang sudah ditandatangani." | Foto tanda tangan pelanggan menyusul | Surat jalan boleh dikirim tanpa foto agar truk tidak perlu menunggu. Setelah pelanggan menandatangani, fotonya dilampirkan. |
| 17 | 240 | Klik **+** di samping **Lampiran**, **Perangkat Saya**, pilih foto surat jalan bertanda tangan, **Unggah**. Catatan oranye hilang. | Lampirkan setelah ditandatangani | Klik tanda tambah di samping Lampiran, lalu unggah fotonya. Catatan oranye akan langsung hilang. |
| 18 | 254 | **Stok**, kartu **Saldo Stok**. Saring **Barang** ke barang `CTH-` tadi. Zoom ke baris Gudang Barang Jadi dan Gudang Pluit. | Saldo Stok: stok terkini per gudang | Untuk mengetahui stok terkini, buka Saldo Stok. Stok ditampilkan per barang dan per gudang. |
| 19 | 270 | **Stok**, kartu **Kartu Stok**. Saring **Barang** yang sama. Zoom ke baris: pindah ke Pluit, lalu keluar lewat Surat Jalan. | Kartu Stok: riwayat keluar masuk barang | Kartu Stok berisi riwayat keluar masuk satu barang. Di sini terlihat barang tadi dipindahkan ke Pluit, lalu keluar melalui surat jalan. |
| 20 | 288 | **Stok**, kartu **Dokumen Tanpa Lampiran**. Daftar dokumen tanpa foto, terbaru di atas. Zoom ke kolom **Jenis Dokumen** dan **Dokumen**. | Periksa dokumen yang belum memiliki foto | Laporan Dokumen Tanpa Lampiran berisi dokumen yang sudah dikirim tetapi belum memiliki foto. Termasuk di dalamnya surat jalan yang belum ditandatangani. |
| 21 | 304 | Klik satu dokumen di daftar, form terbuka. Lampirkan foto, kembali ke laporan, klik segarkan: dokumen itu hilang. | Lampirkan foto, dokumen hilang dari daftar | Klik dokumennya dan lampirkan fotonya. Kembali ke laporan, dan dokumen tersebut sudah hilang dari daftar. Periksa laporan ini secara rutin. |
| 22 | 320 | Menu kiri **Pengaturan**, kartu **Stok Awal & Stok Opname**. Tunjuk tombol **+ Tambah**, tanpa membuat. | Setiap bulan: lakukan stok opname | Setiap bulan, hitung barang di gudang, kemudian catat hasilnya di Stok Opname. Sistem akan menyesuaikan stok dengan hasil penghitungan. |
| 23 | 336 | Kembali ke halaman **Stok**. Teks penutup di tengah layar. | Masuk, pindah, keluar, dan periksa | Dengan demikian, tugas di gudang adalah mencatat barang masuk, perpindahan gudang, pengiriman barang, serta memeriksa dokumen yang belum memiliki foto. Sampai jumpa pada video berikutnya. |

## Catatan rekam

- Baris 4, 9, 11 dan 22: tombol tambah di daftar bertuliskan **+ Tambah** diikuti nama halamannya; ikuti tulisan di layar.
- Baris 12: pesan penolakan berasal dari kolom wajib ERPNext; teksnya mengikuti tampilan di layar.
- Baris 14: barang `CTH-` harus sudah tersedia di Gudang Pluit dari baris 10; jumlah surat jalan (20) tidak boleh melebihi jumlah yang dipindahkan (50).
- Baris 15 hanya dinarasikan; jangan sengaja memaksakan stok minus saat perekaman.
- Baris 21: laporan juga menampilkan dokumen dari data contoh; pilih satu dokumen yang aman untuk dilampiri.
- Baris 22: apabila terdapat selisih besar saat opname, laporkan kepada atasan sebelum klik **Kirim**. Jangan membuat Stok Opname saat perekaman.
- Label mengikuti terjemahan bawaan ERPNext (Jenis Entri Saham, Nota Penerimaan Barang, Transfer Barang, Gudang Sumber Bawaan, Gudang Tujuan Bawaan, Item, Simpan, Kirim, Ya). Tombol cetak berupa ikon printer tanpa tulisan. Apabila di layar berbeda, sesuaikan teks "Di layar".
- Pembersihan sesudah perekaman: klik **Batalkan** pada Surat Jalan, lalu Mutasi Stok pindah gudang, lalu Nota Penerimaan Barang (mulai dari yang terakhir), atau jalankan ulang `buat_contoh`.
