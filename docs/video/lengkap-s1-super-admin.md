# Video Lengkap S1: Super Admin

- **Untuk siapa:** tim IT yang memegang akun Super Admin. Isi: fitur yang hanya tersedia bagi Super Admin, dan cara memberikan peran yang tepat kepada pengguna.
- **Durasi target:** sekitar 4 menit 30 detik.
- **Login:** `developer@example.com` (peran Super Admin), sandi akun contoh.
- **Data yang harus ada sebelum rekam:**
  - Data contoh di `erp.localhost` (`buat_contoh`), sehingga tersedia perintah produksi yang sudah dikirim dan sedang berjalan.
  - Satu alamat email untuk pengguna baru di baris 16 (misalnya `operator.baru@example.com`).
- **Bahasa tampilan:** Indonesia.
- **Bab (daftar isi):** Tiga peran (baris 3), Pengaturan usaha (baris 4), Tombol Selesai (baris 9), Kotak Sistem (baris 11), Modul yang dikunci (baris 14), Pengguna baru dan perannya (baris 15), Karyawan keluar dan sandi (baris 20).

| No | Detik | Di layar | Teks layar | Narasi |
|---|---|---|---|---|
| 1 | 0 | Halaman depan sudah masuk sebagai Super Admin. Menu kiri: Lantai Produksi, Input Harian, lalu judul Stok, Penjualan, Pembelian, Produksi, Proyek, SDM, Pengaturan. | Super Admin: seluruh akses Admin dan fitur khusus | Super Admin memiliki seluruh akses Admin, ditambah beberapa fitur khusus. Video ini hanya membahas fitur khusus tersebut. |
| 2 | 12 | Kartu daftar isi: judul tiap bagian dengan menit mulainya (dibuat otomatis setelah rekam). | Daftar isi | Berikut daftar isi video ini. Anda dapat langsung melompat ke bagian yang Anda perlukan. |
| 3 | 20 | Kursor menunjuk tabel kecil di tengah layar: Produksi, Admin, Super Admin, dan isi tugasnya. | Terdapat 3 peran: Produksi, Admin, Super Admin | Terdapat tiga peran. Produksi untuk petugas pabrik, Admin untuk pemilik dan kepala bagian, serta Super Admin untuk tim teknologi informasi. |
| 4 | 34 | Klik judul menu **Pengaturan**. Halaman Pengaturan dengan kartu. Zoom ke kartu **Pengaturan Stok**, **Pengaturan Penjualan**, **Pengaturan Pembelian**, **Pengaturan Manufaktur**, **Pengaturan Akun**, **Pengaturan Proyek**, **Pengaturan SDM**. | Terdapat 7 halaman pengaturan usaha | Menu Pengaturan memuat tujuh halaman pengaturan usaha. Halaman ini hanya ditampilkan untuk Super Admin, tidak untuk Admin. |
| 5 | 50 | Klik **Pengaturan Stok**. Zoom ke pilihan stok boleh minus (tidak dicentang), lalu cara hitung nilai stok FIFO. | Contoh: stok tidak boleh minus | Contohnya adalah Pengaturan Stok. Stok tidak boleh minus, dan nilai stok dihitung dengan metode masuk pertama keluar pertama. |
| 6 | 66 | Klik **Pengaturan Pembelian**: zoom ke pesanan pembelian wajib. Lalu **Pengaturan Manufaktur**: zoom ke batas produksi lebih sepuluh persen. | Pembelian wajib pesanan, produksi boleh lebih 10% | Penerimaan barang wajib berasal dari pesanan pembelian. Perintah produksi boleh melebihi jumlahnya hingga sepuluh persen. |
| 7 | 82 | Teks peringatan di tengah layar di atas halaman Pengaturan Manufaktur. Tidak ada yang diubah. | Dipasang ulang setiap pembaruan | Setelan seperti ini dipasang ulang setiap kali aplikasi diperbarui. Jika diubah di sini, nilainya dapat kembali seperti semula. |
| 8 | 96 | Kursor diam di atas tombol **Simpan**, tidak diklik. | Ubah hanya jika benar-benar diperlukan | Ubah halaman pengaturan hanya jika benar-benar diperlukan. Jika setelan harus berubah secara permanen, ubahlah di kode aplikasi agar tidak kembali. |
| 9 | 110 | Kembali. Menu **Produksi**, klik **Perintah Produksi**, buka satu yang sedang berjalan. Zoom ke tombol **Selesai**. | Tombol Selesai hanya untuk Super Admin | Pada perintah produksi yang sedang berjalan, tombol Selesai hanya ditampilkan untuk Super Admin. Admin dan Produksi tidak memiliki tombol ini. |
| 10 | 124 | Kursor menunjuk tombol **Selesai** tanpa mengklik. Teks di tengah layar: "Catat hasil produksi di Input Harian." | Hasil harian tetap dicatat di Input Harian | Hasil yang dicatat melalui tombol Selesai tidak masuk ke Input Harian dan laporan Rencana versus Aktual. Gunakan tombol ini hanya untuk memperbaiki data, sedangkan hasil harian tetap dicatat di Input Harian. |
| 11 | 142 | Buka layar Aplikasi (alamat `/desk`). Zoom ke kotak **Sistem**, lalu klik. | Kotak Sistem hanya untuk Super Admin | Pada layar Aplikasi, kotak Sistem hanya ditampilkan untuk Super Admin. Di dalamnya terdapat halaman Build dan System Settings. |
| 12 | 156 | Halaman **Build** terbuka dengan deret ikon di kiri. Kursor menyusuri ikonnya, lalu buka **System Settings**. | Build dan System Settings: alat tim Teknologi Informasi (IT) | Build dan System Settings adalah alat tim teknologi informasi untuk mengatur sistem dasar aplikasi. Petugas pabrik dan Admin tidak perlu membuka halaman ini. |
| 13 | 170 | Di **System Settings**, zoom ke zona waktu Asia/Jakarta, format tanggal, format angka, dan aturan sandi. | Zona waktu dan format sudah diatur | Zona waktu, format tanggal, format angka, dan aturan sandi sudah diatur. Setelan ini juga dipasang ulang setiap pembaruan, jadi tidak perlu diubah. |
| 14 | 186 | Kembali ke halaman depan. Kursor menyusuri menu kiri: tidak ada CRM, Aset, atau Penggajian. | Modul yang tidak dipakai dikunci | Modul yang tidak dipakai, seperti Customer Relationship Management, aset, dan penggajian, dikunci untuk semua peran, termasuk Super Admin. Modul tersebut hanya dapat dibuka melalui kode aplikasi. |
| 15 | 200 | Menu **Pengaturan**, klik **Pengguna**. Daftar pengguna. Klik **+ Tambah Pengguna**. | Pengguna baru: pilih peran yang tepat | Selanjutnya adalah cara memberikan akun kepada pengguna baru. Buka Pengaturan, lalu Pengguna, dan klik Tambah Pengguna. |
| 16 | 212 | Isi **Email** `operator.baru@example.com` dan **Nama Depan**. Di **Profil Peran** pilih **Produksi**. Klik **Simpan**. | Petugas pabrik: peran Produksi | Isi email dan nama depan. Petugas pabrik diberi peran Produksi. Lalu klik Simpan. |
| 17 | 228 | Di form yang terbuka, isi **Profil Modul** juga **Produksi**. Klik **Simpan**. Zoom ke daftar peran yang tercentang sendiri. | Profil Modul sama dengan perannya | Setelah tersimpan, isi Profil Modul dengan nama yang sama, lalu klik Simpan kembali. Hak akses akan otomatis mengikuti peran tersebut. |
| 18 | 244 | Buka pilihan **Profil Peran**: Produksi, Admin, Super Admin. Kursor berhenti di **Admin**, lalu di **Super Admin**. | Admin untuk pimpinan, Super Admin untuk Teknologi Informasi (IT) | Pemilik dan kepala bagian diberi peran Admin. Super Admin hanya diberikan kepada tim teknologi informasi, karena peran ini dapat mengubah pengaturan sistem. |
| 19 | 260 | Teks di tengah layar: "Anda tidak bisa memberi peran ini" dan "Hanya Super Admin yang bisa mengubah akun ini." | Hanya Super Admin dapat memberikan Super Admin | Admin hanya dapat memberikan peran Produksi atau Admin. Pemberian peran Super Admin dan perubahan akun Super Admin hanya dapat dilakukan oleh Super Admin. |
| 20 | 276 | Di form pengguna, zoom ke centang **Diaktifkan**, lalu ke bagian ganti sandi (**Atur Kata Sandi Baru**). | Karyawan keluar: hapus centang Diaktifkan | Jika karyawan berhenti bekerja, hapus centang Diaktifkan lalu simpan, dan datanya tetap tersimpan. Sandi yang terlupa dapat diganti pada bagian Atur Kata Sandi Baru di form yang sama. |
| 21 | 292 | Kembali ke halaman **Pengaturan**. Teks penutup di tengah layar. | Gunakan seperlunya, beri peran sesuai tugas | Gunakan akun Super Admin seperlunya, dan berikan setiap pengguna peran yang sesuai dengan tugasnya. Sampai jumpa di video berikutnya. |

## Catatan rekam

- Baris 3, 7, 10 dan 19 memakai teks di tengah layar yang ditambahkan saat penyuntingan video. Baris 19 sengaja tidak direkam langsung, karena pesan tersebut hanya muncul di akun Admin.
- Baris 5, 6 dan 13: jangan mengklik **Simpan** di halaman pengaturan saat rekam. Nama kolom di halaman ini bawaan ERPNext dan Frappe, tidak ada di `id.csv` aplikasi; cukup zoom ke kolomnya.
- Baris 9 dan 10: jangan mengklik **Selesai**. Jika telanjur, batalkan Stock Entry Manufacture yang terbentuk.
- Baris 11: kotak **Sistem** dan halaman Build adalah milik Frappe; menu kiri di sana berupa deret ikon, bukan menu berlabel seperti di halaman lain.
- Label form pengguna mengikuti terjemahan bawaan Frappe (Nama Depan, Profil Peran, Profil Modul, Diaktifkan, Atur Kata Sandi Baru, Simpan). Jika di layar berbeda, sesuaikan teks "Di layar" saat rekam.
- Setelah rekam: hapus pengguna `operator.baru@example.com`, atau nonaktifkan jika tidak dapat dihapus.
