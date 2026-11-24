"""Real documents attached before submit (spec section 7) and the Missing Documents report."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import getdate, today

from erp_internal.lampiran import ada_lampiran, boot, wajib
from erp_internal.planning.report.missing_documents.missing_documents import execute
from erp_internal.setup import gudang
from erp_internal.tests.utils import (
	buat_barang,
	buat_order,
	buat_pelanggan,
	buat_perusahaan,
	daftar_harga,
	lampirkan,
	stok_awal,
	tahun_fiskal,
)


class TestLampiran(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hari = getdate(today())
		tahun_fiskal(cls.hari)
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.kode = buat_barang("_UJI-LAMPIRAN", "Barang Jadi")
		cls.pelanggan = buat_pelanggan("_Uji Pelanggan")
		cls.harga = daftar_harga("_Uji Harga Jual", jual=True)

	def surat_jalan_diajukan(self) -> str:
		"""A Delivery Note made directly and submitted with no attachment."""
		stok_awal(self.pabrik, self.kode, 100, "Gudang Barang Jadi")
		dn = frappe.get_doc(
			{
				"doctype": "Delivery Note",
				"company": self.pabrik,
				"customer": self.pelanggan,
				"currency": "IDR",
				"selling_price_list": self.harga,
				"set_warehouse": gudang(self.pabrik, "Gudang Barang Jadi"),
				"items": [{"item_code": self.kode, "qty": 1, "rate": 10000}],
			}
		).insert(ignore_permissions=True)
		dn.submit()
		return dn.name

	def test_tanpa_lampiran_ditolak(self):
		so = buat_order(self.pabrik, self.pelanggan, self.kode, 5, self.hari, self.hari, submit=False)
		with self.assertRaisesRegex(frappe.ValidationError, "real document"):
			so.submit()
		so.reload()  # a refused submit leaves its in-memory timestamp ahead of the database's
		lampirkan("Sales Order", so.name)
		so.submit()
		self.assertEqual(so.docstatus, 1)

	def test_hanya_material_receipt(self):
		self.assertTrue(wajib(frappe._dict(doctype="Stock Entry", purpose="Material Receipt")))
		self.assertFalse(wajib(frappe._dict(doctype="Stock Entry", purpose="Manufacture")))
		self.assertFalse(wajib(frappe._dict(doctype="Delivery Note")))
		self.assertFalse(wajib(frappe._dict(doctype="Work Order")))

	def test_laporan_surat_jalan_tanpa_lampiran(self):
		dn = self.surat_jalan_diajukan()  # submitted without an attachment
		nama = [r["name"] for r in execute({"company": self.pabrik})[1]]
		self.assertIn(dn, nama)
		lampirkan("Delivery Note", dn)
		self.assertNotIn(dn, [r["name"] for r in execute({"company": self.pabrik})[1]])

	def test_laporan_pesanan_dan_draf(self):
		# A submitted order of the table shows until its file is attached; a draft never shows.
		so = buat_order(self.pabrik, self.pelanggan, self.kode, 5, self.hari, self.hari, submit=False)
		self.assertNotIn(so.name, [r["name"] for r in execute({"company": self.pabrik})[1]])
		lampirkan("Sales Order", so.name)
		so.submit()
		self.assertTrue(ada_lampiran("Sales Order", so.name))
		self.assertNotIn(so.name, [r["name"] for r in execute({"company": self.pabrik})[1]])
		frappe.db.delete("File", {"attached_to_doctype": "Sales Order", "attached_to_name": so.name})
		baris = {r["name"]: r for r in execute({"company": self.pabrik})[1]}
		self.assertEqual(baris[so.name]["doctype"], "Sales Order")
		self.assertEqual(baris[so.name]["tanggal"], self.hari)

	def test_laporan_perlu_perusahaan_dan_izin(self):
		with self.assertRaises(frappe.ValidationError):
			execute({})
		frappe.set_user("Guest")
		try:
			with self.assertRaises(frappe.PermissionError):
				execute({"company": self.pabrik})
		finally:
			frappe.set_user("Administrator")

	def test_izin_laporan(self):
		# Admin and Super Admin follow up from the report; Produksi does not see it.
		from erp_internal.tampilan import ADMIN, PRODUKSI, SUPER_ADMIN
		from erp_internal.tests.test_tampilan import pengguna_profil

		laporan = frappe.get_doc("Report", "Missing Documents")
		for profil, boleh in ((PRODUKSI, False), (ADMIN, True), (SUPER_ADMIN, True)):
			frappe.set_user(pengguna_profil(profil, "lampiran"))
			try:
				self.assertEqual(bool(laporan.is_permitted()), boleh, profil)
				self.assertEqual(frappe.has_permission(laporan.ref_doctype, "report"), boleh, profil)
			finally:
				frappe.set_user("Administrator")

	def test_boot(self):
		bootinfo = frappe._dict()
		boot(bootinfo)
		self.assertIn("Sales Order", bootinfo.erp_lampiran["wajib"])
		self.assertEqual(bootinfo.erp_lampiran["wajib"]["Stock Entry"], ["purpose", ["Material Receipt"]])
		self.assertEqual(bootinfo.erp_lampiran["nanti"], ["Delivery Note"])

	def test_hook_per_tabel(self):
		from erp_internal.lampiran import WAJIB_LAMPIRAN

		for doctype in WAJIB_LAMPIRAN:
			self.assertIn(
				"erp_internal.lampiran.cek_lampiran",
				frappe.get_hooks("doc_events")[doctype]["before_submit"] or "",
				doctype,
			)

	def test_tanggal_untuk_semua(self):
		from erp_internal.lampiran import LAMPIRAN_NANTI, TANGGAL_DOK, WAJIB_LAMPIRAN

		self.assertEqual(set(TANGGAL_DOK), {*WAJIB_LAMPIRAN, *LAMPIRAN_NANTI})
