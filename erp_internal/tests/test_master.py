"""Samuel's master data (`master.muat`): the listed variants only, their packings, the prices, the machines,
and nothing written by a second run."""

import copy
from unittest.mock import patch

import frappe
from erpnext.controllers.item_variant import get_variant
from frappe.tests import IntegrationTestCase

from erp_internal import master

TEMPLATE, VARIAN, HARGA, MESIN = 21, 84, 157, 14


def faktor(kode: str, uom: str) -> float | None:
	return frappe.db.get_value("UOM Conversion Detail", {"parent": kode, "uom": uom}, "conversion_factor")


def harga(kode: str, uom: str) -> float | None:
	return frappe.db.get_value(
		"Item Price",
		{"item_code": kode, "uom": uom, "price_list": master.daftar_harga(master.berkas("katalog.json"))},
		"price_list_rate",
	)


class TestMaster(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hasil = master.muat()
		cls.daftar = cls.hasil["daftar_harga"]

	def test_jumlah(self):
		self.assertEqual(
			{k: self.hasil[k] for k in ("template", "varian", "harga", "mesin")},
			{"template": TEMPLATE, "varian": VARIAN, "harga": HARGA, "mesin": MESIN},
		)
		self.assertEqual(self.daftar, "Harga Pola 2026")
		self.assertEqual(frappe.db.count("Item", {"brand": master.MEREK, "has_variants": 1}), TEMPLATE)
		self.assertEqual(
			frappe.db.count("Item", {"brand": master.MEREK, "variant_of": ("is", "set")}), VARIAN
		)
		self.assertEqual(frappe.db.count("Item Price", {"price_list": self.daftar}), HARGA)
		self.assertEqual(frappe.db.get_value("Price List", self.daftar, ["selling", "currency"]), (1, "IDR"))
		self.assertFalse(frappe.db.exists("Item", {"brand": master.MEREK, "name": ("like", "CTH-%")}))
		self.assertEqual(frappe.db.get_value("Item", "GAYUNG-LUMBA", "item_group"), master.GRUP)

	def test_hanya_kombinasi_tercantum(self):
		# Gayung Lumba-Lumba: Super in 3 colours, DX in 3 others; not 2 x 5.
		self.assertEqual(frappe.db.count("Item", {"variant_of": "GAYUNG-LUMBA"}), 6)
		self.assertTrue(get_variant("GAYUNG-LUMBA", {"Jenis": "Super", "Warna": "Merah"}))
		self.assertIsNone(get_variant("GAYUNG-LUMBA", {"Jenis": "DX", "Warna": "Merah"}))
		self.assertEqual(frappe.db.count("Item", {"variant_of": "GANTUNGAN-DINDA"}), 7)
		# Toples Dinda by size, Sendok Makan split by packing; the list's spellings normalised.
		self.assertTrue(frappe.db.exists("Item", "TOPLES-DINDA-1.5KG-BNG"))
		self.assertEqual(frappe.db.count("Item", {"variant_of": "SENDOK-MAKAN-PACK"}), 2)
		self.assertEqual(frappe.db.count("Item", {"variant_of": "SENDOK-MAKAN"}), 2)
		self.assertTrue(get_variant("GANTUNGAN-BABY-LOVE", {"Jenis": "DX", "Warna": "Orange"}))
		self.assertTrue(get_variant("KERANJANG-SAMPAH", {"Jenis": "DX", "Warna": "Ungu"}))
		self.assertEqual(frappe.db.get_value("Item", "POT-25-HTM-HTM", "item_name"), "Pot UK 25 CM Hitam")

	def test_satuan(self):
		self.assertEqual(frappe.db.get_value("Item", "GAYUNG-LUMBA-SPR-MRH", "stock_uom"), "Pcs")
		self.assertEqual(faktor("GAYUNG-LUMBA-SPR-MRH", "Lusin"), 12)
		self.assertEqual(faktor("GAYUNG-LUMBA-SPR-MRH", "Gross"), 144)
		self.assertEqual(faktor("GAYUNG-LUMBA-SPR-MRH", "Ball"), 240)  # 1 Ball (20 Lusin)
		# One template, two packings: Super's Dus holds 3 Gross, DX's 5.
		self.assertEqual(faktor("GANTUNGAN-DINDA-SPR-BRU", "Dus"), 432)
		self.assertEqual(faktor("GANTUNGAN-DINDA-DX-ORG", "Dus"), 720)
		self.assertEqual(faktor("TOPLES-1.5KG-BNG-BTR", "Ikat"), 72)
		self.assertEqual(faktor("BASKOM-303-DX-ORG", "Ball"), 216)  # "per ball": 18 Lusin from the prices
		self.assertEqual(frappe.db.get_value("Item", "SENDOK-MAKAN-PACK-PTS", "stock_uom"), "Pack")
		self.assertEqual(faktor("SENDOK-MAKAN-PACK-PTS", "Dus"), 250)
		self.assertEqual(faktor("SENDOK-MAKAN-PTS", "Ball"), 2880)
		for uom in ("Lusin", "Gross", "Ball", "Dus", "Ikat", "Pack"):
			self.assertEqual(frappe.db.get_value("UOM", uom, "must_be_whole_number"), 1, uom)

	def test_ubah_template_tidak_menimpa_kemasan_varian(self):
		# Item Variant Settings allow_different_uom: a template's save leaves each variant's packings.
		doc = frappe.get_doc("Item", "GANTUNGAN-DINDA")
		doc.description += " Uji."
		doc.save()
		self.assertEqual(faktor("GANTUNGAN-DINDA-DX-ORG", "Dus"), 720)
		master.muat()

	def test_harga(self):
		self.assertEqual(harga("GAYUNG-LUMBA-SPR-MRH", "Lusin"), 20500)
		self.assertEqual(harga("GAYUNG-LUMBA-SPR-MRH", "Ball"), 410000)
		self.assertEqual(harga("GANTUNGAN-PITA-HTM-HTM", "Gross"), 102000)
		self.assertEqual(harga("SENDOK-MAKAN-PACK-BNG", "Pack"), 6250)
		self.assertEqual(harga("SENDOK-MAKAN-BNG", "Ball"), 272000)
		self.assertFalse(frappe.db.exists("Item Price", {"item_code": ("like", "GARPU-MAKAN%")}))
		self.assertIn("Garpu Makan: no price in the list", self.hasil["catatan"])
		self.assertIn("Gantungan Dinda Super: Dus 262,250 vs 3 x Gross = 262,650", self.hasil["catatan"])

	def test_daftar_harga_bawaan(self):
		self.assertEqual(frappe.db.get_single_value("Selling Settings", "selling_price_list"), self.daftar)
		# The forms and a server-made Sales Order read the global default, not the setting.
		self.assertEqual(frappe.db.get_default("selling_price_list"), self.daftar)
		frappe.db.set_single_value("Selling Settings", "selling_price_list", "Harga Lain")
		master.muat()
		self.assertEqual(frappe.db.get_single_value("Selling Settings", "selling_price_list"), "Harga Lain")
		self.assertEqual(frappe.db.get_default("selling_price_list"), "Harga Lain")
		frappe.db.set_single_value("Selling Settings", "selling_price_list", self.daftar)
		master.muat()

	def test_mesin(self):
		self.assertEqual(frappe.db.count("Workstation", {"workstation_type": master.JENIS_MESIN}), MESIN)
		self.assertEqual(
			frappe.db.get_value(
				"Workstation", "Mesin 01", ["erp_nomor", "erp_merek", "erp_model", "erp_tonase", "erp_tahun"]
			),
			(1, "JSW", "JSW J220 SSA II", 220, 1989),
		)
		self.assertEqual(frappe.db.get_value("Workstation", "Mesin 12", "erp_negara"), "HONGKONG")
		nomor = frappe.get_all("Workstation", {"workstation_type": master.JENIS_MESIN}, pluck="erp_nomor")
		self.assertEqual(sorted(nomor), list(range(1, 15)))

	def test_merek_epp(self):
		# The Seal Cap list: 21 brand codes, each with its insert count; a count Admin changed stays.
		baris = master.berkas("merek_epp.json")
		self.assertEqual(len(baris), 21)
		for b in baris:
			self.assertTrue(frappe.db.exists("Brand", b["merk"]), b["merk"])
		self.assertEqual(frappe.db.get_value("Brand", "NKP", "erp_jumlah_insert"), 21)
		self.assertEqual(frappe.db.get_value("Brand", "DBI", "description"), "2 pcs dibawa pa Udin")
		frappe.db.set_value("Brand", "NKP", "erp_jumlah_insert", 19)
		master.muat()
		self.assertEqual(frappe.db.get_value("Brand", "NKP", "erp_jumlah_insert"), 19)
		frappe.db.set_value("Brand", "NKP", "erp_jumlah_insert", 21)

	def test_dua_kali_sama(self):
		hitung = {
			dt: frappe.db.count(dt) for dt in ("Item", "Item Price", "Workstation", "UOM Conversion Detail")
		}
		kedua = master.muat()
		self.assertEqual(kedua["ditulis"], 0)
		self.assertEqual({dt: frappe.db.count(dt) for dt in hitung}, hitung)

	def test_harga_yang_hilang_dihapus(self):
		# A new file without a price: the list's own price goes, the item stays.
		katalog = copy.deepcopy(master.berkas("katalog.json"))
		del katalog["products"][0]["variants"][0]["price_per_ball"]
		asli = master.berkas
		with patch.object(master, "berkas", lambda n: katalog if n == "katalog.json" else asli(n)):
			master.muat()
		self.assertIsNone(harga("GAYUNG-LUMBA-SPR-MRH", "Ball"))
		self.assertEqual(harga("GAYUNG-LUMBA-SPR-MRH", "Lusin"), 20500)
		master.muat()
		self.assertEqual(harga("GAYUNG-LUMBA-SPR-MRH", "Ball"), 410000)
