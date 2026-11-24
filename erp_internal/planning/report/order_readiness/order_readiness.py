"""Order Readiness: per finished product for one month, what is short and when production must start
(design §10). A summary for people; the MRP report stays the planner that creates the orders.

Every figure is the company's own: stock in its warehouse, its submitted Sales Orders, Sales Forecasts and
Work Orders (Review Focus 5), and order lines count in stock quantity (Review Focus 2).
"""

from datetime import date

import frappe
from frappe import _
from frappe.query_builder.functions import Min, Sum
from frappe.utils import flt, get_first_day, get_last_day, getdate, today

from erp_internal.planning.rumus import STATUS, hitung_jadwal, hitung_kurang
from erp_internal.setup import GUDANG_JUAL
from erp_internal.setup import gudang as gudang_pabrik

GRUP_BAWAAN = "Barang Jadi"
SO_SELESAI = ("Closed", "Completed")  # orders whose remaining lines no longer count
WO_JALAN = ("Not Started", "In Process")  # Work Orders whose remaining qty is still coming
# The Item Lead Time fields ERPNext's `get_own_lead_time` reads.
FIELD_LAMA = (
	"item_code",
	"capacity_per_day",
	"manufacturing_time_in_mins",
	"no_of_shift",
	"shift_time_in_hours",
	"no_of_workstations",
	"purchase_time",
	"buffer_time",
)


def execute(filters=None):
	filters = frappe._dict(filters or {})
	if not filters.company:
		frappe.throw(_("Select a company."))
	# The report reads Bin, Sales Order and Work Order with frappe.get_all (no User Permissions), so the
	# company and warehouse filters are the only fence: check both against the caller's permissions.
	frappe.has_permission("Company", "read", doc=filters.company, throw=True)
	if filters.gudang:
		if frappe.db.get_value("Warehouse", filters.gudang, "company") != filters.company:
			frappe.throw(
				_("Warehouse {0} does not belong to company {1}.").format(filters.gudang, filters.company)
			)
		frappe.has_permission("Warehouse", "read", doc=filters.gudang, throw=True)
	rows = data(
		filters.company,
		getdate(filters.bulan or get_first_day(today())),
		filters.gudang,
		filters.item_group or GRUP_BAWAAN,
		getdate(today()),
	)
	return kolom(), rows


def kolom() -> list[dict]:
	def k(label, fieldname, fieldtype="Float", width=110, **extra):
		return {"label": label, "fieldname": fieldname, "fieldtype": fieldtype, "width": width, **extra}

	return [
		k(_("Item"), "item_code", "Link", 150, options="Item"),
		k(_("Item Name"), "item_name", "Data", 180),
		k(_("Stock"), "stok"),
		k(_("Open Orders"), "terbuka"),
		k(_("Forecast This Month"), "perkiraan", width=130),
		k(_("Ordered This Month"), "dipesan", width=130),
		k(_("In Production"), "produksi"),
		k(_("Safety Stock"), "safety"),
		k(_("Short"), "kurang", "Int", 90),
		k(_("Lead Time (days)"), "lama", width=120),
		k(_("Latest Start"), "mulai", "Date", 110),
		k(_("Status"), "status", "Data", 130),
	]


def data(company: str, bulan: date, gudang: str | None, item_group: str, hari_ini: date) -> list[dict]:
	"""One row per enabled stock item of `item_group` (and its children), sorted by `STATUS`, then by the
	latest start date."""
	from erpnext.manufacturing.doctype.master_production_schedule.master_production_schedule import (
		get_own_lead_time,
	)

	awal, akhir = getdate(get_first_day(bulan)), getdate(get_last_day(bulan))
	# No warehouse picked: the stock of every selling warehouse (Samuel 2026-11-23).
	gudang = [gudang] if gudang else [gudang_pabrik(company, nama) for nama in GUDANG_JUAL]
	barang = _barang(item_group)
	if not barang:
		return []
	kode = [b.name for b in barang]

	stok = _stok(kode, gudang)
	terbuka = _terbuka(company, kode)
	dipesan = _dipesan(company, kode, awal, akhir)
	perkiraan = _perkiraan(company, kode, awal, akhir)
	produksi = _produksi(company, kode)
	lama_produksi = {
		r.item_code: r for r in frappe.get_all("Item Lead Time", {"item_code": ("in", kode)}, FIELD_LAMA)
	}

	hasil = []
	for b in barang:
		buka = terbuka.get(b.name) or frappe._dict(qty=0, terdekat=None)
		baris = {
			"item_code": b.name,
			"item_name": b.item_name,
			"stok": flt(stok.get(b.name)),
			"terbuka": flt(buka.qty),
			"perkiraan": flt(perkiraan.get(b.name)),
			"dipesan": flt(dipesan.get(b.name)),
			"produksi": flt(produksi.get(b.name)),
			"safety": flt(b.safety_stock),
		}
		baris["kurang"] = hitung_kurang(
			baris["stok"],
			baris["terbuka"],
			baris["perkiraan"],
			baris["dipesan"],
			baris["produksi"],
			baris["safety"],
		)
		lt = lama_produksi.get(b.name)
		baris["lama"] = round(flt(get_own_lead_time(lt, baris["kurang"], True)), 2) if lt else None
		jadwal = hitung_jadwal(
			baris["kurang"],
			baris["lama"],
			baris["terbuka"],
			buka.terdekat and getdate(buka.terdekat),
			baris["stok"],
			baris["produksi"],
			awal,
			hari_ini,
		)
		baris.update(jadwal)
		hasil.append(baris)

	hasil.sort(key=lambda r: (STATUS.index(r["status"]), r["mulai"] or date.max, r["item_code"]))
	return hasil


def _barang(item_group: str) -> list:
	lft, rgt = frappe.db.get_value("Item Group", item_group, ["lft", "rgt"]) or (None, None)
	if lft is None:
		return []
	grup = frappe.get_all("Item Group", {"lft": (">=", lft), "rgt": ("<=", rgt)}, pluck="name")
	return frappe.get_all(
		"Item",
		# A template (has_variants) is never stocked or sold, only its variants: it would be a row of 0s.
		{"item_group": ("in", grup), "disabled": 0, "is_stock_item": 1, "has_variants": 0},
		["name", "item_name", "safety_stock"],
		order_by="name asc",
	)


def _stok(kode: list[str], gudang: list[str]) -> dict[str, float]:
	bin_ = frappe.qb.DocType("Bin")
	rows = (
		frappe.qb.from_(bin_)
		.select(bin_.item_code, Sum(bin_.actual_qty).as_("qty"))
		.where(bin_.item_code.isin(kode) & bin_.warehouse.isin(gudang))
		.groupby(bin_.item_code)
	).run(as_dict=True)
	return {r.item_code: r.qty for r in rows}


def _terbuka(company: str, kode: list[str]) -> dict:
	"""Item → {qty: undelivered stock qty, terdekat: earliest delivery date} over open submitted orders."""
	so, soi = frappe.qb.DocType("Sales Order"), frappe.qb.DocType("Sales Order Item")
	sisa = (soi.qty - soi.delivered_qty) * soi.conversion_factor
	rows = (
		frappe.qb.from_(soi)
		.join(so)
		.on(so.name == soi.parent)
		.select(soi.item_code, Sum(sisa).as_("qty"), Min(soi.delivery_date).as_("terdekat"))
		.where(
			(so.docstatus == 1)
			& (so.company == company)
			& so.status.notin(SO_SELESAI)
			& (soi.parenttype == "Sales Order")
			& soi.item_code.isin(kode)
			& (soi.qty > soi.delivered_qty)
		)
		.groupby(soi.item_code)
	).run(as_dict=True)
	return {r.item_code: r for r in rows}


def _dipesan(company: str, kode: list[str], awal: date, akhir: date) -> dict[str, float]:
	so, soi = frappe.qb.DocType("Sales Order"), frappe.qb.DocType("Sales Order Item")
	rows = (
		frappe.qb.from_(soi)
		.join(so)
		.on(so.name == soi.parent)
		.select(soi.item_code, Sum(soi.stock_qty).as_("qty"))
		.where(
			(so.docstatus == 1)
			& (so.company == company)
			& (soi.parenttype == "Sales Order")
			& soi.item_code.isin(kode)
			& (so.transaction_date >= awal)
			& (so.transaction_date <= akhir)
		)
		.groupby(soi.item_code)
	).run(as_dict=True)
	return {r.item_code: r.qty for r in rows}


def _perkiraan(company: str, kode: list[str], awal: date, akhir: date) -> dict[str, float]:
	"""Per item, the demand dated in the month from the company's newest submitted Sales Forecast (by
	posting date, then creation) that has rows of that item in the month."""
	sf, sfi = frappe.qb.DocType("Sales Forecast"), frappe.qb.DocType("Sales Forecast Item")
	rows = (
		frappe.qb.from_(sfi)
		.join(sf)
		.on(sf.name == sfi.parent)
		.select(sfi.item_code, sf.name, sf.posting_date, sf.creation, Sum(sfi.demand_qty).as_("qty"))
		.where(
			(sf.docstatus == 1)
			& (sf.company == company)
			& (sfi.parentfield == "items")
			& sfi.item_code.isin(kode)
			& (sfi.delivery_date >= awal)
			& (sfi.delivery_date <= akhir)
		)
		.groupby(sfi.item_code, sf.name, sf.posting_date, sf.creation)
	).run(as_dict=True)
	terbaru = {}
	for r in rows:
		kunci = (getdate(r.posting_date or r.creation), r.creation)
		if r.item_code not in terbaru or kunci > terbaru[r.item_code][0]:
			terbaru[r.item_code] = (kunci, r.qty)
	return {k: v[1] for k, v in terbaru.items()}


def _produksi(company: str, kode: list[str]) -> dict[str, float]:
	wo = frappe.qb.DocType("Work Order")
	rows = (
		frappe.qb.from_(wo)
		.select(wo.production_item, Sum(wo.qty - wo.produced_qty).as_("qty"))
		.where(
			(wo.docstatus == 1)
			& (wo.company == company)
			& wo.status.isin(WO_JALAN)
			& wo.production_item.isin(kode)
		)
		.groupby(wo.production_item)
	).run(as_dict=True)
	return {r.production_item: r.qty for r in rows}
