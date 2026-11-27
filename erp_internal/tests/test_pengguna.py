"""An Admin manages users but never hands out Developer or System Manager (pengguna.py), on every path."""

import frappe
from frappe.client import insert as client_insert
from frappe.client import save as client_save
from frappe.tests import IntegrationTestCase
from frappe.utils.password import check_password

from erp_internal.tampilan import ADMIN, PRODUKSI, SUPER_ADMIN
from erp_internal.tests.utils import buat_pengguna


def peran(user: str) -> set[str]:
	return set(frappe.get_all("Has Role", {"parenttype": "User", "parent": user}, pluck="role"))


def user_baru(email: str, profil: str) -> dict:
	return {
		"doctype": "User",
		"email": email,
		"first_name": email.split("@")[0],
		"send_welcome_email": 0,
		"role_profiles": [{"role_profile": profil}],
	}


def user_polos(email: str) -> str:
	"""A user with the role Stock User and no Role Profile."""
	u = buat_pengguna(email, None, None, None)
	doc = frappe.get_doc("User", u)
	if not doc.roles:
		doc.append("roles", {"role": "Stock User"})
		doc.save(ignore_permissions=True)
	return u


class TestPengguna(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.admin = buat_pengguna("_uji.peng.admin@example.com", ADMIN, ADMIN, None)
		cls.dev = buat_pengguna("_uji.peng.dev@example.com", SUPER_ADMIN, None, None)
		cls.user = buat_pengguna("_uji.peng.user@example.com", PRODUKSI, PRODUKSI, None)
		# A user with roles set one by one, no Role Profile: the profile would drop any other role itself.
		cls.polos = user_polos("_uji.peng.polos@example.com")

	def setUp(self):
		frappe.set_user(self.admin)
		self.addCleanup(frappe.set_user, "Administrator")

	def test_admin_kelola_user(self):
		# Create a User, make them an Admin, disable them: all allowed.
		baru = frappe.get_doc(user_baru("_uji.peng.baru@example.com", PRODUKSI)).insert()
		self.assertIn("ERP User", peran(baru.name))
		baru.set("role_profiles", [{"role_profile": ADMIN}])
		baru.save()
		self.assertIn("ERP Admin", peran(baru.name))
		baru.enabled = 0
		baru.save()
		self.assertEqual(frappe.db.get_value("User", baru.name, "enabled"), 0)

	def test_profil_developer_ditolak(self):
		with self.assertRaises(frappe.PermissionError):
			frappe.get_doc(user_baru("_uji.peng.calon@example.com", SUPER_ADMIN)).insert()
		self.assertFalse(frappe.db.exists("User", "_uji.peng.calon@example.com"))

	def test_system_manager_lewat_form_ditolak(self):
		# The form's save (frappe.client.save takes the same document) with System Manager ticked.
		doc = frappe.get_doc("User", self.polos)
		doc.append("roles", {"role": "System Manager"})
		self.assertRaises(frappe.PermissionError, doc.save)
		doc = frappe.get_doc("User", self.polos).as_dict()
		doc["roles"].append({"role": "System Manager"})
		self.assertRaises(frappe.PermissionError, client_save, doc)
		# The Developer profile, given to someone else or to the Admin's own account.
		for target in (self.user, self.admin):
			doc = frappe.get_doc("User", target).as_dict()
			doc["role_profiles"] = [{"role_profile": SUPER_ADMIN}]
			self.assertRaises(frappe.PermissionError, client_save, doc)
		# A role ticked on a user with a Role Profile is dropped by Frappe itself.
		doc = frappe.get_doc("User", self.admin)
		doc.append("roles", {"role": "System Manager"})
		doc.save()
		for target in (self.polos, self.user, self.admin):
			self.assertNotIn("System Manager", peran(target), target)

	def test_has_role_langsung_ditolak(self):
		for role in ("System Manager", "Administrator"):
			baris = {
				"doctype": "Has Role",
				"parenttype": "User",
				"parentfield": "roles",
				"parent": self.polos,
				"role": role,
			}
			self.assertRaises(frappe.PermissionError, frappe.get_doc(baris).insert)
			self.assertRaises(
				frappe.PermissionError, frappe.get_doc(dict(baris)).insert, ignore_permissions=True
			)
			self.assertRaises(frappe.PermissionError, client_insert, dict(baris))
			self.assertNotIn(role, peran(self.polos))

	def test_peran_administrator_ditolak(self):
		# Security review 2026-10-28: Frappe lists Administrator among AUTOMATIC_ROLES; it must not pass as one.
		doc = frappe.get_doc("User", self.polos)
		doc.append("roles", {"role": "Administrator"})
		self.assertRaises(frappe.PermissionError, doc.save)
		doc = frappe.get_doc("User", self.polos).as_dict()
		doc["roles"].append({"role": "Administrator"})
		self.assertRaises(frappe.PermissionError, client_save, doc)
		self.assertNotIn("Administrator", peran(self.polos))

	def test_peran_di_luar_profil_ditolak(self):
		doc = frappe.get_doc("User", self.polos)
		doc.append("roles", {"role": "Item Manager"})  # an Admin role: allowed
		doc.save()
		doc.append("roles", {"role": "Website Manager"})
		self.assertRaises(frappe.PermissionError, doc.save)

	def test_akun_developer_tak_tersentuh(self):
		from frappe.core.doctype.user.user import change_password

		dev = frappe.get_doc("User", self.dev)
		self.assertFalse(frappe.has_permission("User", "write", doc=dev))
		self.assertTrue(frappe.has_permission("User", "read", doc=dev))
		dev.enabled = 0
		self.assertRaises(frappe.PermissionError, dev.save)
		dev.reload()
		dev.enabled = 0
		self.assertRaises(frappe.PermissionError, dev.save, ignore_permissions=True)  # the validate hook
		self.assertRaises(frappe.PermissionError, change_password, self.dev, "_Uji-Sandi-Baru-2026!")
		with self.assertRaisesRegex(frappe.ValidationError, "write permission"):
			frappe.rename_doc("User", self.dev, "_uji.peng.lain@example.com")
		self.assertEqual(frappe.db.get_value("User", self.dev, "enabled"), 1)
		self.assertIn("System Manager", peran(self.dev))

	def test_sandi_di_user_baru(self):
		# Abel 2026-11-27: the New User dialog asks for a password (setup.TATA_FORM "cepat").
		df = frappe.get_meta("User").get_field("new_password")
		self.assertEqual((df.hidden, df.allow_in_quick_entry), (0, 1))
		self.assertTrue(
			frappe.get_meta("User").get_field("change_password").hidden
		)  # the form stays as it was
		# The dialog saves through frappe.client.insert: an Admin sets a new Produksi account's password.
		email = "_uji.peng.sandi@example.com"
		client_insert({**user_baru(email, PRODUKSI), "new_password": "_Uji-Sandi-Baru-2026!"})
		self.assertEqual(check_password(email, "_Uji-Sandi-Baru-2026!"), email)
		# Never a Super Admin's, not even past the permission check (the validate hook).
		dev = frappe.get_doc("User", self.dev)
		dev.new_password = "_Uji-Sandi-Admin-2026!"
		self.assertRaises(frappe.PermissionError, dev.save, ignore_permissions=True)
		doc = {**frappe.get_doc("User", self.dev).as_dict(), "new_password": "_Uji-Sandi-Admin-2026!"}
		self.assertRaises(frappe.PermissionError, client_save, doc)
		with self.assertRaises(frappe.AuthenticationError):
			check_password(self.dev, "_Uji-Sandi-Admin-2026!")

	def test_admin_ganti_sandi(self):
		# No email on the server (Abel 2026-11-27): an Admin sets passwords through Password > Change Password,
		# which posts to change_password. Admin and Produksi accounts yes, Super Admin and Administrator never.
		from frappe.core.doctype.user.user import change_password

		self.assertNotIn("System Manager", frappe.get_roles(self.admin))
		lain = buat_pengguna("_uji.peng.admin2@example.com", ADMIN, ADMIN, None)
		for target in (self.user, lain):
			change_password(target, "_Uji-Sandi-Ganti-2026!")
			self.assertEqual(check_password(target, "_Uji-Sandi-Ganti-2026!"), target)
		for target in (self.dev, "Administrator"):
			self.assertRaises(frappe.PermissionError, change_password, target, "_Uji-Sandi-Ganti-2026!")
			with self.assertRaises(frappe.AuthenticationError):
				check_password(target, "_Uji-Sandi-Ganti-2026!")

	def test_jalur_lain_ke_developer_ditolak(self):
		from frappe.client import set_value

		self.assertRaises(frappe.PermissionError, set_value, "User", self.dev, "enabled", 0)
		# An allowed role, written on its own onto the Developer's account.
		baris = {
			"doctype": "Has Role",
			"parenttype": "User",
			"parentfield": "roles",
			"parent": self.dev,
			"role": "Leave Approver",
		}
		self.assertRaises(frappe.PermissionError, frappe.get_doc(baris).insert, ignore_permissions=True)
		# A new User under the Developer's name, disabled: refused before Frappe acts on it.
		baru = frappe.get_doc({**user_baru(self.dev, PRODUKSI), "enabled": 0})
		self.assertRaises(frappe.PermissionError, baru.insert, ignore_permissions=True)
		self.assertEqual(frappe.db.get_value("User", self.dev, "enabled"), 1)

	def test_karyawan_developer_tetap_bisa_disimpan(self):
		# HR (Admin) links an Employee to a Developer: ERPNext's sync saves the User, which must pass.
		from erp_internal.tests.utils import buat_perusahaan

		frappe.set_user("Administrator")
		company = buat_perusahaan("_Uji Pabrik", "_UP")
		frappe.set_user(self.admin)
		emp = frappe.get_doc(
			{
				"doctype": "Employee",
				"first_name": "_Uji Dev",
				"company": company,
				"gender": "Male",
				"date_of_birth": "1990-01-01",
				"date_of_joining": "2024-01-01",
				"status": "Active",
				"user_id": self.dev,
			}
		).insert()
		emp.first_name = "_Uji Dev Baru"
		emp.save()
		self.assertIn("System Manager", peran(self.dev))

	def test_developer_tidak_dibatasi(self):
		target = user_polos("_uji.peng.naik@example.com")
		frappe.set_user(self.dev)
		doc = frappe.get_doc("User", target)
		doc.append("roles", {"role": "System Manager"})
		doc.save()
		self.assertIn("System Manager", peran(target))
