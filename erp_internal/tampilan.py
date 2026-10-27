"""Show only the modules in use. `setup.pastikan_setup` calls `terapkan()` last, on every migrate.

Frappe v16.53's desk is module-first. With Desktop Settings on its default "Apps" page there is no icon
grid (Desktop Icon rows are a retiring surface that such a site never creates). What a user sees is:

- the apps screen, one tile per app, gated by the app's own permission hook;
- the dock: each app's rail of module buttons. A site layer (a `Dock` row with a blank `user`) arranges and
  hides them for everyone, Administrator included;
- each module's sidebar. A site `Custom Sidebar` layer arranges, hides and adds its items;
- per user, `User.block_modules`, copied from the user's Module Profile. A blocked module leaves the rail
  and the sidebars; it never blocks the documents themselves (Frappe keeps that to DocPerm).

Nothing here edits an ERPNext or HRMS row: every change is a site layer over the app's own, so an app
update keeps arriving underneath. Each write happens only when the stored layer differs.
"""

import frappe

APLIKASI = ("erpnext", "hrms")  # the apps whose docks and modules this file arranges

# Dock entry (the module's sidebar name) → the bagian that see it. System Manager sees every kept one.
# Order is the rail's order. Every other entry of the APLIKASI docks is hidden for everyone.
IKON = {
	"Stock": ("Gudang", "Penjualan", "Pembelian", "Produksi"),
	"Selling": ("Penjualan",),
	"Buying": ("Pembelian",),
	"Manufacturing": ("Produksi",),
	"Accounts": ("Penjualan", "Pembelian"),
	"Projects": ("Manajer Proyek", "Karyawan"),
	"Shift & Attendance": ("HR", "Karyawan"),
	"Leaves": ("HR", "Karyawan"),
}

# A kept module shown under another name, on its rail button and its sidebar header.
LABEL = {"Accounts": "Invoicing"}

# Sidebar → the `link_to` values kept, in this order, after the module's home Workspace (always first,
# so the module opens on it). A link the app's sidebar lacks is added; every other item is hidden.
SIDEBAR = {
	"Stock": ["Item", "Warehouse", "Stock Entry", "Stock Reconciliation", "Stock Balance", "Stock Ledger"],
	"Selling": ["Customer", "Sales Order", "Delivery Note", "Sales Invoice", "Sales Order Analysis"],
	"Buying": ["Supplier", "Material Request", "Purchase Order", "Purchase Receipt", "Purchase Invoice"],
	"Manufacturing": [
		"Sales Forecast",
		"Master Production Schedule",
		"Material Requirements Planning Report",
		"Work Order",
		"BOM",
		"Item Lead Time",
	],
	"Accounts": [
		"Sales Invoice",
		"Purchase Invoice",
		"Payment Entry",
		"Accounts Receivable",
		"Accounts Payable",
	],
	"Projects": ["Project", "Task", "Timesheet"],
	"Shift & Attendance": ["Employee", "Employee Checkin", "Attendance", "Shift Type", "Shift Assignment"],
	"Leaves": ["Leave Application", "Leave Allocation", "Holiday List"],
}

# Module Profile (one per bagian, named like its Role Profile) → the Module Defs it allows. It blocks every
# other Module Def of erpnext, hrms and erp_internal; Frappe's own modules are left alone. Each set is the
# modules of that bagian's IKON entries (`test_profil_modul_ikut_ikon`).
MODUL_BOLEH = {
	"Gudang": ("Stock",),
	"Penjualan": ("Stock", "Selling", "Accounts"),
	"Pembelian": ("Stock", "Buying", "Accounts"),
	"Produksi": ("Stock", "Manufacturing"),
	"HR": ("Shift and Attendance", "Leaves"),
	"Karyawan": ("Projects", "Shift and Attendance", "Leaves"),
	"Manajer Proyek": ("Projects",),
}

# Role Profile → standard ERPNext/HRMS roles: the fewest that let each bagian create its own documents and
# none of the others' (`test_izin_per_bagian`). Read from the v16 DocPerms: Stock Reconciliation needs
# Stock Manager, Item needs Item Manager, Supplier needs Purchase Master Manager, Item Lead Time needs
# Manufacturing Manager, Holiday List needs HR Manager.
PROFIL_PERAN = {
	"Gudang": ("Stock Manager", "Item Manager"),
	"Penjualan": ("Sales User", "Accounts User"),
	"Pembelian": ("Purchase User", "Purchase Master Manager", "Accounts User"),
	"Produksi": ("Manufacturing User", "Manufacturing Manager"),
	"HR": ("HR Manager", "HR User"),
	"Karyawan": ("Employee",),
	"Manajer Proyek": ("Projects User", "Projects Manager"),
}


def terapkan() -> None:
	"""Apply the tables above to the site. Idempotent."""
	_halaman_apps()
	_dok()
	_sidebar()
	_profil_peran()
	_profil_modul()


def peran_bagian(bagian: tuple[str, ...]) -> set[str]:
	"""The roles of those Role Profiles, as stored on the site."""
	return set(
		frappe.get_all(
			"Has Role", {"parenttype": "Role Profile", "parent": ("in", list(bagian))}, pluck="role"
		)
	)


def modul_aplikasi() -> list[str]:
	"""The Module Defs of erpnext, hrms and erp_internal."""
	return frappe.get_all(
		"Module Def", {"app_name": ("in", [*APLIKASI, "erp_internal"])}, pluck="name", order_by="name asc"
	)


def _halaman_apps() -> None:
	"""Keep /desk on the Apps screen; the Desktop Icon grid would bring back every hidden module."""
	from frappe.desk.doctype.desktop_settings.desktop_settings import APPS, get_desktop_page

	if get_desktop_page() != APPS:
		frappe.db.set_single_value("Desktop Settings", "desktop_page", APPS)
		frappe.clear_cache()


# ---------------------------------------------------------------------------------------------------------
# The dock


DOK_KOLOM = ("link_type", "link_to", "url", "title", "hidden", "added")


def _dok() -> None:
	from frappe.desk.doctype.dock.dock import SITE_LAYER, dock_rows, get_app_dock, get_dock

	for app in APLIKASI:
		dasar = get_app_dock(app)
		if not dasar:
			continue
		# A saved layer is the whole rail (an entry it does not name is dropped), so every entry is named.
		simpan = [k for k in IKON if any(_dok_ke(r) == k for r in dasar)]
		baris = [_baris_dok(next(r for r in dasar if _dok_ke(r) == k), 0) for k in simpan]
		baris += [_baris_dok(r, 1) for r in dasar if _dok_ke(r) not in simpan]

		lama = get_dock(app)
		if lama and _jejak_dok(dock_rows(lama)) == _jejak_dok(baris):
			continue
		doc = frappe.get_doc("Dock", lama.name) if lama else frappe.new_doc("Dock")
		if not lama:
			doc.update({"app": app, "user": SITE_LAYER, "standard": 0})
		doc.set("items", baris)
		doc.save(ignore_permissions=True)


def _dok_ke(row) -> str | None:
	"""The sidebar a dock entry opens, or None for a pin or a link out."""
	return row.get("link_to") if row.get("link_type") == "Sidebar" else None


def _baris_dok(row, hidden: int) -> dict:
	return {
		"link_type": row.get("link_type"),
		"link_to": row.get("link_to"),
		"url": row.get("url"),
		"title": None if hidden else LABEL.get(_dok_ke(row)),
		"icon": None,
		"added": 0,
		"hidden": hidden,
	}


def _jejak_dok(rows) -> list[tuple]:
	return [tuple(r.get(k) or None for k in DOK_KOLOM) for r in rows]


# ---------------------------------------------------------------------------------------------------------
# Sidebars


def _sidebar() -> None:
	from frappe.desk.doctype.custom_sidebar.custom_sidebar import _save_customization, get_customization
	from frappe.desk.doctype.sidebar.sidebar import module_of_shell

	for shell, link in SIDEBAR.items():
		modul = module_of_shell(shell)
		if not modul:
			continue
		baris = _baris_sidebar(shell, modul, link)
		label = LABEL.get(shell, "")
		lama = get_customization(modul, None)
		if (
			lama
			and _jejak_sidebar(lama.sidebar_items) == _jejak_sidebar(baris)
			and (lama.label or "") == label
		):
			continue
		# The same writer as the desk's "save for everyone": it anchors each reference to the base item.
		_save_customization(modul, baris, user=None, label=label)


def _baris_sidebar(shell: str, modul: str, link: list[str]) -> list[dict]:
	"""The site layer for one sidebar: home Workspace, the kept links, then every other base item hidden."""
	from frappe.desk.doctype.sidebar.sidebar import get_module_base, item_key

	dasar = [dict(r) for r in get_module_base(modul, shell).rows]
	beranda = next((r for r in dasar if r.get("type") == "Link" and r.get("link_type") == "Workspace"), None)
	per_link = {}
	for r in dasar:
		if r.get("type") == "Link" and r.get("link_to") and r.get("link_type") != "Workspace":
			per_link.setdefault(r["link_to"], r)

	baris, dipakai = [], set()
	for r in [beranda, *(per_link.get(t) or t for t in link)]:
		if r is None:
			continue
		if isinstance(r, str):
			baris.append(_tambahan(r))
			continue
		baris.append(_rujukan(r, 0))
		dipakai.add(item_key(r))
	for r in dasar:
		if item_key(r) not in dipakai:
			baris.append(_rujukan(r, 1))
			dipakai.add(item_key(r))
	return baris


def _rujukan(row: dict, hidden: int) -> dict:
	"""A reference to a base item: its identity, whether it shows, and flat (no section)."""
	from frappe.desk.doctype.sidebar.sidebar import LINKED_IDENTITY_FIELDS, is_linked, item_key

	if is_linked(row):
		return {**{f: row.get(f) for f in LINKED_IDENTITY_FIELDS}, "hidden": hidden, "child": 0}
	return {
		"type": row.get("type"),
		"label": row.get("label"),
		"key": item_key(row),
		"hidden": hidden,
		"child": 0,
	}


def _tambahan(link_to: str) -> dict:
	"""An item the app's sidebar lacks, added by the site layer."""
	return {
		"added": 1,
		"type": "Link",
		"label": link_to,
		"link_type": _jenis_link(link_to),
		"link_to": link_to,
		"hidden": 0,
		"child": 0,
	}


def _jenis_link(link_to: str) -> str:
	if frappe.db.exists("DocType", link_to):
		return "DocType"
	if frappe.db.exists("Report", link_to):
		return "Report"
	return "Page"


def _jejak_sidebar(rows) -> list[tuple]:
	from frappe.desk.doctype.sidebar.sidebar import item_key

	def jejak(r):
		added = int(r.get("added") or 0)
		return (
			item_key(r),
			int(r.get("hidden") or 0),
			added,
			int(r.get("child") or 0),
			r.get("label") if added else None,
			r.get("link_type") if added else None,
		)

	return [jejak(r) for r in rows]


# ---------------------------------------------------------------------------------------------------------
# Role and Module Profiles


def _profil_peran() -> None:
	for nama, peran in PROFIL_PERAN.items():
		if frappe.db.exists("Role Profile", nama):
			doc = frappe.get_doc("Role Profile", nama)
			if {r.role for r in doc.roles} == set(peran):
				continue
		else:
			doc = frappe.new_doc("Role Profile")
			doc.role_profile = nama
		doc.set("roles", [{"role": r} for r in peran])
		doc.save(ignore_permissions=True)


def _profil_modul() -> None:
	semua = set(modul_aplikasi())
	for nama, boleh in MODUL_BOLEH.items():
		blok = sorted(semua - set(boleh))
		if frappe.db.exists("Module Profile", nama):
			doc = frappe.get_doc("Module Profile", nama)
			if sorted(b.module for b in doc.block_modules) == blok:
				continue
		else:
			doc = frappe.new_doc("Module Profile")
			doc.module_profile_name = nama
		doc.set("block_modules", [{"module": m} for m in blok])
		doc.save(ignore_permissions=True)
