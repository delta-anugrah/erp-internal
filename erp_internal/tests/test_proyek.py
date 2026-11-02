"""Projects on stock ERPNext: the Activity Types and the project → task → timesheet flow, Admin to an office
worker. Since 2026-11-02 the User profile has no Projects or Employee role (Samuel: three daily jobs only), so the
worker holds those two roles without a profile."""

from datetime import datetime, timedelta

import frappe
from frappe.desk.form.assign_to import add as tugaskan
from frappe.tests import IntegrationTestCase
from frappe.utils import get_time, getdate, today

from erp_internal.setup import JENIS_KEGIATAN, pastikan_setup
from erp_internal.tampilan import ADMIN
from erp_internal.tests.utils import buat_karyawan, buat_pengguna, buat_perusahaan


def pekerja_kantor(email: str, company: str) -> str:
	"""A user with Projects User and Employee, and no Role Profile."""
	u = buat_pengguna(email, None, None, company)
	frappe.get_doc("User", u).add_roles("Projects User", "Employee")
	return u


class TestProyek(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.company = buat_perusahaan("_Uji Pabrik", "_UP")

	def test_jenis_kegiatan(self):
		for nama in JENIS_KEGIATAN:
			self.assertEqual(
				frappe.db.get_value("Activity Type", nama, ["costing_rate", "billing_rate", "disabled"]),
				(0, 0, 0),
				nama,
			)

	def test_alur_proyek(self):
		manajer = buat_pengguna("_uji.manajer@example.com", ADMIN, ADMIN, self.company)
		pekerja = pekerja_kantor("_uji.kantor@example.com", self.company)
		emp = buat_karyawan("_Uji Pekerja", self.company, user=pekerja)
		self.addCleanup(frappe.set_user, "Administrator")

		# The manager opens a project and gives one task to the employee.
		frappe.set_user(manajer)
		proyek = frappe.get_doc(
			{"doctype": "Project", "project_name": "_Uji Proyek", "company": self.company}
		).insert()
		tugas = frappe.get_doc({"doctype": "Task", "subject": "_Uji Tugas", "project": proyek.name}).insert()
		tugaskan({"assign_to": [pekerja], "doctype": "Task", "name": tugas.name})

		# The employee logs 2 hours of development on it and submits the timesheet.
		frappe.set_user(pekerja)
		kemarin = getdate(today()) - timedelta(days=1)
		ts = frappe.get_doc(
			{
				"doctype": "Timesheet",
				"company": self.company,
				"employee": emp,
				"time_logs": [
					{
						"activity_type": "Pengembangan",
						"from_time": datetime.combine(kemarin, get_time("09:00:00")),
						"hours": 2,
						"project": proyek.name,
						"task": tugas.name,
					}
				],
			}
		).insert()
		ts.submit()

		frappe.set_user("Administrator")
		self.assertEqual(frappe.db.get_value("Task", tugas.name, "actual_time"), 2)

	def test_admin_ajukan_timesheet_orang_lain(self):
		# Admin (and Developer) count as supervisors (proyek.PERAN_ATASAN).
		lain = buat_karyawan("_Uji Orang Lain", self.company)
		admin = buat_pengguna("_uji.proyek.admin@example.com", ADMIN, ADMIN, self.company)
		frappe.set_user(admin)
		self.addCleanup(frappe.set_user, "Administrator")
		kemarin = getdate(today()) - timedelta(days=1)
		ts = frappe.get_doc(
			{
				"doctype": "Timesheet",
				"company": self.company,
				"employee": lain,
				"time_logs": [
					{
						"activity_type": "Rapat",
						"from_time": datetime.combine(kemarin, get_time("13:00:00")),
						"hours": 1,
					}
				],
			}
		).insert()
		ts.submit()
		self.assertEqual(ts.docstatus, 1)

	def test_idempoten(self):
		def hitung():
			return {dt: frappe.db.count(dt) for dt in ("Activity Type", "Custom DocPerm")}

		pastikan_setup()
		sebelum = hitung()
		pastikan_setup()
		self.assertEqual(hitung(), sebelum)

	def test_timesheet_orang_lain_ditolak(self):
		# Security review 2026-10-28: an employee may submit, but only a timesheet booked to their own Employee.
		# One with ERPNext's own-Employee User Permission cannot even create one for someone else; one
		# without it (left off by hand) can, and `proyek.cek_pemilik_timesheet` refuses the submit.
		lain = buat_karyawan("_Uji Orang Lain", self.company)
		self.addCleanup(frappe.set_user, "Administrator")
		for nomor, izin_sendiri in ((2, True), (3, False)):
			pekerja = pekerja_kantor(f"_uji.kantor{nomor}@example.com", self.company)
			buat_karyawan(f"_Uji Pekerja {nomor}", self.company, user=pekerja, izin_sendiri=izin_sendiri)
			frappe.set_user(pekerja)
			kemarin = getdate(today()) - timedelta(days=1)
			ts = frappe.get_doc(
				{
					"doctype": "Timesheet",
					"company": self.company,
					"employee": lain,
					"time_logs": [
						{
							"activity_type": "Pengembangan",
							"from_time": datetime.combine(kemarin, get_time("09:00:00")),
							"hours": 1,
						}
					],
				}
			)
			if izin_sendiri:
				self.assertRaises(frappe.PermissionError, ts.insert)
			else:
				ts.insert()
				self.assertRaises(frappe.PermissionError, ts.submit)
			frappe.set_user("Administrator")
