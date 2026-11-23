"""Machine capacity: the lookup of the row that says how fast a machine makes a product.

The lookup is the only way the report and the BOM step find a row (Machine Capacity, spec section 1).
"""

import erpnext
import frappe
from frappe import _
from frappe.utils import cint, flt

# A new capacity row's `runner_reground` when the field was not given (import, API). Open question to Samuel:
# is the runner reground and reused (1) or thrown away (0)? A new form asks `runner_digiling()` for it.
RUNNER_DIGILING = 0

ATRIBUT_JENIS = "Jenis"
# The pigment template (spec section 8): one variant per colour, stocked in grams, its ratio in g per kg of resin.
TEMPLATE_PIGMEN = "PIGMEN"
ATRIBUT_WARNA = "Warna"
# The fields of a pigment whose change (or a new pigment) rebuilds the capacity BOMs (`item_berubah`).
PEMICU_PIGMEN = ("erp_rasio_pigmen", "disabled")
# Packing items (spec A2): a product's Packing rows (Item `erp_kemasan`) add one line per row to its BOM.
GRUP_KEMASAN = "Kemasan"
# The fields of a packing item whose change rebuilds the capacity BOMs (`item_berubah`).
PEMICU_KEMASAN = ("disabled",)
# Cache flag: a rebuild was asked for (`_antre`); `segarkan_bom` runs passes until it stays clear.
KUNCI_SEGARKAN_LAGI = "erp_segarkan_bom_lagi"


@frappe.whitelist()
def runner_digiling() -> int:
	"""The default of a new row's `runner_reground`, for the form (it would send 0 for an untouched Check)."""
	return RUNNER_DIGILING


def jenis_varian(item: str) -> str | None:
	"""The variant's value of the `Jenis` attribute, or None (a template, a plain item, no such attribute)."""
	return frappe.db.get_value(
		"Item Variant Attribute", {"parent": item, "attribute": ATRIBUT_JENIS}, "attribute_value"
	)


def jenis_template(template: str) -> list[str]:
	"""The `Jenis` values that the variants of `template` use."""
	return frappe.get_all(
		"Item Variant Attribute",
		filters={
			"attribute": ATRIBUT_JENIS,
			"parent": ("in", frappe.get_all("Item", {"variant_of": template}, pluck="name")),
		},
		pluck="attribute_value",
		distinct=True,
	)


def _saring_baris(item: str) -> list[dict]:
	"""The enabled-row filters `kapasitas()` tries for `item`, in order: its own row, then (a variant) its
	template's row for the variant's Jenis, then its template's row with no Jenis."""
	template = frappe.db.get_value("Item", item, "variant_of")
	kandidat = [(item, "")]
	if template:
		kandidat += [(template, jenis_varian(item) or ""), (template, "")]
	return [{"item": kode, "jenis": jenis or ("in", ("", None)), "disabled": 0} for kode, jenis in kandidat]


def kapasitas(item: str, workstation: str) -> frappe._dict | None:
	"""The enabled capacity row of `item` on `workstation`: the variant's own row, else its template's row for
	the variant's Jenis, else its template's row with no Jenis, else None."""
	for saring in _saring_baris(item):
		if row := frappe.db.get_value(
			"Machine Capacity", {**saring, "workstation": workstation}, "*", as_dict=True
		):
			return row
	return None


@frappe.whitelist()
def ada_baris(item: str) -> bool:
	"""True when `item` has an enabled Machine Capacity row on any machine (a disabled machine too): there is a
	list to check against. False: no list, any machine goes."""
	return bool(item) and any(frappe.db.exists("Machine Capacity", s) for s in _saring_baris(item))


def varian_tercakup(nama: str) -> list[str]:
	"""The items whose BOM comes from the row `nama`: a variant row covers itself, a template row (with its
	Jenis, if any) every variant that `kapasitas()` resolves to this row; a disabled row covers none."""
	row = frappe.db.get_value(
		"Machine Capacity", nama, ["item", "jenis", "workstation", "disabled"], as_dict=True
	)
	if not row or row.disabled:
		return []
	if not frappe.db.get_value("Item", row.item, "has_variants"):
		return [row.item]
	varian = frappe.get_all("Item", {"variant_of": row.item, "disabled": 0}, pluck="name", order_by="name")
	return [v for v in varian if (r := kapasitas(v, row.workstation)) and r.name == nama]


def pigmen(item: str) -> tuple[str, float] | None:
	"""(pigment item, ratio in g per kg) for the variant's `Warna`: the enabled `PIGMEN` variant with that
	colour, or None (no colour, or no pigment for it: Bening, Campur, ...)."""
	warna = frappe.db.get_value(
		"Item Variant Attribute", {"parent": item, "attribute": ATRIBUT_WARNA}, "attribute_value"
	)
	if not warna:
		return None
	pg = frappe.db.get_value(
		"Item Variant Attribute",
		{
			"attribute": ATRIBUT_WARNA,
			"attribute_value": warna,
			"parent": (
				"in",
				frappe.get_all("Item", {"variant_of": TEMPLATE_PIGMEN, "disabled": 0}, pluck="name"),
			),
		},
		"parent",
	)
	return (pg, flt(frappe.db.get_value("Item", pg, "erp_rasio_pigmen"))) if pg else None


def _baris_kemasan(item: str) -> list:
	return frappe.get_all(
		"Item Packing",
		{"parenttype": "Item", "parentfield": "erp_kemasan", "parent": item},
		["packing_item", "pieces"],
		order_by="idx",
	)


def kemasan(item: str) -> list[tuple[str, int]]:
	"""(packing item, pieces per packing) of `item`: the variant's Packing rows, else its template's; rows whose
	packing item is disabled or holds no pieces are left out."""
	baris = _baris_kemasan(item)
	if not baris and (template := frappe.db.get_value("Item", item, "variant_of")):
		baris = _baris_kemasan(template)
	return [
		(b.packing_item, b.pieces)
		for b in baris
		if b.pieces > 0 and not frappe.db.get_value("Item", b.packing_item, "disabled")
	]


def baris_bom(row, item: str | None = None) -> list[dict]:
	"""The BOM lines of one piece of `item`: the material, less the masterbatch, then the masterbatch (the
	percent is of the whole resin mix), in kg; then the pigment of the item's colour, in grams (stock UOM Gram),
	on top of the material; then 1 / pieces of each packing (`kemasan`). No masterbatch line unless both the
	item and a percent are given."""
	campuran = flt(row.material_per_pcs) / 1000
	mb = campuran * flt(row.masterbatch_percent) / 100 if row.masterbatch else 0
	baris = [{"item_code": row.material, "qty": round(campuran - mb, 6)}]
	if mb:
		baris.append({"item_code": row.masterbatch, "qty": round(mb, 6)})
	if item and (pg := pigmen(item)):
		baris.append({"item_code": pg[0], "qty": round(campuran * pg[1], 6)})
	for kode, isi in kemasan(item) if item else ():
		baris.append({"item_code": kode, "qty": round(1 / isi, 9)})
	return baris


def _bom_aktif(nama: str, item: str | None = None) -> list[str]:
	filters = {"erp_kapasitas": nama, "docstatus": 1, "is_active": 1}
	if item:
		filters["item"] = item
	return frappe.get_all("BOM", filters, pluck="name", order_by="creation desc, name desc")


def _isi_bom(bom: str) -> list[tuple[str, float]]:
	return sorted(
		(r.item_code, round(flt(r.qty), 9))
		for r in frappe.get_all("BOM Item", {"parent": bom}, ["item_code", "qty"])
	)


def _dipakai(bom: str) -> bool:
	"""An open Work Order (not cancelled, completed or closed) runs on this BOM."""
	return bool(
		frappe.db.exists(
			"Work Order",
			{"bom_no": bom, "docstatus": ("<", 2), "status": ("not in", ("Completed", "Closed"))},
		)
	)


@frappe.whitelist()
def buat_bom_kapasitas(nama: str, company: str | None = None) -> dict:
	"""Make the BOMs of the capacity row `nama`: one per covered variant, per machine. Returns the BOMs
	`dibuat` (new), `tetap` (already right) and `nonaktif` (older ones switched off). Hand-made BOMs (no
	`erp_kapasitas`) are never touched."""
	frappe.has_permission("Machine Capacity", "write", nama, throw=True)
	for perm in ("create", "submit", "write"):
		frappe.has_permission("BOM", perm, throw=True)
	row = frappe.get_doc("Machine Capacity", nama)
	if not row.disabled and not row.material:
		frappe.throw(_("Set the material of this row before making BOMs."))
	company = company or erpnext.get_default_company()
	frappe.has_permission("Company", "read", doc=company, throw=True)
	hasil = {"dibuat": [], "tetap": [], "nonaktif": []}
	aman = set()
	for item in varian_tercakup(nama):
		baris = baris_bom(row, item)
		isi = sorted((b["item_code"], b["qty"]) for b in baris)
		ada = next(
			(
				b
				for b in _bom_aktif(nama, item)
				if frappe.db.get_value("BOM", b, "erp_mesin") == row.workstation and _isi_bom(b) == isi
			),
			None,
		)
		if ada:
			hasil["tetap"].append(ada)
			aman.add(ada)
			continue
		bom = frappe.get_doc(
			{
				"doctype": "BOM",
				"item": item,
				"company": company,
				"currency": frappe.get_cached_value("Company", company, "default_currency"),
				"quantity": 1,
				"uom": frappe.db.get_value("Item", item, "stock_uom"),
				"is_active": 1,
				"is_default": 1,
				"rm_cost_as_per": "Valuation Rate",
				"erp_mesin": row.workstation,
				"erp_kapasitas": nama,
				"items": [
					{
						"item_code": b["item_code"],
						"qty": b["qty"],
						"uom": frappe.db.get_value("Item", b["item_code"], "stock_uom"),
					}
					for b in baris
				],
			}
		)
		bom.insert()
		bom.submit()
		hasil["dibuat"].append(bom.name)
		aman.add(bom.name)
	# Every other active BOM of this row (an older figure, a variant no longer covered, a disabled row) goes
	# off unless an open Work Order still runs on it.
	for lama in _bom_aktif(nama):
		if lama in aman or _dipakai(lama):
			continue
		doc = frappe.get_doc("BOM", lama)
		doc.is_active = 0
		doc.is_default = 0
		doc.save()
		hasil["nonaktif"].append(lama)
	return hasil


def segarkan_bom() -> int:
	"""Rebuild the capacity BOMs (a pigment changed), pass after pass while `_antre` asked again during one: each
	pass first clears the request and commits, so it reads every change committed before it. Returns how many rows
	it ran over all passes."""
	n = 0
	while True:
		frappe.cache.delete_value(KUNCI_SEGARKAN_LAGI)
		if not frappe.in_test:
			frappe.db.commit()  # nosemgrep: a fresh snapshot, so this pass sees the change that asked for it
		n += _segarkan_sekali()
		if not frappe.cache.get_value(KUNCI_SEGARKAN_LAGI):
			return n


def _segarkan_sekali() -> int:
	"""One pass: `buat_bom_kapasitas` for every enabled Machine Capacity row with a material, in the company this
	app runs (identical BOMs stay, others are replaced). A row that fails is rolled back and logged; the rest go
	on. Returns how many rows it ran."""
	from erp_internal.setup import perusahaan

	company = next(iter(perusahaan()), None)
	n = 0
	for nama in frappe.get_all("Machine Capacity", {"disabled": 0, "material": ("is", "set")}, pluck="name"):
		frappe.db.savepoint("segarkan_bom")
		try:
			buat_bom_kapasitas(nama, company)
		except frappe.ValidationError, frappe.PermissionError:
			frappe.db.rollback(save_point="segarkan_bom")
			frappe.clear_messages()
			frappe.log_error(f"Capacity BOM rebuild {nama}")
			continue
		n += 1
	return n


def _antre() -> None:
	"""Ask for a rebuild: set the request flag, then queue `segarkan_bom` (deduplicated: a job already queued or
	running sees the flag and runs another pass). Any rebuild trigger calls this after its commit."""
	frappe.cache.set_value(KUNCI_SEGARKAN_LAGI, 1)
	if frappe.in_test:
		segarkan_bom()
		return
	frappe.enqueue(
		"erp_internal.planning.kapasitas.segarkan_bom", job_id="erp_segarkan_bom", deduplicate=True
	)


def cek_pigmen(doc, method=None) -> None:
	"""A pigment's ratio (g per kg) must be above 0 (Item validate)."""
	if doc.variant_of == TEMPLATE_PIGMEN and flt(doc.get("erp_rasio_pigmen")) <= 0:
		frappe.throw(_("The pigment ratio must be more than 0 g per kg."))


def cek_kemasan(doc, method=None) -> None:
	"""Each Packing row holds more than 0 pieces (Item validate)."""
	for r in doc.get("erp_kemasan") or ():
		if cint(r.pieces) <= 0:
			frappe.throw(_("Row {0}: Pieces per Packing must be more than 0.").format(r.idx))


def _isi_kemasan(doc) -> list[tuple]:
	return [(r.packing_item, cint(r.pieces)) for r in doc.get("erp_kemasan") or ()]


def perlu_segarkan(doc) -> bool:
	"""Whether this Item save changes a capacity BOM: a pigment new or with another `PEMICU_PIGMEN`; a packing
	item with another `PEMICU_KEMASAN`; any other item whose Packing rows changed (or a new one with rows)."""
	lama = doc.get_doc_before_save()
	if doc.variant_of == TEMPLATE_PIGMEN:
		return not lama or any(lama.get(f) != doc.get(f) for f in PEMICU_PIGMEN)
	if doc.item_group == GRUP_KEMASAN:
		return bool(lama) and any(lama.get(f) != doc.get(f) for f in PEMICU_KEMASAN)
	return _isi_kemasan(doc) != (_isi_kemasan(lama) if lama else [])


def item_berubah(doc, method=None) -> None:
	"""An Item save that changes a capacity BOM (`perlu_segarkan`) rebuilds the capacity BOMs in the background
	(Item on_update), as the user who saved it."""
	if not perlu_segarkan(doc):
		return
	# Tests never commit, so the after-commit callback would never run there.
	if frappe.in_test:
		_antre()
	else:
		frappe.db.after_commit.add(_antre)


def pilih_bom(doc, method=None) -> None:
	"""On a draft Work Order with a machine, swap the item's default BOM (or none, or another machine's) for
	the newest active BOM made for that machine. A hand-picked non-default BOM is kept."""
	if doc.docstatus != 0 or not doc.erp_mesin or not doc.production_item:
		return
	if doc.bom_no:
		sekarang = frappe.db.get_value("BOM", doc.bom_no, ["is_default", "erp_mesin"], as_dict=True)
		if sekarang and sekarang.erp_mesin == doc.erp_mesin:
			return
		if sekarang and not sekarang.is_default and not sekarang.erp_mesin:
			return
	baru = frappe.db.get_value(
		"BOM",
		{
			"item": doc.production_item,
			"erp_mesin": doc.erp_mesin,
			"company": doc.company,
			"docstatus": 1,
			"is_active": 1,
		},
		"name",
		order_by="creation desc, name desc",
	)
	if baru and baru != doc.bom_no:
		doc.bom_no = baru
		# The lines came from the old BOM: let ERPNext build them again from the new one.
		doc.set("required_items", [])
		doc.set("operations", [])
		doc.set_work_order_operations()


# A submitted order's machine may change only while it still runs (a machine breaks down); a Completed, Stopped
# or Closed order keeps the machine its output was made on.
STATUS_GANTI_MESIN = ("Not Started", "In Process")


def kunci_mesin(doc, method=None) -> None:
	"""Refuse a change of a submitted Work Order's machine unless it is Not Started or In Process."""
	lama = doc.get_doc_before_save()
	if not lama or lama.erp_mesin == doc.erp_mesin or lama.status in STATUS_GANTI_MESIN:
		return
	frappe.throw(_("The machine can only be changed while the Work Order is Not Started or In Process."))


def mesin_aktif(doc, method=None) -> None:
	"""Refuse a Work Order on an inactive machine (Workstation disabled, Samuel 2026-11-02). A submitted order
	already on that machine keeps running; a new, draft or moved order is refused."""
	if not doc.erp_mesin or not frappe.db.get_value("Workstation", doc.erp_mesin, "disabled"):
		return
	lama = doc.get_doc_before_save()
	if lama and lama.docstatus == 1 and lama.erp_mesin == doc.erp_mesin:
		return
	frappe.throw(_("{0} is not in use. Choose another machine.").format(frappe.bold(doc.erp_mesin)))


def _mesin_aktif_bernomor() -> list[str]:
	"""The enabled numbered machines, by number."""
	return frappe.get_all(
		"Workstation", {"erp_nomor": (">", 0), "disabled": 0}, pluck="name", order_by="erp_nomor, name"
	)


def mesin_item(item: str) -> list[str]:
	"""The enabled numbered machines `kapasitas()` finds an enabled row on for `item`, by number. Empty when the
	item has no row at all (`ada_baris` False: any machine goes) or its rows sit on disabled machines only."""
	if not item:
		return []
	return [m for m in _mesin_aktif_bernomor() if kapasitas(item, m)]


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def cari_mesin(doctype, txt, searchfield, start, page_len, filters) -> list[tuple]:
	"""Link query of the Work Order's machine: the machines listed for `filters["item"]`, else every enabled
	numbered machine (an item with no Machine Capacity row yet is free)."""
	item = (frappe.parse_json(filters) or {}).get("item")
	nama = mesin_item(item) or ([] if ada_baris(item) else _mesin_aktif_bernomor())
	cari = (txt or "").lower()
	return [(m,) for m in nama if cari in m.lower()][int(start or 0) :][: int(page_len or 20)]


def mesin_terdaftar(doc, method=None) -> None:
	"""Refuse a Work Order on a machine that Machine Capacity does not list for its item. No row at all means
	no list: any machine goes. A submitted order already on its machine keeps running; a new, draft or moved
	order is checked."""
	if not doc.erp_mesin or not doc.production_item:
		return
	lama = doc.get_doc_before_save()
	if lama and lama.docstatus == 1 and lama.erp_mesin == doc.erp_mesin:
		return
	daftar = mesin_item(doc.production_item)
	if doc.erp_mesin not in daftar and ada_baris(doc.production_item):
		frappe.throw(
			_("{0} is not made on {1}. Machines for it: {2}.").format(
				frappe.bold(doc.production_item),
				frappe.bold(doc.erp_mesin),
				", ".join(daftar) or _("none in use"),
			)
		)
