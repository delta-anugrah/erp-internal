"""Machine Capacity: the two computed figures, the lookup order and every refusal."""

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal.planning import kapasitas as kapasitas_modul
from erp_internal.planning.kapasitas import jenis_varian, kapasitas
from erp_internal.tests.utils import buat_barang, buat_kapasitas, buat_mesin, buat_varian

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
