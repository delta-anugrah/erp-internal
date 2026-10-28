"""Sample data, marked DATA CONTOH, for the local dry runs and the browser check (plan Revision 3 item 4).

    bench --site erp.localhost set-config erp_sandi_contoh <password>
    bench --site erp.localhost execute erp_internal.contoh.buat_contoh

Idempotent: each record is looked up by its natural key before it is made, so a second run adds nothing.
Refused on a production site (site config `erp_produksi`). Every record made here carries the tag DATA CONTOH
(`_user_tags`), so it can be listed and removed before go-live. The fixtures are the get-or-create helpers of
`tests/utils.py`, the same ones the tests use.
"""

from datetime import date

import frappe
from frappe import _
from frappe.desk.doctype.tag.tag import DocTags
from frappe.utils import add_days, add_months, get_first_day, getdate, today
from frappe.utils.password import update_password

from erp_internal import setup
from erp_internal.tests import utils

TANDA = "DATA CONTOH"

# Company kind → (name, abbreviation): Samuel's question 1, until he answers.
PERUSAHAAN = {"Pabrik": ("PT Contoh Plastik", "CPL"), "Kantor": ("PT Contoh Kantor", "CKT")}

# Item code → (name, group, stock UOM, other UOMs with their factor, valuation rate, opening stock).
BARANG = {
	"CTH-EMBER-10L": ("Ember 10 L", "Barang Jadi", "Pcs", {"Karton": 12}, 15000, 480),
	"CTH-BASKOM-40": ("Baskom 40 cm", "Barang Jadi", "Pcs", {"Karton": 24}, 9000, 720),
	"CTH-GAYUNG": ("Gayung", "Barang Jadi", "Pcs", {"Karton": 48}, 3500, 960),
	"CTH-TOPLES-1L": ("Toples 1 L", "Barang Jadi", "Pcs", {"Karton": 24}, 6000, 240),
	"CTH-KURSI": ("Kursi Plastik", "Barang Jadi", "Pcs", {"Karton": 6}, 45000, 60),
	"CTH-BIJI-PP": ("Biji Plastik PP", "Bahan Baku", "Kg", {"Sak": 25}, 18000, 2000),
	"CTH-BIJI-HDPE": ("Biji Plastik HDPE", "Bahan Baku", "Kg", {"Sak": 25}, 19000, 1500),
	"CTH-PEWARNA": ("Pewarna Masterbatch", "Bahan Baku", "Kg", {}, 45000, 100),
	"CTH-KARDUS": ("Kardus", "Kemasan", "Pcs", {}, 3500, 500),
}
# Product → (units per BOM: one carton, materials for that carton in their stock UOM).
RESEP = {
	"CTH-EMBER-10L": (12, {"CTH-BIJI-PP": 9.6, "CTH-PEWARNA": 0.24, "CTH-KARDUS": 1}),
	"CTH-BASKOM-40": (24, {"CTH-BIJI-PP": 9.6, "CTH-PEWARNA": 0.24, "CTH-KARDUS": 1}),
	"CTH-GAYUNG": (48, {"CTH-BIJI-PP": 7.2, "CTH-PEWARNA": 0.24, "CTH-KARDUS": 1}),
	"CTH-TOPLES-1L": (24, {"CTH-BIJI-HDPE": 4.8, "CTH-KARDUS": 1}),
	"CTH-KURSI": (6, {"CTH-BIJI-HDPE": 9, "CTH-PEWARNA": 0.18, "CTH-KARDUS": 1}),
}
# Product → (units a day, buffer days) for Item Lead Time; selling price per stock unit; monthly sales.
LAMA = {
	"CTH-EMBER-10L": (600, 1),
	"CTH-BASKOM-40": (900, 1),
	"CTH-GAYUNG": (2000, 1),
	"CTH-TOPLES-1L": (800, 1),
	"CTH-KURSI": (150, 2),
}
HARGA = {
	"CTH-EMBER-10L": 22000,
	"CTH-BASKOM-40": 14000,
	"CTH-GAYUNG": 5500,
	"CTH-TOPLES-1L": 9500,
	"CTH-KURSI": 65000,
}
JUAL_SEBULAN = {
	"CTH-EMBER-10L": 2400,
	"CTH-BASKOM-40": 3600,
	"CTH-GAYUNG": 6000,
	"CTH-TOPLES-1L": 1800,
	"CTH-KURSI": 300,
}
POLA = (0.9, 1.0, 1.1, 0.95, 1.05, 1.0)  # the six past months, oldest first, times JUAL_SEBULAN
DAFTAR_HARGA = "Harga Jual Contoh"

PELANGGAN = ("Toko Contoh Sejahtera", "CV Contoh Maju", "UD Contoh Sinar")
PEMASOK = ("PT Contoh Biji Plastik", "CV Contoh Kardus")
# Open orders: (customer's PO number, the key; customer; item; qty; UOM or None for the stock UOM; days to delivery).
ORDER = (
	("CONTOH-SO-1", "Toko Contoh Sejahtera", "CTH-EMBER-10L", 600, None, 7),
	("CONTOH-SO-2", "CV Contoh Maju", "CTH-BASKOM-40", 20, "Karton", 10),
	("CONTOH-SO-3", "UD Contoh Sinar", "CTH-KURSI", 120, None, 14),
	("CONTOH-SO-4", "Toko Contoh Sejahtera", "CTH-GAYUNG", 1500, None, 21),
)

# Office employees: (first name, last name, gender, the bagian whose sample user they are, or None).
KARYAWAN = (
	("Ayu", "Lestari", "Female", "HR"),
	("Bima", "Saputra", "Male", "Manajer Proyek"),
	("Citra", "Wulandari", "Female", "Karyawan"),
	("Dimas", "Pratama", "Male", None),
	("Eka", "Putri", "Female", None),
)
BAGIAN_KANTOR = ("HR", "Karyawan", "Manajer Proyek")  # the other bagian work for the factory
PROYEK = "Katalog Produk Online"
TUGAS = ("Desain halaman katalog", "Foto dan data produk", "Uji dan rilis")  # the first goes to the Karyawan

# Every DocType this file writes, for the summary and the idempotency test.
DIBUAT = (
	"Company",
	"Item",
	"BOM",
	"Item Lead Time",
	"Stock Reconciliation",
	"Price List",
	"Customer",
	"Supplier",
	"Sales History",
	"Sales Order",
	"User",
	"Employee",
	"Shift Assignment",
	"Leave Allocation",
	"Project",
	"Task",
)


def buat_contoh() -> dict[str, int]:
	"""Create or complete the sample data. Returns how many records of each DocType carry DATA CONTOH."""
	if frappe.conf.get("erp_produksi"):
		frappe.throw(_("Sample data is not allowed on a production site (site config erp_produksi is set)."))
	sandi = frappe.conf.get("erp_sandi_contoh")
	if not sandi:
		frappe.throw(_("Set site config erp_sandi_contoh first: it is the password of the sample users."))

	hari_ini = getdate(today())
	pabrik = _perusahaan("Pabrik")
	kantor = _perusahaan("Kantor")
	_barang(pabrik)
	_jual_beli(pabrik, hari_ini)
	pengguna = _pengguna(pabrik, kantor, sandi)
	_kantor(kantor, pengguna, hari_ini)
	return {dt: frappe.db.count(dt, {"_user_tags": ("like", f"%{TANDA}%")}) for dt in DIBUAT}


def tandai(doctype: str, nama: str) -> str:
	"""Tag one record DATA CONTOH (a second tag is a no-op)."""
	DocTags(doctype).add(nama, TANDA)
	return nama


def surel(bagian: str) -> str:
	"""The sample user of a bagian: `<bagian, lower case, no spaces>@contoh.test` (as `tools/cek_layar.mjs`)."""
	return f"{bagian.lower().replace(' ', '')}@contoh.test"


def _perusahaan(jenis: str) -> str:
	nama, abbr = PERUSAHAAN[jenis]
	return tandai("Company", utils.buat_perusahaan(nama, abbr, jenis))


def _barang(pabrik: str) -> None:
	"""Items, their opening stock (only where the item has never moved), BOMs and lead times."""
	for kode, (nama, grup, satuan, lain, harga, stok) in BARANG.items():
		utils.buat_barang(kode, grup, satuan, lain, item_name=nama, description=f"{nama} ({TANDA})")
		tandai("Item", kode)
		gudang = setup.GUDANG_GRUP[grup]
		wh = setup.gudang(pabrik, gudang)
		if not frappe.db.exists(
			"Stock Ledger Entry", {"item_code": kode, "warehouse": wh, "is_cancelled": 0}
		):
			utils.stok_awal(pabrik, kode, stok, gudang, rate=harga)
			sr = frappe.db.get_value(
				"Stock Ledger Entry", {"item_code": kode, "warehouse": wh, "is_cancelled": 0}, "voucher_no"
			)
			tandai("Stock Reconciliation", sr)

	for kode, (jumlah, bahan) in RESEP.items():
		tandai("BOM", utils.buat_bom(kode, bahan, jumlah, company=pabrik))
		per_hari, cadangan = LAMA[kode]
		tandai("Item Lead Time", utils.lama_produksi(kode, per_hari, cadangan))


def _jual_beli(pabrik: str, hari_ini: date) -> None:
	"""Customers, suppliers, six full months of Sales History and the open orders."""
	for nama in PELANGGAN:
		tandai("Customer", utils.buat_pelanggan(nama))
	for nama in PEMASOK:
		tandai("Supplier", utils.buat_pemasok(nama))

	for i, faktor in enumerate(POLA):
		bulan = getdate(get_first_day(add_months(hari_ini, i - len(POLA))))
		utils.tahun_fiskal(bulan)
		for kode, qty in JUAL_SEBULAN.items():
			tandai("Sales History", utils.riwayat(pabrik, kode, bulan, round(qty * faktor)))

	utils.tahun_fiskal(hari_ini)
	harga = tandai("Price List", utils.daftar_harga(DAFTAR_HARGA, jual=True))
	for po, pelanggan, kode, qty, satuan, hari in ORDER:
		ada = frappe.db.get_value("Sales Order", {"po_no": po, "company": pabrik, "docstatus": ("<", 2)})
		if ada:
			tandai("Sales Order", ada)
			continue
		faktor = 1
		if satuan:
			faktor = frappe.db.get_value(
				"UOM Conversion Detail", {"parent": kode, "uom": satuan}, "conversion_factor"
			)
		kirim = add_days(hari_ini, hari)
		so = frappe.get_doc(
			{
				"doctype": "Sales Order",
				"company": pabrik,
				"customer": pelanggan,
				"po_no": po,
				"currency": "IDR",
				"selling_price_list": harga,
				"transaction_date": hari_ini,
				"delivery_date": kirim,
				"items": [
					{
						"item_code": kode,
						"qty": qty,
						"uom": satuan or BARANG[kode][2],
						"conversion_factor": faktor,
						"rate": HARGA[kode] * faktor,
						"delivery_date": kirim,
						"warehouse": setup.gudang(pabrik, "Gudang Barang Jadi"),
					}
				],
			}
		).insert(ignore_permissions=True)
		so.submit()
		tandai("Sales Order", so.name)


def _pengguna(pabrik: str, kantor: str, sandi: str) -> dict[str, str]:
	"""One user per bagian, with its Role and Module Profile and its company; all share `sandi`."""
	from erp_internal.tampilan import PROFIL_PERAN

	pengguna = {}
	for bagian in PROFIL_PERAN:
		company = kantor if bagian in BAGIAN_KANTOR else pabrik
		email = utils.buat_pengguna(surel(bagian), bagian, bagian, company)
		update_password(email, sandi)
		pengguna[bagian] = tandai("User", email)
	return pengguna


def _kantor(kantor: str, pengguna: dict[str, str], hari_ini: date) -> None:
	"""Office employees on the Kantor shift with this year's annual leave, and one project with tasks."""
	shift = setup.SHIFT_KANTOR["name"]
	mulai = getdate(frappe.db.get_value("Shift Type", shift, "process_attendance_after") or hari_ini)
	awal, akhir = date(hari_ini.year, 1, 1), date(hari_ini.year, 12, 31)
	for depan, belakang, kelamin, bagian in KARYAWAN:
		emp = utils.buat_karyawan(
			depan,
			kantor,
			user=pengguna.get(bagian),
			izin_sendiri=bagian == "Karyawan",  # HR and the manager see everyone
			kelamin=kelamin,
			last_name=belakang,
		)
		tandai("Employee", emp)
		tandai("Shift Assignment", utils.penugasan_shift(emp, shift, mulai))
		tandai("Leave Allocation", utils.jatah_cuti(emp, "Cuti Tahunan", 12, awal, akhir))

	proyek = frappe.db.get_value("Project", {"project_name": PROYEK, "company": kantor})
	if not proyek:
		proyek = (
			frappe.get_doc(
				{
					"doctype": "Project",
					"project_name": PROYEK,
					"company": kantor,
					"expected_start_date": hari_ini,
					"expected_end_date": add_days(hari_ini, 60),
					"notes": TANDA,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
	tandai("Project", proyek)

	for i, judul in enumerate(TUGAS):
		tugas = frappe.db.get_value("Task", {"subject": judul, "project": proyek})
		if not tugas:
			tugas = (
				frappe.get_doc(
					{
						"doctype": "Task",
						"subject": judul,
						"project": proyek,
						"exp_start_date": add_days(hari_ini, 20 * i),
						"exp_end_date": add_days(hari_ini, 20 * i + 14),
					}
				)
				.insert(ignore_permissions=True)
				.name
			)
		tandai("Task", tugas)

	karyawan = pengguna.get("Karyawan")
	pertama = frappe.db.get_value("Task", {"subject": TUGAS[0], "project": proyek})
	if karyawan and not frappe.db.exists(
		"ToDo",
		{"reference_type": "Task", "reference_name": pertama, "allocated_to": karyawan, "status": "Open"},
	):
		from frappe.desk.form.assign_to import add as tugaskan

		tugaskan({"assign_to": [karyawan], "doctype": "Task", "name": pertama})
