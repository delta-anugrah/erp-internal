"""Mas Samuel's sales Excel (2026-10-29): sales January-September 2026, raw materials and their price per kg,
and a minimum stock derived from the sales.

    bench --site erp.localhost execute erp_internal.penjualan.muat

Reads `data/penjualan_2026.json` (both tables of the Excel, as Abel pasted them) and creates or corrects:

- the types and products the Excel sells but the price list lacks (`produk_baru`, made with `master.py`'s own
  helpers; colours assumed, no price): Soft, DX Soft, Gantungan Dinda Hitam, Toples Nastar, Sendok Bebek;
- one raw material Item per material (group Bahan Baku, stock in Kg, valuation rate = its price) and its price
  in the buying Price List `HARGA_BAHAN`, the Purchase Order default while Buying Settings still says Standard
  Buying (`master._harga_bawaan`);
- Sales History: each Excel row's monthly quantity in the stock UOM, spread evenly over the colour variants of
  its product and type (the Excel has no colours; Abel 2026-10-29), whole units, the remainder to the first
  variants by code;
- each of those variants' `safety_stock`: `STOK_MIN_BULAN` of its average month in the file, rounded up.

Run `master.muat` first: the templates and their variants come from there. Idempotent like `master.muat`: a
second run writes nothing. The Excel's specifications (cycle time, cavities, kg per pcs, material) are kept in
the file for the Machine Capacity rows that `mesin_barang.py` makes from Samuel's item-to-machine list.
"""

import frappe
from frappe import _
from frappe.utils import getdate

from erp_internal import master, setup
from erp_internal.planning.kapasitas import ATRIBUT_WARNA, TEMPLATE_PIGMEN
from erp_internal.planning.rumus import bulatkan

BERKAS = "penjualan_2026.json"
HARGA_BAHAN = "Harga Bahan Baku"
GRUP_BAHAN = "Bahan Baku"
GRUP_PIGMEN = "Pigmen"
STOK_MIN_BULAN = 0.5  # minimum stock = half an average month's sales, about two weeks (Abel, 2026-10-29)


def muat(company: str | None = None) -> dict:
	"""Load the file into `company` (default: the one company run by this app). Returns the counts, how many
	records were written this run (`ditulis`, 0 on a second run) and the notes (`catatan`)."""
	company = company or _perusahaan()
	hasil = master.Hasil()
	data = master.berkas(BERKAS)
	setup._satuan()
	setup._varian()

	produk = master.produk_katalog({"products": data["produk_baru"]})
	master._atribut(produk, hasil)
	for p in produk:
		if not frappe.db.exists("Item", p["kode"]):
			master._template(p, hasil)
		for v in p["varian"]:
			master._varian(p, v, hasil, {})

	_bahan(data["bahan_baku"], hasil)
	_pigmen(hasil)
	per_varian = riwayat(data, hasil)
	_riwayat(company, per_varian, hasil)
	_stok_minimum(per_varian, len(data["bulan"]), hasil)
	return {
		"produk_baru": len(produk),
		"bahan_baku": len(data["bahan_baku"]),
		"baris_excel": len(data["penjualan"]),
		"varian": len(per_varian),
		"riwayat": sum(1 for q in per_varian.values() for n in q.values() if n),
		"ditulis": hasil.ditulis,
		"catatan": hasil.catatan,
	}


def _perusahaan() -> str:
	daftar = setup.perusahaan()
	if len(daftar) != 1:
		frappe.throw(_("Name the company: {0} companies are run by this app.").format(len(daftar)))
	return daftar[0]


def varian(template: str, jenis: str | None) -> list[str]:
	"""The enabled variants of `template` with attribute Jenis = `jenis` (all of them for None), by code."""
	nama = frappe.get_all("Item", {"variant_of": template, "disabled": 0}, pluck="name", order_by="name asc")
	if jenis is None or not nama:
		return nama
	cocok = set(
		frappe.get_all(
			"Item Variant Attribute",
			{"parent": ("in", nama), "attribute": "Jenis", "attribute_value": jenis},
			pluck="parent",
		)
	)
	return [n for n in nama if n in cocok]


def bagi(jumlah: int, n: int) -> list[int]:
	"""`jumlah` in `n` whole parts that add up to it, the larger ones first: bagi(10, 3) == [4, 3, 3]."""
	dasar, sisa = divmod(jumlah, n)
	return [dasar + (1 if i < sisa else 0) for i in range(n)]


def _faktor(kode: str, satuan: str) -> float | None:
	if frappe.db.get_value("Item", kode, "stock_uom") == satuan:
		return 1
	return frappe.db.get_value("UOM Conversion Detail", {"parent": kode, "uom": satuan}, "conversion_factor")


def riwayat(data: dict, hasil: master.Hasil) -> dict[str, dict[str, int]]:
	"""Variant -> month ("2026-01") -> quantity in its stock UOM, every Excel row spread over its variants."""
	per_varian = {}
	for baris in data["penjualan"]:
		kode = [k for template, jenis in baris["barang"] for k in varian(template, jenis)]
		if not kode:
			hasil.catat(f"{baris['nama']}: no variant of {baris['barang']} (run master.muat first?)")
			continue
		faktor = {_faktor(k, baris["satuan"]) for k in kode}
		if len(faktor) != 1 or None in faktor:
			hasil.catat(f"{baris['nama']}: its variants have no single {baris['satuan']} factor ({faktor})")
			continue
		f = faktor.pop()
		for bulan, qty in baris["qty"].items():
			for k, bagian in zip(kode, bagi(round(qty * f), len(kode)), strict=True):
				per_varian.setdefault(k, {})[bulan] = bagian
	return per_varian


def _riwayat(company: str, per_varian: dict[str, dict[str, int]], hasil: master.Hasil) -> None:
	"""One Sales History row per variant and month that sold something; an existing row follows the file (0 too)."""
	for kode, per_bulan in per_varian.items():
		for bulan, qty in per_bulan.items():
			kunci = {"company": company, "item_code": kode, "bulan": getdate(f"{bulan}-01")}
			if not qty and not frappe.db.exists("Sales History", kunci):
				continue
			hasil.simpan("Sales History", kunci, {"qty": qty}, kunci)


def _stok_minimum(per_varian: dict[str, dict[str, int]], bulan: int, hasil: master.Hasil) -> None:
	for kode, per_bulan in per_varian.items():
		rata = sum(per_bulan.values()) / bulan
		hasil.simpan("Item", kode, {"safety_stock": bulatkan(rata * STOK_MIN_BULAN)})


def _pigmen(hasil: master.Hasil) -> None:
	"""The pigment template (spec section 8, A1): one variant per colour (`Warna`), stocked in grams, bought
	per Kg (1 Kg = 1000 g). Samuel's list of pigments is still to come: Admin adds the variants."""
	hasil.simpan(
		"Item",
		TEMPLATE_PIGMEN,
		{
			"item_name": "Pigmen",
			"item_group": GRUP_PIGMEN,
			"purchase_uom": "Kg",
			"uoms": [{"uom": "Gram", "conversion_factor": 1}, {"uom": "Kg", "conversion_factor": 1000}],
		},
		{
			"item_code": TEMPLATE_PIGMEN,
			"stock_uom": "Gram",
			"is_stock_item": 1,
			"has_variants": 1,
			"variant_based_on": "Item Attribute",
			"attributes": [{"attribute": ATRIBUT_WARNA}],
		},
	)


def daftar_beli(hasil: master.Hasil) -> None:
	"""The buying price list `HARGA_BAHAN`, the purchase default while that is still ERPNext's standard one."""
	hasil.simpan(
		"Price List",
		HARGA_BAHAN,
		{"price_list_name": HARGA_BAHAN, "selling": 0, "buying": 1, "currency": "IDR"},
	)
	master._harga_bawaan(HARGA_BAHAN, hasil, "buying_price_list")


def _bahan(bahan: list[dict], hasil: master.Hasil) -> None:
	daftar_beli(hasil)
	for b in bahan:
		hasil.simpan(
			"Item",
			b["kode"],
			{
				"item_name": b["nama"],
				"item_group": GRUP_BAHAN,
				"description": f"{b['nama']}. Bahan baku, harga per kg dari Excel Mas Samuel 2026.",
				"valuation_rate": b["harga_kg"],
			},
			{"item_code": b["kode"], "stock_uom": "Kg", "is_stock_item": 1},
		)
		hasil.simpan(
			"Item Price",
			{"item_code": b["kode"], "price_list": HARGA_BAHAN, "uom": "Kg", "supplier": ("is", "not set")},
			{"price_list_rate": b["harga_kg"]},
			{"item_code": b["kode"], "price_list": HARGA_BAHAN, "uom": "Kg"},
		)
