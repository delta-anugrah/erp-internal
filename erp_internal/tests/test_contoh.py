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
	PERUSAHAAN,
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
		for profil in PROFIL_PERAN:
			self.assertEqual(check_password(surel(profil), SANDI), surel(profil), profil)
			rp = frappe.get_all("User Role Profile", {"parent": surel(profil)}, pluck="role_profile")
			self.assertEqual(rp, [profil])
		self.assertEqual(
			[surel(p) for p in PROFIL_PERAN],
			["developer@contoh.test", "admin@contoh.test", "user@contoh.test"],
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
