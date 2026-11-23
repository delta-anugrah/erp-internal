"""Daily Input: Samuel's weekly production sheet as a grid of Work Order blocks, one row per date and one cell per
shift. A filled cell is exactly one submitted Production Entry (its good pieces, run hours = the shift's): a new
number replaces it, an emptied cell cancels it, all or nothing. A cell made another way (several entries,
rejects, other hours) is left to the Production Entry form."""

import re
from datetime import date, timedelta

import frappe
from frappe import _
from frappe.utils import flt, getdate, today

from erp_internal.planning.doctype.production_entry.production_entry import STATUS_TERBUKA
from erp_internal.setup import JAM_SHIFT, SHIFT_PABRIK, jam_shift

STATUS_SELESAI = "Completed"  # shown as CLOSE/DONE
STATUS_TUTUP = ("Completed", "Stopped", "Closed")  # shown only when their last entry falls in the week
POLA_JUMLAH = re.compile(r"\d+|\d{1,3}(\.\d{3})+")  # whole pieces; dots are thousands separators


def baca_jumlah(teks: str | int | float | None) -> int:
	"""Whole pieces from a cell: "13.384" and "13384" are 13384, empty is 0; a comma, a minus or other text is
	refused."""
	if teks is None:
		return 0
	if isinstance(teks, int | float):
		if teks < 0 or teks != int(teks):
			frappe.throw(_("Enter whole pieces, like 13.384."))
		return int(teks)
	teks = teks.strip()
	if not teks:
		return 0
	if not POLA_JUMLAH.fullmatch(teks):
		frappe.throw(_("Enter whole pieces, like 13.384."))
	return int(teks.replace(".", ""))


def minggu(tanggal: date) -> tuple[date, date]:
	"""Monday and Sunday of the week of `tanggal`."""
	senin = getdate(tanggal) - timedelta(days=getdate(tanggal).weekday())
	return senin, senin + timedelta(days=6)


def _shift() -> list[str]:
	return [nama for nama, _jam in SHIFT_PABRIK]


def _boleh_isi() -> bool:
	return bool(frappe.has_permission("Production Entry", "create"))


def _milik_grid(entri: list, shift: str) -> bool:
	"""Whether a cell's entries are the grid's own: one entry, no reject, the shift's run hours."""
	return len(entri) <= 1 and all(
		not flt(e.reject_qty) and flt(e.hours) == flt(jam_shift(shift)) for e in entri
	)


def _entri(work_order: str, tanggal: date | str | None = None) -> list:
	filters = {"work_order": work_order, "docstatus": 1}
	if tanggal:
		filters["posting_date"] = getdate(tanggal)
	return frappe.get_all(
		"Production Entry",
		filters=filters,
		fields=["name", "posting_date", "shift", "good_qty", "reject_qty", "hours", "technician", "notes"],
		order_by="posting_date asc, creation asc",
	)


def _blok(wo, boleh_isi: bool) -> dict:
	"""The block of Work Order row `wo` (fields of `_FIELD_WO`): header, one row per date with entries plus
	today's empty row while the order is open, and the totals."""
	shift = _shift()
	# Read on the server: Produksi reads Work Orders but not Items or Sales Orders.
	item = frappe.db.get_value("Item", wo.production_item, ["item_name", "brand", "stock_uom"], as_dict=True)
	kemasan = frappe.get_all(
		"UOM Conversion Detail",
		filters={"parent": wo.production_item, "parenttype": "Item", "uom": ("!=", item.stock_uom)},
		fields=["uom", "conversion_factor"],
		order_by="conversion_factor asc",
	)
	terbuka = wo.status in STATUS_TERBUKA

	per_tanggal: dict[date, list] = {}
	for e in _entri(wo.name):
		per_tanggal.setdefault(getdate(e.posting_date), []).append(e)
	hari_ini = getdate(today())
	if terbuka and hari_ini not in per_tanggal:
		per_tanggal[hari_ini] = []

	baris, total = [], dict.fromkeys(shift, 0)
	for tanggal in sorted(per_tanggal):
		entri = per_tanggal[tanggal]
		nilai, kunci = {}, {}
		for s in shift:
			sel = [e for e in entri if e.shift == s]
			nilai[s] = int(sum(flt(e.good_qty) for e in sel)) if sel else None
			kunci[s] = None if _milik_grid(sel, s) else sel[0].name
			total[s] += nilai[s] or 0
		baris.append(
			{
				"tanggal": str(tanggal),
				"nilai": nilai,
				"kunci": kunci,
				"catatan": next((e.notes for e in entri if e.notes), None),
			}
		)
	total["semua"] = sum(total[s] for s in shift)

	return {
		"work_order": wo.name,
		"po_no": (wo.sales_order and frappe.db.get_value("Sales Order", wo.sales_order, "po_no")) or wo.name,
		"qty": flt(wo.qty),
		"uom": wo.stock_uom or item.stock_uom,
		"item_code": wo.production_item,
		"item_name": item.item_name,
		"merk": item.brand,
		"warna": frappe.db.get_value(
			"Item Variant Attribute", {"parent": wo.production_item, "attribute": "Warna"}, "attribute_value"
		),
		"kemasan": [{"uom": k.uom, "isi": flt(k.conversion_factor)} for k in kemasan],
		"mesin": wo.erp_mesin,
		"nomor_mesin": wo.erp_mesin and frappe.db.get_value("Workstation", wo.erp_mesin, "erp_nomor"),
		"status": wo.status,
		"selesai": wo.status == STATUS_SELESAI,
		"boleh_isi": boleh_isi and terbuka,
		"baris": baris,
		"total": total,
	}


_FIELD_WO = ["name", "status", "production_item", "qty", "stock_uom", "sales_order", "erp_mesin"]


def _blok_order(work_order: str) -> dict:
	"""The block of `work_order` as it is now (after a write)."""
	return _blok(frappe.db.get_value("Work Order", work_order, _FIELD_WO, as_dict=True), _boleh_isi())


@frappe.whitelist(methods=["GET"])
def get_data(dari: str | None = None, sampai: str | None = None, work_order: str | None = None) -> dict:
	"""The week from `dari` to `sampai` (default this week): the open Work Orders' blocks, plus the closed ones
	whose last entry falls in the week, by machine number; or only `work_order`'s block."""
	frappe.has_permission("Work Order", "read", throw=True)
	senin, minggu_ = minggu(getdate(dari or today()))
	dari, sampai = getdate(dari or senin), getdate(sampai or minggu_)
	boleh_isi = _boleh_isi()

	filters = {"docstatus": 1, "status": ("in", (*STATUS_TERBUKA, *STATUS_TUTUP))}
	if work_order:
		filters["name"] = work_order
	orders = frappe.get_list("Work Order", filters=filters, fields=_FIELD_WO)
	if not work_order:
		akhir = {}  # each order's last entry date
		for e in frappe.get_all(
			"Production Entry",
			filters={"docstatus": 1, "work_order": ("in", [o.name for o in orders] or [""])},
			fields=["work_order", "posting_date"],
			order_by="posting_date asc",
		):
			akhir[e.work_order] = e.posting_date
		orders = [
			o
			for o in orders
			if o.status in STATUS_TERBUKA or (akhir.get(o.name) and dari <= getdate(akhir[o.name]) <= sampai)
		]
	blok = [_blok(o, boleh_isi) for o in orders]
	blok.sort(key=lambda b: (b["nomor_mesin"] is None, b["nomor_mesin"] or 0, b["work_order"]))

	shift = _shift()
	minggu_ini = frappe.get_all(
		"Production Entry",
		filters={"docstatus": 1, "posting_date": ("between", (dari, sampai)), "technician": ("is", "set")},
		fields=["shift", "technician"],
		order_by="posting_date asc, creation asc",
	)
	teknisi = {s: list(dict.fromkeys(e.technician for e in minggu_ini if e.shift == s)) for s in shift}
	teknisi_terakhir = {
		s: frappe.db.get_value(
			"Production Entry",
			{"docstatus": 1, "shift": s, "technician": ("is", "set")},
			"technician",
			order_by="posting_date desc, creation desc",
		)
		for s in shift
	}
	return {
		"dari": str(dari),
		"sampai": str(sampai),
		"shift": [{"nama": s, "jam": JAM_SHIFT.get(s)} for s in shift],
		"boleh_isi": boleh_isi,
		"teknisi": teknisi,
		"teknisi_terakhir": teknisi_terakhir,
		"blok": blok,
	}


def _siapkan_tulis(work_order: str, tanggal: str):
	"""The checks before a write: the user's Production Entry rights, the order locked, open and on a machine,
	and the date not in the future. Returns the order row and the date."""
	for hak in ("create", "submit", "cancel"):
		frappe.has_permission("Production Entry", hak, throw=True)
	frappe.has_permission("Work Order", "read", doc=work_order, throw=True)
	frappe.db.get_value("Work Order", work_order, "name", for_update=True)
	wo = frappe.db.get_value("Work Order", {"name": work_order, "docstatus": 1}, _FIELD_WO, as_dict=True)
	if not wo:
		frappe.throw(_("Submit Work Order {0} first.").format(frappe.bold(work_order)))
	if wo.status not in STATUS_TERBUKA:
		frappe.throw(
			_("Work Order {0} takes no output: it is {1}.").format(frappe.bold(work_order), _(wo.status))
		)
	if not wo.erp_mesin:
		frappe.throw(_("No machine yet: Admin sets it on the Work Order."))
	tanggal = getdate(tanggal)
	if tanggal > getdate(today()):
		frappe.throw(_("The date cannot be in the future."))
	return wo, tanggal


def _tulis_catatan(entri: list, catatan: str | None) -> None:
	for e in entri:
		if (e.notes or "") != (catatan or ""):
			doc = frappe.get_doc("Production Entry", e.name)
			doc.notes = catatan
			doc.save()  # notes is allow_on_submit


@frappe.whitelist(methods=["POST"])
def save_cell(
	work_order: str,
	tanggal: str,
	shift: str,
	qty: str,
	teknisi: str | None = None,
	catatan: str | None = None,
) -> dict:
	"""Make the cell (order, date, shift) hold `qty` good pieces: its entry replaced, cancelled when 0, or a new
	one made; nothing written when it already holds `qty` and the note is unchanged. Returns the order's block."""
	wo, tanggal = _siapkan_tulis(work_order, tanggal)
	if shift not in _shift():
		frappe.throw(_("Unknown shift {0}.").format(frappe.bold(shift)))
	jumlah = baca_jumlah(qty)
	entri_hari = _entri(work_order, tanggal)
	sel = [e for e in entri_hari if e.shift == shift]
	if not _milik_grid(sel, shift):
		frappe.throw(_("Change it in the Production Entry form."))
	if catatan is None:
		catatan = next((e.notes for e in entri_hari if e.notes), None)

	frappe.db.savepoint("input_harian")
	try:
		if sel and int(flt(sel[0].good_qty)) == jumlah:
			_tulis_catatan(entri_hari, catatan)
		elif sel or jumlah:
			if sel:
				frappe.get_doc("Production Entry", sel[0].name).cancel()
			if jumlah:
				frappe.get_doc(
					{
						"doctype": "Production Entry",
						"company": frappe.db.get_value("Work Order", work_order, "company"),
						"work_order": work_order,
						"workstation": wo.erp_mesin,
						"posting_date": tanggal,
						"shift": shift,
						"hours": jam_shift(shift),
						"good_qty": jumlah,
						"technician": teknisi,
						"notes": catatan,
					}
				).insert().submit()
	except Exception:
		frappe.db.rollback(save_point="input_harian")
		raise
	return _blok_order(work_order)


@frappe.whitelist(methods=["POST"])
def save_note(work_order: str, tanggal: str, catatan: str) -> dict:
	"""Write `catatan` as the notes of the order's entries of that date. Returns the order's block."""
	_wo, tanggal = _siapkan_tulis(work_order, tanggal)
	entri = _entri(work_order, tanggal)
	if not entri:
		frappe.throw(_("Enter a number first: a note needs an entry to hold it."))
	frappe.db.savepoint("input_harian")
	try:
		_tulis_catatan(entri, catatan)
	except Exception:
		frappe.db.rollback(save_point="input_harian")
		raise
	return _blok_order(work_order)
