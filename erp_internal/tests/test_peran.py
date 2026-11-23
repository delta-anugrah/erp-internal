"""The three profiles' names (Super Admin, Admin, Produksi) and the patch that renames the old ones."""

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal.patches import profil_tiga
from erp_internal.tampilan import ADMIN, PRODUKSI, PROFIL_PERAN, SUPER_ADMIN
from erp_internal.tests.utils import buat_pengguna


class TestPeran(IntegrationTestCase):
	def test_tiga_profil(self):
		self.assertEqual(list(PROFIL_PERAN), [SUPER_ADMIN, ADMIN, PRODUKSI])
		for nama in (SUPER_ADMIN, ADMIN, PRODUKSI):
			self.assertTrue(frappe.db.exists("Role Profile", nama))
			self.assertTrue(frappe.db.exists("Module Profile", nama))
		self.assertFalse(frappe.db.exists("Role Profile", "Developer"))
		self.assertFalse(frappe.db.exists("Role Profile", "User"))

	def test_ganti_nama_bawa_pengguna(self):
		# A profile under an old name keeps its users after the rename; a second run changes nothing.
		frappe.get_doc(
			{"doctype": "Role Profile", "role_profile": "_Uji Lama", "roles": [{"role": "Stock User"}]}
		).insert()
		frappe.get_doc({"doctype": "Module Profile", "module_profile_name": "_Uji Lama"}).insert()
		u = buat_pengguna("_uji.peran.lama@example.com", "_Uji Lama", "_Uji Lama", None)
		self.assertTrue(profil_tiga.ganti_nama("_Uji Lama", "_Uji Baru"))
		user = frappe.get_doc("User", u)
		self.assertEqual([r.role_profile for r in user.role_profiles], ["_Uji Baru"])
		self.assertEqual(user.module_profile, "_Uji Baru")
		self.assertFalse(profil_tiga.ganti_nama("_Uji Lama", "_Uji Baru"))
