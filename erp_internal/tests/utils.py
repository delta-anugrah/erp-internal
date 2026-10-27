"""Get-or-create fixtures shared by the tests. Every helper is safe to call twice."""

from datetime import date

import frappe


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
