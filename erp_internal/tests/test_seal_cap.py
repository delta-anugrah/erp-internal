"""The Seal Cap line (spec A6): Samuel's table loaded by `master.muat` (variants, brands, packing, pigments,
customer), the price that follows the Sales Order line's machine, the Work Order taking that machine, and the PO
print showing it."""

import copy
import json
from datetime import date
from unittest.mock import patch

import frappe
from erpnext.controllers.item_variant import get_variant
from frappe.tests import IntegrationTestCase

from erp_internal import kelengkapan, master, seal_cap
from erp_internal.penjualan import HARGA_BAHAN
from erp_internal.planning.kapasitas import TEMPLATE_PIGMEN, kapasitas, kemasan, pigmen
from erp_internal.setup import gudang
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_perusahaan,
	daftar_harga,
	lampirkan,
	tahun_fiskal,
)

TANGGAL = date(2026, 11, 24)


def varian(merk: str) -> str:
	baris = next(b for b in master.berkas("seal_cap.json")["baris"] if b["merk"] == merk)
	return get_variant(seal_cap.TEMPLATE, {"Merk": merk, "Warna": baris["warna"]})


class TestSealCap(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		tahun_fiskal(TANGGAL)
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		master.muat()
		cls.data = master.berkas("seal_cap.json")

	def setUp(self):
		frappe.db.savepoint("seal_cap")
		self.addCleanup(frappe.db.rollback, save_point="seal_cap")

	def pesanan(self, item: str, mesin: str | None, submit: bool = False):
		so = frappe.get_doc(
			{
				"doctype": "Sales Order",
				"company": self.pabrik,
				"customer": self.data["pelanggan"],
				"currency": "IDR",
				"selling_price_list": daftar_harga("_Uji Harga Jual", jual=True),
				"transaction_date": TANGGAL,
				"delivery_date": date(2026, 12, 1),
				"items": [
					{
						"item_code": item,
						"erp_mesin": mesin,
						"qty": 20000,
						"delivery_date": date(2026, 12, 1),
						"warehouse": gudang(self.pabrik, "Gudang Barang Jadi"),
					}
				],
			}
		).insert(ignore_permissions=True)
		if submit:
			lampirkan("Sales Order", so.name)
			so.submit()
		return so

	def test_varian(self):
		self.assertEqual(frappe.db.count("Item", {"variant_of": seal_cap.TEMPLATE}), 17)
		self.assertEqual(
			frappe.db.get_value("Item", seal_cap.TEMPLATE, ["item_name", "stock_uom"]), ("Seal Cap", "Pcs")
		)
		for b in self.data["baris"]:
			kode = varian(b["merk"])
			self.assertTrue(kode, b["merk"])
			# The Merk attribute is the code; no Brand on the variant (a template save would copy its own over it).
			self.assertFalse(frappe.db.get_value("Item", kode, "brand"), b["merk"])
		for merk in ("MHG", "SE", "RPE", "CN", "PT CN", "DBI"):
			self.assertTrue(frappe.db.exists("Brand", merk), merk)

	def test_kemasan(self):
		self.assertEqual(kemasan(varian("NKP")), [("Plastik 30x45", 560), ("Karung", 19600)])
		self.assertEqual(kemasan(varian("NDY")), [("Plastik 35x50", 1000), ("Karung", 12000)])
		self.assertEqual(kemasan(varian("MHG")), [("Plastik 35x50", 1000), ("Karung", 20000)])
		self.assertEqual(
			frappe.db.get_value("Item", "Karung", ["item_group", "stock_uom"]), ("Kemasan", "Buah")
		)

	def test_harga_kemasan(self):
		# Samuel 2026-11-25: both bag sizes 500 per piece, a sack 3.500.
		for item, harga in (("Plastik 35x50", 500), ("Plastik 30x45", 500), ("Karung", 3500)):
			self.assertEqual(
				frappe.db.get_value(
					"Item Price",
					{"item_code": item, "price_list": HARGA_BAHAN, "uom": "Buah"},
					"price_list_rate",
				),
				harga,
				item,
			)
			self.assertEqual(frappe.db.get_value("Item", item, "valuation_rate"), harga, item)

	def test_harga_kemasan_admin_tetap(self):
		frappe.db.set_value(
			"Item Price", {"item_code": "Karung", "price_list": HARGA_BAHAN}, "price_list_rate", 4000
		)
		frappe.db.set_value("Item", "Karung", "valuation_rate", 4000)
		master.muat()
		self.assertEqual(
			frappe.db.get_value(
				"Item Price", {"item_code": "Karung", "price_list": HARGA_BAHAN}, "price_list_rate"
			),
			4000,
		)
		self.assertEqual(frappe.db.get_value("Item", "Karung", "valuation_rate"), 4000)

	def test_pigmen(self):
		self.assertEqual(pigmen(varian("MHG"))[1], 1)
		self.assertIsNone(pigmen(varian("NKP")))  # Neutral: no pigment
		for pg in frappe.get_all("Item", {"variant_of": TEMPLATE_PIGMEN}, pluck="name"):
			self.assertEqual(
				frappe.db.get_value(
					"Item Price", {"item_code": pg, "price_list": HARGA_BAHAN, "uom": "Kg"}, "price_list_rate"
				),
				350000,
				pg,
			)

	def test_harga_pigmen_admin_tetap(self):
		pg = pigmen(varian("MHG"))[0]
		frappe.db.set_value(
			"Item Price", {"item_code": pg, "price_list": HARGA_BAHAN}, "price_list_rate", 400000
		)
		master.muat()
		self.assertEqual(
			frappe.db.get_value(
				"Item Price", {"item_code": pg, "price_list": HARGA_BAHAN}, "price_list_rate"
			),
			400000,
		)

	def test_pelanggan(self):
		self.assertTrue(frappe.db.exists("Customer", self.data["pelanggan"]))

	def test_mesin_14_aktif(self):
		self.assertEqual(frappe.db.get_value("Workstation", "Mesin 14", "disabled"), 0)

	def test_harga_terkunci_setelah_submit(self):
		from erpnext.controllers.accounts_controller import update_child_qty_rate

		so = self.pesanan(varian("MHG"), "Mesin 04", submit=True)
		d = so.items[0]

		def ubah(rate, qty=20000):
			update_child_qty_rate(
				"Sales Order",
				json.dumps(
					[
						{
							"docname": d.name,
							"item_code": d.item_code,
							"qty": qty,
							"rate": rate,
							"conversion_factor": 1,
							"uom": d.uom,
							"delivery_date": str(d.delivery_date),
						}
					]
				),
				so.name,
			)

		with self.assertRaisesRegex(frappe.ValidationError, "the price is 24"):
			ubah(30)
		ubah(24, qty=30000)  # more pieces at the machine's price: fine
		self.assertEqual(frappe.db.get_value("Sales Order", so.name, "grand_total"), 720000)

	def test_harga_ikut_mesin(self):
		so = self.pesanan(varian("MHG"), "Mesin 04")
		self.assertEqual((so.items[0].rate, so.items[0].amount), (24, 480000))
		so.items[0].margin_type, so.items[0].margin_rate_or_amount = "Amount", 5
		so.save()
		self.assertEqual((so.items[0].rate, so.items[0].margin_rate_or_amount), (24, 0))
		so.items[0].erp_mesin = "Mesin 14"
		so.save()
		self.assertEqual((so.items[0].rate, so.grand_total), (23, 460000))
		# The form's call when the machine is picked.
		self.assertEqual(seal_cap.harga(varian("MHG"), "Mesin 04"), 24)
		self.assertIsNone(seal_cap.harga(varian("MHG"), "Mesin 02"))
		self.assertIsNone(seal_cap.harga("_UJI-SC-LAIN", "Mesin 04"))

	def test_cari_mesin(self):
		# The Sales Order line's machine list: a Seal Cap only on its priced machines, another item on any.
		def cari(item, txt=""):
			return [m for (m,) in seal_cap.cari_mesin("Workstation", txt, "name", 0, 50, {"item": item})]

		self.assertEqual(cari(varian("MHG")), ["Mesin 04", "Mesin 14"])
		self.assertEqual(cari(varian("MHG"), "14"), ["Mesin 14"])
		lain = cari(buat_barang("_UJI-SC-LAIN", "Barang Jadi"))
		self.assertIn("Mesin 02", lain)
		self.assertGreater(len(lain), 2)

	def test_tanpa_mesin_ditolak(self):
		with self.assertRaisesRegex(frappe.ValidationError, "pick the machine"):
			self.pesanan(varian("MHG"), None)
		with self.assertRaisesRegex(frappe.ValidationError, "Mesin 02"):
			self.pesanan(varian("MHG"), "Mesin 02")

	def test_barang_lain_tidak_terpengaruh(self):
		lain = buat_barang("_UJI-SC-LAIN", "Barang Jadi")
		so = self.pesanan(lain, None)
		so.items[0].rate = 5000
		so.save()
		self.assertEqual(so.items[0].rate, 5000)

	def test_work_order_ikut_mesin(self):
		from erpnext.selling.doctype.sales_order.sales_order import make_work_orders

		kode = varian("GJP")
		bom = buat_bom(kode, {buat_barang("_UJI-SC-BIJI", "Bahan Baku", "Kg"): 0.002}, company=self.pabrik)
		so = self.pesanan(kode, "Mesin 14", submit=True)
		baris = so.items[0]
		wo = make_work_orders(
			json.dumps(
				{
					"items": [
						{
							"item_code": kode,
							"bom": bom,
							"pending_qty": 20000,
							"sales_order_item": baris.name,
							"warehouse": baris.warehouse,
							"description": baris.description,
						}
					]
				}
			),
			so.name,
			self.pabrik,
		)[0]
		self.assertEqual(frappe.db.get_value("Work Order", wo, "erp_mesin"), "Mesin 14")

	def test_cetak(self):
		so = self.pesanan(varian("MHG"), "Mesin 04", submit=True)
		html = frappe.get_print("Sales Order", so.name, print_format="PO Samuel")
		self.assertIn(" - Mesin 04", html)
		self.assertIn("@24/pcs", html)

	def test_kelengkapan(self):
		baris = kelengkapan.periksa(company=self.pabrik, hari_ini=TANGGAL, item=seal_cap.TEMPLATE)
		self.assertFalse([r for r in baris if r["cek"] == "pigmen"])  # Neutral needs none, the rest have one
		self.assertFalse([r for r in baris if r["cek"] == "harga"])  # the price follows the machine
		self.assertFalse([r for r in baris if r["cek"] == "kapasitas"])  # rows on Mesin 04 and 14

	def test_kapasitas_tanpa_bahan(self):
		# A file without the material (or the weight) makes no row; a note says what is missing.
		k = {**self.data["kapasitas"], "material": None, "machines": ["Mesin 05"]}
		hasil = master.Hasil()
		seal_cap._kapasitas(k, hasil)
		self.assertEqual(hasil.ditulis, 0)
		self.assertIn(
			f"{seal_cap.TEMPLATE}: no Machine Capacity yet (material missing in seal_cap.json)", hasil.catatan
		)
		self.assertFalse(
			frappe.db.exists("Machine Capacity", {"item": seal_cap.TEMPLATE, "workstation": "Mesin 05"})
		)

	def test_bahan(self):
		self.assertEqual(
			frappe.db.get_value("Item", "BB-SEAL-CAP", ["item_group", "stock_uom", "valuation_rate"]),
			("Bahan Baku", "Kg", 13500),
		)
		self.assertEqual(
			frappe.db.get_value(
				"Item Price", {"item_code": "BB-SEAL-CAP", "price_list": HARGA_BAHAN}, "price_list_rate"
			),
			13500,
		)

	def bom(self, merk: str, mesin: str) -> dict:
		bom = frappe.get_doc(
			"BOM", {"item": varian(merk), "erp_mesin": mesin, "is_active": 1, "docstatus": 1}
		)
		return {i.item_code: i.qty for i in bom.items}

	def test_kapasitas_dan_bom(self):
		# Material, 0.88 g a piece, the colour's pigment at 1 g per kg, a bag and a sack per their pieces.
		mhg = self.bom("MHG", "Mesin 04")
		self.assertEqual(mhg.pop("BB-SEAL-CAP"), 0.00088)
		self.assertEqual(mhg.pop(pigmen(varian("MHG"))[0]), 0.00088)
		self.assertEqual(mhg, {"Plastik 35x50": 0.001, "Karung": 0.00005})
		nkp = self.bom("NKP", "Mesin 14")  # Neutral: no pigment
		self.assertEqual(
			nkp, {"BB-SEAL-CAP": 0.00088, "Plastik 30x45": round(1 / 560, 9), "Karung": round(1 / 19600, 9)}
		)

	def test_work_order_mesin_04(self):
		from erp_internal.tests.utils import buat_wo

		company = frappe.db.get_value("BOM", {"item": varian("MHG"), "erp_mesin": "Mesin 04"}, "company")
		wo = buat_wo(varian("MHG"), "Mesin 04", qty=20000, company=company)
		self.assertEqual(frappe.db.get_value("Work Order", wo, ["docstatus", "erp_mesin"]), (1, "Mesin 04"))

	def test_kapasitas_ada(self):
		for mesin in ("Mesin 04", "Mesin 14"):
			row = frappe.db.get_value(
				"Machine Capacity",
				{"item": seal_cap.TEMPLATE, "workstation": mesin},
				["cavities", "cycle_time", "part_weight", "runner_weight", "material"],
				as_dict=True,
			)
			self.assertEqual(
				(row.cavities, row.cycle_time, row.part_weight, row.runner_weight), (20, 14, 0.88, 0), mesin
			)
			self.assertTrue(kapasitas(varian("NKP"), mesin), mesin)

	def test_kedua_kali_tidak_menulis(self):
		self.assertEqual(master.muat()["ditulis"], 0)
