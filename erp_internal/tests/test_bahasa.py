"""English by default, Indonesian per user: the switch, and a translation for every string of ours."""

import csv

import frappe
from frappe.tests import IntegrationTestCase
from frappe.translate import get_messages_for_app

from erp_internal.bahasa import ganti
from erp_internal.tests.utils import buat_pengguna


def kunci(sumber: str, konteks: str | None) -> str:
	"""Frappe's translation key: `source`, or `source:context` for a row with a context."""
	return f"{sumber}:{konteks}" if konteks else sumber


def baris_csv() -> dict[str, str]:
	with open(frappe.get_app_path("erp_internal", "translations", "id.csv"), newline="") as f:
		return {kunci(r[0], r[2] if len(r) > 2 else None): r[1] for r in csv.reader(f) if r}


class TestBahasa(IntegrationTestCase):
	def test_label_kita_dipakai(self):
		semua = frappe.translate.get_all_translations("id")
		for sumber, target in baris_csv().items():
			self.assertEqual(semua.get(sumber), target, sumber)

	def test_ganti_bahasa(self):
		u = buat_pengguna("_uji.bahasa@example.com", "Produksi", None, None)
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
		# Navbar rows come from every app's Navbar Settings; only ours (the language switch) count here. The built
		# bundles are skipped: a minified three.js has calls like _("x","y",...) that the scanner reads as messages.
		pesan = {
			kunci(m[1], m[2] if len(m) > 2 else None)
			for m in get_messages_for_app("erp_internal")
			if m[0] != "Navbar:" and "/public/dist/" not in (m[0] or "")
		}
		pesan |= {i["item_label"] for i in frappe.get_hooks("standard_navbar_items", app_name="erp_internal")}
		self.assertEqual(sorted(pesan - set(baris_csv())), [])

	def test_layar_diterjemahkan(self):
		# Shortcut labels and counts, and renamed modules, are shown through _() / __() as well.
		from erp_internal.tampilan import KETERANGAN, LABEL, NAMA_APLIKASI, PINTASAN

		teks = set(LABEL.values()) | set(NAMA_APLIKASI.values()) | set(KETERANGAN.values())
		for daftar in PINTASAN.values():
			teks |= {p["label"] for p in daftar} | {p["format"] for p in daftar if p.get("format")}
		self.assertEqual(sorted(teks - set(baris_csv())), [])
