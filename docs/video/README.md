# Video panduan

Naskah video panduan aplikasi, untuk orang yang mulai dari nol. Ada dua versi:

- **Ringkas**: kerja harian saja. Tonton ini dulu.
- **Lengkap**: semua fitur per topik. Buka kalau perlu detail.

Setiap naskah berisi tabel adegan: apa yang terjadi di layar, teks di bawah layar, dan narasi untuk suara.
Tampilan aplikasi dalam bahasa Indonesia. Video direkam dengan `tools/rekam_demo.mjs` di situs contoh
`erp.localhost`; teks layar di skrip harus sama persis dengan kolom "Teks layar" di sini, karena perekam mencari
narasinya dari situ (teks yang tidak ada di naskah membuat rekaman berhenti).

Suara: `edge-tts` suara `id-ID-ArdiNeural`, kecepatan `-10%` (Abel 2026-11-26), dipasang di
`~/.local/share/edge-tts-venv` (`python3 -m venv ~/.local/share/edge-tts-venv && ~/.local/share/edge-tts-venv/bin/pip install edge-tts`).
Narasi dibacakan **per kalimat** (dipotong di `. ` `? ` `! `): `teks(...)` di skrip membacakan kalimat pertama baris itu,
setiap `lalu()` kalimat berikutnya, tepat sebelum aksi yang diceritakannya, jadi suara selalu cocok dengan layar.
Kalimat menunggu kalimat sebelumnya selesai. Jumlah `lalu()` per baris harus sama dengan jumlah kalimat dikurangi satu
(sisa kalimat dibacakan sebelum teks layar berikutnya). Ganti lewat `ERP_SUARA`, `ERP_TEMPO`; `ERP_TANPA_SUARA=1`
merekam tanpa suara (dry run cepat). Hasil: `~/Desktop/video-panduan/<naskah>.mp4`.

Aturan naskah (Abel 2026-11-26):

- Nama tombol ditulis seperti di layar bahasa Indonesia: Simpan, Kirim (bukan Submit), Buat, Batalkan, Ya, ikon printer.
- Singkatan: teks layar menulis nama lengkap dan singkatannya, "Purchase Order (PO)"; narasi hanya nama lengkapnya.
- Setiap kalimat narasi menceritakan satu aksi yang memang terlihat, urut sama dengan kolom "Di layar".
- Baris 2 setiap naskah adalah `Daftar isi`. Perekam memasang kartu daftar isi di situ setelah rekaman selesai, dengan
  menit mulai tiap bab dari `bab("...")` di skrip. Bab yang sama juga ditulis sebagai chapter di MP4 dan di
  `<video>.bab.txt` (baris `0:00 Judul`, siap ditempel ke deskripsi YouTube).
- Perekam menunggu status mesin benar-benar berubah sebelum lanjut (`pilihStatus`).
- Narasi yang menyebut stok berubah wajib menunjukkan angkanya: setelah Kirim, buka **Tampilan**, **Kartu Stok**
  (`bukuStok()`) dan tunjuk selnya (`selLaporan("In Qty")`, `"Out Qty"`, `"Balance Qty"`; label Inggris, diterjemahkan sendiri).
- Tanggal di tabel dipilih lewat kalender (`pilihTanggal`), bukan diketik. Baris tabel butuh sekitar 0,3 detik
  untuk siap: huruf yang diketik lebih cepat dari itu hilang ("10-12-2026" jadi "12-2026", lalu "Invalid date"),
  jadi `isiSel` selalu jeda dulu sebelum mengetik.
- Setiap ketikan (`ketik`) jeda 1 detik setelah kolom diklik, seperti orang melihat kolomnya dulu (Abel 2026-11-27).

Laptop harus longgar saat rekam: memori penuh (swap hampir habis) membuat Lantai Produksi butuh 60 detik untuk tampil
dan klik status tidak dijawab. Tutup aplikasi dan container yang tidak dipakai, dan colokkan charger.

```bash
caffeinate -i node --env-file=../erp-internal-bench/.env tools/rekam_demo.mjs ringkas-operator ~/Desktop/video-panduan/ringkas-operator.mp4
```

## Ringkas

| Video | Untuk | Naskah |
|---|---|---|
| Operator: kerja harian | Produksi | [ringkas-operator.md](ringkas-operator.md) |
| Admin: kerja harian | Admin | [ringkas-admin.md](ringkas-admin.md) |

## Lengkap

| Kode | Video | Untuk | Naskah |
|---|---|---|---|
| P1 | Operator: mulai | Produksi | [lengkap-p1-operator-mulai.md](lengkap-p1-operator-mulai.md) |
| P2 | Operator: kerja harian lengkap | Produksi | [lengkap-p2-operator-kerja-harian.md](lengkap-p2-operator-kerja-harian.md) |
| A1 | Admin: mulai | Admin | [lengkap-a1-admin-mulai.md](lengkap-a1-admin-mulai.md) |
| A2 | Data barang | Admin | [lengkap-a2-data-barang.md](lengkap-a2-data-barang.md) |
| A3 | Mesin dan resep | Admin | [lengkap-a3-mesin-dan-resep.md](lengkap-a3-mesin-dan-resep.md) |
| A4 | Stok awal | Admin | [lengkap-a4-stok-awal.md](lengkap-a4-stok-awal.md) |
| A5 | Pembelian | Admin | [lengkap-a5-pembelian.md](lengkap-a5-pembelian.md) |
| A6 | Penjualan | Admin | [lengkap-a6-penjualan.md](lengkap-a6-penjualan.md) |
| A7 | Produksi dari sisi Admin | Admin | [lengkap-a7-produksi.md](lengkap-a7-produksi.md) |
| A8 | Gudang dan kirim | Admin | [lengkap-a8-gudang-dan-kirim.md](lengkap-a8-gudang-dan-kirim.md) |
| A9 | Biaya | Admin | [lengkap-a9-biaya.md](lengkap-a9-biaya.md) |
| A10 | Cek data dan rencana | Admin | [lengkap-a10-cek-data-dan-rencana.md](lengkap-a10-cek-data-dan-rencana.md) |
| H1 | HR: karyawan, absen, cuti | Admin | [lengkap-h1-hr.md](lengkap-h1-hr.md) |
| S1 | Super Admin | Super Admin | [lengkap-s1-super-admin.md](lengkap-s1-super-admin.md) |

Projects (proyek dan timesheet) tidak dibuat videonya: belum dipakai di pabrik.

## Status rekaman

| Video | Skenario di `rekam_demo.mjs` | Rekaman |
|---|---|---|
| `ringkas-operator` | ada (narasi per kalimat, daftar isi) | disetujui Abel 2026-11-27; rekam lagi setelah akun contoh jadi `operator@` |
| `ringkas-admin` | ada (narasi per kalimat, daftar isi) | rekam ulang 2026-11-27 (putaran 2 dan 3), menunggu penilaian Abel |
| 14 video Lengkap | belum | belum |

Penolong form di `rekam_demo.mjs` (`menu`, `baru`, `isiLink`, `isiKolom`, `isiSel`, `simpan`, `ajukan`,
`lampirkan`, `cetak`, `bukuStok`, `selLaporan`, `bacaBaris`, `siapkanDokumen`) dipakai ulang untuk skenario berikutnya. Label layar bahasa
Indonesia bisa beda dari naskah: "Material Receipt" tampil "Nota Penerimaan Barang", tombol status mesin
"Produksi", "Masalah", dan seterusnya.
