"""BOMs made from a Machine Capacity row, and the Work Order's pick of the machine's BOM."""

from unittest.mock import patch

import frappe
from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_receipt
from erpnext.controllers.item_variant import create_variant
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, getdate, today

from erp_internal import master, penjualan
from erp_internal.planning import kapasitas
from erp_internal.planning.kapasitas import (
	_isi_bom,
	baris_bom,
	buat_bom_kapasitas,
	kunci_mesin,
	mesin_aktif,
	pilih_bom,
	varian_tercakup,
)
from erp_internal.setup import gudang, pastikan_setup
from erp_internal.tampilan import ADMIN, PRODUKSI
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_hasil,
	buat_kapasitas,
	buat_mesin,
	buat_pemasok,
	buat_pengguna,
	buat_perusahaan,
	buat_varian,
	buat_wo,
	daftar_harga,
	lampirkan,
	stok_awal,
	tahun_fiskal,
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
		pegawai = buat_pengguna("_uji.bomk.user@example.com", PRODUKSI, PRODUKSI, None)
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
		self.row(self.v[0], self.m2)  # listed on both machines: the move is allowed
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

	def test_mesin_tidak_aktif(self):
		# An inactive machine takes no new order, and no order moves onto it; one already running there goes on
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
		frappe.db.set_value("Workstation", self.m2, "disabled", 1)
		a.reload()
		a.erp_mesin = self.m2
		self.assertRaisesRegex(frappe.ValidationError, "is not in use", a.save)
		frappe.db.set_value("Workstation", self.m1, "disabled", 1)
		a.reload()
		a._doc_before_save = frappe.get_doc("Work Order", a.name)
		mesin_aktif(a)  # the machine it already runs on, now off: left alone
		b = frappe.copy_doc(a)
		self.assertRaisesRegex(frappe.ValidationError, "is not in use", b.insert)


class TestPigmen(IntegrationTestCase):
	"""Pigment per colour (spec section 8, A1): stocked in grams, bought per Kg, a BOM line of part kg x ratio."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.mesin = buat_mesin(1)
		cls.bahan = buat_barang("_UJI-PP", "Bahan Baku", "Kg")

	def setUp(self):
		frappe.db.savepoint("pigmen")
		self.addCleanup(frappe.db.rollback, save_point="pigmen")
		self.addCleanup(frappe.cache.delete_value, kapasitas.KUNCI_SEGARKAN_LAGI)

	def pigmen(self, warna, rasio):
		"""Get or create the PIGMEN template (as `penjualan._pigmen`) and its variant for `warna`."""
		buat_varian("_UJI-PG-WARNA", ["Super"], [warna])  # the Warna value exists
		penjualan._pigmen(master.Hasil())
		kode = frappe.db.sql(
			"""select i.name from `tabItem` i join `tabItem Variant Attribute` a on a.parent = i.name
			where i.variant_of = 'PIGMEN' and a.attribute = 'Warna' and a.attribute_value = %s""",
			warna,
		)
		if kode:
			doc = frappe.get_doc("Item", kode[0][0])
			doc.erp_rasio_pigmen = rasio
			doc.save()
			return doc.name
		doc = create_variant("PIGMEN", {"Warna": warna})
		doc.erp_rasio_pigmen = rasio
		return doc.insert().name

	def isi_bom(self, item):
		bom = frappe.db.get_value(
			"BOM", {"item": item, "is_default": 1, "docstatus": 1, "erp_kapasitas": ("is", "set")}
		)
		return _isi_bom(bom)

	def stok(self, kode, nama_gudang):
		wh = gudang(self.pabrik, nama_gudang)
		return frappe.db.get_value("Bin", {"item_code": kode, "warehouse": wh}, "actual_qty") or 0

	def kapasitas(self, item):
		return buat_kapasitas(item, self.mesin, material=self.bahan, part_weight=50, runner_weight=0)

	def test_satuan_gram(self):
		pg = self.pigmen("Merah", rasio=1)
		item = frappe.get_doc("Item", pg)
		self.assertEqual((item.stock_uom, item.purchase_uom, item.item_group), ("Gram", "Kg", "Pigmen"))
		self.assertEqual({u.uom: u.conversion_factor for u in item.uoms}, {"Gram": 1, "Kg": 1000})
		self.assertEqual(frappe.db.get_value("UOM", "Gram", "must_be_whole_number"), 0)

	def test_pigmen_per_warna(self):
		merah, bening = buat_varian("_UJI-PG-GAYUNG", ["Super"], ["Merah", "Bening"])
		pg = self.pigmen("Merah", rasio=2)
		buat_bom_kapasitas(self.kapasitas("_UJI-PG-GAYUNG"), company=self.pabrik)
		self.assertIn((pg, 0.1), self.isi_bom(merah))  # 50 g = 0.05 kg x 2 g/kg = 0.1 g
		self.assertNotIn(pg, [k for k, _q in self.isi_bom(bening)])
		self.assertIn((self.bahan, 0.05), self.isi_bom(merah))  # the material line is unchanged

	def test_rasio_berubah_bom_baru(self):
		(merah,) = buat_varian("_UJI-PG-GAYUNG", ["Super"], ["Merah"])
		pg = self.pigmen("Merah", rasio=1)
		buat_bom_kapasitas(self.kapasitas("_UJI-PG-GAYUNG"), company=self.pabrik)
		self.assertIn((pg, 0.05), self.isi_bom(merah))
		frappe.get_doc("Item", pg).update({"erp_rasio_pigmen": 3}).save()  # rebuilds now under tests
		self.assertIn((pg, 0.15), self.isi_bom(merah))
		frappe.get_doc("Item", pg).update({"disabled": 1}).save()
		self.assertNotIn(pg, [k for k, _q in self.isi_bom(merah)])

	def test_minta_lagi_saat_jalan(self):
		# A change saved while a pass runs (the flag set again) gets a pass of its own; none is lost.
		panggilan = []

		def sekali():
			panggilan.append(1)
			if len(panggilan) == 1:
				frappe.cache.set_value(kapasitas.KUNCI_SEGARKAN_LAGI, 1)
			return 0

		with patch.object(kapasitas, "_segarkan_sekali", side_effect=sekali):
			kapasitas._antre()
		self.assertEqual(len(panggilan), 2)
		self.assertFalse(frappe.cache.get_value(kapasitas.KUNCI_SEGARKAN_LAGI))

	def test_template_dari_setup(self):
		# A migrate brings the PIGMEN template to a site whose colours exist (Samuel's data loaded earlier).
		buat_varian("_UJI-PG-WARNA", ["Super"], ["Merah"])
		if not frappe.db.exists("Item", {"variant_of": "PIGMEN"}):
			frappe.delete_doc("Item", "PIGMEN", force=True, ignore_missing=True)  # rolled back after the test
			self.assertFalse(frappe.db.exists("Item", "PIGMEN"))
		pastikan_setup()
		self.assertEqual(frappe.db.get_value("Item", "PIGMEN", ["stock_uom", "has_variants"]), ("Gram", 1))

	def test_rasio_nol_ditolak(self):
		with self.assertRaises(frappe.ValidationError):
			self.pigmen("Biru", rasio=0)

	def test_produksi_memakai_pigmen(self):
		(merah,) = buat_varian("_UJI-PG-GAYUNG", ["Super"], ["Merah"])
		pg = self.pigmen("Merah", rasio=1)
		buat_bom_kapasitas(self.kapasitas("_UJI-PG-GAYUNG"), company=self.pabrik)
		stok_awal(self.pabrik, pg, 1000, "Gudang Bahan Baku")
		stok_awal(self.pabrik, self.bahan, 100, "Gudang Bahan Baku")
		buat_hasil(buat_wo(merah, self.mesin, qty=1000), good=1000)
		self.assertAlmostEqual(self.stok(pg, "Gudang Bahan Baku"), 1000 - 50)

	def test_beli_per_kg(self):
		pg = self.pigmen("Merah", rasio=1)
		wh = gudang(self.pabrik, "Gudang Bahan Baku")
		sebelum = self.stok(pg, "Gudang Bahan Baku")
		tahun_fiskal(getdate(today()))
		harga = daftar_harga(penjualan.HARGA_BAHAN, jual=False)
		frappe.get_doc(
			{
				"doctype": "Item Price",
				"item_code": pg,
				"price_list": harga,
				"uom": "Kg",
				"price_list_rate": 150000,
			}
		).insert()
		po = frappe.get_doc(
			{
				"doctype": "Purchase Order",
				"company": self.pabrik,
				"supplier": buat_pemasok("_Uji Pemasok"),
				"currency": "IDR",
				"buying_price_list": harga,
				"transaction_date": today(),
				"schedule_date": add_days(today(), 7),
				"set_warehouse": wh,
				"items": [
					{
						"item_code": pg,
						"qty": 2,
						"uom": "Kg",
						"warehouse": wh,
						"schedule_date": add_days(today(), 7),
					}
				],
			}
		).insert()
		self.assertEqual((po.items[0].rate, po.items[0].stock_qty), (150000, 2000))  # the price per Kg
		lampirkan("Purchase Order", po.name)
		po.submit()
		pr = make_purchase_receipt(po.name).insert()
		lampirkan("Purchase Receipt", pr.name)
		pr.submit()
		self.assertEqual(self.stok(pg, "Gudang Bahan Baku"), sebelum + 2000)
