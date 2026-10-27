"""Fill from History: the average of the last full months of Sales History and submitted orders."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, add_months, get_first_day, getdate, today

from erp_internal.planning.forecast import isi, isi_dari_riwayat
from erp_internal.tests.utils import (
	buat_barang,
	buat_order,
	buat_pelanggan,
	buat_pengguna,
	buat_perkiraan,
	buat_perusahaan,
	riwayat,
	tahun_fiskal,
)


def m(k: int):
	"""The first day of the month `k` months before today (negative: after)."""
	return getdate(get_first_day(add_months(getdate(today()), -k)))


class TestForecast(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		for k in (3, 2, 1, -1):
			tahun_fiskal(m(k))
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP", "Pabrik")
		cls.pabrik2 = buat_perusahaan("_Uji Pabrik 2", "_UP2", "Pabrik")
		cls.pelanggan = buat_pelanggan("_Uji Pelanggan")
		cls.hari_ini = getdate(today())

	def barang(self, kode: str, **kw) -> str:
		return buat_barang(kode, "Barang Jadi", **kw)

	def order(self, kode, qty, k, company=None, **kw):
		tanggal = add_days(m(k), 4)
		return buat_order(
			company or self.pabrik, self.pelanggan, kode, qty, tanggal, add_days(tanggal, 7), **kw
		)

	def isi_untuk(self, *kode):
		doc = buat_perkiraan(self.pabrik, list(kode), m(-1), 2)
		hasil = isi(doc, self.hari_ini)
		per_item = {}
		for row in doc.items:
			per_item.setdefault(row.item_code, set()).add(row.demand_qty)
		return hasil, per_item

	def test_rata_rata_dari_riwayat(self):
		a = self.barang("_UJI-FA")
		for k in (3, 2, 1):
			riwayat(self.pabrik, a, m(k), 300)
		hasil, per_item = self.isi_untuk(a)
		self.assertEqual(per_item[a], {300})
		self.assertEqual(hasil["diisi"], 2)  # one row per period
		self.assertEqual(hasil["bulan"], [m(k).strftime("%m-%Y") for k in (3, 2, 1)])
		self.assertEqual(hasil["tanpa_riwayat"], [])

	def test_order_ikut_dihitung(self):
		b = self.barang("_UJI-FB")
		self.order(b, 100, 2)
		self.order(b, 200, 1)
		self.assertEqual(self.isi_untuk(b)[1][b], {100})

	def test_satuan_lain_dihitung_stok_qty(self):
		# Review Focus 2: 3 Karton of 24 a month is 72 Pcs.
		c = self.barang("_UJI-FC", konversi={"Karton": 24})
		for k in (3, 2, 1):
			self.order(c, 3, k, satuan="Karton")
		self.assertEqual(self.isi_untuk(c)[1][c], {72})

	def test_draf_batal_dan_amend(self):
		# Review Focus 3: only submitted orders count, and an amended order counts once.
		d = self.barang("_UJI-FD")
		self.order(d, 999, 2, submit=False)
		self.order(d, 999, 2).cancel()
		asal = self.order(d, 30, 2)
		asal.cancel()
		ubah = frappe.copy_doc(asal)
		ubah.amended_from = asal.name
		ubah.insert(ignore_permissions=True)
		ubah.submit()
		self.assertEqual(self.isi_untuk(d)[1][d], {10})

	def test_perusahaan_lain_diabaikan(self):
		# Review Focus 5: another factory's orders change nothing.
		a = self.barang("_UJI-FA2")
		for k in (3, 2, 1):
			riwayat(self.pabrik, a, m(k), 300)
		self.order(a, 900, 2, company=self.pabrik2)
		riwayat(self.pabrik2, a, m(1), 900)
		self.assertEqual(self.isi_untuk(a)[1][a], {300})

	def test_tanpa_riwayat(self):
		e = self.barang("_UJI-FE")
		hasil, per_item = self.isi_untuk(e)
		self.assertEqual(per_item[e], {0})
		self.assertIn(e, hasil["tanpa_riwayat"])

	def test_ditolak_sesudah_submit_atau_mingguan(self):
		a = self.barang("_UJI-FA3")
		ajukan = buat_perkiraan(self.pabrik, [a], m(-1), 1)
		isi(ajukan, self.hari_ini)
		ajukan.save()
		ajukan.submit()
		self.assertRaises(frappe.ValidationError, isi_dari_riwayat, ajukan.name)

		mingguan = buat_perkiraan(self.pabrik, [a], m(-1), 1)
		mingguan.frequency = "Weekly"
		mingguan.save()
		self.assertRaises(frappe.ValidationError, isi_dari_riwayat, mingguan.name)

	def test_tombol_menyimpan(self):
		a = self.barang("_UJI-FA4")
		for k in (3, 2, 1):
			riwayat(self.pabrik, a, m(k), 50)
		doc = buat_perkiraan(self.pabrik, [a], m(-1), 2)
		isi_dari_riwayat(doc.name)
		self.assertEqual(
			set(frappe.get_all("Sales Forecast Item", {"parent": doc.name}, pluck="demand_qty")), {50}
		)

	def test_izin(self):
		a = self.barang("_UJI-FA5")
		doc = buat_perkiraan(self.pabrik, [a], m(-1), 1)
		u = buat_pengguna("_uji.gudang.perkiraan@contoh.test", "Gudang", "Gudang", self.pabrik)
		frappe.set_user(u)
		self.addCleanup(frappe.set_user, "Administrator")
		self.assertRaises(frappe.PermissionError, isi_dari_riwayat, doc.name)
