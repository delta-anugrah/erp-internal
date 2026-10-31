"""Machine capacity: the lookup of the row that says how fast a machine makes a product.

The lookup is the only way the report and the BOM step find a row (Machine Capacity, spec section 1).
"""

import erpnext
import frappe
from frappe import _
from frappe.utils import flt

# A new capacity row's `runner_reground` when the field was not given (import, API). Open question to Samuel:
# is the runner reground and reused (1) or thrown away (0)? A new form asks `runner_digiling()` for it.
RUNNER_DIGILING = 0

ATRIBUT_JENIS = "Jenis"


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


def kapasitas(item: str, workstation: str) -> frappe._dict | None:
	"""The enabled capacity row of `item` on `workstation`: the variant's own row, else its template's row for
	the variant's Jenis, else its template's row with no Jenis, else None."""
	template = frappe.db.get_value("Item", item, "variant_of")
	kandidat = [(item, "")]
	if template:
		kandidat += [(template, jenis_varian(item) or ""), (template, "")]
	for kode, jenis in kandidat:
		if row := frappe.db.get_value(
			"Machine Capacity",
			{"item": kode, "jenis": jenis or ("in", ("", None)), "workstation": workstation, "disabled": 0},
			"*",
			as_dict=True,
		):
			return row
	return None


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


def baris_bom(row) -> list[dict]:
	"""The BOM lines of one piece, in kg: the material, less the masterbatch, then the masterbatch (the percent
	is of the whole resin mix). No masterbatch line unless both the item and a percent are given."""
	campuran = flt(row.material_per_pcs) / 1000
	mb = campuran * flt(row.masterbatch_percent) / 100 if row.masterbatch else 0
	baris = [{"item_code": row.material, "qty": round(campuran - mb, 6)}]
	if mb:
		baris.append({"item_code": row.masterbatch, "qty": round(mb, 6)})
	return baris


def _bom_aktif(nama: str, item: str | None = None) -> list[str]:
	filters = {"erp_kapasitas": nama, "docstatus": 1, "is_active": 1}
	if item:
		filters["item"] = item
	return frappe.get_all("BOM", filters, pluck="name", order_by="creation desc, name desc")


def _isi_bom(bom: str) -> list[tuple[str, float]]:
	return sorted(
		(r.item_code, round(flt(r.qty), 6))
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
		isi = sorted((b["item_code"], b["qty"]) for b in baris_bom(row))
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
					for b in baris_bom(row)
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
