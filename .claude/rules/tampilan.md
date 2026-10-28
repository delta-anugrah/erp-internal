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
| Module home | `Workspace` (standard, content blocks) | `Custom Workspace` (`PINTASAN`, Task 4b) |
| Per user | none | `User.block_modules` from the Module Profile (`MODUL_BOLEH`: Admin, User; Developer has none) |

- `Sidebar` and standard `Dock`/`Workspace` content refuse edits outside developer mode; that is why everything is a
  layer. A saved dock layer drops entries it does not name, so `_dok` names every entry.
- Our module `Planning` has no Dock entry or Sidebar and stays blocked in every Module Profile; its Sales History
  and Order Readiness are reached through `SIDEBAR["Selling"]` and `SIDEBAR["Manufacturing"]`.
- Blocking a module hides navigation only; DocPerm still decides document access.
- Keys are dock/sidebar names (`Shift & Attendance`), Module Profiles take Module Def names (`Shift and Attendance`).
- `Workspace Sidebar` and `Desktop Icon` are the retiring icon-grid batch (`frappe/desk/RETIRING.md`); don't use them.
- Reference code: `frappe/desk/doctype/{dock,sidebar,custom_sidebar,custom_workspace}/`, `frappe/desk/layers.py`.
- Three Role Profiles (`PROFIL_PERAN`): User, Admin, Developer. Admin holds the manager roles plus the User roles
  (Stock Manager alone reads neither Company nor Stock Balance in v16) and `PERAN_ADMIN` ("ERP Admin"). Every
  profile must read Company (`test_izin_per_profil`); `setup.IZIN_TAMBAHAN` gives Manufacturing User that read.
- Admin's rail adds `Setup`, shown as "Settings" (`LABEL`): users, Company and the business settings; its home is
  ERPNext's `Home` Workspace (`PINTASAN["Home"]`). System Settings and Build stay with System Manager: Frappe's own
  Apps tile (`check_app_permission`) shows for Developer only.
- User management: `setup.IZIN_TAMBAHAN` gives `ERP Admin` User read/write/create on permlevel 0 and 1 (roles sit on
  1). `pengguna.py` limits it: only roles in `PERAN_BOLEH_ADMIN`, nothing that controls a Developer's or
  Administrator's access (`FIELD_AKSES`, roles, password, rename). Frappe's `populate_role_profile_roles` drops any
  role ticked outside a user's Role Profiles by itself. An Admin-profile user never keeps the Employee role (the
  profile drops it); HR Manager covers their attendance.
- `setup.IMPOR_BOLEH` (`_impor_boleh`) sets `allow_import` 1 on Stock Reconciliation so Data Import loads opening stock.
- `tools/cek_layar.mjs` opens each module home with `frappe.set_route("Workspaces", <name>)`, counts only message
  dialogs (`.msgprint-dialog`), and checks the rail of each tile on the user's Apps screen
  (`app_data[].on_apps_screen`), failing on a tile with nothing behind it.
