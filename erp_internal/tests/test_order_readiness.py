"""Order Readiness: each column from the company's own records (design §10, Review Focus 2, 4 and 5)."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, get_first_day, getdate, today

from erp_internal.planning.report.order_readiness.order_readiness import data, execute
from erp_internal.setup import gudang
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_order,
	buat_pelanggan,
	buat_pengguna,
	buat_perkiraan,
	buat_perusahaan,
	buat_varian,
	lama_produksi,
	stok_awal,
	tahun_fiskal,
)


class TestOrderReadiness(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.hari_ini = getdate(today())
		cls.awal = getdate(get_first_day(cls.hari_ini))
		for d in (cls.awal, add_days(cls.hari_ini, -10)):
			tahun_fiskal(getdate(d))
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.pabrik2 = buat_perusahaan("_Uji Pabrik 2", "_UP2")
		cls.pelanggan = buat_pelanggan("_Uji Pelanggan")
		cls.bahan = buat_barang("_UJI-SO-BAHAN", "Bahan Baku", satuan="Kg")

	def baris(self, kode: str, company: str | None = None) -> dict:
		rows = data(company or self.pabrik, self.awal, None, "Barang Jadi", self.hari_ini)
		return next(r for r in rows if r["item_code"] == kode)

	def order(self, kode, qty, kirim_hari=5, company=None, **kw):
		return buat_order(
			company or self.pabrik,
			self.pelanggan,
			kode,
			qty,
			self.hari_ini,
			add_days(self.hari_ini, kirim_hari),
			**kw,
		)

	def perkiraan(self, kode, qty, company=None, tanggal=None):
		sf = buat_perkiraan(company or self.pabrik, [kode], self.awal, 1, tanggal=tanggal)
		sf.generate_demand()
		for row in sf.items:
			row.demand_qty = qty
		sf.save()
		sf.submit()
		return sf

	def perintah(self, kode, qty, company=None):
		company = company or self.pabrik
		bom = buat_bom(kode, {self.bahan: 1}, company=company)
		wo = frappe.get_doc(
			{"doctype": "Work Order", "production_item": kode, "bom_no": bom, "qty": qty, "company": company}
		).insert()
		wo.submit()
		return wo

	def test_template_tidak_ikut(self):
		# A template is never stocked or sold; only its variants are (Abel, 2026-10-29: "BASKOM-20: Baskom 20" with 0s).
		varian = buat_varian("_UJI-OR-TPL", ["Super"], ["Merah"])
		kode = [r["item_code"] for r in data(self.pabrik, self.awal, None, "Barang Jadi", self.hari_ini)]
		self.assertNotIn("_UJI-OR-TPL", kode)
		self.assertIn(varian[0], kode)

	def test_angka_per_kolom(self):
		# The spec's example: kurang 870, lama 870 / 200 + 1 = 5.35, the start already passed.
		x = buat_barang("_UJI-SO-ANGKA", "Barang Jadi", safety_stock=20)
		stok_awal(self.pabrik, x, 100, "Gudang Barang Jadi")
		self.order(x, 300, kirim_hari=5)
		self.perkiraan(x, 1000)
		self.perintah(x, 50)
		lama_produksi(x, 200, cadangan=1)
		r = self.baris(x)
		self.assertEqual(
			{k: r[k] for k in ("stok", "terbuka", "perkiraan", "dipesan", "produksi", "safety")},
			{"stok": 100, "terbuka": 300, "perkiraan": 1000, "dipesan": 300, "produksi": 50, "safety": 20},
		)
		self.assertEqual((r["kurang"], r["lama"], r["status"]), (870, 5.35, "Late"))
		self.assertEqual(r["tanggal_butuh"], getdate(add_days(self.hari_ini, 5)))
		self.assertEqual(r["mulai"], getdate(add_days(self.hari_ini, -1)))

	def test_order_satuan_lain(self):
		# Review Focus 2: 2 Karton of 24 are 48 Pcs.
		y = buat_barang("_UJI-SO-KARTON", "Barang Jadi", konversi={"Karton": 24})
		self.order(y, 2, satuan="Karton")
		r = self.baris(y)
		self.assertEqual((r["terbuka"], r["dipesan"]), (48, 48))

	def test_tanpa_lama_produksi(self):
		# Review Focus 4: no Item Lead Time, so no invented date.
		z = buat_barang("_UJI-SO-TANPA-LAMA", "Barang Jadi")
		self.order(z, 10)
		r = self.baris(z)
		self.assertGreater(r["kurang"], 0)
		self.assertEqual((r["status"], r["mulai"], r["lama"]), ("Set lead time", None, None))

	def test_perusahaan_lain_diabaikan(self):
		# Review Focus 5: another factory's stock, orders, forecast and Work Order change nothing.
		w = buat_barang("_UJI-SO-LAIN", "Barang Jadi")
		stok_awal(self.pabrik2, w, 500, "Gudang Barang Jadi")
		self.order(w, 300, company=self.pabrik2)
		self.perkiraan(w, 1000, company=self.pabrik2)
		self.perintah(w, 50, company=self.pabrik2)
		r = self.baris(w)
		self.assertEqual(
			[r[k] for k in ("stok", "terbuka", "perkiraan", "dipesan", "produksi", "kurang")], [0] * 6
		)
		self.assertEqual(r["status"], "OK")
		self.assertEqual(self.baris(w, self.pabrik2)["terbuka"], 300)

	def test_order_selesai_diabaikan(self):
		v = buat_barang("_UJI-SO-SELESAI", "Barang Jadi")
		self.order(v, 100).update_status("Closed")
		# A Completed order with undelivered lines: set directly, as ERPNext would after closing it out.
		self.order(v, 200).db_set("status", "Completed")
		self.order(v, 7)
		self.assertEqual(self.baris(v)["terbuka"], 7)

	def test_perkiraan_terbaru_dipakai(self):
		u = buat_barang("_UJI-SO-TERBARU", "Barang Jadi")
		self.perkiraan(u, 500, tanggal=add_days(self.hari_ini, -10))
		self.perkiraan(u, 800, tanggal=self.hari_ini)
		self.assertEqual(self.baris(u)["perkiraan"], 800)

	def test_urutan_dan_execute(self):
		kolom, rows = execute({"company": self.pabrik})
		self.assertEqual([k["fieldname"] for k in kolom][-1], "status")
		self.assertTrue(all(r["item_code"] for r in rows))
		self.assertEqual(
			rows,
			sorted(
				rows,
				key=lambda r: ("Late", "Start this week", "Set lead time", "Scheduled", "OK").index(
					r["status"]
				),
			),
		)
		self.assertTrue(
			all(frappe.db.get_value("Item", r["item_code"], "item_group") == "Barang Jadi" for r in rows)
		)

	def test_gudang_perusahaan_lain_ditolak(self):
		# Security review 2026-10-28: the warehouse filter must belong to the chosen company.
		with self.assertRaises(frappe.ValidationError):
			execute({"company": self.pabrik, "gudang": gudang(self.pabrik2, "Gudang Barang Jadi")})

	def test_perusahaan_tanpa_izin_ditolak(self):
		# A user held to one company by User Permission cannot read another company's figures.
		u = buat_pengguna("_uji.or.user@example.com", "Produksi", None, self.pabrik)
		frappe.set_user(u)
		self.addCleanup(frappe.set_user, "Administrator")
		with self.assertRaises(frappe.PermissionError):
			execute({"company": self.pabrik2})
