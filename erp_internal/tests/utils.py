"""Get-or-create fixtures shared by the tests. Every helper is safe to call twice."""

from datetime import date

import frappe


def sebelum_tes() -> None:
	"""before_tests: complete the wizard on a fresh test site the way HRMS's tests do, then run our setup
	(the wizard alone does not run after_migrate)."""
	from hrms.tests.test_utils import before_tests

	from erp_internal.setup import pastikan_setup

	before_tests()
	pastikan_setup()
	frappe.db.commit()  # nosemgrep


def buat_perusahaan(nama: str, abbr: str, jenis: str) -> str:
	"""Get or create a company (Indonesia, IDR, chart "Standard") of kind `jenis`, then run the setup."""
	from erp_internal.setup import pastikan_setup

	if not frappe.db.exists("Company", nama):
		frappe.get_doc(
			{
				"doctype": "Company",
				"company_name": nama,
				"abbr": abbr,
				"country": "Indonesia",
				"default_currency": "IDR",
				"create_chart_of_accounts_based_on": "Standard Template",
				"chart_of_accounts": "Standard",
			}
		).insert(ignore_permissions=True)
	if frappe.db.get_value("Company", nama, "erp_jenis") != jenis:
		frappe.db.set_value("Company", nama, "erp_jenis", jenis)
	pastikan_setup()
	return nama


def tahun_fiskal(tanggal: date) -> str:
	"""Get or create the fiscal year (January to December) that holds `tanggal`."""
	ada = frappe.db.get_value(
		"Fiscal Year",
		{"year_start_date": ("<=", tanggal), "year_end_date": (">=", tanggal), "disabled": 0},
		"name",
	)
	if ada:
		return ada
	return (
		frappe.get_doc(
			{
				"doctype": "Fiscal Year",
				"year": str(tanggal.year),
				"year_start_date": date(tanggal.year, 1, 1),
				"year_end_date": date(tanggal.year, 12, 31),
			}
		)
		.insert(ignore_permissions=True)
		.name
	)


def buat_pengguna(email: str, profil_peran: str | None, profil_modul: str | None, company: str | None) -> str:
	"""Get or create a System User with that Role Profile and Module Profile, plus a default User
	Permission on `company`."""
	if frappe.db.exists("User", email):
		user = frappe.get_doc("User", email)
	else:
		user = frappe.new_doc("User")
		user.update({"email": email, "first_name": email.split("@")[0], "send_welcome_email": 0})
	user.user_type = "System User"
	user.set("role_profiles", [{"role_profile": profil_peran}] if profil_peran else [])
	user.module_profile = profil_modul
	user.save(ignore_permissions=True)

	if company and not frappe.db.exists(
		"User Permission", {"user": email, "allow": "Company", "for_value": company}
	):
		frappe.get_doc(
			{
				"doctype": "User Permission",
				"user": email,
				"allow": "Company",
				"for_value": company,
				"is_default": 1,
			}
		).insert(ignore_permissions=True)
	return email


def buat_barang(
	kode: str, grup: str, satuan: str = "Pcs", konversi: dict[str, float] | None = None, **field
) -> str:
	"""Get or create a stock item. `konversi` maps extra UOMs to their factor, e.g. `{"Karton": 24}`."""
	if not frappe.db.exists("Item", kode):
		frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": kode,
				"item_name": kode,
				"item_group": grup,
				"stock_uom": satuan,
				"is_stock_item": 1,
				"uoms": [{"uom": satuan, "conversion_factor": 1}]
				+ [{"uom": u, "conversion_factor": f} for u, f in (konversi or {}).items()],
				**field,
			}
		).insert(ignore_permissions=True)
	return kode


def buat_pelanggan(nama: str) -> str:
	"""Get or create a company customer in the first leaf customer group and territory."""
	if not frappe.db.exists("Customer", nama):
		frappe.get_doc(
			{
				"doctype": "Customer",
				"customer_name": nama,
				"customer_type": "Company",
				"customer_group": _daun("Customer Group"),
				"territory": _daun("Territory"),
			}
		).insert(ignore_permissions=True)
	return nama


def _daun(doctype: str) -> str:
	"""The first leaf of a tree doctype, or its root when it has none (ERPNext refuses a group Customer Group)."""
	return frappe.db.get_value(doctype, {"is_group": 0}, "name", order_by="lft asc") or frappe.db.get_value(
		doctype, {"is_group": 1}, "name", order_by="lft asc"
	)


def buat_pemasok(nama: str) -> str:
	"""Get or create a company supplier in the first leaf supplier group."""
	if not frappe.db.exists("Supplier", nama):
		frappe.get_doc(
			{
				"doctype": "Supplier",
				"supplier_name": nama,
				"supplier_type": "Company",
				"supplier_group": _daun("Supplier Group"),
			}
		).insert(ignore_permissions=True)
	return nama


def daftar_harga(nama: str, jual: bool) -> str:
	"""Get or create an IDR price list for selling (`jual`) or buying. The test site's wizard made its
	standard price lists in INR, which would need an exchange rate."""
	if not frappe.db.exists("Price List", nama):
		frappe.get_doc(
			{
				"doctype": "Price List",
				"price_list_name": nama,
				"currency": "IDR",
				"enabled": 1,
				"selling": int(jual),
				"buying": int(not jual),
			}
		).insert(ignore_permissions=True)
	return nama


def stok_awal(company: str, kode: str, qty: float, nama_gudang: str, rate: float = 1000) -> None:
	"""Set the stock of `kode` in warehouse `nama_gudang` of `company` to `qty` with a submitted Stock
	Reconciliation: Opening Stock the first time, a plain reconciliation after (ERPNext refuses a second
	opening), nothing when the stock is already `qty`."""
	from frappe.utils import nowdate

	from erp_internal.setup import gudang

	wh = gudang(company, nama_gudang)
	if (frappe.db.get_value("Bin", {"item_code": kode, "warehouse": wh}, "actual_qty") or 0) == qty:
		return
	ada = frappe.db.exists("Stock Ledger Entry", {"item_code": kode, "warehouse": wh, "is_cancelled": 0})
	abbr = frappe.get_cached_value("Company", company, "abbr")
	frappe.get_doc(
		{
			"doctype": "Stock Reconciliation",
			"company": company,
			"purpose": "Stock Reconciliation" if ada else "Opening Stock",
			"posting_date": nowdate(),
			"expense_account": f"Temporary Opening - {abbr}",
			"items": [{"item_code": kode, "warehouse": wh, "qty": qty, "valuation_rate": rate}],
		}
	).insert(ignore_permissions=True).submit()


def impor_csv(doctype: str, path: str, jenis: str = "Insert New Records", ajukan: bool = False):
	"""Import the CSV at `path` into `doctype` through a Data Import, run synchronously, and return the
	reloaded Data Import. `ajukan` submits each imported document (Stock Reconciliation).

	The importer commits after every row (and rolls back a failed one), so this commits too: what it
	imports outlives the test's rollback, and callers clean up their own records."""
	import os

	with open(path, "rb") as f:
		isi = f.read()
	berkas = frappe.get_doc(
		{"doctype": "File", "file_name": os.path.basename(path), "content": isi, "is_private": 1}
	).insert(ignore_permissions=True)
	impor = frappe.get_doc(
		{
			"doctype": "Data Import",
			"reference_doctype": doctype,
			"import_type": jenis,
			"import_file": berkas.file_url,
			"submit_after_import": int(ajukan),
			"mute_emails": 1,
		}
	).insert(ignore_permissions=True)
	frappe.db.commit()  # nosemgrep: a failed first row must not roll back the Data Import itself
	impor.start_import()  # runs now under tests (frappe.in_test)
	return impor.reload()


def riwayat(company: str, kode: str, bulan: date, qty: float) -> str:
	"""Get or create the Sales History row of `kode` in the month of `bulan`, with `qty`."""
	from frappe.utils import get_first_day

	bulan = get_first_day(bulan)
	nama = frappe.db.get_value("Sales History", {"company": company, "item_code": kode, "bulan": bulan})
	if nama:
		if frappe.db.get_value("Sales History", nama, "qty") != qty:
			frappe.db.set_value("Sales History", nama, "qty", qty)
		return nama
	return (
		frappe.get_doc(
			{"doctype": "Sales History", "company": company, "item_code": kode, "bulan": bulan, "qty": qty}
		)
		.insert(ignore_permissions=True)
		.name
	)


def akar_gudang(company: str) -> str:
	"""The company's root warehouse (the group without a parent)."""
	return frappe.db.get_value(
		"Warehouse", {"company": company, "is_group": 1, "parent_warehouse": ("is", "not set")}, "name"
	)


def buat_order(
	company: str,
	pelanggan: str,
	kode: str,
	qty: float,
	tanggal: date,
	kirim: date,
	satuan: str | None = None,
	submit: bool = True,
):
	"""A new Sales Order of `qty` `kode` (in `satuan`, default the stock UOM) dated `tanggal`, delivered on
	`kirim` from the company's Gudang Barang Jadi; submitted unless `submit` is false."""
	from erp_internal.setup import gudang

	tahun_fiskal(tanggal)
	satuan = satuan or frappe.db.get_value("Item", kode, "stock_uom")
	faktor = frappe.db.get_value(
		"UOM Conversion Detail", {"parent": kode, "uom": satuan}, "conversion_factor"
	)
	so = frappe.get_doc(
		{
			"doctype": "Sales Order",
			"company": company,
			"customer": pelanggan,
			"currency": "IDR",
			"selling_price_list": daftar_harga("_Uji Harga Jual", jual=True),
			"transaction_date": tanggal,
			"delivery_date": kirim,
			"items": [
				{
					"item_code": kode,
					"qty": qty,
					"uom": satuan,
					"conversion_factor": faktor or 1,
					"rate": 10000,
					"delivery_date": kirim,
					"warehouse": gudang(company, "Gudang Barang Jadi"),
				}
			],
		}
	).insert(ignore_permissions=True)
	if submit:
		so.submit()
	return so


def buat_perkiraan(company: str, items: list[str], dari: date, periode: int, tanggal: date | None = None):
	"""A new draft Monthly Sales Forecast of `items` from `dari` for `periode` months, posted on `tanggal`
	(default today), its parent warehouse the company's root warehouse. Its demand rows are left empty
	(`forecast.isi` generates them)."""
	from frappe.utils import getdate, today

	tanggal = getdate(tanggal or today())
	tahun_fiskal(tanggal)
	return frappe.get_doc(
		{
			"doctype": "Sales Forecast",
			"company": company,
			"posting_date": tanggal,
			"frequency": "Monthly",
			"from_date": dari,
			"demand_number": periode,
			"parent_warehouse": akar_gudang(company),
			"selected_items": [{"item_code": k} for k in items],
		}
	).insert(ignore_permissions=True)


def buat_bom(kode: str, bahan: dict[str, float], jumlah: float = 1, company: str = "_Uji Pabrik") -> str:
	"""Get or create the default submitted BOM of `kode`: `bahan` maps each material to its quantity (in its
	stock UOM) for `jumlah` units. An existing default BOM is returned as it is."""
	ada = frappe.db.get_value("BOM", {"item": kode, "is_default": 1, "docstatus": 1, "company": company})
	if ada:
		return ada
	bom = frappe.get_doc(
		{
			"doctype": "BOM",
			"item": kode,
			"company": company,
			"currency": "IDR",
			"quantity": jumlah,
			"is_active": 1,
			"is_default": 1,
			"rm_cost_as_per": "Valuation Rate",
			"items": [
				{
					"item_code": b,
					"qty": q,
					"uom": frappe.db.get_value("Item", b, "stock_uom"),
					"rate": 1000,
				}
				for b, q in bahan.items()
			],
		}
	).insert(ignore_permissions=True)
	bom.submit()
	return bom.name


def lama_produksi(kode: str, per_hari: float, cadangan: float = 0, beli_hari: float = 0) -> str:
	"""Get or create the Item Lead Time of `kode`: `per_hari` units a day, `cadangan` buffer days and
	`beli_hari` purchase days."""
	nilai = {"capacity_per_day": per_hari, "buffer_time": cadangan, "purchase_time": beli_hari}
	if frappe.db.exists("Item Lead Time", kode):
		doc = frappe.get_doc("Item Lead Time", kode)
		if any(doc.get(k) != v for k, v in nilai.items()):
			doc.update(nilai)
			doc.save(ignore_permissions=True)
		return doc.name
	return (
		frappe.get_doc({"doctype": "Item Lead Time", "item_code": kode, **nilai})
		.insert(ignore_permissions=True)
		.name
	)


def buat_karyawan(
	nama: str,
	company: str,
	user: str | None = None,
	masuk: date | None = None,
	izin_sendiri: bool = True,
	kelamin: str = "Female",
	**field,
) -> str:
	"""Get or create the active Employee `nama` of `company` (found by first name and company), joined on
	`masuk` (default two years ago), linked to `user` when given. `izin_sendiri` lets ERPNext restrict that
	user to their own Employee record (a Karyawan); HR and managers get it off. `field` adds other fields
	(`last_name`)."""
	from frappe.utils import add_months, getdate, today

	ada = frappe.db.get_value("Employee", {"first_name": nama, "company": company}, "name")
	if ada:
		return ada
	return (
		frappe.get_doc(
			{
				"doctype": "Employee",
				"first_name": nama,
				"company": company,
				"gender": kelamin,
				"date_of_birth": add_months(getdate(today()), -12 * 30),
				"date_of_joining": masuk or add_months(getdate(today()), -24),
				"status": "Active",
				"user_id": user,
				"create_user_permission": int(bool(user) and izin_sendiri),
				**field,
			}
		)
		.insert(ignore_permissions=True)
		.name
	)


def penugasan_shift(karyawan: str, shift: str, mulai: date) -> str:
	"""Get or create the submitted Shift Assignment of `karyawan` to `shift` from `mulai`, open-ended."""
	ada = frappe.db.get_value(
		"Shift Assignment", {"employee": karyawan, "shift_type": shift, "docstatus": 1}, "name"
	)
	if ada:
		return ada
	doc = frappe.get_doc(
		{
			"doctype": "Shift Assignment",
			"employee": karyawan,
			"shift_type": shift,
			"company": frappe.db.get_value("Employee", karyawan, "company"),
			"start_date": mulai,
			"status": "Active",
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	doc.submit()
	return doc.name


def jatah_cuti(karyawan: str, jenis: str, jumlah: float, dari: date, sampai: date) -> str:
	"""Get or create the submitted Leave Allocation of `jumlah` days of `jenis` for `karyawan`, from `dari`
	to `sampai`."""
	ada = frappe.db.get_value(
		"Leave Allocation",
		{
			"employee": karyawan,
			"leave_type": jenis,
			"docstatus": 1,
			"from_date": ("<=", sampai),
			"to_date": (">=", dari),
		},
		"name",
	)
	if ada:
		return ada
	doc = frappe.get_doc(
		{
			"doctype": "Leave Allocation",
			"employee": karyawan,
			"company": frappe.db.get_value("Employee", karyawan, "company"),
			"leave_type": jenis,
			"from_date": dari,
			"to_date": sampai,
			"new_leaves_allocated": jumlah,
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	doc.submit()
	return doc.name
