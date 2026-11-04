"""The app version on the login page and in Desk's boot."""

import re

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import set_request
from frappe.utils.change_log import get_versions
from frappe.website.serve import get_response

import erp_internal
from erp_internal.versi import di_login, versi


class TestVersi(IntegrationTestCase):
	def test_bentuk_tag(self):
		self.assertRegex(versi(), r"^v\d+\.\d+\.\d+$")
		self.assertEqual(versi(), f"v{erp_internal.__version__}")

	def test_cuma_di_login(self):
		self.assertIsNone(di_login(frappe._dict(path="about")))
		hasil = di_login(frappe._dict(path="login", body_include="<b>lain</b>"))
		self.assertTrue(hasil["body_include"].startswith("<b>lain</b>"))
		self.assertIn(f'"{versi()}"', hasil["body_include"])

	def test_halaman_login(self):
		# A signed-in user is sent on to Desk: ask as a guest.
		frappe.set_user("Guest")
		try:
			set_request(method="GET", path="/login")
			jawaban = get_response()
		finally:
			frappe.set_user("Administrator")
		self.assertEqual(jawaban.status_code, 200)
		html = frappe.safe_decode(jawaban.get_data())
		self.assertIn("erp-versi", html)
		self.assertIn(f'"{versi()}"', html)
		self.assertEqual(len(re.findall(r"erp-versi", html)), 1)

	def test_boot_desk(self):
		# frappe.boot reads this map for `frappe.boot.versions`, which public/js/versi.js shows.
		self.assertEqual(get_versions()["erp_internal"]["version"], erp_internal.__version__)
