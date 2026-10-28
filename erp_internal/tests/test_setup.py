"""Site setup on every migrate: locale, the company marker, item groups, UOMs, warehouses and the office."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import getdate, today

from erp_internal.setup import (
	GRUP_BARANG,
	GUDANG_PABRIK,
	PENGATURAN_SISTEM,
	SATUAN,
	gudang,
	nama_libur,
	pastikan_setup,
	perusahaan,
)
from erp_internal.tests.utils import buat_pengguna, buat_perusahaan


class TestSetup(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")

	def test_pengaturan_indonesia(self):
		for field, nilai in PENGATURAN_SISTEM.items():
			self.assertEqual(frappe.db.get_single_value("System Settings", field), nilai, field)
		self.assertEqual(frappe.db.get_single_value("Website Settings", "disable_signup"), 1)
		self.assertEqual(
			frappe.db.get_single_value("OAuth Settings", "enable_dynamic_client_registration"), 0
		)

	def test_gudang_pabrik(self):
		aktif = frappe.get_all(
			"Warehouse", {"company": self.pabrik, "is_group": 0, "disabled": 0}, pluck="warehouse_name"
		)
		self.assertEqual(set(aktif), set(GUDANG_PABRIK))
		self.assertEqual(gudang(self.pabrik, "Gudang Barang Jadi"), "Gudang Barang Jadi - _UP")

	def test_satu_perusahaan_dapat_semua(self):
		# One company gets the factory and the office (Samuel, 2026-10-28): warehouses and production
		# defaults, and this year's holiday list.
		self.assertEqual(
			frappe.db.get_value("Company", self.pabrik, "default_wip_warehouse"),
			gudang(self.pabrik, "Gudang Produksi"),
		)
		self.assertEqual(
			frappe.db.get_value("Company", self.pabrik, "default_holiday_list"),
			nama_libur(self.pabrik, getdate(today()).year),
		)

	def test_grup_satuan_dan_penanda(self):
		self.assertTrue(all(frappe.db.exists("Item Group", g) for g in GRUP_BARANG))
		self.assertTrue(all(frappe.db.exists("UOM", s) for s in SATUAN))
		self.assertIn(self.pabrik, perusahaan())

	def test_perusahaan_lain_dibiarkan(self):
		# A company without erp_aktif (ERPNext's own test companies) gets nothing from setup.
		if not frappe.db.exists("Company", "_Uji Lain"):
			frappe.get_doc(
				{
					"doctype": "Company",
					"company_name": "_Uji Lain",
					"abbr": "_UL",
					"country": "Indonesia",
					"default_currency": "IDR",
					"create_chart_of_accounts_based_on": "Standard Template",
					"chart_of_accounts": "Standard",
				}
			).insert(ignore_permissions=True)
		pastikan_setup()
		self.assertNotIn("_Uji Lain", perusahaan())
		self.assertFalse(frappe.db.exists("Warehouse", gudang("_Uji Lain", "Gudang Barang Jadi")))
		self.assertFalse(frappe.db.get_value("Company", "_Uji Lain", "default_holiday_list"))

	def test_idempoten(self):
		def hitung():
			return {
				dt: frappe.db.count(dt)
				for dt in (
					"Warehouse",
					"Item Group",
					"UOM",
					"Custom Field",
					"Shift Type",
					"Holiday List",
					"Holiday List Assignment",
					"Leave Type",
				)
			}

		sebelum = hitung()
		pastikan_setup()
		pastikan_setup()
		self.assertEqual(hitung(), sebelum)

	def test_gudang_bawaan(self):
		# Documents of a factory default to its finished-goods warehouse.
		self.assertEqual(
			frappe.db.get_value("Company", self.pabrik, "default_warehouse"),
			gudang(self.pabrik, "Gudang Barang Jadi"),
		)

	def test_izin_perusahaan_jadi_bawaan(self):
		# A user's only Company permission becomes their default, so nobody picks the company twice.
		u = buat_pengguna("_uji.bawaan@contoh.test", None, None, None)
		frappe.db.delete("User Permission", {"user": u})
		izin = frappe.get_doc(
			{
				"doctype": "User Permission",
				"user": u,
				"allow": "Company",
				"for_value": self.pabrik,
				"is_default": 0,
			}
		).insert(ignore_permissions=True)
		pastikan_setup()
		self.assertEqual(frappe.db.get_value("User Permission", izin.name, "is_default"), 1)
