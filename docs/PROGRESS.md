# Progress log

Newest first. One entry per working session: what changed, test results as run, what is next.

## 2026-10-28: Tasks 5, 6, 7 written, no site yet
- Task 5: `setup._alur_jual_beli()` (order-first selling and buying, no negative stock, FIFO, perpetual inventory
  off per factory, PPN accounts and templates, not default); `tests/test_alur_jual_beli.py` (5 tests);
  `tests/utils.py` `buat_pemasok`, `daftar_harga`, `stok_awal`; guides `docs/panduan/{penjualan,pembelian,gudang}.md`
  (no screenshots yet). Checked: `py_compile`, `ruff check`, `ruff format --check`; the settings fields, mapper
  paths and refusals read in the v16 source. Tests not run: no site yet.
- Task 6: `tests/utils.impor_csv`, `tests/test_impor.py` (4 tests), `tests/data/{barang,pelanggan,pemasok,stok_awal,
  barang_salah}.csv`, `docs/impor.md`. Headers built from v16's `exporter.py` (no site to download from); v16.53
  blocks a file with an unknown link before importing, so the wrong-file test reads `template_warnings`.
  Checked: `py_compile`, ruff. Tests not run: no site yet.

## 2026-10-27 (night): Tasks 2, 3, 4, 4b written, no site yet
- Task 2: `setup.pastikan_setup()` on `after_install`/`after_migrate` (System Settings, sign-up and OAuth
  registration off, Global Defaults, `Company.erp_jenis`, item groups, UOMs, factory warehouses);
  `tests/test_setup.py` (5 tests), `tests/utils.py`. The `wizard` part now sets Jenis and migrates.
  Checked: `py_compile`, `ruff check`, `ruff format --check`; every fieldname read in the v16 JSON under `apps/`.
  Tests not run: no site yet.
- Task 3: `tampilan.terapkan()`. v16.53 has no icon grid on the default Apps page, so the tables write site layers:
  a `Dock` layer per app (`IKON`), a `Custom Sidebar` per module (`SIDEBAR`), one Module Profile per bagian
  (`MODUL_BOLEH`) and the Role Profiles (`PROFIL_PERAN`). `tests/test_tampilan.py` (9 tests). Checked offline: the
  tables against the shipped dock/sidebar/DocPerm JSON, and the dock and sidebar layers merged with Frappe's own
  `resolve_layers`/`merged_arrangement` (all 8 sidebars and both docks as expected). Tests not run.
- Task 4: `translations/id.csv` (the plan's table plus our own strings), `bahasa.ganti` and the user-menu switch
  (`standard_navbar_items` in `hooks.py`, `public/js/erp_internal.bundle.js`); `tests/test_bahasa.py` (5 tests).
  Checked: every `_()`/`__()` string and menu label has a row (regex scan), `node --check`. Tests not run.
- Task 4b: full width by default (bundle), module homes as `Custom Workspace` (`PINTASAN`), shorter forms
  (`SEMBUNYI`, 89 fields on 10 forms), Company default warehouse and default Company permission
  (`setup._bawaan`), `tools/cek_layar.mjs` + `tools/package.json`. Checked offline: every `SEMBUNYI` field exists
  and is not required, every `PINTASAN` target exists except Order Readiness (Task 13), every stats filter
  evaluates in Node, every label has an `id.csv` row. Tests and `cek_layar` not run.
- Next: Abel runs `tools/setup_bench.sh sites wizard`; then `/run-checks` (all tests), fix what fails, then
  Task 5. `cek_layar` waits for `contoh.py`.

## 2026-10-27 (evening)
- Design and plan written; repo `delta-anugrah/erp-internal` created (private). `main` needs a PR, so work goes on
  branch `feat/lokal`.
- Revision 2: English UI by default with an Indonesian switch, full width, friendly screens.
- Revision 3: everything local first; Samuel's questions have defaults (`docs/menunggu-samuel.md`).
- Task 1 (`421bf7c`): MariaDB `erp-mariadb` on 3308, bench at `~/Desktop/Projects/erp-internal-bench` on the pinned
  v16 tags, app scaffolded and linked, `tools/setup_bench.sh`, setup-bench skill. Sites not created yet: `bench
  new-site` was refused by the permission check, so Abel runs `tools/setup_bench.sh sites wizard`. Tests not run.
