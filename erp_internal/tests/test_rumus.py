"""The forecast math: pure functions, no database."""

from datetime import date

from frappe.tests import UnitTestCase

from erp_internal.planning.rumus import ada_riwayat, bulan_acuan, bulatkan, rata_rata


class TestRumusPerkiraan(UnitTestCase):
	def test_bulan_acuan_sebelum_bulan_berjalan(self):
		self.assertEqual(
			bulan_acuan(date(2026, 11, 20), date(2026, 12, 1)),
			[date(2026, 8, 1), date(2026, 9, 1), date(2026, 10, 1)],
		)

	def test_bulan_acuan_dari_mundur(self):
		self.assertEqual(
			bulan_acuan(date(2026, 11, 20), date(2026, 10, 15)),
			[date(2026, 7, 1), date(2026, 8, 1), date(2026, 9, 1)],
		)

	def test_bulan_acuan_lewat_tahun(self):
		self.assertEqual(
			bulan_acuan(date(2027, 1, 5), date(2027, 2, 1)),
			[date(2026, 10, 1), date(2026, 11, 1), date(2026, 12, 1)],
		)

	def test_rata_rata_bulan_kosong_nol(self):
		b = [date(2026, 8, 1), date(2026, 9, 1), date(2026, 10, 1)]
		self.assertAlmostEqual(
			rata_rata({date(2026, 9, 1): 300, date(2026, 10, 1): 400}, b), 233.3333, places=3
		)

	def test_bulatkan(self):
		self.assertEqual(
			[bulatkan(x) for x in (233.34, 233.0, 233.0000000001, 0, -5, 0.0000001)], [234, 233, 233, 0, 0, 0]
		)

	def test_ada_riwayat(self):
		b = [date(2026, 9, 1)]
		self.assertEqual(
			[ada_riwayat({}, b), ada_riwayat({b[0]: 0}, b), ada_riwayat({b[0]: 5}, b)], [False, False, True]
		)
