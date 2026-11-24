"""Samuel's item-to-machine list (`mesin_barang.muat`): a capacity row per template + Jenis and machine with the
mould's cavities, their BOMs, the names with no product, the inactive machines, and nothing written twice."""

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal import master, mesin_barang, penjualan
from erp_internal.planning.kapasitas import kapasitas
from erp_internal.tests.utils import buat_perusahaan

PASANGAN, KAPASITAS = 31, 54


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
			# Mesin 14: the Seal Cap's row (`seal_cap.py`, through master.muat)
			["Mesin 02", "Mesin 03", "Mesin 04", "Mesin 05", "Mesin 06", "Mesin 08", "Mesin 14"],
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
		baris = [(i.item_code, i.qty) for i in bom.items]
		self.assertEqual(baris[0], ("BB-PP-WARNA", 0.07))
		# master.muat adds a pigment (1 g per kg) for each Seal Cap colour, Biru too: 70 g x 1 g/kg = 0.07 g.
		self.assertTrue(all(k.startswith("PIGMEN-") and q == 0.07 for k, q in baris[1:]), baris)

	def test_dinda_dx_dan_folding(self):
		# "Gantungan DX" is Gantungan Dinda DX: ( 4 ) on Mesin 04, ( 2 ) on Mesin 05.
		self.assertEqual(self.baris("GANTUNGAN-DINDA", "DX", "Mesin 04").cavities, 4)
		self.assertEqual(self.baris("GANTUNGAN-DINDA", "DX", "Mesin 05").cavities, 2)
		# Gantungan Folding is one item on the machine of its stick: 56 + 36 + 43 s a set.
		b = self.baris("GANTUNGAN-FOLDING-20", "Soft", "Mesin 06")
		self.assertEqual((b.cycle_time, b.cavities, b.part_weight), (135, 1, 325))
		self.assertEqual(self.hasil["catatan"], [])

	def test_mesin_tidak_aktif(self):
		for n in (1, 7, 9, 13):
			self.assertEqual(
				frappe.db.get_value("Workstation", f"Mesin {n:02d}", ["disabled", "status"]), (1, "Off")
			)
		for n in (2, 14):  # Mesin 14 runs the Seal Cap (Samuel 2026-11-24)
			self.assertEqual(frappe.db.get_value("Workstation", f"Mesin {n:02d}", "disabled"), 0)

	def test_kedua_kali_tidak_menulis(self):
		self.assertEqual(mesin_barang.muat(self.company)["ditulis"], 0)
		self.assertEqual(master.muat()["ditulis"], 0)
