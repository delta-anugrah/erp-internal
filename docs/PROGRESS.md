# Progress log

Newest first. One entry per working session: what changed, test results as run, what is next.

## 2026-10-29 (Plan vs Actual, Task 1 of 6)
- Task 1 (`203969e` and a follow-up): DocType Machine Capacity (module Planning; Manufacturing Manager writes, Manufacturing User
  reads), `planning/kapasitas.py` (`kapasitas()` lookup: variant row, template + Jenis, template; `jenis_varian`,
  `RUNNER_DIGILING`, `runner_digiling()` for the form), sidebar and shortcut after BOM, 35 Indonesian rows,
  fixtures `buat_varian`/`buat_mesin`/`buat_kapasitas`. Material must be a stock item counted in Kg.
- Tests as run: `run-tests --app erp_internal`: 128 tests OK (123 + 5 in `test_kapasitas`).
- Next: Task 2, BOMs from capacity rows.

## 2026-10-28 (Production Floor, Tasks 1-7 of 7)
- Revision 1 (Abel, `dfcc7cf`, `e2bd3d7`): English route and endpoints, an info bar like BPT Live's, a liquid glass
  look. Tasks renumbered: 4 rename, 5 labels and panel, 6 info bar and glass, 7 navigation and docs.
- Task 1 (`87f6a48`, `3850564`; its hooks/setup/id.csv hunks landed in `89d75b8`): `erp_internal/lantai.py`
  `data()`, POST `ubah_status` (refuses an unnumbered machine before saving), `siarkan` (event `erp_lantai`, name
  only); `Work Order.erp_mesin` (Link Workstation, `link_filters` erp_nomor > 0). `test_lantai` 11 OK.
- Task 2 (`6741a41`..`b7a666a`): page `lantai-produksi`, `lantai.bundle.js` (three 0.160.0 from the root
  `package.json`), `public/js/lantai/adegan.js`; pauses on page hide, on a hidden tab, and when left before it mounts.
- Task 3 (`fa3d01e`, `0c22390`): `public/js/lantai/mesin.js`, 14 instanced machines (10 draw calls, 14,394
  triangles), status lamps and platen motion per the spec, adaptive quality, a plain table without WebGL or bundle.
  Perf gate reworked (spec and plan amended): ≥ 57 fps, ≤ 1 % frames over 25 ms, max ≤ 50 ms, 0 long tasks; the old
  p95 ≤ 18.5 ms sat on Chrome's rAF noise floor (an empty canvas measures 18.6).
- Tests: `run-tests --app erp_internal` 118 OK; `node tools/lantai.mjs` all cases OK twice (60.0 fps, 0 dropped,
  max 21.2 ms).
- Task 4 (`2b85bf9`): English public names. `erp_internal/production_floor.py` `get_data()`, POST
  `set_status(machine, status)`, event `production_floor`; page `production-floor`; the old Page `lantai-produksi` is
  deleted on migrate (names above are the pre-rename ones). `test_production_floor` 11 OK, suite 118 OK.
- Task 5 (`09da58b`, `f0578e4`): `public/js/lantai/label.js` (labels by textContent, text written once the camera
  rests 120 ms) and `panel.js` (details, Work Order link, six status buttons posting `set_status`, inline refusal
  note, bottom sheet under 760 px); a 700 ms camera flight to the clicked machine; live updates (realtime
  `production_floor` + `doctype_subscribe("Workstation")`, 250 ms debounced full refetch, 60 s poll, `?poll=<s>` for
  tests, nothing fetched while the page or tab is hidden, catch-up on return). `lantai.mjs` cases label, pilih,
  status, wo, xss, set_value, poll, live, id, hidden: all OK; perf 60.0 fps, 0 dropped, max 20.0 ms, 10 draw calls.
- Task 6 (`434f1d8`, `9664463`): `hud.js` (top bar with the company logo and name, live dot, 1 s clock, KPI cards,
  collapsible machine table whose rows select, +/−/home camera bar) and `kaca.js` (liquid glass, light/dark);
  `get_data()` gained `perusahaan`. Labels are glass without blur (14 moving blurred labels broke the dropped-frame
  gate) and label, clock and bar text wait for the camera to rest (a text write during a drag stalls Chrome 50-100 ms);
  without glass support the cards turn solid. `lantai.mjs` cases hud, hud-live, hud-xss, glass added.
- Task 7: Production Floor is the first link of Manufacturing's sidebar and home (`tampilan.SIDEBAR`/`PINTASAN`/`NAMA_LINK`,
  `test_production_floor_in_manufacturing`); `cek_layar.mjs` checks the link, the shortcut and the way back (it now
  stays under `/desk/manufacturing/`, no more `/desk/accounts/`); `.claude/rules/lantai.md`, a section in
  `docs/panduan/produksi.md` with `docs/panduan/gambar/produksi-1.png` (`panduan_gambar.mjs produksi-1`), README,
  CLAUDE.md, the spec's two accepted deviations.
- Image: `docker build -f deploy/Containerfile -t erp-internal:uji .` exit 0, `deploy/check_image.sh erp-internal:uji` OK
  (lantai.bundle.js included).
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal` 122 OK; `node tools/cek_layar.mjs` 3 users OK;
  `node tools/lantai.mjs` all cases OK (perf 59.8 fps, 0.41 % frames over 25 ms, max 36.3 ms, 0 long tasks, 10 draw
  calls, 14,394 triangles; adaptive: pixel ratio 1 after 2.4 s).
- Fix rounds: no empty strip when returning to the floor (a `ResizeObserver` on the page body and sidebar calls
  `fit()`; `lantai.mjs strip` delays the sidebar hide 1.2 s and fails without the observer); review fixes: the
  nudge has an empty payload and skips non-machine Workstations, `set_status` answers a missing and a forbidden
  machine alike, the company name needs read on that Company, page roles Manufacturing User only.
- Final review fixes (commit `fix(lantai): nudge on Work Order progress, resubscribe after reconnect, empty and failed
  floor notes`): Work Order hook is `on_change` (ERPNext sets `produced_qty` and status with `db_set`, which fires only
  that); the nudge goes to the `doctype:Workstation` room (`publish_realtime(doctype=...)` without a docname had been
  broadcasting to every System User, so the subscription did nothing), and the page re-joins it on each socket
  `connect` and in `lanjut()`; an inline note for a failed first load and for an empty floor; the open panel writes a
  node only when its text changed and waits for the camera to rest, `aria-live` moved to the chip and the note; id.csv
  "Live" = "Live"; `states` waits for the lamps' easing instead of a fixed delay; `test_bahasa` skips built bundles
  (a minified three.js has `_("x","y",...)` calls the scanner read as messages after a production `bench build`).
  Tests: `run-tests --app erp_internal` 123 OK; `node tools/lantai.mjs` all cases OK incl. new `reconnect`, `notes`,
  `panel-quiet` (perf 485 frames, 60.0 fps, 2 dropped = 0.41 %, max 30.6 ms, 0 long tasks, 10 draw calls; adaptive
  pixel ratio 1 after 2.4 s); `node tools/cek_layar.mjs` 3 users OK. Abel: restart `bench start` (hooks.py changed).
- Next: Abel looks at the floor in his Chrome (smoothness), adds `erp.localhost` to `/etc/hosts`, restarts `bench start`;
  security review and docs sync of the whole feature; then review and merge.

## 2026-10-28 (Samuel's real master data: catalog and machines)
- `erp_internal/master.py` `muat()` reads `erp_internal/data/katalog.json` (price list "POLA PLASTIK TAHUN 2026",
  Dinda House Ware, 20 products) and `data/mesin.json` (14 machines), idempotent (`docs/impor.md`).
- Items: one template per product in Barang Jadi, brand Dinda House Ware, attributes Jenis/Warna (Ukuran for
  Toples Dinda), only the listed combinations; Sendok Makan split into `SENDOK-MAKAN-PACK` (stock Pack) and
  `SENDOK-MAKAN` (Pcs). Stock UOM Pcs, Lusin 12, Gross 144, Ball/Dus/Ikat per variant from the packing text; four
  "per ball" packings taken from the price ratio (noted). 21 templates, 84 variants.
- Price List `Harga Pola 2026` (selling, IDR): 157 Item Prices. Garpu Makan has none.
- Workstations `Mesin 01`..`14`, type Injection Moulding, custom fields `erp_nomor` (floor order), `erp_merek`,
  `erp_model`, `erp_tonase`, `erp_tahun`, `erp_negara` (`setup.FIELD_MESIN`).
- `setup.py`: UOMs Gross, Ball, Dus, Ikat, Pack; Item Variant Settings `allow_different_uom` 1
  (`PENGATURAN_VARIAN`, `_varian`). `id.csv`: the machine field labels.
- `erp.localhost`: migrate, `muat` twice (282 records written, then 0). Tests: `test_master` 8 OK; full run
  13 unit + 107 integration OK. ruff check/format clean.

## 2026-10-28 (avatar pointer, sidebar fold arrow)
- The sidebar toggle was there but hidden: Frappe v16.53 shows the fold arrow only while the pointer is on
  the panel's 8 px edge (BPT's older Frappe has a "Collapse" button instead). `public/css/erp_internal.css`
  (`app_include_css`, a plain file: no build, no restart) keeps the arrow visible on a desktop and gives the
  Apps screen avatar a pointer. `cek_layar` checks the avatar cursor and, per user, folds the sidebar, reloads
  (still folded) and reopens it: 3 users OK.

## 2026-10-28 (HR home title, workspace saves keep the tiles)
- HR home: our own site Workspace "HR" (`tampilan.RUMAH_SENDIRI`, `_rumah_sendiri`), first in the Shift &
  Attendance sidebar. Page title, breadcrumb and browser tab read "HR" ("SDM" in Indonesian). Route
  `/desk/shift-and-attendance/hr`; the old home's route still opens. `test_rumah_hr`.
- `erp_internal/ruang_kerja.py` + `hooks.override_whitelisted_methods`: Frappe's five workspace writes run, then our
  tile layers on their `app_data`. Checked in the browser as user@ (private workspace saved and deleted: ERP and HR
  with our icons both times). `test_ruang_kerja`.
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal`: 13 unit + 99 integration, OK.

## 2026-10-28 (short screens; sample users on @example.com)
- Sample users are `developer@`, `admin@`, `user@example.com` (`contoh.surel`, tests, tools, docs). On
  `erp.localhost` the three were renamed with `rename_doc` (Employee links follow); no `@contoh.test` user is left.
- Samuel found the module homes far too long. `tampilan.py`: the rail is Stock, Selling, Buying, Manufacturing,
  Projects, HR (`Shift & Attendance`, label) and Settings (Admin); Accounts and Leaves lost their icons (modules
  still allowed: `MODUL_TANPA_IKON`). Homes are shortcuts only (`BLOK_TETAP = ()`: no number or link cards) and
  equal their sidebars (`test_rumah_sama_dengan_sidebar`, `test_rel_pendek`). Payment Entry moved into Selling,
  Order Readiness only in Manufacturing, Sales Order Analysis gone, Stock Reconciliation under Settings as
  "Opening Stock & Stock Count", leave and holidays in HR. `_baris_sidebar` no longer picks the Project and
  Attendance dashboards for the DocType links. The list per module is in README "Screens".
- Guides updated (absen, gudang, produksi, admin menu paths); `panduan_gambar` retook the 6 pictures.
  `cek_layar` now screenshots every home on each user's rail and fails on a non-shortcut widget or more than 10.
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal`: 13 unit + 95 integration, OK; ruff clean;
  `migrate` on both sites. `cek_layar`: 3 users OK (20 home screenshots). No JS/CSS build.

## 2026-10-28 (SVG logo, app tiles renamed)
- `delta-anugrah.svg`: the mark redrawn by hand (one outline, dark 14-unit edge under the blue fill, colours sampled
  from the JPEG: #1f4782, #111216), compared rendered against the JPEG (shape off by under 1 % of pixels). The
  512 px PNG and both favicons are rendered from it (cairosvg via uvx). `setup.LOGO` points at the SVG.
- `tampilan.merek_aplikasi` (`extend_bootinfo`): tiles named ERP, HR, System (id: ERP, SDM, Sistem), each with its
  own icon (Delta-blue rounded square, white Lucide glyph: factory, users, settings; `aplikasi-*.svg`), also on the
  rail's top slot. `test_merek_aplikasi`; `cek_layar` checks each tile's name and icon and the rail's top icon.
- No JS/CSS changed, no build.

## 2026-10-28 (Delta Anugrah logo)
- `erp_internal/public/images/`: the original `delta-anugrah.jpeg` (200 px), a transparent trimmed
  `delta-anugrah.png` (168 px, Pillow via uvx) and `favicon-32.png`, `favicon-192.png`.
- `setup.MEREK` (Website Settings app_name, app_logo, splash_image, favicon; Navbar Settings app_logo) and System
  Settings `app_name` "Delta Anugrah", set in `_pengaturan` on every migrate, saved only on a difference;
  `test_setup.test_merek`.
- Browser (Playwright, developer@): logo on /login, top left of the Apps screen, splash, favicon on login and desk,
  no dialog, page styled. Inside a module the rail's top slot keeps ERPNext's logo (Frappe's per-app mark).
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal`: Ran 91 tests, OK. `uvx ruff check`,
  `uvx ruff format --check`: clean. `migrate` on both sites.
- No JS/CSS changed, no build. Next: a sharper source file from the designer (TODO).

## 2026-10-28 (Revision 4: one company, three roles)
- Samuel's answers (Abel confirmed): one company (PT Delta Anugrah), roles Admin and User (plus Developer), no PKP.
- Code: `Company.erp_aktif` replaces `erp_jenis`, every ticked company gets the factory and the office
  (`setup.perusahaan()`); `tampilan.PROFIL_PERAN` is Developer, Admin, User, Admin's rail adds Setup ("Settings":
  users, Company, business settings); new role `ERP Admin` with User rights (`setup.IZIN_TAMBAHAN`, now
  (doctype, role, permlevel, rights)); new `erp_internal/pengguna.py` keeps an Admin to Admin and User roles and off
  Developer accounts; `proyek.PERAN_ATASAN` is Admin and Developer; `contoh.py` one company, users `developer@`,
  `admin@`, `user@example.com`; `tools/setup_bench.sh` ticks `erp_aktif`.
- Reviewer (general-purpose agent with `.claude/agents/reviewer.md`): no privilege escalation found; fixed
  `setup_bench.sh`, HR saving an Employee linked to a Developer (only access fields are refused now,
  `pengguna.FIELD_AKSES`), a new User under a Developer's name (`cek_user_awal`), `buat_pengguna` clearing
  `block_modules`; added tests for those paths, an unticked company and an Admin submitting someone's timesheet.
- Dev sites: one-off script (not in the repo) on `erp.localhost` deleted PT Contoh Kantor and its sample records,
  the seven `<bagian>@example.com` users, the seven old Role and Module Profiles and the `erp_jenis` field; on
  `erp-test.localhost` only the field. Then `migrate` on both and `buat_contoh` twice on `erp.localhost` (same
  counts both runs: Company 1, User 3, Employee 5, ...).
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal`: 13 unit + 89 integration, all OK.
  `uvx ruff check erp_internal`, `uvx ruff format --check erp_internal`: clean. No JS/CSS changed, no build.
- Browser: `node tools/cek_layar.mjs`: 3 users OK; `node tools/panduan_gambar.mjs`: 6 screenshots retaken as
  `user@` (Purchase Order without a PPN template).
- Docs: CLAUDE.md, README, `.claude/rules/tampilan.md`, guides (who does what; new `docs/panduan/admin.md`), plan
  Revision 4, spec note, TODO, `menunggu-samuel.md`, `deploy/server/README.md` step 8.
- Next: Abel's manual checks in TODO (Admin refused when giving Developer), Task 7 drill, go-live with PT Delta
  Anugrah.


## 2026-10-28 (first run on the sites)
- Tests: `bench --site erp-test.localhost migrate`, then `bench --site erp-test.localhost run-tests --app
  erp_internal`: 13 unit + 77 integration tests, all OK (run 5 of the day; first run 25 ran, 17 failed).
  Per module: absen 5, alur_jual_beli 5, alur_produksi 2, bahasa 6, contoh 5, forecast 9, impor 4,
  order_readiness 9, proyek 5, rumus 13, sales_history 5, setup 7, situs 2, tampilan 13.
- Code fixes: `before_tests` hook completes the test site's wizard (Frappe runs only the tested app's hook);
  `setup.IMPOR_BOLEH` lets Data Import take Stock Reconciliation; Gudang has Stock User and Manufacturing User
  reads Company (`IZIN_TAMBAHAN`); `tampilan.saring_aplikasi` (`extend_bootinfo`) hides an Apps screen tile with
  nothing on the user's rail (HR's ERPNext tile opened a blocked module); `tests.utils.buat_pengguna` saves only
  on a change, so a `buat_contoh` rerun writes nothing.
- Test fixes (expectations wrong for v16): amended copy's docstatus, `selected_items` rows in Sales Forecast Item,
  shift times as `timedelta`, the Employee role needs an Employee record, a Karyawan's own-Employee permission
  refuses another's timesheet at insert, Sales History test rows committed by the importer.
- `erp.localhost`: migrated, `bench build --app erp_internal`, `erp_sandi_contoh` set (password only in the
  bench's `.env` as `SAMPLE_PASSWORD`), `buat_contoh` run twice: the second run changed no row in any table.
- `node tools/cek_layar.mjs` (Playwright 1.49.1, Chromium installed): 7 bagian OK, 21 screenshots in
  `tools/hasil/` checked (full width, only the bagian's rail and Apps screen, no message dialog). Script fixes:
  open the module home by its Workspace, count only message dialogs, check Apps screen tiles.
- Dry runs of the go-live tasks 8, 14 and 17 on `erp.localhost` (results in the plan under each task): imports
  through the worker, the PPN switch, an order to payment as Penjualan, Fill from History → MPS → MRP → Work Order
  as Produksi, Order Readiness checked by hand for 5 products, employee import, check-in, auto attendance,
  a timesheet as Karyawan. Not run: Task 7's compose boot, backup and restore drill (needs the root password).
- Next: Abel runs Task 7 Steps 2-4, takes the guide screenshots, tries the buttons in the browser and a phone
  check-in.

## 2026-10-28 (security fixes)
- 731d843: Order Readiness checks Company read, and the Warehouse's company and read, before reading Bin, Sales
  Order and Work Order (2 new tests).
- 4e815e4: `erp_internal/proyek.py`, Timesheet `before_submit`: an Employee submits only their own timesheet
  (`test_timesheet_orang_lain_ditolak`).
- Tests not run: no site yet.

## 2026-10-28 (evening): Tasks 15, 16 and the sample data, no site yet
- Task 15: `setup._kantor()` (HR Settings mobile check-in and geolocation on; shift "Kantor" 08:00-17:00 with auto
  attendance from `SHIFT_KANTOR`; per office company "Libur <abbr> <year>" for this year and next, Saturday and
  Sunday off, with a submitted company Holiday List Assignment, which v16 HRMS reads instead of the company default;
  leave types Cuti Tahunan 12, Sakit, Izin unpaid); `tests/test_absen.py` (5 tests); `buat_karyawan`,
  `penugasan_shift`, `jatah_cuti`; `docs/panduan/absen.md`. Tests not run: no site yet.
- Task 16: `setup._proyek()` (Activity Types Pengembangan, Rapat, Dukungan Klien, Administrasi without rates; the
  Employee role may submit Timesheets, `IZIN_TAMBAHAN`); `tests/test_proyek.py` (5 tests, incl. the own-timesheet guard, 4e815e4); `docs/panduan/proyek.md`.
  Tests not run.
- Revision 3 item 4: `erp_internal/contoh.py` `buat_contoh()` (both sample companies, 9 items with BOMs, lead
  times and stock, 3 customers, 2 suppliers, 6 months of Sales History, 4 open orders, 7 users, 5 employees on the
  shift with annual leave, one project with 3 tasks; tag DATA CONTOH; refused with `erp_produksi`, needs
  `erp_sandi_contoh`); `tests/test_contoh.py` (5 tests). Not run on any site.
- Checked without a site: `uvx ruff check`, `ruff format --check`, `py_compile`; imports with the bench's Python;
  every fieldname and Select value against the v16 JSON (Shift Type, HR Settings, Leave Type, Holiday List,
  Holiday List Assignment, Activity Type, Timesheet); `process_auto_attendance`, Employee Checkin, Leave
  Application and Timesheet read in the source; the tests' date helpers for every weekday; Frappe's
  `extract_messages_from_python_code`/`_javascript_code` find an `id.csv` row for every string of the app.
- Next: Abel creates the sites; `/run-checks`; `buat_contoh` on `erp.localhost`; `cek_layar`.

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
  History, JS colours and Indonesian statuses by context); `tests/test_order_readiness.py` (9 tests, incl. 2 permission tests, 731d843),
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
