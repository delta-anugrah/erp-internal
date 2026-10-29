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

# Three Role Profiles (Samuel, 2026-10-28): User does the daily work, Admin also runs the business (manager
# rights, users, business settings), Developer also has System Manager (Build, System Settings).
DEVELOPER, ADMIN, USER = "Developer", "Admin", "User"
PERAN_ADMIN = "ERP Admin"  # our role: user management (setup.IZIN_TAMBAHAN), checked by pengguna.py

# Dock entry (the module's sidebar name) → the profiles that see it. System Manager sees every kept one.
# Order is the rail's order. Every other entry of the APLIKASI docks is hidden for everyone. Kept short (Samuel,
# 2026-10-28): invoices and payments live in Selling and Buying, leave in HR, so Accounts and Leaves have no
# icon of their own.
IKON = {
	"Stock": (ADMIN, USER),
	"Selling": (ADMIN, USER),
	"Buying": (ADMIN, USER),
	"Manufacturing": (ADMIN, USER),
	"Projects": (ADMIN, USER),
	"Shift & Attendance": (ADMIN, USER),
	"Setup": (ADMIN,),
}

# A kept module shown under another name, on its rail button and its sidebar header.
LABEL = {"Accounts": "Invoicing", "Setup": "Settings", "Shift & Attendance": "HR"}

# Sidebar → the `link_to` values kept, in this order, after the module's home Workspace (always first,
# so the module opens on it). A link the app's sidebar lacks is added; every other item is hidden. Only what the
# guides' flows use (docs/panduan/): each module home shows the same links as shortcuts (`PINTASAN`,
# `test_rumah_sama_dengan_sidebar`). Sales History, Order Readiness, Plan vs Actual, Machine Capacity and
# Production Entry (module Planning, ours) sit in Selling and Manufacturing, Reject Reason in Setup: Planning has no
# rail entry and stays blocked in every Module Profile. Accounts and Leaves keep a short sidebar for a page
# Frappe opens in its own module (no rail icon). Setup (shown as Settings) holds users, opening stock (Stock
# Reconciliation, Admin only), the business settings and the reject reasons; System Settings and Build stay
# with System Manager.
SIDEBAR = {
	"Stock": ["Item", "Stock Entry", "Warehouse", "Stock Balance", "Stock Ledger"],
	"Selling": [
		"Customer",
		"Sales Order",
		"Delivery Note",
		"Sales Invoice",
		"Payment Entry",
		"Sales History",
	],
	"Buying": ["Supplier", "Material Request", "Purchase Order", "Purchase Receipt", "Purchase Invoice"],
	"Manufacturing": [
		"production-floor",
		"Sales History",
		"Sales Forecast",
		"Master Production Schedule",
		"Material Requirements Planning Report",
		"Work Order",
		"Production Entry",
		"Order Readiness",
		"Plan vs Actual",
		"BOM",
		"Machine Capacity",
		"Item Lead Time",
	],
	"Accounts": ["Sales Invoice", "Purchase Invoice", "Payment Entry"],
	"Projects": ["Project", "Task", "Timesheet"],
	"Shift & Attendance": [
		"Employee",
		"Employee Checkin",
		"Attendance",
		"Leave Application",
		"Shift Type",
		"Shift Assignment",
		"Holiday List",  # Admin only from here: last, so a User's home has no gap
		"Leave Allocation",
	],
	"Leaves": ["Leave Application", "Leave Allocation", "Holiday List"],
	"Setup": [
		"User",
		"Company",
		"Stock Reconciliation",
		"Stock Settings",
		"Selling Settings",
		"Buying Settings",
		"Manufacturing Settings",
		"Reject Reason",
		"Accounts Settings",
		"Projects Settings",
		"HR Settings",
	],
}

# A SIDEBAR link whose label is not its name (a Page is named by its route).
NAMA_LINK = {"production-floor": "Production Floor"}

# A SIDEBAR link → its icon (Frappe's lucide set, `/assets/frappe/icons/lucide/icons.svg`), set on every sidebar
# that shows it. Our own links and the ERPNext ones whose sidebar row has none, so no link shows the plain list
# icon (Abel, 2026-10-29). A link whose base icon already fits (Work Order's factory, BOM's tree) is left out.
IKON_LINK = {
	"production-floor": "gauge",
	"Sales History": "history",
	"Sales Forecast": "trending-up",
	"Master Production Schedule": "calendar-range",
	"Material Requirements Planning Report": "calculator",
	"Production Entry": "notebook-pen",
	"Order Readiness": "calendar-clock",
	"Plan vs Actual": "target",
	"Machine Capacity": "cog",
	"Item Lead Time": "hourglass",
	"Item": "package",
	"Stock Balance": "boxes",
	"Stock Ledger": "book-open",
	"Payment Entry": "banknote",
	"Employee": "id-card",
	"Attendance": "user-check",
	"Leave Application": "clipboard-pen",
	"Leave Allocation": "clipboard-check",
	"Shift Type": "sun-moon",
	"Shift Assignment": "calendar-days",
	"Holiday List": "calendar-x",
	"Timesheet": "clock",
	"Reject Reason": "ban",
	"Stock Reconciliation": "scale",
	"Stock Settings": "settings",
	"Selling Settings": "settings",
	"Buying Settings": "settings",
	"Manufacturing Settings": "settings",
	"Accounts Settings": "settings",
	"Projects Settings": "settings",
	"HR Settings": "settings",
}

# Module Profile (named like its Role Profile) → the Module Defs it allows. It blocks every other Module Def of
# erpnext, hrms and erp_internal; Frappe's own modules are left alone. Each set is the modules of that profile's
# IKON entries plus MODUL_TANPA_IKON (`test_profil_modul_ikut_ikon`). Developer has no Module Profile: it sees
# everything.
MODUL_TANPA_IKON = ("Accounts", "Leaves")  # their documents show in other sidebars; allowed, no rail icon
_MODUL_KERJA = (
	"Stock",
	"Selling",
	"Buying",
	"Manufacturing",
	"Projects",
	"Shift and Attendance",
	*MODUL_TANPA_IKON,
)
MODUL_BOLEH = {ADMIN: (*_MODUL_KERJA, "Setup"), USER: _MODUL_KERJA}

# Role Profile → standard ERPNext/HRMS roles. Read from the v16 DocPerms (`test_izin_per_profil`):
# - User: the *User roles, which create and submit the daily documents, and Employee for their own check-ins,
#   leave and timesheets (ERPNext drops Employee from a user without an Employee record). Items, suppliers,
#   stock reconciliations, BOMs and settings need a manager role, so they stay with Admin.
# - Admin: every manager role of the used modules plus the User roles (Stock Manager alone reads neither Company
#   nor Stock Balance), and PERAN_ADMIN for users. No Employee: HR Manager covers attendance.
# - Developer: Admin plus System Manager.
_PERAN_USER = (
	"Stock User",
	"Sales User",
	"Purchase User",
	"Manufacturing User",
	"Accounts User",
	"Projects User",
)
_PERAN_ADMIN = (
	PERAN_ADMIN,
	*_PERAN_USER,
	"Stock Manager",
	"Item Manager",
	"Sales Manager",
	"Sales Master Manager",
	"Purchase Manager",
	"Purchase Master Manager",
	"Manufacturing Manager",
	"Accounts Manager",
	"Projects Manager",
	"HR Manager",
	"HR User",
)
PROFIL_PERAN = {
	DEVELOPER: ("System Manager", *_PERAN_ADMIN),
	ADMIN: _PERAN_ADMIN,
	USER: (*_PERAN_USER, "Employee"),
}
# The roles an Admin may hand out (`pengguna.cek_user`): those of the Admin and User profiles, and the approver
# roles HRMS adds itself when HR names someone a department's leave or expense approver.
PERAN_BOLEH_ADMIN = frozenset(
	(*PROFIL_PERAN[ADMIN], *PROFIL_PERAN[USER], "Leave Approver", "Expense Approver")
)


def _p(link_to: str, label: str | None = None, jenis: str = "DocType", **lain) -> dict:
	"""One shortcut: a DocType list (or `doc_view`), or a Report."""
	p = {"label": label or link_to, "type": jenis, "link_to": link_to, **lain}
	if jenis == "DocType":
		p.setdefault("doc_view", "List")
	return p


# Module home Workspace → its shortcuts, in order: the page's only content (no number cards, link cards,
# charts or onboarding: `BLOK_TETAP` is empty). Each home's targets are its sidebar's links (`SIDEBAR`).
# `stats_filter` is a JS expression the desk evaluates (so `frappe.session.user` works); with `format` the
# shortcut shows a count. A shortcut whose target does not exist on the site is left out (`pintasan_aktif`).
PINTASAN = {
	"Stock": (
		_p("Item"),
		_p("Stock Entry"),
		_p("Warehouse"),
		_p("Stock Balance", jenis="Report"),
		_p("Stock Ledger", jenis="Report"),
	),
	"Selling": (
		_p("Customer"),
		_p(
			"Sales Order",
			"Open Sales Orders",
			stats_filter='[["Sales Order","docstatus","=",1],["Sales Order","status","in",'
			'["To Deliver and Bill","To Bill","To Deliver","To Pay","On Hold"]]]',
			format="{} Open",
			color="Blue",
		),
		_p("Delivery Note"),
		_p(
			"Sales Invoice",
			"Unpaid Sales Invoices",
			stats_filter='[["Sales Invoice","docstatus","=",1],["Sales Invoice","outstanding_amount",">",0]]',
			format="{} Unpaid",
			color="Orange",
		),
		_p("Payment Entry"),
		_p("Sales History"),
	),
	"Buying": (
		_p("Supplier"),
		_p(
			"Material Request",
			"Pending Material Requests",
			stats_filter='[["Material Request","docstatus","=",1],["Material Request","status","in",'
			'["Pending","Partially Ordered"]]]',
			format="{} Pending",
			color="Orange",
		),
		_p("Purchase Order"),
		_p("Purchase Receipt"),
		_p("Purchase Invoice"),
	),
	"Manufacturing": (
		_p("production-floor", "Production Floor", "Page"),
		_p("Sales History"),
		_p("Sales Forecast"),
		_p("Master Production Schedule"),
		_p("Material Requirements Planning Report", "MRP", "Report"),
		_p(
			"Work Order",
			"Work Orders in Process",
			stats_filter='[["Work Order","status","=","In Process"]]',
			format="{} In Process",
			color="Blue",
		),
		_p("Production Entry"),
		_p("Order Readiness", jenis="Report"),
		_p("Plan vs Actual", jenis="Report"),
		_p("BOM"),
		_p("Machine Capacity"),
		_p("Item Lead Time"),
	),
	"Accounting": (_p("Sales Invoice"), _p("Purchase Invoice"), _p("Payment Entry")),
	"Projects": (
		_p(
			"Project",
			"Open Projects",
			stats_filter='[["Project","status","=","Open"]]',
			format="{} Open",
			color="Blue",
		),
		_p(
			"Task",
			"My Open Tasks",
			stats_filter='[["Task","status","=","Open"],["Task","_assign","like","%" + frappe.session.user + "%"]]',
			format="{} Open",
			color="Orange",
		),
		_p("Timesheet", "New Timesheet", doc_view="New"),
	),
	"HR": (
		_p("Employee"),
		_p("Employee Checkin"),
		_p(
			"Attendance",
			"Today's Attendance",
			stats_filter='[["Attendance","docstatus","=",1],'
			'["Attendance","attendance_date","=",frappe.datetime.get_today()]]',
			format="{} Today",
			color="Green",
		),
		_p("Leave Application", "New Leave Application", doc_view="New"),
		_p("Shift Type"),
		_p("Shift Assignment"),
		_p("Holiday List"),
		_p("Leave Allocation"),
	),
	"Leaves": (
		_p("Leave Application", "New Leave Application", doc_view="New"),
		_p("Leave Allocation"),
		_p("Holiday List"),
	),
	"Home": (
		_p("User", "Users"),
		_p("Company"),
		_p("Stock Reconciliation", "Opening Stock & Stock Count"),
		_p("Stock Settings", doc_view=""),
		_p("Selling Settings", doc_view=""),
		_p("Buying Settings", doc_view=""),
		_p("Manufacturing Settings", doc_view=""),
		_p("Reject Reason"),
		_p("Accounts Settings", doc_view=""),
		_p("Projects Settings", doc_view=""),
		_p("HR Settings", doc_view=""),
	),
}
# Sidebar → our own Workspace that replaces its home. A standard Workspace keeps its app-owned title (the page
# title, breadcrumb and browser tab) and Custom Workspace cannot change it, so "Shift & Attendance" gets a
# site Workspace named and titled "HR" (id: SDM), with PINTASAN["HR"] (`_rumah_sendiri`). The base home stays
# in place (its route still opens), hidden from the sidebar.
RUMAH_SENDIRI = {"Shift & Attendance": "HR"}
BLOK_TETAP = ()  # base Workspace blocks kept below the shortcuts: none (Samuel, 2026-10-28: homes kept short)
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
	_rumah_sendiri()
	_sidebar()
	_profil_peran()
	_profil_modul()
	_pintasan()
	_sembunyi()


def saring_aplikasi(bootinfo) -> None:
	"""extend_bootinfo: take an app off this user's Apps screen when nothing of it is on their rail.

	ERPNext puts its tile on every desk user's Apps screen, so a user with no ERPNext module saw "ERPNext"
	and clicking it opened /desk/home, a module their Module Profile blocks ("No permission for Page"). Only
	the tile is hidden;
	the app's data and DocPerms are untouched. Boot must never fail, so any surprise leaves it as it was."""
	try:
		sidebars = bootinfo.get("module_sidebars") or {}
		dock = bootinfo.get("dock") or {}
		for app in bootinfo.get("app_data") or []:
			if not app.get("on_apps_screen"):
				continue
			entri = dock.get(app.get("app_name")) or app.get("dock") or []
			if not any(
				not e.get("hidden") and e.get("link_type") == "Sidebar" and e.get("link_to") in sidebars
				for e in entri
			):
				app["on_apps_screen"] = False
	except Exception:
		frappe.log_error("erp_internal: saring_aplikasi")


# App → the name and icon its Apps screen tile and its rail's top slot show (Abel, 2026-10-28). Each icon is a
# Delta-blue rounded square with a white Lucide glyph (`public/images/aplikasi-*.svg`). Frappe's tile ("System")
# shows for Developer only. The Delta Anugrah logo itself stays on the navbar, login, splash and favicon.
NAMA_APLIKASI = {"erpnext": "ERP", "hrms": "HR", "frappe": "System"}
IKON_APLIKASI = {
	"erpnext": "/assets/erp_internal/images/aplikasi-erp.svg",  # Lucide factory
	"hrms": "/assets/erp_internal/images/aplikasi-hr.svg",  # Lucide users
	"frappe": "/assets/erp_internal/images/aplikasi-sistem.svg",  # Lucide settings
}


def merek_aplikasi(bootinfo) -> None:
	"""extend_bootinfo: NAMA_APLIKASI and IKON_APLIKASI on each app's tile and rail top slot (`app_data`).

	Only the boot copy changes; the apps' hooks stay theirs. Boot must never fail."""
	try:
		for app in bootinfo.get("app_data") or []:
			nama = app.get("app_name")
			if nama in NAMA_APLIKASI:
				app["app_title"] = NAMA_APLIKASI[nama]
				app["app_logo_url"] = IKON_APLIKASI[nama]
	except Exception:
		frappe.log_error("erp_internal: merek_aplikasi")


def pastikan_peran() -> None:
	"""The PERAN_ADMIN role, with desk access. Safe before the setup wizard (Role Profiles link to it)."""
	if not frappe.db.exists("Role", PERAN_ADMIN):
		frappe.get_doc({"doctype": "Role", "role_name": PERAN_ADMIN, "desk_access": 1}).insert(
			ignore_permissions=True
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
		# A Dashboard shares its name with a DocType (Project, Attendance): SIDEBAR names the DocType or Report.
		if (
			r.get("type") == "Link"
			and r.get("link_to")
			and r.get("link_type") not in ("Workspace", "Dashboard")
		):
			per_link.setdefault(r["link_to"], r)

	baris, dipakai = [], set()
	if shell in RUMAH_SENDIRI:
		ws = RUMAH_SENDIRI[shell]
		baris.append({**_tambahan(ws), "label": "Home", "link_type": "Workspace", "icon": "home"})
		if beranda:
			baris.append(_rujukan(beranda, 1))
			dipakai.add(item_key(beranda))
		beranda = None
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
	# The icon as an override, only where it differs from the base row's (Frappe stores no override equal to it).
	ikon_dasar = {r.get("link_to"): r.get("icon") for r in dasar if r.get("link_to")}
	for r in baris:
		ikon = IKON_LINK.get(r.get("link_to"))
		if not r["hidden"] and ikon and ikon != ikon_dasar.get(r["link_to"]):
			r["icon"] = ikon
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
		"label": NAMA_LINK.get(link_to, link_to),
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
			r.get("icon") or None,
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
		if ws in RUMAH_SENDIRI.values() or not frappe.db.exists("Workspace", ws):
			continue  # our own Workspace is written whole by _rumah_sendiri
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


def _rumah_sendiri() -> None:
	"""Our own module home per RUMAH_SENDIRI: a public site Workspace in the module, PINTASAN as its content."""
	import json

	from frappe.desk.doctype.sidebar.sidebar import module_of_shell

	for shell, ws in RUMAH_SENDIRI.items():
		modul = module_of_shell(shell)
		if not modul:
			continue
		aktif = pintasan_aktif(ws)
		konten = [
			{
				"id": _id_blok(ws, p["label"]),
				"type": "shortcut",
				"data": {"shortcut_name": p["label"], "col": 3},
			}
			for p in aktif
		]
		baris = [{k: p[k] for k in KOLOM_PINTASAN if p.get(k)} for p in aktif]
		nilai = {"title": ws, "label": ws, "module": modul, "public": 1, "is_hidden": 0, "type": "Workspace"}
		nilai["icon"] = frappe.db.get_value("Workspace", shell, "icon") or "users"

		if frappe.db.exists("Workspace", ws):
			doc = frappe.get_doc("Workspace", ws)
			lama = [{k: s.get(k) for k in KOLOM_PINTASAN if s.get(k)} for s in doc.shortcuts]
			if (
				all(doc.get(k) == v for k, v in nilai.items())
				and json.loads(doc.content or "[]") == konten
				and lama == baris
			):
				continue
		else:
			doc = frappe.new_doc("Workspace")
		doc.update(nilai)
		doc.content = json.dumps(konten)
		doc.set("shortcuts", baris)
		doc.flags.ignore_links = True
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
