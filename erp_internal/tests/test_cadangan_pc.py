"""The PC backup installer on the Download Backups page (cadangan_pc.py, public/js/backups.js)."""

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal import cadangan_pc
from erp_internal.tampilan import ADMIN, SUPER_ADMIN
from erp_internal.tests.utils import buat_pengguna


class TestCadanganPc(IntegrationTestCase):
	def unduh_sebagai(self, email: str) -> bytes:
		frappe.local.response = frappe._dict()
		frappe.set_user(email)
		try:
			cadangan_pc.unduh()
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(frappe.response.type, "download")
		return frappe.response.filecontent

	def test_super_admin_unduh(self):
		isi = self.unduh_sebagai(buat_pengguna("_uji.cpc.super@example.com", SUPER_ADMIN, None, None))
		self.assertEqual(frappe.response.filename, "pasang-cadangan-pc.cmd")
		# cmd.exe: every line ends in CRLF, none in a bare LF.
		self.assertEqual(isi.count(b"\n"), isi.count(b"\r\n"))
		teks = isi.decode("ascii")
		self.assertIn("\r\n#PS-START\r\n", teks)
		self.assertIn("8b4fd2737ade4e70c057ef4a49deb7cffe94b0fb9d7587c189d149823f21a1dc", teks)

	def test_admin_ditolak(self):
		admin = buat_pengguna("_uji.cpc.admin@example.com", ADMIN, ADMIN, None)
		with self.assertRaises(frappe.PermissionError):
			self.unduh_sebagai(admin)

	def test_tanpa_rahasia(self):
		# The file is handed to whoever opens the page: the key is typed on the PC, never stored here.
		teks = cadangan_pc.BERKAS.read_text(encoding="ascii")
		self.assertIn("secret_access_key = $rahasia", teks)
		self.assertNotRegex(teks, r"(?i)secret_access_key\s*=\s*[A-Za-z0-9]{20,}")

	def test_tombol_di_halaman(self):
		# Frappe appends the page_js file to the page's own script, so the wrapper sees on_page_load.
		self.assertIn("public/js/backups.js", frappe.get_hooks("page_js").get("backups", []))
		script = frappe.get_doc("Page", "backups")
		script.load_assets()
		self.assertIn("erp_internal.cadangan_pc.unduh", script.script)
		self.assertIn('remove_inner_button(__("Download Files Backup"))', script.script)
