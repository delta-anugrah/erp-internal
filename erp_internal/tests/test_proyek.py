"""Projects on stock ERPNext: the Activity Types and the project → task → timesheet flow per bagian."""

from datetime import datetime, timedelta

import frappe
from frappe.desk.form.assign_to import add as tugaskan
from frappe.tests import IntegrationTestCase
from frappe.utils import get_time, getdate, today

from erp_internal.setup import JENIS_KEGIATAN, pastikan_setup
from erp_internal.tests.utils import buat_karyawan, buat_pengguna, buat_perusahaan


class TestProyek(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.kantor = buat_perusahaan("_Uji Kantor", "_UK", "Kantor")

	def test_jenis_kegiatan(self):
		for nama in JENIS_KEGIATAN:
			self.assertEqual(
				frappe.db.get_value("Activity Type", nama, ["costing_rate", "billing_rate", "disabled"]),
				(0, 0, 0),
				nama,
			)

	def test_alur_proyek(self):
		manajer = buat_pengguna("_uji.manajer@contoh.test", "Manajer Proyek", "Manajer Proyek", self.kantor)
		pekerja = buat_pengguna("_uji.pekerja@contoh.test", "Karyawan", "Karyawan", self.kantor)
		emp = buat_karyawan("_Uji Pekerja", self.kantor, user=pekerja)
		self.addCleanup(frappe.set_user, "Administrator")

		# The manager opens a project and gives one task to the employee.
		frappe.set_user(manajer)
		proyek = frappe.get_doc(
			{"doctype": "Project", "project_name": "_Uji Proyek", "company": self.kantor}
		).insert()
		tugas = frappe.get_doc({"doctype": "Task", "subject": "_Uji Tugas", "project": proyek.name}).insert()
		tugaskan({"assign_to": [pekerja], "doctype": "Task", "name": tugas.name})

		# The employee logs 2 hours of development on it and submits the timesheet.
		frappe.set_user(pekerja)
		kemarin = getdate(today()) - timedelta(days=1)
		ts = frappe.get_doc(
			{
				"doctype": "Timesheet",
				"company": self.kantor,
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

	def test_gudang_tidak_baca_proyek(self):
		u = buat_pengguna("_uji.gudang.proyek@contoh.test", "Gudang", "Gudang", None)
		self.assertFalse(frappe.has_permission("Project", "read", user=u))

	def test_idempoten(self):
		def hitung():
			return {dt: frappe.db.count(dt) for dt in ("Activity Type", "Custom DocPerm")}

		pastikan_setup()
		sebelum = hitung()
		pastikan_setup()
		self.assertEqual(hitung(), sebelum)

	def test_timesheet_orang_lain_ditolak(self):
		# Security review 2026-10-28: Employee may submit, but only a timesheet booked to their own Employee.
		pekerja = buat_pengguna("_uji.pekerja2@contoh.test", "Karyawan", "Karyawan", self.kantor)
		buat_karyawan("_Uji Pekerja 2", self.kantor, user=pekerja)
		lain = buat_karyawan("_Uji Orang Lain", self.kantor)
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(pekerja)
		kemarin = getdate(today()) - timedelta(days=1)
		ts = frappe.get_doc(
			{
				"doctype": "Timesheet",
				"company": self.kantor,
				"employee": lain,
				"time_logs": [
					{
						"activity_type": "Pengembangan",
						"from_time": datetime.combine(kemarin, get_time("09:00:00")),
						"hours": 1,
					}
				],
			}
		).insert()
		with self.assertRaises(frappe.PermissionError):
			ts.submit()
