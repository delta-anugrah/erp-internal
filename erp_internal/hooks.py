app_name = "erp_internal"
app_title = "ERP Internal"
app_publisher = "Abel"
app_description = "ERP for the plastic factory and the office"
app_email = "marcoabel25@gmail.com"
app_license = "mit"

from erp_internal.batas_user import HANYA_ADMIN

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "erp_internal",
# 		"logo": "/assets/erp_internal/logo.png",
# 		"title": "ERP Internal",
# 		"route": "/erp_internal",
# 		"has_permission": "erp_internal.api.permission.has_app_permission",
# 	}
# ]

# The Production Floor page gets its own Apps screen tile (Abel, 2026-10-29: "production floor di desk"). It has no
# dock, so it opens its route; `tampilan.saring_aplikasi` keeps it, and `boleh_buka` shows it only to who may open
# the page. erpnext's tile is 1, hrms's 2.
add_to_apps_screen = [
	{
		"name": "erp_internal",
		"logo": "/assets/erp_internal/images/aplikasi-lantai.svg",
		"title": "Production Floor",
		# The shell in the URL: from the Apps screen no sidebar is on screen, and Frappe kept the user's home
		# shell (/desk/accounts/production-floor). Every profile has Manufacturing.
		"route": "/desk/manufacturing/production-floor",
		"has_permission": "erp_internal.production_floor.boleh_buka",
		"sequence_id": 3,
	}
]

# The dock, the rail down the left of the desk, is a document rather than a hook. Author it in
# Manage Dock on a developer-mode site and press Export to App, and it is written to
# `erp_internal/dock/erp_internal/erp_internal.json` for git to carry. An app that ships none has no
# rail: its sidebar gets a switcher in the header instead.
#
# A companion app, one that extends a host app rather than standing on its own, says so with
# `mount_on` on that same record, and its entries are appended to the host's rail. Mounting keeps
# the companion off the apps screen, so it takes precedence over any add_to_apps_screen above.

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = "/assets/erp_internal/css/erp_internal.css"  # public/css: avatar cursor, sidebar fold arrow, Settings version
app_include_js = "erp_internal.bundle.js"  # public/js/erp_internal.bundle.js: language switch, menu, version

# The app version under the login card (erp_internal/versi.py; Desk shows it in the Settings dialog, public/js/versi.js).
update_website_context = "erp_internal.versi.di_login"

# include js, css files in header of web template
# web_include_css = "/assets/erp_internal/css/erp_internal.css"
# web_include_js = "/assets/erp_internal/js/erp_internal.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "erp_internal/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# The "Fill from History" button (planning/forecast.py); "Record Output" on a Work Order (Production Entry).
doctype_js = {"Sales Forecast": "public/js/sales_forecast.js", "Work Order": "public/js/work_order.js"}

# proyek.py: an employee submits only their own timesheet (IZIN_TAMBAHAN gives the Employee role submit).
# pengguna.py: an Admin hands out only Admin and User roles and leaves Developer accounts alone.
doc_events = {
	"Timesheet": {"before_submit": "erp_internal.proyek.cek_pemilik_timesheet"},
	# production_floor.py: the Production Floor page refreshes the machine that changed. Work Order uses on_change:
	# ERPNext sets produced_qty and status with db_set, which runs only before_change/on_change, and on_change also
	# runs after save, submit, cancel and update-after-submit. Workstation keeps on_update: Job Card writes its status
	# with db.set_value (no event at all), which the page's poll catches.
	"Workstation": {"on_update": "erp_internal.production_floor.siarkan"},
	"Work Order": {
		"on_change": "erp_internal.production_floor.siarkan",
		# before_validate, not validate: ERPNext builds the required items in validate, from the BOM then set.
		"before_validate": "erp_internal.planning.kapasitas.pilih_bom",
		"validate": "erp_internal.planning.kapasitas.mesin_aktif",
		"before_update_after_submit": [
			"erp_internal.planning.kapasitas.kunci_mesin",
			"erp_internal.planning.kapasitas.mesin_aktif",
		],
	},
	"User": {
		"before_validate": "erp_internal.pengguna.cek_user_awal",
		"validate": "erp_internal.pengguna.cek_user",
	},
	"Has Role": {
		"before_insert": "erp_internal.pengguna.cek_peran",
		"validate": "erp_internal.pengguna.cek_peran",
	},
	# batas_user.py: a User makes only a Material Receipt by hand.
	"Stock Entry": {
		"validate": "erp_internal.batas_user.cek_stock_entry",
		"before_cancel": "erp_internal.batas_user.cek_stock_entry",
	},
}
# batas_user.HANYA_ADMIN: Stock User's other documents, read only for a User.
has_permission = {
	"User": "erp_internal.pengguna.boleh_ubah",
	**dict.fromkeys(HANYA_ADMIN, "erp_internal.batas_user.boleh_ubah"),
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_kanban_js = {"doctype" : "public/js/doctype_kanban.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "erp_internal/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "erp_internal.utils.jinja_methods",
# 	"filters": "erp_internal.utils.jinja_filters"
# }

# User menu
# ---------
# The language switch: one row shows, naming the other language. `frappe.boot.lang` is the user's own.
standard_navbar_items = [
	{
		"item_label": "Bahasa Indonesia",
		"item_type": "Action",
		"action": "erp_internal.ganti_bahasa('id')",
		"is_standard": 1,
		"condition": "eval: frappe.boot.lang !== 'id'",
		"icon": "languages",
	},
	{
		"item_label": "English",
		"item_type": "Action",
		"action": "erp_internal.ganti_bahasa('en')",
		"is_standard": 1,
		"condition": "eval: frappe.boot.lang === 'id'",
		"icon": "languages",
	},
]

# Installation
# ------------

# before_install = "erp_internal.install.before_install"
# Site setup, re-applied on every install and migrate (erp_internal/setup.py).
# Hide an Apps screen tile whose app has nothing on this user's rail (tampilan.saring_aplikasi), then put our
# mark and names on the tiles and the rail's top slot (tampilan.merek_aplikasi).
extend_bootinfo = [
	"erp_internal.tampilan.saring_aplikasi",
	"erp_internal.tampilan.merek_aplikasi",
	"erp_internal.tampilan.menu_samping",
	"erp_internal.tampilan.saring_modul_mati",
]

# Frappe's workspace writes answer with a fresh `app_data` that skips extend_bootinfo; ours run Frappe's and then
# the same two layers on the reply (erp_internal/ruang_kerja.py).
override_whitelisted_methods = {
	f"frappe.desk.doctype.workspace.workspace.{m}": f"erp_internal.ruang_kerja.{m}"
	for m in ("new_page", "update_workspace_settings", "delete_page", "set_workspace_module")
} | {
	"frappe.desk.page.workspace_restore.workspace_restore.restore_workspace_edits": (
		"erp_internal.ruang_kerja.restore_workspace_edits"
	)
}

after_install = "erp_internal.setup.pastikan_setup"
after_migrate = "erp_internal.setup.pastikan_setup"
# The wizard, filled by make or in the browser: our company, the wizard's account as Developer, Samuel's data once.
setup_wizard_complete = "erp_internal.wizard.selesai"

# Frappe runs only the tested app's before_tests: complete the test site's wizard (HRMS's own hook,
# which also runs ERPNext's setup), then our setup.
before_tests = "erp_internal.tests.utils.sebelum_tes"

# Uninstallation
# ------------

# before_uninstall = "erp_internal.uninstall.before_uninstall"
# after_uninstall = "erp_internal.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "erp_internal.utils.before_app_install"
# after_app_install = "erp_internal.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "erp_internal.utils.before_app_uninstall"
# after_app_uninstall = "erp_internal.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "erp_internal.build.after_build"

# To hook into the build process of other apps
# The list of apps being built is passed as an argument

# after_app_build = "erp_internal.build.after_app_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "erp_internal.notifications.get_notification_config"

# Awesome Bar
# -----------
# Extra search results: list of dicts with label, description, route, index.
# route: ["List", "ToDo"], "/desk/docs/some/page", or "https://example.com"
# awesomebar_search = ["erp_internal.search.awesomebar_results"]

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"erp_internal.tasks.all"
# 	],
# 	"daily": [
# 		"erp_internal.tasks.daily"
# 	],
# 	"hourly": [
# 		"erp_internal.tasks.hourly"
# 	],
# 	"weekly": [
# 		"erp_internal.tasks.weekly"
# 	],
# 	"monthly": [
# 		"erp_internal.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "erp_internal.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "erp_internal.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "erp_internal.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "erp_internal.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["erp_internal.utils.before_request"]
# after_request = ["erp_internal.utils.after_request"]

# Job Events
# ----------
# before_job = ["erp_internal.utils.before_job"]
# after_job = ["erp_internal.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"erp_internal.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
