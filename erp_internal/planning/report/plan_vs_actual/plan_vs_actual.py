"""Plan vs Actual: what was planned against what Production Entries recorded, per machine, day, item, Work
Order or shift (spec 2026-10-28-plan-vs-actual-design.md).

The base unit is a cell (machine, day, Work Order, shift); every grouping sums cells. Every figure is the
company's own: submitted Production Entries and submitted Work Orders of that company only.
"""

import re
from datetime import date, timedelta

import frappe
from frappe import _
from frappe.utils import add_days, flt, getdate

from erp_internal.planning.kapasitas import kapasitas
from erp_internal.setup import SHIFT_PABRIK

# Achieved % is green from CAPAI_HIJAU, orange from CAPAI_KUNING, red below. plan_vs_actual.js reads the two
# values from the Achieved % column (`hijau`, `kuning`); its own defaults repeat them.
CAPAI_HIJAU = 100
CAPAI_KUNING = 85
TANPA_MESIN = "No machine"  # the machine key of an order with no machine; shown translated
KELOMPOK = {
	"Machine": ("mesin",),
	"Machine + Day": ("mesin", "tanggal"),
	"Day": ("tanggal",),
	"Item": ("item",),
	"Work Order": ("work_order",),
	"Shift": ("shift",),
}
TARGET_DARI = ("Work Order", "Capacity")
KUNCI_SEL = ("mesin", "tanggal", "work_order", "shift")
CATATAN_TANPA_KAPASITAS = "No capacity"


def target_harian(qty: float, mulai: date, selesai: date | None) -> dict[date, float]:
	"""`qty` spread evenly over the calendar days `mulai` to `selesai` inclusive; with no end, or one before
	the start, all on `mulai`."""
	if selesai is None or selesai < mulai:
		return {mulai: qty}
	hari = (selesai - mulai).days + 1
	return {mulai + timedelta(days=i): qty / hari for i in range(hari)}


def bagi_shift(target: float, jam: dict[str, float]) -> dict[str, float]:
	"""`target` split over shifts by the hours recorded in each; with no hours at all, evenly over
	`SHIFT_PABRIK`."""
	total = sum(jam.values())
	if total <= 0:
		nama = [n for n, _j in SHIFT_PABRIK]
		return {n: target / len(nama) for n in nama}
	return {n: target * j / total for n, j in jam.items()}


def execute(filters=None):
	f = frappe._dict(filters or {})
	if not f.company:
		frappe.throw(_("Select a company."))
	# The report reads with frappe.qb (no User Permissions), so the company filter is the only fence.
	frappe.has_permission("Company", "read", doc=f.company, throw=True)
	f.from_date, f.to_date = _tanggal(f)
	if f.from_date > f.to_date:
		frappe.throw(_("From Date cannot be after To Date."))
	f.group_by = f.group_by or "Machine + Day"
	if f.group_by not in KELOMPOK:
		frappe.throw(_("Unknown grouping {0}.").format(frappe.bold(f.group_by)))
	rows = data(f)
	return kolom(f.group_by, rows), _tampil(rows), None, grafik(f.group_by, rows)


def _tanggal(f) -> tuple[date, date]:
	kemarin = getdate(add_days(getdate(), -1))
	akhir = getdate(f.to_date) if f.to_date else kemarin
	awal = getdate(f.from_date) if f.from_date else add_days(akhir, -6)
	return getdate(awal), akhir


def _tampil(rows: list[dict]) -> list[dict]:
	"""The rows as sent to the desk: the machine key translated, the internal reason map dropped."""
	return [
		{
			**{k: v for k, v in r.items() if k != "_alasan"},
			"mesin": _(TANPA_MESIN) if r.get("mesin") == TANPA_MESIN else r.get("mesin"),
		}
		for r in rows
	]


def nama_alasan(alasan: str) -> str:
	"""The fieldname of a reject reason's column."""
	return "r_" + re.sub(r"\W", "_", frappe.scrub(alasan))


def kolom(group_by: str, rows: list[dict]) -> list[dict]:
	def k(label, fieldname, fieldtype="Float", width=110, **extra):
		return {"label": label, "fieldname": fieldname, "fieldtype": fieldtype, "width": width, **extra}

	kunci = {
		"mesin": k(_("Machine"), "mesin", "Data", 150),
		"tanggal": k(_("Date"), "tanggal", "Date", 100),
		"item": k(_("Item"), "item", "Link", 150, options="Item"),
		"work_order": k(_("Work Order"), "work_order", "Link", 150, options="Work Order"),
		"shift": k(_("Shift"), "shift", "Data", 90),
	}
	kolom = [kunci[n] for n in KELOMPOK[group_by]]
	kolom += [
		k(_("Target"), "target", precision=0),
		k(_("Good"), "good", precision=0),
		k(_("Reject"), "reject", precision=0),
		k(_("Reject %"), "persen_reject", precision=1, width=90),
		k(_("Achieved %"), "capai", precision=1, width=100, hijau=CAPAI_HIJAU, kuning=CAPAI_KUNING),
		k(_("Note"), "catatan", "Data", 120),
	]
	ada = {}
	for r in rows:
		for n in r:
			if n.startswith("r_"):
				ada[n] = r["_alasan"][n]
	return kolom + [k(label, n, precision=0, width=100) for n, label in sorted(ada.items())]


def grafik(group_by: str, rows: list[dict]) -> dict:
	def label(r):
		bagian = []
		for n in KELOMPOK[group_by]:
			nilai = r.get(n)
			bagian.append(_(TANPA_MESIN) if nilai == TANPA_MESIN else str(nilai))
		return " · ".join(bagian)

	return {
		"type": "bar",
		"data": {
			"labels": [label(r) for r in rows],
			"datasets": [
				{"name": _("Target"), "values": [flt(r["target"]) for r in rows]},
				{"name": _("Good"), "values": [r["good"] for r in rows]},
				{"name": _("Reject"), "values": [r["reject"] for r in rows]},
			],
		},
	}


def data(f: frappe._dict) -> list[dict]:
	"""Rows of `f.group_by`, each with target (None without one), good, reject, one `r_<reason>` per reason,
	capai, persen_reject and catatan. See the module docstring for the cell logic."""
	awal, akhir = _tanggal(f)
	mode = f.target_dari or "Work Order"
	if mode not in TARGET_DARI:
		frappe.throw(_("Unknown target source {0}.").format(frappe.bold(mode)))
	barang = _barang(f.item)
	entri = _entri(f, awal, akhir, barang)
	order = _order(f, awal, akhir, barang, {e.work_order for e in entri})
	entri = [e for e in entri if e.work_order in order]  # a cancelled Work Order's output is not counted

	sel: dict[tuple, frappe._dict] = {}

	def ambil(mesin, tanggal, wo, shift):
		kunci = (mesin, tanggal, wo, shift)
		if kunci not in sel:
			sel[kunci] = frappe._dict(
				mesin=mesin,
				tanggal=tanggal,
				work_order=wo,
				shift=shift,
				item=order[wo].production_item,
				target=None,
				good=0.0,
				reject=0.0,
				jam=0.0,
				alasan={},
			)
		return sel[kunci]

	jam_hari: dict[tuple, dict[str, float]] = {}  # (Work Order, day) → shift → recorded hours
	for e in entri:
		s = ambil(e.workstation, getdate(e.posting_date), e.work_order, e.shift)
		s.good += flt(e.good_qty)
		s.reject += flt(e.reject_qty)
		s.jam += flt(e.hours)
		for alasan, qty in e.alasan.items():
			s.alasan[alasan] = s.alasan.get(alasan, 0) + qty
		jam = jam_hari.setdefault((e.work_order, getdate(e.posting_date)), {})
		jam[e.shift] = jam.get(e.shift, 0) + flt(e.hours)

	if mode == "Capacity":
		for s in sel.values():
			baris = kapasitas(s.item, s.mesin)
			s.target = flt(baris.pcs_per_hour) * s.jam if baris else None
	for wo, o in order.items():
		if o.mulai is None:
			continue  # output only: nothing planned inside the range
		mesin = o.erp_mesin or TANPA_MESIN
		hari = target_harian(flt(o.qty), o.mulai, o.selesai)
		for tanggal, bagian in hari.items():
			if not awal <= tanggal <= akhir:
				continue
			jam = jam_hari.get((wo, tanggal), {})
			if mode == "Work Order":
				for shift, target in bagi_shift(bagian, jam).items():
					s = ambil(mesin, tanggal, wo, shift)
					s.target = flt(s.target) + target
			elif not jam:
				# Capacity: a planned day with nothing recorded has no hours, so a target of 0 where a
				# capacity row exists, none where it does not.
				ada = o.erp_mesin and kapasitas(o.production_item, o.erp_mesin)
				for shift, _jam in SHIFT_PABRIK:
					ambil(mesin, tanggal, wo, shift).target = 0.0 if ada else None

	cells = [s for s in sel.values() if not f.shift or s.shift == f.shift]
	return _kelompok(cells, f.group_by or "Machine + Day", mode, _nomor_mesin(cells))


def _barang(item: str | None) -> list[str] | None:
	"""The item and, for a template, all its variants; None when no item filter is set."""
	if not item:
		return None
	return [item, *frappe.get_all("Item", {"variant_of": item}, pluck="name")]


def _entri(f, awal: date, akhir: date, barang: list[str] | None) -> list:
	pe, pr = frappe.qb.DocType("Production Entry"), frappe.qb.DocType("Production Entry Reject")
	q = (
		frappe.qb.from_(pe)
		.select(
			pe.name,
			pe.posting_date,
			pe.shift,
			pe.work_order,
			pe.workstation,
			pe.good_qty,
			pe.reject_qty,
			pe.hours,
		)
		.where(
			(pe.docstatus == 1)
			& (pe.company == f.company)
			& (pe.posting_date >= awal)
			& (pe.posting_date <= akhir)
		)
	)
	if f.workstation:
		q = q.where(pe.workstation == f.workstation)
	if f.work_order:
		q = q.where(pe.work_order == f.work_order)
	if barang is not None:
		q = q.where(pe.item.isin(barang))
	rows = q.run(as_dict=True)
	alasan: dict[str, dict] = {}
	if rows:
		for r in (
			frappe.qb.from_(pr)
			.select(pr.parent, pr.reason, pr.qty)
			.where((pr.parent.isin([r.name for r in rows])) & (pr.parenttype == "Production Entry"))
		).run(as_dict=True):
			per = alasan.setdefault(r.parent, {})
			per[r.reason] = per.get(r.reason, 0) + flt(r.qty)
	for r in rows:
		r.alasan = alasan.get(r.name, {})
		r.shift = r.shift or ""
	return rows


def _order(f, awal: date, akhir: date, barang: list[str] | None, dipakai: set[str]) -> dict:
	"""The submitted Work Orders of the company that are planned inside the range or have output in it, by
	name. `mulai`/`selesai` are the planned window (end: planned end, else expected delivery, else None)."""
	wo = frappe.qb.DocType("Work Order")
	q = (
		frappe.qb.from_(wo)
		.select(
			wo.name,
			wo.production_item,
			wo.qty,
			wo.erp_mesin,
			wo.planned_start_date,
			wo.planned_end_date,
			wo.expected_delivery_date,
		)
		.where((wo.docstatus == 1) & (wo.company == f.company))
	)
	if f.work_order:
		q = q.where(wo.name == f.work_order)
	if barang is not None:
		q = q.where(wo.production_item.isin(barang))
	hasil = {}
	for r in q.run(as_dict=True):
		mulai = getdate(r.planned_start_date) if r.planned_start_date else None
		selesai = r.planned_end_date or r.expected_delivery_date
		selesai = getdate(selesai) if selesai else None
		r.mulai, r.selesai = mulai, selesai
		jadwal = bool(mulai) and mulai <= akhir and (selesai or mulai) >= awal
		if f.workstation and r.erp_mesin != f.workstation:
			jadwal = False
		if not jadwal and r.name not in dipakai:
			continue
		if not jadwal:
			r.mulai = None  # output only: nothing planned inside the range
		hasil[r.name] = r
	return hasil


def _nomor_mesin(cells: list) -> dict[str, int]:
	nama = {s.mesin for s in cells if s.mesin != TANPA_MESIN}
	if not nama:
		return {}
	rows = frappe.get_all("Workstation", {"name": ("in", list(nama))}, ["name", "erp_nomor"], as_list=True)
	return dict(rows)


def _kelompok(cells: list, group_by: str, mode: str, nomor: dict) -> list[dict]:
	kunci = KELOMPOK[group_by]
	grup: dict[tuple, dict] = {}
	for s in cells:
		g = tuple(s[n] for n in kunci)
		baris = grup.setdefault(
			g, {**dict(zip(kunci, g, strict=True)), "target": None, "good": 0.0, "reject": 0.0, "_alasan": {}}
		)
		if s.target is not None:
			baris["target"] = flt(baris["target"]) + s.target
		baris["good"] += s.good
		baris["reject"] += s.reject
		for alasan, qty in s.alasan.items():
			n = nama_alasan(alasan)
			baris[n] = baris.get(n, 0) + qty
			baris["_alasan"][n] = alasan

	def urut(r):
		mesin = r.get("mesin")
		return (
			mesin == TANPA_MESIN,
			nomor.get(mesin) or 0,
			mesin or "",
			r.get("tanggal") or date.min,
			r.get("item") or "",
			r.get("work_order") or "",
			r.get("shift") or "",
		)

	hasil = []
	for r in sorted(grup.values(), key=urut):
		jumlah = r["good"] + r["reject"]
		r["persen_reject"] = r["reject"] * 100 / jumlah if jumlah else 0
		r["capai"] = r["good"] * 100 / r["target"] if r["target"] else None
		r["catatan"] = _(CATATAN_TANPA_KAPASITAS) if mode == "Capacity" and r["target"] is None else None
		hasil.append(r)
	return hasil
