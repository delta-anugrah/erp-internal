"""Print helpers: Samuel's PO layout for Sales Order and Purchase Order (templates/po_samuel.html)."""

from datetime import date

from frappe.utils import getdate

# Default print format of each DocType (setup `_format_cetak` writes the Property Setter).
FORMAT_CETAK = {"Sales Order": "PO Samuel", "Purchase Order": "PO Samuel Beli"}

BULAN = (
	"Januari",
	"Februari",
	"Maret",
	"April",
	"Mei",
	"Juni",
	"Juli",
	"Agustus",
	"September",
	"Oktober",
	"November",
	"Desember",
)


def tanggal_panjang(tanggal: date | str | None) -> str:
	"""`27 November 2026` with Indonesian month names; "" for no date."""
	if not tanggal:
		return ""
	d = getdate(tanggal)
	return f"{d.day} {BULAN[d.month - 1]} {d.year}"
