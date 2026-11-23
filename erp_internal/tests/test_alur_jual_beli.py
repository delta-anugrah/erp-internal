"""The factory's sales and purchasing flow: order first, PPN templates, stock without journal entries."""

import frappe
from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_receipt
from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note
from erpnext.stock.doctype.delivery_note.delivery_note import make_sales_invoice
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, getdate, today

from erp_internal.setup import PAJAK, PENGATURAN_ALUR, TARIF_PPN, TEMPLATE_PAJAK, gudang
from erp_internal.tests.utils import (
	buat_barang,
	buat_pelanggan,
	buat_pemasok,
	buat_perusahaan,
	daftar_harga,
	stok_awal,
	tahun_fiskal,
)


def stok(kode: str, warehouse: str) -> float:
	return frappe.db.get_value("Bin", {"item_code": kode, "warehouse": warehouse}, "actual_qty") or 0


class TestAlurJualBeli(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		tahun_fiskal(getdate(today()))
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.jadi = gudang(cls.pabrik, "Gudang Barang Jadi")
		cls.bahan = gudang(cls.pabrik, "Gudang Bahan Baku")
		cls.ember = buat_barang("_UJI-EMBER", "Barang Jadi")
		cls.biji = buat_barang("_UJI-BIJI-PP", "Bahan Baku", "Kg")
		cls.pelanggan = buat_pelanggan("_Uji Pelanggan")
		cls.pemasok = buat_pemasok("_Uji Pemasok")
		cls.harga_jual = daftar_harga("_Uji Harga Jual", jual=True)
		cls.harga_beli = daftar_harga("_Uji Harga Beli", jual=False)

	def pesanan_jual(self, qty: float = 100, rate: float = 10000):
		so = frappe.get_doc(
			{
				"doctype": "Sales Order",
				"company": self.pabrik,
				"customer": self.pelanggan,
				"currency": "IDR",
				"selling_price_list": self.harga_jual,
				"transaction_date": today(),
				"delivery_date": add_days(today(), 7),
				"set_warehouse": self.jadi,
				"items": [{"item_code": self.ember, "qty": qty, "rate": rate, "warehouse": self.jadi}],
			}
		)
		so.insert()
		so.submit()
		return so

	def surat_jalan(self, so):
		dn = make_delivery_note(so.name)
		dn.insert()
		dn.submit()
		return dn

	def test_pengaturan_alur(self):
		for doctype, nilai in PENGATURAN_ALUR.items():
			for field, isi in nilai.items():
				self.assertEqual(frappe.db.get_single_value(doctype, field), isi, f"{doctype}.{field}")
		self.assertEqual(frappe.db.get_value("Company", self.pabrik, "enable_perpetual_inventory"), 0)
		for jenis, (judul, akun) in PAJAK.items():
			tmpl = frappe.get_doc(TEMPLATE_PAJAK[jenis], f"{judul} - _UP")
			self.assertEqual(tmpl.is_default, 0)
			self.assertEqual(
				[(t.charge_type, t.account_head, t.rate) for t in tmpl.taxes],
				[("On Net Total", f"{akun} - _UP", TARIF_PPN)],
			)
			self.assertEqual(frappe.db.get_value("Account", f"{akun} - _UP", "account_type"), "Tax")

	def test_alur_penjualan(self):
		stok_awal(self.pabrik, self.ember, 500, "Gudang Barang Jadi")
		so = self.pesanan_jual(100, 10000)
		dn = self.surat_jalan(so)
		self.assertEqual(stok(self.ember, self.jadi), 400)

		si = make_sales_invoice(dn.name)
		si.taxes_and_charges = f"{PAJAK['jual'][0]} - _UP"
		si.set("taxes", [])
		si.set_taxes()
		si.insert()
		si.submit()
		self.assertEqual(si.grand_total, 1_110_000)
		self.assertEqual(si.items[0].sales_order, so.name)

	def test_surat_jalan_langsung(self):
		# Samuel 2026-11-02: a Delivery Note is made directly, without a Sales Order (setup.PENGATURAN_ALUR).
		stok_awal(self.pabrik, self.ember, 500, "Gudang Barang Jadi")
		dn = self.surat_jalan_langsung(set_warehouse=self.jadi)
		dn.insert()
		dn.submit()
		self.assertEqual(stok(self.ember, self.jadi), 490)

	def surat_jalan_langsung(self, **lain):
		return frappe.get_doc(
			{
				"doctype": "Delivery Note",
				"company": self.pabrik,
				"customer": self.pelanggan,
				"currency": "IDR",
				"selling_price_list": self.harga_jual,
				"items": [{"item_code": self.ember, "qty": 10, "rate": 10000, "warehouse": self.jadi}],
				**lain,
			}
		)

	def test_gudang_kirim_wajib(self):
		# Samuel 2026-11-23: every delivery note names the warehouse it ships from (Gudang Pluit or Gudang
		# Barang Jadi); the lines follow it.
		dn = self.surat_jalan_langsung()
		with self.assertRaises(frappe.MandatoryError):
			dn.insert()
		dn = self.surat_jalan_langsung(set_warehouse=gudang(self.pabrik, "Gudang Pluit"))
		dn.insert()
		self.assertEqual({i.warehouse for i in dn.items}, {dn.set_warehouse})

	def test_alur_pembelian(self):
		sebelum = stok(self.biji, self.bahan)
		po = frappe.get_doc(
			{
				"doctype": "Purchase Order",
				"company": self.pabrik,
				"supplier": self.pemasok,
				"currency": "IDR",
				"buying_price_list": self.harga_beli,
				"transaction_date": today(),
				"schedule_date": add_days(today(), 7),
				"set_warehouse": self.bahan,
				"items": [
					{
						"item_code": self.biji,
						"qty": 50,
						"rate": 15000,
						"warehouse": self.bahan,
						"schedule_date": add_days(today(), 7),
					}
				],
			}
		)
		po.insert()
		po.submit()
		pr = make_purchase_receipt(po.name)
		pr.insert()
		pr.submit()
		self.assertEqual(stok(self.biji, self.bahan), sebelum + 50)

		tanpa_po = frappe.get_doc(
			{
				"doctype": "Purchase Receipt",
				"company": self.pabrik,
				"supplier": self.pemasok,
				"currency": "IDR",
				"buying_price_list": self.harga_beli,
				"items": [{"item_code": self.biji, "qty": 5, "rate": 15000, "warehouse": self.bahan}],
			}
		)
		with self.assertRaisesRegex(frappe.ValidationError, "Purchase Order"):
			tanpa_po.insert()

	def test_tanpa_jurnal_stok(self):
		stok_awal(self.pabrik, self.ember, 500, "Gudang Barang Jadi")
		dn = self.surat_jalan(self.pesanan_jual(20, 10000))
		self.assertEqual(frappe.db.count("GL Entry", {"voucher_no": dn.name}), 0)
