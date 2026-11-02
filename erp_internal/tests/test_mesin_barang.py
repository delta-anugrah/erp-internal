"""Samuel's item-to-machine list (`mesin_barang.muat`): a capacity row per template + Jenis and machine with the
mould's cavities, their BOMs, the names with no product, the inactive machines, and nothing written twice."""

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal import master, mesin_barang, penjualan
from erp_internal.planning.kapasitas import kapasitas
from erp_internal.tests.utils import buat_perusahaan

PASANGAN, KAPASITAS = 32, 46


class TestMesinBarang(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.company = buat_perusahaan("_Uji Pabrik", "_UP")
		master.muat()
		penjualan.muat(cls.company)
		cls.hasil = mesin_barang.muat(cls.company)

	def baris(self, item, jenis, mesin):
		return frappe.db.get_value(
			"Machine Capacity",
			{"item": item, "jenis": jenis, "workstation": mesin},
			["cycle_time", "cavities", "part_weight", "material", "pcs_per_hour"],
			as_dict=True,
		)

	def test_nama_barang(self):
		self.assertEqual(mesin_barang.nama_barang("Gantungan Pita ( 4 )"), ("Gantungan Pita", 4))
		self.assertEqual(mesin_barang.nama_barang("Gantungan Flash "), ("Gantungan Flash", None))

	def test_jumlah(self):
		self.assertEqual((self.hasil["pasangan"], self.hasil["kapasitas"]), (PASANGAN, KAPASITAS))
		mesin = frappe.get_all("Machine Capacity", {"item": ("not like", "%CTH%")}, pluck="workstation")
		self.assertEqual(
			sorted(set(mesin) & {f"Mesin {n:02d}" for n in range(1, 15)}),
			["Mesin 02", "Mesin 03", "Mesin 04", "Mesin 05", "Mesin 06", "Mesin 08"],
		)

	def test_rongga_cetakan(self):
		# "( 4 )" on Mesin 03 wins over Pita Super's 2 cavities, "( 2 )" on Mesin 05 over Pita Hitam's 4.
		self.assertEqual(self.baris("GANTUNGAN-PITA", "Super", "Mesin 03").cavities, 4)
		self.assertEqual(self.baris("GANTUNGAN-PITA", "Hitam", "Mesin 05").cavities, 2)
		# No number: the specification's (Flash Hitam: 2).
		self.assertEqual(self.baris("GANTUNGAN-FLASH", "Hitam", "Mesin 05").cavities, 2)
		b = self.baris("GAYUNG-LUMBA", "Soft", "Mesin 02")
		self.assertEqual(
			(b.cycle_time, b.cavities, b.part_weight, b.material), (28, 1, 75, "BB-PP-PK-LENGKENG")
		)

	def test_toples_nastar(self):
		# Body (30 s) and lid (10 s) on the same machine: one row, one set every 40 s.
		b = self.baris("TOPLES-NASTAR", "", "Mesin 05")
		self.assertEqual((b.cycle_time, b.cavities, b.part_weight, b.pcs_per_hour), (40, 1, 48, 90))

	def test_bom(self):
		varian = penjualan.varian("GAYUNG-LUMBA", "Super")[0]
		row = kapasitas(varian, "Mesin 02")
		bom = frappe.get_doc("BOM", {"item": varian, "erp_mesin": "Mesin 02", "is_active": 1, "docstatus": 1})
		self.assertEqual(bom.erp_kapasitas, row.name)
		self.assertEqual([(i.item_code, i.qty) for i in bom.items], [("BB-PP-WARNA", 0.07)])

	def test_belum_ada_barang(self):
		for nama in ("Body PLN (Mesin 02)", "Stik Folding (Mesin 06)", "Gantungan DX (Mesin 04)"):
			self.assertIn(f"{nama}: no product yet", self.hasil["catatan"])

	def test_mesin_tidak_aktif(self):
		for n in (1, 7, 9, 14):
			self.assertEqual(
				frappe.db.get_value("Workstation", f"Mesin {n:02d}", ["disabled", "status"]), (1, "Off")
			)
		self.assertEqual(frappe.db.get_value("Workstation", "Mesin 02", "disabled"), 0)

	def test_kedua_kali_tidak_menulis(self):
		self.assertEqual(mesin_barang.muat(self.company)["ditulis"], 0)
		self.assertEqual(master.muat()["ditulis"], 0)
