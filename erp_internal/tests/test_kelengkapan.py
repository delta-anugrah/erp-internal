"""Missing data notices (Abel 2026-11-24): each check of `kelengkapan.CEK`, the Missing Data report, the Item form's
`untuk_item`, the Work Order's `untuk_produksi` and the Monthly Expenses message."""

from datetime import date

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal import kelengkapan
from erp_internal.planning.doctype.expense_entry.expense_entry import PER_SHIFT
from erp_internal.planning.report.missing_data.missing_data import execute
from erp_internal.planning.report.monthly_expenses import monthly_expenses
from erp_internal.tampilan import ADMIN, PRODUKSI
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_kapasitas,
	buat_kemasan,
	buat_mesin,
	buat_pengguna,
	buat_perusahaan,
	buat_pigmen,
	buat_varian,
	buat_wo,
	daftar_harga,
	isi_kemasan,
	stok_awal,
)

TEMPLATE, WARNA, KEMASAN = "_UJI-KL-EMBER", "_KL Merah", "_UJI-KL-DUS"
HARI = date(2026, 11, 24)


class TestKelengkapan(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		# Two Jenis of one colour without a pigment, and one clear variant (Bening needs none).
		cls.varian = buat_varian(TEMPLATE, ["_KLA", "_KLB"], [WARNA, "Bening"])
		cls.merah = [v for v in cls.varian if v_warna(v) == WARNA]
		buat_kemasan(KEMASAN)
		cls.mesin = buat_mesin(71)

	def setUp(self):
		frappe.db.savepoint("kelengkapan")
		self.addCleanup(frappe.db.rollback, save_point="kelengkapan")
		self.addCleanup(frappe.set_user, "Administrator")
		lama = frappe.db.get_single_value("Selling Settings", "selling_price_list")
		self.addCleanup(frappe.db.set_single_value, "Selling Settings", "selling_price_list", lama)
		self.daftar = daftar_harga("_Uji Harga KL", True)
		frappe.db.set_single_value("Selling Settings", "selling_price_list", self.daftar)
		frappe.db.delete("Expense Entry", {"company": self.pabrik})

	def baris(self, cek, **kw):
		return [r for r in kelengkapan.periksa(company=self.pabrik, hari_ini=HARI, **kw) if r["cek"] == cek]

	def dokumen(self, cek, **kw):
		return [(r["doctype"], r["nama"]) for r in self.baris(cek, **kw)]

	def test_tabel(self):
		kunci = [c["kunci"] for c in kelengkapan.CEK]
		self.assertEqual(kunci, ["kemasan", "pigmen", "harga", "gaji", "kapasitas", "stok"])
		for c in kelengkapan.CEK:
			self.assertTrue(callable(c["fungsi"]))

	def test_kemasan(self):
		# The fix is on the template: flagged once, not per variant.
		baris = [r for r in self.baris("kemasan") if r["nama"] == TEMPLATE]
		self.assertEqual(len(baris), 1)
		self.assertEqual(baris[0]["perbaiki"], {"doctype": "Item", "name": TEMPLATE, "field": "erp_kemasan"})
		self.assertFalse([d for d in self.dokumen("kemasan") if d[1] in self.varian])
		isi_kemasan(TEMPLATE, KEMASAN, 100)
		self.assertNotIn(("Item", TEMPLATE), self.dokumen("kemasan"))

	def test_kemasan_bukan_produk(self):
		# A packing item is never a product.
		self.assertNotIn(("Item", KEMASAN), self.dokumen("kemasan"))

	def test_pigmen(self):
		baris = [r for r in self.baris("pigmen") if WARNA in r["rincian"]]
		self.assertEqual(len(baris), 1)  # one row per colour
		self.assertIn("2", baris[0]["rincian"])  # its two products
		self.assertEqual(
			baris[0]["perbaiki"], {"doctype": "Item", "name": "PIGMEN", "varian": {"Warna": WARNA}}
		)
		self.assertFalse([r for r in self.baris("pigmen") if r["rincian"].startswith("Bening")])
		buat_pigmen(WARNA, 5)
		self.assertFalse([r for r in self.baris("pigmen") if WARNA in r["rincian"]])

	def test_harga(self):
		varian = self.varian[0]
		baris = [r for r in self.baris("harga") if r["nama"] == varian]
		self.assertEqual(len(baris), 1)
		self.assertEqual(
			baris[0]["perbaiki"],
			{"doctype": "Item Price", "baru": {"item_code": varian, "price_list": self.daftar}},
		)
		self.assertNotIn(("Item", TEMPLATE), self.dokumen("harga"))  # a template is not sold
		frappe.get_doc(
			{"doctype": "Item Price", "item_code": varian, "price_list": self.daftar, "price_list_rate": 5000}
		).insert()
		self.assertNotIn(("Item", varian), self.dokumen("harga"))
		self.assertIn(("Item", self.varian[1]), self.dokumen("harga"))  # its sibling still has none

	def gaji(self, sampai=None, mulai=date(2026, 11, 1)):
		frappe.get_doc(
			{
				"doctype": "Expense Entry",
				"company": self.pabrik,
				"posting_date": mulai,
				"category": "Gaji Operator",
				"amount": 105_000,
				"repeat": PER_SHIFT,
				"until": sampai,
			}
		).insert().submit()

	def test_gaji(self):
		baris = self.baris("gaji")
		self.assertEqual(len(baris), 1)
		self.assertEqual(
			baris[0]["perbaiki"],
			{
				"doctype": "Expense Entry",
				"baru": {"category": "Gaji Operator", "repeat": PER_SHIFT, "company": self.pabrik},
			},
		)
		self.gaji(sampai=date(2026, 11, 20))  # ended before today
		self.assertEqual(len(self.baris("gaji")), 1)
		self.gaji(mulai=date(2026, 11, 21))
		self.assertEqual(self.baris("gaji"), [])

	def test_gaji_sampai_hari_ini(self):
		self.gaji(sampai=HARI)
		self.assertEqual(self.baris("gaji"), [])

	def test_kapasitas(self):
		baris = [r for r in self.baris("kapasitas") if r["nama"] == TEMPLATE]
		self.assertEqual(len(baris), 1)
		self.assertEqual(baris[0]["perbaiki"], {"doctype": "Machine Capacity", "baru": {"item": TEMPLATE}})
		buat_kapasitas(TEMPLATE, self.mesin, material=buat_barang("_UJI-KL-PP", "Bahan Baku", satuan="Kg"))
		self.assertNotIn(("Item", TEMPLATE), self.dokumen("kapasitas"))

	def test_stok(self):
		baris = [r for r in self.baris("stok") if r["nama"] == KEMASAN]
		self.assertEqual(len(baris), 1)
		self.assertEqual(baris[0]["perbaiki"]["doctype"], "Purchase Order")
		self.assertEqual(baris[0]["perbaiki"]["baris"], {"items": [{"item_code": KEMASAN}]})
		self.assertNotIn(("Item", TEMPLATE), self.dokumen("stok"))  # a product is no packing
		stok_awal(self.pabrik, KEMASAN, 500, "Gudang Bahan Baku")
		self.assertNotIn(("Item", KEMASAN), self.dokumen("stok"))

	def test_untuk_item(self):
		varian = self.merah[0]
		pesan = kelengkapan.untuk_item(varian)
		self.assertEqual(sorted(p["kunci"] for p in pesan), ["harga", "kapasitas", "kemasan", "pigmen"])
		for p in pesan:
			self.assertTrue(p["pesan"] and p["cara"] and p["perbaiki"])
		# A template lists several variants without a price: the link opens the report for it.
		harga = next(p for p in kelengkapan.untuk_item(TEMPLATE) if p["kunci"] == "harga")
		self.assertEqual(harga["perbaiki"], {"laporan": "Missing Data", "filters": {"item": TEMPLATE}})
		self.assertEqual([p["kunci"] for p in kelengkapan.untuk_item(KEMASAN)], ["stok"])

	def test_untuk_item_izin(self):
		u = buat_pengguna("_uji.kl.produksi@example.com", PRODUKSI, PRODUKSI, self.pabrik)
		frappe.set_user(u)
		with self.assertRaises(frappe.PermissionError):
			kelengkapan.untuk_item(self.varian[0])

	def test_untuk_produksi(self):
		# Produksi reads Work Orders, not Items: the Work Order note shows packing and pigment only.
		item = self.merah[0]
		buat_bom(item, {buat_barang("_UJI-KL-PP", "Bahan Baku", satuan="Kg"): 0.05}, company=self.pabrik)
		wo = buat_wo(item, None, company=self.pabrik)
		u = buat_pengguna("_uji.kl.produksi@example.com", PRODUKSI, PRODUKSI, self.pabrik)
		frappe.set_user(u)
		pesan = kelengkapan.untuk_produksi(wo, item)
		self.assertEqual(sorted(p["kunci"] for p in pesan), ["kemasan", "pigmen"])
		# Only that order's product: another item through it, or a new order, is refused.
		with self.assertRaises(frappe.PermissionError):
			kelengkapan.untuk_produksi(wo, self.varian[0] if self.varian[0] != item else self.varian[1])
		with self.assertRaises(frappe.PermissionError):
			kelengkapan.untuk_produksi("new-work-order-1", item)

	def test_laporan(self):
		kolom, baris = execute({"company": self.pabrik})
		self.assertEqual(
			[k["fieldname"] for k in kolom], ["label", "doctype", "nama", "rincian", "cara", "akibat"]
		)
		self.assertEqual(kolom[2]["fieldtype"], "Dynamic Link")
		milik = [r for r in baris if r["nama"] == TEMPLATE and r["cek"] == "kemasan"]
		self.assertEqual(milik[0]["perbaiki"]["field"], "erp_kemasan")
		_kolom, saring = execute({"company": self.pabrik, "item": TEMPLATE})
		self.assertTrue(saring)
		self.assertFalse([r for r in saring if r["cek"] == "gaji"])  # not about one item
		self.assertTrue(all(r["nama"] in (TEMPLATE, "PIGMEN", *self.varian) for r in saring))

	def test_laporan_hanya_admin(self):
		a = buat_pengguna("_uji.kl.admin@example.com", ADMIN, ADMIN, self.pabrik)
		u = buat_pengguna("_uji.kl.produksi@example.com", PRODUKSI, PRODUKSI, self.pabrik)
		roles = {r.role for r in frappe.get_doc("Report", "Missing Data").roles}
		self.assertEqual(roles, {"System Manager", "ERP Admin"})
		self.assertTrue(set(frappe.get_roles(a)) & roles)
		self.assertFalse(set(frappe.get_roles(u)) & roles)
		frappe.set_user(u)
		self.assertFalse(frappe.get_doc("Report", "Missing Data").is_permitted())
		with self.assertRaises(frappe.PermissionError):
			execute({"company": self.pabrik})
		frappe.set_user(a)
		self.assertTrue(frappe.get_doc("Report", "Missing Data").is_permitted())
		self.assertTrue(execute({"company": self.pabrik})[1])

	def test_pesan_biaya_bulanan(self):
		hasil = monthly_expenses.execute({"company": self.pabrik, "bulan": HARI})
		self.assertEqual(len(hasil), 3)
		self.assertIn("erp-perbaiki", hasil[2])
		self.assertIn("Gaji Operator", hasil[2])
		self.gaji()
		self.assertIsNone(monthly_expenses.execute({"company": self.pabrik, "bulan": HARI})[2])


def v_warna(item: str) -> str:
	return frappe.db.get_value(
		"Item Variant Attribute", {"parent": item, "attribute": "Warna"}, "attribute_value"
	)
