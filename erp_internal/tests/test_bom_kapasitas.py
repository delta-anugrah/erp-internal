"""BOMs made from a Machine Capacity row, and the Work Order's pick of the machine's BOM."""

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal.planning.kapasitas import baris_bom, buat_bom_kapasitas, kunci_mesin, pilih_bom, varian_tercakup
from erp_internal.tampilan import ADMIN, USER
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_kapasitas,
	buat_mesin,
	buat_pengguna,
	buat_perusahaan,
	buat_varian,
)

TEMPLATE = "_UJI-BOMK"


class TestBomKapasitas(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.v = buat_varian(TEMPLATE, ["Super", "DX"], ["Merah", "Biru"])
		cls.m1 = buat_mesin(1)
		cls.m2 = buat_mesin(2)
		cls.pp = buat_barang("_UJI-PP", "Bahan Baku", "Kg")
		cls.mb = buat_barang("_UJI-MB", "Bahan Baku", "Kg")

	def setUp(self):
		# Each test starts from the fixtures only: the class's rollback comes too late for rows a test makes.
		frappe.db.savepoint("bom_kapasitas")
		self.addCleanup(frappe.db.rollback, save_point="bom_kapasitas")

	def row(self, item, mesin, **nilai):
		isi = {"material": self.pp, "masterbatch": self.mb, "masterbatch_percent": 2, "runner_reground": 0}
		return buat_kapasitas(item, mesin, **{**isi, **nilai})

	def buat(self, nama):
		return buat_bom_kapasitas(nama, company=self.pabrik)

	def test_baris(self):
		# 50 g part, runner 12 g / 4 cav thrown away, masterbatch 2 %: mix 0.053 kg
		r = frappe.get_doc("Machine Capacity", self.row(self.v[0], self.m1))
		self.assertEqual(
			baris_bom(r),
			[{"item_code": self.pp, "qty": 0.05194}, {"item_code": self.mb, "qty": 0.00106}],
		)
		r.masterbatch_percent = 0
		self.assertEqual(baris_bom(r), [{"item_code": self.pp, "qty": 0.053}])
		r.masterbatch_percent, r.masterbatch = 2, None
		self.assertEqual(baris_bom(r), [{"item_code": self.pp, "qty": 0.053}])

	def test_tercakup(self):
		tpl = self.row(TEMPLATE, self.m1)
		own = self.row(self.v[0], self.m1)
		self.assertEqual(varian_tercakup(own), [self.v[0]])
		self.assertEqual(varian_tercakup(tpl), sorted(self.v[1:]))

	def test_buat_lalu_tetap(self):
		tpl = self.row(TEMPLATE, self.m1)  # covers all 4 variants; make it 3 with an own row
		own = self.row(self.v[0], self.m1)
		h = self.buat(tpl)
		self.assertEqual(len(h["dibuat"]), 3)
		self.assertEqual(self.buat(tpl)["dibuat"], [])
		self.assertEqual(len(self.buat(tpl)["tetap"]), 3)
		for nama in h["dibuat"]:
			b = frappe.get_doc("BOM", nama)
			self.assertEqual((b.erp_mesin, b.erp_kapasitas, b.is_default, b.is_active), (self.m1, tpl, 1, 1))
			self.assertEqual(b.docstatus, 1)
			self.assertEqual(
				[(i.item_code, i.qty) for i in b.items],
				[(self.pp, 0.05194), (self.mb, 0.00106)],
			)
		self.assertEqual(len(self.buat(own)["dibuat"]), 1)

	def test_baris_berubah(self):
		tpl = self.row(TEMPLATE, self.m1)
		lama = self.buat(tpl)["dibuat"]
		frappe.db.set_value("Machine Capacity", tpl, "cycle_time", 30)
		self.assertEqual(self.buat(tpl)["dibuat"], [])
		frappe.db.set_value("Machine Capacity", tpl, "part_weight", 60)
		frappe.db.set_value("Machine Capacity", tpl, "material_per_pcs", 63)
		# an open Work Order runs on one old BOM: it stays active
		wo = frappe.get_doc(
			{
				"doctype": "Work Order",
				"company": self.pabrik,
				"production_item": frappe.db.get_value("BOM", lama[0], "item"),
				"bom_no": lama[0],
				"qty": 1,
				"fg_warehouse": frappe.db.get_value("Warehouse", {"company": self.pabrik, "is_group": 0}),
				"wip_warehouse": frappe.db.get_value("Warehouse", {"company": self.pabrik, "is_group": 0}),
			}
		).insert()
		h = self.buat(tpl)
		self.assertEqual(len(h["dibuat"]), 4)
		self.assertEqual(sorted(h["nonaktif"]), sorted(lama[1:]))
		for n in lama[1:]:
			self.assertEqual(frappe.db.get_value("BOM", n, "is_active"), 0)
		for n in h["dibuat"]:
			self.assertEqual(
				frappe.db.get_value("Item", frappe.db.get_value("BOM", n, "item"), "default_bom"), n
			)
		self.assertEqual(frappe.db.get_value("BOM", lama[0], "is_active"), 1)
		self.assertTrue(all(frappe.db.get_value("BOM", n, "is_default") for n in h["dibuat"]))
		wo.delete()

	def test_bom_tangan_aman(self):
		tangan = buat_bom(self.v[0], {self.pp: 0.1}, company=self.pabrik)
		tpl = self.row(TEMPLATE, self.m1)
		self.buat(tpl)
		frappe.db.set_value("Machine Capacity", tpl, "disabled", 1)
		h = self.buat(tpl)
		self.assertEqual(len(h["nonaktif"]), 4)
		self.assertEqual(frappe.db.get_value("BOM", tangan, "is_active"), 1)
		self.assertEqual(frappe.db.get_value("BOM", {"erp_kapasitas": tpl, "is_active": 1}), None)

	def test_izin(self):
		tpl = self.row(TEMPLATE, self.m1)
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user("Guest")
		self.assertRaises(frappe.PermissionError, buat_bom_kapasitas, tpl)
		pegawai = buat_pengguna("_uji.bomk.user@example.com", USER, USER, None)
		frappe.set_user(pegawai)
		self.assertRaises(frappe.PermissionError, self.buat, tpl)
		admin = buat_pengguna("_uji.bomk.admin@example.com", ADMIN, ADMIN, None)
		frappe.set_user(admin)
		self.assertEqual(len(self.buat(tpl)["dibuat"]), 4)

	def test_pilih_bom_mesin(self):
		self.buat(self.row(self.v[0], self.m1))
		b2 = self.buat(self.row(self.v[0], self.m2, cycle_time=30))["dibuat"][0]
		b1 = frappe.db.get_value("BOM", {"item": self.v[0], "erp_mesin": self.m1, "is_active": 1})
		gudang = frappe.db.get_value("Warehouse", {"company": self.pabrik, "is_group": 0})

		def wo(**lain):
			return frappe.get_doc(
				{
					"doctype": "Work Order",
					"company": self.pabrik,
					"production_item": self.v[0],
					"qty": 1,
					"fg_warehouse": gudang,
					"wip_warehouse": gudang,
					**lain,
				}
			)

		# b2 is the item's default (made last): a WO on m1 gets m1's BOM, one on m2 keeps b2
		a = wo(erp_mesin=self.m1, bom_no=b2)
		pilih_bom(a)
		self.assertEqual(a.bom_no, b1)
		a = wo(erp_mesin=self.m2, bom_no=b1)
		pilih_bom(a)
		self.assertEqual(a.bom_no, b2)
		a = wo(erp_mesin=self.m2)
		pilih_bom(a)
		self.assertEqual(a.bom_no, b2)
		# a hand BOM that is not the default is kept
		tangan = buat_bom(self.v[1], {self.pp: 0.1}, company=self.pabrik)
		a = wo(production_item=self.v[1], erp_mesin=self.m1, bom_no=tangan)
		pilih_bom(a)
		self.assertEqual(a.bom_no, tangan)
		# through the real save: the hook swaps the BOM and the lines follow it
		b = wo(erp_mesin=self.m1, bom_no=b2).insert()
		self.assertEqual(b.bom_no, b1)
		self.assertEqual(b.required_items[0].item_code, self.pp)
		self.assertEqual(b.required_items[0].required_qty, 0.05194)

	def test_kunci_mesin(self):
		# A submitted order's machine changes while Not Started or In Process, never once it is done
		gudang = frappe.db.get_value("Warehouse", {"company": self.pabrik, "is_group": 0})
		self.buat(self.row(self.v[0], self.m1))
		a = frappe.get_doc(
			{
				"doctype": "Work Order",
				"company": self.pabrik,
				"production_item": self.v[0],
				"qty": 1,
				"fg_warehouse": gudang,
				"wip_warehouse": gudang,
				"erp_mesin": self.m1,
			}
		).insert()
		a.submit()
		a.reload()
		a.erp_mesin = self.m2
		a.save()
		self.assertEqual(frappe.db.get_value("Work Order", a.name, "erp_mesin"), self.m2)
		for status in ("Completed", "Stopped", "Closed"):
			a.db_set("status", status)
			a.reload()
			a.erp_mesin = self.m1
			self.assertRaisesRegex(frappe.ValidationError, "machine can only be changed", a.save)
		# the same machine passes on a closed order
		a.reload()
		a._doc_before_save = frappe.get_doc("Work Order", a.name)
		kunci_mesin(a)
