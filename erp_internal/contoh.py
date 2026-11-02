"""Sample data, marked DATA CONTOH, for the local dry runs and the browser check (plan Revision 3 item 4).

    bench --site erp.localhost set-config erp_sandi_contoh <password>
    bench --site erp.localhost execute erp_internal.contoh.buat_contoh

Idempotent: each record is looked up by its natural key before it is made, so a second run adds nothing.
Refused on a production site (site config `erp_produksi`). Every record made here carries the tag DATA CONTOH
(`_user_tags`), so it can be listed and removed before go-live. The fixtures are the get-or-create helpers of
`tests/utils.py`, the same ones the tests use.
"""

import math
from datetime import date, timedelta

import frappe
from frappe import _
from frappe.desk.doctype.tag.tag import DocTags
from frappe.utils import add_days, add_months, flt, get_datetime, get_first_day, getdate, today
from frappe.utils.password import update_password

from erp_internal import setup
from erp_internal.planning.kapasitas import buat_bom_kapasitas
from erp_internal.tampilan import ADMIN, DEVELOPER, MODUL_BOLEH, PROFIL_PERAN, USER
from erp_internal.tests import utils

TANDA = "DATA CONTOH"

# The one company, factory and office together (Samuel, 2026-10-28), under its real name so the Production Floor
# shows it; abbreviation CPL kept from the earlier sample name PT Contoh Plastik (renamed on erp.localhost 2026-10-29).
PERUSAHAAN = ("PT Delta Anugrah", "CPL")

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

# Machine Capacity rows: (product, machine number, cycle seconds, cavities, part g, runner g, resin,
# masterbatch or None, masterbatch percent). Mesin 02 is the older, slower machine.
KAPASITAS = (
	("CTH-EMBER-10L", 1, 45, 2, 750, 50, "CTH-BIJI-PP", "CTH-PEWARNA", 2),
	("CTH-EMBER-10L", 2, 55, 2, 750, 50, "CTH-BIJI-PP", "CTH-PEWARNA", 2),
	("CTH-BASKOM-40", 1, 40, 2, 380, 30, "CTH-BIJI-PP", "CTH-PEWARNA", 2),
	("CTH-BASKOM-40", 2, 48, 2, 380, 30, "CTH-BIJI-PP", "CTH-PEWARNA", 2),
	("CTH-GAYUNG", 1, 20, 4, 140, 20, "CTH-BIJI-PP", "CTH-PEWARNA", 3),
	("CTH-GAYUNG", 2, 24, 4, 140, 20, "CTH-BIJI-PP", "CTH-PEWARNA", 3),
	("CTH-TOPLES-1L", 1, 30, 2, 190, 20, "CTH-BIJI-HDPE", None, 0),
	("CTH-TOPLES-1L", 2, 36, 2, 190, 20, "CTH-BIJI-HDPE", None, 0),
	("CTH-KURSI", 1, 70, 1, 1450, 80, "CTH-BIJI-HDPE", "CTH-PEWARNA", 2),
	("CTH-KURSI", 2, 85, 1, 1450, 80, "CTH-BIJI-HDPE", "CTH-PEWARNA", 2),
)
# Open Work Orders (product, machine number, the Achieved % its sample output lands on). Each plans the seven
# days of output, from the first entry day to yesterday: its quantity is the good pieces made divided by that
# share (capacity x a 12 h shift x 7 days times the yield), so the report shows green (100), orange (85 up to
# 100) and red (below 85). An order takes no output past its quantity, so 100 is the most it can reach.
ORDER_PRODUKSI = (
	("CTH-EMBER-10L", 1, 1.0),
	("CTH-GAYUNG", 1, 1.0),
	("CTH-BASKOM-40", 2, 0.72),
	("CTH-KURSI", 2, 0.95),
)
HARI_PRODUKSI = 7  # days of Production Entries, ending yesterday
# Resin and masterbatch received the day before the first entry (kg): the entries are back-dated and need stock.
TERIMA_BAHAN = {"CTH-BIJI-PP": 30000, "CTH-BIJI-HDPE": 18000, "CTH-PEWARNA": 1200}
CATATAN_TERIMA = f"{TANDA}: bahan baku untuk hasil produksi contoh"
YIELD_HARIAN = (0.86, 0.92, 0.89, 0.95, 0.84, 0.9, 0.93)  # share of the machine's shift output actually made
# Reject reasons by day (share of good pieces); a day lacks the reasons that are 0.
ALASAN_HARIAN = (
	{"Short Shot": 0.03, "Flashing": 0.01},
	{"Flashing": 0.02},
	{"Short Shot": 0.02, "Belang / Warna": 0.015},
	{"Bubble": 0.01},
	{"Short Shot": 0.04, "Flashing": 0.02, "Pecah / Retak": 0.01},
	{"Sink Mark": 0.015, "Flashing": 0.01},
	{"Short Shot": 0.02},
)

# Employees: (first name, last name, gender, the Role Profile whose sample user they are, or None).
KARYAWAN = (
	("Ayu", "Lestari", "Female", ADMIN),
	("Citra", "Wulandari", "Female", USER),
	("Bima", "Saputra", "Male", None),
	("Dimas", "Pratama", "Male", None),
	("Eka", "Putri", "Female", None),
)
PROYEK = "Katalog Produk Online"
TUGAS = ("Desain halaman katalog", "Foto dan data produk", "Uji dan rilis")  # the first goes to the User

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
	"Machine Capacity",
	"Work Order",
	"Production Entry",
	"Stock Entry",
)


def buat_contoh() -> dict[str, int]:
	"""Create or complete the sample data. Returns how many records of each DocType carry DATA CONTOH."""
	if frappe.conf.get("erp_produksi"):
		frappe.throw(_("Sample data is not allowed on a production site (site config erp_produksi is set)."))
	sandi = frappe.conf.get("erp_sandi_contoh")
	if not sandi:
		frappe.throw(_("Set site config erp_sandi_contoh first: it is the password of the sample users."))

	hari_ini = getdate(today())
	company = tandai("Company", utils.buat_perusahaan(*PERUSAHAAN))
	_logo(company)
	_barang(company)
	_jual_beli(company, hari_ini)
	_produksi(company, hari_ini)
	pengguna = _pengguna(company, sandi)
	_kantor(company, pengguna, hari_ini)
	return {dt: frappe.db.count(dt, {"_user_tags": ("like", f"%{TANDA}%")}) for dt in DIBUAT}


def tandai(doctype: str, nama: str) -> str:
	"""Tag one record DATA CONTOH (a second tag is a no-op)."""
	DocTags(doctype).add(nama, TANDA)
	return nama


def surel(profil: str) -> str:
	"""The sample user of a Role Profile: `<profile, lower case>@example.com` (as `tools/cek_layar.mjs`)."""
	return f"{profil.lower()}@example.com"


def _logo(company: str) -> None:
	"""Attach the Delta Anugrah logo as the company logo, once (the Production Floor's top bar shows it)."""
	if frappe.db.get_value("Company", company, "company_logo"):
		return
	with open(frappe.get_app_path("erp_internal", "public", "images", "delta-anugrah.png"), "rb") as f:
		isi = f.read()
	berkas = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": "delta-anugrah.png",
			"attached_to_doctype": "Company",
			"attached_to_name": company,
			"attached_to_field": "company_logo",
			"is_private": 0,
			"content": isi,
		}
	).insert(ignore_permissions=True)
	frappe.db.set_value("Company", company, "company_logo", berkas.file_url)


def _barang(company: str) -> None:
	"""Items, their opening stock (only where the item has never moved), BOMs and lead times."""
	for kode, (nama, grup, satuan, lain, harga, stok) in BARANG.items():
		utils.buat_barang(kode, grup, satuan, lain, item_name=nama, description=f"{nama} ({TANDA})")
		tandai("Item", kode)
		gudang = setup.GUDANG_GRUP[grup]
		wh = setup.gudang(company, gudang)
		if not frappe.db.exists(
			"Stock Ledger Entry", {"item_code": kode, "warehouse": wh, "is_cancelled": 0}
		):
			utils.stok_awal(company, kode, stok, gudang, rate=harga)
			sr = frappe.db.get_value(
				"Stock Ledger Entry", {"item_code": kode, "warehouse": wh, "is_cancelled": 0}, "voucher_no"
			)
			tandai("Stock Reconciliation", sr)

	for kode, (jumlah, bahan) in RESEP.items():
		tandai("BOM", utils.buat_bom(kode, bahan, jumlah, company=company))
		per_hari, cadangan = LAMA[kode]
		tandai("Item Lead Time", utils.lama_produksi(kode, per_hari, cadangan))


def _jual_beli(company: str, hari_ini: date) -> None:
	"""Customers, suppliers, six full months of Sales History and the open orders."""
	for nama in PELANGGAN:
		tandai("Customer", utils.buat_pelanggan(nama))
	for nama in PEMASOK:
		tandai("Supplier", utils.buat_pemasok(nama))

	for i, faktor in enumerate(POLA):
		bulan = getdate(get_first_day(add_months(hari_ini, i - len(POLA))))
		utils.tahun_fiskal(bulan)
		for kode, qty in JUAL_SEBULAN.items():
			tandai("Sales History", utils.riwayat(company, kode, bulan, round(qty * faktor)))

	utils.tahun_fiskal(hari_ini)
	harga = tandai("Price List", utils.daftar_harga(DAFTAR_HARGA, jual=True))
	for po, pelanggan, kode, qty, satuan, hari in ORDER:
		ada = frappe.db.get_value("Sales Order", {"po_no": po, "company": company, "docstatus": ("<", 2)})
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
				"company": company,
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
						"warehouse": setup.gudang(company, "Gudang Barang Jadi"),
					}
				],
			}
		).insert(ignore_permissions=True)
		so.submit()
		tandai("Sales Order", so.name)


def _pengguna(company: str, sandi: str) -> dict[str, str]:
	"""One user per Role Profile, with its Module Profile (Developer has none) and, for Admin and User, a
	default permission on the company; all share `sandi`."""
	pengguna = {}
	for profil in PROFIL_PERAN:
		modul = profil if profil in MODUL_BOLEH else None
		email = utils.buat_pengguna(surel(profil), profil, modul, None if profil == DEVELOPER else company)
		update_password(email, sandi)
		pengguna[profil] = tandai("User", email)
	return pengguna


def _kantor(company: str, pengguna: dict[str, str], hari_ini: date) -> None:
	"""Employees on the Kantor shift with this year's annual leave, and one project with tasks."""
	shift = setup.SHIFT_KANTOR["name"]
	mulai = getdate(frappe.db.get_value("Shift Type", shift, "process_attendance_after") or hari_ini)
	awal, akhir = date(hari_ini.year, 1, 1), date(hari_ini.year, 12, 31)
	for depan, belakang, kelamin, profil in KARYAWAN:
		emp = utils.buat_karyawan(
			depan,
			company,
			user=pengguna.get(profil),
			izin_sendiri=profil == USER,  # the Admin sees everyone
			kelamin=kelamin,
			last_name=belakang,
		)
		tandai("Employee", emp)
		tandai("Shift Assignment", utils.penugasan_shift(emp, shift, mulai))
		tandai("Leave Allocation", utils.jatah_cuti(emp, "Cuti Tahunan", 12, awal, akhir))

	proyek = frappe.db.get_value("Project", {"project_name": PROYEK, "company": company})
	if not proyek:
		proyek = (
			frappe.get_doc(
				{
					"doctype": "Project",
					"project_name": PROYEK,
					"company": company,
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

	karyawan = pengguna.get(USER)
	pertama = frappe.db.get_value("Task", {"subject": TUGAS[0], "project": proyek})
	if karyawan and not frappe.db.exists(
		"ToDo",
		{"reference_type": "Task", "reference_name": pertama, "allocated_to": karyawan, "status": "Open"},
	):
		from frappe.desk.form.assign_to import add as tugaskan

		tugaskan({"assign_to": [karyawan], "doctype": "Task", "name": pertama})


def _mesin(nomor: int) -> str:
	"""The numbered machine `Mesin NN` (made by master.py when it ran; made here otherwise)."""
	nama = f"Mesin {nomor:02d}"
	if not frappe.db.exists("Workstation", nama):
		frappe.get_doc({"doctype": "Workstation", "workstation_name": nama, "erp_nomor": nomor}).insert(
			ignore_permissions=True
		)
	return nama


def _produksi(company: str, hari_ini: date) -> None:
	"""Capacity rows and their BOMs, open Work Orders, and seven days of Production Entries with rejects
	ending yesterday. The material is received dated before the first entry so every back-dated stock
	entry has stock on its date."""
	kapasitas = {}
	for kode, no, siklus, rongga, bagian, runner, bahan, mb, persen in KAPASITAS:
		mesin = _mesin(no)
		nilai = {"cycle_time": siklus, "cavities": rongga, "part_weight": bagian, "runner_weight": runner}
		nilai |= {"material": bahan, "masterbatch": mb, "masterbatch_percent": persen}
		baris = utils.buat_kapasitas(kode, mesin, **nilai)
		tandai("Machine Capacity", baris)
		buat_bom_kapasitas(baris, company)
		for bom in frappe.get_all("BOM", {"erp_kapasitas": baris}, pluck="name"):
			tandai("BOM", bom)
		kapasitas[kode, mesin] = frappe.db.get_value("Machine Capacity", baris, "pcs_per_hour")

	_terima_bahan(company, add_days(hari_ini, -HARI_PRODUKSI - 1))
	for kode, no, capai in ORDER_PRODUKSI:
		mesin = _mesin(no)
		per_jam = kapasitas[kode, mesin]
		qty = math.ceil(sum(_bagus(per_jam, i) for i in range(HARI_PRODUKSI)) / capai)
		wo = _order(company, kode, mesin, qty, add_days(hari_ini, -HARI_PRODUKSI), add_days(hari_ini, -1))
		for i in range(HARI_PRODUKSI):
			hari = add_days(hari_ini, i - HARI_PRODUKSI)
			_hasil(wo, hari, i, kapasitas[kode, mesin])


def _terima_bahan(company: str, tanggal: date) -> None:
	"""Material Receipts of the sample resin and masterbatch into Gudang Bahan Baku, dated before the first
	entry. A Stock Reconciliation inside the window (the opening stock of an earlier run) resets the stock
	to its own figure, so a second receipt follows right after the latest one."""
	wh = setup.gudang(company, "Gudang Bahan Baku")
	saat = [(tanggal, "00:01:00")]
	reco = frappe.get_all(
		"Stock Ledger Entry",
		{
			"voucher_type": "Stock Reconciliation",
			"is_cancelled": 0,
			"warehouse": wh,
			"item_code": ("in", list(TERIMA_BAHAN)),
			"posting_date": (">=", tanggal),
		},
		["posting_date", "posting_time"],
		order_by="posting_date desc, posting_time desc",
		limit=1,
	)
	if reco:
		sesudah = get_datetime(f"{reco[0].posting_date} {reco[0].posting_time}").replace(
			microsecond=0
		) + timedelta(seconds=1)
		saat.append((sesudah.date(), sesudah.strftime("%H:%M:%S")))
	for hari, jam in saat:
		catatan = f"{CATATAN_TERIMA} ({hari} {jam})"
		ada = frappe.db.get_value("Stock Entry", {"remarks": catatan, "company": company, "docstatus": 1})
		if not ada:
			utils.tahun_fiskal(hari)
			se = frappe.get_doc(
				{
					"doctype": "Stock Entry",
					"stock_entry_type": "Material Receipt",
					"company": company,
					"set_posting_time": 1,
					"posting_date": hari,
					"posting_time": jam,
					"remarks": catatan,
					"items": [
						{
							"item_code": kode,
							"qty": qty,
							"t_warehouse": wh,
							"basic_rate": BARANG[kode][4],
						}
						for kode, qty in TERIMA_BAHAN.items()
					],
				}
			).insert(ignore_permissions=True)
			se.submit()
			ada = se.name
		tandai("Stock Entry", ada)


def _bagus(per_jam: float, urutan: int) -> int:
	"""The good pieces of the sample Shift 1 entry number `urutan`."""
	return round(flt(per_jam) * setup.jam_shift("Shift 1") * YIELD_HARIAN[urutan % len(YIELD_HARIAN)])


def _order(company: str, kode: str, mesin: str, qty: int, mulai: date, selesai: date) -> str:
	"""The sample Work Order of `kode` on `mesin` planned from `mulai` to `selesai` (BOM: the one made for that
	machine), found by tag and start date among the orders not stopped, so a rerun the same day changes
	nothing. A run on another day plans a new window: the open orders of earlier runs first lose their
	entries inside it and are stopped."""
	tagged = {
		"production_item": kode,
		"erp_mesin": mesin,
		"company": company,
		"docstatus": 1,
		"_user_tags": ("like", f"%{TANDA}%"),
		"status": ("not in", ("Stopped", "Closed")),
	}
	ada = frappe.db.get_value("Work Order", {**tagged, "planned_start_date": ("between", (mulai, mulai))})
	if not ada:
		for lama in frappe.get_all("Work Order", tagged, pluck="name"):
			_lepas(lama, mulai)
		bom = frappe.db.get_value(
			"BOM",
			{
				"item": kode,
				"erp_mesin": mesin,
				"docstatus": 1,
				"is_active": 1,
				"erp_kapasitas": ("is", "set"),
			},
			"name",
			order_by="creation desc, name desc",
		)
		wo = frappe.get_doc(
			{
				"doctype": "Work Order",
				"production_item": kode,
				"bom_no": bom,
				"qty": qty,
				"company": company,
				"erp_mesin": mesin,
				"skip_transfer": 1,
				"planned_start_date": mulai,
				"planned_end_date": selesai,
			}
		).insert(ignore_permissions=True)
		wo.submit()
		ada = wo.name
	return tandai("Work Order", ada)


def _lepas(wo: str, mulai: date) -> None:
	"""Cancel the Production Entries of an earlier run's order dated `mulai` or later (the new window would
	count them twice), then stop the order (a Completed one reopens when its entries are cancelled)."""
	for pe in frappe.get_all(
		"Production Entry",
		{"work_order": wo, "docstatus": 1, "posting_date": (">=", mulai)},
		pluck="name",
		order_by="posting_date desc, creation desc",
	):
		frappe.get_doc("Production Entry", pe).cancel()
	order = frappe.get_doc("Work Order", wo)
	order.update_status("Stopped")
	order.update_planned_qty()


def _hasil(wo: str, hari: date, urutan: int, per_jam: float) -> None:
	"""One Shift 1 Production Entry of the order on `hari`, unless it exists (found by order, day and shift)."""
	ada = frappe.db.get_value(
		"Production Entry",
		{"work_order": wo, "posting_date": hari, "shift": "Shift 1", "docstatus": ("<", 2)},
	)
	if not ada:
		bagus = _bagus(per_jam, urutan)
		reject = {
			alasan: max(1, round(bagus * porsi))
			for alasan, porsi in ALASAN_HARIAN[urutan % len(ALASAN_HARIAN)].items()
		}
		ada = utils.buat_hasil(wo, bagus, reject, posting_date=hari).name
	tandai("Production Entry", ada)
	for fk in ("manufacture_entry", "reject_entry"):
		if se := frappe.db.get_value("Production Entry", ada, fk):
			tandai("Stock Entry", se)
