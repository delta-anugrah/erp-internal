"""Daily Input: Samuel's weekly production sheet as a grid of Work Order blocks, one row per date and one cell per
shift. A filled cell is exactly one submitted Production Entry (its good pieces, run hours = the shift's): a new
number replaces it, an emptied cell cancels it, all or nothing. A cell made another way (several entries,
rejects, other hours) is left to the Production Entry form."""

import io
import re
from datetime import date, timedelta

import frappe
from frappe import _
from frappe.utils import flt, formatdate, getdate, today
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

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


def _entri(work_order: str, tanggal: date | str | None = None, kunci: bool = False) -> list:
	"""The order's submitted entries (of `tanggal`); `kunci` reads them with a locking read."""
	filters = {"work_order": work_order, "docstatus": 1}
	if tanggal:
		filters["posting_date"] = getdate(tanggal)
	return frappe.db.get_values(
		"Production Entry",
		filters,
		[
			"name",
			"posting_date",
			"shift",
			"good_qty",
			"reject_qty",
			"hours",
			"technician",
			"notes",
			"workstation",
		],
		as_dict=True,
		order_by="posting_date asc, creation asc",
		for_update=kunci,
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
		"dibuat": str(getdate(wo.creation)),  # the lower bound of "+ Add date"
		"selesai": wo.status == STATUS_SELESAI,
		"boleh_isi": boleh_isi and terbuka,
		"baris": baris,
		"total": total,
	}


_FIELD_WO = ["name", "status", "production_item", "qty", "stock_uom", "sales_order", "erp_mesin", "creation"]


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
	if work_order:
		orders = frappe.get_list("Work Order", filters=filters, fields=_FIELD_WO)
	else:
		filters["status"] = ("in", STATUS_TERBUKA)
		orders = frappe.get_list("Work Order", filters=filters, fields=_FIELD_WO)
		# Closed orders: only those with an entry in the week and none after it (their last entry is in it).
		di_minggu = set(
			frappe.get_all(
				"Production Entry",
				filters={"docstatus": 1, "posting_date": ("between", (dari, sampai))},
				pluck="work_order",
			)
		)
		if di_minggu:
			sesudah = set(
				frappe.get_all(
					"Production Entry",
					filters={
						"docstatus": 1,
						"work_order": ("in", list(di_minggu)),
						"posting_date": (">", sampai),
					},
					pluck="work_order",
				)
			)
			orders += frappe.get_list(
				"Work Order",
				filters={
					"docstatus": 1,
					"status": ("in", STATUS_TUTUP),
					"name": ("in", list(di_minggu - sesudah) or [""]),
				},
				fields=_FIELD_WO,
			)
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
	# Locks the order: writes to one order's cells run one at a time.
	wo = frappe.db.get_value(
		"Work Order",
		{"name": work_order, "docstatus": 1},
		_FIELD_WO,
		as_dict=True,
		for_update=True,
	)
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
	if tanggal < getdate(wo.creation):
		frappe.throw(
			_("The date cannot be before the Work Order was made ({0}).").format(formatdate(wo.creation))
		)
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
	# A locking read sees the latest committed entries, not this transaction's snapshot: a second request for
	# the same cell, queued on the order's lock, then finds the first one's entry and writes nothing.
	entri_hari = _entri(work_order, tanggal, kunci=True)
	sel = [e for e in entri_hari if e.shift == shift]
	if not _milik_grid(sel, shift):
		frappe.throw(_("Change it in the Production Entry form."))
	if catatan is None:
		catatan = next((e.notes for e in entri_hari if e.notes), None)

	frappe.db.savepoint("input_harian")
	try:
		if sel and int(flt(sel[0].good_qty)) == jumlah:
			if teknisi is not None and teknisi != (sel[0].technician or ""):
				doc = frappe.get_doc("Production Entry", sel[0].name)
				doc.technician = teknisi
				doc.save()  # technician is allow_on_submit
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
						# A replaced cell amends its entry and keeps its machine (the order may have moved since).
						"amended_from": sel[0].name if sel else None,
						"workstation": sel[0].workstation if sel else wo.erp_mesin,
						"posting_date": tanggal,
						"shift": shift,
						"hours": jam_shift(shift),
						"good_qty": jumlah,
						"technician": teknisi
						if teknisi is not None
						else (sel[0].technician if sel else None),
						"notes": catatan,
					}
				).insert().submit()
			_tulis_catatan([e for e in entri_hari if e not in sel], catatan)
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


# Fills read off Samuel's sheet (input-harian.jpeg); CLOSE/DONE and the machine are written in red.
WARNA_EXCEL = {
	"no_po": "FCE4D6",
	"kepala": "9DC3E6",
	"total": "A9D08E",
	"mesin": "F2CEEF",
	"selesai": "FFFF00",
}
MERAH = "FF0000"
FORMAT_ANGKA = "#,##0"
FORMAT_TANGGAL = "dd-mmm-yy"
LEBAR_KOLOM = {1: 6, 2: 13, 3: 10, 4: 14}  # No, Tanggal, Merk, Warna; the shifts, Keterangan, machine follow
LEBAR_SHIFT, LEBAR_KETERANGAN, LEBAR_MESIN = 16, 24, 12
LABEL_TEKNISI = ("Teknisi Pagi", "Teknisi Malam")  # Shift 1, Shift 2 (other shifts: their own name)
TEMPLATE_CETAK = "erp_internal/templates/input_harian_cetak.html"


def angka_teks(n: float) -> str:
	"""13384 as "13.384", the way Samuel writes pieces in text."""
	return f"{round(flt(n)):,}".replace(",", ".")


def _label_shift(x: dict) -> str:
	kata = x["nama"]
	return f"{_(kata)}\n({x['jam']})" if x.get("jam") else _(kata)


def _label_teknisi(i: int, x: dict) -> str:
	kata = x["nama"]
	return _(LABEL_TEKNISI[i]) if i < len(LABEL_TEKNISI) else _(kata)


def _packing(b: dict) -> list[str]:
	"""One text per packing UOM: "Karton of 24 Nos"."""
	return [_("{0} of {1} {2}").format(k["uom"], angka_teks(k["isi"]), b["uom"]) for k in b["kemasan"]]


def buku(data: dict) -> Workbook:
	"""One sheet in Samuel's layout from a `get_data` dict: his three header rows, then the blocks one under
	another (No.Po. cell, PO and packing line, blue column header, a row per date, green TOTAL, the machine in a
	pink cell beside them, CLOSE/DONE above it)."""
	wb = Workbook()
	ws = wb.active
	ws.title = "Input Harian"
	n = len(data["shift"])
	k_ket, k_mesin = 5 + n, 6 + n
	garis = Side(style="thin", color="000000")
	batas = Border(left=garis, right=garis, top=garis, bottom=garis)
	for k in range(1, k_mesin + 1):
		lebar = LEBAR_KOLOM.get(k) or (
			LEBAR_SHIFT if k < k_ket else LEBAR_KETERANGAN if k == k_ket else LEBAR_MESIN
		)
		ws.column_dimensions[get_column_letter(k)].width = lebar

	def tulis(
		baris, k1, k2, nilai=None, *, warna=None, merah=False, rata="center", format=None, kotak=False, **gaya
	):
		"""Write `nilai` into the cells k1..k2 of `baris` (merged when more than one)."""
		if k2 > k1:
			ws.merge_cells(start_row=baris, start_column=k1, end_row=baris, end_column=k2)
		for k in range(k1, k2 + 1):
			sel = ws.cell(baris, k)
			sel.alignment = Alignment(horizontal=rata, vertical="center", wrap_text=True)
			if warna:
				sel.fill = PatternFill("solid", fgColor=warna)
			if kotak:
				sel.border = batas
		sel = ws.cell(baris, k1, nilai)
		sel.font = Font(bold=merah or gaya.get("tebal", False), color=MERAH if merah else None)
		if format:
			sel.number_format = format

	tulis(1, 1, 2, _("Tanggal"), rata="left", tebal=True)
	tulis(1, 3, 3, ":")
	tulis(1, 4, 4, f"{getdate(data['dari']):%d.%m.%Y} - {getdate(data['sampai']):%d.%m.%Y}", rata="left")
	for i, x in enumerate(data["shift"]):
		tulis(2 + i, 1, 2, _label_teknisi(i, x), rata="left", tebal=True)
		tulis(2 + i, 3, 3, ":")
		tulis(2 + i, 4, 4, ", ".join(data["teknisi"].get(x["nama"], [])), rata="left", tebal=True)

	baris = 3 + n + 1  # one blank row after the header rows
	for b in data["blok"]:
		tulis(baris, 1, 3, f"{_('No.Po.')} {b['po_no']}", warna=WARNA_EXCEL["no_po"], rata="left", tebal=True)
		baris += 1
		packing = _packing(b)
		tulis(baris, 1, 2, f"{_('PO')} : {angka_teks(b['qty'])} {b['uom']}", rata="left", tebal=True)
		tulis(baris, 3, 4 + n // 2, f"{_('Packing')}: {packing[0]}" if packing else None, tebal=True)
		tulis(baris, 5 + n // 2, k_ket, " · ".join(packing[1:]) or None, rata="right", tebal=True)
		baris += 1
		kepala = [
			_("No"),
			_("Tanggal"),
			_("Merk"),
			_("Warna"),
			*map(_label_shift, data["shift"]),
			_("Keterangan"),
		]
		for k, teks in enumerate(kepala, 1):
			tulis(baris, k, k, teks, warna=WARNA_EXCEL["kepala"], kotak=True, tebal=True)
		ws.row_dimensions[baris].height = 32
		if b["selesai"]:
			tulis(baris, k_mesin, k_mesin, _("CLOSE/DONE"), warna=WARNA_EXCEL["selesai"], merah=True)
		baris += 1
		awal = baris
		for i, r in enumerate(b["baris"], 1):
			tulis(baris, 1, 1, i, kotak=True)
			tulis(baris, 2, 2, getdate(r["tanggal"]), format=FORMAT_TANGGAL, kotak=True)
			tulis(baris, 3, 3, b["merk"], kotak=True)
			tulis(baris, 4, 4, b["warna"], kotak=True)
			for k, x in enumerate(data["shift"], 5):
				tulis(baris, k, k, r["nilai"].get(x["nama"]), format=FORMAT_ANGKA, kotak=True)
			tulis(baris, k_ket, k_ket, r["catatan"], rata="left", kotak=True)
			baris += 1
		tulis(baris, 1, 4, _("TOTAL"), warna=WARNA_EXCEL["total"], kotak=True, tebal=True)
		for k, x in enumerate(data["shift"], 5):
			tulis(
				baris,
				k,
				k,
				b["total"][x["nama"]],
				warna=WARNA_EXCEL["total"],
				format=FORMAT_ANGKA,
				kotak=True,
				tebal=True,
			)
		tulis(
			baris,
			k_ket,
			k_ket,
			b["total"]["semua"],
			warna=WARNA_EXCEL["total"],
			format=FORMAT_ANGKA,
			kotak=True,
			tebal=True,
		)
		# The machine: one pink cell beside the dates and the TOTAL row.
		ws.merge_cells(start_row=awal, start_column=k_mesin, end_row=baris, end_column=k_mesin)
		for r in range(awal, baris + 1):
			ws.cell(r, k_mesin).fill = PatternFill("solid", fgColor=WARNA_EXCEL["mesin"])
		ws.cell(awal, k_mesin, b["mesin"] or "").font = Font(bold=True, color=MERAH)
		ws.cell(awal, k_mesin).alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
		baris += 2  # a blank row between blocks
	return wb


@frappe.whitelist(methods=["GET"])
def export_excel(dari: str, sampai: str) -> None:
	"""Download the week's blocks as an .xlsx in Samuel's layout (the same data as the page, same read check)."""
	arsip = io.BytesIO()
	buku(get_data(dari, sampai)).save(arsip)
	frappe.response["filename"] = f"input-harian-{dari}-{sampai}.xlsx"
	frappe.response["filecontent"] = arsip.getvalue()
	frappe.response["type"] = "binary"


@frappe.whitelist(methods=["GET"])
def print_html(dari: str, sampai: str) -> str:
	"""The week's blocks as a printable page (A4 landscape) for the page's Print button to open in a new window."""
	data = get_data(dari, sampai)
	return frappe.render_template(
		TEMPLATE_CETAK,
		{
			"data": data,
			"angka": angka_teks,
			"tgl": lambda iso: getdate(iso).strftime("%d-%b-%y"),
			"periode": f"{getdate(data['dari']):%d.%m.%Y} - {getdate(data['sampai']):%d.%m.%Y}",
			"label_shift": _label_shift,
			"label_teknisi": _label_teknisi,
			"packing": _packing,
		},
	)
