"""Site setup, re-applied on every install and migrate (`after_install`, `after_migrate`).

Each helper writes only what differs, so running it twice changes nothing. Company steps wait for the
setup wizard: before it is complete there is no company, root item group or root warehouse to build on.
"""

import json
from datetime import date

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.utils import cint, get_time, getdate, today

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
	"app_name": "Delta Anugrah",
}
GLOBAL_DEFAULTS = {"default_currency": "IDR", "country": "Indonesia"}

# The brand: PT Delta Anugrah's mark on the login page, the Apps screen, the loading splash and the browser
# tab. The files sit in `public/images/` (served as-is, no build): `delta-anugrah.svg` is the vector, redrawn
# from the original JPEG kept beside it; the PNGs are rendered from the SVG (the favicon stays PNG). The Apps
# screen tiles and the rail's top slot have their own icons (`tampilan.IKON_APLIKASI`).
LOGO = "/assets/erp_internal/images/delta-anugrah.svg"
MEREK = {
	"Website Settings": {
		"app_name": "Delta Anugrah",
		"app_logo": LOGO,
		"splash_image": LOGO,
		"favicon": "/assets/erp_internal/images/favicon-32.png",
	},
	"Navbar Settings": {"app_logo": LOGO},
}

# One company runs everything: the factory (stock, sales, purchasing, production) and the office (attendance,
# projects). Setup builds both for each company with this box ticked; ERPNext's own test companies have it off.
FIELD_AKTIF = {
	"fieldname": "erp_aktif",
	"label": "Run by ERP Internal",
	"fieldtype": "Check",
	"default": "0",
	"insert_after": "abbr",
	"description": "Setup builds this company's warehouses, production defaults, holiday lists and PPN templates.",
}

# The injection moulding machines (`master.py` loads them from `data/mesin.json`): one Workstation each, with
# the machine's plate and its place in the floor order (the 3D view's layout).
FIELD_MESIN = [
	{
		"fieldname": "erp_nomor",
		"label": "Machine No.",
		"fieldtype": "Int",
		"insert_after": "workstation_type",
		"description": "Order on the factory floor, 1 is the first machine.",
	},
	{"fieldname": "erp_merek", "label": "Machine Brand", "fieldtype": "Data", "insert_after": "erp_nomor"},
	{"fieldname": "erp_model", "label": "Machine Model", "fieldtype": "Data", "insert_after": "erp_merek"},
	{
		"fieldname": "erp_tonase",
		"label": "Clamping Force (Ton)",
		"fieldtype": "Int",
		"insert_after": "erp_model",
	},
	{"fieldname": "erp_tahun", "label": "Year Made", "fieldtype": "Int", "insert_after": "erp_tonase"},
	{"fieldname": "erp_negara", "label": "Made In", "fieldtype": "Data", "insert_after": "erp_tahun"},
]

# The machine a Work Order runs on (the Production Floor page shows the order on that machine). Only the
# numbered machines are offered; Workstations made for other uses are not.
FIELD_WO_MESIN = {
	"fieldname": "erp_mesin",
	"label": "Machine",
	"fieldtype": "Link",
	"options": "Workstation",
	"insert_after": "production_item",
	"link_filters": json.dumps([["Workstation", "erp_nomor", ">", 0]]),
	# A submitted order's machine can change while it runs (a machine breaks down; `kapasitas.kunci_mesin`); Plan vs
	# Actual then moves its whole target.
	"allow_on_submit": 1,
}

# The machine and the capacity row a BOM was made from (`kapasitas.buat_bom_kapasitas`). A BOM without them was
# made by hand and is never touched.
FIELD_BOM = [
	{
		"fieldname": "erp_mesin",
		"label": "Machine",
		"fieldtype": "Link",
		"options": "Workstation",
		"insert_after": "item",
		"read_only": 1,
	},
	{
		"fieldname": "erp_kapasitas",
		"label": "Machine Capacity",
		"fieldtype": "Link",
		"options": "Machine Capacity",
		"insert_after": "erp_mesin",
		"read_only": 1,
	},
]

GRUP_BARANG = ("Barang Jadi", "Bahan Baku", "Bahan Penolong", "Kemasan", "Sparepart")
# Gross, Ball, Dus, Ikat and Pack are the price list's packings (`master.py`); Ball Kecil the sales Excel's (`penjualan.py`).
SATUAN = ("Pcs", "Lusin", "Gross", "Karton", "Ball", "Ball Kecil", "Dus", "Ikat", "Pack", "Sak", "Roll", "Kg")
SATUAN_PECAHAN = ("Kg",)  # every other UOM takes whole numbers only
# A variant keeps its own packings (one colour's Dus holds 3 Gross, another's 5): a template's save then no
# longer copies its UOM table over its variants'.
PENGATURAN_VARIAN = {"allow_different_uom": 1}  # Item Variant Settings
GUDANG_PABRIK = ("Gudang Bahan Baku", "Gudang Produksi", "Gudang Barang Jadi", "Gudang Reject")

# The sales and purchasing flow: a Delivery Note is made directly (Samuel 2026-11-02: no Sales Orders for now),
# every purchase receipt starts from an order; stock never goes negative and is valued FIFO.
PENGATURAN_ALUR = {
	"Selling Settings": {"so_required": "No", "dn_required": "No"},
	"Buying Settings": {"po_required": "Yes", "pr_required": "No"},
	"Stock Settings": {"allow_negative_stock": 0, "valuation_method": "FIFO"},
}
# DocTypes the Data Import tool may take although v16 ships them with `allow_import` off: the opening stock
# is imported as a Stock Reconciliation (docs/impor.md, `test_impor_stok_awal`).
IMPOR_BOLEH = ("Stock Reconciliation",)
# Per company: stock moves post no journal entries (perpetual inventory off).
PENGATURAN_PERUSAHAAN = {"enable_perpetual_inventory": 0}

# PPN: one sales and one purchase template per company, never the default: the company is not PKP (Samuel,
# 2026-10-28), so invoices only record sales and purchases.
TARIF_PPN = 11
PAJAK = {
	"jual": ("PPN 11%", "PPN Keluaran"),
	"beli": ("PPN Masukan 11%", "PPN Masukan"),
}  # (template, account)
TEMPLATE_PAJAK = {"jual": "Sales Taxes and Charges Template", "beli": "Purchase Taxes and Charges Template"}
INDUK_PAJAK = "Duties and Taxes"  # the chart's group for tax accounts

# Production. v16 keeps the Work Order's default warehouses on the Company.
GUDANG_PRODUKSI = {
	"default_wip_warehouse": "Gudang Produksi",
	"default_fg_warehouse": "Gudang Barang Jadi",
	"default_scrap_warehouse": "Gudang Reject",
}
PENGATURAN_PRODUKSI = {"backflush_raw_materials_based_on": "BOM"}  # Manufacturing Settings
# The factory's shifts (name, hours) for Production Entry: its Shift choices and the default run hours (Samuel
# 2026-11-02: two shifts of 12 h). Written as a Property Setter on Production Entry.shift.
SHIFT_PABRIK = (("Shift 1", 12), ("Shift 2", 12))
# The Reject Reasons setup makes when missing (until Samuel lists his). Admin may add more; none is deleted.
ALASAN_REJECT = (
	"Short Shot",
	"Flashing",
	"Belang / Warna",
	"Pecah / Retak",
	"Bubble",
	"Sink Mark",
	"Lainnya",
)
# Item Group → the warehouse its items default to, per company.
GUDANG_GRUP = {
	"Barang Jadi": "Gudang Barang Jadi",
	"Bahan Baku": "Gudang Bahan Baku",
	"Bahan Penolong": "Gudang Bahan Baku",
	"Kemasan": "Gudang Bahan Baku",
}

# Attendance. One shift for everyone, attendance by phone with location (Samuel's question 5; until he answers,
# 08:00-17:00). `auto_update_last_sync` lets HRMS's hourly job move the sync point, without which auto attendance
# never runs. `process_attendance_after` is site config `erp_mulai_absen`, else the day the shift is created.
SHIFT_KANTOR = {
	"name": "Kantor",
	"start_time": "08:00:00",
	"end_time": "17:00:00",
	"enable_auto_attendance": 1,
	"auto_update_last_sync": 1,
	"determine_check_in_and_check_out": "Alternating entries as IN and OUT during the same shift",
	"working_hours_calculation_based_on": "First Check-in and Last Check-out",
	"begin_check_in_before_shift_start_time": 60,
	"allow_check_out_after_shift_end_time": 120,
	"late_entry_grace_period": 10,
	"enable_late_entry_marking": 1,
	"early_exit_grace_period": 10,
	"enable_early_exit_marking": 1,
}
PENGATURAN_HR = {"allow_employee_checkin_from_mobile_app": 1, "allow_geolocation_tracking": 1}
# Per company and year, a Holiday List "Libur <abbr> <year>" with these weekly offs, assigned to the
# company (v16 HRMS resolves holidays through Holiday List Assignment). HR adds the national holidays (SKB).
LIBUR_MINGGUAN = ("Saturday", "Sunday")
TAHUN_LIBUR = (0, 1)  # this year and next
JENIS_CUTI = {
	"Cuti Tahunan": {"max_leaves_allowed": 12, "is_lwp": 0},
	"Sakit": {"is_lwp": 0},
	"Izin": {"is_lwp": 1},
}

# Projects: what a timesheet row is spent on. No billing or costing rates (internal work).
JENIS_KEGIATAN = ("Pengembangan", "Rapat", "Dukungan Klien", "Administrasi")
# (DocType, role, permlevel, rights) added to ERPNext's own (a Custom DocPerm copy):
# - Employee creates and writes timesheets in v16 but cannot submit them; `proyek.cek_pemilik_timesheet` keeps a
#   User to their own.
# - Manufacturing User does not read Company in v16, yet every production and stock form reads its company's
#   defaults ("No permission for Company" on a new Stock Entry, seen by tools/cek_layar.mjs).
# - The Admin role manages users (roles sit on permlevel 1) and reads the profiles it hands out; what it may give
#   is limited by `pengguna.cek_user`. Projects Settings is System Manager's only in v16.
# - The Produksi role (PERAN_USER, its only role) reads the machines (the Production Floor, a Production Entry's
#   machine; `production_floor.set_status` changes only the status), the Work Orders it records output for, and
#   the Company every form reads its defaults from.
IZIN_TAMBAHAN = (
	("Timesheet", "Employee", 0, ("submit",)),
	("Company", "Manufacturing User", 0, ("read",)),
	("User", tampilan.PERAN_ADMIN, 0, ("read", "write", "create")),
	("User", tampilan.PERAN_ADMIN, 1, ("read", "write")),
	("Role Profile", tampilan.PERAN_ADMIN, 0, ("read",)),
	("Module Profile", tampilan.PERAN_ADMIN, 0, ("read",)),
	("Projects Settings", "Projects Manager", 0, ("read", "write")),
	("Workstation", tampilan.PERAN_USER, 0, ("read",)),
	("Work Order", tampilan.PERAN_USER, 0, ("read",)),
	("Company", tampilan.PERAN_USER, 0, ("read",)),
)
# Grants of IZIN_TAMBAHAN taken back (same shape): `_cabut_izin` clears exactly these rights. The old User read
# these for the delivery note and Material Receipt forms, now Admin's (Samuel, 2026-11-23).
IZIN_DICABUT = (
	("Price List", tampilan.PERAN_USER, 0, ("read",)),
	("Account", tampilan.PERAN_USER, 0, ("read",)),
	("Stock Settings", tampilan.PERAN_USER, 0, ("read",)),
	("Customer Group", tampilan.PERAN_USER, 0, ("read",)),
)
# New Work Orders' defaults (a Property Setter `default` per field): no material transfer, so Produksi's entries
# never wait for Admin's Start; the material leaves Gudang Bahan Baku as output is entered. Admin may untick it.
BAWAAN_WO = {"skip_transfer": 1}


def pastikan_setup() -> None:
	"""Bring the site to the state this app expects. Idempotent; safe before the setup wizard."""
	_pengaturan()
	_field_aktif()
	_impor_boleh()
	_halaman_lama()
	tampilan.pastikan_peran()  # the Admin role, before IZIN_TAMBAHAN names it
	if not frappe.is_setup_complete():
		return
	_grup_barang()
	_satuan()
	_varian()
	for company in perusahaan():
		_gudang_pabrik(company)
	_bawaan()
	_alur_jual_beli()
	_produksi()
	_bawaan_wo()
	_shift_pabrik()
	_alasan_reject()
	_kantor()
	_proyek()
	tampilan.terapkan()


def _halaman_lama() -> None:
	"""Delete the Production Floor's old Page (`lantai-produksi`, now `production-floor`) if it still exists."""
	if frappe.db.exists("Page", "lantai-produksi"):
		frappe.delete_doc("Page", "lantai-produksi", force=True, ignore_permissions=True)


def perusahaan() -> list[str]:
	"""The companies setup builds for (`erp_aktif` ticked; one on a real site), by name."""
	return frappe.get_all("Company", {"erp_aktif": 1}, pluck="name", order_by="name asc")


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

	for doctype, nilai in MEREK.items():
		doc = frappe.get_single(doctype)
		beda = {k: v for k, v in nilai.items() if doc.get(k) != v}
		if beda:
			doc.update(beda)
			doc.flags.ignore_mandatory = True
			doc.save(ignore_permissions=True)

	defaults = frappe.get_single("Global Defaults")
	beda = {k: v for k, v in GLOBAL_DEFAULTS.items() if defaults.get(k) != v}
	if beda:
		defaults.update(beda)
		defaults.save(ignore_permissions=True)


def _impor_boleh() -> None:
	from frappe.custom.doctype.property_setter.property_setter import make_property_setter

	for dt in IMPOR_BOLEH:
		if not frappe.get_meta(dt).allow_import:
			make_property_setter(dt, None, "allow_import", 1, "Check", for_doctype=True)


def _field_aktif() -> None:
	# create_custom_fields saves only a field that is missing or differs.
	create_custom_fields(
		{
			"Company": [FIELD_AKTIF],
			"Workstation": FIELD_MESIN,
			"Work Order": [FIELD_WO_MESIN],
			"BOM": FIELD_BOM,
		},
		update=True,
	)


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


def _varian() -> None:
	for field, nilai in PENGATURAN_VARIAN.items():
		if frappe.db.get_single_value("Item Variant Settings", field) != nilai:
			frappe.db.set_single_value("Item Variant Settings", field, nilai)


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
	"""Defaults so nobody picks twice: a company's documents default to its Gudang Barang Jadi (v16 keeps the
	default warehouse on the Company, not in Stock Settings), and a user's only Company permission is their
	default."""
	for company in perusahaan():
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

	for company in perusahaan():
		for field, nilai in PENGATURAN_PERUSAHAAN.items():
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
	default; an existing one keeps its `is_default`, set by hand only if the company becomes PKP."""
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


def _produksi() -> None:
	"""Work Orders default to the company's warehouses, and items to their group's warehouse."""
	doc = frappe.get_single("Manufacturing Settings")
	beda = {k: v for k, v in PENGATURAN_PRODUKSI.items() if doc.get(k) != v}
	if beda:
		doc.update(beda)
		doc.flags.ignore_mandatory = True
		doc.save(ignore_permissions=True)

	pabrik = perusahaan()
	for company in pabrik:
		for field, nama in GUDANG_PRODUKSI.items():
			wh = gudang(company, nama)
			if frappe.db.exists("Warehouse", wh) and frappe.db.get_value("Company", company, field) != wh:
				# db.set_value: Company's own save rebuilds its default accounts.
				frappe.db.set_value("Company", company, field, wh)

	for grup, nama in GUDANG_GRUP.items():
		if not frappe.db.exists("Item Group", grup):
			continue
		doc = frappe.get_doc("Item Group", grup)
		ubah = False
		for company in pabrik:
			wh = gudang(company, nama)
			if not frappe.db.exists("Warehouse", wh):
				continue
			baris = next((d for d in doc.item_group_defaults if d.company == company), None)
			if baris is None:
				doc.append("item_group_defaults", {"company": company, "default_warehouse": wh})
				ubah = True
			elif baris.default_warehouse != wh:
				baris.default_warehouse = wh
				ubah = True
		if ubah:
			doc.save(ignore_permissions=True)


def jam_shift(nama: str) -> float:
	"""The hours of factory shift `nama` (`SHIFT_PABRIK`), 0 for an unknown shift."""
	return float(dict(SHIFT_PABRIK).get(nama, 0))


def _bawaan_wo() -> None:
	"""BAWAAN_WO as Property Setter defaults on Work Order."""
	from frappe.custom.doctype.property_setter.property_setter import make_property_setter

	meta = frappe.get_meta("Work Order")
	for field, nilai in BAWAAN_WO.items():
		if str(meta.get_field(field).default) != str(nilai):
			make_property_setter(
				"Work Order", field, "default", str(nilai), "Text", validate_fields_for_doctype=False
			)


def _shift_pabrik() -> None:
	"""Production Entry's Shift choices: a blank, then the SHIFT_PABRIK names."""
	from frappe.custom.doctype.property_setter.property_setter import make_property_setter

	pilihan = "\n".join(("", *(nama for nama, _jam in SHIFT_PABRIK)))
	if frappe.get_meta("Production Entry").get_field("shift").options != pilihan:
		make_property_setter(
			"Production Entry", "shift", "options", pilihan, "Text", validate_fields_for_doctype=False
		)


def _alasan_reject() -> None:
	for nama in ALASAN_REJECT:
		if not frappe.db.exists("Reject Reason", nama):
			frappe.get_doc({"doctype": "Reject Reason", "reason_name": nama}).insert(ignore_permissions=True)


def _kantor() -> None:
	"""Attendance and leave: HR Settings, the Kantor shift, holiday lists, leave types."""
	doc = frappe.get_single("HR Settings")
	beda = {k: v for k, v in PENGATURAN_HR.items() if doc.get(k) != v}
	if beda:
		doc.update(beda)
		doc.flags.ignore_mandatory = True
		doc.save(ignore_permissions=True)

	_shift()

	tahun = getdate(today()).year
	for company in perusahaan():
		for tambah in TAHUN_LIBUR:
			pastikan_libur(company, tahun + tambah)
		daftar = nama_libur(company, tahun)
		if frappe.db.get_value("Company", company, "default_holiday_list") != daftar:
			# db.set_value: Company's own save rebuilds its default accounts.
			frappe.db.set_value("Company", company, "default_holiday_list", daftar)

	for nama, nilai in JENIS_CUTI.items():
		if not frappe.db.exists("Leave Type", nama):
			frappe.get_doc({"doctype": "Leave Type", "leave_type_name": nama, **nilai}).insert(
				ignore_permissions=True
			)
			continue
		doc = frappe.get_doc("Leave Type", nama)
		beda = {k: v for k, v in nilai.items() if doc.get(k) != v}
		if beda:
			doc.update(beda)
			doc.save(ignore_permissions=True)


def _shift() -> None:
	nama = SHIFT_KANTOR["name"]
	nilai = {k: v for k, v in SHIFT_KANTOR.items() if k != "name"}
	mulai = frappe.conf.get("erp_mulai_absen")
	if not frappe.db.exists("Shift Type", nama):
		frappe.get_doc(
			{"doctype": "Shift Type", "name": nama, **nilai, "process_attendance_after": mulai or today()}
		).insert(ignore_permissions=True)
		return

	doc = frappe.get_doc("Shift Type", nama)
	beda = {k: v for k, v in nilai.items() if not _sama(doc.get(k), v)}
	if mulai and getdate(doc.process_attendance_after) != getdate(mulai):
		beda["process_attendance_after"] = mulai
	if not beda:
		return
	doc.update(beda)
	try:
		doc.save(ignore_permissions=True)
	except frappe.ValidationError:
		# HRMS refuses a new start time while check-ins wait for attendance; the next migrate retries.
		frappe.log_error(f"Shift {nama} not updated: {sorted(beda)}", "erp_internal setup")


def _sama(kini, nilai) -> bool:
	"""Whether a stored value equals a SHIFT_KANTOR value (times are stored as timedeltas)."""
	if isinstance(nilai, str) and nilai.count(":") == 2:
		return kini is not None and get_time(kini) == get_time(nilai)
	if isinstance(nilai, int):
		return cint(kini) == nilai
	return kini == nilai


def nama_libur(company: str, tahun: int) -> str:
	"""The company's Holiday List for `tahun`: `"Libur <abbr> <tahun>"`."""
	return f"Libur {frappe.get_cached_value('Company', company, 'abbr')} {tahun}"


def pastikan_libur(company: str, tahun: int) -> str:
	"""Get or create the company's Holiday List for `tahun`, with the LIBUR_MINGGUAN weekly offs, and its
	submitted Holiday List Assignment from 1 January. An existing list is left as HR keeps it."""
	nama = nama_libur(company, tahun)
	awal = date(tahun, 1, 1)
	if not frappe.db.exists("Holiday List", nama):
		doc = frappe.get_doc(
			{
				"doctype": "Holiday List",
				"holiday_list_name": nama,
				"from_date": awal,
				"to_date": date(tahun, 12, 31),
			}
		)
		for hari in LIBUR_MINGGUAN:
			doc.weekly_off = hari
			doc.get_weekly_off_dates()
		doc.insert(ignore_permissions=True)

	# One submitted assignment per company and start date (HRMS refuses a second one); HR's own stays.
	if not frappe.db.exists(
		"Holiday List Assignment", {"assigned_to": company, "from_date": awal, "docstatus": 1}
	):
		hla = frappe.get_doc(
			{
				"doctype": "Holiday List Assignment",
				"applicable_for": "Company",
				"assigned_to": company,
				"holiday_list": nama,
				"from_date": awal,
			}
		)
		hla.flags.ignore_permissions = True
		hla.insert()
		hla.submit()
	return nama


def _proyek() -> None:
	"""The Activity Types of a timesheet, without rates, the extra rights of IZIN_TAMBAHAN, and IZIN_DICABUT's
	rows gone."""
	for nama in JENIS_KEGIATAN:
		if not frappe.db.exists("Activity Type", nama):
			frappe.get_doc(
				{"doctype": "Activity Type", "activity_type": nama, "costing_rate": 0, "billing_rate": 0}
			).insert(ignore_permissions=True)
			continue
		tarif = frappe.db.get_value("Activity Type", nama, ["costing_rate", "billing_rate", "disabled"])
		if any(tarif):
			frappe.db.set_value("Activity Type", nama, {"costing_rate": 0, "billing_rate": 0, "disabled": 0})

	from frappe.permissions import add_permission, setup_custom_perms, update_permission_property

	for doctype, peran, level, hak in IZIN_TAMBAHAN:
		syarat = {"parent": doctype, "role": peran, "permlevel": level, "if_owner": 0}
		for h in hak:
			if frappe.db.get_value("Custom DocPerm", syarat, h):
				continue
			setup_custom_perms(doctype)  # first time: copies ERPNext's rules, then ours are added
			if not frappe.db.exists("Custom DocPerm", syarat):
				add_permission(doctype, peran, level)
			update_permission_property(doctype, peran, level, h, 1)

	_cabut_izin()


def _cabut_izin() -> None:
	"""IZIN_DICABUT: clear exactly the listed rights on those Custom DocPerm rows, and delete a row only when no
	right is left on it (a right set by someone else stays). Frappe has no remove_permission helper."""
	from frappe.permissions import rights

	for doctype, peran, level, hak in IZIN_DICABUT:
		for baris in frappe.get_all(
			"Custom DocPerm", {"parent": doctype, "role": peran, "permlevel": level}, ["name", *rights]
		):
			if not any(baris[h] for h in hak):
				continue
			if any(baris[r] for r in rights if r not in hak):
				frappe.db.set_value("Custom DocPerm", baris.name, dict.fromkeys(hak, 0))
			else:
				frappe.db.delete("Custom DocPerm", baris.name)
			frappe.clear_cache(doctype=doctype)
