"""Only the modules in use: the dock, the sidebars, and the Role and Module Profiles per bagian."""

import frappe
from frappe.desk.doctype.dock.dock import get_app_dock, resolve_app_dock
from frappe.desk.doctype.sidebar.sidebar import resolve_sidebar
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, today

from erp_internal.tampilan import APLIKASI, IKON, MODUL_BOLEH, SIDEBAR, modul_aplikasi, terapkan
from erp_internal.tests.utils import buat_barang, buat_pelanggan, buat_pengguna, buat_perusahaan

IZIN = {
	"Gudang": (
		["Item", "Stock Entry", "Stock Reconciliation", "Delivery Note", "Purchase Receipt"],
		["Sales Order", "Purchase Order", "Work Order", "Employee"],
	),
	"Penjualan": (
		["Customer", "Sales Order", "Delivery Note", "Sales Invoice", "Payment Entry"],
		["Purchase Order", "Work Order", "Stock Reconciliation"],
	),
	"Pembelian": (
		["Supplier", "Material Request", "Purchase Order", "Purchase Invoice"],
		["Sales Order", "Work Order"],
	),
	"Produksi": (
		[
			"BOM",
			"Item Lead Time",
			"Sales Forecast",
			"Master Production Schedule",
			"Work Order",
			"Stock Entry",
		],
		["Sales Invoice", "Purchase Order"],
	),
	"HR": (
		["Employee", "Shift Type", "Holiday List", "Attendance", "Leave Allocation"],
		["Sales Order", "Stock Entry"],
	),
	"Karyawan": (
		["Employee Checkin", "Leave Application", "Timesheet"],
		["Employee", "Sales Order", "Stock Entry"],
	),
	"Manajer Proyek": (["Project", "Task", "Timesheet"], ["Sales Order", "Employee"]),
}


def surel(bagian: str, jenis: str = "izin") -> str:
	return f"_uji.{jenis}.{bagian.lower().replace(' ', '')}@contoh.test"


def jejak_modified() -> dict:
	"""The `modified` of every record `terapkan()` writes."""
	return {
		dt: dict(frappe.get_all(dt, filters, ["name", "modified"], as_list=True))
		for dt, filters in (
			("Dock", {"standard": 0, "user": ("is", "not set")}),
			("Custom Sidebar", {"user": ("is", "not set")}),
			("Module Profile", {}),
			("Role Profile", {}),
		)
	}


class TestTampilan(IntegrationTestCase):
	def test_izin_per_bagian(self):
		for bagian, (boleh, tidak) in IZIN.items():
			u = buat_pengguna(surel(bagian), bagian, None, None)
			for dt in boleh:
				self.assertTrue(frappe.has_permission(dt, "create", user=u), f"{bagian} must create {dt}")
			for dt in tidak:
				self.assertFalse(
					frappe.has_permission(dt, "create", user=u), f"{bagian} must not create {dt}"
				)

	def test_dok(self):
		# Administrator's rail: the kept modules first, in IKON order; every other entry hidden.
		for app in APLIKASI:
			dasar = [row["link_to"] for row in get_app_dock(app)]
			rail = resolve_app_dock(app, upto="site", gated=False)
			tampil = [e["link_to"] for e in rail if not e["hidden"]]
			self.assertEqual(tampil, [k for k in IKON if k in dasar], app)
			self.assertEqual({e["link_to"] for e in rail}, set(dasar), app)

	def test_dok_per_bagian(self):
		# A bagian user's rail shows only that bagian's modules (its Module Profile blocks the rest).
		for bagian in MODUL_BOLEH:
			u = buat_pengguna(surel(bagian, "dok"), bagian, bagian, None)
			frappe.set_user(u)
			try:
				tampil = {e["link_to"] for app in APLIKASI for e in resolve_app_dock(app) if not e["hidden"]}
			finally:
				frappe.set_user("Administrator")
			self.assertEqual(tampil, {k for k, siapa in IKON.items() if bagian in siapa}, bagian)

	def test_sidebar(self):
		# Each kept sidebar opens on its module's home Workspace, then the SIDEBAR links in order.
		for shell, link in SIDEBAR.items():
			items = [i for i in resolve_sidebar(shell, "Administrator").items if i["type"] == "Link"]
			self.assertEqual(items[0]["link_type"], "Workspace", shell)
			self.assertEqual([i["link_to"] for i in items[1:]], link, shell)

	def test_profil_modul(self):
		for profil, boleh in MODUL_BOLEH.items():
			blok = {b.module for b in frappe.get_doc("Module Profile", profil).block_modules}
			self.assertEqual(blok, set(modul_aplikasi()) - set(boleh), profil)

	def test_profil_modul_ikut_ikon(self):
		# Every module a bagian has an icon for is allowed by its Module Profile, and nothing else is.
		from frappe.desk.doctype.sidebar.sidebar import module_of_shell

		for bagian, boleh in MODUL_BOLEH.items():
			ikon = {module_of_shell(k) for k, siapa in IKON.items() if bagian in siapa}
			self.assertEqual(ikon, set(boleh), bagian)

	def test_penjualan_tetap_bisa_buat_order(self):
		# a Module Profile must not break link fields on a kept form
		pabrik = buat_perusahaan("_Uji Pabrik", "_UP", "Pabrik")
		u = buat_pengguna("_uji.penjualan.pabrik@contoh.test", "Penjualan", "Penjualan", pabrik)
		pelanggan = buat_pelanggan("_Uji Pelanggan")
		barang = buat_barang("_UJI-EMBER", "Barang Jadi")
		frappe.set_user(u)
		self.addCleanup(frappe.set_user, "Administrator")
		so = frappe.get_doc(
			{
				"doctype": "Sales Order",
				"company": pabrik,
				"customer": pelanggan,
				"transaction_date": today(),
				"delivery_date": add_days(today(), 7),
				"items": [{"item_code": barang, "qty": 10, "rate": 10000}],
			}
		)
		so.insert()

	def test_halaman_apps(self):
		from frappe.desk.doctype.desktop_settings.desktop_settings import APPS, get_desktop_page

		self.assertEqual(get_desktop_page(), APPS)

	def test_idempoten(self):
		terapkan()
		sebelum = jejak_modified()
		terapkan()
		self.assertEqual(jejak_modified(), sebelum)
