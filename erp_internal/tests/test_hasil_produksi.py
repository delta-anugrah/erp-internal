"""Production Entry: one machine's output per shift moves good pieces to Gudang Barang Jadi and rejects to
Gudang Reject, consuming material for both, while only the good pieces count toward the Work Order."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, today

from erp_internal.setup import ALASAN_REJECT, SHIFT_PABRIK, gudang, jam_shift
from erp_internal.tampilan import USER
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_hasil,
	buat_mesin,
	buat_pengguna,
	buat_perusahaan,
	stok_awal,
)

JADI, PP = "_UJI-PE-EMBER", "_UJI-PE-PP"


def stok(kode: str, wh: str) -> float:
	return frappe.db.get_value("Bin", {"item_code": kode, "warehouse": wh}, "actual_qty") or 0


class TestHasilProduksi(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		buat_barang(JADI, "Barang Jadi")
		buat_barang(PP, "Bahan Baku", satuan="Kg")
		cls.bom = buat_bom(JADI, {PP: 0.05}, company=cls.pabrik)
		cls.mesin = buat_mesin(41)
		cls.mesin_lain = buat_mesin(42)
		cls.jadi = gudang(cls.pabrik, "Gudang Barang Jadi")
		cls.reject = gudang(cls.pabrik, "Gudang Reject")
		cls.sumber = gudang(cls.pabrik, "Gudang Bahan Baku")
		cls.produksi = gudang(cls.pabrik, "Gudang Produksi")

	def setUp(self):
		frappe.db.savepoint("hasil_produksi")
		self.addCleanup(frappe.db.rollback, save_point="hasil_produksi")
		self.addCleanup(frappe.set_user, "Administrator")
		stok_awal(self.pabrik, PP, 100, "Gudang Bahan Baku")

	def order(self, qty: float = 1000, skip_transfer: int = 1) -> str:
		wo = frappe.get_doc(
			{
				"doctype": "Work Order",
				"production_item": JADI,
				"bom_no": self.bom,
				"qty": qty,
				"company": self.pabrik,
				"erp_mesin": self.mesin,
				"skip_transfer": skip_transfer,
			}
		).insert()
		wo.submit()
		return wo.name

	def test_bagus_dan_reject(self):
		wo = self.order()
		j0, r0, p0 = stok(JADI, self.jadi), stok(JADI, self.reject), stok(PP, self.sumber)
		pe = buat_hasil(wo, good=300, rejects={"Short Shot": 20, "Flashing": 5})
		self.assertEqual(pe.reject_qty, 25)
		self.assertEqual(pe.item, JADI)
		self.assertEqual(pe.hours, jam_shift("Shift 1"))
		self.assertEqual(stok(JADI, self.jadi) - j0, 300)
		self.assertEqual(stok(JADI, self.reject) - r0, 25)
		self.assertAlmostEqual(p0 - stok(PP, self.sumber), 325 * 0.05)
		self.assertEqual(frappe.db.get_value("Work Order", wo, "produced_qty"), 300)
		self.assertEqual(frappe.db.get_value("Stock Entry", pe.manufacture_entry, "purpose"), "Manufacture")
		self.assertEqual(frappe.db.get_value("Stock Entry", pe.reject_entry, "purpose"), "Repack")
		# Process loss is never used: it would count the rejects toward the order.
		self.assertFalse(frappe.db.get_value("Stock Entry", pe.manufacture_entry, "process_loss_qty"))

	def test_mesin_diganti_setelah_submit(self):
		# A submitted order's machine can change (a breakdown); output then goes on the new machine only.
		wo = self.order()
		pegawai = buat_pengguna("_uji.pe.user@example.com", USER, USER, self.pabrik)
		frappe.set_user(pegawai)
		doc = frappe.get_doc("Work Order", wo)
		doc.erp_mesin = self.mesin_lain
		doc.save()
		self.assertEqual(frappe.db.get_value("Work Order", wo, "erp_mesin"), self.mesin_lain)
		self.assertEqual(frappe.db.get_value("Work Order", wo, "docstatus"), 1)
		pe = buat_hasil(wo, good=5)
		self.assertEqual(pe.workstation, self.mesin_lain)
		self.assertEqual(pe.docstatus, 1)
		with self.assertRaises(frappe.ValidationError):
			buat_hasil(wo, good=5, workstation=self.mesin)

	def test_hanya_bagus_atau_hanya_reject(self):
		wo = self.order()
		pe = buat_hasil(wo, good=10)
		self.assertTrue(pe.manufacture_entry)
		self.assertFalse(pe.reject_entry)
		pe = buat_hasil(wo, good=0, rejects={"Bubble": 4})
		self.assertFalse(pe.manufacture_entry)
		self.assertTrue(pe.reject_entry)
		self.assertEqual(frappe.db.get_value("Work Order", wo, "produced_qty"), 10)

	def test_reject_tidak_menyelesaikan(self):
		wo = self.order()
		buat_hasil(wo, good=990, rejects={"Pecah / Retak": 10})
		self.assertEqual(frappe.db.get_value("Work Order", wo, "status"), "In Process")

	def test_dengan_transfer(self):
		# Rejects take material from Gudang Bahan Baku, never from what was transferred for the good pieces: a
		# fully transferred order still completes on its good pieces.
		from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry

		w0 = stok(PP, self.produksi)
		wo = self.order(skip_transfer=0)
		frappe.get_doc(make_stock_entry(wo, "Material Transfer for Manufacture", 1000)).insert().submit()
		s0, r0 = stok(PP, self.sumber), stok(JADI, self.reject)
		buat_hasil(wo, good=975, rejects={"Short Shot": 20, "Flashing": 5})
		self.assertAlmostEqual(s0 - stok(PP, self.sumber), 25 * 0.05)
		self.assertEqual(stok(JADI, self.reject) - r0, 25)
		self.assertEqual(frappe.db.get_value("Work Order", wo, "status"), "In Process")
		buat_hasil(wo, good=25)
		self.assertEqual(
			frappe.db.get_value("Work Order", wo, ["produced_qty", "status"]), (1000, "Completed")
		)
		self.assertAlmostEqual(stok(PP, self.produksi), w0)
		self.assertAlmostEqual(s0 - stok(PP, self.sumber), 25 * 0.05)

	def test_batal(self):
		wo = self.order()
		sebelum = (stok(JADI, self.jadi), stok(JADI, self.reject), stok(PP, self.sumber))
		pe = buat_hasil(wo, good=300, rejects={"Short Shot": 20})
		pe.cancel()
		self.assertEqual((stok(JADI, self.jadi), stok(JADI, self.reject), stok(PP, self.sumber)), sebelum)
		self.assertEqual(frappe.db.get_value("Work Order", wo, "produced_qty"), 0)
		for se in (pe.manufacture_entry, pe.reject_entry):
			self.assertEqual(frappe.db.get_value("Stock Entry", se, "docstatus"), 2)

	def test_batal_order_berhenti(self):
		from erpnext.manufacturing.doctype.work_order.work_order import stop_unstop

		wo = self.order()
		pe = buat_hasil(wo, good=10, rejects={"Bubble": 1})
		stop_unstop(wo, "Stopped")
		with self.assertRaisesRegex(frappe.ValidationError, "Re-open Work Order"):
			pe.cancel()
		self.assertEqual(frappe.db.get_value("Stock Entry", pe.manufacture_entry, "docstatus"), 1)

	def test_tanpa_order(self):
		dasar = {"doctype": "Production Entry", "company": self.pabrik, "workstation": self.mesin}
		dasar |= {"shift": "Shift 1", "good_qty": 1}
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(dasar).insert()
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc({**dasar, "work_order": "_UJI-TIDAK-ADA"}).insert()

	def test_user_biasa_bisa_ajukan(self):
		wo = self.order()
		frappe.set_user(buat_pengguna("_uji.pe@example.com", "User", "User", self.pabrik))
		pe = buat_hasil(wo, good=10, rejects={"Bubble": 1})
		self.assertEqual(pe.docstatus, 1)
		for se in (pe.manufacture_entry, pe.reject_entry):
			self.assertEqual(frappe.db.get_value("Stock Entry", se, "docstatus"), 1)
		pe.cancel()
		self.assertEqual(frappe.db.get_value("Stock Entry", pe.manufacture_entry, "docstatus"), 2)

	def test_ditolak(self):
		from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry

		wo = self.order()
		selesai = self.order(qty=10)
		frappe.get_doc(make_stock_entry(selesai, "Manufacture", 10)).insert().submit()
		self.assertEqual(frappe.db.get_value("Work Order", selesai, "status"), "Completed")
		if not frappe.db.exists("Reject Reason", "_Uji Mati"):
			frappe.get_doc({"doctype": "Reject Reason", "reason_name": "_Uji Mati", "disabled": 1}).insert()
		if not frappe.db.exists("Workstation", "_Uji Bukan Mesin"):
			frappe.get_doc({"doctype": "Workstation", "workstation_name": "_Uji Bukan Mesin"}).insert()

		draf = frappe.get_doc(
			{
				"doctype": "Work Order",
				"production_item": JADI,
				"bom_no": self.bom,
				"qty": 5,
				"company": self.pabrik,
			}
		).insert()
		lain = buat_perusahaan("_Uji Pabrik 2", "_UP2")
		bom_lain = buat_bom(JADI, {PP: 0.05}, company=lain)
		wo_lain = frappe.get_doc(
			{"doctype": "Work Order", "production_item": JADI, "bom_no": bom_lain, "qty": 5, "company": lain}
		).insert()
		wo_lain.submit()
		kasus = {
			"other company": (wo_lain.name, 1, None, {"company": self.pabrik, "workstation": self.mesin}),
			"draft order": (draf.name, 1, None, {"workstation": self.mesin}),
			"other machine": (wo, 10, None, {"workstation": self.mesin_lain}),
			"not a numbered machine": (wo, 10, None, {"workstation": "_Uji Bukan Mesin"}),
			"nothing": (wo, 0, None, {}),
			"negative good": (wo, -5, {"Bubble": 10}, {}),
			"reject row 0": (wo, 10, {"Bubble": 0}, {}),
			"tomorrow": (wo, 10, None, {"posting_date": add_days(today(), 1)}),
			"25 hours": (wo, 10, None, {"hours": 25}),
			"completed order": (selesai, 1, None, {}),
			"disabled reason": (wo, 10, {"_Uji Mati": 1}, {}),
		}
		for nama, (order, good, rejects, lain) in kasus.items():
			with self.subTest(nama):
				frappe.db.savepoint("tolak")
				with self.assertRaises(frappe.ValidationError):
					buat_hasil(order, good=good, rejects=rejects, **lain)
				frappe.db.rollback(save_point="tolak")
		self.assertEqual(frappe.db.get_value("Work Order", wo, "produced_qty"), 0)

	def test_bahan_kurang_gagal(self):
		# Material for the good pieces but not for the rejects: the Repack's refusal fails the whole submit (the
		# request's transaction then undoes the Manufacture too), it is not swallowed.
		wo = self.order()
		stok_awal(self.pabrik, PP, 10, "Gudang Bahan Baku")
		j0 = stok(JADI, self.jadi)
		with self.assertRaises(frappe.ValidationError):
			buat_hasil(wo, good=150, rejects={"Bubble": 100})
		self.assertEqual(stok(JADI, self.jadi), j0)
		self.assertFalse(frappe.db.exists("Stock Entry", {"work_order": wo}))
		self.assertEqual(frappe.db.get_value("Work Order", wo, "produced_qty"), 0)

	def test_alasan_bawaan(self):
		self.assertTrue(set(ALASAN_REJECT) <= set(frappe.get_all("Reject Reason", pluck="name")))

	def test_pilihan_shift(self):
		pilihan = frappe.get_meta("Production Entry").get_field("shift").options.split("\n")
		self.assertEqual([p for p in pilihan if p], [nama for nama, _jam in SHIFT_PABRIK])
		self.assertEqual(jam_shift("Shift 2"), dict(SHIFT_PABRIK)["Shift 2"])

	def test_shift_ikut_tabel(self):
		# A changed SHIFT_PABRIK reaches the form through a Property Setter on the next migrate.
		from unittest.mock import patch

		from erp_internal import setup

		self.addCleanup(frappe.clear_cache, doctype="Production Entry")
		with patch.object(setup, "SHIFT_PABRIK", (("Pagi", 12), ("Malam", 12))):
			setup._shift_pabrik()
			self.assertEqual(frappe.get_meta("Production Entry").get_field("shift").options, "\nPagi\nMalam")
			self.assertEqual(setup.jam_shift("Pagi"), 12)
			jumlah = frappe.db.count("Property Setter", {"doc_type": "Production Entry"})
			setup._shift_pabrik()
			self.assertEqual(frappe.db.count("Property Setter", {"doc_type": "Production Entry"}), jumlah)
