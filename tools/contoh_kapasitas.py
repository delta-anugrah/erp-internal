"""Make erp_internal/tests/data/kapasitas.xlsx, the sample file of the machine capacity import.

    ~/Desktop/Projects/erp-internal-bench/env/bin/python tools/contoh_kapasitas.py

Our own made-up layout with Indonesian headers: six good rows (a template + Jenis, a template alone with the
product name in lower case, a plain item by its code, the `Mesin 03` spelling, the `Warna DX` spelling with a
`2,5` decimal, an item named in lower case) and four bad ones (unknown product, unknown material, machine 99, the
ambiguous `1.250`). The names it uses (`_UJI-IMP`, `_UJI-IMP-SATU`, `_UJI-PP`, `_UJI-MB`, machines 1 to 5) are the
fixtures of `tests/test_impor_kapasitas.py`, so the sample imports on a clean test site and never collides with
real data. Data row N sits on Excel row N + 1 (row 1 is the header): the bad ones are rows 8 to 11.
"""

import sys
from pathlib import Path

from openpyxl import Workbook

KEPALA = (
	"Kode Barang",
	"Produk",
	"Jenis",
	"No Mesin",
	"Cycle Time (detik)",
	"Cavity",
	"Berat (gram)",
	"Berat Runner",
	"Bahan",
	"Masterbatch",
	"MB %",
)

BARIS = (
	# the good ones
	(None, "_UJI-IMP", "Super", 1, 20, 4, 50, 12, "_UJI-PP", "_UJI-MB", 2),
	(None, "_uji-imp", None, 2, 18, 2, 80, 10, "_UJI-PP", None, None),
	("_UJI-IMP-SATU", None, None, 1, 25, 1, 120, 0, "_UJI-PP", None, None),
	(None, "_UJI-IMP", "DX", "Mesin 03", 22, 4, 40, 8, "_UJI-PP", "_UJI-MB", 3),
	(None, "_UJI-IMP", "Warna DX", 4, "2,5", 8, 30, 6, "_UJI-PP", None, None),
	(None, "_UJI-IMP", "Super", 5, 20, 4, 50, 12, "_uji-pp", "_uji-mb", "1,5"),
	# the bad ones
	(None, "_UJI-TIDAKADA", "Super", 1, 20, 4, 50, 12, "_UJI-PP", None, None),
	(None, "_UJI-IMP", "DX", 1, 20, 4, 50, 12, "_UJI-BAHAN-GAIB", None, None),
	(None, "_UJI-IMP", "DX", 99, 20, 4, 50, 12, "_UJI-PP", None, None),
	(None, "_UJI-IMP", "DX", 2, "1.250", 4, 50, 12, "_UJI-PP", None, None),
)


def buat(tujuan: Path) -> None:
	buku = Workbook()
	lembar = buku.active
	lembar.title = "Kapasitas"
	lembar.append(KEPALA)
	for baris in BARIS:
		lembar.append(baris)
	tujuan.parent.mkdir(parents=True, exist_ok=True)
	buku.save(tujuan)


if __name__ == "__main__":
	akar = Path(__file__).resolve().parent.parent
	buat(
		Path(sys.argv[1])
		if len(sys.argv) > 1
		else akar / "erp_internal" / "tests" / "data" / "kapasitas.xlsx"
	)
