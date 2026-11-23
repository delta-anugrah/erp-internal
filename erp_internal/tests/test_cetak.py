"""Sales Order and Purchase Order print in Samuel's PO layout ("PO Samuel", the default print format)."""

from datetime import date

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import fmt_money

from erp_internal.cetak import FORMAT_CETAK, tanggal_panjang
from erp_internal.setup import gudang
from erp_internal.tests.utils import (
	buat_barang,
	buat_pelanggan,
	buat_pemasok,
	buat_perusahaan,
	daftar_harga,
	lampirkan,
	tahun_fiskal,
)


class TestCetak(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		tahun_fiskal(date(2026, 11, 1))
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.jadi = gudang(cls.pabrik, "Gudang Barang Jadi")
		cls.tutup = buat_barang("_UJI-TUTUP", "Barang Jadi")
		cls.bahan = buat_barang("_UJI-BIJI-CT", "Bahan Baku", "Kg")
		cls.pelanggan = buat_pelanggan("_Uji Pelanggan")
		cls.pemasok = buat_pemasok("_Uji Pemasok")

	def pesanan_jual(
		self, qty: float, rate: float, kirim: date, po_no: str | None = None, baris: int = 1, **lain
	):
		so = frappe.get_doc(
			{
				"doctype": "Sales Order",
				"company": self.pabrik,
				"customer": self.pelanggan,
				"currency": "IDR",
				"selling_price_list": daftar_harga("_Uji Harga Jual", jual=True),
				"transaction_date": date(2026, 11, 20),
				"delivery_date": kirim,
				"po_no": po_no,
				**lain,
				"items": [
					{
						"item_code": self.tutup,
						"qty": qty,
						"rate": rate,
						"delivery_date": kirim,
						"warehouse": self.jadi,
					}
					for _i in range(baris)
				],
			}
		).insert(ignore_permissions=True)
		lampirkan("Sales Order", so.name)
		so.submit()
		return so

	def pesanan_beli(self, qty: float, rate: float, kirim: date):
		po = frappe.get_doc(
			{
				"doctype": "Purchase Order",
				"company": self.pabrik,
				"supplier": self.pemasok,
				"currency": "IDR",
				"buying_price_list": daftar_harga("_Uji Harga Beli", jual=False),
				"transaction_date": date(2026, 11, 20),
				"schedule_date": kirim,
				"items": [
					{
						"item_code": self.bahan,
						"qty": qty,
						"rate": rate,
						"warehouse": gudang(self.pabrik, "Gudang Bahan Baku"),
						"schedule_date": kirim,
					}
				],
			}
		).insert(ignore_permissions=True)
		lampirkan("Purchase Order", po.name)
		po.submit()
		return po

	def test_tanggal_panjang(self):
		self.assertEqual(tanggal_panjang(date(2026, 11, 27)), "27 November 2026")
		self.assertEqual(tanggal_panjang(date(2026, 8, 1)), "1 Agustus 2026")
		self.assertEqual(tanggal_panjang("2026-12-05"), "5 Desember 2026")

	def test_po_samuel(self):
		so = self.pesanan_jual(400_000, 24, date(2026, 11, 27))
		html = frappe.get_print("Sales Order", so.name, print_format="PO Samuel")
		for teks in (
			"NO.",
			"ORDER",
			"QTY",
			"SATUAN",
			"TGL KIRIM",
			"HARGA",
			"400.000",
			"PCS",
			"27 November 2026",
			"@24/pcs",
			"Rp. 9.600.000,00",
			"PURCHASE ORDER",
		):
			self.assertIn(teks, html)
		# no customer PO number: the document's own name stands in
		self.assertIn(so.name, html)

	def test_po_samuel_beberapa_baris_dan_pajak(self):
		so = self.pesanan_jual(
			1000, 24.5, date(2026, 12, 5), po_no="PO <b>X</b>", baris=2, discount_amount=1000
		)
		self.assertEqual(so.grand_total, 1000 * 24.5 * 2 - 1000)
		html = frappe.get_print("Sales Order", so.name, print_format="PO Samuel")
		self.assertIn("@24,5/pcs", html)
		self.assertIn("5 Desember 2026", html)
		self.assertEqual(html.count("@24,5/pcs"), 2)
		self.assertIn("Rp. " + fmt_money(so.grand_total, 2), html)
		# record values are escaped
		self.assertIn("PO &lt;b&gt;X&lt;/b&gt;", html)
		self.assertNotIn("PO <b>X</b>", html)

	def test_po_samuel_beli(self):
		po = self.pesanan_beli(250, 15000, date(2026, 11, 30))
		html = frappe.get_print("Purchase Order", po.name, print_format="PO Samuel Beli")
		for teks in ("250", "KG", "30 November 2026", "@15.000/kg", "Rp. 3.750.000,00", po.name):
			self.assertIn(teks, html)

	def test_format_bawaan(self):
		for dt, nama in FORMAT_CETAK.items():
			self.assertEqual(frappe.get_meta(dt).default_print_format, nama)
			self.assertEqual(frappe.db.get_value("Print Format", nama, "doc_type"), dt)
			self.assertEqual(frappe.db.get_value("Print Format", nama, "standard"), "Yes")
