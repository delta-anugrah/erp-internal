---
paths: ["erp_internal/tampilan.py", "erp_internal/setup.py", "erp_internal/pengguna.py", "erp_internal/tests/test_tampilan.py", "tools/cek_layar.mjs", "erp_internal/contoh.py", "erp_internal/planning/**"]
---
# Navigation in Frappe v16.53 (what `tampilan.py` changes)

The desk is module-first. Desktop Settings stays on "Apps" (`_halaman_apps`): no Desktop Icon grid, no Desktop
Icon rows. What a user sees, and the site layer we write for each (never the app's own row):

| Surface | App's row (read only) | Our site layer |
|---|---|---|
| Apps screen | `add_to_apps_screen` hook (erpnext: any desk user; hrms: Employee read) | `saring_aplikasi` (`extend_bootinfo`): a tile with no visible rail entry for the user is hidden |
| Rail of modules | `<app>/dock/<app>/<app>.json` (`Dock`, standard 1) | `Dock` with blank `user`: `IKON` order, rest `hidden` 1, title from `LABEL` |
| Module sidebar | `<app>/<module>/sidebar/<name>/<name>.json` (`Sidebar`) | `Custom Sidebar` with blank `user`: Home, then `SIDEBAR`, rest hidden |
| Module home | `Workspace` (standard, content blocks) | `Custom Workspace` (`PINTASAN`): shortcuts only (`BLOK_TETAP` empty: no number or link cards) |
| Per user | none | `User.block_modules` from the Module Profile (`MODUL_BOLEH`: Admin, User; Developer has none) |

- `Sidebar` and standard `Dock`/`Workspace` content refuse edits outside developer mode; that is why everything is a
  layer. A saved dock layer drops entries it does not name, so `_dok` names every entry.
- Short screens (Samuel, 2026-10-28): each home's shortcuts point at exactly its sidebar's links
  (`test_rumah_sama_dengan_sidebar`), taken from the guides' flows (`docs/panduan/`). Rail (Admin): Stock, Selling, Buying,
  Manufacturing, Projects, HR (`Shift & Attendance`, `LABEL`), Settings; User: Stock and Manufacturing. Accounts and Leaves have no
  icon: invoices and payments sit in Selling and Buying, leave in HR. Their modules stay allowed
  (`MODUL_TANPA_IKON`) with a short sidebar and home, for a page Frappe opens in its own module. Admin-only
  shortcuts go last, so a User's home (which drops what they cannot read) has no gap. Stock Reconciliation
  (opening stock and stock count) is under Settings ("Opening Stock & Stock Count"). `_baris_sidebar` skips a
  base Dashboard row named like a DocType (Project, Attendance).
- The HR home is our own site Workspace "HR" (`RUMAH_SENDIRI`, `_rumah_sendiri`: public, module Shift and
  Attendance, `PINTASAN["HR"]` written into it), first in the Shift & Attendance sidebar; a standard Workspace keeps
  its app's title and `Custom Workspace` has no title field. So the page title, breadcrumb and tab read "HR"
  ("SDM" in Indonesian). The base "Shift & Attendance" home is hidden in the sidebar; its route still opens.
- Our module `Planning` has no Dock entry or Sidebar and stays blocked in every Module Profile; its Sales History
  is in `SIDEBAR["Selling"]` and `SIDEBAR["Manufacturing"]`, Order Readiness in Manufacturing, and the Planning
  DocTypes and reports in `SIDEBAR["Manufacturing"]` and `PINTASAN["Manufacturing"]`: Production Entry (after Work
  Order), Plan vs Actual (after Order Readiness), Machine Capacity (after BOM); Reject Reason sits in Setup after
  Manufacturing Settings. The Planning module itself stays blocked.
- Production Floor (page `production-floor`, `lantai.md`) is the first link of Manufacturing's sidebar after Home and
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
- Three Role Profiles (`PROFIL_PERAN`): User, Admin, Developer. Admin holds the manager roles plus ERPNext's *User roles (`_PERAN_USER`, not `ERP User`)
  (Stock Manager alone reads neither Company nor Stock Balance in v16) and `PERAN_ADMIN` ("ERP Admin"). Every
  profile must read Company (`test_izin_per_profil`); `setup.IZIN_TAMBAHAN` gives Manufacturing User that read.
- User (Samuel, 2026-11-02) is Stock User plus `PERAN_USER` ("ERP User"): rail Stock and Manufacturing only (`IKON`,
  `MODUL_BOLEH`, no Accounts or Leaves). `PERAN_USER` holds Production Entry (its JSON), reads Machine Capacity,
  Reject Reason, Sales History (JSON; Order Readiness is built on it), Workstation, Price List and Account
  (`IZIN_TAMBAHAN`; a Delivery Note checks the customer's account), opens the Production Floor, Plan vs Actual and
  Order Readiness, and sets a machine's status through `production_floor.set_status` only. `batas_user.py`:
  Stock Entry `validate`/`before_cancel` allow a User only `TUJUAN_USER` (Material Receipt) unless the entry carries
  `FLAG_HASIL` (Production Entry's own Manufacture and Repack); the `has_permission` hook on `HANYA_ADMIN` keeps Stock
  User's other documents read only. Delivery Note without a Sales Order: `setup.PENGATURAN_ALUR` `so_required` No.
  Frappe resaves a changed profile's users in a background job; `_pengguna_profil` does it at migrate.
- Admin's rail adds `Setup`, shown as "Settings" (`LABEL`): users, Company, opening stock, the business settings and the reject reasons; its home is
  ERPNext's `Home` Workspace (`PINTASAN["Home"]`). System Settings and Build stay with System Manager: Frappe's own
  Apps tile (`check_app_permission`) shows for Developer only.
- User management: `setup.IZIN_TAMBAHAN` gives `ERP Admin` User read/write/create on permlevel 0 and 1 (roles sit on
  1). `pengguna.py` limits it: only roles in `PERAN_BOLEH_ADMIN` (Guest, All and Desk User pass; Administrator never does, though Frappe lists it in `AUTOMATIC_ROLES`), nothing that controls a Developer's or
  Administrator's access (`FIELD_AKSES`, roles, password, rename). Frappe's `populate_role_profile_roles` drops any
  role ticked outside a user's Role Profiles by itself. An Admin- or User-profile user never keeps the Employee role (neither
  profile has it; ERPNext adds it with an Employee record, hence its place in `PERAN_BOLEH_ADMIN`); HR Manager covers their attendance.
- Branding (`setup.MEREK`, `_pengaturan`): Website Settings `app_name`, `app_logo`, `splash_image`, `favicon` and
  Navbar Settings `app_logo` point at `/assets/erp_internal/images/` (public files, served through the
  `sites/assets` symlink, no build); System Settings `app_name` is "Delta Anugrah". Login uses `get_app_logo`
  (Website Settings first), the Apps screen top left Navbar Settings. `setup.LOGO` is `delta-anugrah.svg`, hand-drawn
  from the original JPEG; the PNGs (512 px logo, favicons) are rendered from it, the favicon stays PNG.
- App tiles and the rail's top slot: `tampilan.merek_aplikasi` (second `extend_bootinfo`, after `saring_aplikasi`)
  sets `app_title` from `NAMA_APLIKASI` (erpnext ERP, hrms HR, frappe System) and `app_logo_url` from
  `IKON_APLIKASI` (`public/images/aplikasi-*.svg`: Delta blue #1f4782 rounded square, white Lucide glyph, path data
  copied from lucide-static 1.47.0, ISC). The names are in `id.csv` and `test_layar_diterjemahkan`. The Delta logo
  stays on the navbar, login, splash and favicon only. Frappe's
  `workspace_payload` (the reply to a workspace saved from the desk) builds a fresh `app_data` without our hooks,
  so `hooks.override_whitelisted_methods` routes Frappe's five workspace writes (`new_page`,
  `update_workspace_settings`, `delete_page`, `set_workspace_module`, `restore_workspace_edits`) to
  `erp_internal/ruang_kerja.py`: Frappe's function runs unchanged, then `saring_aplikasi` and `merek_aplikasi` on
  the reply (`test_ruang_kerja`).
- Our CSS is one plain file, `public/css/erp_internal.css` (`hooks.app_include_css`, served as-is: no build, no
  `bench start` restart, only `clear-cache` after a hooks change). It gives the Apps screen avatar a pointer and
  keeps the sidebar's fold arrow visible on a desktop. Frappe v16.53 folds the module sidebar with that arrow
  (or the 8 px edge), but shows the arrow only on hover. Beside the pinned dock a folded sidebar slides shut and
  the dock stays as the rail; Frappe then parks the arrow half under the dock (z-index 1030), so our CSS moves
  it into the dock above the profile avatar as a 32 px button with border and shadow (`.sidebar-hidden`: left
  -45px, bottom 60px, z-index 1031; Abel 2026-10-29: the 24 px disc was too small). The choice is kept in
  localStorage `desk-sidebar-collapsed`. `cek_layar` folds, checks the folded arrow is >= 32 px and on top at its
  centre, reloads and reopens it for each user.
- `setup.IMPOR_BOLEH` (`_impor_boleh`) sets `allow_import` 1 on Stock Reconciliation so Data Import loads opening stock.
- `tools/cek_layar.mjs` opens each module home with `frappe.set_route("Workspaces", <name>)`, counts only message
  dialogs (`.msgprint-dialog`), and checks the rail of each tile on the user's Apps screen
  (`app_data[].on_apps_screen`), failing on a tile with nothing behind it. It also opens every home on the user's
  rail (`<profile>-home-<module>.png`): shortcuts only, at most `PINTASAN_MAKS` (12).
