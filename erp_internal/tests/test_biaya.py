"""Monthly expenses: Expense Entry (Once, Every month, Per machine shift) and the Monthly Expenses report."""

from datetime import date

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal.planning.kapasitas import buat_bom_kapasitas
from erp_internal.planning.report.monthly_expenses.monthly_expenses import (
	execute,
	jumlah,
	pemakaian,
	shift_mesin,
)
from erp_internal.tampilan import ADMIN, PRODUKSI
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_hasil,
	buat_kapasitas,
	buat_kemasan,
	buat_mesin,
	buat_pengguna,
	buat_perusahaan,
	buat_pigmen,
	buat_varian,
	buat_wo,
	isi_kemasan,
	lampirkan,
	stok_awal,
)

JADI, PP = "_UJI-BY-EMBER", "_UJI-BY-PP"


class TestBiaya(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		buat_barang(JADI, "Barang Jadi")
		buat_barang(PP, "Bahan Baku", satuan="Kg")
		buat_bom(JADI, {PP: 0.05}, company=cls.pabrik)
		cls.mesin, cls.mesin_b = buat_mesin(61), buat_mesin(62)

	def setUp(self):
		frappe.db.savepoint("biaya")
		self.addCleanup(frappe.db.rollback, save_point="biaya")
		self.addCleanup(frappe.set_user, "Administrator")
		# Earlier runs' entries of the test company would count in the same months.
		frappe.db.delete("Expense Entry", {"company": self.pabrik})
		self.wo = buat_wo(JADI, self.mesin, company=self.pabrik)
		self.wo_lain = buat_wo(JADI, self.mesin, company=self.pabrik)

	def biaya(self, kategori, nilai, ulang, tanggal, lampir=False):
		doc = frappe.get_doc(
			{
				"doctype": "Expense Entry",
				"company": self.pabrik,
				"posting_date": tanggal,
				"category": kategori,
				"amount": nilai,
				"repeat": ulang,
			}
		).insert()
		if lampir:
			lampirkan("Expense Entry", doc.name)
		doc.submit()
		return doc.name

	def bulan(self, d):
		_kolom, baris, _pesan = execute({"company": self.pabrik, "bulan": d})
		return {r["kategori"]: r["jumlah"] for r in baris if not r["indent"] and r["kategori"]}

	def hasil(self, wo, tanggal, shift):
		"""A submitted Production Entry without its stock entries: the report reads only the entry."""
		pe = frappe.get_doc(
			{
				"doctype": "Production Entry",
				"company": self.pabrik,
				"work_order": wo,
				"posting_date": tanggal,
				"shift": shift,
				"good_qty": 10,
			}
		).insert()
		frappe.db.set_value("Production Entry", pe.name, "docstatus", 1)
		return pe.name

	def pindah_mesin(self, wo, mesin):
		frappe.db.set_value("Work Order", wo, "erp_mesin", mesin)

	def test_sekali(self):
		self.biaya("Listrik", 2_500_000, "Once", date(2026, 11, 5), lampir=True)
		self.assertEqual(self.bulan(date(2026, 11, 1))["Listrik"], 2_500_000)
		self.assertNotIn("Listrik", self.bulan(date(2026, 12, 1)))

	def test_sekali_wajib_lampiran(self):
		with self.assertRaisesRegex(frappe.ValidationError, "real document"):
			self.biaya("Bensin", 100_000, "Once", date(2026, 11, 5), lampir=False)

	def test_tiap_bulan_dan_sampai(self):
		e = self.biaya("Gaji Karyawan Tetap", 9_000_000, "Every month", date(2026, 9, 1))
		self.assertEqual(self.bulan(date(2026, 11, 1))["Gaji Karyawan Tetap"], 9_000_000)
		frappe.db.set_value("Expense Entry", e, "until", date(2026, 10, 15))  # allowed after submit
		self.assertNotIn("Gaji Karyawan Tetap", self.bulan(date(2026, 11, 1)))

	def test_per_shift_mesin(self):
		self.biaya("Gaji Operator", 105_000, "Per machine shift", date(2026, 11, 1))
		self.hasil(self.wo, date(2026, 11, 3), "Shift 1")
		self.hasil(self.wo, date(2026, 11, 3), "Shift 2")
		self.hasil(self.wo_lain, date(2026, 11, 3), "Shift 2")  # same machine, same shift: counted once
		self.hasil(self.wo, date(2026, 11, 4), "Shift 1")
		self.assertEqual(
			shift_mesin(self.pabrik, date(2026, 11, 1), date(2026, 11, 30))[self.mesin],
			{"shift": 3, "hari_24": 1, "hari_12": 1},
		)
		self.assertEqual(self.bulan(date(2026, 11, 1))["Gaji Operator"], 3 * 105_000)
		_kolom, baris, _pesan = execute({"company": self.pabrik, "bulan": date(2026, 11, 1)})
		sub = [r for r in baris if r["indent"]]
		self.assertEqual([r["kategori"] for r in sub], [self.mesin])
		self.assertEqual(sub[0]["keterangan"], "3 shifts · 1 days 24 h · 1 days 12 h")
		self.assertEqual(baris[-1]["jumlah"], 3 * 105_000)  # the Total row

	def test_shift_ikut_mesin_entri(self):
		self.hasil(self.wo, date(2026, 11, 3), "Shift 1")
		self.pindah_mesin(self.wo, self.mesin_b)
		self.hasil(self.wo, date(2026, 11, 4), "Shift 1")
		s = shift_mesin(self.pabrik, date(2026, 11, 1), date(2026, 11, 30))
		self.assertEqual((s[self.mesin]["shift"], s[self.mesin_b]["shift"]), (1, 1))

	def test_tumpang_tindih_ditolak(self):
		self.biaya("Gaji Operator", 105_000, "Per machine shift", date(2026, 11, 1))
		with self.assertRaisesRegex(frappe.ValidationError, "End the earlier"):
			self.biaya("Gaji Operator", 110_000, "Per machine shift", date(2026, 12, 1))

	def test_akhiri_lalu_mulai_baru(self):
		lama = frappe.get_doc(
			"Expense Entry", self.biaya("Gaji Operator", 105_000, "Per machine shift", date(2026, 1, 1))
		)
		lama.until = date(2026, 11, 30)
		lama.save()
		self.biaya("Gaji Operator", 110_000, "Per machine shift", date(2026, 12, 1))
		baru = frappe.get_last_doc("Expense Entry", {"company": self.pabrik, "amount": 110_000})
		lama.reload()
		lama.until = date(2026, 12, 5)  # would overlap the new one again
		with self.assertRaisesRegex(frappe.ValidationError, baru.name):
			lama.save()

	def test_batas_bulan(self):
		self.biaya("Gaji Karyawan Tetap", 1_000, "Every month", date(2026, 1, 31))
		self.assertEqual(self.bulan(date(2026, 2, 1))["Gaji Karyawan Tetap"], 1_000)
		e = self.biaya("Gaji Operator", 100, "Per machine shift", date(2026, 3, 1))
		frappe.db.set_value("Expense Entry", e, "until", date(2026, 3, 15))
		self.hasil(self.wo, date(2026, 3, 15), "Shift 1")
		self.hasil(self.wo, date(2026, 3, 16), "Shift 1")
		self.assertEqual(self.bulan(date(2026, 3, 1))["Gaji Operator"], 100)

	def test_jumlah(self):
		nol = lambda dari, sampai: 0  # noqa: E731
		bulan = (date(2026, 5, 1), date(2026, 5, 31))
		tiap = frappe._dict(
			repeat="Every month", amount=10, posting_date=date(2026, 4, 30), until=date(2026, 5, 2)
		)
		self.assertEqual(jumlah(tiap, *bulan, nol), 10)
		tiap.posting_date = date(2026, 6, 1)
		self.assertEqual(jumlah(tiap, *bulan, nol), 0)
		sekali = frappe._dict(repeat="Once", amount=7, posting_date=date(2026, 5, 31), until=None)
		self.assertEqual(jumlah(sekali, *bulan, nol), 7)
		shift = frappe._dict(repeat="Per machine shift", amount=5, posting_date=date(2026, 5, 10), until=None)
		dipanggil = []
		self.assertEqual(jumlah(shift, *bulan, lambda a, b: dipanggil.append((a, b)) or 4), 20)
		self.assertEqual(dipanggil, [(date(2026, 5, 10), date(2026, 5, 31))])

	def test_until_tidak_sebelum_tanggal(self):
		with self.assertRaisesRegex(frappe.ValidationError, "Until"):
			frappe.get_doc(
				{
					"doctype": "Expense Entry",
					"company": self.pabrik,
					"posting_date": date(2026, 5, 10),
					"category": "Listrik",
					"amount": 1,
					"repeat": "Every month",
					"until": date(2026, 5, 9),
				}
			).insert()

	def test_pemakaian_pigmen_kemasan(self):
		# A product whose capacity BOM has a pigment and a packing line, both stocked with a valuation rate; one
		# Production Entry in November: the November report counts what it used, in Total; December nothing.
		(merah,) = buat_varian("_UJI-BY-GAYUNG", ["Super"], ["Merah"])
		pg = buat_pigmen("Merah", rasio=2)
		plastik = buat_kemasan("_UJI-BY-PLASTIK")
		isi_kemasan("_UJI-BY-GAYUNG", plastik, 50)
		buat_bom_kapasitas(
			buat_kapasitas("_UJI-BY-GAYUNG", self.mesin, material=PP, part_weight=50, runner_weight=0),
			company=self.pabrik,
		)
		awal = date(2026, 11, 1)
		stok_awal(self.pabrik, PP, 100, "Gudang Bahan Baku", tanggal=awal)
		stok_awal(self.pabrik, pg, 1000, "Gudang Bahan Baku", rate=150, tanggal=awal)
		stok_awal(self.pabrik, plastik, 100, "Gudang Bahan Baku", rate=2000, tanggal=awal)
		wo = buat_wo(merah, self.mesin, qty=100, company=self.pabrik)
		buat_hasil(wo, good=100, rejects={"Short Shot": 10}, posting_date=date(2026, 11, 10))
		# good: 100 pcs x 0.05 kg x 2 g/kg = 10 g at 150; 100 / 50 = 2 bags at 2.000. The 10 rejects take 1 g of
		# pigment (their Repack) and no packing.
		self.assertEqual(
			pemakaian(self.pabrik, awal, date(2026, 11, 30)), {"Pigmen": 1_650, "Kemasan": 4_000}
		)
		nov = self.bulan(awal)
		self.assertAlmostEqual(nov["Pigmen"], 1_650)
		self.assertAlmostEqual(nov["Kemasan"], 4_000)
		self.assertAlmostEqual(nov["Total"], 5_650)
		des = self.bulan(date(2026, 12, 1))
		self.assertNotIn("Pigmen", des)
		self.assertNotIn("Kemasan", des)

	def test_hanya_admin(self):
		u = buat_pengguna("_uji.biaya.produksi@example.com", PRODUKSI, PRODUKSI, self.pabrik)
		self.assertFalse(frappe.has_permission("Expense Entry", "read", user=u))
		a = buat_pengguna("_uji.biaya.admin@example.com", ADMIN, ADMIN, self.pabrik)
		self.assertTrue(frappe.has_permission("Expense Entry", "submit", user=a))
		frappe.set_user(u)
		with self.assertRaises(frappe.PermissionError):
			execute({"company": self.pabrik, "bulan": date(2026, 11, 1)})
