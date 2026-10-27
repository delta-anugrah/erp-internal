"""Site setup, re-applied on every install and migrate (`after_install`, `after_migrate`).

Each helper writes only what differs, so running it twice changes nothing. Company steps wait for the
setup wizard: before it is complete there is no company, root item group or root warehouse to build on.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from erp_internal import tampilan

# System Settings. The UI is English by default (each user may switch to Indonesian); dates, numbers,
# time zone and currency stay Indonesian.
PENGATURAN_SISTEM = {
	"language": "en",
	"time_zone": "Asia/Jakarta",
	"country": "Indonesia",
	"date_format": "dd-mm-yyyy",
	"number_format": "#.###,##",
	"first_day_of_the_week": "Monday",
	"allow_error_traceback": 0,
	"enable_password_policy": 1,
	"minimum_password_score": "2",
}
GLOBAL_DEFAULTS = {"default_currency": "IDR", "country": "Indonesia"}

# The company kind decides what setup builds for it: a Pabrik gets the factory warehouses, a Kantor none.
JENIS = ("Pabrik", "Kantor")
FIELD_JENIS = {
	"fieldname": "erp_jenis",
	"label": "Kind",
	"fieldtype": "Select",
	"options": "\n" + "\n".join(JENIS),
	"insert_after": "abbr",
	"description": "Pabrik: the factory (stock, sales, purchasing, production). Kantor: the office (attendance, projects).",
}

GRUP_BARANG = ("Barang Jadi", "Bahan Baku", "Bahan Penolong", "Kemasan", "Sparepart")
SATUAN = ("Pcs", "Lusin", "Karton", "Sak", "Roll", "Kg")
SATUAN_PECAHAN = ("Kg",)  # every other UOM takes whole numbers only
GUDANG_PABRIK = ("Gudang Bahan Baku", "Gudang Produksi", "Gudang Barang Jadi", "Gudang Reject")


def pastikan_setup() -> None:
	"""Bring the site to the state this app expects. Idempotent; safe before the setup wizard."""
	_pengaturan()
	_field_jenis()
	if not frappe.is_setup_complete():
		return
	_grup_barang()
	_satuan()
	for company in perusahaan("Pabrik"):
		_gudang_pabrik(company)
	tampilan.terapkan()


def perusahaan(jenis: str) -> list[str]:
	"""The companies of one kind (`Pabrik` or `Kantor`), by name."""
	return frappe.get_all("Company", {"erp_jenis": jenis}, pluck="name", order_by="name asc")


def gudang(company: str, nama: str) -> str:
	"""The name of warehouse `nama` of `company`: `"<nama> - <abbr>"`."""
	return f"{nama} - {frappe.get_cached_value('Company', company, 'abbr')}"


def _pengaturan() -> None:
	system = frappe.get_single("System Settings")
	beda = {k: v for k, v in PENGATURAN_SISTEM.items() if system.get(k) != v}
	if beda:
		system.update(beda)
		system.flags.ignore_mandatory = True
		system.save(ignore_permissions=True)

	if not frappe.db.get_single_value("Website Settings", "disable_signup"):
		frappe.db.set_single_value("Website Settings", "disable_signup", 1)

	# Frappe ships dynamic client registration on, with guest endpoints; this site is no OAuth provider.
	# A separate doctype, saved on its own.
	oauth = frappe.get_single("OAuth Settings")
	if oauth.get("enable_dynamic_client_registration"):
		oauth.enable_dynamic_client_registration = 0
		oauth.save(ignore_permissions=True)

	defaults = frappe.get_single("Global Defaults")
	beda = {k: v for k, v in GLOBAL_DEFAULTS.items() if defaults.get(k) != v}
	if beda:
		defaults.update(beda)
		defaults.save(ignore_permissions=True)


def _field_jenis() -> None:
	# create_custom_fields saves only a field that is missing or differs.
	create_custom_fields({"Company": [FIELD_JENIS]}, update=True)


def _grup_barang() -> None:
	# The root is the group without a parent: the wizard may have translated its name.
	akar = frappe.db.get_value("Item Group", {"is_group": 1, "parent_item_group": ("is", "not set")}, "name")
	for nama in GRUP_BARANG:
		if not frappe.db.exists("Item Group", nama):
			frappe.get_doc(
				{"doctype": "Item Group", "item_group_name": nama, "parent_item_group": akar, "is_group": 0}
			).insert(ignore_permissions=True)


def _satuan() -> None:
	for nama in SATUAN:
		bulat = int(nama not in SATUAN_PECAHAN)
		if not frappe.db.exists("UOM", nama):
			frappe.get_doc({"doctype": "UOM", "uom_name": nama, "must_be_whole_number": bulat}).insert(
				ignore_permissions=True
			)
		elif frappe.db.get_value("UOM", nama, "must_be_whole_number") != bulat:
			frappe.db.set_value("UOM", nama, "must_be_whole_number", bulat)


def _gudang_pabrik(company: str) -> None:
	"""The four factory warehouses under the company's root; every other unused one is disabled."""
	akar = frappe.db.get_value(
		"Warehouse", {"company": company, "is_group": 1, "parent_warehouse": ("is", "not set")}, "name"
	)
	milik = set()
	for nama in GUDANG_PABRIK:
		wh = gudang(company, nama)
		milik.add(wh)
		if not frappe.db.exists("Warehouse", wh):
			frappe.get_doc(
				{
					"doctype": "Warehouse",
					"warehouse_name": nama,
					"company": company,
					"parent_warehouse": akar,
					"is_group": 0,
				}
			).insert(ignore_permissions=True)
		elif frappe.db.get_value("Warehouse", wh, "disabled"):
			frappe.db.set_value("Warehouse", wh, "disabled", 0)

	for wh in frappe.get_all("Warehouse", {"company": company, "is_group": 0, "disabled": 0}, pluck="name"):
		# A warehouse with stock history stays; disabling it would hide stock that exists.
		if wh not in milik and not frappe.db.exists("Stock Ledger Entry", {"warehouse": wh}):
			frappe.db.set_value("Warehouse", wh, "disabled", 1)
