# Progress log

Newest first. One entry per working session: what changed, test results as run, what is next.

## 2026-10-28 (later): Part B, Tasks 9-13, no site yet
- Task 9: DocType `Sales History` (module `Planning`), unique per company, item and month (validate +
  `unik_riwayat` constraint); `tests/test_sales_history.py` (5 tests), `tests/data/riwayat.csv`, `docs/impor.md`
  section 5. Checked: `ruff check`, `ruff format --check`, `py_compile`, JSON valid, offline scan that every label,
  role and `_()` string has an `id.csv` row. Tests not run: no site yet.
- Task 10: `planning/rumus.py` (`bulan_acuan`, `rata_rata`, `bulatkan`, `ada_riwayat`), `tests/test_rumus.py`.
  Run with the bench's Python and no site (`frappe.local.session` stubbed): 6 tests OK.
- Task 11: `planning/forecast.py` (`qty_per_bulan`, `isi`, `isi_dari_riwayat`), the "Fill from History" button
  (`public/js/sales_forecast.js`, `doctype_js`), `tests/test_forecast.py` (9 tests), `buat_order`,
  `buat_perkiraan`, `akar_gudang`. Checked: ruff, `py_compile`, `node --check`, import with the bench's Python,
  translation scan. Tests and the button not run: no site yet.
- Task 12: `setup._produksi()` (Company default WIP/FG/scrap warehouses per factory, backflush by BOM, Item Group
  default warehouses), `tests/test_alur_produksi.py` (2 tests: defaults, forecast → MPS → MRP → Work Order →
  stock), `buat_bom`, `lama_produksi`, `docs/panduan/produksi.md`. v16 differences: the WO defaults live on
  Company, and the MRP report spreads a monthly forecast over daily rows (test sums them). Tests not run.
- Task 13: `rumus.STATUS`, `hitung_kurang`, `hitung_jadwal`; Script Report `Order Readiness` (ref doctype Sales
  History, JS colours and Indonesian statuses by context); `tests/test_order_readiness.py` (7 tests),
  `test_tampilan.test_izin_order_readiness`. `tests/test_rumus.py`: 13 unit tests OK without a site. Checked:
  ruff, `compileall`, `node --check`, JSON, Frappe's own extractors find a row for every string, the spec's
  lead time (`get_own_lead_time` 870 / 200 + 1 = 5.35). Integration tests not run: no site yet.
- Next: Abel creates the sites; run every test (`/run-checks`), fix what fails, `bench build`, try Fill from
  History and Order Readiness in the browser; then `contoh.py`.

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
- Task 7: `deploy/Containerfile`, `deploy/check_image.sh`, `.github/workflows/image.yml`, `.dockerignore`,
  `deploy/server/{docker-compose.yml,.env.example,cadangan.sh,README.md}`. `docker build` passed locally (arm64,
  ~20 min, 5.43 GB) and `check_image.sh` printed OK with the three pinned tags. `docker compose config` and
  `shellcheck` clean; `cadangan.sh` dry run with a stub docker and a local rclone remote passed. Not run: compose
  boot, real backup and restore drill (need `new-site`, i.e. a database root password).
- Next: Abel creates the sites; run every test; fix what fails; then Task 8's local dry run.

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
