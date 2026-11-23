"""The three profiles (Super Admin, Admin, Produksi), the patch that renames the old ones, and what each may do
with production: Produksi records it, Admin only views it."""

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal.patches import profil_tiga
from erp_internal.setup import IZIN_DICABUT
from erp_internal.tampilan import ADMIN, PRODUKSI, PROFIL_PERAN, SUPER_ADMIN
from erp_internal.tests.utils import buat_pengguna, buat_perusahaan


class TestPeran(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")

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

	def test_produksi_hanya_produksi(self):
		u = buat_pengguna("_uji.peran.produksi@example.com", PRODUKSI, PRODUKSI, self.pabrik)
		for dt in ("Production Entry",):
			self.assertTrue(frappe.has_permission(dt, "create", user=u))
		for dt in ("Work Order", "Workstation", "Machine Capacity", "Reject Reason", "Company"):
			self.assertTrue(frappe.has_permission(dt, "read", user=u), dt)
		for dt in (
			"Stock Entry",
			"Delivery Note",
			"Sales Order",
			"Sales History",
			"Price List",
			"Account",
			"Stock Settings",
			"Customer Group",
			"Item",
			"BOM",
		):
			self.assertFalse(frappe.has_permission(dt, "read", user=u), dt)

	def test_admin_hanya_lihat_produksi(self):
		u = buat_pengguna("_uji.peran.admin@example.com", ADMIN, ADMIN, self.pabrik)
		self.assertTrue(frappe.has_permission("Production Entry", "read", user=u))
		for hak in ("create", "write", "submit", "cancel", "amend", "delete"):
			self.assertFalse(frappe.has_permission("Production Entry", hak, user=u), hak)

	def test_izin_dicabut(self):
		for doctype, peran, level, _hak in IZIN_DICABUT:
			self.assertFalse(
				frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": peran, "permlevel": level})
			)

	def test_wo_tanpa_transfer(self):
		# Produksi's entries never wait for Admin's Start: new Work Orders take material as output is entered.
		self.assertEqual(frappe.new_doc("Work Order").skip_transfer, 1)
