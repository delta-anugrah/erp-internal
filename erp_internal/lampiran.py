"""Real documents attached (Samuel 2026-11-23, spec section 7): a paper document the office keeps (order, invoice,
receipt, payment, a received delivery) must have its photo or scan attached before it is submitted.

Production's own records (Manufacture and Repack Stock Entries, Work Orders, BOMs, Production Entries, Stock
Reconciliations) are not in the table and never need one.
"""

import frappe
from frappe import _

# DocType -> None (always) or (field, values): only when the document's field holds one of the values.
WAJIB_LAMPIRAN: dict[str, tuple[str, tuple[str, ...]] | None] = {
	"Sales Order": None,
	"Sales Invoice": None,
	"Purchase Order": None,
	"Purchase Receipt": None,
	"Purchase Invoice": None,
	"Payment Entry": None,
	"Stock Entry": ("purpose", ("Material Receipt",)),
	"Expense Entry": ("repeat", ("Once",)),  # a repeating expense has no one paper document
}
# Submitted as today; the signed copy is attached afterwards (attachments stay open on a submitted document).
LAMPIRAN_NANTI = ("Delivery Note",)
# DocType -> its date field, for the Missing Documents report. Every DocType above and below needs a row.
TANGGAL_DOK = {
	"Sales Order": "transaction_date",
	"Purchase Order": "transaction_date",
	"Delivery Note": "posting_date",
	"Sales Invoice": "posting_date",
	"Purchase Receipt": "posting_date",
	"Purchase Invoice": "posting_date",
	"Payment Entry": "posting_date",
	"Stock Entry": "posting_date",
	"Expense Entry": "posting_date",
}


def wajib(doc) -> bool:
	"""Whether `doc` must have a File attached before it is submitted."""
	if doc.doctype not in WAJIB_LAMPIRAN:
		return False
	syarat = WAJIB_LAMPIRAN[doc.doctype]
	return syarat is None or doc.get(syarat[0]) in syarat[1]


def ada_lampiran(doctype: str, nama: str) -> bool:
	return bool(frappe.db.exists("File", {"attached_to_doctype": doctype, "attached_to_name": nama}))


def cek_lampiran(doc, method=None) -> None:
	"""`before_submit`: refuse a document of the table with nothing attached."""
	if wajib(doc) and not ada_lampiran(doc.doctype, doc.name):
		frappe.throw(_("Attach a photo or scan of the real document before you submit."))


def boot(bootinfo) -> None:
	"""The table for the forms' orange note (`public/js/lampiran.js`)."""
	bootinfo.erp_lampiran = {
		"wajib": {dt: syarat and [syarat[0], list(syarat[1])] for dt, syarat in WAJIB_LAMPIRAN.items()},
		"nanti": list(LAMPIRAN_NANTI),
	}
