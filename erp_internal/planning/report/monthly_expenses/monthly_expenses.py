"""Monthly Expenses: what the factory spent in one month, per category (spec section 5).

- Once: the entries dated in the month.
- Every month: its amount in every month from its date's month to its Until month (an entry dated the 31st counts in
  every later month; an Until in mid-month still counts that month).
- Per machine shift: its amount times the machine shifts between its date and Until (both inclusive) inside the month.
  A machine shift is one distinct (machine, date, shift) of the submitted Production Entries, on the entry's own
  machine: two orders on one machine in one shift count once. One indented row per machine under the category.

Rows are a plain list ending in a Total row, so more rows (computed costs) can be appended before the total:
`BIAYA_STOK`, the pigment and packing production used up in the month (`pemakaian`, spec A3).
The report reads with `get_all`, so it checks the caller's Company and Expense Entry permission itself.
"""

from collections import defaultdict
from collections.abc import Callable
from datetime import date

import frappe
from frappe import _
from frappe.query_builder.functions import Count
from frappe.utils import flt, get_first_day, get_last_day, getdate

from erp_internal.planning.doctype.expense_entry.expense_entry import PER_SHIFT
from erp_internal.setup import KATEGORI_BIAYA

# Computed rows (spec A3): report row → the Item Group whose stock production used up in the month.
BIAYA_STOK = {"Pigmen": "Pigmen", "Kemasan": "Kemasan"}


def execute(filters=None):
	filters = frappe._dict(filters or {})
	if not filters.company:
		frappe.throw(_("Select a company."))
	frappe.has_permission("Company", "read", doc=filters.company, throw=True)
	frappe.has_permission("Expense Entry", "read", throw=True)
	bulan = getdate(filters.bulan or frappe.utils.today())
	awal, akhir = get_first_day(bulan), get_last_day(bulan)
	baris = data(filters.company, awal, akhir) + [
		{"kategori": label, "keterangan": _("Used by production"), "jumlah": nilai, "indent": 0}
		for label, nilai in pemakaian(filters.company, awal, akhir).items()
	]
	total = sum(r["jumlah"] for r in baris if not r["indent"])
	return kolom(), [
		*baris,
		{"kategori": _("Total"), "keterangan": "", "jumlah": total, "indent": 0, "total": 1},
	]


def kolom() -> list[dict]:
	return [
		{"label": _("Category"), "fieldname": "kategori", "fieldtype": "Data", "width": 220},
		{"label": _("Details"), "fieldname": "keterangan", "fieldtype": "Data", "width": 300},
		{"label": _("Amount"), "fieldname": "jumlah", "fieldtype": "Currency", "width": 160},
	]


def data(company: str, awal: date, akhir: date) -> list[dict]:
	"""One row per category with an amount in `awal..akhir`, each Per machine shift category followed by one
	indented row per machine."""
	entri = frappe.get_all(
		"Expense Entry",
		filters={"docstatus": 1, "company": company, "posting_date": ("<=", akhir)},
		fields=["category", "repeat", "amount", "posting_date", "until"],
	)
	nilai = defaultdict(float)
	rincian = defaultdict(
		lambda: defaultdict(lambda: {"shift": 0, "hari_24": 0, "hari_12": 0, "jumlah": 0.0})
	)
	for e in entri:
		per_mesin = {}

		def hitung(dari, sampai, per_mesin=per_mesin):
			per_mesin.update(shift_mesin(company, dari, sampai))
			return sum(m["shift"] for m in per_mesin.values())

		nilai[e.category] += jumlah(e, awal, akhir, hitung)
		for mesin, m in per_mesin.items():
			r = rincian[e.category][mesin]
			for k in ("shift", "hari_24", "hari_12"):
				r[k] += m[k]
			r["jumlah"] += e.amount * m["shift"]

	urutan = {k: i for i, k in enumerate(KATEGORI_BIAYA)}
	baris = []
	for kategori in sorted(nilai, key=lambda k: (urutan.get(k, len(urutan)), k)):
		if not nilai[kategori]:
			continue
		baris.append({"kategori": kategori, "keterangan": "", "jumlah": nilai[kategori], "indent": 0})
		for mesin, r in sorted(rincian[kategori].items()):
			keterangan = _("{0} shifts · {1} days 24 h · {2} days 12 h").format(
				r["shift"], r["hari_24"], r["hari_12"]
			)
			baris.append({"kategori": mesin, "keterangan": keterangan, "jumlah": r["jumlah"], "indent": 1})
	return baris


def jumlah(entri, awal: date, akhir: date, shift: Callable[[date, date], int]) -> float:
	"""One entry's amount in the month `awal..akhir`; `shift(dari, sampai)` counts the machine shifts."""
	mulai = getdate(entri.posting_date)
	sampai = getdate(entri.until) if entri.until else None
	if entri.repeat == "Once":
		return entri.amount if awal <= mulai <= akhir else 0
	if mulai > akhir or (sampai and sampai < awal):
		return 0
	if entri.repeat == PER_SHIFT:
		return entri.amount * shift(max(mulai, awal), min(sampai or akhir, akhir))
	return entri.amount


def pemakaian(company: str, awal: date, akhir: date) -> dict[str, float]:
	"""`BIAYA_STOK` row → the stock value production took out in `awal..akhir`: minus the summed
	`stock_value_difference` of the stock ledger rows of items in that group, from the Manufacture and Repack
	entries of the submitted Production Entries of `company`. Only rows not 0."""
	nilai = dict(
		frappe.db.sql(
			"""select i.item_group, -sum(sle.stock_value_difference)
			from `tabStock Ledger Entry` sle join `tabItem` i on i.name = sle.item_code
			where sle.is_cancelled = 0 and sle.company = %(company)s and sle.voucher_type = 'Stock Entry'
				and sle.posting_date between %(awal)s and %(akhir)s and i.item_group in %(grup)s
				and sle.voucher_no in (
					select manufacture_entry from `tabProduction Entry` where docstatus = 1 and company = %(company)s
					union
					select reject_entry from `tabProduction Entry` where docstatus = 1 and company = %(company)s
				)
			group by i.item_group""",
			{"company": company, "awal": awal, "akhir": akhir, "grup": tuple(BIAYA_STOK.values())},
		)
	)
	return {label: flt(nilai[grup]) for label, grup in BIAYA_STOK.items() if flt(nilai.get(grup))}


def shift_mesin(company: str, dari: date, sampai: date) -> dict[str, dict]:
	"""Machine → its shifts, days with two shifts (24 h) and days with one (12 h) in `dari..sampai`, from the
	distinct (machine, date, shift) of the submitted Production Entries of `company`."""
	pe = frappe.qb.DocType("Production Entry")
	sel = (
		frappe.qb.from_(pe)
		.select(pe.workstation, pe.posting_date, Count(pe.shift).distinct().as_("n"))
		.where(
			(pe.docstatus == 1)
			& (pe.company == company)
			& (pe.posting_date >= dari)
			& (pe.posting_date <= sampai)
		)
		.groupby(pe.workstation, pe.posting_date)
		.run(as_dict=True)
	)
	hasil = {}
	for r in sel:
		m = hasil.setdefault(r.workstation, {"shift": 0, "hari_24": 0, "hari_12": 0})
		m["shift"] += r.n
		m["hari_24" if r.n >= 2 else "hari_12"] += 1
	return hasil
