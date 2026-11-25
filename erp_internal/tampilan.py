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

# Three Role Profiles (Samuel, 2026-10-28; renamed 2026-11-23): Produksi does the daily work, Admin also runs the
# business (manager rights, users, business settings), Super Admin also has System Manager (Build, System Settings).
SUPER_ADMIN, ADMIN, PRODUKSI = "Super Admin", "Admin", "Produksi"
# The profiles' names before 2026-11-23 (`patches/profil_tiga.py` renames them, users included).
NAMA_LAMA = {"Developer": SUPER_ADMIN, "User": PRODUKSI}
PERAN_ADMIN = "ERP Admin"  # our role: user management (setup.IZIN_TAMBAHAN), checked by pengguna.py
# Our role, the Produksi profile's only one: Production Entry, the machine status, and the reads production needs
# (setup.IZIN_TAMBAHAN).
PERAN_USER = "ERP User"

# Dock entry (the module's sidebar name) → the profiles that see it. System Manager sees every kept one.
# Order is the rail's order. Every other entry of the APLIKASI docks is hidden for everyone. Kept short (Samuel,
# 2026-10-28): invoices and payments live in Selling and Buying, leave in HR, so Accounts and Leaves have no
# icon of their own. Produksi keeps Manufacturing only (Samuel, 2026-11-23: it records production, nothing else).
IKON = {
	"Stock": (ADMIN,),
	"Selling": (ADMIN,),
	"Buying": (ADMIN,),
	"Manufacturing": (ADMIN, PRODUKSI),
	"Projects": (ADMIN,),
	"Shift & Attendance": (ADMIN,),
	"Setup": (ADMIN,),
}

# A kept module shown under another name, on its rail button and its sidebar header.
LABEL = {"Accounts": "Invoicing", "Setup": "Settings", "Shift & Attendance": "HR"}

# Dock entry → its icon as a header of the one labelled sidebar (Abel, 2026-11-03: nobody knew what the bare rail
# icons meant, so every module is a named, collapsible header with its links under it). Keys are IKON's.
IKON_MODUL = {
	"Stock": "warehouse",
	"Selling": "receipt",
	"Buying": "shopping-cart",
	"Manufacturing": "factory",
	"Projects": "folder-kanban",
	"Shift & Attendance": "users",
	"Setup": "settings",
}
IKON_RUMAH = "house"  # each module's home row
# Sidebar links shown as menu entries of their own, above the module headers, instead of under their module
# (Abel, 2026-11-03: the Production Floor is a place, not a Manufacturing document; Daily Input, Samuel's sheet,
# 2026-11-23, is the screen Produksi uses every day). They stay in SIDEBAR, so their
# module's home and route (`/desk/manufacturing/production-floor`) are unchanged.
MENU_ATAS = ("production-floor", "daily-input")

# Sidebar → the `link_to` values kept, in this order, after the module's home Workspace (always first,
# so the module opens on it). A link the app's sidebar lacks is added; every other item is hidden. Only what the
# guides' flows use (docs/panduan/): each module home shows the same links as shortcuts (`PINTASAN`,
# `test_rumah_sama_dengan_sidebar`). Sales History, Order Readiness, Plan vs Actual and Machine Capacity
# (module Planning, ours) sit in Selling and Manufacturing, Reject Reason in Setup: Planning has no
# rail entry and stays blocked in every Module Profile. Accounts and Leaves keep a short sidebar for a page
# Frappe opens in its own module (no rail icon). Setup (shown as Settings) holds users, opening stock (Stock
# Reconciliation, Admin only), the business settings and the reject reasons; System Settings and Build stay
# with System Manager.
SIDEBAR = {
	"Stock": [
		"Stock Entry",
		"Delivery Note",
		"Item",
		"Brand",  # Seal Cap brand codes with their mould inserts (Admin keeps the count)
		"Warehouse",
		"Stock Balance",
		"Stock Ledger",
		"Missing Documents",  # Admin and Super Admin only (the report's roles): last, so no gap
	],
	"Selling": [
		"Customer",
		"Sales Order",
		"Delivery Note",
		"Sales Invoice",
		"Payment Entry",
		"Sales History",
	],
	"Buying": [
		"Supplier",
		"Material Request",
		"Purchase Order",
		"Purchase Receipt",
		"Purchase Invoice",
		"Expense Entry",  # Admin and Super Admin only (Planning, ours)
		"Monthly Expenses",
	],
	"Manufacturing": [
		"production-floor",
		"Work Order",
		"daily-input",  # in place of the Production Entry list, which stays reachable by URL
		"Plan vs Actual",
		"Machine Capacity",
		"Sales History",  # Admin only from here: last, so a Produksi user's home has no gap
		"Master Production Schedule",
		"Material Requirements Planning Report",
		"Order Readiness",
		"BOM",
		"Sales Forecast",
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
		"Holiday List",  # Admin only from here: last, so a Produksi user's home has no gap
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
		"Missing Data",  # Admin and Super Admin only (the report's roles): last
	],
}

# A SIDEBAR link whose label is not its name (a Page is named by its route).
NAMA_LINK = {"production-floor": "Production Floor", "daily-input": "Daily Input"}

# A SIDEBAR link → its icon (Frappe's lucide set, `/assets/frappe/icons/lucide/icons.svg`), set on every sidebar
# that shows it. Our own links and the ERPNext ones whose sidebar row has none, so no link shows the plain list
# icon (Abel, 2026-10-29). A link whose base icon already fits (BOM's tree) is left out; none repeats its module's `IKON_MODUL` icon.
IKON_LINK = {
	"production-floor": "gauge",
	"Sales History": "history",
	"Sales Forecast": "trending-up",
	"Master Production Schedule": "calendar-range",
	"Material Requirements Planning Report": "calculator",
	"daily-input": "sheet",
	"Order Readiness": "calendar-clock",
	"Plan vs Actual": "target",
	"Missing Documents": "paperclip",
	"Missing Data": "list-checks",
	"Expense Entry": "wallet",
	"Monthly Expenses": "chart-column",
	"Machine Capacity": "cog",
	"Item Lead Time": "hourglass",
	"Item": "package",
	"Brand": "award",
	"Stock Entry": "arrow-left-right",
	"Delivery Note": "truck",
	"Purchase Order": "clipboard-list",  # its base icon is Buying's own header icon
	"Work Order": "wrench",  # same: its base factory is Manufacturing's header icon
	"Warehouse": "building-2",
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
	"Project": "folder-open",  # its base folder-kanban is Projects' header icon
	"Timesheet": "clock",
	"Reject Reason": "ban",
	"Stock Reconciliation": "scale",
	"Stock Settings": "sliders-horizontal",  # not Settings' own header icon
	"Selling Settings": "sliders-horizontal",
	"Buying Settings": "sliders-horizontal",
	"Manufacturing Settings": "sliders-horizontal",
	"Accounts Settings": "sliders-horizontal",
	"Projects Settings": "sliders-horizontal",
	"HR Settings": "sliders-horizontal",
}

# Module Profile (named like its Role Profile) → the Module Defs it allows. It blocks every other Module Def of
# erpnext, hrms and erp_internal; Frappe's own modules are left alone. Each set is the modules of that profile's
# IKON entries plus MODUL_TANPA_IKON for Admin (`test_profil_modul_ikut_ikon`); Produksi has no invoices or leave.
# Super Admin's Module Profile blocks only MODUL_MATI.
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
MODUL_BOLEH = {ADMIN: (*_MODUL_KERJA, "Setup"), PRODUKSI: ("Manufacturing",)}

# Modules nobody uses here (Abel, 2026-11-04). A block hides only the way in, never a document (Frappe keeps that to
# DocPerm), so `_kunci_modul` also gives each of their DocTypes one Custom DocPerm for the Administrator role: no other
# user reads, searches or opens them by URL. Super Admin's Module Profile blocks them (it blocks nothing else),
# Administrator's own `block_modules` too, and `saring_modul_mati` takes them out of every boot (Administrator's
# search). Administrator still opens one by URL: the way back, and the user ERPNext's own jobs run as. Bulk
# Transaction stays open: list views log their bulk actions there. HR's own DocTypes are all module "HR", mixed
# (Attendance, Shift and Leave are in use), so its unused ones are listed by name in DOCTYPE_MATI; Recruitment,
# Performance, Expenses, Tenure and Tax and Benefits hold only those menus. Remove a module here and migrate to unlock it.
MODUL_MATI = (
	"CRM",
	"Assets",
	"Quality Management",
	"Support",
	"Subcontracting",
	"Maintenance",
	"Payroll",
	"Telephony",
	"Utilities",
	"Regional",
	"EDI",
	"ERPNext Integrations",
	"Communication",
	"Portal",
	"Recruitment",
	"Performance",
	"Expenses",
	"Tenure",
	"Tax and Benefits",
)
# HR's unused DocTypes (Abel, 2026-11-04), locked like MODUL_MATI's. The office uses attendance, check-ins, shifts,
# leave and holidays only; overtime goes with Payroll. Remove one here and migrate to unlock it.
DOCTYPE_MATI = (
	# Recruitment
	"Job Requisition",
	"Job Opening",
	"Job Opening Template",
	"Job Applicant",
	"Job Applicant Source",
	"Interview",
	"Interview Feedback",
	"Interview Type",
	"Job Offer",
	"Job Offer Term Template",
	"Offer Term",
	"Appointment Letter",
	"Appointment Letter Template",
	"Staffing Plan",
	"Employee Referral",
	# Performance
	"Appraisal",
	"Appraisal Cycle",
	"Appraisal Template",
	"Goal",
	"KRA",
	"Employee Performance Feedback",
	"Employee Feedback Criteria",
	# Training
	"Training Program",
	"Training Event",
	"Training Feedback",
	"Training Result",
	# Expenses and travel
	"Expense Claim",
	"Expense Claim Type",
	"Employee Advance",
	"Travel Request",
	"Purpose of Travel",
	# Employee lifecycle
	"Employee Onboarding",
	"Employee Onboarding Template",
	"Employee Separation",
	"Employee Separation Template",
	"Employee Promotion",
	"Employee Transfer",
	"Exit Interview",
	"Full and Final Statement",
	"Employee Grievance",
	"Grievance Type",
	# Fleet, skills and the rest
	"Vehicle Log",
	"Vehicle Service Item",
	"Skill",
	"Employee Skill Map",
	"Daily Work Summary",
	"Daily Work Summary Group",
	"Employee Health Insurance",
	"Overtime Type",
	"Overtime Slip",
)
# Reports of an open module that read only DOCTYPE_MATI's records though their ref_doctype stays open.
LAPORAN_MATI = ("Vehicle Expenses",)
PERAN_KUNCI = "Administrator"  # the one role a locked DocType's Custom DocPerm names
# Global default: the DocTypes `_kunci_modul` locked (JSON), the only ones it unlocks.
KUNCI_GLOBAL = "erp_modul_terkunci"
# A report of MODUL_MATI may read a DocType that stays open (Lead Conversion Time reads Communication, the VAT reports
# GL Entry), so the lock does not reach it: `_matikan_laporan` disables it (refused even by URL) and keeps the list
# here, the only reports it enables again.
LAPORAN_GLOBAL = "erp_laporan_mati"

# Role Profile → standard ERPNext/HRMS roles. Read from the v16 DocPerms (`test_izin_per_profil`):
# - Produksi (Samuel, 2026-11-23; was User): PERAN_USER only (Production Entry, machine status, and the reads of
#   setup.IZIN_TAMBAHAN). No stock role: a Production Entry's own stock entries are made by the system.
# - Admin: every manager role of the used modules plus the *User roles (Stock Manager alone reads neither Company
#   nor Stock Balance), and PERAN_ADMIN for users. No Employee: HR Manager covers attendance.
# - Super Admin (was Developer): Admin plus System Manager.
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
	SUPER_ADMIN: ("System Manager", *_PERAN_ADMIN),
	ADMIN: _PERAN_ADMIN,
	PRODUKSI: (PERAN_USER,),
}
# The roles an Admin may hand out (`pengguna.cek_user`): those of the Admin and Produksi profiles, the approver
# roles HRMS adds itself when HR names someone a department's leave or expense approver, and Employee, which
# ERPNext adds when an Employee record names the user (a profile then drops it again).
PERAN_BOLEH_ADMIN = frozenset(
	(*PROFIL_PERAN[ADMIN], *PROFIL_PERAN[PRODUKSI], "Leave Approver", "Expense Approver", "Employee")
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
		_p("Stock Entry"),
		_p("Delivery Note"),
		_p("Item"),
		_p("Brand"),
		_p("Warehouse"),
		_p("Stock Balance", jenis="Report"),
		_p("Stock Ledger", jenis="Report"),
		_p("Missing Documents", jenis="Report"),
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
		_p("Expense Entry"),
		_p("Monthly Expenses", jenis="Report"),
	),
	"Manufacturing": (
		_p("production-floor", "Production Floor", "Page"),
		_p(
			"Work Order",
			"Work Orders in Process",
			stats_filter='[["Work Order","status","=","In Process"]]',
			format="{} In Process",
			color="Blue",
		),
		_p("daily-input", "Daily Input", "Page"),
		_p("Plan vs Actual", jenis="Report"),
		_p("Machine Capacity"),
		_p("Sales History"),  # Admin only from here (SIDEBAR's order)
		_p("Master Production Schedule"),
		_p("Material Requirements Planning Report", "MRP", "Report"),
		_p("Order Readiness", jenis="Report"),
		_p("BOM"),
		_p("Sales Forecast"),
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
		_p("Missing Data", jenis="Report"),
	),
}
# Sidebar → our own Workspace that replaces its home. A standard Workspace keeps its app-owned title (the page
# title, breadcrumb and browser tab) and Custom Workspace cannot change it, so "Shift & Attendance" gets a
# site Workspace named and titled "HR" (id: SDM), with PINTASAN["HR"] (`_rumah_sendiri`). The base home stays
# in place (its route still opens), hidden from the sidebar.
RUMAH_SENDIRI = {"Shift & Attendance": "HR"}
BLOK_TETAP = ()  # base Workspace blocks kept below the shortcuts: none (Samuel, 2026-10-28: homes kept short)
KOLOM_PINTASAN = ("type", "link_to", "doc_view", "label", "stats_filter", "format", "color")
# Settings pages only Super Admin sees in the menu and on the Settings home (Abel 2026-11-25): set once at setup,
# several fields rewritten by `setup` on every migrate, so an Admin's change there would quietly come back. Hidden
# for users without System Manager (`menu_samping` drops them from the boot sidebars, `pintasan.js` from the home
# through `erp_sembunyi`); DocPerms are unchanged, so forms that read these settings keep working.
KHUSUS_SUPER_ADMIN = (
	"Stock Settings",
	"Selling Settings",
	"Buying Settings",
	"Manufacturing Settings",
	"Accounts Settings",
	"Projects Settings",
	"HR Settings",
)
# Shortcut target → the one line under its title on the module homes (Abel 2026-11-25: bigger cards with an icon
# and a short explanation). Sent in `erp_pintasan` with the link's sidebar icon; `public/js/pintasan.js` draws them.
KETERANGAN = {
	"Stock Entry": "Goods in and moves between warehouses",
	"Delivery Note": "Goods sent to customers",
	"Item": "Products, materials and packing",
	"Brand": "Brand codes and their inserts",
	"Warehouse": "The factory and Pluit warehouses",
	"Stock Balance": "Stock per item and warehouse",
	"Stock Ledger": "Every stock movement",
	"Missing Documents": "Documents without a photo yet",
	"Customer": "Your customers",
	"Sales Order": "Customer orders",
	"Sales Invoice": "Bills to customers",
	"Payment Entry": "Money in and out",
	"Sales History": "Monthly sales per item",
	"Supplier": "Your suppliers",
	"Material Request": "Materials to buy",
	"Purchase Order": "Orders to suppliers",
	"Purchase Receipt": "Goods received from suppliers",
	"Purchase Invoice": "Bills from suppliers",
	"Expense Entry": "Wages, electricity and other costs",
	"Monthly Expenses": "All costs of a month",
	"production-floor": "Live view of every machine",
	"Work Order": "What to make, on which machine",
	"daily-input": "Output per shift, like the Excel sheet",
	"Plan vs Actual": "Target against output",
	"Machine Capacity": "Speed and material per machine",
	"Master Production Schedule": "Production plan per month",
	"Material Requirements Planning Report": "Materials the plan needs",
	"Order Readiness": "Can each order ship on time",
	"BOM": "The recipe of each product",
	"Sales Forecast": "Expected sales",
	"Item Lead Time": "Days to make or buy an item",
	"Project": "Office projects",
	"Task": "Tasks given to you",
	"Timesheet": "Hours worked on projects",
	"Employee": "Staff records",
	"Employee Checkin": "Clock in and out",
	"Attendance": "Who came in",
	"Leave Application": "Ask for leave",
	"Shift Type": "Working hours",
	"Shift Assignment": "Who works which shift",
	"Holiday List": "Days off",
	"Leave Allocation": "Leave days given",
	"User": "Accounts and roles",
	"Company": "Company details and logo",
	"Stock Reconciliation": "Opening stock and stock counts",
	"Stock Settings": "Stock options",
	"Selling Settings": "Selling options",
	"Buying Settings": "Buying options",
	"Manufacturing Settings": "Production options",
	"Reject Reason": "Why pieces are rejected",
	"Accounts Settings": "Accounting options",
	"Projects Settings": "Project options",
	"HR Settings": "HR options",
	"Missing Data": "Data still to fill in",
}

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
	_modul_pengguna()
	_kunci_modul()
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
			# The Production Floor tile (erp_internal's add_to_apps_screen) opens a page, not a rail; Frappe
			# already left it off for a user its `has_permission` refuses.
			if not app.get("on_apps_screen") or app.get("app_name") == "erp_internal":
				continue
			entri = dock.get(app.get("app_name")) or app.get("dock") or []
			if not any(
				not e.get("hidden") and e.get("link_type") == "Sidebar" and e.get("link_to") in sidebars
				for e in entri
			):
				app["on_apps_screen"] = False
	except Exception:
		frappe.log_error("erp_internal: saring_aplikasi")


# The lists of DocTypes in a boot's `user` that the search bar and the menus read.
DAFTAR_BOOT = (
	"can_read",
	"can_search",
	"can_create",
	"can_write",
	"can_get_report",
	"can_import",
	"can_export",
	"can_select",
	"can_print",
	"can_email",
	"can_submit",
	"can_cancel",
	"can_delete",
	"in_create",
	"all_read",
)


def saring_modul_mati(bootinfo) -> None:
	"""extend_bootinfo: take MODUL_MATI's DocTypes and reports out of the boot, so the search bar never offers them.
	Only Administrator still has them to take out (`_kunci_modul`). Boot must never fail."""
	try:
		mati = set(doctype_mati())
		user = bootinfo.get("user") or {}
		for kunci in DAFTAR_BOOT:
			if isinstance(user.get(kunci), list):
				user[kunci] = [dt for dt in user[kunci] if dt not in mati]
		# The search bar's reports, pages and dashboards sit on the boot itself (v16 no longer sends
		# `user.all_reports`); each carries its module. A report also goes by its DocType.
		modul = set(MODUL_MATI)
		for kunci in ("allowed_reports", "page_info"):
			isi = bootinfo.get(kunci)
			if isinstance(isi, dict):
				bootinfo[kunci] = {
					k: v
					for k, v in isi.items()
					if (v or {}).get("module") not in modul and (v or {}).get("ref_doctype") not in mati
				}
		if isinstance(bootinfo.get("dashboards"), list):
			bootinfo["dashboards"] = [
				d for d in bootinfo["dashboards"] if (d or {}).get("module") not in modul
			]
	except Exception:
		frappe.log_error("erp_internal: saring_modul_mati")


def menu_samping(bootinfo) -> None:
	"""extend_bootinfo: `erp_menu`, the user's modules in IKON order as {shell, label, icon}, for the one labelled
	sidebar (`public/js/menu_samping.js`), and `erp_menu_atas`, the MENU_ATAS links this user's menu has. ERP and HR share it. A module whose sidebar Frappe left out of this
	user's boot (blocked, or nothing they can open) is skipped. Boot must never fail."""
	try:
		sidebars = bootinfo.get("module_sidebars") or {}
		sembunyi = () if "System Manager" in frappe.get_roles() else KHUSUS_SUPER_ADMIN
		bootinfo.erp_sembunyi = list(sembunyi)
		for s in sidebars.values():
			if s and s.get("items") and sembunyi:
				s["items"] = [i for i in s["items"] if i.get("link_to") not in sembunyi]
		bootinfo.erp_menu = [
			{"shell": shell, "label": LABEL.get(shell, shell), "icon": IKON_MODUL[shell]}
			for shell in IKON
			if any(
				i.get("type") == "Link" and i.get("link_type") != "Workspace"
				for i in (sidebars.get(shell) or {}).get("items") or []
			)
		]
		ada = {
			i.get("link_to")
			for m in bootinfo.erp_menu
			for i in (sidebars.get(m["shell"]) or {}).get("items") or []
		}
		bootinfo.erp_menu_atas = [t for t in MENU_ATAS if t in ada]
		# The home cards' icon (the link's sidebar icon, so card and sidebar match; a link can sit in several
		# sidebars, Super Admin also sees Planning's bare one, so the first icon found wins) and line (KETERANGAN).
		kartu = {}
		for s in sidebars.values():
			for i in (s or {}).get("items") or []:
				link = i.get("link_to")
				if i.get("type") == "Link" and link and not (kartu.get(link) or {}).get("icon"):
					kartu[link] = {"icon": i.get("icon") or IKON_LINK.get(link), "ket": KETERANGAN.get(link)}
		bootinfo.erp_pintasan = kartu
	except Exception:
		frappe.log_error("erp_internal: menu_samping")


# App → the name and icon its Apps screen tile and its rail's top slot show (Abel, 2026-10-28). Each icon is a
# Delta-blue rounded square with a white Lucide glyph (`public/images/aplikasi-*.svg`). Frappe's tile ("System")
# shows for Super Admin only. The Delta Anugrah logo itself stays on the navbar, login, splash and favicon.
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
	"""Our roles PERAN_ADMIN and PERAN_USER, with desk access. Safe before the setup wizard (Role Profiles link to
	them)."""
	for peran in (PERAN_ADMIN, PERAN_USER):
		if not frappe.db.exists("Role", peran):
			frappe.get_doc({"doctype": "Role", "role_name": peran, "desk_access": 1}).insert(
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
		baris.append({**_tambahan(ws), "label": "Home", "link_type": "Workspace", "icon": IKON_RUMAH})
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
	# Keyed by the whole identity: a module's home Workspace shares its `link_to` with other rows.
	ikon_dasar = {item_key(r): r.get("icon") for r in dasar}
	rumah = next((r for r in baris if not r["hidden"]), None)
	for r in baris:
		ikon = IKON_RUMAH if r is rumah else IKON_LINK.get(r.get("link_to"))
		if not r["hidden"] and ikon and ikon != ikon_dasar.get(item_key(r)):
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
	_pengguna_profil()


def _pengguna_profil() -> None:
	"""Resave each user of a Role Profile whose roles differ from their profiles'. Frappe does it from a
	background job when a profile changes; a migrate should leave the users right at once."""
	from frappe.permissions import AUTOMATIC_ROLES

	profil = {}
	for r in frappe.get_all("User Role Profile", ["parent", "role_profile"]):
		profil.setdefault(r.parent, set()).add(r.role_profile)
	for user, nama in profil.items():
		harap = {
			p
			for n in nama
			for p in frappe.get_all("Has Role", {"parent": n, "parenttype": "Role Profile"}, pluck="role")
		}
		punya = set(frappe.get_all("Has Role", {"parent": user, "parenttype": "User"}, pluck="role"))
		if punya - set(AUTOMATIC_ROLES) != harap and user not in frappe.STANDARD_USERS:
			frappe.get_doc("User", user).save(ignore_permissions=True)


def blok_profil() -> dict[str, list[str]]:
	"""Module Profile → the modules it blocks: Admin and Produksi everything outside MODUL_BOLEH, Super Admin MODUL_MATI."""
	semua = set(modul_aplikasi())
	blok = {nama: sorted(semua - set(boleh)) for nama, boleh in MODUL_BOLEH.items()}
	blok[SUPER_ADMIN] = sorted(semua & set(MODUL_MATI))
	return blok


def _profil_modul() -> None:
	for nama, blok in blok_profil().items():
		if frappe.db.exists("Module Profile", nama):
			doc = frappe.get_doc("Module Profile", nama)
			if sorted(b.module for b in doc.block_modules) == blok:
				continue
		else:
			doc = frappe.new_doc("Module Profile")
			doc.module_profile_name = nama
		doc.set("block_modules", [{"module": m} for m in blok])
		doc.save(ignore_permissions=True)


def _modul_pengguna() -> None:
	"""Each user of one of our Role Profiles on the Module Profile of the same name (a User copies its profile's
	blocks on save), and Administrator's own blocks on MODUL_MATI. A Super Admin made before it had a Module
	Profile gets it here."""
	for r in frappe.get_all("User Role Profile", ["parent", "role_profile"], {"parenttype": "User"}):
		if r.role_profile not in PROFIL_PERAN or r.parent in frappe.STANDARD_USERS:
			continue
		if frappe.db.get_value("User", r.parent, "module_profile") != r.role_profile:
			doc = frappe.get_doc("User", r.parent)
			doc.module_profile = r.role_profile
			doc.save(ignore_permissions=True)
	blok = blok_profil()[SUPER_ADMIN]
	admin = frappe.get_doc("User", "Administrator")
	if sorted(b.module for b in admin.block_modules) != blok:
		admin.set("block_modules", [{"module": m} for m in blok])
		admin.save(ignore_permissions=True)


def doctype_mati() -> list[str]:
	"""The DocTypes of MODUL_MATI, and those of DOCTYPE_MATI that exist, that have permissions of their own (child
	tables follow their parent)."""
	modul = frappe.get_all("DocType", {"module": ("in", MODUL_MATI), "istable": 0}, pluck="name")
	nama = frappe.get_all("DocType", {"name": ("in", DOCTYPE_MATI), "istable": 0}, pluck="name")
	return sorted(set(modul) | set(nama))


@frappe.whitelist()
def master_karyawan(company: str) -> dict[str, bool]:
	"""HRMS's `get_assignable_masters` (the Employee form's assign buttons), with a master the user cannot read
	(Salary Structure, locked with Payroll) answered False instead of a Permission Error popup. Same filters as
	HRMS v16.52."""
	masters = {
		"Leave Policy": {"docstatus": 1},
		"Salary Structure": {"docstatus": 1, "is_active": "Yes", "company": company},
		"Shift Schedule": {"docstatus": 1},
	}
	return {
		dt: frappe.has_permission(dt, "read") and bool(frappe.get_list(dt, filters=f, limit=1, pluck="name"))
		for dt, f in masters.items()
	}


def _kunci_modul() -> None:
	"""One Custom DocPerm, for PERAN_KUNCI, on each DocType of MODUL_MATI (a DocType with Custom DocPerms ignores its
	standard ones). Only a DocType this function locked before (KUNCI_GLOBAL) and that left MODUL_MATI gets its own
	permissions back: a Custom DocPerm someone set by hand on another DocType is never touched."""
	kunci = set(doctype_mati())
	dulu = set(frappe.parse_json(frappe.db.get_global(KUNCI_GLOBAL) or "[]"))
	baris = {}
	for r in frappe.get_all(
		"Custom DocPerm",
		["name", "parent", "role", "permlevel"],
		{"parent": ("in", list(kunci | dulu) or [""])},
	):
		baris.setdefault(r.parent, []).append(r)
	for dt in sorted(kunci | dulu):
		ada = baris.get(dt, [])
		kita = len(ada) == 1 and ada[0].role == PERAN_KUNCI and not ada[0].permlevel
		if dt in kunci and not kita:
			for r in ada:
				frappe.delete_doc("Custom DocPerm", r.name, ignore_permissions=True)
			frappe.get_doc(
				{
					"doctype": "Custom DocPerm",
					"parent": dt,
					"parenttype": "DocType",
					"parentfield": "permissions",
					"role": PERAN_KUNCI,
					"permlevel": 0,
					**dict.fromkeys(("read", "write", "create", "delete", "report", "export"), 1),
				}
			).insert(ignore_permissions=True)
			frappe.clear_cache(doctype=dt)
		elif dt not in kunci and kita:
			frappe.delete_doc("Custom DocPerm", ada[0].name, ignore_permissions=True)
			frappe.clear_cache(doctype=dt)
	if kunci != dulu:
		frappe.db.set_global(KUNCI_GLOBAL, frappe.as_json(sorted(kunci)))
	_matikan_laporan()


def _matikan_laporan() -> None:
	"""Disable the reports of MODUL_MATI, those built on a DOCTYPE_MATI DocType and LAPORAN_MATI; enable again only
	those this function disabled and that left them."""
	mati = set(frappe.get_all("Report", {"module": ("in", MODUL_MATI)}, pluck="name"))
	mati |= set(frappe.get_all("Report", {"ref_doctype": ("in", DOCTYPE_MATI)}, pluck="name"))
	mati |= set(frappe.get_all("Report", {"name": ("in", LAPORAN_MATI)}, pluck="name"))
	dulu = set(frappe.parse_json(frappe.db.get_global(LAPORAN_GLOBAL) or "[]"))
	for nama in sorted(mati):
		if not frappe.db.get_value("Report", nama, "disabled"):
			frappe.db.set_value("Report", nama, "disabled", 1, update_modified=False)
	for nama in sorted(dulu - mati):
		if frappe.db.exists("Report", nama):
			frappe.db.set_value("Report", nama, "disabled", 0, update_modified=False)
	if mati != dulu:
		frappe.db.set_global(LAPORAN_GLOBAL, frappe.as_json(sorted(mati)))


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
