"""Only the modules in use (the dock, sidebars, the three Role Profiles and their Module Profiles) and friendly screens
(module home pages, shorter forms)."""

import json

import frappe
from frappe.desk.doctype.dock.dock import get_app_dock, resolve_app_dock
from frappe.desk.doctype.sidebar.sidebar import resolve_sidebar
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, today

from erp_internal.tampilan import (
	ADMIN,
	APLIKASI,
	DEVELOPER,
	IKON,
	MODUL_BOLEH,
	PINTASAN,
	PROFIL_PERAN,
	RUMAH_SENDIRI,
	SEMBUNYI,
	SIDEBAR,
	USER,
	modul_aplikasi,
	pintasan_aktif,
	terapkan,
)
from erp_internal.tests.utils import (
	buat_barang,
	buat_karyawan,
	buat_pelanggan,
	buat_pengguna,
	buat_perusahaan,
	daftar_harga,
)

# Role Profile → (DocTypes it must create, DocTypes it must not). Developer is checked on Build doctypes.
_HARIAN = [
	"Stock Entry",
	"Material Request",
	"Customer",
	"Sales Order",
	"Delivery Note",
	"Sales Invoice",
	"Payment Entry",
	"Purchase Order",
	"Purchase Receipt",
	"Purchase Invoice",
	"Work Order",
	"Sales History",
	"Sales Forecast",
	"Timesheet",
]
_KELOLA = [
	"Item",
	"Supplier",
	"Stock Reconciliation",
	"Item Lead Time",
	"Employee",
	"Shift Type",
	"Holiday List",
	"Leave Allocation",
	"User",
]
_BUILD = [
	"DocType",
	"Custom Field",
	"Property Setter",
	"Client Script",
	"Role",
	"Role Profile",
	"Module Profile",
	"User Permission",
	"Data Import",
]
IZIN = {
	USER: ([*_HARIAN, "Employee Checkin", "Leave Application"], [*_KELOLA, *_BUILD, "Server Script"]),
	ADMIN: ([*_HARIAN, *_KELOLA, "Project", "Master Production Schedule"], [*_BUILD, "Server Script"]),
	DEVELOPER: ([*_KELOLA, *_BUILD], []),
}
# Business settings Admin changes; System Settings stays with System Manager (Developer).
PENGATURAN_BISNIS = [
	"Company",
	"Stock Settings",
	"Selling Settings",
	"Buying Settings",
	"Manufacturing Settings",
	"Accounts Settings",
	"Projects Settings",
	"HR Settings",
]


def pengguna_profil(profil: str, jenis: str) -> str:
	"""A test user of that Role Profile and its Module Profile (Developer has none), with the Employee record
	the Employee role needs (ERPNext drops it from a user without one)."""
	u = buat_pengguna(surel(profil, jenis), profil, profil if profil in MODUL_BOLEH else None, None)
	if "Employee" in PROFIL_PERAN[profil]:
		buat_karyawan(f"_Uji {jenis} {profil}", buat_perusahaan("_Uji Pabrik", "_UP"), user=u)
	return u


def surel(profil: str, jenis: str = "izin") -> str:
	return f"_uji.{jenis}.{profil.lower()}@example.com"


def get_workspaces_pengguna(u: str) -> list[dict]:
	"""The Workspace pages a user's desk boots with."""
	from frappe.desk.desktop import get_workspaces

	def bersih():
		# get_workspaces is cached per request, not per user
		if hasattr(frappe.local, "request_cache"):
			frappe.local.request_cache.clear()

	bersih()
	frappe.set_user(u)
	try:
		return get_workspaces()["pages"]
	finally:
		frappe.set_user("Administrator")
		bersih()


def jejak_modified() -> dict:
	"""The `modified` of every record `terapkan()` writes."""
	return {
		dt: dict(frappe.get_all(dt, filters, ["name", "modified"], as_list=True))
		for dt, filters in (
			("Dock", {"standard": 0, "user": ("is", "not set")}),
			("Custom Sidebar", {"user": ("is", "not set")}),
			("Module Profile", {}),
			("Role Profile", {}),
			("Custom Workspace", {"workspace": ("in", list(PINTASAN))}),
			("Workspace", {"name": ("in", list(RUMAH_SENDIRI.values()))}),
			("Property Setter", {"doc_type": ("in", list(SEMBUNYI)), "property": "hidden"}),
		)
	}


class TestTampilan(IntegrationTestCase):
	def test_izin_per_profil(self):
		for profil, (boleh, tidak) in IZIN.items():
			u = pengguna_profil(profil, "izin")
			# Every form of theirs reads the company's defaults (cek_layar: "No permission for Company").
			self.assertTrue(frappe.has_permission("Company", "read", user=u), f"{profil} must read Company")
			for dt in boleh:
				self.assertTrue(frappe.has_permission(dt, "create", user=u), f"{profil} must create {dt}")
			for dt in tidak:
				self.assertFalse(
					frappe.has_permission(dt, "create", user=u), f"{profil} must not create {dt}"
				)

	def test_pengaturan_bisnis(self):
		# Admin writes the business settings, User none; only Developer (System Manager) System Settings.
		for profil in PROFIL_PERAN:
			u = pengguna_profil(profil, "atur")
			for dt in PENGATURAN_BISNIS:
				self.assertEqual(
					frappe.has_permission(dt, "write", user=u), profil != USER, f"{profil} write {dt}"
				)
			self.assertEqual(
				frappe.has_permission("System Settings", "write", user=u),
				profil == DEVELOPER,
				f"{profil} write System Settings",
			)

	def test_dok(self):
		# Administrator's rail: the kept modules first, in IKON order; every other entry hidden.
		for app in APLIKASI:
			dasar = [row["link_to"] for row in get_app_dock(app)]
			rail = resolve_app_dock(app, upto="site", gated=False)
			tampil = [e["link_to"] for e in rail if not e["hidden"]]
			self.assertEqual(tampil, [k for k in IKON if k in dasar], app)
			self.assertEqual({e["link_to"] for e in rail}, set(dasar), app)

	def test_dok_per_profil(self):
		# A user's rail shows only their profile's modules (the Module Profile blocks the rest); Developer
		# (System Manager) sees every kept one.
		for profil in PROFIL_PERAN:
			u = pengguna_profil(profil, "dok")
			frappe.set_user(u)
			try:
				tampil = {e["link_to"] for app in APLIKASI for e in resolve_app_dock(app) if not e["hidden"]}
			finally:
				frappe.set_user("Administrator")
			harap = set(IKON) if profil == DEVELOPER else {k for k, siapa in IKON.items() if profil in siapa}
			self.assertEqual(tampil, harap, profil)

	def test_layar_apps_per_profil(self):
		# An Apps screen tile shows only when its app has a module of that profile (tampilan.saring_aplikasi),
		# and never Frappe's own tile (Build, System Settings: System Manager only).
		from frappe.boot import get_bootinfo

		from erp_internal.tampilan import saring_aplikasi

		for profil in MODUL_BOLEH:
			u = pengguna_profil(profil, "apps")
			frappe.set_user(u)
			try:
				boot = get_bootinfo()
				saring_aplikasi(boot)
			finally:
				frappe.set_user("Administrator")
			tampil = {a["app_name"] for a in boot.app_data if a.get("on_apps_screen")}
			harap = {
				app
				for app in APLIKASI
				if any(
					profil in siapa
					for k, siapa in IKON.items()
					if k in {r["link_to"] for r in get_app_dock(app)}
				)
			}
			self.assertEqual(tampil, harap, profil)

	def test_merek_aplikasi(self):
		# Every app tile and rail top slot shows our name and icon (tampilan.merek_aplikasi), whatever the
		# profile; the apps' own hooks keep their logos.
		import os

		from frappe.boot import get_bootinfo

		from erp_internal.tampilan import IKON_APLIKASI, NAMA_APLIKASI, merek_aplikasi, saring_aplikasi

		self.assertEqual(set(IKON_APLIKASI), set(NAMA_APLIKASI))
		for url in IKON_APLIKASI.values():
			berkas = frappe.get_app_path("erp_internal", "public", url.removeprefix("/assets/erp_internal/"))
			self.assertTrue(os.path.isfile(berkas), berkas)

		for profil in PROFIL_PERAN:
			u = pengguna_profil(profil, "merek")
			frappe.set_user(u)
			try:
				boot = get_bootinfo()
				saring_aplikasi(boot)
				merek_aplikasi(boot)
			finally:
				frappe.set_user("Administrator")
			apps = {a["app_name"]: a for a in boot.app_data}
			for app, nama in NAMA_APLIKASI.items():
				self.assertEqual(apps[app]["app_title"], nama, profil)
				self.assertEqual(apps[app]["app_logo_url"], IKON_APLIKASI[app], profil)
			tampil = {a["app_title"] for a in boot.app_data if a.get("on_apps_screen")}
			self.assertNotIn("ERPNext", tampil)
			self.assertEqual("System" in tampil, profil == DEVELOPER, profil)
		self.assertEqual(frappe.get_hooks("app_logo_url", app_name="erpnext")[0][:16], "/assets/erpnext/")

	def test_merek_aplikasi_tak_pernah_gagal(self):
		from erp_internal.tampilan import merek_aplikasi

		merek_aplikasi(frappe._dict(app_data=[None]))  # a broken entry is logged, boot goes on

	def test_sidebar(self):
		# Each kept sidebar opens on its module's home Workspace, then the SIDEBAR links in order.
		for shell, link in SIDEBAR.items():
			items = [i for i in resolve_sidebar(shell, "Administrator").items if i["type"] == "Link"]
			self.assertEqual(items[0]["link_type"], "Workspace", shell)
			self.assertEqual([i["link_to"] for i in items[1:]], link, shell)
			self.assertNotIn("Dashboard", {i["link_type"] for i in items}, shell)

	def test_production_floor_in_manufacturing(self):
		# The floor page is the first link after Manufacturing's home, labelled by name (a Page is named by its
		# route), and the first shortcut of the home.
		items = [i for i in resolve_sidebar("Manufacturing", "Administrator").items if i["type"] == "Link"]
		self.assertEqual(
			(items[1]["link_to"], items[1]["label"], items[1]["link_type"]),
			("production-floor", "Production Floor", "Page"),
		)
		self.assertEqual(pintasan_aktif("Manufacturing")[0]["link_to"], "production-floor")

	def test_profil_modul(self):
		for profil, boleh in MODUL_BOLEH.items():
			blok = {b.module for b in frappe.get_doc("Module Profile", profil).block_modules}
			self.assertEqual(blok, set(modul_aplikasi()) - set(boleh), profil)

	def test_profil_modul_ikut_ikon(self):
		# Every module a profile has an icon for is allowed by its Module Profile, plus the modules whose
		# documents sit in other sidebars (MODUL_TANPA_IKON), and nothing else is.
		from frappe.desk.doctype.sidebar.sidebar import module_of_shell

		from erp_internal.tampilan import MODUL_TANPA_IKON

		for profil, boleh in MODUL_BOLEH.items():
			ikon = {module_of_shell(k) for k, siapa in IKON.items() if profil in siapa}
			self.assertEqual(ikon | set(MODUL_TANPA_IKON), set(boleh), profil)

	def test_rumah_sama_dengan_sidebar(self):
		# Each module home lists only its sidebar's links, as shortcuts and nothing else: no number card, link
		# card, chart, header or onboarding (Samuel, 2026-10-28: keep every screen short).
		from frappe.desk.doctype.custom_workspace.custom_workspace import (
			apply_customization,
			get_customization,
		)

		for shell, link in SIDEBAR.items():
			items = [i for i in resolve_sidebar(shell, "Administrator").items if i["type"] == "Link"]
			ws = items[0]["link_to"]
			self.assertIn(ws, PINTASAN, shell)
			doc = frappe.get_doc("Workspace", ws)
			if ws not in RUMAH_SENDIRI.values():  # our own Workspace holds its content itself
				apply_customization(doc, get_customization(ws))
			blok = json.loads(doc.content)
			self.assertEqual({b["type"] for b in blok}, {"shortcut"}, ws)
			self.assertEqual(len(blok), len(link), ws)
			tampil = {
				s.link_to for s in doc.shortcuts if s.label in {b["data"]["shortcut_name"] for b in blok}
			}
			self.assertEqual(tampil, set(link), ws)

	def test_rumah_hr(self):
		# The HR home is our own Workspace titled "HR" (page title, breadcrumb, tab), "SDM" in Indonesian, first
		# in the Shift & Attendance sidebar; the base home stays (its route still opens), hidden there.
		from frappe.desk.doctype.sidebar.sidebar import module_of_shell

		for shell, ws in RUMAH_SENDIRI.items():
			doc = frappe.get_doc("Workspace", ws)
			self.assertEqual((doc.title, doc.public, doc.standard), (ws, 1, 0))
			self.assertEqual(doc.module, module_of_shell(shell))
			self.assertEqual([s.label for s in doc.shortcuts], [p["label"] for p in pintasan_aktif(ws)])
			items = [i for i in resolve_sidebar(shell, "Administrator").items if i["type"] == "Link"]
			self.assertEqual((items[0]["link_type"], items[0]["link_to"]), ("Workspace", ws))
			self.assertNotIn(shell, [i["link_to"] for i in items])
			self.assertTrue(frappe.db.exists("Workspace", shell))
		self.assertEqual(frappe.translate.get_all_translations("id").get("HR"), "SDM")
		pages = {p["name"] for p in get_workspaces_pengguna(pengguna_profil(USER, "rumah"))}
		self.assertIn("HR", pages)

	def test_rel_pendek(self):
		# The rail: at most seven modules, no Accounts or Leaves icon; Settings for Admin only.
		self.assertLessEqual(len(IKON), 7)
		self.assertFalse({"Accounts", "Leaves"} & set(IKON))
		self.assertEqual(IKON["Setup"], (ADMIN,))

	def test_user_tetap_bisa_buat_order(self):
		# a Module Profile must not break link fields on a kept form
		pabrik = buat_perusahaan("_Uji Pabrik", "_UP")
		u = buat_pengguna("_uji.user.pabrik@example.com", USER, USER, pabrik)
		pelanggan = buat_pelanggan("_Uji Pelanggan")
		barang = buat_barang("_UJI-EMBER", "Barang Jadi")
		harga = daftar_harga("_Uji Harga Jual", jual=True)  # IDR: the test site's own lists are INR
		frappe.set_user(u)
		self.addCleanup(frappe.set_user, "Administrator")
		so = frappe.get_doc(
			{
				"doctype": "Sales Order",
				"company": pabrik,
				"customer": pelanggan,
				"currency": "IDR",
				"selling_price_list": harga,
				"transaction_date": today(),
				"delivery_date": add_days(today(), 7),
				"items": [{"item_code": barang, "qty": 10, "rate": 10000}],
			}
		)
		so.insert()

	def test_izin_order_readiness(self):
		# User and Admin open Order Readiness; a user without a profile does not.
		laporan = frappe.get_doc("Report", "Order Readiness")
		for profil, boleh in ((USER, True), (ADMIN, True), (None, False)):
			frappe.set_user(buat_pengguna(surel(profil or "tanpa", "laporan"), profil, profil, None))
			try:
				self.assertEqual(bool(laporan.is_permitted()), boleh, profil)
				self.assertEqual(frappe.has_permission(laporan.ref_doctype, "report"), boleh, profil)
			finally:
				frappe.set_user("Administrator")

	def test_halaman_apps(self):
		from frappe.desk.doctype.desktop_settings.desktop_settings import APPS, get_desktop_page

		self.assertEqual(get_desktop_page(), APPS)

	def test_idempoten(self):
		terapkan()
		sebelum = jejak_modified()
		terapkan()
		self.assertEqual(jejak_modified(), sebelum)

	def test_sembunyi_aman(self):
		# Every hidden field exists and none is required without a default.
		for dt, fields in SEMBUNYI.items():
			meta = frappe.get_meta(dt)
			for f in fields:
				df = meta.get_field(f)
				self.assertIsNotNone(df, f"{dt}.{f}")
				self.assertFalse(df.reqd and not df.default, f"{dt}.{f} is required")
				self.assertEqual(df.hidden, 1, f"{dt}.{f}")

	def test_pintasan(self):
		# Each module home shows the PINTASAN shortcuts first, and no chart or onboarding.
		from frappe.desk.doctype.custom_workspace.custom_workspace import (
			apply_customization,
			get_customization,
		)

		for ws in PINTASAN:
			doc = frappe.get_doc("Workspace", ws)
			if ws not in RUMAH_SENDIRI.values():  # our own Workspace holds its content itself
				apply_customization(doc, get_customization(ws))
			blok = json.loads(doc.content)
			aktif = pintasan_aktif(ws)
			self.assertEqual(
				[b["data"]["shortcut_name"] for b in blok if b["type"] == "shortcut"],
				[p["label"] for p in aktif],
				ws,
			)
			baris = {s.label: s for s in doc.shortcuts}
			for p in aktif:
				self.assertEqual(
					(baris[p["label"]].type, baris[p["label"]].link_to), (p["type"], p["link_to"])
				)
			self.assertFalse({b["type"] for b in blok} & {"chart", "onboarding"}, ws)
