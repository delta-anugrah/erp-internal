"""The site has every app installed, at the tags pinned in versi.json."""

import importlib
import json

import frappe
from frappe.tests import IntegrationTestCase


class TestSitus(IntegrationTestCase):
	def test_aplikasi_terpasang(self):
		self.assertLessEqual({"frappe", "erpnext", "hrms", "erp_internal"}, set(frappe.get_installed_apps()))

	def test_versi_sesuai_pin(self):
		with open(frappe.get_app_path("erp_internal", "..", "versi.json")) as f:
			for app, tag in json.load(f).items():
				self.assertEqual("v" + importlib.import_module(app).__version__, tag)
