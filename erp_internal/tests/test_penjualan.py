"""Samuel's sales Excel (`penjualan.muat`): every row's months land in Sales History in full, spread over the
colour variants; the new types, raw materials with their price, minimum stock; nothing written by a second run."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import getdate

from erp_internal import master, penjualan
from erp_internal.tests.utils import buat_perusahaan


class TestPenjualan(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.company = buat_perusahaan("_Uji Pabrik", "_UP")
		master.muat()
		cls.hasil = penjualan.muat(cls.company)
		cls.data = master.berkas(penjualan.BERKAS)

	def test_bagi(self):
		self.assertEqual(penjualan.bagi(10, 3), [4, 3, 3])
		self.assertEqual(penjualan.bagi(2, 4), [1, 1, 0, 0])
		self.assertEqual(sum(penjualan.bagi(73680, 7)), 73680)

	def test_jumlah_sama_excel(self):
		# Each Excel row and month, summed over its variants, equals the Excel figure in the stock UOM.
		self.assertEqual(self.hasil["baris_excel"], 33)
		for b in self.data["penjualan"]:
			kode = [k for t, j in b["barang"] for k in penjualan.varian(t, j)]
			self.assertTrue(kode, b["nama"])
			faktor = penjualan._faktor(kode[0], b["satuan"])
			for bulan, qty in b["qty"].items():
				ada = frappe.get_all(
					"Sales History",
					{"company": self.company, "item_code": ("in", kode), "bulan": getdate(f"{bulan}-01")},
					pluck="qty",
				)
				self.assertEqual(sum(ada), qty * faktor, f"{b['nama']} {bulan}")

	def test_dibagi_rata(self):
		# Gayung Lumba Super, January: 840 lusin = 10,080 pcs over 3 colours.
		kode = penjualan.varian("GAYUNG-LUMBA", "Super")
		self.assertEqual(len(kode), 3)
		qty = [
			frappe.db.get_value(
				"Sales History",
				{"company": self.company, "item_code": k, "bulan": getdate("2026-01-01")},
				"qty",
			)
			for k in kode
		]
		self.assertEqual(qty, [3360, 3360, 3360])
		# Gayung Bajigur "DX, Soft" spreads over both types.
		self.assertEqual(
			len(penjualan.riwayat({"penjualan": [self.data["penjualan"][18]]}, master.Hasil())), 8
		)

	def test_barang_baru(self):
		self.assertEqual(frappe.db.get_value("Item", "SENDOK-BEBEK-CMP", "stock_uom"), "Ball Kecil")
		self.assertEqual(frappe.db.get_value("Item", "TOPLES-NASTAR-BNG-BNG", "stock_uom"), "Pcs")
		self.assertEqual(len(penjualan.varian("GAYUNG-LUMBA", "Soft")), 3)
		self.assertEqual(len(penjualan.varian("GANTUNGAN-DINDA", "Hitam")), 1)
		# Sendok Panjang JSW is Sendok Makan Pack, sold per pack.
		self.assertEqual(
			frappe.db.get_value(
				"Sales History",
				{
					"company": self.company,
					"item_code": "SENDOK-MAKAN-PACK-BNG",
					"bulan": getdate("2026-08-01"),
				},
				"qty",
			)
			+ frappe.db.get_value(
				"Sales History",
				{
					"company": self.company,
					"item_code": "SENDOK-MAKAN-PACK-PTS",
					"bulan": getdate("2026-08-01"),
				},
				"qty",
			),
			120,
		)

	def test_bahan_baku(self):
		self.assertEqual(self.hasil["bahan_baku"], 7)
		self.assertEqual(
			frappe.db.get_value("Item", "BB-PP-WARNA", ["item_group", "stock_uom", "valuation_rate"]),
			("Bahan Baku", "Kg", 11850),
		)
		self.assertEqual(
			frappe.db.get_value(
				"Item Price",
				{"item_code": "BB-IMPECT-ORI", "price_list": penjualan.HARGA_BAHAN},
				"price_list_rate",
			),
			27000,
		)
		self.assertEqual(
			frappe.db.get_value("Price List", penjualan.HARGA_BAHAN, ["buying", "selling"]), (1, 0)
		)
		# A new Purchase Order takes its rates from it (it came at price 0 from "Standard Buying").
		self.assertEqual(
			frappe.db.get_single_value("Buying Settings", "buying_price_list"), penjualan.HARGA_BAHAN
		)
		self.assertEqual(frappe.db.get_default("buying_price_list"), penjualan.HARGA_BAHAN)

	def test_stok_minimum(self):
		# Gayung Lumba Super: 6,140 lusin in 9 months, a third per colour: 73,680 / 3 / 9 / 2 = 1,364.4 -> 1,365.
		self.assertEqual(frappe.db.get_value("Item", "GAYUNG-LUMBA-SPR-MRH", "safety_stock"), 1365)
		# Gantungan BabyLove DX sold only 6 gross in August.
		for k in penjualan.varian("GANTUNGAN-BABY-LOVE", "DX"):
			self.assertLessEqual(frappe.db.get_value("Item", k, "safety_stock"), 864 / 9 / 2 + 1)

	def test_pigmen(self):
		# The pigment template: stocked in grams, bought per Kg, variants per colour (spec section 8, A1).
		item = frappe.get_doc("Item", "PIGMEN")
		self.assertEqual(
			(item.item_group, item.stock_uom, item.purchase_uom, item.has_variants),
			("Pigmen", "Gram", "Kg", 1),
		)
		self.assertEqual([a.attribute for a in item.attributes], ["Warna"])
		self.assertEqual({u.uom: u.conversion_factor for u in item.uoms}, {"Gram": 1, "Kg": 1000})

	def test_kedua_kali_tidak_menulis(self):
		self.assertEqual(penjualan.muat(self.company)["ditulis"], 0)
