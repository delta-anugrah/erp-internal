"""Sites made before 2026-11-23: the profiles Developer and User become Super Admin and Produksi, users included
(a rename updates every link). Runs before `after_migrate`, which would otherwise make the new names empty."""

import frappe

from erp_internal.tampilan import NAMA_LAMA


def ganti_nama(lama: str, baru: str) -> bool:
	"""Rename the Role Profile and the Module Profile `lama` to `baru`; True if either was renamed."""
	ganti = False
	for doctype in ("Role Profile", "Module Profile"):
		if frappe.db.exists(doctype, lama) and not frappe.db.exists(doctype, baru):
			frappe.rename_doc(doctype, lama, baru, force=True)
			ganti = True
	return ganti


def execute():
	for lama, baru in NAMA_LAMA.items():
		ganti_nama(lama, baru)
