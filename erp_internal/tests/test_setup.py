"""Site setup on every migrate: locale, company kind, item groups, UOMs and factory warehouses."""

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal.setup import (
	GRUP_BARANG,
	GUDANG_PABRIK,
	PENGATURAN_SISTEM,
	SATUAN,
	gudang,
	pastikan_setup,
	perusahaan,
)
from erp_internal.tests.utils import buat_perusahaan


class TestSetup(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP", "Pabrik")
		cls.kantor = buat_perusahaan("_Uji Kantor", "_UK", "Kantor")

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

	def test_kantor_tanpa_gudang_pabrik(self):
		self.assertFalse(frappe.db.exists("Warehouse", gudang(self.kantor, "Gudang Barang Jadi")))

	def test_grup_satuan_dan_jenis(self):
		self.assertTrue(all(frappe.db.exists("Item Group", g) for g in GRUP_BARANG))
		self.assertTrue(all(frappe.db.exists("UOM", s) for s in SATUAN))
		self.assertIn(self.pabrik, perusahaan("Pabrik"))
		self.assertNotIn(self.kantor, perusahaan("Pabrik"))

	def test_idempoten(self):
		def hitung():
			return {dt: frappe.db.count(dt) for dt in ("Warehouse", "Item Group", "UOM", "Custom Field")}

		sebelum = hitung()
		pastikan_setup()
		pastikan_setup()
		self.assertEqual(hitung(), sebelum)
