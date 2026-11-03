"""The setup wizard's hook (wizard.py): the company marker, the wizard's account, the one-time data seed."""

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal import wizard
from erp_internal.setup import perusahaan
from erp_internal.tampilan import ADMIN, DEVELOPER
from erp_internal.tests.utils import buat_pengguna, buat_perusahaan

MUAT = [f"erp_internal.{m}.muat" for m in wizard.MUAT]
EMAIL = "_uji.wizard@example.com"


def profil(email: str) -> list[str]:
	return [r.role_profile for r in frappe.get_doc("User", email).role_profiles]


class TestWizard(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		if not frappe.db.exists("User", EMAIL):
			frappe.get_doc(
				{"doctype": "User", "email": EMAIL, "first_name": "Wizard", "send_welcome_email": 0}
			).insert(ignore_permissions=True)

	def setUp(self):
		frappe.db.set_value("Company", self.pabrik, "erp_aktif", 0)

	def tearDown(self):
		frappe.db.set_value("Company", self.pabrik, "erp_aktif", 1)

	def test_lewat_di_situs_tes(self):
		with patch("frappe.enqueue") as antre:
			wizard.selesai({"company_name": self.pabrik})
		self.assertEqual(frappe.db.get_value("Company", self.pabrik, "erp_aktif"), 0)
		antre.assert_not_called()

	def test_centang_dan_antre(self):
		# The Developer Role Profile is made by setup after the wizard: the hook only passes the account on
		with patch("frappe.enqueue") as antre:
			wizard._selesai({"company_name": self.pabrik, "email": EMAIL})
		self.assertEqual(frappe.db.get_value("Company", self.pabrik, "erp_aktif"), 1)
		kami = [c for c in antre.call_args_list if c.args[:1] == ("erp_internal.wizard.lanjutkan",)]
		self.assertEqual(len(kami), 1)
		self.assertEqual(kami[0].kwargs["job_id"], "erp_lanjutkan")
		self.assertEqual(kami[0].kwargs["developer"], EMAIL)

	def test_developer_sesudah_setup(self):
		with patch("erp_internal.setup.pastikan_setup"):
			wizard.lanjutkan(cetak=False, developer=EMAIL)
			wizard.lanjutkan(cetak=False, developer="_uji.tidak.ada@example.com")  # no user: nothing
		self.assertEqual(profil(EMAIL), [DEVELOPER])

	def test_tidak_pernah_gagal(self):
		# One step failing never fails the wizard, and the rest still runs
		sebelum = frappe.db.count("Error Log")
		with (
			patch("frappe.enqueue") as antre,
			patch("frappe.db.set_value", side_effect=Exception("x")),
		):
			wizard._selesai({"company_name": self.pabrik, "email": EMAIL})
		self.assertEqual(frappe.db.count("Error Log"), sebelum + 1)
		self.assertTrue([c for c in antre.call_args_list if c.args[:1] == ("erp_internal.wizard.lanjutkan",)])

	def test_data_sekali(self):
		bawaan = {}
		with (
			patch("erp_internal.setup.pastikan_setup"),
			patch("frappe.db.get_default", side_effect=lambda k, *a, **kw: bawaan.get(k)),
			patch("frappe.db.set_default", side_effect=lambda k, v, *a, **kw: bawaan.__setitem__(k, v)),
			patch(MUAT[0]) as m1,
			patch(MUAT[1]) as m2,
			patch(MUAT[2]) as m3,
		):
			wizard.lanjutkan(cetak=False)
			for m in (m1, m2, m3):
				m.assert_not_called()  # no erp_produksi: never
			with patch.dict(frappe.conf, {"erp_produksi": 1}):
				wizard.lanjutkan(cetak=False)
				wizard.lanjutkan(cetak=False)
			for m in (m1, m2, m3):
				m.assert_called_once()
		self.assertTrue(bawaan.get(wizard.PENANDA_DATA))

	def test_sebelum_wizard(self):
		with (
			patch("frappe.is_setup_complete", return_value=False),
			patch("erp_internal.setup.pastikan_setup") as siap,
			patch.dict(frappe.conf, {"erp_produksi": 1}),
			patch(MUAT[0]) as m1,
		):
			wizard.lanjutkan(cetak=False)
		siap.assert_not_called()
		m1.assert_not_called()

	def test_akun_dapat_perusahaan(self):
		frappe.db.set_value("Company", self.pabrik, "erp_aktif", 1)
		email = "_uji.wizard.admin@example.com"
		buat_pengguna(email, ADMIN, ADMIN, None)
		frappe.db.delete("User Permission", {"user": email, "allow": "Company"})
		with patch("erp_internal.setup.pastikan_setup"):
			wizard.lanjutkan(cetak=False)
		company = perusahaan()[0]
		self.assertTrue(
			frappe.db.exists("User Permission", {"user": email, "allow": "Company", "for_value": company})
		)
