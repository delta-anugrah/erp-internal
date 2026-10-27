"""Fill a draft monthly Sales Forecast from sales history ("Fill from History", design §8 item 7).

Each item's demand is the average of the last full months (`rumus.bulan_acuan`) of Sales History plus
submitted Sales Orders, counted in stock quantity by order date, rounded up. People edit the numbers before
submitting.
"""

from datetime import date

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.query_builder.functions import Sum
from frappe.utils import get_first_day, get_last_day, getdate, today

from erp_internal.planning.rumus import ada_riwayat, bulan_acuan, bulatkan, rata_rata


def qty_per_bulan(company: str, items: list[str], dari: date, sampai: date) -> dict[str, dict[date, float]]:
	"""Item → first of month → quantity sold by `company` between `dari` and `sampai`: Sales History `qty`
	plus `stock_qty` of submitted Sales Orders, by the month of their `transaction_date`.

	Only `docstatus` 1 counts: a draft or cancelled order never does, and an amended order counts once
	(its cancelled original is `docstatus` 2). `stock_qty` turns a Karton line into Pcs."""
	hasil: dict[str, dict[date, float]] = {}
	if not items:
		return hasil

	def tambah(kode, tanggal, qty):
		bulan = get_first_day(tanggal)
		hasil.setdefault(kode, {})
		hasil[kode][bulan] = hasil[kode].get(bulan, 0.0) + float(qty or 0)

	sh = frappe.qb.DocType("Sales History")
	for r in (
		frappe.qb.from_(sh)
		.select(sh.item_code, sh.bulan, Sum(sh.qty).as_("qty"))
		.where((sh.company == company) & sh.item_code.isin(items) & (sh.bulan >= dari) & (sh.bulan <= sampai))
		.groupby(sh.item_code, sh.bulan)
	).run(as_dict=True):
		tambah(r.item_code, r.bulan, r.qty)

	so = frappe.qb.DocType("Sales Order")
	soi = frappe.qb.DocType("Sales Order Item")
	for r in (
		frappe.qb.from_(soi)
		.join(so)
		.on(so.name == soi.parent)
		.select(soi.item_code, so.transaction_date, Sum(soi.stock_qty).as_("qty"))
		.where(
			(so.docstatus == 1)
			& (so.company == company)
			& (soi.parenttype == "Sales Order")
			& soi.item_code.isin(items)
			& (so.transaction_date >= dari)
			& (so.transaction_date <= sampai)
		)
		.groupby(soi.item_code, so.transaction_date)
	).run(as_dict=True):
		tambah(r.item_code, r.transaction_date, r.qty)

	return hasil


def isi(doc: Document, hari_ini: date) -> dict:
	"""Set every demand row of `doc` (a Sales Forecast) from history. No permission check, no save.

	Returns `{"diisi": rows filled, "tanpa_riwayat": items with no history (set to 0), "bulan": months used
	as "MM-YYYY"}`."""
	if not doc.items:
		if not doc.selected_items:
			frappe.throw(_("Select the items first."))
		doc.generate_demand()

	bulan = bulan_acuan(getdate(hari_ini), getdate(doc.from_date))
	items = list(dict.fromkeys(row.item_code for row in doc.items if row.item_code))
	per_item = qty_per_bulan(doc.company, items, bulan[0], get_last_day(bulan[-1]))

	for row in doc.items:
		row.demand_qty = bulatkan(rata_rata(per_item.get(row.item_code, {}), bulan))

	return {
		"diisi": len(doc.items),
		"tanpa_riwayat": [k for k in items if not ada_riwayat(per_item.get(k, {}), bulan)],
		"bulan": [b.strftime("%m-%Y") for b in bulan],
	}


@frappe.whitelist()
def isi_dari_riwayat(sales_forecast: str) -> dict:
	"""The "Fill from History" button: fill a draft monthly Sales Forecast and save it."""
	doc = frappe.get_doc("Sales Forecast", sales_forecast)
	frappe.has_permission("Sales Forecast", "write", doc=doc, throw=True)
	if doc.docstatus != 0 or doc.frequency != "Monthly":
		frappe.throw(_("Fill from History works only on a draft monthly Sales Forecast."))
	hasil = isi(doc, getdate(today()))
	doc.save()
	return hasil
