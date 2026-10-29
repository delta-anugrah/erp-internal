"""The Excel import of machine capacity: the sample file imported for real, preview writes nothing, a second run
changes nothing, and every way a row or a file is refused."""

from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from erp_internal import master
from erp_internal.planning import impor_kapasitas
from erp_internal.planning.impor_kapasitas import KOLOM_IMPOR, angka, baca, normal, pratinjau, terapkan
from erp_internal.tampilan import ADMIN, USER
from erp_internal.tests.utils import (
	buat_barang,
	buat_mesin,
	buat_pengguna,
	buat_perusahaan,
	buat_varian,
)

TEMPLATE = "_UJI-IMP"
POLOS = "_UJI-IMP-SATU"
BERKAS = ("kapasitas.xlsx",)


def isi_berkas(nama: str) -> bytes:
	with open(frappe.get_app_path("erp_internal", "tests", "data", nama), "rb") as f:
		return f.read()


def buat_berkas(nama: str, isi: bytes, pemilik: str = "Administrator") -> str:
	"""A private File with `isi`; returns its file_url."""
	return (
		frappe.get_doc(
			{
				"doctype": "File",
				"file_name": nama,
				"content": isi,
				"is_private": 1,
				"owner": pemilik,
			}
		)
		.insert(ignore_permissions=True)
		.file_url
	)


class TestImporKapasitas(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		cls.v = buat_varian(TEMPLATE, ["Super", "DX"], ["Merah", "Biru"])
		buat_barang(POLOS, "Barang Jadi", "Pcs")
		cls.pp = buat_barang("_UJI-PP", "Bahan Baku", "Kg")
		cls.mb = buat_barang("_UJI-MB", "Bahan Baku", "Kg")
		cls.mesin = {n: buat_mesin(n) for n in range(1, 6)}
		cls.url = buat_berkas("_uji_kapasitas.xlsx", isi_berkas("kapasitas.xlsx"))

	@classmethod
	def tearDownClass(cls):
		for nama in frappe.get_all("File", {"file_name": ("like", "_uji_%")}, pluck="name"):
			frappe.delete_doc("File", nama, force=1, ignore_permissions=True)
		super().tearDownClass()

	def setUp(self):
		# Each test starts from the fixtures only: the class's rollback comes too late for rows a test makes.
		frappe.db.savepoint("impor_kapasitas")
		self.addCleanup(frappe.db.rollback, save_point="impor_kapasitas")

	def terapkan(self, url=None):
		return terapkan(url or self.url, company=self.pabrik)

	def test_normal_dan_alias(self):
		self.assertEqual(normal("Cycle Time (detik)"), "cycletimedetik")
		self.assertEqual(normal("MB %"), normal("mb persen"))
		peta = {}
		for kunci, alias in KOLOM_IMPOR.items():
			for a in alias:
				self.assertNotIn(peta.setdefault(normal(a), kunci), (None,))
				self.assertEqual(peta[normal(a)], kunci, f"{a!r} belongs to two keys")
		self.assertEqual(
			set(KOLOM_IMPOR),
			{
				"item_code",
				"produk",
				"jenis",
				"mesin",
				"cycle_time",
				"cavities",
				"part_weight",
				"runner_weight",
				"material",
				"masterbatch",
				"masterbatch_percent",
			},
		)

	def test_angka(self):
		self.assertEqual(
			[angka(x) for x in (12, "2,5", "2.5", "1.250,5", "1,250.5", "")],
			[12, 2.5, 2.5, 1250.5, 1250.5, 0],
		)
		self.assertEqual(
			[angka(x) for x in (None, " 3 ", "1.250.000", "0.250", "-2,5")], [0, 3, 1250000, 0.25, -2.5]
		)
		for x in ("1.250", "1,250"):
			with self.assertRaisesRegex(ValueError, "ambiguous"):
				angka(x)
		for x in ("abc", "1,2,3", "1.25.5"):
			with self.assertRaises(ValueError):
				angka(x)

	def test_baca(self):
		asing = []
		baris = baca(self.url, asing)
		self.assertEqual(asing, [])
		self.assertEqual([b["no"] for b in baris], list(range(2, 12)))
		self.assertEqual(baris[0]["produk"], TEMPLATE)
		self.assertEqual(baris[2]["item_code"], POLOS)
		self.assertEqual(baris[4]["cycle_time"], "2,5")

	def test_kolom_asing_dan_csv(self):
		isi = (
			"Produk;Jenis;No Mesin;Warna Kotak;Cycle;Cavity;Berat;Bahan\n_UJI-IMP;Super;1;x;20;4;50;_UJI-PP\n"
		)
		url = buat_berkas("_uji_semikolon.csv", isi.encode())
		h = pratinjau(url)
		self.assertEqual(h["kolom_asing"], ["Warna Kotak"])
		self.assertEqual([b["hasil"] for b in h["baris"]], ["New"])
		self.assertEqual(h["baris"][0]["cycle_time"], 20)

	def test_pratinjau_tanpa_tulis(self):
		n = frappe.db.count("Machine Capacity")
		b = frappe.db.count("BOM")
		h = pratinjau(self.url)
		self.assertEqual([x["hasil"] for x in h["baris"]].count("New"), 6)
		self.assertEqual({x["no"] for x in h["baris"] if x["hasil"] == "Refused"}, {8, 9, 10, 11})
		self.assertEqual(frappe.db.count("Machine Capacity"), n)
		self.assertEqual(frappe.db.count("BOM"), b)
		alasan = {x["no"]: x["alasan"] for x in h["baris"] if x["hasil"] == "Refused"}
		self.assertIn("_UJI-TIDAKADA", alasan[8])
		self.assertIn("_UJI-BAHAN-GAIB", alasan[9])
		self.assertIn("99", alasan[10])
		self.assertIn("1.250", alasan[11])
		self.assertTrue(all(x["alasan"] == "" for x in h["baris"] if x["hasil"] == "New"))

	def test_terapkan(self):
		h = self.terapkan()
		hasil = {x["no"]: x["hasil"] for x in h["baris"]}
		self.assertEqual([hasil[n] for n in range(2, 8)], ["New"] * 6)
		self.assertEqual({hasil[n] for n in range(8, 12)}, {"Refused"})
		for x in h["baris"]:
			if x["hasil"] == "Refused":
				self.assertTrue(x["alasan"])
		self.assertEqual(frappe.db.count("Machine Capacity", {"item": ("like", "_UJI-IMP%")}), 6)
		# the "2,5" row, the Mesin 03 row and the template + Jenis row
		self.assertEqual(
			frappe.db.get_value(
				"Machine Capacity",
				{"item": TEMPLATE, "jenis": "DX", "workstation": self.mesin[4]},
				["cycle_time", "cavities"],
			),
			(2.5, 8),
		)
		self.assertTrue(
			frappe.db.exists(
				"Machine Capacity", {"item": TEMPLATE, "jenis": "DX", "workstation": self.mesin[3]}
			)
		)
		sub = frappe.db.get_value(
			"Machine Capacity",
			{"item": TEMPLATE, "jenis": "Super", "workstation": self.mesin[5]},
			["material", "masterbatch", "masterbatch_percent"],
		)
		self.assertEqual(sub, (self.pp, self.mb, 1.5))
		self.assertTrue(
			frappe.db.exists("Machine Capacity", {"item": POLOS, "jenis": "", "workstation": self.mesin[1]})
		)
		self.assertTrue(
			frappe.db.exists(
				"Machine Capacity", {"item": TEMPLATE, "jenis": "", "workstation": self.mesin[2]}
			)
		)
		# 2 + 4 + 1 + 2 + 2 + 2 variants
		self.assertEqual(h["bom"], {"dibuat": 13, "nonaktif": 0})
		self.assertEqual(frappe.db.count("BOM", {"erp_kapasitas": ("is", "set"), "docstatus": 1}), 13)

	def test_impor_dua_kali(self):
		self.terapkan()
		sesudah = pratinjau(self.url)
		self.assertEqual({x["hasil"] for x in sesudah["baris"]} - {"Refused"}, {"Unchanged"})
		n = frappe.db.count("Machine Capacity")
		h2 = self.terapkan()
		self.assertEqual(h2["bom"], {"dibuat": 0, "nonaktif": 0})
		self.assertEqual(frappe.db.count("Machine Capacity"), n)

	def test_berubah(self):
		self.terapkan()
		nama = frappe.db.get_value(
			"Machine Capacity", {"item": TEMPLATE, "jenis": "Super", "workstation": self.mesin[1]}
		)
		frappe.db.set_value("Machine Capacity", nama, "part_weight", 99)
		h = pratinjau(self.url)
		self.assertEqual({x["no"]: x["hasil"] for x in h["baris"]}[2], "Changed")
		self.assertEqual([x["hasil"] for x in h["baris"]].count("Changed"), 1)
		self.assertIn("Part Weight", next(x for x in h["baris"] if x["no"] == 2)["alasan"])
		self.terapkan()
		self.assertEqual(frappe.db.get_value("Machine Capacity", nama, "part_weight"), 50)
		# a heavier part in a new file: the row is Changed and its BOMs are made again
		isi = (
			"Produk,Jenis,Mesin,Cycle,Cavity,Berat,Berat Runner,Bahan,Masterbatch,MB %\n"
			"_UJI-IMP,Super,1,20,4,60,12,_UJI-PP,_UJI-MB,2\n"
		)
		r = self.terapkan(buat_berkas("_uji_berat.csv", isi.encode()))
		self.assertEqual(frappe.db.get_value("Machine Capacity", nama, "part_weight"), 60)
		self.assertEqual(r["bom"], {"dibuat": 2, "nonaktif": 2})

	def test_dua_baris_sama_dalam_berkas(self):
		isi = (
			"Produk,Jenis,Mesin,Cycle,Cavity,Berat,Bahan\n"
			"_UJI-IMP,Super,1,20,4,50,_UJI-PP\n"
			"_uji-imp,super,Mesin 01,30,4,50,_UJI-PP\n"
		)
		h = pratinjau(buat_berkas("_uji_kembar.csv", isi.encode()))
		self.assertEqual([x["hasil"] for x in h["baris"]], ["New", "Refused"])
		self.assertIn("2", h["baris"][1]["alasan"])

	def test_pisah(self):
		pisah = {(TEMPLATE, "Pack"): (POLOS, "x", "Pcs")}
		isi = "Produk,Jenis,Mesin,Cycle,Cavity,Berat,Bahan\n_UJI-IMP,pack,1,20,4,50,_UJI-PP\n"
		with patch.dict(master.PISAH, pisah):
			h = pratinjau(buat_berkas("_uji_pisah.csv", isi.encode()))
		self.assertEqual((h["baris"][0]["hasil"], h["baris"][0]["item"]), ("New", POLOS))

	def test_nilai_ditolak_model(self):
		# the model's own checks apply: cycle time 0, a material that is not counted in Kg
		buat_barang("_UJI-IMP-GR", "Bahan Baku", "Gram")
		isi = (
			"Produk,Jenis,Mesin,Cycle,Cavity,Berat,Bahan\n"
			"_UJI-IMP,Super,1,0,4,50,_UJI-PP\n"
			"_UJI-IMP,Super,2,20,4,50,_UJI-IMP-GR\n"
			"_UJI-IMP,Super,3,20,4,50,\n"
			"_UJI-IMP,Super,4,20,2.5,50,_UJI-PP\n"
		)
		h = pratinjau(buat_berkas("_uji_model.csv", isi.encode()))
		self.assertEqual([x["hasil"] for x in h["baris"]], ["Refused"] * 4)
		self.assertTrue(all(x["alasan"] and "<" not in x["alasan"] for x in h["baris"]))

	def test_gagal_setelah_pratinjau(self):
		asli = impor_kapasitas.buat_bom_kapasitas

		def kadang(nama, company=None):
			if frappe.db.get_value("Machine Capacity", nama, "workstation") == self.mesin[2]:
				frappe.throw("BOM kaput")
			return asli(nama, company)

		with patch.object(impor_kapasitas, "buat_bom_kapasitas", kadang):
			h = self.terapkan()
		hasil = {x["no"]: x for x in h["baris"]}
		self.assertEqual(hasil[3]["hasil"], "Refused")
		self.assertIn("BOM kaput", hasil[3]["alasan"])
		self.assertFalse(
			frappe.db.exists("Machine Capacity", {"item": TEMPLATE, "workstation": self.mesin[2]})
		)
		self.assertEqual(hasil[2]["hasil"], "New")
		self.assertTrue(
			frappe.db.exists("Machine Capacity", {"item": TEMPLATE, "workstation": self.mesin[1]})
		)
		self.assertEqual(h["bom"]["dibuat"], 13 - 4)
		# nothing of the failed row is left, and no message pop-up either
		self.assertNotIn("BOM kaput", str(frappe.get_message_log()))

	def test_ukuran_dan_jenis_berkas(self):
		for nama, isi in (("_uji_x.txt", b"a"), ("_uji_x.xlsx", b"not a zip"), ("_uji_x.csv", b" \n")):
			with self.assertRaises(frappe.ValidationError, msg=nama):
				pratinjau(buat_berkas(nama, isi))
		with patch.object(impor_kapasitas, "MAKS_BARIS", 2):
			with self.assertRaises(frappe.ValidationError):
				pratinjau(self.url)
		with patch.object(impor_kapasitas, "MAKS_BYTE", 100):
			with self.assertRaises(frappe.ValidationError):
				pratinjau(self.url)
		for url in ("/private/files/_uji_tidak_ada.xlsx", "/etc/passwd", "../../etc/passwd.csv"):
			with self.assertRaises((frappe.PermissionError, frappe.ValidationError), msg=str(url)):
				pratinjau(url)

	def test_sel_tidak_jadi_html(self):
		# The preview hands back cell text as it is; the dialog escapes it (machine_capacity_list.js). Here: the
		# reason of a refused row carries the text and nothing is evaluated or written.
		isi = "Produk,Jenis,Mesin,Cycle,Cavity,Berat,Bahan\n<img src=x onerror=alert(1)>,Super,1,20,4,50,_UJI-PP\n"
		h = pratinjau(buat_berkas("_uji_html.csv", isi.encode()))
		self.assertEqual(h["baris"][0]["hasil"], "Refused")

	def test_tanpa_izin(self):
		user = buat_pengguna("_uji.impor.user@example.com", USER, None, self.pabrik)
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(user)
		with self.assertRaises(frappe.PermissionError):
			pratinjau(self.url)
		with self.assertRaises(frappe.PermissionError):
			terapkan(self.url)
		frappe.set_user("Administrator")
		self.assertEqual(frappe.db.count("Machine Capacity", {"item": ("like", "_UJI-IMP%")}), 0)

	def test_berkas_orang_lain(self):
		# An Admin may write capacity but not read a private file another user uploaded.
		admin = buat_pengguna("_uji.impor.admin@example.com", ADMIN, None, self.pabrik)
		self.addCleanup(frappe.set_user, "Administrator")
		frappe.set_user(admin)
		with self.assertRaises(frappe.PermissionError):
			pratinjau(self.url)
		own = buat_berkas("_uji_milik_admin.xlsx", isi_berkas("kapasitas.xlsx"), pemilik=admin)
		self.assertEqual(len(pratinjau(own)["baris"]), 10)

	def test_baris_nonaktif(self):
		self.terapkan()
		nama = frappe.db.get_value(
			"Machine Capacity", {"item": TEMPLATE, "jenis": "Super", "workstation": self.mesin[1]}
		)
		frappe.db.set_value("Machine Capacity", nama, "disabled", 1)
		boms = frappe.get_all("BOM", {"erp_kapasitas": nama, "is_active": 1}, pluck="name")
		for berat in (50, 60):  # the file's own value, and a changed one
			isi = (
				"Produk,Jenis,Mesin,Cycle,Cavity,Berat,Berat Runner,Bahan,Masterbatch,MB %\n"
				f"_UJI-IMP,Super,1,20,4,{berat},12,_UJI-PP,_UJI-MB,2\n"
			)
			url = buat_berkas(f"_uji_nonaktif_{berat}.csv", isi.encode())
			h = self.terapkan(url)
			self.assertEqual(h["baris"][0]["hasil"], "Refused")
			self.assertIn("switched off", h["baris"][0]["alasan"])
			self.assertEqual(pratinjau(url)["baris"][0]["hasil"], "Refused")
			self.assertEqual(h["bom"], {"dibuat": 0, "nonaktif": 0})
		self.assertEqual(frappe.db.get_value("Machine Capacity", nama, ["disabled", "part_weight"]), (1, 50))
		self.assertEqual(frappe.get_all("BOM", {"erp_kapasitas": nama, "is_active": 1}, pluck="name"), boms)

	def test_ribuan_baris_kosong(self):
		from openpyxl import Workbook

		buku = Workbook()
		lembar = buku.active
		lembar.append(["Produk", "Jenis", "Mesin", "Cycle", "Cavity", "Berat", "Bahan"])
		lembar.cell(row=5000, column=1, value=None)  # a sheet that is 5000 rows tall and empty
		import io

		kosong = io.BytesIO()
		buku.save(kosong)
		with patch.object(impor_kapasitas, "MAKS_BARIS", 10):
			# a data row beyond the raw limit (10 + 100) refuses even though the rows between are blank
			lembar.cell(row=300, column=1, value="_UJI-IMP")
			dua = io.BytesIO()
			buku.save(dua)
			with self.assertRaises(frappe.ValidationError):
				pratinjau(buat_berkas("_uji_kosong.xlsx", dua.getvalue()))

	def test_url_dipakai_bersama(self):
		# Another user's private File with the same URL comes first; the caller's own copy is used.
		admin = buat_pengguna("_uji.impor.admin2@example.com", ADMIN, None, self.pabrik)
		self.addCleanup(frappe.set_user, "Administrator")
		pertama = frappe.get_doc("File", {"file_url": self.url})
		sama = frappe.get_doc(
			{
				"doctype": "File",
				"file_name": pertama.file_name,
				"file_url": self.url,
				"is_private": 1,
				"owner": admin,
			}
		)
		sama.flags.ignore_file_validate = True
		sama.insert(ignore_permissions=True)
		frappe.db.set_value("File", sama.name, "owner", admin)
		frappe.set_user(admin)
		self.assertEqual(len(pratinjau(self.url)["baris"]), 10)
