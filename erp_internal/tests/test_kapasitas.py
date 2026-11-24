"""Machine Capacity: the two computed figures, the lookup order and every refusal."""

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal.planning import kapasitas as kapasitas_modul
from erp_internal.planning.kapasitas import ada_baris, cari_mesin, jenis_varian, kapasitas, mesin_item
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_kapasitas,
	buat_mesin,
	buat_perusahaan,
	buat_varian,
	buat_wo,
)

TEMPLATE = "_UJI-KAP"


class TestKapasitas(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# variants: v[0]=Super-Merah, v[1]=Super-Biru, v[2]=DX-Merah, v[3]=DX-Biru
		cls.v = buat_varian(TEMPLATE, ["Super", "DX"], ["Merah", "Biru"])
		cls.tpl = TEMPLATE
		cls.m1 = buat_mesin(1)
		cls.m2 = buat_mesin(2)
		cls.pp = buat_barang("_UJI-PP", "Bahan Baku", "Kg")
		cls.mb = buat_barang("_UJI-MB", "Bahan Baku", "Kg")
		cls.kemasan_pcs = buat_barang("_UJI-KEMASAN", "Kemasan", "Pcs")
		# the Work Order's machine lock: two products with a BOM, a company, two machines
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.bahan = cls.pp
		cls.mesin_a, cls.mesin_b = cls.m1, cls.m2
		cls.barang = buat_barang("_UJI-KAP-WO", "Barang Jadi")
		cls.barang_tanpa_baris = buat_barang("_UJI-KAP-BEBAS", "Barang Jadi")
		for kode in (cls.barang, cls.barang_tanpa_baris):
			buat_bom(kode, {cls.bahan: 0.05}, company=cls.pabrik)

	def setUp(self):
		# Each test starts from the fixtures only: the class's rollback comes too late for rows a test makes.
		frappe.db.savepoint("kapasitas")
		self.addCleanup(frappe.db.rollback, save_point="kapasitas")

	def order_draft(self, mesin, item=None):
		return frappe.get_doc(
			{
				"doctype": "Work Order",
				"production_item": item or self.barang,
				"company": self.pabrik,
				"qty": 1,
				"erp_mesin": mesin,
				"bom_no": frappe.db.get_value("BOM", {"item": item or self.barang, "docstatus": 1}),
			}
		)

	def test_hitungan(self):
		# 20 s cycle, 4 cavities, 50 g part, 12 g runner thrown away
		r = frappe.get_doc(
			"Machine Capacity",
			buat_kapasitas(
				self.v[0],
				self.m1,
				cycle_time=20,
				cavities=4,
				part_weight=50,
				runner_weight=12,
				runner_reground=0,
				material=self.pp,
			),
		)
		self.assertEqual(r.pcs_per_hour, 720)
		self.assertEqual(r.material_per_pcs, 53)
		r.runner_reground = 1
		r.save()
		self.assertEqual(r.material_per_pcs, 50)

	def test_runner_bawaan(self):
		baru = {
			"doctype": "Machine Capacity",
			"item": self.v[1],
			"workstation": self.m2,
			"cycle_time": 10,
			"cavities": 2,
			"part_weight": 10,
			"material": self.pp,
		}
		with patch.object(kapasitas_modul, "RUNNER_DIGILING", 1):
			r = frappe.get_doc(baru).insert()
			self.assertEqual(r.runner_reground, 1)
		frappe.delete_doc("Machine Capacity", r.name, force=1)
		# a value that was given wins over the default
		with patch.object(kapasitas_modul, "RUNNER_DIGILING", 1):
			self.assertEqual(frappe.get_doc({**baru, "runner_reground": 0}).insert().runner_reground, 0)

	def test_urutan_cari(self):
		isi = {"cavities": 2, "part_weight": 40, "material": self.pp}
		t = buat_kapasitas(self.tpl, self.m1, cycle_time=30, **isi)
		j = buat_kapasitas(self.tpl, self.m1, jenis="Super", cycle_time=25, **isi)
		v = buat_kapasitas(self.v[0], self.m1, cycle_time=20, **isi)
		self.assertEqual(jenis_varian(self.v[0]), "Super")
		self.assertEqual(kapasitas(self.v[0], self.m1).name, v)
		self.assertEqual(kapasitas(self.v[1], self.m1).name, j)
		self.assertEqual(kapasitas(self.v[2], self.m1).name, t)
		self.assertIsNone(kapasitas(self.v[0], self.m2))
		frappe.db.set_value("Machine Capacity", v, "disabled", 1)
		self.assertEqual(kapasitas(self.v[0], self.m1).name, j)
		frappe.db.set_value("Machine Capacity", j, "disabled", 1)
		self.assertEqual(kapasitas(self.v[0], self.m1).name, t)

	def test_bahan_harus_kg(self):  # Review Focus 2
		with self.assertRaises(frappe.ValidationError):
			buat_kapasitas(self.v[0], self.m1, material=self.kemasan_pcs)
		with self.assertRaises(frappe.ValidationError):
			buat_kapasitas(self.v[0], self.m1, material=self.pp, masterbatch=self.kemasan_pcs)

	def test_ditolak(self):
		tanpa_nomor = "_Uji Tanpa Nomor"
		if not frappe.db.exists("Workstation", tanpa_nomor):
			frappe.get_doc({"doctype": "Workstation", "workstation_name": tanpa_nomor}).insert()
		buat_kapasitas(self.v[2], self.m2, material=self.pp)
		salah = [
			{"cycle_time": 0},
			{"cavities": 0},
			{"part_weight": 0},
			{"runner_weight": -1},
			{"masterbatch": self.mb, "masterbatch_percent": 100},
			{"item": self.v[2], "workstation": self.m2},  # duplicate (item, jenis, workstation)
			{"item": self.v[3], "jenis": "Super"},  # jenis on a variant
			{"item": self.tpl, "jenis": "Tidak Ada"},  # a Jenis the variants never use
			{"item": self.v[3], "workstation": tanpa_nomor},
		]
		for nilai in salah:
			with self.subTest(nilai):
				dasar = {
					"doctype": "Machine Capacity",
					"item": self.v[3],
					"workstation": self.m1,
					"cycle_time": 20,
					"cavities": 4,
					"part_weight": 50,
					"material": self.pp,
				}
				with self.assertRaises(frappe.ValidationError):
					frappe.get_doc({**dasar, **nilai}).insert()

	def test_mesin_di_luar_daftar_ditolak(self):
		buat_kapasitas(self.barang, self.mesin_a, material=self.bahan)
		wo = self.order_draft(self.mesin_b)
		# the message names the right machine
		with self.assertRaisesRegex(frappe.ValidationError, self.mesin_a):
			wo.insert()

	def test_barang_tanpa_baris_bebas(self):
		# No list to check against: any numbered machine (several real products have no row yet).
		self.assertTrue(self.order_draft(self.mesin_b, item=self.barang_tanpa_baris).insert().name)
		hasil = cari_mesin("Workstation", "", "name", 0, 50, {"item": self.barang_tanpa_baris})
		self.assertTrue({self.mesin_a, self.mesin_b} <= {r[0] for r in hasil})

	def test_order_tanpa_mesin_boleh(self):
		self.assertTrue(self.order_draft(None, item=self.barang_tanpa_baris).insert().name)

	def test_pindah_mesin_setelah_submit(self):
		buat_kapasitas(self.barang, self.mesin_a, material=self.bahan)
		wo = frappe.get_doc("Work Order", buat_wo(self.barang, self.mesin_a, company=self.pabrik))
		wo.erp_mesin = self.mesin_b
		with self.assertRaises(frappe.ValidationError):
			wo.save()

	def test_cari_mesin(self):
		buat_kapasitas(self.barang, self.mesin_a, material=self.bahan)
		hasil = cari_mesin("Workstation", "", "name", 0, 20, {"item": self.barang})
		self.assertEqual([r[0] for r in hasil], [self.mesin_a])

	def test_baris_hanya_di_mesin_mati_tetap_mengunci(self):
		# The item's only row sits on a machine that is off: no machine is free for it, not even another one.
		mati = buat_mesin(3)
		buat_kapasitas(self.barang, mati, material=self.bahan)
		frappe.db.set_value("Workstation", mati, "disabled", 1)
		self.assertEqual(mesin_item(self.barang), [])
		self.assertEqual(cari_mesin("Workstation", "", "name", 0, 20, {"item": self.barang}), [])
		with self.assertRaisesRegex(frappe.ValidationError, "none in use"):
			self.order_draft(self.mesin_a).insert()

	def test_order_jalan_terus_setelah_barisnya_dimatikan(self):
		# A submitted order stays on its machine when its row is switched off later; a new order there is refused.
		baris = buat_kapasitas(self.barang, self.mesin_a, material=self.bahan)
		buat_kapasitas(self.barang, buat_mesin(3), material=self.bahan)
		wo = frappe.get_doc("Work Order", buat_wo(self.barang, self.mesin_a, company=self.pabrik))
		frappe.db.set_value("Machine Capacity", baris, "disabled", 1)
		wo.reload()
		wo.save()
		with self.assertRaises(frappe.ValidationError):
			self.order_draft(self.mesin_a).insert()

	def test_mesin_item_ikut_template(self):
		buat_kapasitas(self.tpl, self.mesin_a, material=self.bahan)
		buat_kapasitas(self.v[0], self.mesin_b, material=self.bahan)
		self.assertEqual(mesin_item(self.v[0]), [self.mesin_a, self.mesin_b])  # own row + template's
		self.assertEqual(mesin_item(self.v[2]), [self.mesin_a])  # the template's row only
		self.assertFalse(ada_baris(self.barang_tanpa_baris))
