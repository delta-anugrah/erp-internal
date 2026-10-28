"""Office attendance on stock HRMS: the Kantor shift with auto attendance, weekly offs, leave types."""

from datetime import date, datetime, timedelta

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import get_time, getdate, now_datetime, today

from erp_internal.setup import (
	JENIS_CUTI,
	LIBUR_MINGGUAN,
	PENGATURAN_HR,
	SHIFT_KANTOR,
	nama_libur,
	pastikan_libur,
)
from erp_internal.tests.utils import buat_karyawan, buat_perusahaan, jatah_cuti, penugasan_shift

SHIFT = SHIFT_KANTOR["name"]
LOKASI = {"latitude": -6.2, "longitude": 106.8}  # geolocation tracking is on: a check-in needs coordinates


def hari(hari_ini: date, minggu_lalu: int, ke: int) -> date:
	"""Day `ke` (0 = Monday) of the week `minggu_lalu` weeks before the week of `hari_ini`."""
	return hari_ini - timedelta(days=hari_ini.weekday() + 7 * minggu_lalu) + timedelta(days=ke)


class TestAbsen(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hari_ini = getdate(today())
		cls.kantor = buat_perusahaan("_Uji Kantor", "_UK", "Kantor")

	def karyawan(self, nama: str, mulai: date) -> str:
		"""An employee of the office on the Kantor shift from `mulai`, with holiday lists for those years."""
		for tahun in {mulai.year, self.hari_ini.year}:
			pastikan_libur(self.kantor, tahun)
		emp = buat_karyawan(nama, self.kantor)
		penugasan_shift(emp, SHIFT, mulai)
		return emp

	def absen(self, emp: str, waktu: datetime, jenis: str) -> None:
		frappe.get_doc(
			{"doctype": "Employee Checkin", "employee": emp, "time": waktu, "log_type": jenis, **LOKASI}
		).insert()

	def proses(self, dari: date) -> None:
		"""Run the shift's auto attendance from `dari` up to now, as the hourly job does."""
		shift = frappe.get_doc("Shift Type", SHIFT)
		shift.db_set({"process_attendance_after": dari, "last_sync_of_checkin": now_datetime()})
		shift.process_auto_attendance()

	def kehadiran(self, emp: str, tanggal: date):
		return frappe.db.get_value(
			"Attendance",
			{"employee": emp, "attendance_date": tanggal, "docstatus": 1},
			["status", "late_entry"],
			as_dict=True,
		)

	def test_pengaturan_absen(self):
		shift = frappe.get_doc("Shift Type", SHIFT)
		for field, nilai in SHIFT_KANTOR.items():
			if field == "name":
				continue
			kini = shift.get(field)
			if field in ("start_time", "end_time"):  # begin_check_in_before_shift_start_time is minutes
				self.assertEqual(get_time(str(kini)), get_time(nilai), field)  # the DB gives a timedelta
			else:
				self.assertEqual(kini, nilai, field)
		# Lists are per company and year, so the shift takes them from the employee's company by date.
		self.assertFalse(shift.holiday_list)
		self.assertTrue(shift.process_attendance_after)
		for field, nilai in PENGATURAN_HR.items():
			self.assertEqual(frappe.db.get_single_value("HR Settings", field), nilai, field)

		tahun = self.hari_ini.year
		for t in (tahun, tahun + 1):
			daftar = nama_libur(self.kantor, t)
			self.assertEqual(daftar, f"Libur _UK {t}")
			self.assertTrue(
				frappe.db.exists(
					"Holiday List Assignment",
					{"assigned_to": self.kantor, "holiday_list": daftar, "docstatus": 1},
				),
				daftar,
			)
			libur = set(frappe.get_all("Holiday", {"parent": daftar, "weekly_off": 1}, pluck="holiday_date"))
			minggu = [date(t, 3, 2) + timedelta(days=i) for i in range(7)]  # any full week
			self.assertEqual(
				{d for d in minggu if d in libur},
				{d for d in minggu if d.strftime("%A") in LIBUR_MINGGUAN},
				daftar,
			)
		self.assertEqual(
			frappe.db.get_value("Company", self.kantor, "default_holiday_list"),
			nama_libur(self.kantor, tahun),
		)

		for nama, nilai in JENIS_CUTI.items():
			for field, isi in nilai.items():
				self.assertEqual(frappe.db.get_value("Leave Type", nama, field), isi, f"{nama}.{field}")

	def test_hadir_tepat_waktu(self):
		rabu = hari(self.hari_ini, 2, 2)
		emp = self.karyawan("_Uji Hadir", rabu)
		self.absen(emp, datetime.combine(rabu, get_time("08:05:00")), "IN")
		self.absen(emp, datetime.combine(rabu, get_time("17:10:00")), "OUT")
		self.proses(rabu)
		self.assertEqual(self.kehadiran(emp, rabu), {"status": "Present", "late_entry": 0})

	def test_telat(self):
		rabu = hari(self.hari_ini, 3, 2)
		emp = self.karyawan("_Uji Telat", rabu)
		self.absen(emp, datetime.combine(rabu, get_time("08:25:00")), "IN")
		self.absen(emp, datetime.combine(rabu, get_time("17:05:00")), "OUT")
		self.proses(rabu)
		self.assertEqual(self.kehadiran(emp, rabu), {"status": "Present", "late_entry": 1})

	def test_sabtu_bukan_alpa(self):
		# No check-ins at all from a Friday on: the working days become Absent, the weekend does not.
		jumat = hari(self.hari_ini, 4, 4)
		emp = self.karyawan("_Uji Libur", jumat)
		self.proses(jumat)
		self.assertEqual(self.kehadiran(emp, jumat)["status"], "Absent")
		self.assertIsNone(self.kehadiran(emp, jumat + timedelta(days=1)))  # Saturday
		self.assertIsNone(self.kehadiran(emp, jumat + timedelta(days=2)))  # Sunday
		self.assertEqual(self.kehadiran(emp, jumat + timedelta(days=3))["status"], "Absent")  # Monday

	def test_cuti_tahunan_maks_12(self):
		# Monday in two weeks: Monday to Wednesday of the week after next is 13 working days, Tuesday 12.
		senin = self.hari_ini + timedelta(days=14 - self.hari_ini.weekday())
		emp = self.karyawan("_Uji Cuti", self.hari_ini)
		for d in (senin, senin + timedelta(days=16)):
			pastikan_libur(self.kantor, d.year)
		jatah_cuti(emp, "Cuti Tahunan", 12, self.hari_ini, self.hari_ini + timedelta(days=120))

		def cuti(sampai: date):
			return frappe.get_doc(
				{
					"doctype": "Leave Application",
					"employee": emp,
					"company": self.kantor,
					"leave_type": "Cuti Tahunan",
					"from_date": senin,
					"to_date": sampai,
					"status": "Open",
				}
			)

		self.assertRaises(frappe.ValidationError, cuti(senin + timedelta(days=16)).insert)
		boleh = cuti(senin + timedelta(days=15)).insert()
		self.assertEqual(boleh.total_leave_days, 12)
