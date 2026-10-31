"""Server side of the Production Floor page: the machines (Workstations numbered 1-14) with their status and
running Work Order, a status change from the page, and a realtime nudge when either changes.

The nudge carries nothing (an empty payload) and only for a numbered machine. The page then asks `get_data()`
again, so what it shows is always what that user may read.
"""

import frappe
from frappe import _

EVENT = "production_floor"
SIARAN_RUANG = frappe.realtime.get_doctype_room("Workstation")  # "doctype:Workstation"
FIELD_MESIN = (
	"name",
	"erp_nomor",
	"erp_merek",
	"erp_model",
	"erp_tonase",
	"erp_tahun",
	"erp_negara",
	"status",
)
# A Work Order shows on its machine while it runs; a not-started one shows when none runs (In Process first).
STATUS_WO = ("In Process", "Not Started")


def boleh_buka() -> bool:
	"""The Apps screen tile's check (hooks `add_to_apps_screen`): only who may open the page sees it. Boot calls
	it, so it never raises."""
	try:
		return frappe.get_doc("Page", "production-floor").is_permitted()
	except Exception:
		return False


@frappe.whitelist()
def get_data() -> dict:
	"""Every numbered machine in floor order, each with its newest running Work Order (or None), and the company
	shown in the page's info bar."""
	frappe.has_permission("Workstation", "read", throw=True)
	return {"mesin": _daftar(), "perusahaan": _perusahaan(), "waktu": frappe.utils.now()}


@frappe.whitelist(methods=["POST"])
def set_status(machine: str, status: str) -> dict:
	"""Set a machine's status (one of the Workstation's own options) and return its row as `get_data()` does."""
	# A missing name and a forbidden one answer the same: no way to probe which Workstations exist.
	if not frappe.db.exists("Workstation", machine) or not frappe.has_permission(
		"Workstation", "write", doc=machine
	):
		frappe.throw(_("Not permitted"), frappe.PermissionError)
	doc = frappe.get_doc("Workstation", machine)
	if not (doc.get("erp_nomor") or 0) > 0:
		frappe.throw(_("{0} is not a numbered machine.").format(machine), frappe.ValidationError)
	if status not in _pilihan_status():
		frappe.throw(_("Unknown machine status: {0}").format(status), frappe.ValidationError)
	doc.status = status
	# Tests skip the Version log by default; the status change should always leave a row in it.
	doc.save(ignore_version=False)
	return _baris(doc, _pekerjaan([doc.name]))


def siarkan(doc, method=None) -> None:
	"""Workstation on_update and Work Order on_change doc event: nudge open Production Floor pages (empty payload; they refetch).
	A Workstation that is not a numbered machine is not on the floor, so it sends nothing."""
	if doc.doctype == "Workstation" and not (doc.get("erp_nomor") or 0) > 0:
		return
	# To the Workstation room, not the site: `publish_realtime(doctype=...)` without a docname broadcasts to every
	# System User. Only a socket that joined the room (and may read Workstation) is nudged, so the page must
	# subscribe again after each reconnect.
	frappe.publish_realtime(EVENT, {}, room=SIARAN_RUANG, after_commit=True)


def _perusahaan_default() -> str | None:
	"""The user's default company, else the site's."""
	return frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
		"Global Defaults", "default_company"
	)


def _perusahaan() -> dict:
	"""`{"nama", "logo"}` of the default company, both only for a user who may read that very Company; anyone else
	(and a site with no default company) gets the site's app name and no logo."""
	nama = _perusahaan_default()
	if (
		not nama
		or not frappe.db.exists("Company", nama)
		or not frappe.has_permission("Company", "read", doc=nama)
	):
		return {"nama": frappe.get_system_settings("app_name") or "ERP Internal", "logo": None}
	return {"nama": nama, "logo": frappe.db.get_value("Company", nama, "company_logo") or None}


def _pilihan_status() -> list[str]:
	return [s for s in (frappe.get_meta("Workstation").get_field("status").options or "").split("\n") if s]


def _daftar() -> list[dict]:
	"""The numbered machines the user may read, sorted by number, then name."""
	baris = frappe.get_list(
		"Workstation", filters={"erp_nomor": (">", 0)}, fields=list(FIELD_MESIN), order_by="erp_nomor, name"
	)
	wo = _pekerjaan([b.name for b in baris])
	return [_baris(b, wo) for b in baris]


def _baris(b, wo: dict[str, dict]) -> dict:
	"""One machine row of `get_data()`: `b` is a Workstation (doc or row), `wo` maps machine → Work Order."""
	return {
		"name": b.name,
		"nomor": b.erp_nomor,
		"merek": b.erp_merek,
		"model": b.erp_model,
		"tonase": b.erp_tonase,
		"tahun": b.erp_tahun,
		"negara": b.erp_negara,
		"status": b.status,
		"wo": wo.get(b.name),
	}


def _pekerjaan(mesin: list[str]) -> dict[str, dict]:
	"""Machine → its Work Order to show, for the user who may read Work Orders; {} for anyone else."""
	if not mesin or not frappe.has_permission("Work Order", "read"):
		return {}
	hasil: dict[str, dict] = {}
	for wo in frappe.get_list(
		"Work Order",
		filters={"docstatus": 1, "erp_mesin": ("in", mesin), "status": ("in", STATUS_WO)},
		fields=["name", "erp_mesin", "production_item", "item_name", "qty", "produced_qty", "status"],
		order_by="creation desc",
	):
		lama = hasil.get(wo.erp_mesin)
		# Newest first, so keep the first row seen unless a running one turns up behind a not-started one.
		if lama and (lama["status"] == "In Process" or wo.status != "In Process"):
			continue
		hasil[wo.erp_mesin] = {
			"name": wo.name,
			"item_code": wo.production_item,
			"item_name": wo.item_name,
			"qty": wo.qty,
			"produced_qty": wo.produced_qty,
			"status": wo.status,
		}
	return hasil
