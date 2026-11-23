"""Missing Documents: the submitted documents that still have no photo or scan attached (spec section 7).

Covers every DocType of `lampiran.WAJIB_LAMPIRAN` (with its condition) and the delivery notes whose signed copy
is still to come (`LAMPIRAN_NANTI`). Newest first. The report reads with the query builder (no User Permissions),
so the company filter is the only fence: it is checked against the caller's Company permission, as Order
Readiness does.
"""

import frappe
from frappe import _

from erp_internal.lampiran import LAMPIRAN_NANTI, TANGGAL_DOK, WAJIB_LAMPIRAN


def execute(filters=None):
	filters = frappe._dict(filters or {})
	if not filters.company:
		frappe.throw(_("Select a company."))
	frappe.has_permission("Company", "read", doc=filters.company, throw=True)
	return kolom(), data(filters.company)


def kolom() -> list[dict]:
	return [
		{
			"label": _("Document Type"),
			"fieldname": "doctype",
			"fieldtype": "Link",
			"options": "DocType",
			"width": 160,
		},
		{
			"label": _("Document"),
			"fieldname": "name",
			"fieldtype": "Dynamic Link",
			"options": "doctype",
			"width": 200,
		},
		{"label": _("Date"), "fieldname": "tanggal", "fieldtype": "Date", "width": 110},
	]


def data(company: str) -> list[dict]:
	"""Submitted documents of `company` with no File attached, newest first."""
	baris = []
	for doctype, syarat in [*WAJIB_LAMPIRAN.items(), *((dt, None) for dt in LAMPIRAN_NANTI)]:
		tabel = frappe.qb.DocType(doctype)
		berkas = frappe.qb.DocType("File")
		ada = (
			frappe.qb.from_(berkas)
			.select(berkas.attached_to_name)
			.where(berkas.attached_to_doctype == doctype)
			.where(berkas.attached_to_name.isnotnull())
		)
		q = (
			frappe.qb.from_(tabel)
			.select(tabel.name, tabel[TANGGAL_DOK[doctype]].as_("tanggal"))
			.where((tabel.docstatus == 1) & (tabel.company == company) & tabel.name.notin(ada))
		)
		if syarat:
			q = q.where(tabel[syarat[0]].isin(list(syarat[1])))
		baris += [{"doctype": doctype, **r} for r in q.run(as_dict=True)]
	return sorted(baris, key=lambda r: (r["tanggal"], r["name"]), reverse=True)
