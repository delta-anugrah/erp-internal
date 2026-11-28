# Salinan backup di PC admin

Tiap malam PC admin di pabrik mengambil backup terbaru dari R2 ke sebuah folder. Ini tempat backup ketiga,
setelah server dan R2: kalau server dan akun Cloudflare bermasalah sekaligus, datanya masih ada di pabrik.

PC itu boleh tetap dipakai untuk membuka ERP; pengambilan backup jalan sendiri di belakang.

## Yang perlu disiapkan sekali

1. **Key R2 khusus baca.** Cloudflare (akun usaha.ai) > R2 > Manage API tokens > Create API token:
   permission **Object Read only**, hanya bucket `erp-delta-anugrah-backup`. Simpan di Bitwarden sebagai
   "Delta Anugrah ERP Prod R2 backup (read-only)": endpoint (`https://<account id>.r2.cloudflarestorage.com`),
   Access Key ID, Secret Access Key. Jangan pakai key yang bisa menulis: installer menolaknya, supaya virus di PC
   itu tidak bisa menghapus backup di R2.
2. **Akun Windows berpassword** di PC itu. Kalau Windows-nya Pro, nyalakan BitLocker (isi disk terkunci kalau PC
   dicuri). File backup berisi seluruh data perusahaan.

## Memasang (sekitar 10 menit)

1. Di PC admin, login ke ERP sebagai **Super Admin**, buka **Settings > Download Backups**.
2. Klik **PC Backup Installer**. File `pasang-cadangan-pc.cmd` terunduh. Chrome bisa bertanya apakah file ini
   aman: pilih Keep.
3. Klik dua kali file itu. Kalau muncul "Windows protected your PC": More info > Run anyway (wajar untuk script
   buatan sendiri).
4. Jawab pertanyaannya: folder (Enter = `C:\CadanganERP`), lalu endpoint, Access Key ID dan Secret dari
   Bitwarden, lalu bucket/folder (Enter = `erp-delta-anugrah-backup/erp`).
5. Installer memeriksa key bisa membaca dan tidak bisa menulis, memasang jadwal, lalu langsung mengambil backup
   pertama. Selesai kalau muncul "SELESAI. n file backup ada di ...".

Menjalankan file itu lagi aman: ia menimpa setelan lama (misalnya saat key diganti).

## Apa yang terjadi tiap malam

- Jam 03:00 (sejam setelah server membuat backup jam 02:00), tugas Task Scheduler "ERP Delta Anugrah - tarik
  backup" mengambil file baru dari R2. PC mati jam segitu? Jalan begitu PC nyala dan ada internet.
- Hanya menyalin, tidak pernah menghapus di R2. File di PC yang lebih tua dari 30 hari dihapus, tapi hanya kalau
  backup baru masuk; kalau backup berhenti datang, file lama tidak disentuh.
- Kalau pengambilan gagal atau backup terbaru lebih tua dari 2 hari, muncul jendela peringatan di layar. Itu
  tanda server berhenti membuat backup atau internet putus: kabari tim IT.
- Catatan tiap malam: `C:\CadanganERP\log.txt`.

## Isi folder

| Folder | Isi |
|---|---|
| `C:\CadanganERP\backup` | File backup: database (`*-database.sql.gz`), file umum dan file privat (`*.tgz`) per malam |
| `C:\CadanganERP\alat` | `rclone.exe` (versi dikunci, checksum dicek), `rclone.conf` (key R2), `tarik.ps1` (skrip malam) |
| `C:\CadanganERP\log.txt` | Catatan tiap pengambilan |

Folder ini hanya bisa dibuka akun Windows yang memasang, SYSTEM dan Administrators.

## Memulihkan dari salinan ini

Salinan ini dipakai kalau server dan R2 dua-duanya tidak bisa diambil. Langkahnya sama dengan pemulihan biasa
(`deploy/server/README.md`, "Monthly restore drill", dengan file dari `C:\CadanganERP\backup` sebagai pengganti
`rclone copy`): bawa satu set file satu malam (database + 2 file) ke server baru.
Kunci enkripsi situs ada di Bitwarden, bukan di backup.

## Mencopot

Task Scheduler > hapus tugas "ERP Delta Anugrah - tarik backup", lalu hapus folder `C:\CadanganERP`. Cabut juga
key R2-nya di Cloudflare kalau PC itu tidak dipakai lagi.

## Untuk developer

- Installer: `erp_internal/data/pasang-cadangan-pc.cmd` (disajikan CRLF oleh `erp_internal.cadangan_pc.unduh`,
  hanya System Manager). Tombol dan hilangnya "Download Files Backup" (butuh email): `public/js/backups.js` lewat
  hook `page_js`. Tes: `test_cadangan_pc`.
- Ganti versi rclone: ubah `$VERSI` dan `$SHA256` (dari `https://downloads.rclone.org/<versi>/SHA256SUMS`, baris
  `windows-amd64.zip`), lalu jalankan installer lagi di PC.
- Windows on ARM tidak didukung (rclone yang diunduh build amd64).
