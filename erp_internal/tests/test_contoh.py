"""The sample data: complete, marked DATA CONTOH, the same after a second run, refused in production."""

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, getdate, today
from frappe.utils.password import check_password

from erp_internal.contoh import (
	BARANG,
	BIAYA,
	DIBUAT,
	KAPASITAS,
	KARYAWAN,
	KEMASAN_PRODUK,
	ORDER_PRODUKSI,
	PELANGGAN,
	PEMASOK,
	PERUSAHAAN,
	PIGMEN,
	RESEP,
	TANDA,
	buat_contoh,
	surel,
)
from erp_internal.tampilan import PROFIL_PERAN

SANDI = "_Uji-Contoh-2026!"


def hitung() -> dict[str, int]:
	return {dt: frappe.db.count(dt) for dt in (*DIBUAT, "Stock Ledger Entry", "ToDo", "User Permission")}


class TestContoh(IntegrationTestCase):
	def setUp(self):
		konfigurasi = patch.dict(frappe.local.conf, {"erp_sandi_contoh": SANDI})
		konfigurasi.start()
		self.addCleanup(konfigurasi.stop)
		frappe.local.conf.pop("erp_produksi", None)

	def test_dua_kali_sama(self):
		ringkas = buat_contoh()
		sebelum = hitung()
		self.assertEqual(buat_contoh(), ringkas)
		self.assertEqual(hitung(), sebelum)

		self.assertEqual(ringkas["Company"], 1)
		self.assertEqual(ringkas["Item"], len(BARANG) + len(PIGMEN))
		self.assertEqual(ringkas["Expense Entry"], len(BIAYA))
		self.assertEqual(ringkas["Delivery Note"], 1)
		self.assertEqual(ringkas["BOM"], len(RESEP) + len(KAPASITAS))
		self.assertEqual(ringkas["Machine Capacity"], len(KAPASITAS))
		self.assertEqual(ringkas["Customer"], len(PELANGGAN))
		self.assertEqual(ringkas["Supplier"], len(PEMASOK))
		self.assertEqual(ringkas["Sales History"], 6 * len(RESEP))
		self.assertGreater(ringkas["Sales Order"], 0)
		self.assertEqual(ringkas["Employee"], len(KARYAWAN))
		self.assertEqual(ringkas["Shift Assignment"], len(KARYAWAN))
		self.assertEqual(ringkas["Project"], 1)
		self.assertEqual(ringkas["User"], len(PROFIL_PERAN))

	def test_produksi_contoh(self):
		# Seven days of output with rejects, ending yesterday, on the machines of the capacity rows.
		buat_contoh()
		sebelum = (
			frappe.db.count("Production Entry", {"docstatus": 1}),
			frappe.db.count("Machine Capacity"),
		)
		self.assertGreater(sebelum[0], 0)
		self.assertGreater(sebelum[1], 0)
		hari = frappe.get_all(
			"Production Entry", {"docstatus": 1, "_user_tags": ("like", f"%{TANDA}%")}, pluck="posting_date"
		)
		self.assertEqual(len(set(hari)), 7)
		self.assertLess(max(hari), getdate(today()))
		self.assertTrue(
			frappe.db.count(
				"Production Entry Reject",
				{"parent": ("in", frappe.get_all("Production Entry", pluck="name"))},
			)
		)
		buat_contoh()
		self.assertEqual(
			(frappe.db.count("Production Entry", {"docstatus": 1}), frappe.db.count("Machine Capacity")),
			sebelum,
		)

	def test_hari_berikutnya(self):
		# A run on a later day plans a new window: one open order per sample row, the earlier ones stopped,
		# one entry per order key and day, and no order made more than it planned.
		buat_contoh()
		besok = add_days(today(), 1)
		with patch("erp_internal.contoh.today", return_value=besok):
			buat_contoh()
		tag = {"docstatus": 1, "_user_tags": ("like", f"%{TANDA}%")}
		buka = frappe.get_all(
			"Work Order", {**tag, "status": ("not in", ("Stopped", "Closed"))}, pluck="name"
		)
		self.assertEqual(len(buka), len(ORDER_PRODUKSI))
		for wo in buka:
			self.assertEqual(
				getdate(frappe.db.get_value("Work Order", wo, "planned_end_date")), getdate(today())
			)
		for o in frappe.get_all("Work Order", tag, ["qty", "produced_qty"]):
			self.assertLessEqual(o.produced_qty, o.qty)
		entri = frappe.get_all("Production Entry", tag, ["workstation", "item", "posting_date", "shift"])
		kunci = [(e.workstation, e.item, e.posting_date, e.shift) for e in entri]
		self.assertEqual(len(kunci), len(set(kunci)))
		self.assertEqual(max(e.posting_date for e in entri), getdate(today()))

	def test_contoh_baru(self):
		# Samuel's 2026-11-23 requests: daily input with technicians, the operator wage per machine shift, a
		# delivery from Pluit, two pigments, and packing in the capacity BOMs.
		buat_contoh()
		self.assertTrue(frappe.db.count("Production Entry", {"technician": "Yudi", "docstatus": 1}))
		self.assertTrue(frappe.db.count("Production Entry", {"technician": "Fadli", "docstatus": 1}))
		self.assertTrue(
			frappe.db.exists(
				"Expense Entry", {"repeat": "Per machine shift", "amount": 105000, "docstatus": 1}
			)
		)
		self.assertTrue(
			frappe.db.exists("Delivery Note", {"set_warehouse": ("like", "Gudang Pluit%"), "docstatus": 1})
		)
		self.assertEqual(frappe.db.count("Item", {"variant_of": "PIGMEN", "disabled": 0}), 2)
		bom = frappe.get_all(
			"BOM", {"erp_kapasitas": ("is", "set"), "_user_tags": ("like", f"%{TANDA}%")}, pluck="name"
		)
		self.assertTrue(
			frappe.db.exists(
				"BOM Item",
				{"parent": ("in", bom), "item_code": ("in", [k for k, _isi in KEMASAN_PRODUK.values()])},
			)
		)

	def test_pengguna_masuk_dengan_sandi(self):
		buat_contoh()
		for profil in PROFIL_PERAN:
			self.assertEqual(check_password(surel(profil), SANDI), surel(profil), profil)
			rp = frappe.get_all("User Role Profile", {"parent": surel(profil)}, pluck="role_profile")
			self.assertEqual(rp, [profil])
		self.assertEqual(
			[surel(p) for p in PROFIL_PERAN],
			["developer@example.com", "admin@example.com", "user@example.com"],
		)

	def test_satu_perusahaan(self):
		# Factory and office records share the one company.
		buat_contoh()
		nama = PERUSAHAAN[0]
		self.assertEqual(frappe.db.get_value("Company", nama, "erp_aktif"), 1)
		for dt in ("Employee", "Project", "Sales Order", "BOM"):
			self.assertEqual(
				set(frappe.get_all(dt, {"_user_tags": ("like", f"%{TANDA}%")}, pluck="company")), {nama}, dt
			)

	def test_semua_bertanda(self):
		buat_contoh()
		for kode in BARANG:
			self.assertIn(TANDA, frappe.db.get_value("Item", kode, "_user_tags") or "", kode)

	def test_ditolak_di_produksi(self):
		frappe.local.conf["erp_produksi"] = 1
		sebelum = hitung()
		self.assertRaises(frappe.ValidationError, buat_contoh)
		self.assertEqual(hitung(), sebelum)

	def test_tanpa_sandi_ditolak(self):
		frappe.local.conf.pop("erp_sandi_contoh")
		self.assertRaises(frappe.ValidationError, buat_contoh)
