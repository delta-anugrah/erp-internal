"""Daily Input: one submitted Production Entry per filled grid cell (order, date, shift), replaced when the
number changes, cancelled when emptied, all or nothing."""

import io
from datetime import date

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, getdate, today
from openpyxl import load_workbook

from erp_internal.daily_input import (
	WARNA_EXCEL,
	baca_jumlah,
	buku,
	export_excel,
	get_data,
	minggu,
	print_html,
	save_cell,
	save_note,
)
from erp_internal.tampilan import ADMIN, PRODUKSI
from erp_internal.tests.utils import (
	buat_barang,
	buat_bom,
	buat_hasil,
	buat_mesin,
	buat_order,
	buat_pelanggan,
	buat_pengguna,
	buat_perusahaan,
	buat_wo,
	lampirkan,
	stok_awal,
)

JADI, PP = "_UJI-IH-EMBER", "_UJI-IH-PP"
PO = "039-NKP/EPP/DA/2026-11"


class TestInputHarian(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		buat_barang(JADI, "Barang Jadi", konversi={"Karton": 24})
		buat_barang(PP, "Bahan Baku", satuan="Kg")
		buat_bom(JADI, {PP: 0.05}, company=cls.pabrik)
		cls.mesin_a, cls.mesin_b = buat_mesin(61), buat_mesin(62)
		cls.pelanggan = buat_pelanggan("_Uji Pelanggan IH")
		cls.admin = buat_pengguna("_uji.ih.admin@example.com", ADMIN, ADMIN, cls.pabrik)
		cls.produksi = buat_pengguna("_uji.ih.produksi@example.com", PRODUKSI, PRODUKSI, cls.pabrik)
		cls.tanpa_hak = buat_pengguna("_uji.ih.tanpa@example.com", None, None, None)  # no role at all

	def setUp(self):
		frappe.db.savepoint("uji_input_harian")
		self.addCleanup(frappe.db.rollback, save_point="uji_input_harian")
		self.addCleanup(frappe.set_user, "Administrator")
		self.hari_ini = getdate(today())
		self.kemarin = add_days(self.hari_ini, -1)
		self.jauh = add_days(self.hari_ini, -400)  # a week with no entries
		awal = add_days(self.hari_ini, -30)
		stok_awal(self.pabrik, PP, 1000, "Gudang Bahan Baku", tanggal=awal)
		self.wo = buat_wo(JADI, self.mesin_a, qty=1000, company=self.pabrik)
		so = buat_order(self.pabrik, self.pelanggan, JADI, 1000, awal, self.hari_ini, submit=False)
		so.po_no = PO
		so.save(ignore_permissions=True)
		lampirkan("Sales Order", so.name)
		so.submit()
		self.wo_so = buat_wo(JADI, self.mesin_a, qty=1000, company=self.pabrik, sales_order=so.name)
		self.wo_tanpa_mesin = buat_wo(JADI, None, qty=1000, company=self.pabrik)
		for wo in (self.wo, self.wo_so, self.wo_tanpa_mesin):  # made a week ago: back-dated cells allowed
			frappe.db.set_value(
				"Work Order", wo, "creation", add_days(self.hari_ini, -7), update_modified=False
			)
		frappe.set_user(self.produksi)

	def entri(self, tanggal: date, shift: str, wo: str | None = None) -> list[tuple]:
		return [
			(int(r.good_qty), r.technician)
			for r in frappe.get_all(
				"Production Entry",
				filters={
					"work_order": wo or self.wo,
					"posting_date": tanggal,
					"shift": shift,
					"docstatus": 1,
				},
				fields=["good_qty", "technician"],
				order_by="creation asc",
			)
		]

	def baris(self, wo: str, tanggal: date) -> dict:
		blok = get_data(str(tanggal), str(tanggal), work_order=wo)["blok"][0]
		return next(b for b in blok["baris"] if b["tanggal"] == str(tanggal))

	def pindah_mesin(self, wo: str, mesin: str) -> None:
		frappe.set_user(self.admin)
		doc = frappe.get_doc("Work Order", wo)
		doc.erp_mesin = mesin
		doc.save()
		frappe.set_user(self.produksi)

	def mesin_entri(self, tanggal: date) -> str:
		return frappe.db.get_value(
			"Production Entry",
			{"work_order": self.wo, "posting_date": tanggal, "docstatus": 1},
			"workstation",
		)

	def test_minggu(self):
		self.assertEqual(minggu(date(2026, 11, 26)), (date(2026, 11, 23), date(2026, 11, 29)))

	def test_baca_jumlah(self):
		self.assertEqual(baca_jumlah("13.384"), 13384)
		self.assertEqual(baca_jumlah("13384"), 13384)
		self.assertEqual(baca_jumlah(""), 0)
		for salah in ("13,5", "-5", "abc", "1.2.3x"):
			with self.assertRaises(frappe.ValidationError):
				baca_jumlah(salah)

	def test_sel_baru(self):
		blok = save_cell(self.wo, str(self.kemarin), "Shift 1", "300", teknisi="Yudi")
		self.assertEqual(self.entri(self.kemarin, "Shift 1"), [(300, "Yudi")])
		self.assertEqual(blok["total"], {"Shift 1": 300, "Shift 2": 0, "semua": 300})

	def test_sel_diganti(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "300")
		save_cell(self.wo, str(self.kemarin), "Shift 1", "250")
		self.assertEqual([q for q, _t in self.entri(self.kemarin, "Shift 1")], [250])
		self.assertEqual(frappe.db.get_value("Work Order", self.wo, "produced_qty"), 250)

	def test_sel_dikosongkan(self):
		save_cell(self.wo, str(self.kemarin), "Shift 2", "300")
		save_cell(self.wo, str(self.kemarin), "Shift 2", "")
		self.assertEqual(self.entri(self.kemarin, "Shift 2"), [])

	def test_dua_kali_satu_entri(self):
		for _ in range(2):
			save_cell(self.wo, str(self.kemarin), "Shift 1", "300")
		self.assertEqual(len(self.entri(self.kemarin, "Shift 1")), 1)

	def test_sel_gagal_tetap_lama(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "300")  # order qty 1000, 10 % over allowed
		stok = sum(frappe.get_all("Bin", {"item_code": JADI}, pluck="actual_qty"))
		with self.assertRaises(frappe.ValidationError):
			save_cell(self.wo, str(self.kemarin), "Shift 1", "1200")
		self.assertEqual([q for q, _t in self.entri(self.kemarin, "Shift 1")], [300])
		self.assertEqual(sum(frappe.get_all("Bin", {"item_code": JADI}, pluck="actual_qty")), stok)
		self.assertEqual(frappe.db.get_value("Work Order", self.wo, "produced_qty"), 300)
		save_cell(self.wo, str(self.kemarin), "Shift 1", "1.100")  # the last shift's real count, 10 % over
		self.assertEqual(frappe.db.get_value("Work Order", self.wo, "produced_qty"), 1100)

	def test_catatan(self):
		with self.assertRaises(frappe.ValidationError):
			save_note(self.wo, str(self.kemarin), "mesin panas")
		save_cell(self.wo, str(self.kemarin), "Shift 1", "300")
		save_cell(self.wo, str(self.kemarin), "Shift 2", "200")
		blok = save_note(self.wo, str(self.kemarin), "mesin panas")
		self.assertEqual(blok["baris"][0]["catatan"], "mesin panas")

	def test_blok(self):
		lalu = add_days(self.kemarin, -3)
		save_cell(self.wo_so, str(lalu), "Shift 1", "500")
		save_cell(self.wo_so, str(self.kemarin), "Shift 1", "500")  # the whole order
		blok = next(
			b for b in get_data(str(self.kemarin), str(self.kemarin))["blok"] if b["work_order"] == self.wo_so
		)
		self.assertEqual(blok["po_no"], PO)
		self.assertTrue(blok["selesai"])
		self.assertEqual(blok["kemasan"], [{"uom": "Karton", "isi": 24}])
		# A closed order shows only in the week of its last entry.
		for dari in (add_days(self.kemarin, 7), add_days(self.kemarin, -7), lalu):
			nama = [b["work_order"] for b in get_data(str(dari), str(dari))["blok"]]
			self.assertNotIn(self.wo_so, nama)
			self.assertIn(self.wo, nama)

	def test_teknisi_minggu(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "10", teknisi="Yudi")
		save_cell(self.wo, str(self.kemarin), "Shift 2", "10", teknisi="Fadli")
		data = get_data(str(self.kemarin), str(self.kemarin))
		self.assertEqual(data["teknisi"], {"Shift 1": ["Yudi"], "Shift 2": ["Fadli"]})
		self.assertEqual(data["teknisi_terakhir"]["Shift 2"], "Fadli")

	def test_admin_tidak_bisa_isi(self):
		frappe.set_user(self.admin)
		self.assertFalse(get_data()["boleh_isi"])
		with self.assertRaises(frappe.PermissionError):
			save_cell(self.wo, str(self.kemarin), "Shift 1", "5")

	def test_order_tanpa_mesin(self):
		with self.assertRaisesRegex(frappe.ValidationError, "machine"):
			save_cell(self.wo_tanpa_mesin, str(self.kemarin), "Shift 1", "5")

	def test_sel_dari_form_terkunci(self):
		pe = buat_hasil(self.wo, good=50, rejects={"Bubble": 3}, posting_date=self.kemarin)
		baris = self.baris(self.wo, self.kemarin)
		self.assertEqual(baris["kunci"]["Shift 1"], pe.name)
		with self.assertRaisesRegex(frappe.ValidationError, "Production Entry form"):
			save_cell(self.wo, str(self.kemarin), "Shift 1", "60")
		self.assertEqual(frappe.db.get_value("Production Entry", pe.name, "docstatus"), 1)

	def test_amandemen_sel_lain_ditolak(self):
		# The old machine is kept only when amending the same cell: not another order's cancelled entry.
		frappe.set_user("Administrator")
		lain = buat_wo(JADI, self.mesin_b, qty=1000, company=self.pabrik)
		pe = buat_hasil(lain, good=10, posting_date=self.kemarin)
		pe.cancel()
		frappe.set_user(self.produksi)
		with self.assertRaisesRegex(frappe.ValidationError, "runs on"):
			buat_hasil(
				self.wo, good=10, posting_date=self.kemarin, workstation=self.mesin_b, amended_from=pe.name
			)

	def test_mesin_diganti(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "10")
		self.pindah_mesin(self.wo, self.mesin_b)
		save_cell(self.wo, str(self.hari_ini), "Shift 1", "10")
		self.assertEqual(self.mesin_entri(self.kemarin), self.mesin_a)
		self.assertEqual(self.mesin_entri(self.hari_ini), self.mesin_b)
		save_cell(self.wo, str(self.kemarin), "Shift 1", "20")  # the earlier cell replaced: still machine A
		self.assertEqual(self.entri(self.kemarin, "Shift 1"), [(20, None)])
		self.assertEqual(self.mesin_entri(self.kemarin), self.mesin_a)

	def test_teknisi_diganti(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "10", teknisi="Yudi")
		save_cell(self.wo, str(self.kemarin), "Shift 1", "10", teknisi="Fadli")
		self.assertEqual(self.entri(self.kemarin, "Shift 1"), [(10, "Fadli")])

	def test_sebelum_order(self):
		with self.assertRaisesRegex(frappe.ValidationError, "before the Work Order"):
			save_cell(self.wo, str(add_days(self.hari_ini, -8)), "Shift 1", "10")

	def test_catatan_satu_baris(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "10", catatan="a")
		save_cell(self.wo, str(self.kemarin), "Shift 2", "10")
		save_cell(self.wo, str(self.kemarin), "Shift 1", "20", catatan="b")  # replaced: the whole row's note
		notes = frappe.get_all(
			"Production Entry",
			filters={"work_order": self.wo, "posting_date": self.kemarin, "docstatus": 1},
			pluck="notes",
		)
		self.assertEqual(notes, ["b", "b"])

	def test_dibuat(self):
		blok = get_data(str(self.kemarin), str(self.kemarin), work_order=self.wo)["blok"][0]
		self.assertEqual(blok["dibuat"], str(add_days(self.hari_ini, -7)))

	def test_excel_tata_letak(self):
		save_cell(self.wo_so, str(self.kemarin), "Shift 1", "400")
		ws = buku(get_data(str(self.kemarin), str(self.kemarin), work_order=self.wo_so)).active
		self.assertEqual(ws["A1"].value, "Tanggal")
		sel = {c.value: c for row in ws.iter_rows() for c in row if c.value}
		self.assertEqual(sel["No.Po. 039-NKP/EPP/DA/2026-11"].fill.fgColor.rgb[-6:], WARNA_EXCEL["no_po"])
		self.assertEqual(sel["Shift 1\n(08.00-20.00)"].fill.fgColor.rgb[-6:], WARNA_EXCEL["kepala"])
		self.assertEqual(sel["TOTAL"].fill.fgColor.rgb[-6:], WARNA_EXCEL["total"])
		self.assertIn(400, [c.value for c in ws[sel["TOTAL"].row]])
		self.assertEqual(sel[self.mesin_a].fill.fgColor.rgb[-6:], WARNA_EXCEL["mesin"])
		self.assertEqual(sel[self.mesin_a].font.color.rgb[-6:], "FF0000")

	def test_excel_selesai(self):
		save_cell(self.wo_so, str(self.kemarin), "Shift 1", "1.000")  # the whole order
		ws = buku(get_data(str(self.kemarin), str(self.kemarin), work_order=self.wo_so)).active
		sel = {c.value: c for row in ws.iter_rows() for c in row if c.value}
		self.assertEqual(sel["CLOSE/DONE"].fill.fgColor.rgb[-6:], WARNA_EXCEL["selesai"])

	def test_excel_kosong(self):
		ws = buku({**get_data(str(self.jauh), str(self.jauh)), "blok": []}).active
		self.assertEqual(ws["A1"].value, "Tanggal")
		self.assertEqual(ws.max_row, 3)  # Tanggal, Teknisi Pagi, Teknisi Malam

	def test_excel_teks_bukan_rumus(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "10", teknisi="=1+2", catatan="=1+1")
		arsip = io.BytesIO()
		buku(get_data(str(self.kemarin), str(self.kemarin), work_order=self.wo)).save(arsip)
		ws = load_workbook(arsip).active  # read back: a formula would come back as data type "f"
		sel = [c for row in ws.iter_rows() for c in row if c.value in ("=1+1", "=1+2")]
		self.assertEqual(sorted(c.value for c in sel), ["=1+1", "=1+2"])
		self.assertEqual({c.data_type for c in sel}, {"s"})

	def test_excel_tanpa_baris_tanpa_gabung_satu_sel(self):
		data = get_data(str(self.jauh), str(self.jauh))
		kosong = {**data["blok"][0], "baris": []}
		for blok in ([kosong], data["blok"]):
			ws = buku({**data, "blok": blok}).active
			for rentang in ws.merged_cells.ranges:
				self.assertGreater(rentang.size["rows"] * rentang.size["columns"], 1, str(rentang))

	def test_cetak_dan_excel_tanpa_hak_baca(self):
		frappe.set_user(self.tanpa_hak)
		for fungsi in (print_html, export_excel):
			with self.assertRaises(frappe.PermissionError):
				fungsi(str(self.kemarin), str(self.kemarin))

	def test_export_excel(self):
		export_excel(str(self.kemarin), str(self.kemarin))
		self.assertEqual(frappe.response["filename"], f"input-harian-{self.kemarin}-{self.kemarin}.xlsx")
		self.assertEqual(frappe.response["type"], "binary")
		self.assertTrue(frappe.response["filecontent"].startswith(b"PK"))

	def test_cetak(self):
		save_cell(self.wo_so, str(self.kemarin), "Shift 1", "1000")
		html = print_html(str(self.kemarin), str(self.kemarin))
		for teks in ("No.Po. 039-NKP/EPP/DA/2026-11", "TOTAL", "CLOSE/DONE", "08.00-20.00"):
			self.assertIn(teks, html)

	def test_cetak_teks_dilepas(self):
		frappe.db.set_value(
			"Sales Order",
			frappe.db.get_value("Work Order", self.wo_so, "sales_order"),
			"po_no",
			"<script>x</script>",
		)
		html = print_html(str(self.kemarin), str(self.kemarin))
		self.assertNotIn("<script>x", html)
		self.assertIn("&lt;script&gt;x", html)

	def test_cetak_admin_baca(self):
		frappe.set_user(self.admin)
		self.assertIn("TOTAL", print_html(str(self.kemarin), str(self.kemarin)))
		export_excel(str(self.kemarin), str(self.kemarin))
