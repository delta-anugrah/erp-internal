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
			self.assertEqual(frappe.db.get_value("Item", kode, "brand"), b["merk"])
		for merk in ("MHG", "SE", "RPE", "CN", "PT CN", "DBI"):
			self.assertTrue(frappe.db.exists("Brand", merk), merk)

	def test_kemasan(self):
		self.assertEqual(kemasan(varian("NKP")), [("Plastik 30x45", 560), ("Karung", 19600)])
		self.assertEqual(kemasan(varian("NDY")), [("Plastik 35x50", 1000), ("Karung", 12000)])
		self.assertEqual(kemasan(varian("MHG")), [("Plastik 35x50", 1000), ("Karung", 20000)])
		self.assertEqual(
			frappe.db.get_value("Item", "Karung", ["item_group", "stock_uom"]), ("Kemasan", "Buah")
		)

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

	def test_harga_ikut_mesin(self):
		so = self.pesanan(varian("MHG"), "Mesin 04")
		self.assertEqual((so.items[0].rate, so.items[0].amount), (24, 480000))
		so.items[0].erp_mesin = "Mesin 14"
		so.save()
		self.assertEqual((so.items[0].rate, so.grand_total), (23, 460000))
		# The form's call when the machine is picked.
		self.assertEqual(seal_cap.harga(varian("MHG"), "Mesin 04"), 24)
		self.assertIsNone(seal_cap.harga(varian("MHG"), "Mesin 02"))
		self.assertIsNone(seal_cap.harga("_UJI-SC-LAIN", "Mesin 04"))

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
		self.assertTrue([r for r in baris if r["cek"] == "kapasitas"])  # weight and material still asked

	def test_kapasitas_menunggu_berat(self):
		# Cavities, cycle time and weight are known, the material not: no row, a note says why.
		self.assertEqual(self.data["kapasitas"]["part_weight"], 0.88)
		self.assertFalse(frappe.db.exists("Machine Capacity", {"item": seal_cap.TEMPLATE}))
		self.assertIn(
			f"{seal_cap.TEMPLATE}: no Machine Capacity yet (material missing in seal_cap.json)",
			master.muat()["catatan"],
		)

	def test_kapasitas_setelah_berat_diisi(self):
		data = copy.deepcopy(self.data)
		data["kapasitas"]["material"] = buat_barang("_UJI-SC-BIJI", "Bahan Baku", "Kg")
		asli = master.berkas
		with patch.object(master, "berkas", lambda n: data if n == "seal_cap.json" else asli(n)):
			master.muat()
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
