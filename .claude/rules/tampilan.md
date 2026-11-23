---
paths: ["erp_internal/tampilan.py", "erp_internal/setup.py", "erp_internal/pengguna.py", "erp_internal/tests/test_tampilan.py", "tools/cek_layar.mjs", "erp_internal/contoh.py", "erp_internal/planning/**"]
---
# Navigation in Frappe v16.53 (what `tampilan.py` changes)

The desk is module-first. Desktop Settings stays on "Apps" (`_halaman_apps`): no Desktop Icon grid, no Desktop
Icon rows. What a user sees, and the site layer we write for each (never the app's own row):

| Surface | App's row (read only) | Our site layer |
|---|---|---|
| Apps screen | `add_to_apps_screen` hook (erpnext: any desk user; hrms: Employee read) | `saring_aplikasi` (`extend_bootinfo`): a tile with no visible rail entry for the user is hidden |
| Rail of modules | `<app>/dock/<app>/<app>.json` (`Dock`, standard 1) | `Dock` with blank `user`: `IKON` order, rest `hidden` 1, title from `LABEL`; not shown on ERP and HR pages (the menu below) |
| Menu (ERP and HR pages) | none | `menu_samping` (`extend_bootinfo`, `erp_menu`) + `public/js/menu_samping.js`: every module of the user as a collapsible header |
| Module sidebar | `<app>/<module>/sidebar/<name>/<name>.json` (`Sidebar`) | `Custom Sidebar` with blank `user`: Home, then `SIDEBAR`, rest hidden |
| Module home | `Workspace` (standard, content blocks) | `Custom Workspace` (`PINTASAN`): shortcuts only (`BLOK_TETAP` empty: no number or link cards) |
| Per user | none | `User.block_modules` from the Module Profile of the same name (`blok_profil`: Admin and Produksi outside `MODUL_BOLEH`, Super Admin only `MODUL_MATI`; `_modul_pengguna` keeps each profile's users on it, and Administrator's own blocks on `MODUL_MATI`) |
| Unused modules | DocPerm | `MODUL_MATI` and HR's `DOCTYPE_MATI` (`_kunci_modul`, `doctype_mati()`): one Custom DocPerm for the Administrator role per DocType, so no other user reads, searches or opens them by URL; `saring_modul_mati` (`extend_bootinfo`) drops them and their reports from every boot (Administrator's search). Administrator still opens one by URL |

- `Sidebar` and standard `Dock`/`Workspace` content refuse edits outside developer mode; that is why everything is a
  layer. A saved dock layer drops entries it does not name, so `_dok` names every entry.
- Short screens (Samuel, 2026-10-28): each home's shortcuts point at exactly its sidebar's links
  (`test_rumah_sama_dengan_sidebar`), taken from the guides' flows (`docs/panduan/`). Modules (Admin): Stock, Selling, Buying,
  Manufacturing, Projects, HR (`Shift & Attendance`, `LABEL`), Settings; Produksi: Manufacturing only. Accounts and Leaves have no
  icon: invoices and payments sit in Selling and Buying, leave in HR. Their modules stay allowed
  (`MODUL_TANPA_IKON`) with a short sidebar and home, for a page Frappe opens in its own module. Admin-only
  shortcuts go last, so a Produksi home (which drops what they cannot read) has no gap. Stock Reconciliation
  (opening stock and stock count) is under Settings ("Opening Stock & Stock Count"). `_baris_sidebar` skips a
  base Dashboard row named like a DocType (Project, Attendance).
- The HR home is our own site Workspace "HR" (`RUMAH_SENDIRI`, `_rumah_sendiri`: public, module Shift and
  Attendance, `PINTASAN["HR"]` written into it), first in the Shift & Attendance sidebar; a standard Workspace keeps
  its app's title and `Custom Workspace` has no title field. So the page title, breadcrumb and tab read "HR"
  ("SDM" in Indonesian). The base "Shift & Attendance" home is hidden in the sidebar; its route still opens.
- Our module `Planning` has no Dock entry or Sidebar and stays blocked in the Admin and Produksi Module Profiles (Super Admin's blocks only `MODUL_MATI`); its Sales History
  is in `SIDEBAR["Selling"]` and `SIDEBAR["Manufacturing"]`, Order Readiness in Manufacturing, and the Planning
  DocTypes and reports in `SIDEBAR["Manufacturing"]` and `PINTASAN["Manufacturing"]`: Production Floor, Work Order,
  Production Entry, Plan vs Actual, Machine Capacity first (what Produksi reads), then Admin's (Sales History, MPS,
  MRP, Order Readiness, BOM, Sales Forecast, Item Lead Time); Reject Reason sits in Setup after
  Manufacturing Settings. The Planning module itself stays blocked for Admin and Produksi.
- Production Floor (page `production-floor`, `lantai.md`; in the menu an entry of its own above the headers, `MENU_ATAS`) is the first link of Manufacturing's sidebar after Home and
  the first shortcut of its home: `SIDEBAR` names it by its route and `NAMA_LINK` gives the label (a Page has no
  title in the sidebar row), `PINTASAN` uses `_p("production-floor", "Production Floor", "Page")`. The page hides the
  sidebar on purpose; coming back to it from a Work Order stays under `/desk/manufacturing/` (`cek_layar`).
- Production Floor tile on the Apps screen (Abel, 2026-10-29, "production floor di desk"): erp_internal's
  `add_to_apps_screen` (hooks.py; title Production Floor, `public/images/aplikasi-lantai.svg`, sequence 3), shown by
  `production_floor.boleh_buka` (the Page's own roles; never raises in boot). It has no dock, so `saring_aplikasi`
  skips it. Its route names the shell, `/desk/manufacturing/production-floor`: without it Frappe kept the user's home
  shell (`/desk/accounts/...`). Tile titles wrap to two lines (`erp_internal.css`, `.icons .icon-title`: Frappe's
  desktop.css loads later). `test_tile_production_floor`, `cek_layar` (tile, its href).
- Sidebar icons (Abel, 2026-10-29): `IKON_LINK` (link → lucide icon name, `/assets/frappe/icons/lucide/icons.svg`) gives
  every shown link an icon on every sidebar. `_baris_sidebar` sets it as the row's override only where it differs from
  the base row's icon (Frappe stores no override equal to the base, so an equal one would rewrite the sidebar on every
  migrate: `_jejak_sidebar` compares icons too). Add a link to `SIDEBAR` with an icon here; `test_ikon_sidebar` fails
  on a link without one.
- Blocking a module hides navigation only; DocPerm still decides document access.
- Keys are dock/sidebar names (`Shift & Attendance`), Module Profiles take Module Def names (`Shift and Attendance`).
- `Workspace Sidebar` and `Desktop Icon` are the retiring icon-grid batch (`frappe/desk/RETIRING.md`); don't use them.
- Reference code: `frappe/desk/doctype/{dock,sidebar,custom_sidebar,custom_workspace}/`, `frappe/desk/layers.py`.
- Three Role Profiles (`PROFIL_PERAN`): Produksi, Admin, Super Admin (were User, Admin, Developer until 2026-11-23: `patches/profil_tiga.py` renames them, `NAMA_LAMA`). Admin holds the manager roles plus ERPNext's *User roles (`_PERAN_USER`, not `ERP User`)
  (Stock Manager alone reads neither Company nor Stock Balance in v16) and `PERAN_ADMIN` ("ERP Admin"). Every
  profile must read Company (`test_izin_per_profil`); `setup.IZIN_TAMBAHAN` gives Manufacturing User that read.
- Produksi (was User; Samuel, 2026-11-23) is `PERAN_USER` ("ERP User") alone, no stock role: menu header
  Manufacturing only (`IKON`, `MODUL_BOLEH`). `PERAN_USER` holds Production Entry (create, submit, cancel, amend;
  its JSON), reads Machine Capacity and Reject Reason (JSON), Workstation, Work Order and Company
  (`setup.IZIN_TAMBAHAN`), opens the Production Floor and Plan vs Actual, and sets a machine's status through
  `production_floor.set_status` only; its Manufacturing sidebar shows only what it reads. No Sales History or Order
  Readiness. `setup.IZIN_DICABUT` (`_cabut_izin`) clears exactly the old User's listed rights on Price List, Account,
  Stock Settings and Customer Group at migrate, deleting a row only when no right is left on it. A Production Entry's Manufacture and Repack are made and cancelled with
  permissions ignored and `production_entry.FLAG_HASIL`; `production_entry.cek_stock_entry` (Stock Entry
  `validate`/`before_cancel`) refuses a Manufacture without it except for System Manager ("Record output in Daily
  Input."), and cancelling a Production Entry's own entry except through it. `work_order.js` hides ERPNext's
  Finish from anyone without System Manager; `setup.BAWAAN_WO` makes new Work Orders `skip_transfer` 1 (Property
  Setter `default`), so Produksi's output never waits for Start.
- Admin views Production Entry only (Manufacturing Manager and User keep read, report, export, print, email, share in
  its JSON) and does the stock work: Material Receipt, Delivery Note without a Sales Order (`setup.PENGATURAN_ALUR`
  `so_required` No). Frappe resaves a changed profile's users in a background job; `_pengguna_profil` does it at
  migrate.
- Admin's modules (menu headers) add `Setup`, shown as "Settings" (`LABEL`): users, Company, opening stock, the business settings and the reject reasons; its home is
  ERPNext's `Home` Workspace (`PINTASAN["Home"]`). System Settings and Build stay with System Manager: Frappe's own
  Apps tile (`check_app_permission`) shows for Super Admin only.
- User management: `setup.IZIN_TAMBAHAN` gives `ERP Admin` User read/write/create on permlevel 0 and 1 (roles sit on
  1). `pengguna.py` limits it: only roles in `PERAN_BOLEH_ADMIN` (Guest, All and Desk User pass; Administrator never does, though Frappe lists it in `AUTOMATIC_ROLES`), nothing that controls a Super Admin's or
  Administrator's access (`FIELD_AKSES`, roles, password, rename). Frappe's `populate_role_profile_roles` drops any
  role ticked outside a user's Role Profiles by itself. An Admin- or Produksi-profile user never keeps the Employee role (neither
  profile has it; ERPNext adds it with an Employee record, hence its place in `PERAN_BOLEH_ADMIN`); HR Manager covers their attendance.
- Branding (`setup.MEREK`, `_pengaturan`): Website Settings `app_name`, `app_logo`, `splash_image`, `favicon` and
  Navbar Settings `app_logo` point at `/assets/erp_internal/images/` (public files, served through the
  `sites/assets` symlink, no build); System Settings `app_name` is "Delta Anugrah". Login uses `get_app_logo`
  (Website Settings first), the Apps screen top left Navbar Settings. `setup.LOGO` is `delta-anugrah.svg`, hand-drawn
  from the original JPEG; the PNGs (512 px logo, favicons) are rendered from it, the favicon stays PNG.
- App tiles, the sidebar header on ERP/HR pages and the rail's top slot on System pages: `tampilan.merek_aplikasi` (second `extend_bootinfo`, after `saring_aplikasi`)
  sets `app_title` from `NAMA_APLIKASI` (erpnext ERP, hrms HR, frappe System) and `app_logo_url` from
  `IKON_APLIKASI` (`public/images/aplikasi-*.svg`: Delta blue #1f4782 rounded square, white Lucide glyph, path data
  copied from lucide-static 1.47.0, ISC). The names are in `id.csv` and `test_layar_diterjemahkan`. The Delta logo
  stays on the navbar, login, splash and favicon only. Frappe's
  `workspace_payload` (the reply to a workspace saved from the desk) builds a fresh `app_data` without our hooks,
  so `hooks.override_whitelisted_methods` routes Frappe's five workspace writes (`new_page`,
  `update_workspace_settings`, `delete_page`, `set_workspace_module`, `restore_workspace_edits`) to
  `erp_internal/ruang_kerja.py`: Frappe's function runs unchanged, then `saring_aplikasi` and `merek_aplikasi` on
  the reply (`test_ruang_kerja`).
- One labelled menu instead of the rail (Abel, 2026-11-03: nobody knew what the bare icons meant). `menu_samping`
  sends `erp_menu`: the user's modules in `IKON` order that have a link in their boot sidebar, `{shell, label
  (LABEL), icon (IKON_MODUL)}`; ERP and HR share it. `public/js/menu_samping.js` (in `erp_internal.bundle.js`, needs
  `bench build`) patches Frappe's `Sidebar` on a shell named there, or on Accounts/Leaves (`MODUL_TANPA_IKON`): its
  items become one `Section Break` per module (icon drawn by us, open/closed state under one key `erp_menu`) with that
  module's resolved items as children, each routed into its own shell (`TypeLink.get_path`); the page's module
  opens by itself (`make_sidebar`). `MENU_ATAS` links (Production Floor) are entries of their own above the headers
  (`erp_menu_atas`), still in `SIDEBAR` so their module's home and route stay. `Sidebar.dock_enabled` returns false there, so Frappe runs dock-less: search,
  notifications and the user menu sit in the sidebar, the header shows the app's icon and the module, and folding
  leaves a rail of module icons (our CSS hides the links). Every patch falls back to Frappe's own code on an error.
  Frappe's System app (Build) keeps its rail. No link repeats its module's header icon (`test_ikon_sidebar`: Work
  Order wrench, Purchase Order clipboard-list, Project folder-open, the settings sliders); each home row is
  `IKON_RUMAH` house; every icon we name must exist in the sprite (`test_ikon_ada`). `cek_layar` checks the headers per
  profile, the open and lit module, a link into another module, an Accounts page (Admin), Build's rail (Super Admin),
  the folded rail and the phone drawer (also on a Stock page the menu does not list, which lights nothing).
- Our CSS is one plain file, `public/css/erp_internal.css` (`hooks.app_include_css`, served as-is: no build, no
  `bench start` restart, only `clear-cache` after a hooks change). It gives the Apps screen avatar a pointer and
  keeps the sidebar's fold arrow visible on a desktop, and styles the version line at the foot of the Settings
  dialog (`public/js/versi.js`, in the same bundle as `menu_samping.js`: wraps `SettingsDialog.render_sidebar`). Frappe v16.53 folds the module sidebar with that arrow
  (or the 8 px edge), but shows the arrow only on hover. On Frappe's own pages (System app), beside the pinned dock a folded sidebar slides shut and
  the dock stays as the rail; Frappe then parks the arrow half under the dock (z-index 1030), so our CSS moves
  it into the dock above the profile avatar as a 32 px button with border and shadow (`.sidebar-hidden`: left
  -45px, bottom 60px, z-index 1031; Abel 2026-10-29: the 24 px disc was too small). On the menu's folded rail it is the
  same 32 px button at its edge. The choice is kept in
  localStorage `desk-sidebar-collapsed`. `cek_layar` folds, checks the folded arrow is >= 32 px and on top at its
  centre, reloads and reopens it for each user.
- `setup.IMPOR_BOLEH` (`_impor_boleh`) sets `allow_import` 1 on Stock Reconciliation so Data Import loads opening stock.
- `tools/cek_layar.mjs` opens each module home with `frappe.set_route("Workspaces", <name>)`, counts only message
  dialogs (`.msgprint-dialog`), and checks the rail of each tile on the user's Apps screen
  (`app_data[].on_apps_screen`), failing on a tile with nothing behind it. It also opens every home on the user's
  rail (`<profile>-home-<module>.png`): shortcuts only, at most `PINTASAN_MAKS` (12). It reads the version on /login
  as a guest and in each user's Settings dialog (`.settings-dialog-sidebar .erp-versi` = `v` +
  `frappe.boot.versions.erp_internal`).
- Unused modules (Abel 2026-11-04, `MODUL_MATI`): a Module Profile block only hides the way in (`frappe.utils.modules`
  says so: never a security boundary), so a blocked module's documents still opened by search and URL. The lock is
  a Custom DocPerm for the Administrator role on each of their DocTypes (a DocType with Custom DocPerms ignores its
  standard ones); `_kunci_modul` removes it again when a module leaves `MODUL_MATI` or a DocType leaves `DOCTYPE_MATI`, only for a DocType it locked itself
  (global default `erp_modul_terkunci`): a Custom DocPerm set by hand elsewhere is never touched. A
  report of those modules can read an open DocType (Lead Conversion Time reads Communication, the VAT reports GL
  Entry), so `_matikan_laporan` disables every report of `MODUL_MATI` (refused even by URL, Administrator too) and
  enables again only those it disabled (`erp_laporan_mati`). `saring_modul_mati` also drops reports, pages and
  dashboards whose module is locked. Bulk Transaction stays open (list bulk actions log there). HR's DocTypes are all module "HR", mixed: the
  unused ones are named in `DOCTYPE_MATI` (Abel 2026-11-04) and locked the same way; `_matikan_laporan` also disables reports
  whose `ref_doctype` is one of them, plus `LAPORAN_MATI` (Vehicle Expenses reads Vehicle Log). The menu-only HRMS modules
  Recruitment, Performance, Expenses, Tenure and Tax and Benefits are in `MODUL_MATI`. `test_nama_doctype_ada` catches a typo. The Employee form asks HRMS's
  `get_assignable_masters` for Salary Structure (Payroll, locked), which raised a Permission Error popup:
  `hooks.override_whitelisted_methods` routes it to `tampilan.master_karyawan` (same filters, an unreadable master is
  False; `test_master_karyawan`). `test_modul_mati`; `cek_layar` checks the boot, the menu, `/desk/lead`, `/api/resource/Lead` and `/api/resource/Expense Claim` (403), and Attendance still 200 where the profile has HR.
