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

# The sales and purchasing flow: every delivery and every receipt starts from an order; stock never goes
# negative and is valued FIFO.
PENGATURAN_ALUR = {
	"Selling Settings": {"so_required": "Yes", "dn_required": "No"},
	"Buying Settings": {"po_required": "Yes", "pr_required": "No"},
	"Stock Settings": {"allow_negative_stock": 0, "valuation_method": "FIFO"},
}
# Per factory company: stock moves post no journal entries (perpetual inventory off).
PERUSAHAAN_PABRIK = {"enable_perpetual_inventory": 0}

# PPN: one sales and one purchase template per factory, never the default (Samuel decides PKP, Task 8).
TARIF_PPN = 11
PAJAK = {
	"jual": ("PPN 11%", "PPN Keluaran"),
	"beli": ("PPN Masukan 11%", "PPN Masukan"),
}  # (template, account)
TEMPLATE_PAJAK = {"jual": "Sales Taxes and Charges Template", "beli": "Purchase Taxes and Charges Template"}
INDUK_PAJAK = "Duties and Taxes"  # the chart's group for tax accounts


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
	_bawaan()
	_alur_jual_beli()
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


def _bawaan() -> None:
	"""Defaults so nobody picks twice: a factory's documents default to its Gudang Barang Jadi (v16 keeps the
	default warehouse on the Company, not in Stock Settings), and a user's only Company permission is their
	default."""
	for company in perusahaan("Pabrik"):
		wh = gudang(company, "Gudang Barang Jadi")
		if (
			frappe.db.exists("Warehouse", wh)
			and frappe.db.get_value("Company", company, "default_warehouse") != wh
		):
			frappe.db.set_value("Company", company, "default_warehouse", wh)

	izin = {}
	for row in frappe.get_all("User Permission", {"allow": "Company"}, ["name", "user", "is_default"]):
		izin.setdefault(row.user, []).append(row)
	for rows in izin.values():
		if len(rows) == 1 and not rows[0].is_default:
			doc = frappe.get_doc("User Permission", rows[0].name)
			doc.is_default = 1
			doc.save(ignore_permissions=True)


def _alur_jual_beli() -> None:
	"""Order-first selling and buying, no negative stock, no stock journal entries, PPN templates."""
	for doctype, nilai in PENGATURAN_ALUR.items():
		doc = frappe.get_single(doctype)
		beda = {k: v for k, v in nilai.items() if doc.get(k) != v}
		if beda:
			doc.update(beda)
			doc.flags.ignore_mandatory = True
			doc.save(ignore_permissions=True)

	for company in perusahaan("Pabrik"):
		for field, nilai in PERUSAHAAN_PABRIK.items():
			if frappe.db.get_value("Company", company, field) != nilai:
				frappe.db.set_value("Company", company, field, nilai)
		# ERPNext caches the perpetual flag per request (erpnext.is_perpetual_inventory_enabled).
		getattr(frappe.local, "enable_perpetual_inventory", {}).pop(company, None)

		for jenis, (judul, nama_akun) in PAJAK.items():
			akun = _akun_pajak(company, nama_akun)
			if akun:
				_template_pajak(company, TEMPLATE_PAJAK[jenis], judul, akun)


def _akun_pajak(company: str, nama: str) -> str | None:
	"""Get or create the tax account `"<nama> - <abbr>"` under the company's Duties and Taxes group."""
	akun = f"{nama} - {frappe.get_cached_value('Company', company, 'abbr')}"
	if frappe.db.exists("Account", akun):
		if frappe.db.get_value("Account", akun, "account_type") != "Tax":
			frappe.db.set_value("Account", akun, "account_type", "Tax")
		return akun

	induk = frappe.db.get_value(
		"Account", {"company": company, "account_name": INDUK_PAJAK, "is_group": 1}, "name"
	) or frappe.db.get_value(
		"Account", {"company": company, "account_type": "Tax", "is_group": 1}, "name", order_by="lft asc"
	)
	if not induk:
		# A chart without a tax group: leave the templates out rather than fail the migrate.
		frappe.log_error(
			f"No {INDUK_PAJAK} group in {company}; PPN accounts not created", "erp_internal setup"
		)
		return None
	frappe.get_doc(
		{
			"doctype": "Account",
			"account_name": nama,
			"parent_account": induk,
			"company": company,
			"account_type": "Tax",
			"tax_rate": TARIF_PPN,
			"is_group": 0,
		}
	).insert(ignore_permissions=True)
	return akun


def _template_pajak(company: str, doctype: str, judul: str, akun: str) -> None:
	"""Get or create a tax template with one On Net Total row at `TARIF_PPN`. A new template is not the
	default; an existing one keeps its `is_default`, which the go-live sets by hand for a PKP factory."""
	baris = {"charge_type": "On Net Total", "account_head": akun, "description": judul, "rate": TARIF_PPN}
	if doctype == TEMPLATE_PAJAK["beli"]:
		baris.update({"category": "Total", "add_deduct_tax": "Add"})

	nama = f"{judul} - {frappe.get_cached_value('Company', company, 'abbr')}"
	if not frappe.db.exists(doctype, nama):
		frappe.get_doc(
			{"doctype": doctype, "title": judul, "company": company, "is_default": 0, "taxes": [baris]}
		).insert(ignore_permissions=True)
		return

	doc = frappe.get_doc(doctype, nama)
	kini = [(t.charge_type, t.account_head, t.rate) for t in doc.taxes]
	if kini != [(baris["charge_type"], akun, TARIF_PPN)]:
		doc.set("taxes", [baris])
		doc.save(ignore_permissions=True)
