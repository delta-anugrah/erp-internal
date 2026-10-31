"""Sales History: one row per company, item and month (Review Focus 1), and its import."""

from datetime import date

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_months, get_first_day, getdate, today

from erp_internal.tests.utils import buat_barang, buat_perusahaan, impor_csv, riwayat

BARANG_IMPOR = ("_UJI-RW1", "_UJI-RW2")
BARANG_UJI = "_UJI-RIWAYAT"


def berkas(nama: str) -> str:
	return frappe.get_app_path("erp_internal", "tests", "data", nama)


def bersihkan() -> None:
	"""The importer commits, so the rows it made outlive the test's rollback, and so do the rows the
	tests before it made in the same transaction."""
	for nama in frappe.get_all(
		"Sales History", {"item_code": ("in", [*BARANG_IMPOR, BARANG_UJI])}, pluck="name"
	):
		frappe.delete_doc("Sales History", nama, force=1)
	frappe.db.commit()  # nosemgrep


class TestSalesHistory(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.barang = buat_barang(BARANG_UJI, "Barang Jadi")
		for kode in BARANG_IMPOR:
			buat_barang(kode, "Barang Jadi")
		bersihkan()
		cls.addClassCleanup(bersihkan)

	def baru(self, bulan: date, qty: float = 10):
		return frappe.get_doc(
			{
				"doctype": "Sales History",
				"company": self.pabrik,
				"item_code": self.barang,
				"bulan": bulan,
				"qty": qty,
			}
		)

	def test_bulan_jadi_tanggal_1(self):
		doc = self.baru(date(2026, 5, 17)).insert()
		self.assertEqual(getdate(doc.bulan), date(2026, 5, 1))

	def test_judul_barang_dan_bulan(self):
		# The name is a hash; the title users see is the item and the month (Abel, 2026-10-29).
		doc = self.baru(date(2026, 4, 9)).insert()
		self.assertEqual(doc.title, f"{BARANG_UJI} · 04-2026")
		meta = frappe.get_meta("Sales History")
		self.assertEqual(meta.title_field, "title")
		self.assertTrue(meta.show_title_field_in_link)
		self.assertTrue(frappe.get_meta("Machine Capacity").show_title_field_in_link)

	def test_duplikat_ditolak(self):
		# Review Focus 1: the same file imported twice must not double the forecast.
		bulan = get_first_day(add_months(getdate(today()), -2))
		riwayat(self.pabrik, self.barang, bulan, 100)
		self.assertRaises(frappe.UniqueValidationError, self.baru(bulan.replace(day=20)).insert)

	def test_qty_minus_ditolak(self):
		self.assertRaises(frappe.ValidationError, self.baru(date(2026, 4, 1), -1).insert)

	def test_bukan_barang_stok_ditolak(self):
		jasa = buat_barang("_UJI-JASA", "Barang Jadi", is_stock_item=0)
		doc = self.baru(date(2026, 4, 1))
		doc.item_code = jasa
		self.assertRaises(frappe.ValidationError, doc.insert)

	def test_impor_riwayat(self):
		# 2 items x 6 months; the same file again adds nothing and the import is not a success.
		impor = impor_csv("Sales History", berkas("riwayat.csv"))
		self.assertEqual(impor.status, "Success", impor.template_warnings)

		def hitung():
			return frappe.db.count("Sales History", {"item_code": ("in", BARANG_IMPOR)})

		self.assertEqual(hitung(), 12)
		self.assertEqual(
			frappe.db.get_value("Sales History", {"item_code": "_UJI-RW1", "bulan": date(2026, 3, 1)}, "qty"),
			300,
		)
		lagi = impor_csv("Sales History", berkas("riwayat.csv"))
		self.assertNotEqual(lagi.status, "Success")
		self.assertEqual(hitung(), 12)
