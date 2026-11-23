"""Modules nobody uses (tampilan.MODUL_MATI): locked by permission for everyone but Administrator, and off the menus
and the search bar."""

from unittest.mock import patch

import frappe
from frappe.boot import get_bootinfo
from frappe.tests import IntegrationTestCase

from erp_internal import tampilan
from erp_internal.tampilan import (
	ADMIN,
	DOCTYPE_MATI,
	LAPORAN_MATI,
	MODUL_MATI,
	PERAN_KUNCI,
	PRODUKSI,
	SUPER_ADMIN,
	saring_modul_mati,
)
from erp_internal.tests.test_tampilan import pengguna_profil

# One DocType per kind of module: CRM, Assets, Quality, Support, Payroll (HRMS), and HR's unused ones.
CONTOH_MATI = (
	"Lead",
	"Opportunity",
	"Asset",
	"Quality Goal",
	"Issue",
	"Salary Slip",
	"Job Applicant",
	"Appraisal",
	"Expense Claim",
	"Overtime Slip",
)
# HR's used DocTypes stay open for Admin (and Developer).
HR_TETAP = ("Employee", "Attendance", "Employee Checkin", "Leave Application", "Shift Type", "Holiday List")
# Used DocTypes each profile still reads.
TETAP = {SUPER_ADMIN: "Sales Order", ADMIN: "Sales Order", PRODUKSI: "Delivery Note"}


def custom(dt: str) -> list:
	return frappe.get_all("Custom DocPerm", {"parent": dt}, ["role", "permlevel", "read"])


class TestModulMati(IntegrationTestCase):
	def test_terkunci_kecuali_administrator(self):
		for profil in (SUPER_ADMIN, ADMIN, PRODUKSI):
			u = pengguna_profil(profil, "mati")
			for dt in CONTOH_MATI:
				self.assertFalse(frappe.has_permission(dt, "read", user=u), f"{profil} {dt}")
			self.assertTrue(frappe.has_permission(TETAP[profil], "read", user=u), profil)
		for dt in CONTOH_MATI:
			self.assertTrue(frappe.has_permission(dt, "read", user="Administrator"), dt)

	def test_hr_dipakai_tetap_buka(self):
		for profil in (SUPER_ADMIN, ADMIN):
			u = pengguna_profil(profil, "mati")
			for dt in HR_TETAP:
				self.assertTrue(frappe.has_permission(dt, "read", user=u), f"{profil} {dt}")
		self.assertFalse(set(HR_TETAP) & set(tampilan.doctype_mati()))

	def test_nama_doctype_ada(self):
		# A typo in DOCTYPE_MATI or LAPORAN_MATI would leave that DocType or report open without a word.
		self.assertEqual([dt for dt in DOCTYPE_MATI if not frappe.db.exists("DocType", dt)], [])
		self.assertEqual([r for r in LAPORAN_MATI if not frappe.db.exists("Report", r)], [])
		self.assertLessEqual(set(DOCTYPE_MATI), set(tampilan.doctype_mati()))

	def test_satu_baris_kunci(self):
		for dt in tampilan.doctype_mati():
			self.assertEqual([(r.role, r.permlevel, r.read) for r in custom(dt)], [(PERAN_KUNCI, 0, 1)], dt)
		self.assertNotIn("Bulk Transaction Log", tampilan.doctype_mati())

	def test_lepas_kunci(self):
		# A module taken out of MODUL_MATI gets its own permissions back on the next run; put back, locked again.
		tanpa = tuple(m for m in MODUL_MATI if m != "Telephony")
		try:
			with patch.object(tampilan, "MODUL_MATI", tanpa):
				tampilan._kunci_modul()
			self.assertEqual(custom("Call Log"), [])
		finally:
			tampilan._kunci_modul()
		self.assertEqual(len(custom("Call Log")), 1)

	def test_kunci_tangan_tidak_disentuh(self):
		# A DocType someone restricted to Administrator by hand is no lock of ours: a run leaves it.
		dt = "Note"
		frappe.get_doc(
			{
				"doctype": "Custom DocPerm",
				"parent": dt,
				"parenttype": "DocType",
				"parentfield": "permissions",
				"role": PERAN_KUNCI,
				"read": 1,
			}
		).insert(ignore_permissions=True)
		tampilan._kunci_modul()
		self.assertEqual(len(custom(dt)), 1)

	def test_blok_menu(self):
		# Developer's Module Profile and Administrator's own blocks hide the modules from every menu.
		semua = set(tampilan.modul_aplikasi())
		for user in (pengguna_profil(SUPER_ADMIN, "mati"), "Administrator"):
			blok = {b.module for b in frappe.get_doc("User", user).block_modules}
			self.assertTrue(set(MODUL_MATI) & semua <= blok, user)

	def test_boot_tanpa_modul_mati(self):
		# Even Administrator's boot offers no locked DocType or its reports to the search bar.
		boot = get_bootinfo()
		saring_modul_mati(boot)
		mati = set(tampilan.doctype_mati())
		self.assertFalse(mati & set(boot.user.can_read))
		self.assertFalse(mati & set(boot.user.can_search))
		self.assertFalse(any((v or {}).get("ref_doctype") in mati for v in boot.allowed_reports.values()))
		self.assertFalse(any((v or {}).get("module") in MODUL_MATI for v in boot.allowed_reports.values()))
		self.assertNotIn("Lead Conversion Time", boot.allowed_reports)  # CRM, though it reads Communication
		self.assertFalse(any(d.get("module") in MODUL_MATI for d in boot.dashboards))
		self.assertIn("Sales Order", boot.user.can_read)

	def test_laporan_mati(self):
		# A report of a locked module is disabled, even one reading an open DocType; taken out of the list it comes
		# back. A report outside the list stays as it is.
		self.assertEqual(frappe.db.get_value("Report", "Lead Conversion Time", "disabled"), 1)
		self.assertEqual(frappe.db.get_value("Report", "Stock Balance", "disabled"), 0)
		# HR: reports on a locked DocType or in LAPORAN_MATI are off, attendance and leave reports stay.
		for nama in ("Unpaid Expense Claim", "Appraisal Overview", "Vehicle Expenses"):
			self.assertEqual(frappe.db.get_value("Report", nama, "disabled"), 1, nama)
		for nama in ("Monthly Attendance Sheet", "Employee Leave Balance"):
			self.assertEqual(frappe.db.get_value("Report", nama, "disabled"), 0, nama)
		tanpa = tuple(m for m in MODUL_MATI if m != "CRM")
		try:
			with patch.object(tampilan, "MODUL_MATI", tanpa):
				tampilan._kunci_modul()
			self.assertEqual(frappe.db.get_value("Report", "Lead Conversion Time", "disabled"), 0)
		finally:
			tampilan._kunci_modul()
		self.assertEqual(frappe.db.get_value("Report", "Lead Conversion Time", "disabled"), 1)

	def test_master_karyawan(self):
		# The Employee form's assign buttons ask for Salary Structure (Payroll, locked): False, not a Permission Error.
		self.assertIn(
			"erp_internal.tampilan.master_karyawan",
			frappe.get_hooks("override_whitelisted_methods")[
				"hrms.overrides.employee_master.get_assignable_masters"
			],
		)
		company = frappe.get_all("Company", pluck="name", limit=1)[0]
		frappe.set_user(pengguna_profil(ADMIN, "mati"))
		try:
			hasil = tampilan.master_karyawan(company)
		finally:
			frappe.set_user("Administrator")
		self.assertIs(hasil["Salary Structure"], False)
		self.assertEqual(set(hasil), {"Leave Policy", "Salary Structure", "Shift Schedule"})

	def test_boot_tak_pernah_gagal(self):
		saring_modul_mati(frappe._dict(user=None))
