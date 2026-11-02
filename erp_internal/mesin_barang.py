"""Mas Samuel's item-to-machine list (2026-11-02): which product runs on which machine, as Machine Capacity rows
and their BOMs.

    bench --site erp.localhost execute erp_internal.mesin_barang.muat

Reads `data/mesin_barang.json` (sheet "Mesin & Kapasitas": each machine with the products it moulds) and makes
one Machine Capacity row per template + Jenis and machine. The figures come from the sales Excel's
specifications (`penjualan_2026.json` `spesifikasi`): cycle time, kg per piece (stored in grams) and material;
"( n )" after a name is the mould's cavities on that machine and wins over the specification's. A product with
parts on one machine (Toples Nastar: body and lid) takes the sum of the parts' cycle times. Then
`buat_bom_kapasitas` makes each row's BOMs.

Run after `master.muat` and `penjualan.muat` (the templates, Jenis and raw materials come from there).
Idempotent: a second run writes nothing. A row whose pair left the file stays (disable it by hand); a name with
no product (`barang` maps it to []) is listed in `catatan` for Samuel.
"""

import re

import frappe

from erp_internal import master, penjualan
from erp_internal.planning.kapasitas import buat_bom_kapasitas

BERKAS = "mesin_barang.json"
RONGGA = re.compile(r"\(\s*(\d+)\s*\)")  # "Gantungan Pita ( 4 )": 4 cavities


def muat(company: str | None = None) -> dict:
	"""Create or correct the capacity rows and their BOMs. Returns the counts, how many records were written
	this run (`ditulis`, 0 on a second run) and the names with no product (`catatan`)."""
	company = company or penjualan._perusahaan()
	hasil = master.Hasil()
	baris = rencana(master.berkas(BERKAS), master.berkas(penjualan.BERKAS), hasil)
	for b in baris:
		nama = hasil.simpan(
			"Machine Capacity",
			{"item": b["item"], "jenis": b["jenis"], "workstation": b["workstation"]},
			{k: b[k] for k in ("cycle_time", "cavities", "part_weight", "material")},
			{"item": b["item"], "jenis": b["jenis"], "workstation": b["workstation"]},
		)
		bom = buat_bom_kapasitas(nama, company)
		hasil.ditulis += len(bom["dibuat"]) + len(bom["nonaktif"])
	return {
		"pasangan": sum(len(m["barang"]) for m in master.berkas(BERKAS)["mesin"]),
		"kapasitas": len(baris),
		"ditulis": hasil.ditulis,
		"catatan": hasil.catatan,
	}


def nama_barang(teks: str) -> tuple[str, int | None]:
	"""A sheet cell as (name, cavities or None): "Gantungan Pita ( 4 )" -> ("Gantungan Pita", 4)."""
	cocok = RONGGA.search(teks)
	return RONGGA.sub("", teks).strip(), int(cocok.group(1)) if cocok else None


def rencana(data: dict, penjualan_data: dict, hasil: master.Hasil) -> list[dict]:
	"""The capacity rows the file asks for, one per template + Jenis and machine (parts of one product on one
	machine merged). Writes nothing."""
	spek = {s["no"]: s for s in penjualan_data["spesifikasi"]}
	baris = {}
	for m in data["mesin"]:
		mesin = f"Mesin {m['no']:02d}"
		for teks in m["barang"]:
			nama, rongga = nama_barang(teks)
			if nama not in data["barang"]:
				frappe.throw(f"{BERKAS}: {nama!r} is not mapped in 'barang'")
			if not data["barang"][nama]:
				hasil.catat(f"{nama} (Mesin {m['no']:02d}): no product yet")
			for item, jenis, no in data["barang"][nama]:
				s = spek[no]
				kunci = (item, jenis, mesin)
				if kunci in baris:  # the next part of a product already on this machine
					continue
				baris[kunci] = {
					"item": item,
					"jenis": jenis,
					"workstation": mesin,
					"cycle_time": sum(p["cycle_time"] for p in s["bagian"]) or s["cycle_time"],
					"cavities": rongga or s["cavity"],
					"part_weight": round(s["berat_kg"] * 1000, 3),
					"material": s["bahan"],
				}
	return list(baris.values())
