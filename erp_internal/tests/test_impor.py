"""The Data Import templates in docs/impor.md, imported for real. The files sit in tests/data/; their
headers are the v16 exporter's for an English user (docs/impor.md)."""

import csv
import json

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import getdate, today

from erp_internal.tests.utils import buat_barang, buat_perusahaan, impor_csv, tahun_fiskal

BARANG = ("_UJI-B1", "_UJI-B2", "_UJI-B3", "_UJI-SALAH1")
PELANGGAN = ("_Uji Impor Pelanggan 1", "_Uji Impor Pelanggan 2", "_Uji Impor Pelanggan 3")
PEMASOK = ("_Uji Impor Pemasok 1", "_Uji Impor Pemasok 2", "_Uji Impor Pemasok 3")
BARANG_STOK = ("_UJI-S1", "_UJI-S2", "_UJI-S3")


def berkas(nama: str) -> str:
	return frappe.get_app_path("erp_internal", "tests", "data", nama)


def bersihkan() -> None:
	"""Remove what an earlier run imported. The importer commits, so the test rollback does not."""
	for kode in BARANG:
		frappe.delete_doc_if_exists("Item", kode, force=1)
	for nama in PELANGGAN:
		frappe.delete_doc_if_exists("Customer", nama, force=1)
	for nama in PEMASOK:
		frappe.delete_doc_if_exists("Supplier", nama, force=1)
	# An Opening Stock is refused while the item has stock entries, so earlier openings are cancelled.
	for nama in set(
		frappe.get_all(
			"Stock Reconciliation Item", {"item_code": ("in", BARANG_STOK), "docstatus": 1}, pluck="parent"
		)
	):
		frappe.get_doc("Stock Reconciliation", nama).cancel()
	frappe.db.commit()  # nosemgrep


class TestImpor(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		tahun_fiskal(getdate(today()))
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		for kode in BARANG_STOK:
			buat_barang(kode, "Bahan Baku")
		bersihkan()
		cls.addClassCleanup(bersihkan)

	def test_impor_barang(self):
		impor = impor_csv("Item", berkas("barang.csv"))
		self.assertEqual(impor.status, "Success", impor.template_warnings)
		self.assertTrue(all(frappe.db.exists("Item", k) for k in BARANG[:3]))
		self.assertEqual(
			frappe.db.get_value(
				"UOM Conversion Detail", {"parent": "_UJI-B1", "uom": "Karton"}, "conversion_factor"
			),
			24,
		)
		self.assertEqual(frappe.db.get_value("Item", "_UJI-B1", "safety_stock"), 50)

	def test_impor_pelanggan_dan_pemasok(self):
		for doctype, nama, file in (
			("Customer", PELANGGAN, "pelanggan.csv"),
			("Supplier", PEMASOK, "pemasok.csv"),
		):
			impor = impor_csv(doctype, berkas(file))
			self.assertEqual(impor.status, "Success", impor.template_warnings)
			self.assertEqual(frappe.db.count(doctype, {"name": ("in", nama)}), 3, doctype)

	def test_impor_stok_awal(self):
		impor = impor_csv("Stock Reconciliation", berkas("stok_awal.csv"), ajukan=True)
		self.assertEqual(impor.status, "Success", impor.template_warnings)
		with open(berkas("stok_awal.csv")) as f:
			for baris in csv.DictReader(f):
				kode, gudang = baris["Item Code (Items)"], baris["Warehouse (Items)"]
				qty = frappe.db.get_value("Bin", {"item_code": kode, "warehouse": gudang}, "actual_qty")
				self.assertEqual(qty, float(baris["Quantity (Items)"]), kode)

	def test_impor_salah_terbaca(self):
		# v16 checks every link before importing: an unknown Item Group stops the whole file (status back
		# to Pending) and the warning names the value, the field and the sheet row (row 2: the first data
		# row under the header).
		impor = impor_csv("Item", berkas("barang_salah.csv"))
		self.assertNotEqual(impor.status, "Success")
		pesan = " ".join(w["message"] for w in json.loads(impor.template_warnings or "[]"))
		self.assertIn("_Tidak Ada Grup", pesan)
		self.assertIn("Item Group", pesan)
		self.assertIn("row 2", pesan)
		self.assertFalse(frappe.db.exists("Item", "_UJI-SALAH1"))
