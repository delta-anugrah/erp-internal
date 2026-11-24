"""Missing Data: every row of `kelengkapan.CEK`, each with a link straight to where it is fixed (Abel 2026-11-24).

The checks read with `get_all` (no User Permissions), so the company filter is checked against the caller's
Company permission, as Order Readiness does; an item filter against Item read.
"""

import frappe
from frappe import _

from erp_internal.kelengkapan import periksa


def execute(filters=None):
	filters = frappe._dict(filters or {})
	if not filters.company:
		frappe.throw(_("Select a company."))
	frappe.has_permission("Company", "read", doc=filters.company, throw=True)
	frappe.has_permission("Item", "read", throw=True)  # its ref_doctype; Produksi reads no Item
	if filters.item:
		frappe.has_permission("Item", "read", doc=filters.item, throw=True)
	return kolom(), periksa(company=filters.company, item=filters.item or None)


def kolom() -> list[dict]:
	return [
		{"label": _("Check"), "fieldname": "label", "fieldtype": "Data", "width": 180},
		# Only for the Dynamic Link beside it; the document's name says enough.
		{
			"label": _("Document Type"),
			"fieldname": "doctype",
			"fieldtype": "Link",
			"options": "DocType",
			"hidden": 1,
		},
		{
			"label": _("Document"),
			"fieldname": "nama",
			"fieldtype": "Dynamic Link",
			"options": "doctype",
			"width": 190,
		},
		{"label": _("Details"), "fieldname": "rincian", "fieldtype": "Data", "width": 140},
		{"label": _("How to fix"), "fieldname": "cara", "fieldtype": "Data", "width": 260},
		{"label": _("What happens"), "fieldname": "akibat", "fieldtype": "Data", "width": 400},
	]
