"""Mas Samuel's real master data: the Dinda House Ware price list and the injection moulding machines.

    bench --site erp.localhost execute erp_internal.master.muat

Reads `data/katalog.json` (the price list "POLA PLASTIK TAHUN 2026", as Samuel sent it) and `data/mesin.json`
(the 14 machines) and creates or corrects:

- one Item template per product in "Barang Jadi", brand "Dinda House Ware", with only the variants the list
  names (attributes Jenis, Warna, and Ukuran for Toples Dinda), never every combination;
- the UOMs of each variant in Pcs (Lusin 12, Gross 144, and its Ball/Dus/Ikat from the packing text);
- the selling Price List "Harga Pola <year>" with one Item Price per variant and packing the list prices, and the
  Sales Order default while that is still "Standard Selling";
- one Workstation per machine, "Mesin 01".."Mesin 14", of type Injection Moulding; a machine with `"aktif": false`
  is disabled and Off (no new Work Order on it, `kapasitas.mesin_aktif`);
- the Seal Cap line of `data/seal_cap.json` (`seal_cap.muat`).

Idempotent: every record is looked up by its key and saved only when it differs, so a second run writes nothing.
Rerun it after Samuel sends a new file (docs/impor.md). It removes nothing but the price list's own prices that
the file no longer has; an item or machine left out of the file stays (disable it by hand).
"""

import html
import json
import re

import frappe
from erpnext.controllers.item_variant import copy_attributes_to_variant, get_variant, make_variant_item_code
from frappe.utils import cint, flt

from erp_internal import setup

MEREK = "Dinda House Ware"
GRUP = "Barang Jadi"
JENIS_MESIN = "Injection Moulding"

# Item code of each product's template. A product missing here gets its name in capitals (`_kode`).
KODE = {
	"Gayung Lumba-Lumba": "GAYUNG-LUMBA",
	"Gantungan Dinda": "GANTUNGAN-DINDA",
	"Gantungan Pita": "GANTUNGAN-PITA",
	"Nampan Dinda": "NAMPAN-DINDA",
	"Gayung Bajigur": "GAYUNG-BAJIGUR",
	"Gantungan Flash": "GANTUNGAN-FLASH",
	"Baskom Dinda 303": "BASKOM-303",
	"Baskom Dinda 306": "BASKOM-306",
	"Ember Vincent 3 Galon": "EMBER-VINCENT-3G",
	"Ember Vincent 4 Galon": "EMBER-VINCENT-4G",
	"Piring Rotan": "PIRING-ROTAN",
	"Toples (UK: 1 1/2 KG)": "TOPLES-1.5KG",
	"Garpu Makan": "GARPU-MAKAN",
	"Gantungan Folding 20 Stick": "GANTUNGAN-FOLDING-20",
	"Toples Dinda": "TOPLES-DINDA",
	"Gantungan Baby Love": "GANTUNGAN-BABY-LOVE",
	"Pot UK 25 CM": "POT-25",
	"Keranjang Sampah": "KERANJANG-SAMPAH",
	"Baskom 20": "BASKOM-20",
	"Toples Nastar 1/2 Kg": "TOPLES-NASTAR",  # from the sales Excel (`penjualan.py`)
}
# A product whose "type" is a packing, not a model: each packing is its own template, with its own stock UOM.
# Sendok Makan's Pack is a packed product sold per pack (how many spoons a pack holds is not in the list); its
# Ball is loose spoons, 20 Gross a ball. (product, type) -> (code, name, stock UOM).
PISAH = {
	("Sendok Makan", "Pack"): ("SENDOK-MAKAN-PACK", "Sendok Makan Pack", "Pack"),
	("Sendok Makan", "Ball"): ("SENDOK-MAKAN", "Sendok Makan", "Pcs"),
	# From the sales Excel (`penjualan.py`): sold per "Ball Kecil", how many spoons it holds is not known yet.
	("Sendok Bebek Catering", "Ball Kecil"): ("SENDOK-BEBEK", "Sendok Bebek Catering", "Ball Kecil"),
}
# The list's spellings of one value (Baby Love's "Orens", Keranjang Sampah's "Warna DX").
SAMA = {
	"Jenis": {"Warna DX": "DX", "Super & Dx warna": "Super & DX"},
	"Warna": {"Orens": "Orange"},
}
# Abbreviations in the variant codes (GAYUNG-LUMBA-SPR-MRH). A value missing here gets its own letters (`_singkat`).
SINGKATAN = {
	"Jenis": {
		"Super": "SPR",
		"DX": "DX",
		"Hitam": "HTM",
		"Super & DX": "SDX",
		"Bening": "BNG",
		"Standard": "STD",
		"Soft": "SFT",
		"DX Soft": "DXS",
	},
	"Warna": {
		"Merah": "MRH",
		"Biru": "BRU",
		"Hijau": "HJU",
		"Ungu": "UNG",
		"Orange": "ORG",
		"Kuning": "KNG",
		"Pink": "PNK",
		"Hitam": "HTM",
		"Gold": "GLD",
		"Coklat": "CKL",
		"Bening": "BNG",
		"Bening Transparan": "BTR",
		"Putih Susu": "PTS",
		"Campur": "CMP",
		# The Seal Cap colours (`seal_cap.py`)
		"Coklat Muda": "CKM",
		"Putih": "PTH",
		"Neutral": "NTR",
	},
	"Ukuran": {"1 KG": "1KG", "1,5 KG": "1.5KG"},
}
# Pieces per unit. Ball, Dus and Ikat come from each variant's packing text.
ISI = {"Lusin": 12, "Gross": 144}
# The list's price keys -> UOM.
HARGA = {
	"price_per_lusin": "Lusin",
	"price_per_gross": "Gross",
	"price_per_ball": "Ball",
	"price_per_dus": "Dus",
	"price_per_pack": "Pack",
}
WADAH = ("Ball", "Dus", "Ikat")  # packings whose content the packing text gives


def berkas(nama: str) -> dict:
	with open(frappe.get_app_path("erp_internal", "data", nama)) as f:
		return json.load(f)


def muat() -> dict:
	"""Create or correct the products, prices and machines. Returns the counts, how many records were written
	this run (`ditulis`, 0 on a second run) and what the file left open (`catatan`)."""
	hasil = Hasil()
	katalog = berkas("katalog.json")
	daftar = daftar_harga(katalog)
	setup._satuan()  # the packing UOMs, whole numbers (also on every migrate)
	setup._varian()
	hasil.simpan("Brand", MEREK, {"brand": MEREK})
	_merek(hasil)
	hasil.simpan(
		"Price List", daftar, {"price_list_name": daftar, "selling": 1, "buying": 0, "currency": "IDR"}
	)
	_harga_bawaan(daftar, hasil)

	produk = produk_katalog(katalog)
	_atribut(produk, hasil)
	harga = {}
	for p in produk:
		_template(p, hasil)
		for v in p["varian"]:
			_varian(p, v, hasil, harga)
	_harga(daftar, harga, hasil)

	hasil.simpan("Workstation Type", JENIS_MESIN, {"workstation_type": JENIS_MESIN})
	mesin = berkas("mesin.json")["machines"]
	for m in mesin:
		_mesin(m, hasil)

	from erp_internal import seal_cap  # it builds on this module

	seal_cap.muat(hasil)

	return {
		"template": len(produk),
		"varian": sum(len(p["varian"]) for p in produk),
		"harga": len(harga),
		"mesin": len(mesin),
		"daftar_harga": daftar,
		"ditulis": hasil.ditulis,
		"catatan": hasil.catatan,
	}


def _merek(hasil: "Hasil") -> None:
	"""The Seal Cap brand codes (customer EPP) with their insert counts. The count and the note are only the
	first load's: Admin keeps the count current afterwards."""
	for b in berkas("merek_epp.json"):
		hasil.simpan(
			"Brand",
			b["merk"],
			{"brand": b["merk"]},
			{"erp_jumlah_insert": b["insert"], "description": b["ket"]},
		)


HARGA_STANDAR = {
	"selling_price_list": ("Selling Settings", "Standard Selling"),
	"buying_price_list": ("Buying Settings", "Standard Buying"),
}


def _harga_bawaan(daftar: str, hasil: "Hasil", kunci: str = "selling_price_list") -> None:
	"""Make `daftar` the new order's price list while it is still ERPNext's empty standard list (an order
	otherwise came at price 0); a list someone chose stays. The global default the forms and the server
	actually read is kept equal to the setting: `set_single_value` skips the Settings' validate that copies it."""
	pengaturan, standar = HARGA_STANDAR[kunci]
	nilai = frappe.db.get_single_value(pengaturan, kunci)
	if nilai in (None, "", standar):
		frappe.db.set_single_value(pengaturan, kunci, daftar)
		nilai = daftar
		hasil.ditulis += 1
	if frappe.db.get_default(kunci) != nilai:
		frappe.db.set_default(kunci, nilai)
		hasil.ditulis += 1


class Hasil:
	"""Counts the records written and collects the notes on what the file left open."""

	def __init__(self):
		self.ditulis = 0
		self.catatan = []

	def catat(self, teks: str) -> None:
		if teks not in self.catatan:
			self.catatan.append(teks)

	def simpan(self, doctype: str, nama: str | dict, nilai: dict, baru: dict | None = None) -> str:
		"""Get `nama` (a name or filters) or create it with `nilai` and `baru`; save `nilai`'s fields that
		differ. Child tables in `nilai` are compared as lists of their given fields."""
		ada = (
			frappe.db.get_value(doctype, nama) if isinstance(nama, dict) else frappe.db.exists(doctype, nama)
		)
		if not ada:
			doc = frappe.get_doc({"doctype": doctype, **nilai, **(baru or {})})
			doc.insert(ignore_permissions=True)
			self.ditulis += 1
			return doc.name
		doc = frappe.get_doc(doctype, ada)
		if _beda(doc, nilai):
			doc.update(nilai)
			doc.save(ignore_permissions=True)
			self.ditulis += 1
		return doc.name


def _beda(doc, nilai: dict) -> bool:
	for k, v in nilai.items():
		if isinstance(v, list):
			kini = [{f: d.get(f) for f in baris} for d, baris in zip(doc.get(k), v, strict=False)]
			if len(doc.get(k)) != len(v) or any(_beda_baris(a, b) for a, b in zip(kini, v, strict=True)):
				return True
		elif isinstance(v, int | float) and not isinstance(v, bool):
			if flt(doc.get(k)) != flt(v):
				return True
		elif html.unescape(str(doc.get(k) or "")) != (v or ""):  # a Text Editor stores & as &amp;
			return True
	return False


def _beda_baris(kini: dict, mau: dict) -> bool:
	return any(
		(flt(kini[f]) != flt(v)) if isinstance(v, int | float) else ((kini[f] or "") != (v or ""))
		for f, v in mau.items()
	)


def daftar_harga(katalog: dict) -> str:
	"""The price list's name from the file's title: "POLA PLASTIK TAHUN 2026" -> "Harga Pola 2026". A new
	year's file makes a new list; the old one stays."""
	tahun = re.search(r"\d{4}", katalog["document_info"]["title"])
	return f"Harga Pola {tahun.group()}" if tahun else "Harga Pola"


def produk_katalog(katalog: dict) -> list[dict]:
	"""The file's products as templates: [{kode, nama, satuan, atribut, dimensi, varian: [{nilai, kemasan,
	harga, dimensi}]}], one entry per colour of each variant, values normalised (`SAMA`)."""
	hasil, per_kode = [], {}
	for p in katalog["products"]:
		for v in p["variants"]:
			jenis = v.get("type")
			kode, nama, satuan = PISAH.get((p["name"], jenis)) or (_kode(p["name"]), p["name"], "Pcs")
			if kode not in per_kode:
				per_kode[kode] = {
					"kode": kode,
					"nama": nama,
					"satuan": satuan,
					"atribut": [],
					"dimensi": p.get("dimensions") or {},
					"varian": [],
				}
				hasil.append(per_kode[kode])
			t = per_kode[kode]
			dasar = {}
			if (p["name"], jenis) not in PISAH and jenis:
				dasar["Jenis"] = SAMA["Jenis"].get(jenis, jenis)
			if v.get("size"):
				dasar["Ukuran"] = v["size"]
			for warna in v["colors"]:
				nilai = {**dasar, "Warna": SAMA["Warna"].get(warna, warna)}
				for a in nilai:
					if a not in t["atribut"]:
						t["atribut"].append(a)
				t["varian"].append(
					{
						"nilai": nilai,
						"kemasan": v.get("packaging") or "",
						"harga": {HARGA[k]: flt(n) for k, n in v.items() if k in HARGA},
						"dimensi": v.get("dimensions") or t["dimensi"],
					}
				)
	for t in hasil:
		# Jenis first, Warna last, as the codes read: TOPLES-DINDA-1KG-BNG.
		t["atribut"].sort(key=["Jenis", "Ukuran", "Warna"].index)
	return hasil


def _kode(nama: str) -> str:
	return KODE.get(nama) or re.sub(r"[^A-Z0-9]+", "-", nama.upper()).strip("-")


def _singkat(atribut: str, nilai: str) -> str:
	return SINGKATAN.get(atribut, {}).get(nilai) or re.sub(r"[^A-Z0-9.]+", "", nilai.upper())[:6]


def ukuran(dimensi: dict) -> str:
	"""The dimensions as the list writes them: numbers are mm ("T 120, Q 148 mm"), text keeps its unit."""
	if not dimensi:
		return ""
	teks = ", ".join(f"{k} {v}" for k, v in dimensi.items())
	return f"{teks} mm" if all(isinstance(v, int | float) for v in dimensi.values()) else teks


def isi_kemasan(varian: dict, satuan: str) -> tuple[dict[str, float], list[str]]:
	"""A variant's UOMs in its stock UOM, from its packing text ("1 Ball (20 Lusin)", "1 Dus = 10 Lusin").
	A packing without its content ("per ball") takes the price ratio when it is a whole number of lusin or
	gross (a note says so); one that gives no figure at all is left out (noted)."""
	uom = dict(ISI) if satuan == "Pcs" else {}
	catatan = []
	teks = varian["kemasan"].lower()
	wadah = next((w for w in WADAH if w.lower() in teks), None)
	if not wadah:
		return uom, catatan
	isi = re.search(r"(\d+)\s*(lusin|gross|pack)", teks)
	if isi:
		n, unit = int(isi.group(1)), isi.group(2).title()
		faktor = 1 if unit == satuan else ISI.get(unit)
		if faktor:
			uom[wadah] = n * faktor
		else:
			catatan.append(f"{wadah} = {n} {unit}: how many {satuan} a {unit} holds is not in the list")
		return uom, catatan
	harga = varian["harga"]
	for unit in ("Lusin", "Gross"):
		if harga.get(wadah) and harga.get(unit) and satuan == "Pcs":
			n = harga[wadah] / harga[unit]
			if n == int(n):
				uom[wadah] = int(n) * ISI[unit]
				catatan.append(
					f"{wadah} = {int(n)} {unit} from the price ratio (packing says only {varian['kemasan']!r})"
				)
				return uom, catatan
	catatan.append(f"{wadah}: content not in the list ({varian['kemasan']!r})")
	return uom, catatan


def _atribut(produk: list[dict], hasil: Hasil) -> None:
	"""Item Attributes Jenis, Warna, Ukuran with every value the file uses. Existing values keep their
	abbreviation: changing one renames every variant that uses it."""
	nilai = {}
	for p in produk:
		for v in p["varian"]:
			for a, n in v["nilai"].items():
				nilai.setdefault(a, [])
				if n not in nilai[a]:
					nilai[a].append(n)
	for a, daftar in nilai.items():
		if not frappe.db.exists("Item Attribute", a):
			frappe.get_doc(
				{
					"doctype": "Item Attribute",
					"attribute_name": a,
					"item_attribute_values": [{"attribute_value": n, "abbr": _singkat(a, n)} for n in daftar],
				}
			).insert(ignore_permissions=True)
			hasil.ditulis += 1
			continue
		doc = frappe.get_doc("Item Attribute", a)
		ada = {d.attribute_value for d in doc.item_attribute_values}
		baru = [n for n in daftar if n not in ada]
		for n in baru:
			doc.append("item_attribute_values", {"attribute_value": n, "abbr": _singkat(a, n)})
		if baru:
			doc.save(ignore_permissions=True)
			hasil.ditulis += 1


def _template(p: dict, hasil: Hasil) -> None:
	# The template holds the units every variant shares; a variant adds its own packings (`_varian`).
	uom = {p["satuan"]: 1, **(ISI if p["satuan"] == "Pcs" else {})}
	keterangan = ". ".join(x for x in (p["nama"], ukuran(p["dimensi"]), MEREK) if x) + "."
	nilai = {
		"item_name": p["nama"],
		"item_group": GRUP,
		"brand": MEREK,
		"description": keterangan,
		"uoms": [{"uom": u, "conversion_factor": f} for u, f in uom.items()],
	}
	baru = {
		"item_code": p["kode"],
		"stock_uom": p["satuan"],
		"is_stock_item": 1,
		"has_variants": 1,
		"variant_based_on": "Item Attribute",
		"attributes": [{"attribute": a} for a in p["atribut"]],
	}
	if frappe.db.exists("Item", p["kode"]):
		kini = [d.attribute for d in frappe.get_doc("Item", p["kode"]).attributes]
		if kini != p["atribut"]:
			hasil.catat(
				f"{p['kode']}: attributes {kini} kept, the file now has {p['atribut']} (change by hand)"
			)
	hasil.simpan("Item", p["kode"], nilai, baru)


def _varian(p: dict, v: dict, hasil: Hasil, harga: dict) -> None:
	uom, catatan = isi_kemasan(v, p["satuan"])
	nama = nama_varian(p["nama"], v["nilai"])
	# Notes are per packing, not per colour: "Baskom Dinda 303 DX".
	kelompok = nama_varian(p["nama"], {a: n for a, n in v["nilai"].items() if a != "Warna"})
	for c in catatan:
		hasil.catat(f"{kelompok}: {c}")
	keterangan = (
		". ".join(x for x in (nama, ukuran(v["dimensi"]), v["kemasan"] and f"Kemasan: {v['kemasan']}") if x)
		+ "."
	)
	nilai = {
		"item_name": nama,
		"description": keterangan,
		# The stock UOM's own row first, as ERPNext keeps it.
		"uoms": [{"uom": u, "conversion_factor": f} for u, f in {p["satuan"]: 1, **uom}.items()],
	}
	kode = get_variant(p["kode"], v["nilai"])
	if not kode:
		template = frappe.get_doc("Item", p["kode"])
		doc = frappe.new_doc("Item")
		doc.variant_based_on = "Item Attribute"
		doc.set("attributes", [{"attribute": a, "attribute_value": n} for a, n in v["nilai"].items()])
		copy_attributes_to_variant(template, doc)
		make_variant_item_code(template.item_code, template.item_name, doc)
		doc.update(nilai)
		doc.insert(ignore_permissions=True)
		hasil.ditulis += 1
		kode = doc.name
	else:
		hasil.simpan("Item", kode, nilai)

	if not v["harga"]:
		hasil.catat(f"{p['nama']}: no price in the list")
	for u, rate in v["harga"].items():
		if u in uom or u == p["satuan"]:
			harga[(kode, u)] = rate
		else:
			hasil.catat(f"{kelompok}: price per {u} left out, the item has no {u} UOM")
		# The list's own arithmetic: a packing's price against its content times the base price.
		for dasar in ("Lusin", "Gross"):
			if u in WADAH and u in uom and v["harga"].get(dasar):
				hitung = v["harga"][dasar] * uom[u] / ISI[dasar]
				if hitung != rate:
					hasil.catat(
						f"{kelompok}: {u} {rate:,.0f} vs {uom[u] // ISI[dasar]} x {dasar} = {hitung:,.0f}"
					)


def nama_varian(nama: str, nilai: dict) -> str:
	"""Template name and values, a repeated word once: "Pot UK 25 CM Hitam", not "... Hitam Hitam"."""
	kata = [nama]
	for n in nilai.values():
		if n != kata[-1]:
			kata.append(n)
	return " ".join(kata)


def _harga(daftar: str, harga: dict, hasil: Hasil) -> None:
	"""One Item Price per (variant, UOM); this list's prices the file no longer has are deleted."""
	for (kode, uom), rate in harga.items():
		hasil.simpan(
			"Item Price",
			{"item_code": kode, "price_list": daftar, "uom": uom, "customer": ("is", "not set")},
			{"price_list_rate": rate},
			{"item_code": kode, "price_list": daftar, "uom": uom},
		)
	for d in frappe.get_all("Item Price", {"price_list": daftar}, ["name", "item_code", "uom"]):
		if (d.item_code, d.uom) not in harga:
			frappe.delete_doc("Item Price", d.name, ignore_permissions=True)
			hasil.ditulis += 1


def _mesin(m: dict, hasil: Hasil) -> None:
	nama = f"Mesin {cint(m['no']):02d}"
	tonase = cint(re.sub(r"\D", "", str(m["tonase"])))
	aktif = m.get("aktif", True)  # false: not in use for now (Samuel 2026-11-02); no new Work Order on it
	hasil.simpan(
		"Workstation",
		nama,
		{
			"workstation_type": JENIS_MESIN,
			"erp_nomor": cint(m["no"]),
			"erp_merek": m["mesin"],
			"erp_model": m["model"],
			"erp_tonase": tonase,
			"erp_tahun": cint(m["year"]),
			"erp_negara": m["country"],
			"description": f"{m['mesin']} {m['model']}, {tonase} ton, {m['country']} {m['year']}.",
			"disabled": 0 if aktif else 1,
			# An inactive machine stands still: Off on the Production Floor. An active one keeps its status.
			**({} if aktif else {"status": "Off"}),
		},
		{"workstation_name": nama},
	)
