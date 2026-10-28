"""The sample data: complete, marked DATA CONTOH, the same after a second run, refused in production."""

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils.password import check_password

from erp_internal.contoh import (
	BARANG,
	DIBUAT,
	KARYAWAN,
	PELANGGAN,
	PEMASOK,
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

		self.assertEqual(ringkas["Company"], 2)
		self.assertEqual(ringkas["Item"], len(BARANG))
		self.assertEqual(ringkas["BOM"], len(RESEP))
		self.assertEqual(ringkas["Customer"], len(PELANGGAN))
		self.assertEqual(ringkas["Supplier"], len(PEMASOK))
		self.assertEqual(ringkas["Sales History"], 6 * len(RESEP))
		self.assertGreater(ringkas["Sales Order"], 0)
		self.assertEqual(ringkas["Employee"], len(KARYAWAN))
		self.assertEqual(ringkas["Shift Assignment"], len(KARYAWAN))
		self.assertEqual(ringkas["Project"], 1)
		self.assertEqual(ringkas["User"], len(PROFIL_PERAN))

	def test_pengguna_masuk_dengan_sandi(self):
		buat_contoh()
		for bagian in PROFIL_PERAN:
			self.assertEqual(check_password(surel(bagian), SANDI), surel(bagian), bagian)
			profil = frappe.get_all("User Role Profile", {"parent": surel(bagian)}, pluck="role_profile")
			self.assertEqual(profil, [bagian])

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
