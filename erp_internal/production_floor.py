"""Server side of the Production Floor page: the machines (Workstations numbered 1-14) with their status and
running Work Order, a status change from the page, and a realtime nudge when either changes.

The nudge carries the machine's name only. The page then asks `get_data()` again, so what it shows is always what
that user may read.
"""

import frappe
from frappe import _

EVENT = "production_floor"
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


@frappe.whitelist()
def get_data() -> dict:
	"""Every numbered machine in floor order, each with its newest running Work Order (or None)."""
	frappe.has_permission("Workstation", "read", throw=True)
	return {"mesin": _daftar(), "waktu": frappe.utils.now()}


@frappe.whitelist(methods=["POST"])
def set_status(machine: str, status: str) -> dict:
	"""Set a machine's status (one of the Workstation's own options) and return its row as `get_data()` does."""
	doc = frappe.get_doc("Workstation", machine)
	doc.check_permission("write")
	if not (doc.get("erp_nomor") or 0) > 0:
		frappe.throw(_("{0} is not a numbered machine.").format(machine), frappe.ValidationError)
	if status not in _pilihan_status():
		frappe.throw(_("Unknown machine status: {0}").format(status), frappe.ValidationError)
	doc.status = status
	# Tests skip the Version log by default; the status change should always leave a row in it.
	doc.save(ignore_version=False)
	return _baris(doc, _pekerjaan([doc.name]))


def siarkan(doc, method=None) -> None:
	"""Workstation and Work Order doc event: tell open Production Floor pages which machine changed."""
	mesin = doc.name if doc.doctype == "Workstation" else doc.get("erp_mesin")
	frappe.publish_realtime(EVENT, {"mesin": mesin or None}, doctype="Workstation", after_commit=True)


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
