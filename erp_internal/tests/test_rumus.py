"""The forecast math: pure functions, no database."""

from datetime import date

from frappe.tests import UnitTestCase

from erp_internal.planning.rumus import (
	STATUS,
	ada_riwayat,
	bulan_acuan,
	bulatkan,
	hitung_jadwal,
	hitung_kurang,
	rata_rata,
)


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


H = date(2026, 11, 20)


class TestRumusSiapOrder(UnitTestCase):
	def test_contoh_spesifikasi(self):
		kurang = hitung_kurang(stok=100, terbuka=300, perkiraan=1000, dipesan=300, produksi=50, safety=20)
		self.assertEqual(kurang, 870)
		j = hitung_jadwal(
			kurang,
			lama=5.35,
			terbuka=300,
			terdekat=date(2026, 11, 25),
			stok=100,
			produksi=50,
			awal=date(2026, 11, 1),
			hari_ini=H,
		)
		self.assertEqual(
			j, {"tanggal_butuh": date(2026, 11, 25), "mulai": date(2026, 11, 19), "status": "Late"}
		)

	def test_aman(self):
		self.assertEqual(
			hitung_jadwal(0, None, 0, None, 500, 0, date(2026, 11, 1), H),
			{"tanggal_butuh": None, "mulai": None, "status": "OK"},
		)

	def test_isi_lama_produksi(self):
		self.assertEqual(
			hitung_jadwal(10, None, 10, H, 0, 0, date(2026, 11, 1), H)["status"], "Set lead time"
		)

	def test_mulai_minggu_ini_dan_terjadwal(self):
		self.assertEqual(
			hitung_jadwal(10, 2, 10, date(2026, 11, 25), 0, 0, date(2026, 11, 1), H)["status"],
			"Start this week",
		)
		self.assertEqual(
			hitung_jadwal(10, 2, 10, date(2026, 12, 15), 0, 0, date(2026, 11, 1), H)["status"], "Scheduled"
		)

	def test_kurang_cuma_dari_perkiraan(self):
		# orders are covered, so the need date is the month start, or today once it has started
		self.assertEqual(
			hitung_jadwal(100, 3, 0, None, 0, 0, date(2026, 12, 1), H)["tanggal_butuh"], date(2026, 12, 1)
		)
		self.assertEqual(hitung_jadwal(100, 3, 0, None, 0, 0, date(2026, 11, 1), H)["tanggal_butuh"], H)

	def test_kurang_tidak_minus_dan_dibulatkan(self):
		self.assertEqual(hitung_kurang(500, 10, 0, 0, 0, 0), 0)
		self.assertEqual(hitung_kurang(0, 0.2, 0, 0, 0, 0), 1)
		self.assertEqual(hitung_kurang(0, 0, 100, 300, 0, 0), 0)  # ordered beyond the forecast

	def test_urutan_status(self):
		self.assertEqual(STATUS, ("Late", "Start this week", "Set lead time", "Scheduled", "OK"))
