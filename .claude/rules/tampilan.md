---
paths: ["erp_internal/tampilan.py", "erp_internal/setup.py", "erp_internal/tests/test_tampilan.py", "tools/cek_layar.mjs", "erp_internal/contoh.py", "erp_internal/planning/**"]
---
# Navigation in Frappe v16.53 (what `tampilan.py` changes)

The desk is module-first. Desktop Settings stays on "Apps" (`_halaman_apps`): no Desktop Icon grid, no Desktop
Icon rows. What a user sees, and the site layer we write for each (never the app's own row):

| Surface | App's row (read only) | Our site layer |
|---|---|---|
| Apps screen | `add_to_apps_screen` hook (erpnext: any desk user; hrms: Employee read) | none |
| Rail of modules | `<app>/dock/<app>/<app>.json` (`Dock`, standard 1) | `Dock` with blank `user`: `IKON` order, rest `hidden` 1, title from `LABEL` |
| Module sidebar | `<app>/<module>/sidebar/<name>/<name>.json` (`Sidebar`) | `Custom Sidebar` with blank `user`: Home, then `SIDEBAR`, rest hidden |
| Module home | `Workspace` (standard, content blocks) | `Custom Workspace` (`PINTASAN`, Task 4b) |
| Per user | none | `User.block_modules` from the Module Profile (`MODUL_BOLEH`, one per bagian) |

- `Sidebar` and standard `Dock`/`Workspace` content refuse edits outside developer mode; that is why everything is a
  layer. A saved dock layer drops entries it does not name, so `_dok` names every entry.
- Our module `Planning` has no Dock entry or Sidebar and stays blocked in every Module Profile; its Sales History
  and Order Readiness are reached through `SIDEBAR["Selling"]` and `SIDEBAR["Manufacturing"]`.
- Blocking a module hides navigation only; DocPerm still decides document access.
- Keys are dock/sidebar names (`Shift & Attendance`), Module Profiles take Module Def names (`Shift and Attendance`).
- `Workspace Sidebar` and `Desktop Icon` are the retiring icon-grid batch (`frappe/desk/RETIRING.md`); don't use them.
- Reference code: `frappe/desk/doctype/{dock,sidebar,custom_sidebar,custom_workspace}/`, `frappe/desk/layers.py`.
