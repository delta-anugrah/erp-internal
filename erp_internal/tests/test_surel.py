"""No outgoing email yet: everything that needs one is hidden (surel.py), and comes back once an account is set."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import set_request
from frappe.website.serve import get_response

from erp_internal import surel
from erp_internal.tampilan import PRODUKSI


class TestSurel(IntegrationTestCase):
	def setUp(self):
		# Start from a site without email: the test site may hold an outgoing account from other tests' fixtures.
		for nama in frappe.get_all("Email Account", {"enable_outgoing": 1}, pluck="name"):
			frappe.db.set_value("Email Account", nama, "enable_outgoing", 0)
			self.addCleanup(frappe.db.set_value, "Email Account", nama, "enable_outgoing", 1)
		mail_server = frappe.local.conf.pop("mail_server", None)
		if mail_server:
			self.addCleanup(frappe.local.conf.__setitem__, "mail_server", mail_server)

	def akun_keluar(self):
		"""An Email Account set as Default Outgoing (written without validate: no SMTP login in a test)."""
		akun = frappe.get_doc(
			{
				"doctype": "Email Account",
				"email_account_name": "_Uji Keluar",
				"email_id": "_uji.keluar@example.com",
				"enable_outgoing": 1,
				"default_outgoing": 1,
			}
		)
		akun.db_insert()
		self.addCleanup(frappe.db.delete, "Email Account", akun.name)

	def test_tanpa_email(self):
		self.assertFalse(surel.ada_email())
		boot = frappe._dict()
		surel.boot(boot)
		self.assertTrue(boot.erp_tanpa_email)

	def test_email_dipasang(self):
		self.akun_keluar()
		self.assertTrue(surel.ada_email())
		boot = frappe._dict()
		surel.boot(boot)
		self.assertFalse(boot.erp_tanpa_email)
		self.assertIsNone(surel.di_login(frappe._dict(path="login")))

	def test_mail_server_di_config(self):
		# Frappe also sends through the site config's mail_server when no account is set
		frappe.local.conf.mail_server = "smtp.example.com"
		self.addCleanup(frappe.local.conf.pop, "mail_server", None)
		self.assertTrue(surel.ada_email())

	def test_login(self):
		self.assertIsNone(surel.di_login(frappe._dict(path="about")))
		hasil = surel.di_login(frappe._dict(path="login", body_include="<b>lain</b>"))
		self.assertTrue(hasil["body_include"].startswith("<b>lain</b>"))
		self.assertIn("erp-tanpa-email", hasil["body_include"])
		self.assertIn("Ask an Admin to change your password.", hasil["body_include"])
		self.assertIn("#login-with-email-link", hasil["body_include"])
		# The real page, as a guest
		frappe.set_user("Guest")
		try:
			set_request(method="GET", path="/login")
			html = frappe.safe_decode(get_response().get_data())
		finally:
			frappe.set_user("Administrator")
		self.assertIn("erp-tanpa-email", html)
		self.assertIn("erp-versi", html)  # versi.di_login still runs

	def test_tanpa_email_selamat_datang(self):
		# Send Welcome Email would only fail in the queue: off on a new user while no email is set
		baru = frappe.get_doc(
			{
				"doctype": "User",
				"email": "_uji.surel.baru@example.com",
				"first_name": "Baru",
				"send_welcome_email": 1,
				"role_profiles": [{"role_profile": PRODUKSI}],
			}
		).insert(ignore_permissions=True)
		self.assertEqual(baru.send_welcome_email, 0)
		self.assertFalse(frappe.db.exists("Email Queue", {"reference_name": baru.name}))

	def test_email_dipasang_selamat_datang_tetap(self):
		self.akun_keluar()
		doc = frappe.get_doc(
			{"doctype": "User", "email": "_uji.surel.lain@example.com", "send_welcome_email": 1}
		)
		surel.user_baru(doc)
		self.assertEqual(doc.send_welcome_email, 1)
