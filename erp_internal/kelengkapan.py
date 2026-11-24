"""Missing data notices (Abel 2026-11-24): set-up that is not complete yet, what that means for the user, and a
link straight to where it is fixed.

`CEK` is the one table. Each check returns rows (doctype, name, details, fix) for the products of `_produk`
(finished goods: enabled non-template items of `master.GRUP`, never raw materials, pigments or packing). Where the
fix is on the template (packing, machine capacity) the template is the row, once. A fix is a plain dict the desk's
`public/js/kelengkapan.js` opens:

- `{"doctype", "name", "field"}`: that form, scrolled to the field;
- `{"doctype": "Item", "name": PIGMEN, "varian": {attribute: value}}`: the template's Create Variant dialog, filled;
- `{"doctype", "baru": {field: value}, "baris": {table: [row]}}`: a new document, prefilled;
- `{"laporan", "filters"}`: a report.

Shown in the report Missing Data (Admin), on the Item, Sales Order and Work Order forms and in Monthly Expenses.
"""

import json
from collections import Counter

import frappe
from frappe import _
from frappe.utils import escape_html, getdate, today
from frappe.utils.translations import _lt

from erp_internal.master import GRUP as GRUP_PRODUK
from erp_internal.planning.doctype.expense_entry.expense_entry import PER_SHIFT
from erp_internal.planning.kapasitas import ATRIBUT_JENIS, ATRIBUT_WARNA, GRUP_KEMASAN, TEMPLATE_PIGMEN

# Colours made without a pigment: the clear resin itself and the mixed leftovers (the Warna values on
# erp.localhost, 2026-11-24). Every other colour of a product needs an enabled PIGMEN variant.
WARNA_TANPA_PIGMEN = ("Bening", "Bening Transparan", "Campur")
KATEGORI_GAJI = "Gaji Operator"  # setup.KATEGORI_BIAYA[0]
GRUP_STOK = ("Pigmen", GRUP_KEMASAN)  # used up by recording output: no stock, no output
GUDANG_STOK = "Gudang Bahan Baku"  # setup.GUDANG_GRUP of both groups
LAPORAN = "Missing Data"


def _ke(item: str | None, nama: list[str]):
	"""A filter value limiting a query to `nama` when one item is asked for (the forms), else no limit."""
	return ("in", nama or [""]) if item else ("is", "set")


def _kemasan(k) -> list[tuple]:
	nama = [p.name for p in k.produk] + [p.variant_of for p in k.produk if p.variant_of]
	baris = frappe.get_all(
		"Item Packing",
		{"parenttype": "Item", "parentfield": "erp_kemasan", "parent": _ke(k.item, nama)},
		["parent", "packing_item", "pieces"],
	)
	mati = set(
		frappe.get_all(
			"Item", {"disabled": 1, "name": ("in", [b.packing_item for b in baris] or [""])}, pluck="name"
		)
	)
	punya = {b.parent for b in baris}
	berisi = {b.parent for b in baris if b.pieces > 0 and b.packing_item not in mati}

	def sumber(p):  # as `kapasitas.kemasan`: a variant's own rows, else its template's
		return p.name if p.name in punya or not p.variant_of else p.variant_of

	kurang = Counter(s for p in k.produk if (s := sumber(p)) not in berisi)
	return [
		(s, _rincian_varian(s, n, k), {"doctype": "Item", "name": s, "field": "erp_kemasan"})
		for s, n in kurang.items()
	]


def _rincian_varian(sumber: str, n: int, k) -> str:
	return _("Variants: {0}").format(n) if sumber in k.template else ""


def _pigmen(k) -> list[tuple]:
	if not k.produk:
		return []
	warna = frappe.get_all(
		"Item Variant Attribute",
		{"attribute": ATRIBUT_WARNA, "parent": ("in", [p.name for p in k.produk])},
		pluck="attribute_value",
	)
	pigmen = frappe.get_all("Item", {"variant_of": TEMPLATE_PIGMEN, "disabled": 0}, pluck="name")
	ada = set(
		frappe.get_all(
			"Item Variant Attribute",
			{"attribute": ATRIBUT_WARNA, "parent": ("in", pigmen or [""])},
			pluck="attribute_value",
		)
	)
	kurang = Counter(w for w in warna if w and w not in ada and w not in WARNA_TANPA_PIGMEN)
	return [
		(
			TEMPLATE_PIGMEN,
			_("{0}, products: {1}").format(w, n),
			{"doctype": "Item", "name": TEMPLATE_PIGMEN, "varian": {ATRIBUT_WARNA: w}},
		)
		for w, n in sorted(kurang.items())
	]


def _harga(k) -> list[tuple]:
	if not k.produk:
		return []
	daftar = frappe.db.get_single_value("Selling Settings", "selling_price_list")
	if not daftar:
		s = "Selling Settings"
		return [(s, "", {"doctype": s, "name": s, "field": "selling_price_list"}, s)]
	nama = [p.name for p in k.produk]
	ada = set(
		frappe.get_all(
			"Item Price", {"price_list": daftar, "item_code": _ke(k.item, nama)}, pluck="item_code"
		)
	)
	# Per variant: ERPNext v16 refuses an Item Price on a template.
	return [
		(p.name, daftar, {"doctype": "Item Price", "baru": {"item_code": p.name, "price_list": daftar}})
		for p in k.produk
		if p.name not in ada
	]


def ada_gaji(company: str, dari, sampai=None) -> bool:
	"""A submitted Gaji Operator expense Per machine shift of `company` runs on `dari` (Until empty or on/after
	it), and, with `sampai`, started on or before it."""
	filters = {"docstatus": 1, "company": company, "category": KATEGORI_GAJI, "repeat": PER_SHIFT}
	if sampai:
		filters["posting_date"] = ("<=", sampai)
	return bool(
		frappe.get_all(
			"Expense Entry",
			filters=filters,
			or_filters=[["until", "is", "not set"], ["until", ">=", dari]],
			limit=1,
		)
	)


def _gaji(k) -> list[tuple]:
	if k.item or not k.company or ada_gaji(k.company, k.hari_ini):
		return []
	baru = {"category": KATEGORI_GAJI, "repeat": PER_SHIFT, "company": k.company}
	return [(KATEGORI_GAJI, "", {"doctype": "Expense Entry", "baru": baru}, "Expense Category")]


def _kapasitas(k) -> list[tuple]:
	if not k.produk:
		return []
	nama = [p.name for p in k.produk] + [p.variant_of for p in k.produk if p.variant_of]
	baris = frappe.get_all("Machine Capacity", {"disabled": 0, "item": _ke(k.item, nama)}, ["item", "jenis"])
	pasangan = {(b.item, b.jenis or "") for b in baris}
	punya = {b.item for b in baris}
	jenis = dict(
		frappe.get_all(
			"Item Variant Attribute",
			{"attribute": ATRIBUT_JENIS, "parent": ("in", [p.name for p in k.produk])},
			["parent", "attribute_value"],
			as_list=True,
		)
	)
	# As `kapasitas.ada_baris`: its own row, else its template's for its Jenis, else its template's without one.
	kurang = Counter(
		p.variant_of or p.name
		for p in k.produk
		if p.name not in punya
		and (p.variant_of, jenis.get(p.name) or "") not in pasangan
		and (p.variant_of, "") not in pasangan
	)
	return [
		(s, _rincian_varian(s, n, k), {"doctype": "Machine Capacity", "baru": {"item": s}})
		for s, n in kurang.items()
	]


def _stok(k) -> list[tuple]:
	filters = {"item_group": ("in", GRUP_STOK), "disabled": 0, "has_variants": 0}
	if k.item:
		filters["name"] = k.item
	kode = frappe.get_all("Item", filters, pluck="name", order_by="name")
	saring = {"warehouse_name": GUDANG_STOK}
	if k.company:
		saring["company"] = k.company
	gudang = frappe.get_all("Warehouse", saring, pluck="name")
	ada = set(
		frappe.get_all(
			"Bin",
			{"item_code": ("in", kode or [""]), "warehouse": ("in", gudang or [""]), "actual_qty": (">", 0)},
			pluck="item_code",
		)
	)
	baru = {"company": k.company} if k.company else {}
	return [
		(c, GUDANG_STOK, {"doctype": "Purchase Order", "baru": baru, "baris": {"items": [{"item_code": c}]}})
		for c in kode
		if c not in ada
	]


# The checks, in the report's order: key, label, what happens, how to fix (the link's text), function. A function
# returns (name, details, fix) rows of DocType Item, or (name, details, fix, doctype).
CEK = (
	{
		"kunci": "kemasan",
		"label": _lt("No packing set"),
		"akibat": _lt("Packing is not used up and its cost is not counted."),
		"cara": _lt("Fill the Packing table of the item"),
		"fungsi": _kemasan,
	},
	{
		"kunci": "pigmen",
		"label": _lt("No pigment for the colour"),
		"akibat": _lt("No pigment is used up for these products and its cost is not counted."),
		"cara": _lt("Make the pigment of this colour"),
		"fungsi": _pigmen,
	},
	{
		"kunci": "harga",
		"label": _lt("No selling price"),
		"akibat": _lt("A Sales Order line starts at 0."),
		"cara": _lt("Add a selling price"),
		"fungsi": _harga,
	},
	{
		"kunci": "gaji",
		"label": _lt("No operator wage expense"),
		"akibat": _lt("Operator wages are not counted in Monthly Expenses."),
		"cara": _lt("Add the Gaji Operator expense"),
		"fungsi": _gaji,
	},
	{
		"kunci": "kapasitas",
		"label": _lt("No machine capacity"),
		"akibat": _lt("Any machine is allowed for it, and Plan vs Actual has no target."),
		"cara": _lt("Add a Machine Capacity row"),
		"fungsi": _kapasitas,
	},
	{
		"kunci": "stok",
		"label": _lt("No stock"),
		"akibat": _lt("Recording output fails while it is out of stock."),
		"cara": _lt("Order it"),
		"fungsi": _stok,
	},
)
CEK_ITEM = ("kemasan", "pigmen", "harga", "kapasitas", "stok")  # the Item form's (the wage is no item's)
CEK_PRODUKSI = ("kemasan", "pigmen")  # the Work Order form's


def _produk(item: str | None = None) -> list:
	"""The enabled finished goods that are made and sold (no templates); with `item`, only it or its variants."""
	return frappe.get_all(
		"Item",
		filters={"item_group": GRUP_PRODUK, "disabled": 0, "has_variants": 0},
		or_filters={"name": item, "variant_of": item} if item else None,
		fields=["name", "variant_of"],
		order_by="name",
	)


def periksa(company=None, hari_ini=None, item: str | None = None, kunci=None) -> list[dict]:
	"""Every row of the checks in `CEK` (or only those in `kunci`), for every product or only `item` (and its
	variants)."""
	produk = _produk(item)
	k = frappe._dict(
		produk=produk,
		template={p.variant_of for p in produk if p.variant_of},
		item=item,
		company=company,
		hari_ini=getdate(hari_ini or today()),
	)
	hasil = []
	for c in CEK:
		if kunci and c["kunci"] not in kunci:
			continue
		for nama, rincian, perbaiki, *doctype in c["fungsi"](k):
			hasil.append(
				{
					"cek": c["kunci"],
					"label": str(c["label"]),
					"doctype": doctype[0] if doctype else "Item",
					"nama": nama,
					"rincian": rincian,
					"akibat": str(c["akibat"]),
					"cara": str(c["cara"]),
					"perbaiki": perbaiki,
				}
			)
	return hasil


def _pesan(baris: list[dict], item: str) -> list[dict]:
	"""One note per check: its row's fix, or the report for `item` when the check has several rows."""
	hasil = {}
	for r in baris:
		if r["cek"] in hasil:
			hasil[r["cek"]]["perbaiki"] = {"laporan": LAPORAN, "filters": {"item": item}}
			hasil[r["cek"]]["cara"] = _("See them in Missing Data")
			continue
		teks = f"{r['label']} ({r['rincian']})" if r["rincian"] else r["label"]
		hasil[r["cek"]] = {
			"kunci": r["cek"],
			"pesan": f"{teks}: {r['akibat']}",
			"cara": r["cara"],
			"perbaiki": r["perbaiki"],
		}
	return list(hasil.values())


@frappe.whitelist()
def untuk_item(item: str) -> list[dict]:
	"""The Item form's notes: what this product (or its variants), pigment or packing still lacks."""
	frappe.has_permission("Item", "read", doc=item, throw=True)
	return _pesan(periksa(item=item, kunci=CEK_ITEM), item)


@frappe.whitelist()
def untuk_produksi(work_order: str, item: str) -> list[dict]:
	"""The Work Order form's note: the product has no packing or its colour no pigment. Read on that Work Order
	is enough (Produksi reads no Item) when `item` is its product, else write on it; a draft not saved yet needs
	Work Order create (its item is still being chosen)."""
	if not item:
		return []
	if frappe.db.exists("Work Order", work_order):
		frappe.has_permission("Work Order", "read", doc=work_order, throw=True)
		# Another item is only being typed into a form its user may change.
		if frappe.db.get_value("Work Order", work_order, "production_item") != item:
			frappe.has_permission("Work Order", "write", doc=work_order, throw=True)
	else:
		frappe.has_permission("Work Order", "create", throw=True)
	return _pesan(periksa(item=item, kunci=CEK_PRODUKSI), item)


def tautan(teks: str, perbaiki: dict) -> str:
	"""An HTML link `kelengkapan.js` opens (a click on `.erp-perbaiki`); text and fix escaped."""
	return (
		f'<a href="#" class="erp-perbaiki" data-perbaiki="{escape_html(json.dumps(perbaiki))}">'
		f"{escape_html(teks)}</a>"
	)


def pesan_gaji(company: str, dari, sampai) -> str | None:
	"""Monthly Expenses' message when no Gaji Operator expense runs in `dari..sampai`, with the link to add one."""
	if ada_gaji(company, dari, sampai):
		return None
	baru = {"category": KATEGORI_GAJI, "repeat": PER_SHIFT, "company": company}
	return (
		'<div class="text-warning">'
		+ escape_html(_("Operator wages are not counted in Monthly Expenses."))
		+ " "
		+ tautan(_("Add the Gaji Operator expense"), {"doctype": "Expense Entry", "baru": baru})
		+ "</div>"
	)
