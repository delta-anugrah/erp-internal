"""Production Floor server side: the machine snapshot, the status change and the realtime nudge."""

from unittest.mock import call, patch

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal.lantai import data, ubah_status
from erp_internal.setup import FIELD_WO_MESIN, pastikan_setup
from erp_internal.tests.utils import buat_barang, buat_bom, buat_pengguna, buat_perusahaan

JADI, BAHAN = "_UJI-LNT-JADI", "_UJI-LNT-BAHAN"
PREFIKS = "_Uji Lantai "
PERAN_PRODUKSI = "Manufacturing User"


def buat_mesin(nama: str, nomor: int, status: str = "Idle", **field) -> str:
	"""Get or create a machine Workstation (like `master._mesin`) with that number and status."""
	nama = PREFIKS + nama
	nilai = {
		"erp_nomor": nomor,
		"erp_merek": "Merek",
		"erp_model": f"M-{nomor}",
		"erp_tonase": 100 + nomor,
		"erp_tahun": 2010 + nomor,
		"erp_negara": "CHINA",
		"status": status,
		**field,
	}
	if frappe.db.exists("Workstation", nama):
		frappe.db.set_value("Workstation", nama, nilai)
	else:
		frappe.get_doc({"doctype": "Workstation", "workstation_name": nama, **nilai}).insert(
			ignore_permissions=True
		)
	return nama


def buat_wo(company: str, mesin: str, qty: float = 100, ajukan: bool = True):
	wo = frappe.get_doc(
		{
			"doctype": "Work Order",
			"production_item": JADI,
			"bom_no": frappe.db.get_value("BOM", {"item": JADI, "is_default": 1, "docstatus": 1}),
			"qty": qty,
			"company": company,
			"erp_mesin": mesin,
		}
	).insert(ignore_permissions=True)
	if ajukan:
		wo.submit()
	return wo


class TestLantai(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		buat_barang(JADI, "Barang Jadi")
		buat_barang(BAHAN, "Bahan Baku", satuan="Kg")
		buat_bom(JADI, {BAHAN: 1}, company=cls.pabrik)
		cls.operator = buat_pengguna("lantai.operator@example.com", None, None, cls.pabrik)
		frappe.get_doc("User", cls.operator).add_roles(PERAN_PRODUKSI)
		cls.tamu = buat_pengguna("lantai.tamu@example.com", None, None, cls.pabrik)

	def setUp(self):
		frappe.set_user("Administrator")
		# Park every other numbered machine and any order of ours so each test sees only its own.
		frappe.db.set_value("Workstation", {"erp_nomor": (">", 0)}, "erp_nomor", 0)
		for wo in frappe.get_all("Work Order", {"production_item": JADI, "docstatus": 1}, pluck="name"):
			frappe.get_doc("Work Order", wo).cancel()
		frappe.db.delete("Work Order", {"production_item": JADI})

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_data_urut_dan_isi(self):
		buat_mesin("B", 2, "Production")
		buat_mesin("A", 1, "Off")
		buat_mesin("C", 3, "Problem")
		hasil = data()
		self.assertEqual([m["nomor"] for m in hasil["mesin"]], [1, 2, 3])
		self.assertEqual(
			hasil["mesin"][1],
			{
				"name": PREFIKS + "B",
				"nomor": 2,
				"merek": "Merek",
				"model": "M-2",
				"tonase": 102,
				"tahun": 2012,
				"negara": "CHINA",
				"status": "Production",
				"wo": None,
			},
		)
		self.assertEqual([m["status"] for m in hasil["mesin"]], ["Off", "Production", "Problem"])
		self.assertTrue(hasil["waktu"])

	def test_data_nomor_ganjil(self):
		buat_mesin("X", 5)
		buat_mesin("Y", 5)
		buat_mesin("Nol", 0)
		nama = [m["name"] for m in data()["mesin"]]
		self.assertEqual(sorted(nama), [PREFIKS + "X", PREFIKS + "Y"])

	def test_data_wo_jalan(self):
		mesin = buat_mesin("A", 1)
		lain = buat_mesin("B", 2)
		buat_wo(self.pabrik, lain, ajukan=False)
		batal = buat_wo(self.pabrik, lain)
		batal.cancel()
		self.assertIsNone(data()["mesin"][1]["wo"])
		self.assertIsNone(data()["mesin"][0]["wo"])
		wo = buat_wo(self.pabrik, mesin, qty=250)
		frappe.db.set_value("Work Order", wo.name, {"status": "In Process", "produced_qty": 40})
		baris = data()["mesin"][0]["wo"]
		self.assertEqual(
			baris,
			{
				"name": wo.name,
				"item_code": JADI,
				"item_name": JADI,
				"qty": 250,
				"produced_qty": 40,
				"status": "In Process",
			},
		)
		self.assertIsNone(data()["mesin"][1]["wo"])

	def test_data_wo_prioritas_jalan(self):
		mesin = buat_mesin("A", 1)
		jalan = buat_wo(self.pabrik, mesin)
		frappe.db.set_value("Work Order", jalan.name, "status", "In Process")
		baru = buat_wo(self.pabrik, mesin)  # newer, but only Not Started
		self.assertEqual(data()["mesin"][0]["wo"]["name"], jalan.name)
		frappe.db.set_value("Work Order", jalan.name, "status", "Completed")
		self.assertEqual(data()["mesin"][0]["wo"]["name"], baru.name)

	def test_data_tanpa_izin(self):
		buat_mesin("A", 1)
		frappe.set_user(self.tamu)
		self.assertRaises(frappe.PermissionError, data)

	def test_ubah_status(self):
		mesin = buat_mesin("A", 1, "Idle")
		frappe.set_user(self.operator)
		baris = ubah_status(mesin, "Problem")
		self.assertEqual(baris["status"], "Problem")
		self.assertEqual(baris["name"], mesin)
		self.assertEqual(frappe.db.get_value("Workstation", mesin, "status"), "Problem")
		self.assertTrue(frappe.db.exists("Version", {"ref_doctype": "Workstation", "docname": mesin}))

	def test_ubah_status_tolak(self):
		mesin = buat_mesin("A", 1, "Idle")
		frappe.set_user(self.operator)
		self.assertRaises(frappe.ValidationError, ubah_status, mesin, "Rusak")
		frappe.set_user(self.tamu)
		self.assertRaises(frappe.PermissionError, ubah_status, mesin, "Problem")
		self.assertEqual(frappe.db.get_value("Workstation", mesin, "status"), "Idle")

	def test_ubah_status_tanpa_nomor(self):
		mesin = buat_mesin("A", 0, "Idle")
		frappe.set_user(self.operator)
		self.assertRaises(frappe.ValidationError, ubah_status, mesin, "Problem")
		self.assertEqual(frappe.db.get_value("Workstation", mesin, "status"), "Idle")

	def test_ubah_status_baris_dengan_wo(self):
		mesin = buat_mesin("A", 1, "Idle")
		wo = buat_wo(self.pabrik, mesin)
		frappe.set_user(self.operator)
		self.assertEqual(ubah_status(mesin, "Production")["wo"]["name"], wo.name)

	def test_siaran_hanya_nama(self):
		mesin = buat_mesin("A", 1)
		with patch("frappe.publish_realtime") as siar:
			doc = frappe.get_doc("Workstation", mesin)
			doc.status = "Off"
			doc.save()
			self.assertIn(
				call("erp_lantai", {"mesin": mesin}, doctype="Workstation", after_commit=True),
				siar.call_args_list,
			)
			siar.reset_mock()
			buat_wo(self.pabrik, mesin)
			lantai = [c for c in siar.call_args_list if c.args[0] == "erp_lantai"]
			self.assertTrue(lantai)
			for c in lantai:
				self.assertEqual(c.args, ("erp_lantai", {"mesin": mesin}))
				self.assertEqual(c.kwargs, {"doctype": "Workstation", "after_commit": True})

	def test_idempoten(self):
		def jumlah():
			return frappe.db.count("Custom Field", {"fieldname": ["like", "erp_%"]})

		sebelum = jumlah()
		pastikan_setup()
		pastikan_setup()
		self.assertEqual(jumlah(), sebelum)
		self.assertTrue(frappe.db.exists("Custom Field", "Work Order-erp_mesin"))
		self.assertEqual(
			frappe.db.get_value("Custom Field", "Work Order-erp_mesin", "link_filters"),
			FIELD_WO_MESIN["link_filters"],
		)
