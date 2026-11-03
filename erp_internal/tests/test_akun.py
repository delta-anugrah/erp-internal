"""The first accounts of a local stack (akun.py, `make users` / `make password`)."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils.password import check_password

from erp_internal import akun
from erp_internal.tampilan import ADMIN, DEVELOPER, USER


def profil(email: str) -> list[str]:
	return [r.role_profile for r in frappe.get_doc("User", email).role_profiles]


class TestAkun(IntegrationTestCase):
	def test_buat_per_profil(self):
		hasil = akun.buat(
			{
				"akun": [
					{"profil": DEVELOPER, "email": "_Uji.Akun.Dev@example.com", "sandi": "rahasia-dev"},
					{"profil": ADMIN, "email": "_uji.akun.admin@example.com", "sandi": "rahasia-admin"},
					{"profil": USER, "email": "_uji.akun.user@example.com", "sandi": "rahasia-user"},
				]
			}
		)
		self.assertEqual(len(hasil), 3)
		self.assertEqual(profil("_uji.akun.dev@example.com"), [DEVELOPER])  # stored in lower case
		self.assertEqual(profil("_uji.akun.admin@example.com"), [ADMIN])
		self.assertEqual(frappe.db.get_value("User", "_uji.akun.user@example.com", "module_profile"), USER)
		self.assertEqual(
			check_password("_uji.akun.user@example.com", "rahasia-user"), "_uji.akun.user@example.com"
		)
		# A second run updates, never duplicates
		hasil = akun.buat(
			{"akun": [{"profil": USER, "email": "_uji.akun.user@example.com", "sandi": "sandi-baru"}]}
		)
		self.assertIn("updated", hasil[0])
		self.assertEqual(
			check_password("_uji.akun.user@example.com", "sandi-baru"), "_uji.akun.user@example.com"
		)

	def test_tolak_sebelum_menulis(self):
		salah = [
			[{"profil": "Boss", "email": "_uji.akun.x@example.com", "sandi": "12345678"}],
			[{"profil": USER, "email": "bukan-email", "sandi": "12345678"}],
			[{"profil": USER, "email": "_uji.akun.x@example.com", "sandi": "pendek"}],
			[
				{"profil": USER, "email": "_uji.akun.x@example.com", "sandi": "12345678"},
				{"profil": ADMIN, "email": "_uji.akun.x@example.com", "sandi": "12345678"},
			],
		]
		for daftar in salah:
			with self.assertRaises(frappe.ValidationError):
				akun.buat({"akun": daftar})
		# a bad entry after a good one: nothing written
		self.assertFalse(frappe.db.exists("User", "_uji.akun.x@example.com"))
		with self.assertRaises(frappe.ValidationError):
			akun.buat({"Administrator": "pendek", "akun": []})

	def test_ganti_sandi(self):
		akun.buat({"akun": [{"profil": ADMIN, "email": "_uji.akun.ganti@example.com", "sandi": "lama-lama"}]})
		akun.ganti_sandi({"email": "_UJI.akun.ganti@example.com", "sandi": "baru-baru"})
		self.assertEqual(
			check_password("_uji.akun.ganti@example.com", "baru-baru"), "_uji.akun.ganti@example.com"
		)
		with self.assertRaises(frappe.ValidationError):
			akun.ganti_sandi({"email": "_uji.tidak.ada@example.com", "sandi": "12345678"})
		with self.assertRaises(frappe.ValidationError):
			akun.ganti_sandi({"email": "_uji.akun.ganti@example.com", "sandi": "pendek"})
