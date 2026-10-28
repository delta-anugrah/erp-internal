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
# Sales History and Order Readiness (module Planning, ours) sit in Selling and Manufacturing: Planning has no
# rail entry of its own and stays blocked in every Module Profile, and Penjualan has no Manufacturing.
SIDEBAR = {
	"Stock": ["Item", "Warehouse", "Stock Entry", "Stock Reconciliation", "Stock Balance", "Stock Ledger"],
	"Selling": [
		"Customer",
		"Sales Order",
		"Delivery Note",
		"Sales Invoice",
		"Sales Order Analysis",
		"Sales History",
		"Order Readiness",
	],
	"Buying": ["Supplier", "Material Request", "Purchase Order", "Purchase Receipt", "Purchase Invoice"],
	"Manufacturing": [
		"Order Readiness",
		"Sales Forecast",
		"Master Production Schedule",
		"Material Requirements Planning Report",
		"Work Order",
		"BOM",
		"Item Lead Time",
		"Sales History",
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
# Manufacturing Manager, Holiday List needs HR Manager. Gudang also needs Stock User: it is the stock role
# that reads Company (every stock form reads its defaults) and the Stock Balance and Stock Ledger reports.
PROFIL_PERAN = {
	"Gudang": ("Stock Manager", "Stock User", "Item Manager"),
	"Penjualan": ("Sales User", "Accounts User"),
	"Pembelian": ("Purchase User", "Purchase Master Manager", "Accounts User"),
	"Produksi": ("Manufacturing User", "Manufacturing Manager"),
	"HR": ("HR Manager", "HR User"),
	"Karyawan": ("Employee",),
	"Manajer Proyek": ("Projects User", "Projects Manager"),
}


# Module home Workspace → its shortcuts, in order. They replace the page's charts and onboarding; its number
# cards and link cards stay. `stats_filter` is a JS expression the desk evaluates (so `frappe.session.user`
# works); with `format` the shortcut shows a count. A shortcut whose target does not exist yet (Order
# Readiness, Task 13) is left out until it does (`pintasan_aktif`).
PINTASAN = {
	"Stock": (
		{"label": "New Stock Entry", "type": "DocType", "link_to": "Stock Entry", "doc_view": "New"},
		{
			"label": "Stock Reconciliation",
			"type": "DocType",
			"link_to": "Stock Reconciliation",
			"doc_view": "List",
		},
		{"label": "Stock Balance", "type": "Report", "link_to": "Stock Balance"},
		{"label": "Item", "type": "DocType", "link_to": "Item", "doc_view": "List"},
	),
	"Selling": (
		{"label": "New Sales Order", "type": "DocType", "link_to": "Sales Order", "doc_view": "New"},
		{
			"label": "Open Sales Orders",
			"type": "DocType",
			"link_to": "Sales Order",
			"doc_view": "List",
			"stats_filter": '[["Sales Order","docstatus","=",1],["Sales Order","status","in",'
			'["To Deliver and Bill","To Bill","To Deliver","To Pay","On Hold"]]]',
			"format": "{} Open",
			"color": "Blue",
		},
		{"label": "Delivery Note", "type": "DocType", "link_to": "Delivery Note", "doc_view": "List"},
		{
			"label": "Unpaid Sales Invoices",
			"type": "DocType",
			"link_to": "Sales Invoice",
			"doc_view": "List",
			"stats_filter": '[["Sales Invoice","docstatus","=",1],["Sales Invoice","outstanding_amount",">",0]]',
			"format": "{} Unpaid",
			"color": "Orange",
		},
		{"label": "Order Readiness", "type": "Report", "link_to": "Order Readiness"},
	),
	"Buying": (
		{
			"label": "Pending Material Requests",
			"type": "DocType",
			"link_to": "Material Request",
			"doc_view": "List",
			"stats_filter": '[["Material Request","docstatus","=",1],["Material Request","status","in",'
			'["Pending","Partially Ordered"]]]',
			"format": "{} Pending",
			"color": "Orange",
		},
		{"label": "New Purchase Order", "type": "DocType", "link_to": "Purchase Order", "doc_view": "New"},
		{"label": "Purchase Receipt", "type": "DocType", "link_to": "Purchase Receipt", "doc_view": "List"},
		{"label": "Purchase Invoice", "type": "DocType", "link_to": "Purchase Invoice", "doc_view": "List"},
	),
	"Manufacturing": (
		{"label": "Order Readiness", "type": "Report", "link_to": "Order Readiness"},
		{"label": "Sales Forecast", "type": "DocType", "link_to": "Sales Forecast", "doc_view": "List"},
		{
			"label": "Master Production Schedule",
			"type": "DocType",
			"link_to": "Master Production Schedule",
			"doc_view": "List",
		},
		{"label": "MRP", "type": "Report", "link_to": "Material Requirements Planning Report"},
		{
			"label": "Work Orders in Process",
			"type": "DocType",
			"link_to": "Work Order",
			"doc_view": "List",
			"stats_filter": '[["Work Order","status","=","In Process"]]',
			"format": "{} In Process",
			"color": "Blue",
		},
		{"label": "Item Lead Time", "type": "DocType", "link_to": "Item Lead Time", "doc_view": "List"},
	),
	"Projects": (
		{
			"label": "Open Projects",
			"type": "DocType",
			"link_to": "Project",
			"doc_view": "List",
			"stats_filter": '[["Project","status","=","Open"]]',
			"format": "{} Open",
			"color": "Blue",
		},
		{
			"label": "My Open Tasks",
			"type": "DocType",
			"link_to": "Task",
			"doc_view": "List",
			"stats_filter": '[["Task","status","=","Open"],["Task","_assign","like","%" + frappe.session.user + "%"]]',
			"format": "{} Open",
			"color": "Orange",
		},
		{"label": "New Timesheet", "type": "DocType", "link_to": "Timesheet", "doc_view": "New"},
	),
	"Shift & Attendance": (
		{
			"label": "Today's Attendance",
			"type": "DocType",
			"link_to": "Attendance",
			"doc_view": "List",
			"stats_filter": '[["Attendance","docstatus","=",1],'
			'["Attendance","attendance_date","=",frappe.datetime.get_today()]]',
			"format": "{} Today",
			"color": "Green",
		},
		{"label": "Employee Checkin", "type": "DocType", "link_to": "Employee Checkin", "doc_view": "List"},
		{"label": "Employee", "type": "DocType", "link_to": "Employee", "doc_view": "List"},
	),
	"Leaves": (
		{
			"label": "New Leave Application",
			"type": "DocType",
			"link_to": "Leave Application",
			"doc_view": "New",
		},
		{
			"label": "Leave Applications to Approve",
			"type": "DocType",
			"link_to": "Leave Application",
			"doc_view": "List",
			"stats_filter": '[["Leave Application","docstatus","=",0],["Leave Application","status","=","Open"]]',
			"format": "{} To Approve",
			"color": "Orange",
		},
	),
}
BLOK_TETAP = ("number_card", "card")  # base Workspace blocks kept below the shortcuts
KOLOM_PINTASAN = ("type", "link_to", "doc_view", "label", "stats_filter", "format", "color")

# DocType → fields and sections of features not in use, hidden by Property Setter: accounting dimensions
# (cost center, project on factory documents), website, loyalty, sales team and commission, coupons,
# inter-company, auto repeat, quality inspection, assets, deferred accounting, shipping rule, and payroll on
# Employee. Each was read from the v16 JSON: it exists and is not required (`test_sembunyi_aman`).
SEMBUNYI = {
	"Item": (
		"is_fixed_asset",
		"asset_category",
		"asset_naming_series",
		"auto_create_assets",
		"is_grouped_asset",
		"deferred_accounting_section",
		"enable_deferred_revenue",
		"enable_deferred_expense",
		"inspection_required_before_purchase",
		"inspection_required_before_delivery",
		"quality_inspection_template",
		"grant_commission",
	),
	"Customer": (
		"website",
		"loyalty_program",
		"loyalty_program_tier",
		"loyalty_points_tab",
		"default_sales_partner",
		"default_commission_rate",
		"sales_team_tab",
		"sales_team_section",
		"sales_team",
	),
	"Supplier": ("website",),
	"Sales Order": (
		"accounting_dimensions_section",
		"cost_center",
		"project",
		"shipping_rule",
		"coupon_code",
		"inter_company_order_reference",
		"sales_team_section_break",
		"sales_partner",
		"commission_rate",
		"total_commission",
		"amount_eligible_for_commission",
		"section_break1",
		"sales_team",
		"auto_repeat_section",
		"auto_repeat",
	),
	"Delivery Note": (
		"accounting_dimensions_section",
		"cost_center",
		"project",
		"shipping_rule",
		"inter_company_reference",
		"sales_team_section_break",
		"sales_partner",
		"commission_rate",
		"total_commission",
		"amount_eligible_for_commission",
		"section_break1",
		"sales_team",
		"auto_repeat_section",
		"auto_repeat",
	),
	"Sales Invoice": (
		"accounting_dimensions_section",
		"cost_center",
		"project",
		"shipping_rule",
		"loyalty_points_redemption",
		"redeem_loyalty_points",
		"loyalty_program",
		"coupon_code",
		"inter_company_invoice_reference",
		"sales_team_section",
		"commission_section",
		"sales_partner",
		"commission_rate",
		"total_commission",
		"amount_eligible_for_commission",
		"sales_team",
		"subscription_section",
		"auto_repeat",
	),
	"Purchase Order": (
		"accounting_dimensions_section",
		"cost_center",
		"project",
		"shipping_rule",
		"inter_company_order_reference",
		"auto_repeat_section",
		"auto_repeat",
	),
	"Purchase Receipt": (
		"accounting_dimensions_section",
		"cost_center",
		"project",
		"shipping_rule",
		"inter_company_reference",
		"subscription_detail",
		"auto_repeat",
	),
	"Work Order": ("project", "update_consumed_material_cost_in_project"),
	"Employee": ("salary_information", "salary_mode", "salary_currency", "ctc"),
}


def terapkan() -> None:
	"""Apply the tables above to the site. Idempotent."""
	_halaman_apps()
	_dok()
	_sidebar()
	_profil_peran()
	_profil_modul()
	_pintasan()
	_sembunyi()


def peran_bagian(bagian: tuple[str, ...]) -> set[str]:
	"""The roles of those Role Profiles, as stored on the site."""
	return set(
		frappe.get_all(
			"Has Role", {"parenttype": "Role Profile", "parent": ("in", list(bagian))}, pluck="role"
		)
	)


def pintasan_aktif(workspace: str) -> list[dict]:
	"""The PINTASAN shortcuts of one Workspace whose target exists on this site."""
	return [p for p in PINTASAN.get(workspace, ()) if frappe.db.exists(p["type"], p["link_to"])]


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


# ---------------------------------------------------------------------------------------------------------
# Module home pages and shorter forms


def _pintasan() -> None:
	"""A `Custom Workspace` per module home: PINTASAN's shortcuts, then the page's number and link cards.

	A standard Workspace's content refuses edits outside developer mode; the customization is the site's
	snapshot of the layout plus the shortcut rows it adds. It is rebuilt from the live base each migrate."""
	import json

	for ws in PINTASAN:
		if not frappe.db.exists("Workspace", ws):
			continue
		aktif = pintasan_aktif(ws)
		dasar = json.loads(frappe.db.get_value("Workspace", ws, "content") or "[]")
		konten = [
			{
				"id": _id_blok(ws, p["label"]),
				"type": "shortcut",
				"data": {"shortcut_name": p["label"], "col": 3},
			}
			for p in aktif
		]
		konten += [b for b in dasar if b.get("type") in BLOK_TETAP]
		widget = {"shortcut": [{k: p[k] for k in KOLOM_PINTASAN if p.get(k)} for p in aktif]} if aktif else {}

		if frappe.db.exists("Custom Workspace", ws):
			doc = frappe.get_doc("Custom Workspace", ws)
			if json.loads(doc.content or "[]") == konten and json.loads(doc.widgets or "{}") == widget:
				continue
		else:
			doc = frappe.new_doc("Custom Workspace")
			doc.workspace = ws
		doc.content = json.dumps(konten)
		doc.widgets = json.dumps(widget)
		doc.save(ignore_permissions=True)


def _id_blok(workspace: str, label: str) -> str:
	"""A stable block id, so a rebuild with the same shortcuts writes nothing."""
	import hashlib

	return "erp" + hashlib.sha1(f"{workspace}|{label}".encode()).hexdigest()[:7]


def _sembunyi() -> None:
	from frappe.custom.doctype.property_setter.property_setter import make_property_setter

	for dt, fields in SEMBUNYI.items():
		meta = frappe.get_meta(dt)
		for f in fields:
			if not meta.has_field(f):
				continue  # an app update dropped it; `test_sembunyi_aman` names it
			nilai = frappe.db.get_value(
				"Property Setter", {"doc_type": dt, "field_name": f, "property": "hidden"}, "value"
			)
			if str(nilai) != "1":
				make_property_setter(dt, f, "hidden", 1, "Check", validate_fields_for_doctype=False)
