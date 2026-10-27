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
