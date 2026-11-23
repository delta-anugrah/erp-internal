"""Saving a workspace from the desk keeps our Apps tiles (erp_internal/ruang_kerja.py)."""

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal import ruang_kerja
from erp_internal.tampilan import IKON_APLIKASI, NAMA_APLIKASI, PRODUKSI
from erp_internal.tests.test_tampilan import pengguna_profil


def tile(balasan: dict) -> dict:
	return {a["app_name"]: (a["app_title"], a["app_logo_url"]) for a in balasan["app_data"]}


class TestRuangKerja(IntegrationTestCase):
	def test_override_terdaftar(self):
		# Every Frappe method that answers with workspace_payload goes through ours.
		ganti = frappe.get_hooks("override_whitelisted_methods")
		for metode in ("new_page", "update_workspace_settings", "delete_page", "set_workspace_module"):
			asli = f"frappe.desk.doctype.workspace.workspace.{metode}"
			self.assertEqual(ganti.get(asli), [f"erp_internal.ruang_kerja.{metode}"], metode)
		self.assertEqual(
			ganti.get("frappe.desk.page.workspace_restore.workspace_restore.restore_workspace_edits"),
			["erp_internal.ruang_kerja.restore_workspace_edits"],
		)

	def test_simpan_tetap_merek_kita(self):
		# A User saves and deletes a private workspace: both replies carry our tile names and icons, and only
		# the tiles with something on the User's rail.
		u = pengguna_profil(PRODUKSI, "simpan")
		frappe.set_user(u)
		self.addCleanup(frappe.set_user, "Administrator")
		balasan = ruang_kerja.new_page(
			{
				"title": "_Uji Simpan",
				"label": "_Uji Simpan",
				"content": "[]",
				"type": "Workspace",
				"module": "Projects",
				"public": 0,
				"for_user": u,
			}
		)
		for app in ("erpnext", "hrms"):
			self.assertEqual(tile(balasan)[app], (NAMA_APLIKASI[app], IKON_APLIKASI[app]))
		self.assertFalse(next(a for a in balasan["app_data"] if a["app_name"] == "frappe")["on_apps_screen"])

		nama = frappe.db.get_value("Workspace", {"title": "_Uji Simpan", "for_user": u})
		hapus = ruang_kerja.delete_page(nama)
		self.assertEqual(tile(hapus)["erpnext"], (NAMA_APLIKASI["erpnext"], IKON_APLIKASI["erpnext"]))
		self.assertFalse(frappe.db.exists("Workspace", nama))

	def test_balasan_lain_dibiarkan(self):
		self.assertIsNone(ruang_kerja.rapikan(None))
		self.assertEqual(ruang_kerja.rapikan({"a": 1}), {"a": 1})
