"""English by default, Indonesian per user: the switch, and a translation for every string of ours."""

import csv

import frappe
from frappe.tests import IntegrationTestCase
from frappe.translate import get_messages_for_app

from erp_internal.bahasa import ganti
from erp_internal.tests.utils import buat_pengguna


def baris_csv() -> dict[str, str]:
	with open(frappe.get_app_path("erp_internal", "translations", "id.csv"), newline="") as f:
		return {sumber: target for sumber, target, *_ in csv.reader(f)}


class TestBahasa(IntegrationTestCase):
	def test_label_kita_dipakai(self):
		semua = frappe.translate.get_all_translations("id")
		for sumber, target in baris_csv().items():
			self.assertEqual(semua.get(sumber), target, sumber)

	def test_ganti_bahasa(self):
		u = buat_pengguna("_uji.bahasa@contoh.test", "Gudang", None, None)
		frappe.set_user(u)
		self.addCleanup(frappe.set_user, "Administrator")
		ganti("id")
		self.assertEqual(frappe.db.get_value("User", u, "language"), "id")
		ganti("en")
		self.assertEqual(frappe.db.get_value("User", u, "language"), "en")

	def test_bahasa_lain_ditolak(self):
		self.assertRaises(frappe.ValidationError, ganti, "fr")

	def test_tamu_ditolak(self):
		frappe.set_user("Guest")
		self.addCleanup(frappe.set_user, "Administrator")
		self.assertRaises(frappe.PermissionError, ganti, "id")

	def test_semua_teks_kita_diterjemahkan(self):
		# Navbar rows come from every app's Navbar Settings; only ours (the language switch) count here.
		pesan = {m[1] for m in get_messages_for_app("erp_internal") if m[0] != "Navbar:"}
		pesan |= {i["item_label"] for i in frappe.get_hooks("standard_navbar_items", app_name="erp_internal")}
		self.assertEqual(sorted(pesan - set(baris_csv())), [])
