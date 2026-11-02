"""The User profile's three daily jobs (Samuel, 2026-11-02): Production Entry, a direct Delivery Note and a
Material Receipt; everything else read only (batas_user.py)."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import getdate, today

from erp_internal.batas_user import HANYA_ADMIN, terbatas
from erp_internal.production_floor import set_status
from erp_internal.setup import gudang
from erp_internal.tampilan import ADMIN, USER
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_hasil,
	buat_mesin,
	buat_pelanggan,
	buat_pengguna,
	buat_perusahaan,
	daftar_harga,
	stok_awal,
	tahun_fiskal,
)

JADI, PP = "_UJI-BU-EMBER", "_UJI-BU-PP"


def stok(kode: str, wh: str) -> float:
	return frappe.db.get_value("Bin", {"item_code": kode, "warehouse": wh}, "actual_qty") or 0


class TestBatasUser(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		tahun_fiskal(getdate(today()))
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		buat_barang(JADI, "Barang Jadi")
		buat_barang(PP, "Bahan Baku", satuan="Kg")
		cls.bom = buat_bom(JADI, {PP: 0.05}, company=cls.pabrik)
		cls.mesin = buat_mesin(43)
		cls.bahan = gudang(cls.pabrik, "Gudang Bahan Baku")
		cls.jadi = gudang(cls.pabrik, "Gudang Barang Jadi")
		cls.user = buat_pengguna("_uji.batas.user@example.com", USER, USER, cls.pabrik)
		cls.admin = buat_pengguna("_uji.batas.admin@example.com", ADMIN, ADMIN, cls.pabrik)

	def setUp(self):
		frappe.db.savepoint("batas_user")
		self.addCleanup(frappe.db.rollback, save_point="batas_user")
		self.addCleanup(frappe.set_user, "Administrator")
		stok_awal(self.pabrik, PP, 100, "Gudang Bahan Baku")

	def entri(self, purpose: str, **baris):
		return frappe.get_doc(
			{
				"doctype": "Stock Entry",
				"company": self.pabrik,
				"purpose": purpose,
				"stock_entry_type": purpose,
				"items": [{"item_code": PP, "qty": 5, "basic_rate": 1000, **baris}],
			}
		)

	def order(self) -> str:
		wo = frappe.get_doc(
			{
				"doctype": "Work Order",
				"production_item": JADI,
				"bom_no": self.bom,
				"qty": 100,
				"company": self.pabrik,
				"erp_mesin": self.mesin,
				"skip_transfer": 1,
			}
		).insert()
		wo.submit()
		return wo.name

	def test_terbatas(self):
		self.assertTrue(terbatas(self.user))
		self.assertFalse(terbatas(self.admin))
		self.assertFalse(terbatas("Administrator"))

	def test_terima_bahan(self):
		# Raw material in without a Purchase Order: a Material Receipt, made and cancelled by the User.
		frappe.set_user(self.user)
		se = self.entri("Material Receipt", t_warehouse=self.bahan).insert()
		se.submit()
		self.assertEqual(stok(PP, self.bahan), 105)
		se.cancel()
		self.assertEqual(stok(PP, self.bahan), 100)

	def test_entri_lain_ditolak(self):
		produksi = gudang(self.pabrik, "Gudang Produksi")
		frappe.set_user(self.user)
		for purpose, baris in (
			("Material Transfer", {"s_warehouse": self.bahan, "t_warehouse": produksi}),
			("Material Issue", {"s_warehouse": self.bahan}),
		):
			with self.assertRaises(frappe.PermissionError, msg=purpose):
				self.entri(purpose, **baris).insert()
		# The Admin may.
		frappe.set_user(self.admin)
		self.entri("Material Issue", s_warehouse=self.bahan).insert().submit()

	def test_hasil_produksi(self):
		# Production Entry makes its Manufacture and Repack entries as the User, and cancels them.
		wo = self.order()
		frappe.set_user(self.user)
		pe = buat_hasil(wo, good=20, rejects={"Short Shot": 2})
		self.assertEqual(frappe.db.get_value("Stock Entry", pe.manufacture_entry, "docstatus"), 1)
		self.assertEqual(frappe.db.get_value("Stock Entry", pe.reject_entry, "owner"), self.user)
		pe.cancel()
		self.assertEqual(frappe.db.get_value("Stock Entry", pe.manufacture_entry, "docstatus"), 2)
		# Not the Manufacture entry on its own.
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(
				frappe.get_attr("erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry")(
					wo, "Manufacture", 1
				)
			).insert()

	def test_surat_jalan(self):
		stok_awal(self.pabrik, JADI, 50, "Gudang Barang Jadi")
		pelanggan = buat_pelanggan("_Uji Pelanggan")
		harga = daftar_harga("_Uji Harga Jual", jual=True)
		frappe.set_user(self.user)
		dn = frappe.get_doc(
			{
				"doctype": "Delivery Note",
				"company": self.pabrik,
				"customer": pelanggan,
				"currency": "IDR",
				"selling_price_list": harga,
				"items": [{"item_code": JADI, "qty": 10, "rate": 5000, "warehouse": self.jadi}],
			}
		).insert()
		dn.submit()
		self.assertEqual(stok(JADI, self.jadi), 40)

	def test_hanya_baca(self):
		# Work Orders, BOMs, items and customers by DocPerm; Stock User's other documents by batas_user.
		frappe.set_user(self.user)
		for dt in ("Work Order", "BOM", "Item", "Customer", "Workstation", "Machine Capacity"):
			self.assertTrue(frappe.has_permission(dt, "read"), dt)
			self.assertFalse(frappe.has_permission(dt, "create"), dt)
		permintaan = frappe.get_doc(
			{
				"doctype": "Material Request",
				"company": self.pabrik,
				"material_request_type": "Purchase",
				"schedule_date": today(),
				"items": [{"item_code": PP, "qty": 5, "warehouse": self.bahan, "schedule_date": today()}],
			}
		)
		with self.assertRaises(frappe.PermissionError):
			permintaan.insert()
		frappe.set_user(self.admin)
		permintaan.insert()

	def test_hook_hanya_admin(self):
		hooks = frappe.get_hooks("has_permission")
		for dt in HANYA_ADMIN:
			self.assertIn("erp_internal.batas_user.boleh_ubah", hooks.get(dt, []), dt)

	def test_status_mesin(self):
		# Samuel 2026-11-02: a User sets a machine's status on the Production Floor, nothing else of it.
		frappe.set_user(self.user)
		self.assertEqual(set_status(self.mesin, "Maintenance")["status"], "Maintenance")
		doc = frappe.get_doc("Workstation", self.mesin)
		doc.description = "_uji"
		with self.assertRaises(frappe.PermissionError):
			doc.save()
