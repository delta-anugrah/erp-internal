"""Excel import of machine capacity (spec "Excel import"): headers are read by meaning, every row is new,
changed, unchanged or refused with a reason, `pratinjau` writes nothing and `terapkan` writes in one request.

Samuel's file layout is unknown, so a column is found by its header's alias in `KOLOM_IMPOR`; a new alias is a
table edit. A product is named by item code, or by product name + Jenis the way `master.py` names them.
"""

import csv
import io
import os
import re

import frappe
from frappe import _
from frappe.utils import flt, strip_html

from erp_internal import master
from erp_internal.planning import kapasitas
from erp_internal.planning.kapasitas import buat_bom_kapasitas

# Column key -> the headers that mean it (after `normal()`: case, spaces and signs ignored; a `%` reads as
# "persen"). Each key's own English label is in its list.
KOLOM_IMPOR = {
	"item_code": ("item code", "kode barang", "kode item", "kode", "sku"),
	"produk": ("product", "produk", "nama produk", "nama barang", "barang", "item name"),
	"jenis": ("jenis", "tipe", "type"),
	"mesin": ("machine", "mesin", "no mesin", "nomor mesin", "no mc", "mc", "machine no"),
	"cycle_time": (
		"cycle time",
		"cycle",
		"ct",
		"siklus",
		"waktu siklus",
		"cycle (detik)",
		"cycle time (detik)",
	),
	"cavities": ("cavities", "cavity", "cav", "jumlah cavity", "kavitas"),
	"part_weight": ("part weight", "berat", "berat produk", "gram", "weight", "berat (gram)"),
	"runner_weight": ("runner weight", "runner", "sprue", "berat runner"),
	"material": ("material", "bahan", "bahan baku", "pp/hdpe"),
	"masterbatch": ("masterbatch", "batch warna"),
	"masterbatch_percent": ("masterbatch percent", "masterbatch %", "mb %", "mb", "persen mb"),
}

# What the file may hold: bytes of the file, data rows, columns read.
MAKS_BYTE = 2 * 1024 * 1024
MAKS_BARIS = 2000
MAKS_KOLOM = 40
BERKAS_BOLEH = (".xlsx", ".csv")

ANGKA = ("cycle_time", "part_weight", "runner_weight", "masterbatch_percent")
# The Machine Capacity fields a row of the file sets; a difference from the stored row makes it "Changed".
NILAI = (
	"cycle_time",
	"cavities",
	"part_weight",
	"runner_weight",
	"material",
	"masterbatch",
	"masterbatch_percent",
)


def normal(kepala) -> str:
	"""A header for comparison: lower case, `%` as "persen", every non-alphanumeric removed
	(`Cycle Time (detik)` -> `cycletimedetik`)."""
	return "".join(c for c in str(kepala).lower().replace("%", " persen ") if c.isalnum())


PETA = {normal(a): kunci for kunci, alias in KOLOM_IMPOR.items() for a in alias}


class Tolak(Exception):
	"""A row the import refuses; the message is the reason shown to the user."""


def angka(nilai) -> float:
	"""A number from a cell. Numbers pass through; text takes `2,5`/`2.5`, `1.250,5`, `1,250.5`; an empty cell is 0.
	`1.250` and `1,250` could be a thousand two hundred fifty or one and a quarter, so they raise
	`ValueError("ambiguous")`; anything else that is no number raises `ValueError("not a number")`."""
	if nilai is None:
		return 0.0
	if isinstance(nilai, bool):
		raise ValueError("not a number")
	if isinstance(nilai, int | float):
		return float(nilai)
	teks = re.sub(r"\s", "", str(nilai))
	if not teks:
		return 0.0
	tanda = -1 if teks[0] == "-" else 1
	teks = teks.lstrip("+-")
	if not re.fullmatch(r"[\d.,]+", teks) or not teks[0].isdigit() or not teks[-1].isdigit():
		raise ValueError("not a number")
	ada = [c for c in ".," if c in teks]
	if len(ada) == 2:
		# both: the last one is the decimal point, the other groups thousands
		desimal = teks[max(teks.rfind("."), teks.rfind(","))]
		ribuan = ".,".replace(desimal, "")
		bulat, _titik, pecahan = teks.rpartition(desimal)
		if ribuan not in bulat or desimal in bulat or not _kelompok(bulat.split(ribuan)):
			raise ValueError("not a number")
		return tanda * float(bulat.replace(ribuan, "") + "." + pecahan)
	if not ada:
		return tanda * float(teks)
	pemisah = ada[0]
	bagian = teks.split(pemisah)
	if len(bagian) > 2:
		if not _kelompok(bagian):
			raise ValueError("not a number")
		return tanda * float("".join(bagian))
	depan, belakang = bagian
	if len(belakang) == 3 and 1 <= len(depan) <= 3 and depan != "0":
		raise ValueError("ambiguous")
	return tanda * float(f"{depan}.{belakang}")


def _kelompok(bagian: list[str]) -> bool:
	"""The groups of a number written with thousands separators: 1 to 3 digits, then groups of exactly 3."""
	return 1 <= len(bagian[0]) <= 3 and all(len(b) == 3 for b in bagian[1:])


def _berkas(file_url) -> "frappe.model.document.Document":
	"""The File of `file_url` that the caller may read, as a `.xlsx` or `.csv`. Needs write on Machine Capacity."""
	for ptype in ("create", "write"):
		frappe.has_permission("Machine Capacity", ptype, throw=True)
	if not isinstance(file_url, str) or not file_url.lower().endswith(BERKAS_BOLEH):
		frappe.throw(_("Only .xlsx and .csv files can be imported."))
	# One answer for "no such file" and "not yours", so the URL of someone else's file is not confirmed.
	salah = frappe.PermissionError(_("You cannot read this file."))
	# Several File rows can share one URL: take one the caller may read.
	doc = None
	for nama in frappe.get_all(
		"File", {"file_url": file_url}, pluck="name", order_by="creation, name", limit=50
	):
		ada = frappe.get_doc("File", nama)
		if not (ada.is_folder or ada.is_remote_file) and ada.has_permission("read"):
			doc = ada
			break
	if not doc:
		raise salah
	if not (doc.file_name or "").lower().endswith(BERKAS_BOLEH):
		frappe.throw(_("Only .xlsx and .csv files can be imported."))
	return doc


def _isi(doc) -> bytes:
	"""The bytes of the File, read through Frappe's own path check, never above `MAKS_BYTE`."""
	path = doc.get_full_path()
	if not os.path.isfile(path) or os.path.getsize(path) > MAKS_BYTE:
		frappe.throw(_("The file is empty or larger than {0} MB.").format(MAKS_BYTE // (1024 * 1024)))
	with open(path, "rb") as f:
		isi = f.read(MAKS_BYTE + 1)
	if not isi or len(isi) > MAKS_BYTE:
		frappe.throw(_("The file is empty or larger than {0} MB.").format(MAKS_BYTE // (1024 * 1024)))
	return isi


def _sel(nilai):
	if hasattr(nilai, "isoformat"):
		return nilai.isoformat()
	return nilai


def _tabel(doc, isi: bytes):
	"""The rows of the file as lists of cells, the first sheet of an Excel file or a CSV."""
	if doc.file_name.lower().endswith(".xlsx"):
		from openpyxl import load_workbook

		try:
			buku = load_workbook(io.BytesIO(isi), read_only=True, data_only=True)
		except Exception:
			frappe.throw(_("The file is not a valid Excel file."))
		try:
			for baris in buku.worksheets[0].iter_rows(max_col=MAKS_KOLOM, values_only=True):
				yield [_sel(c) for c in baris]
		finally:
			buku.close()
		return
	try:
		teks = isi.decode("utf-8-sig")
	except UnicodeDecodeError:
		teks = isi.decode("cp1252")
	kepala = next((b for b in teks.splitlines() if b.strip()), "")
	pemisah = max(",;\t", key=kepala.count)
	for baris in csv.reader(io.StringIO(teks), delimiter=pemisah):
		yield baris[:MAKS_KOLOM]


def _baca(doc, asing: list | None = None) -> list[dict]:
	kolom, kepala_ada, hasil = {}, False, []
	for no, sel in enumerate(_tabel(doc, _isi(doc)), start=1):
		# The hard limit counts every row, blank ones too: a sheet of millions of empty rows must not run on.
		if no > MAKS_BARIS + 100:
			frappe.throw(_("The file has more than {0} rows.").format(MAKS_BARIS))
		if not any(str(c).strip() for c in sel if c is not None):
			continue
		if not kepala_ada:
			kepala_ada = True
			for i, h in enumerate(sel):
				if h is None or not str(h).strip():
					continue
				kunci = PETA.get(normal(h))
				if kunci and kunci not in kolom.values():
					kolom[i] = kunci
				elif asing is not None and str(h).strip() not in asing:
					asing.append(str(h).strip())
			continue
		if len(hasil) >= MAKS_BARIS:
			frappe.throw(_("The file has more than {0} rows.").format(MAKS_BARIS))
		baris = {"no": no}
		for i, kunci in kolom.items():
			if i < len(sel) and sel[i] is not None and str(sel[i]).strip() != "":
				baris[kunci] = sel[i]
		hasil.append(baris)
	if not kepala_ada:
		frappe.throw(_("The file is empty."))
	return hasil


def baca(file_url: str, asing: list | None = None) -> list[dict]:
	"""The data rows of the first sheet of a `.xlsx` (or of a `.csv`): the first non-empty row is the header, each
	row is `{"no": <row number in the file>, <column key>: <cell>}` with empty cells left out. A header that
	matches nothing is ignored and appended once to `asing`."""
	return _baca(_berkas(file_url), asing)


def _teks(nilai) -> str:
	if isinstance(nilai, float) and nilai.is_integer():
		return str(int(nilai))
	return str(nilai if nilai is not None else "").strip()


def _barang(b: dict) -> tuple[str, str]:
	"""(item, jenis) of a row: `item_code` if given, else the product name and Jenis."""
	jenis = master.SAMA["Jenis"].get(_teks(b.get("jenis")), _teks(b.get("jenis")))
	kode = _teks(b.get("item_code"))
	if kode:
		ada = frappe.db.get_value("Item", kode, ["name", "has_variants", "disabled"], as_dict=True)
		if not ada:
			raise Tolak(_("Item {0} does not exist.").format(kode))
		if ada.disabled:
			raise Tolak(_("Item {0} is disabled.").format(kode))
		if not ada.has_variants:
			# a variant's or plain item's Jenis is only information, as long as it says the same
			if jenis and jenis.lower() != (kapasitas.jenis_varian(ada.name) or "").lower():
				raise Tolak(_("Jenis can only be set on a template item, not on {0}.").format(kode))
			return ada.name, ""
		return ada.name, _jenis(ada.name, jenis)
	produk = _teks(b.get("produk"))
	if not produk:
		raise Tolak(_("The row names no product."))
	for (p, j), (kode, _nama, _satuan) in master.PISAH.items():
		if p.lower() == produk.lower() and j.lower() == jenis.lower():
			if not frappe.db.exists("Item", kode):
				raise Tolak(_("Item {0} does not exist.").format(kode))
			return kode, ""
	templat = frappe.get_all(
		"Item", {"has_variants": 1, "disabled": 0, "item_name": produk}, pluck="name", order_by="name"
	)
	if not templat:
		raise Tolak(_("No product named {0}.").format(produk))
	if len(templat) > 1:
		raise Tolak(_("More than one product is named {0}.").format(produk))
	return templat[0], _jenis(templat[0], jenis)


def _jenis(templat: str, jenis: str) -> str:
	if not jenis:
		return ""
	for ada in kapasitas.jenis_template(templat):
		if ada.lower() == jenis.lower():
			return ada
	raise Tolak(_("No variant of {0} has the Jenis {1}.").format(templat, jenis))


def _mesin(sel) -> str:
	teks = _teks(sel)
	if not teks:
		raise Tolak(_("The row names no machine."))
	angka_ada = re.findall(r"\d+", teks)
	if len(angka_ada) == 1:
		ada = frappe.get_all("Workstation", {"erp_nomor": int(angka_ada[0])}, pluck="name")
		if len(ada) > 1:
			raise Tolak(_("More than one machine has the number {0}.").format(int(angka_ada[0])))
		if ada:
			return ada[0]
	nama = frappe.db.get_value("Workstation", {"name": teks, "erp_nomor": (">", 0)}, "name")
	if nama:
		return nama
	raise Tolak(_("No machine {0}.").format(teks))


def _bahan(sel) -> str:
	teks = _teks(sel)
	if nama := frappe.db.get_value("Item", teks, "name"):
		return nama
	ada = frappe.get_all("Item", {"item_name": teks, "disabled": 0}, pluck="name", order_by="name")
	if len(ada) > 1:
		raise Tolak(_("More than one item is named {0}.").format(teks))
	if not ada:
		raise Tolak(_("No item {0}.").format(teks))
	return ada[0]


def _nilai(b: dict) -> dict:
	"""The row's values: lookups and numbers made sure of. Raises `Tolak` with the reason."""
	nilai = {"item": "", "jenis": "", "workstation": ""}
	nilai["item"], nilai["jenis"] = _barang(b)
	nilai["workstation"] = _mesin(b.get("mesin"))
	for kunci in ANGKA:
		try:
			nilai[kunci] = angka(b.get(kunci))
		except ValueError as e:
			if str(e) == "ambiguous":
				raise Tolak(
					_("{0} is ambiguous: write it with a comma for decimals, e.g. 1,25 or 1250.").format(
						_teks(b.get(kunci))
					)
				) from e
			raise Tolak(_("{0} is not a number.").format(_teks(b.get(kunci)))) from e
	try:
		banyak = angka(b.get("cavities"))
	except ValueError as e:
		raise Tolak(_("{0} is not a number.").format(_teks(b.get("cavities")))) from e
	if banyak != int(banyak):
		raise Tolak(_("Cavities must be a whole number."))
	nilai["cavities"] = int(banyak)
	if not _teks(b.get("material")):
		raise Tolak(_("The row names no material."))
	nilai["material"] = _bahan(b.get("material"))
	nilai["masterbatch"] = _bahan(b["masterbatch"]) if _teks(b.get("masterbatch")) else ""
	return nilai


def _beda(ada, nilai: dict) -> list[str]:
	"""The fields in which the stored row `ada` differs from the file's `nilai`."""
	hasil = []
	for f in NILAI:
		if isinstance(nilai[f], float | int):
			if round(flt(ada.get(f)), 6) != round(flt(nilai[f]), 6):
				hasil.append(f)
		elif (ada.get(f) or "") != (nilai[f] or ""):
			hasil.append(f)
	return hasil


def _pesan(e: Exception) -> str:
	return strip_html(str(e)).strip()


def _rencana(file_url: str) -> dict:
	"""Every row of the file with its result; writes nothing."""
	doc = _berkas(file_url)
	asing: list[str] = []
	meta = frappe.get_meta("Machine Capacity")
	hasil, lihat = [], {}
	for b in _baca(doc, asing):
		baris = {
			"no": b["no"],
			"hasil": "Refused",
			"alasan": "",
			"item": _teks(b.get("item_code") or b.get("produk")),
			"jenis": _teks(b.get("jenis")),
			"workstation": _teks(b.get("mesin")),
			"cycle_time": _teks(b.get("cycle_time")),
			"cavities": _teks(b.get("cavities")),
			"part_weight": _teks(b.get("part_weight")),
			"runner_weight": _teks(b.get("runner_weight")),
			"material": _teks(b.get("material")),
			"masterbatch": _teks(b.get("masterbatch")),
			"masterbatch_percent": _teks(b.get("masterbatch_percent")),
			"kapasitas": "",
		}
		hasil.append(baris)
		try:
			nilai = _nilai(b)
			baris.update(nilai)
			kunci = (nilai["item"], nilai["jenis"], nilai["workstation"])
			if kunci in lihat:
				raise Tolak(_("Same product and machine as row {0}.").format(lihat[kunci]))
			lihat[kunci] = b["no"]
			ada = frappe.db.get_value(
				"Machine Capacity", dict(zip(("item", "jenis", "workstation"), kunci, strict=True))
			)
			if ada:
				dok = frappe.get_doc("Machine Capacity", ada)
				baris["kapasitas"] = ada
				if dok.disabled:
					raise Tolak(
						_(
							"The capacity row {0} is switched off. Switch it on by hand, then import again."
						).format(ada)
					)
				beda = _beda(dok, nilai)
				dok.update(nilai)
			else:
				dok = frappe.get_doc({"doctype": "Machine Capacity", **nilai})
				beda = list(NILAI)
			# the model's own checks (positive numbers, material in Kg, the Jenis of the template)
			dok.run_method("validate")
			baris["hasil"] = "Changed" if ada and beda else "Unchanged" if ada else "New"
			if ada and beda:
				baris["alasan"] = ", ".join(_(meta.get_label(f)) for f in beda)
		except Tolak as e:
			baris["alasan"] = str(e)
		except (frappe.ValidationError, frappe.DoesNotExistError, frappe.LinkValidationError) as e:
			baris["alasan"] = _pesan(e)
			frappe.clear_last_message()
	return {"baris": hasil, "kolom_asing": asing}


@frappe.whitelist()
def pratinjau(file_url: str) -> dict:
	"""Read the file and say what each row would do. Writes nothing. Returns `{"baris": [...], "kolom_asing": [...]}`:
	each row has `no` (its row in the file), `hasil` (New, Changed, Unchanged or Refused), `alasan`, the item,
	Jenis, machine and values."""
	return _rencana(file_url)


@frappe.whitelist()
def terapkan(file_url: str, company: str | None = None) -> dict:
	"""Write the New and Changed rows of `pratinjau` and make the BOMs of each. A row whose write fails is rolled
	back whole and shown as Refused with the error; the others go on. `bom` counts the BOMs made and switched off."""
	h = _rencana(file_url)
	bom = {"dibuat": 0, "nonaktif": 0}
	for i, b in enumerate(h["baris"]):
		if b["hasil"] not in ("New", "Changed"):
			continue
		titik = f"impor_kapasitas_{i}"
		frappe.db.savepoint(titik)
		try:
			nilai = {k: b[k] for k in NILAI}
			if b["kapasitas"]:
				dok = frappe.get_doc("Machine Capacity", b["kapasitas"])
				dok.update(nilai)
				dok.save()
			else:
				dok = frappe.get_doc(
					{
						"doctype": "Machine Capacity",
						"item": b["item"],
						"jenis": b["jenis"],
						"workstation": b["workstation"],
						**nilai,
					}
				).insert()
			dibuat = buat_bom_kapasitas(dok.name, company)
		except Exception as e:
			frappe.db.rollback(save_point=titik)
			frappe.clear_messages()
			if not isinstance(e, frappe.ValidationError | frappe.PermissionError | frappe.DoesNotExistError):
				frappe.log_error(f"Capacity import row {b['no']}")
				b.update(hasil="Refused", alasan=_("Unexpected error, see the Error Log."))
			else:
				b.update(hasil="Refused", alasan=_pesan(e))
			continue
		b["kapasitas"] = dok.name
		bom["dibuat"] += len(dibuat["dibuat"])
		bom["nonaktif"] += len(dibuat["nonaktif"])
	h["bom"] = bom
	return h
