"""Plan vs Actual: target per machine, day, Work Order and shift against what Production Entries recorded."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, getdate, today

from erp_internal.planning.report.plan_vs_actual.plan_vs_actual import (
	KELOMPOK,
	TANPA_MESIN,
	bagi_shift,
	data,
	execute,
	kolom as susun_kolom,
	target_harian,
)
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_kapasitas,
	buat_mesin,
	buat_pengguna,
	buat_perusahaan,
	buat_varian,
)

HARI_INI = getdate(today())
JADI, PP = "_UJI-PA-EMBER", "_UJI-PA-PP"


def d(n: int):
	return add_days(HARI_INI, n)


def jumlah(rows: list[dict]) -> tuple:
	return tuple(sum(r[n] for r in rows) for n in ("target", "good", "reject"))


class TestPlanVsActual(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.pabrik2 = buat_perusahaan("_Uji Pabrik 2", "_UP2")
		buat_barang(JADI, "Barang Jadi")
		buat_barang(PP, "Bahan Baku", satuan="Kg")
		cls.bom = buat_bom(JADI, {PP: 0.05}, company=cls.pabrik)
		cls.m1, cls.m2 = buat_mesin(51), buat_mesin(52)

	def setUp(self):
		frappe.db.savepoint("plan_vs_actual")
		self.addCleanup(frappe.db.rollback, save_point="plan_vs_actual")
		self.addCleanup(frappe.set_user, "Administrator")

	def order(self, qty=600, mulai=-2, selesai=-1, mesin="m1", item=JADI, company=None, bom=None, **lain):
		company = company or self.pabrik
		wo = frappe.get_doc(
			{
				"doctype": "Work Order",
				"production_item": item,
				"bom_no": bom or self.bom,
				"qty": qty,
				"company": company,
				"erp_mesin": getattr(self, mesin) if mesin else None,
				"skip_transfer": 1,
				"planned_start_date": d(mulai),
				"planned_end_date": d(selesai) if selesai is not None else None,
				**lain,
			}
		).insert()
		wo.submit()
		return wo.name

	def hasil(self, wo, hari, good, rejects=None, shift="Shift 1", jam=8, mesin=None):
		"""A submitted Production Entry written without its stock entries (the report reads only the entry)."""
		order = frappe.db.get_value("Work Order", wo, ["company", "erp_mesin"], as_dict=True)
		pe = frappe.get_doc(
			{
				"doctype": "Production Entry",
				"company": order.company,
				"work_order": wo,
				"workstation": mesin or order.erp_mesin,
				"posting_date": d(hari),
				"shift": shift,
				"hours": jam,
				"good_qty": good,
				"rejects": [{"reason": r, "qty": q} for r, q in (rejects or {}).items()],
			}
		).insert()
		frappe.db.set_value("Production Entry", pe.name, "docstatus", 1)
		return pe

	def f(self, **lain):
		return frappe._dict(
			{"company": self.pabrik, "from_date": d(-7), "to_date": d(-1), "group_by": "Machine + Day"} | lain
		)

	def test_target_harian(self):
		self.assertEqual(target_harian(900, d(-2), d(0)), {d(-2): 300, d(-1): 300, d(0): 300})
		self.assertEqual(target_harian(900, d(0), None), {d(0): 900})
		self.assertEqual(target_harian(900, d(0), d(-1)), {d(0): 900})

	def test_bagi_shift(self):
		self.assertEqual(bagi_shift(300, {"Shift 1": 8, "Shift 2": 4}), {"Shift 1": 200, "Shift 2": 100})
		self.assertEqual(bagi_shift(300, {}), {"Shift 1": 100, "Shift 2": 100, "Shift 3": 100})
		self.assertEqual(bagi_shift(300, {"Shift 1": 0}), {"Shift 1": 100, "Shift 2": 100, "Shift 3": 100})

	def test_mesin_hari(self):
		wo = self.order()
		self.hasil(wo, -2, 250, {"Short Shot": 10})
		self.hasil(wo, -1, 300)
		rows = data(self.f())
		self.assertEqual(
			[(r["tanggal"], r["target"], r["good"], r["reject"], r["capai"]) for r in rows],
			[(d(-2), 300, 250, 10, 250 / 3), (d(-1), 300, 300, 0, 100)],
		)
		self.assertEqual(rows[0]["r_short_shot"], 10)
		self.assertAlmostEqual(rows[0]["persen_reject"], 10 / 260 * 100)
		self.assertEqual(rows[0]["mesin"], self.m1)

	def test_dua_wo_satu_mesin(self):
		a, b = self.order(), self.order(qty=300)
		self.hasil(a, -2, 100)
		self.hasil(b, -2, 50, {"Flashing": 5}, shift="Shift 2")
		rows = data(self.f(group_by="Machine"))
		self.assertEqual(len(rows), 1)
		self.assertEqual((rows[0]["target"], rows[0]["good"], rows[0]["reject"]), (900, 150, 5))
		self.assertEqual(rows[0]["r_flashing"], 5)

	def test_kapasitas(self):
		buat_kapasitas(JADI, self.m1, material=PP)  # 20 s, 4 cavities: 720 pcs/h
		wo = self.order(mesin="m1")
		wo2 = self.order(mesin="m2")
		self.hasil(wo, -2, 5000, jam=8)
		self.hasil(wo2, -2, 100, jam=8)
		rows = data(self.f(target_dari="Capacity"))
		cari = {r["mesin"]: r for r in rows if r["tanggal"] == d(-2)}
		self.assertEqual(cari[self.m1]["target"], 5760)
		self.assertIsNone(cari[self.m1]["catatan"])
		self.assertIsNone(cari[self.m2]["target"])
		self.assertEqual(cari[self.m2]["catatan"], "No capacity")
		self.assertIsNone(cari[self.m2]["capai"])
		# A planned day with a capacity row and no entry: target 0, not None.
		kosong = [r for r in rows if r["mesin"] == self.m1 and r["tanggal"] == d(-1)]
		self.assertEqual((kosong[0]["target"], kosong[0]["good"]), (0, 0))

	def test_template_dan_tanpa_mesin(self):
		template = "_UJI-PA-TPL"
		varian = buat_varian(template, ["A"], ["Merah"])[0]
		bom = buat_bom(varian, {PP: 0.05}, company=self.pabrik)
		wo = self.order(item=varian, bom=bom)
		tanpa = self.order(mesin=None, qty=100, item=varian, bom=bom)
		self.hasil(wo, -2, 10)
		rows = data(self.f(item=template))
		self.assertTrue(rows)
		self.assertEqual({r["mesin"] for r in rows}, {self.m1, TANPA_MESIN})
		self.assertEqual(rows[-1]["mesin"], TANPA_MESIN)
		self.assertEqual(sum(r["target"] for r in rows if r["mesin"] == TANPA_MESIN), 100)
		self.assertEqual(data(self.f(item=JADI)), [])
		# A machine filter drops the No machine rows.
		self.assertEqual({r["mesin"] for r in data(self.f(item=template, workstation=self.m1))}, {self.m1})
		self.assertTrue(tanpa)

	def test_target_tanpa_hasil(self):
		self.order()
		rows = data(self.f())
		self.assertEqual(
			[(r["tanggal"], r["target"], r["good"], r["capai"]) for r in rows],
			[(d(-2), 300, 0, 0), (d(-1), 300, 0, 0)],
		)

	def test_perusahaan_lain(self):
		lain = self.order(company=self.pabrik2, bom=buat_bom(JADI, {PP: 0.05}, company=self.pabrik2))
		self.hasil(lain, -2, 77)
		self.assertEqual(data(self.f()), [])
		self.assertEqual(sum(r["good"] for r in data(self.f(company=self.pabrik2))), 77)
		email = buat_pengguna("pa-tanpa@example.com", None, None, None)
		frappe.set_user(email)
		with self.assertRaises(frappe.PermissionError):
			execute(self.f(company=self.pabrik2))

	def test_pembatalan_dan_draft(self):
		wo = self.order()
		pe = self.hasil(wo, -2, 40)
		frappe.db.set_value("Production Entry", pe.name, "docstatus", 2)
		self.assertEqual(sum(r["good"] for r in data(self.f())), 0)
		frappe.db.set_value("Work Order", wo, "docstatus", 2)
		self.assertEqual(data(self.f()), [])

	def test_semua_kelompok(self):
		wo = self.order()
		self.hasil(wo, -2, 250, {"Short Shot": 10})
		self.hasil(wo, -2, 40, {"Bubble": 2}, shift="Shift 2", jam=4)
		self.hasil(wo, -1, 300)
		acuan = data(self.f())
		total = jumlah(acuan)
		self.assertEqual(total, (600, 590, 12))
		for nama in KELOMPOK:
			rows = data(self.f(group_by=nama))
			self.assertEqual(jumlah(rows), total, nama)
		# Shift grouping: the day's target follows the recorded hours (8 h and 4 h on d(-2)).
		per_shift = {r["shift"]: r for r in data(self.f(group_by="Shift"))}
		self.assertEqual(per_shift["Shift 1"]["target"], 200 + 300)
		self.assertEqual(per_shift["Shift 2"]["target"], 100)

	def test_jendela_lebih_lebar_dari_rentang(self):
		self.order(qty=600, mulai=-4, selesai=1)  # 6 days, 100 a day
		rows = data(self.f(from_date=d(-2), to_date=d(-1)))
		self.assertEqual([(r["tanggal"], r["target"]) for r in rows], [(d(-2), 100), (d(-1), 100)])

	def test_filter_mesin_kapasitas(self):
		buat_kapasitas(JADI, self.m1, material=PP)
		buat_kapasitas(JADI, self.m2, material=PP)
		a, b = self.order(mesin="m1"), self.order(mesin="m2")
		self.hasil(a, -2, 10, jam=8)
		self.hasil(b, -2, 10, jam=4)
		rows = data(self.f(target_dari="Capacity", workstation=self.m2))
		self.assertEqual({r["mesin"] for r in rows}, {self.m2})
		self.assertEqual([r["target"] for r in rows if r["tanggal"] == d(-2)], [2880])

	def test_kolom_alasan(self):
		aneh = 'Gores & "x" / y'
		for nama in (aneh, "Cacat A", "Cacat-A"):
			if not frappe.db.exists("Reject Reason", nama):
				frappe.get_doc({"doctype": "Reject Reason", "reason_name": nama}).insert(ignore_permissions=True)
		wo = self.order()
		self.hasil(wo, -2, 5, {aneh: 1, "Cacat A": 2, "Cacat-A": 4})
		kolom, rows, _pesan, _grafik = execute(self.f())
		alasan = [c for c in kolom if c["fieldname"].startswith("r_")]
		self.assertEqual(len({c["fieldname"] for c in alasan}), 3)
		por = {c["label"]: rows[0][c["fieldname"]] for c in alasan}
		self.assertIn("Gores &amp; &quot;x&quot; / y", por)
		# Frappe refuses < and > in a name, so the HTML case is checked on kolom() directly.
		html = susun_kolom("Day", [{"r_a": 1, "_alasan": {"r_a": "<b>Gores</b>"}}])
		self.assertEqual(html[-1]["label"], "&lt;b&gt;Gores&lt;/b&gt;")
		self.assertEqual(sorted(por.values()), [1, 2, 4])
		self.assertEqual(por["Cacat A"], 2)

	def test_izin_production_entry(self):
		email = buat_pengguna("pa-tanpa-pe@example.com", None, None, None)
		frappe.set_user(email)
		with self.assertRaises(frappe.PermissionError):
			execute(self.f())

	def test_execute(self):
		wo = self.order()
		self.hasil(wo, -2, 250, {"Short Shot": 10, "Bubble": 1})
		kolom, rows, _pesan, grafik = execute(self.f())
		fields = [c["fieldname"] for c in kolom]
		self.assertEqual(fields[:2], ["mesin", "tanggal"])
		self.assertIn("r_short_shot", fields)
		self.assertIn("r_bubble", fields)
		self.assertNotIn("r_flashing", fields)
		self.assertEqual(grafik["type"], "bar")
		self.assertEqual(len(grafik["data"]["labels"]), len(rows))
		with self.assertRaises(frappe.ValidationError):
			execute(self.f(from_date=d(0), to_date=d(-3)))
