# ERP Internal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ERPNext v16 for Samuel's plastic factory (stock, sales, purchasing, production with a monthly forecast and
a "Siap Order" view) and our office (attendance, projects), showing only the modules in use.

**Architecture:** Stock Frappe/ERPNext/HRMS v16 plus one custom Frappe app, `erp_internal`. On every migrate the app
sets up the site: locale, hidden modules, roles and defaults. It also adds three things ERPNext lacks: sales
history, the forecast fill, and the Siap Order report. One site holds two companies. Production runs a pinned Docker
image on its own server.

**Tech Stack:**
- Frappe v16.53.0, ERPNext v16.52.1, HRMS v16.52.0;
- Python 3.14, Node 24, MariaDB 11.8.9, Redis;
- Docker (frappe/build and frappe/base v16 images), GitHub Actions + GHCR, rclone for off-site backups.

**Spec:** `docs/superpowers/specs/2026-10-27-erp-internal-design.md`. Until Task 1 moves it, it is at
`~/.claude/plans/2026-10-27-erp-internal-design.md`. Section numbers (§) below refer to the spec.

## Revision 2 (Abel, 2026-10-27 23:00): read this first, it overrides the text below

1. **The UI is English by default, and each user can switch to Indonesian.**
   - System Settings `language` is `en`, not `id`. Number, date, time zone and currency stay Indonesian.
   - All our own UI text is English source wrapped in `_()` (Python) and `__()` (JS). The Indonesian goes in
     `erp_internal/translations/id.csv`.
   - Every Indonesian string quoted in this plan is the `id.csv` translation of an English source. Messages, the
     button, the report statuses and the column labels are written in English in the code.
2. **Renames.** Wherever the plan says the left name, use the right one. The right side is English; the
   Indonesian goes in `id.csv`.

   | Plan says | Use (English) | `id.csv` |
   |---|---|---|
   | DocType `Riwayat Penjualan` | `Sales History` | Riwayat Penjualan |
   | module `Perencanaan`, folder `perencanaan/` | `Planning`, `planning/` | Perencanaan |
   | report `Siap Order`, folder `siap_order/` | `Order Readiness`, `order_readiness/` | Siap Order |
   | button "Isi dari Riwayat" | "Fill from History" | Isi dari Riwayat |
   | statuses Telat / Mulai minggu ini / Isi lama produksi / Terjadwal / Aman | Late / Start this week / Set lead time / Scheduled / OK | (left side) |
   | messages in Tasks 9 and 11 | "Qty cannot be negative.", "Item {0} is not a stock item.", "Sales history for {0} in {1} already exists.", "Fill from History works only on a draft monthly Sales Forecast.", "Select the items first.", "Filled from the average of {0}.", "No history yet: {0}. Enter their numbers by hand." | Indonesian of each |

   Python and JS identifiers stay Indonesian (`rumus`, `isi`, `hitung_kurang`, …), like bpt.
3. **Task 4 becomes "Language: English default, Indonesian switch".** It keeps `id.csv` (the table of ERPNext
   labels, plus every string of ours) and adds:
   - `erp_internal/bahasa.py`: `@frappe.whitelist() ganti(lang: str) -> None`. It sets the caller's own
     `User.language` to `en` or `id`, refuses any other value and Guest, then clears that user's cache.
   - A user-menu item, "Bahasa Indonesia" or "English" depending on the current one, in
     `public/js/erp_internal.bundle.js` (`app_include_js`). It calls `ganti` and reloads the page.
   - Tests:
     - `test_ganti_bahasa`: a Gudang user switches to `id` and back;
     - `test_bahasa_lain_ditolak`: `fr` raises `frappe.ValidationError`;
     - `test_semua_teks_kita_diterjemahkan`: every message from
       `frappe.translate.get_messages_for_app("erp_internal")` has a row in `id.csv`;
     - the label test from the original Task 4.
4. **New Task 4b: friendly screens** ("usahakan semuanya user friendly"; it runs between Task 4 and Task 5).
   - **Full width by default.** In the bundle, when `localStorage.container_fullwidth` is unset, set it to
     `"true"` and call `frappe.ui.toolbar.set_fullwidth_if_enabled()`. Frappe v16 toolbar.js reads that key;
     users can still toggle it off.
   - **Each kept module opens on its home page.** The first sidebar item stays the module's Workspace ("Home": v16
     sidebars start with `Link | Workspace | <module>`), so `tampilan.SIDEBAR` keeps it first. Each Workspace's
     shortcuts are set in a `tampilan.PINTASAN` table:
     - Stock: New Stock Entry, Stock Reconciliation, Stock Balance, Item;
     - Selling: New Sales Order, open Sales Orders (count), Delivery Note, unpaid Sales Invoices (count), Order
       Readiness;
     - Buying: pending Material Requests (count), New Purchase Order, Purchase Receipt, Purchase Invoice;
     - Manufacturing: Order Readiness, Sales Forecast, Master Production Schedule, the MRP report, Work Orders in
       process (count), Item Lead Time;
     - Projects: open Projects, my open Tasks, New Timesheet;
     - Shift & Attendance: today's Attendance, Employee Checkin, Employee;
     - Leaves: New Leave Application, Leave Applications to approve (count).

     Charts and onboarding are removed from these Workspaces.
   - **Shorter forms.** A `tampilan.SEMBUNYI` table of Property Setters (`hidden` 1) covers the fields and sections
     of unused features on Item, Customer, Supplier, Sales Order, Delivery Note, Sales Invoice, Purchase Order,
     Purchase Receipt, Work Order and Employee. That means accounting dimensions (cost center, project on factory
     documents), website, loyalty, sales team and commission, coupons, inter-company, auto repeat, quality
     inspection, assets, deferred accounting and shipping rule. The builder picks the fieldnames by walking each
     form.
   - **Defaults so nobody picks twice.** Stock Settings `default_warehouse` is the factory's Gudang Barang Jadi.
     Every user's Company permission has `is_default` 1.
   - Tests:
     - `test_sembunyi_aman`: every field in `SEMBUNYI` exists, and none is `reqd` without a default;
     - `test_pintasan`: each Workspace's shortcuts equal `PINTASAN`.
   - Browser check `tools/cek_layar.mjs` (Playwright, devDependency in `tools/package.json`). As each bagian user,
     open the desktop, the module home and one form. Assert:
     - `document.body.classList.contains("full-width")`;
     - only that bagian's icons show;
     - no console error and no error dialog.

     Save screenshots to `tools/hasil/`, which is gitignored.
   - Commit `feat(tampilan): full width, module home pages, shorter forms, defaults`.
   - Status (2026-10-27): [x] tests written, [x] implemented, [x] `tools/cek_layar.mjs` and `tools/package.json`
     written, [x] committed; [ ] tests and `cek_layar` run (not run: no site yet, and `cek_layar` also needs the
     sample users of `contoh.py`).
   - Deviations, read from the v16.53 source:
     - Stock Settings has no `default_warehouse` in v16; the default warehouse is `Company.default_warehouse`.
       `setup._bawaan()` sets it to Gudang Barang Jadi for each Pabrik company, and turns a user's only Company
       permission into their default (`test_gudang_bawaan`, `test_izin_perusahaan_jadi_bawaan`).
     - A standard Workspace's content refuses edits outside developer mode. `PINTASAN` is written as a
       `Custom Workspace` per module home (Frappe's site delta): our shortcut blocks, then the page's number and
       link cards; charts and onboarding go. The Accounts home ("Accounting") is not in `PINTASAN`.
     - `Order Readiness` stays in `PINTASAN` but shows only once its Report exists (Task 13):
       `tampilan.pintasan_aktif()`. The MRP report's shortcut is labelled "MRP".
     - `SEMBUNYI` (fieldnames read from each form's JSON): Item (assets, deferred accounting, quality inspection,
       commission), Customer (website, loyalty, sales partner and team), Supplier (website), Sales Order and
       Delivery Note (accounting dimensions, project, shipping rule, coupon, inter-company, commission, sales team,
       auto repeat), Sales Invoice (the same plus loyalty and subscription), Purchase Order and Purchase Receipt
       (accounting dimensions, project, shipping rule, inter-company, auto repeat), Work Order (project), Employee
       (the Salary tab: payroll is not used). UTM fields are left alone.
     - New `test_layar_diterjemahkan` (test_bahasa): every shortcut label, count format and `LABEL` has an
       `id.csv` row.
     - `cek_layar.mjs` checks the rail through `frappe.boot.dock` and `frappe.boot.module_sidebars` (there are no
       desktop icons), signs in through `/api/method/login` with `ERP_SANDI`, and opens the form with
       `frappe.new_doc`. Playwright is pinned at 1.49.1.
5. **Task 1 changes, because the repo already exists.**
   - The repo `~/Desktop/Projects/erp-internal` (GitHub `delta-anugrah/erp-internal`, private) was
     created on 2026-10-27 with these docs.
   - In Step 4, run `bench new-app erp_internal --no-git` inside the bench. Copy the generated files into the repo
     (`rsync -a --ignore-existing apps/erp_internal/ ../erp_internal/`), delete `apps/erp_internal`, then symlink it
     to the repo.
   - Step 5's wizard language is English.
   - Step 9 pushes to `origin main`.
6. Task 2: `PENGATURAN_SISTEM["language"]` is `"en"`. Task 2's test asserts `en`.
7. User guides (`docs/panduan/*.md`) stay in plain Indonesian for the staff. They name the buttons as the English
   UI shows them.

## Revision 3 (Abel, 2026-10-27 23:10): local first, Samuel's answers later

1. **Paths.** The repo is `~/Desktop/Projects/erp-internal` and is the app root itself (`pyproject.toml`,
   `erp_internal/` package). The bench is `~/Desktop/Projects/erp-internal-bench`, with `apps/erp_internal`
   symlinked to the repo and `.env` inside it. `tools/setup_bench.sh` reads `$ERP_BENCH/.env`, where `ERP_BENCH`
   defaults to `~/Desktop/Projects/erp-internal-bench`. Task 1 Step 4: run `bench new-app erp_internal --no-git` in
   the bench, `rsync -a --ignore-existing apps/erp_internal/ ~/Desktop/Projects/erp-internal/`, remove
   `apps/erp_internal`, then symlink.
2. **Everything runs locally first.**
   - Build every code task (1–7, 4b, 9–13, 15–16) on the dev sites.
   - The go-live tasks 8, 14 and 17 wait. For now each one only gets a local dry run: the same steps on
     `erp.localhost` with sample data marked DATA CONTOH.
   - Task 7 builds and tests the image and the compose stack locally. There is no real server yet.
3. **None of Samuel's answers blocks the local build.** These defaults are used until he answers. Each one is easy
   to change later:

   | Question (design §12) | Default until he answers | Where it changes later |
   |---|---|---|
   | 1 company names | PT Contoh Plastik (CPL), PT Contoh Kantor (CKT) | go-live wizard (Task 8) |
   | 2 past orders | sample Sales History, 6 months, DATA CONTOH | import at Task 14 |
   | 3 invoices / PKP | invoices on, PPN templates present but not default | `is_default` at Task 8 |
   | 4 products, machines, capacity | 5 sample products with BOM and Item Lead Time | data at Task 14 |
   | 5 attendance method, hours | phone with location, 08:00–17:00 | `setup.SHIFT_KANTOR` |
   | 6 server, domain, backup | local compose stack, rclone remote of type local | `.env` on the server |
   | 7 users per bagian | one sample user per bagian (`@contoh.test`) | users at go-live |

   Keep `docs/menunggu-samuel.md` up to date: each question, its default, and where the answer goes.
4. **Sample data.** Add `erp_internal/contoh.py` with `buat_contoh()`, run by `bench --site erp.localhost execute
   erp_internal.contoh.buat_contoh`. It is idempotent and refuses to run when site config `erp_produksi` is set.
   - It creates the two sample companies, 5 products, 3 raw materials, 1 packaging item and their BOMs, Item Lead
     Times and stock.
   - It also creates 3 customers, 2 suppliers, 6 months of Sales History and some open orders.
   - Last, one user per bagian, all sharing a password taken from site config `erp_sandi_contoh`.
   - It is needed for the local dry runs and the browser check.

## Global Constraints

- Versions are pinned in `versi.json`: frappe `v16.53.0`, erpnext `v16.52.1`, hrms `v16.52.0`. Never a develop
  branch. Change a pin only on purpose, with the full test run.
- Python 3.14, Node ≥ 24, MariaDB 11.8.9.
- Every customisation lives in `erp_internal`. Nothing is set by hand on a site unless `bench migrate` would set it
  again.
- Setup code is idempotent and runs from `after_install` and `after_migrate`. It must not fail before the setup
  wizard is complete: company steps are skipped while `frappe.is_setup_complete()` is false.
- Nothing is shared with BPT or the sawit server: own bench, sites, MariaDB container and server.
- ERPNext and HRMS modules are hidden, never deleted or patched.
- Our UI text is Indonesian and written directly (no `__()`). Python names are Indonesian; comments and docstrings
  are English. ruff with tabs, double quotes and 110 columns, like the bpt repo.
- Locale: language `id`, time zone `Asia/Jakarta`, currency `IDR`, date format `dd-mm-yyyy`, number format
  `#.###,##`.
- Company kind: `Company.erp_jenis` is `Pabrik` or `Kantor`.
- Factory warehouses: `Gudang Bahan Baku`, `Gudang Produksi`, `Gudang Barang Jadi`, `Gudang Reject`.
- Forecast: `BULAN_RIWAYAT = 3`, averaged then rounded up to whole units.
- Tests:
  - command: `bench --site erp-test.localhost run-tests --app erp_internal` (one file: `--module
    erp_internal.tests.<file>`);
  - classes from `frappe.tests` (`IntegrationTestCase`, `UnitTestCase`); all tests in `erp_internal/tests/`;
  - fixtures are get-or-create helpers in `erp_internal/tests/utils.py`, on companies `_Uji Pabrik` (`_UP`),
    `_Uji Pabrik 2` (`_UP2`) and `_Uji Kantor` (`_UK`);
  - integration tests date their records relative to `today()` and pass `hari_ini` explicitly to the code under
    test.
- Dev:
  - repo `~/Desktop/Projects/erp-internal`, bench `~/Desktop/Projects/erp-internal-bench` (with
    `apps/erp_internal` symlinked to the repo);
  - secrets `~/Desktop/Projects/erp-internal-bench/.env` (0600, never committed);
  - MariaDB container `erp-mariadb` on 127.0.0.1:3308; bench ports 8002 (web), 9002 (socketio), 11002 (redis
    queue), 13002 (redis cache);
  - sites `erp.localhost` and `erp-test.localhost` (`allow_tests`).
- Docs follow code in the same commit: CLAUDE.md, README.md, `docs/`.
- Commits are Conventional Commits with no Claude attribution lines. Push, tag and deploy only with Abel's
  approval.

## Review Focus

1. The same sales-history file imported twice would double the forecast. The second row for one (company, item,
   month) must be refused. Test: Task 9 `test_duplikat_ditolak`.
2. Sales Orders in another UOM (Karton = 24 Pcs): the forecast and Siap Order count stock quantity. Tests: Task 11
   `test_satuan_lain_dihitung_stok_qty`, Task 13 `test_order_satuan_lain`.
3. Draft, cancelled and amended Sales Orders: only submitted ones count, and an amended order counts once. Test:
   Task 11 `test_draf_batal_dan_amend`.
4. A product without Item Lead Time: Siap Order says "Isi lama produksi" and never invents a date. Test: Task 13
   `test_tanpa_lama_produksi`.
5. Two factory companies: one's forecast and Siap Order never count the other's orders, stock, forecasts or work
   orders. Tests: Task 11 `test_perusahaan_lain_diabaikan`, Task 13 `test_perusahaan_lain_diabaikan`.

---

## File structure

```
~/Desktop/Projects/erp-internal-bench/   # not a repo; .env (DB_ROOT_PASSWORD, ADMIN_PASSWORD); apps/erp_internal -> ../../erp-internal
~/Desktop/Projects/erp-internal/         # the repo = the app root (GitHub: delta-anugrah/erp-internal, private)
└── (repo root)
    ├── versi.json                # pinned tags
    ├── CLAUDE.md  README.md  .dockerignore
    ├── .claude/skills/setup-bench/SKILL.md
    ├── tools/setup_bench.sh
    ├── docs/impor.md  docs/panduan/{gudang,penjualan,pembelian,produksi,absen,proyek}.md
    ├── docs/superpowers/{specs,plans}/
    ├── deploy/Containerfile  deploy/check_image.sh
    ├── deploy/server/{docker-compose.yml,.env.example,cadangan.sh,README.md}
    ├── .github/workflows/image.yml
    └── erp_internal/
        ├── hooks.py
        ├── setup.py              # pastikan_setup(): locale, security, erp_jenis, groups, UOMs, warehouses, flows, office
        ├── tampilan.py           # desktop icons, sidebars, Module and Role Profiles
        ├── translations/id.csv
        ├── public/js/sales_forecast.js
        ├── perencanaan/          # Frappe module "Perencanaan"
        │   ├── rumus.py          # pure math: forecast and Siap Order
        │   ├── forecast.py       # history query and "Isi dari Riwayat"
        │   ├── doctype/riwayat_penjualan/
        │   └── report/siap_order/
        └── tests/{utils.py, data/*.csv, test_*.py}
```

---

## Part A: foundation and the factory's stock, sales and purchasing

### Task 1: Repo, bench, sites and the empty app

**Files:**
- Create: the app by `bench new-app`, then move it to the repo path.
- Create: `versi.json`, `tools/setup_bench.sh`, `CLAUDE.md`, `README.md`, `.claude/skills/setup-bench/SKILL.md`,
  `erp_internal/tests/__init__.py`, `erp_internal/tests/test_situs.py`.
- Move in: the spec and this plan, into `docs/superpowers/specs/` and `docs/superpowers/plans/`.

**Interfaces:**
- Produces: the bench, both sites, the test command, and `../.env` read by `tools/setup_bench.sh`.

- [x] **Step 1: Check the ports.** `lsof -nP -iTCP:<p> -sTCP:LISTEN` prints nothing for 3308, 8002, 9002, 11002 and
  13002. If a port is taken, use the next free one and write it in CLAUDE.md.
- [x] **Step 2: Write `versi.json`:** `{"frappe": "v16.53.0", "erpnext": "v16.52.1", "hrms": "v16.52.0"}`.
- [x] **Step 3: Write `tools/setup_bench.sh`** (bash, `set -euo pipefail`). It reads `../.env` and skips each part
  that already exists:
  1. Start the database: `docker run -d --name erp-mariadb --restart unless-stopped -p 127.0.0.1:3308:3306 -e
     MARIADB_ROOT_PASSWORD -v erp-mariadb:/var/lib/mysql mariadb:11.8.9 --character-set-server=utf8mb4
     --collation-server=utf8mb4_unicode_ci`.
  2. Make the bench: `bench init --frappe-branch <frappe tag> --python python3.14 bench`.
  3. Point the bench at its ports. `bench set-config -g` for `webserver_port` 8002, `socketio_port` 9002,
     `redis_cache` `redis://127.0.0.1:13002`, `redis_queue` `redis://127.0.0.1:11002`, `db_host` `127.0.0.1` and
     `db_port` 3308. Then `bench setup redis` and `bench setup procfile`.
  4. Add the apps: `bench get-app --branch <tag> erpnext` and the same for hrms.
  5. Link our app (only when `../erp_internal` exists): symlink `apps/erp_internal` to `../../erp_internal`, run
     `env/bin/pip install -e apps/erp_internal`, and add the app to `sites/apps.txt`.
  6. Make the sites: `bench new-site` for `erp.localhost` and `erp-test.localhost` with `--db-host 127.0.0.1
     --db-port 3308`, `--db-root-password`, `--admin-password` and `--install-app` erpnext, hrms, erp_internal. Then `bench --site erp-test.localhost
     set-config allow_tests true`.
- [ ] **Step 4: Run parts 1–4 of the script.** In `bench/`, run `bench new-app erp_internal` (title "ERP Internal";
  publisher and email from `git config`). Then `mv apps/erp_internal ../erp_internal` and run parts 5–6.
- [ ] **Step 5: Complete the setup wizard on http://erp.localhost:8002.**
  - Bahasa Indonesia, Indonesia, Asia/Jakarta, IDR, fiscal year January–December.
  - Company "PT Contoh Plastik", abbreviation CPL (DATA CONTOH).
  - Write these values in README.md.
  - `erp-test.localhost` is completed by ERPNext's `before_tests` on the first test run.
- [x] **Step 6: Write `test_situs.py`:**

```python
class TestSitus(IntegrationTestCase):
	def test_aplikasi_terpasang(self):
		self.assertLessEqual({"frappe", "erpnext", "hrms", "erp_internal"}, set(frappe.get_installed_apps()))

	def test_versi_sesuai_pin(self):
		with open(frappe.get_app_path("erp_internal", "..", "versi.json")) as f:
			for app, tag in json.load(f).items():
				self.assertEqual("v" + importlib.import_module(app).__version__, tag)
```

- [ ] **Step 7: Run the tests.** `bench --site erp-test.localhost run-tests --module
  erp_internal.tests.test_situs`. Expected: 2 tests OK.
- [x] **Step 8: Write the docs.**
  - CLAUDE.md (at most 80 lines): what the project is and why, paths, commands, the Global Constraints, links to the
    spec and plan.
  - README.md: setup with the script, the wizard values, the test command.
  - `.claude/skills/setup-bench/SKILL.md`: valid frontmatter, a `description` that says it is for setting up a dev
    machine, and `disable-model-invocation: true` (it creates containers and sites). Steps: the script, the wizard,
    the test run.
  - `git mv`/copy the spec and plan into `docs/superpowers/`.
- [ ] **Step 9: Commit** `chore: scaffold erp_internal on pinned Frappe/ERPNext/HRMS v16`. Push only after Abel
  creates or approves `delta-anugrah/erp-internal` (private).

**Task 1 deviations (2026-10-27, as built):**
- `.env` holds `DB_ROOT_PASSWORD`, so the script passes it to the container as `MARIADB_ROOT_PASSWORD` from the
  environment (not on the command line). The bench folder already exists (it holds `.env`), so `bench init` gets
  `--ignore-exist`. The script also sets `redis_socketio` to the cache port, answers `bench setup procfile`'s
  overwrite prompt, and takes part names (`db bench ports apps link sites wizard`) to run only some parts.
- `new-site` gets `--db-root-username root --mariadb-user-host-login-scope='%'` (the container sees Docker's
  gateway, not localhost) and needs Redis up: the script starts the bench's two Redis as daemons when they are down.
- The app symlink is absolute (`apps/erp_internal -> ~/Desktop/Projects/erp-internal`).
- `new-app` answers: title "ERP Internal", license mit, no GitHub workflow, branch `main`.
- Step 5's wizard runs without a browser, as the script's `wizard` part: `bench --site erp.localhost execute
  frappe.desk.page.setup_wizard.setup_wizard.setup_complete` with English, Indonesia, Asia/Jakarta, IDR,
  PT Contoh Plastik / CPL, chart "Standard", fiscal year Jan-Dec of the current year, Administrator only.
- Still open on 2026-10-27: the `sites` and `wizard` parts and Step 7's test run (the agent's run of `new-site`
  was refused by the permission check; the developer runs `tools/setup_bench.sh sites wizard`).

### Task 2: Site setup on every migrate

**Files:**
- Create: `erp_internal/setup.py`, `erp_internal/tests/utils.py`, `erp_internal/tests/test_setup.py`.
- Modify: `erp_internal/hooks.py`: `after_install` and `after_migrate` = `"erp_internal.setup.pastikan_setup"`.

**Interfaces:**
- Produces:
  - `setup.pastikan_setup() -> None`, `setup.perusahaan(jenis: str) -> list[str]` and
    `setup.gudang(company: str, nama: str) -> str`. `gudang` returns `"<nama> - <abbr>"`.
  - Constants `PENGATURAN_SISTEM`, `GRUP_BARANG`, `SATUAN`, `GUDANG_PABRIK`.
  - `tests/utils.py`: `buat_perusahaan(nama: str, abbr: str, jenis: str) -> str`, which gets or creates the company
    (Indonesia, IDR, chart "Standard"), sets `erp_jenis` and calls `pastikan_setup()`.
  - `tests/utils.py`: `tahun_fiskal(tanggal: date) -> str`, which gets or creates the fiscal year holding `tanggal`.

Values to set:
- `PENGATURAN_SISTEM` (System Settings): `{"language": "id", "time_zone": "Asia/Jakarta", "country": "Indonesia",
  "date_format": "dd-mm-yyyy", "number_format": "#.###,##", "first_day_of_the_week": "Monday",
  "allow_error_traceback": 0, "enable_password_policy": 1, "minimum_password_score": "2"}`.
- Website Settings `disable_signup` = 1. OAuth Settings `enable_dynamic_client_registration` = 0, saved on its own.
  Global Defaults `default_currency` = "IDR" and `country` = "Indonesia".
- Custom Field `Company.erp_jenis`: Select, label "Jenis", options `"\nPabrik\nKantor"`, inserted after `abbr`.
- `GRUP_BARANG = ("Barang Jadi", "Bahan Baku", "Bahan Penolong", "Kemasan", "Sparepart")`, created under the root
  Item Group. Find the root as the group with no parent, because the wizard may have translated its name.
- `SATUAN = ("Pcs", "Lusin", "Karton", "Sak", "Roll", "Kg")`. Create the missing ones; all but Kg get
  `must_be_whole_number` = 1.
- For each company with `erp_jenis` Pabrik: create the `GUDANG_PABRIK` warehouses under the company's root warehouse
  (`is_group` 1, no parent). Then set `disabled` = 1 on every other non-group warehouse of that company that has no
  Stock Ledger Entry.

- [x] **Step 1: Write the failing tests.** `setUpClass` makes `_Uji Pabrik` (Pabrik) and `_Uji Kantor` (Kantor).

```python
def test_pengaturan_indonesia(self):
	for field, nilai in PENGATURAN_SISTEM.items():
		self.assertEqual(frappe.db.get_single_value("System Settings", field), nilai, field)
	self.assertEqual(frappe.db.get_single_value("Website Settings", "disable_signup"), 1)
	self.assertEqual(frappe.db.get_single_value("OAuth Settings", "enable_dynamic_client_registration"), 0)

def test_gudang_pabrik(self):
	aktif = frappe.get_all("Warehouse", {"company": self.pabrik, "is_group": 0, "disabled": 0}, pluck="warehouse_name")
	self.assertEqual(set(aktif), set(GUDANG_PABRIK))
	self.assertEqual(gudang(self.pabrik, "Gudang Barang Jadi"), "Gudang Barang Jadi - _UP")

def test_kantor_tanpa_gudang_pabrik(self):
	self.assertFalse(frappe.db.exists("Warehouse", gudang(self.kantor, "Gudang Barang Jadi")))

def test_grup_satuan_dan_jenis(self):
	self.assertTrue(all(frappe.db.exists("Item Group", g) for g in GRUP_BARANG))
	self.assertTrue(all(frappe.db.exists("UOM", s) for s in SATUAN))
	self.assertIn(self.pabrik, perusahaan("Pabrik"))
	self.assertNotIn(self.kantor, perusahaan("Pabrik"))

def test_idempoten(self):
	hitung = lambda: {dt: frappe.db.count(dt) for dt in ("Warehouse", "Item Group", "UOM", "Custom Field")}
	sebelum = hitung()
	pastikan_setup()
	pastikan_setup()
	self.assertEqual(hitung(), sebelum)
```

- [ ] **Step 2: Run them.** `--module erp_internal.tests.test_setup`. Expected: FAIL (ImportError on
  `erp_internal.setup`). Not run: no site yet.
- [x] **Step 3: Implement `pastikan_setup()`.** It calls these in order: `_pengaturan()`, `_field_jenis()`, then
  returns when `not frappe.is_setup_complete()`, then `_grup_barang()`, `_satuan()`, and `_gudang_pabrik(c)` for each
  `c` in `perusahaan("Pabrik")`. Each helper writes only when a value differs. Later tasks append their own helpers
  to this sequence.
- [ ] **Step 4: Run them again.** Expected: 5 tests OK. Then `bench --site erp.localhost migrate` and set "PT
  Contoh Plastik" Jenis = Pabrik. Not run: no site yet (the `wizard` part of `tools/setup_bench.sh` now sets
  Jenis and migrates).
- [x] **Step 5: Commit** `feat(setup): Indonesian site defaults, company kind, groups, UOMs, factory warehouses`.

**Task 2 deviations (2026-10-27, written without a site):**
- `Company.erp_jenis` has the English label "Kind" and a description (Revision 2); the option values stay
  `Pabrik`/`Kantor`, which the code reads.
- `GLOBAL_DEFAULTS` and `SATUAN_PECAHAN` (Kg) are named tables. An existing UOM gets its `must_be_whole_number` set
  too, not only new ones.
- Unused warehouses are disabled with `frappe.db.set_value` after checking they have no Stock Ledger Entry
  (`Warehouse.validate` would check the same).
- `tools/setup_bench.sh wizard` sets PT Contoh Plastik's Jenis to Pabrik and runs `migrate` after the wizard, since
  the wizard alone does not run `after_migrate`.

### Task 3: Show only the modules in use

**Files:**
- Create: `erp_internal/tampilan.py`, `erp_internal/tests/test_tampilan.py`.
- Modify: `setup.py` (`pastikan_setup` calls `tampilan.terapkan()` last) and `tests/utils.py`.

**Interfaces:**
- Consumes: `setup.perusahaan`, `tests.utils.buat_perusahaan`.
- Produces:
  - `tampilan.terapkan() -> None` and the tables `IKON`, `SIDEBAR`, `MODUL_BOLEH` and `PROFIL_PERAN`;
  - `tampilan.peran_bagian(bagian: tuple[str, ...]) -> set[str]`: the roles of those Role Profiles;
  - `tampilan.modul_aplikasi() -> list[str]`: the Module Defs of erpnext, hrms and erp_internal;
  - `tests/utils.py`: `buat_pengguna(email: str, profil_peran: str | None, profil_modul: str | None, company: str |
    None) -> str`, which gets or creates a System User with that Role Profile and Module Profile, plus a User
    Permission on Company;
  - `buat_barang(kode, grup, satuan="Pcs", konversi: dict[str, float] | None = None, **field) -> str`;
    `buat_pelanggan(nama) -> str`.

The tables:
- `IKON`: desktop icon label → the bagian that see it. System Manager always sees it.

  ```python
  {"Stock": ("Gudang", "Penjualan", "Pembelian", "Produksi"), "Selling": ("Penjualan",), "Buying": ("Pembelian",),
   "Manufacturing": ("Produksi",), "Invoicing": ("Penjualan", "Pembelian"), "Projects": ("Manajer Proyek", "Karyawan"),
   "Shift & Attendance": ("HR", "Karyawan"), "Leaves": ("HR", "Karyawan")}
  ```

  Every other standard Desktop Icon of erpnext or hrms gets `hidden` = 1 and roles = [System Manager].
- `SIDEBAR`: Workspace Sidebar name → the `link_to` values kept, in this order. A missing link is added (type Link);
  any other link is removed.
  - Stock: Item, Warehouse, Stock Entry, Stock Reconciliation, Stock Balance, Stock Ledger.
  - Selling: Customer, Sales Order, Delivery Note, Sales Invoice, Sales Order Analysis.
  - Buying: Supplier, Material Request, Purchase Order, Purchase Receipt, Purchase Invoice.
  - Manufacturing: Sales Forecast, Master Production Schedule, Material Requirements Planning Report, Work Order,
    BOM, Item Lead Time.
  - Invoicing: Sales Invoice, Purchase Invoice, Payment Entry, Accounts Receivable, Accounts Payable.
  - Projects: Project, Task, Timesheet.
  - Shift & Attendance: Employee, Employee Checkin, Attendance, Shift Type, Shift Assignment.
  - Leaves: Leave Application, Leave Allocation, Holiday List.
- `MODUL_BOLEH`: Module Profile → allowed modules. A profile blocks every Module Def of erpnext, hrms and
  erp_internal that is not in its set. Frappe's own modules are left alone.
  - `"Pabrik"`: Stock, Selling, Buying, Manufacturing, Accounts, Setup, Perencanaan.
  - `"Kantor"`: Projects, HR, Setup.
- `PROFIL_PERAN`: Role Profile → ERPNext/HRMS roles for Gudang, Penjualan, Pembelian, Produksi, HR, Karyawan and
  Manajer Proyek. Use the fewest standard roles that make `test_izin_per_bagian` pass.
- `terapkan()` follows bpt's `bpt/setup.py` `_sembunyikan_ikon`. Read it first: it writes only what differs,
  deletes Desktop Layout rows and clears the `desktop_icons` cache key.

- [x] **Step 1: Check the exact names.** Read the labels in `apps/erpnext/erpnext/desktop_icon/*.json` and
  `apps/hrms/hrms/desktop_icon/*.json`, the Workspace Sidebar names, and `frappe.get_all("Module Def",
  {"app_name": ("in", ["erpnext", "hrms"])}, pluck="name")`. Fix any key in `IKON`, `SIDEBAR` or `MODUL_BOLEH` that
  differs, and note the change in the commit message.
- [x] **Step 2: Write the failing tests.**

```python
IZIN = {
	"Gudang": (["Item", "Stock Entry", "Stock Reconciliation", "Delivery Note", "Purchase Receipt"], ["Sales Order", "Purchase Order", "Work Order", "Employee"]),
	"Penjualan": (["Customer", "Sales Order", "Delivery Note", "Sales Invoice", "Payment Entry"], ["Purchase Order", "Work Order", "Stock Reconciliation"]),
	"Pembelian": (["Supplier", "Material Request", "Purchase Order", "Purchase Invoice"], ["Sales Order", "Work Order"]),
	"Produksi": (["BOM", "Item Lead Time", "Sales Forecast", "Master Production Schedule", "Work Order", "Stock Entry"], ["Sales Invoice", "Purchase Order"]),
	"HR": (["Employee", "Shift Type", "Holiday List", "Attendance", "Leave Allocation"], ["Sales Order", "Stock Entry"]),
	"Karyawan": (["Employee Checkin", "Leave Application", "Timesheet"], ["Employee", "Sales Order", "Stock Entry"]),
	"Manajer Proyek": (["Project", "Task", "Timesheet"], ["Sales Order", "Employee"]),
}

def test_izin_per_bagian(self):
	for bagian, (boleh, tidak) in IZIN.items():
		u = buat_pengguna(f"_uji.{bagian.lower().replace(' ', '')}@contoh.test", bagian, None, None)
		for dt in boleh:
			self.assertTrue(frappe.has_permission(dt, "create", user=u), f"{bagian} harus bisa buat {dt}")
		for dt in tidak:
			self.assertFalse(frappe.has_permission(dt, "create", user=u), f"{bagian} tidak boleh buat {dt}")

def test_ikon(self):
	for icon in frappe.get_all("Desktop Icon", {"standard": 1, "app": ("in", ["erpnext", "hrms"])}, ["name", "label", "hidden"]):
		roles = {r.role for r in frappe.get_doc("Desktop Icon", icon.name).roles}
		if icon.label in IKON:
			self.assertEqual(icon.hidden, 0, icon.label)
			self.assertEqual(roles, {"System Manager"} | peran_bagian(IKON[icon.label]), icon.label)
		else:
			self.assertEqual((icon.hidden, roles), (1, {"System Manager"}), icon.label)

def test_sidebar(self):
	for nama, link in SIDEBAR.items():
		items = frappe.get_doc("Workspace Sidebar", nama).items
		self.assertEqual([i.link_to for i in items if i.type == "Link"], link, nama)

def test_profil_modul(self):
	for profil, boleh in MODUL_BOLEH.items():
		blok = {b.module for b in frappe.get_doc("Module Profile", profil).block_modules}
		self.assertEqual(blok, set(modul_aplikasi()) - set(boleh), profil)

def test_penjualan_tetap_bisa_buat_order(self):
	# a Module Profile must not break link fields on a kept form
	pabrik = buat_perusahaan("_Uji Pabrik", "_UP", "Pabrik")
	u = buat_pengguna("_uji.penjualan.pabrik@contoh.test", "Penjualan", "Pabrik", pabrik)
	frappe.set_user(u)
	self.addCleanup(frappe.set_user, "Administrator")
	so = frappe.get_doc({"doctype": "Sales Order", "company": pabrik, "customer": buat_pelanggan("_Uji Pelanggan"),
		"transaction_date": today(), "delivery_date": add_days(today(), 7),
		"items": [{"item_code": buat_barang("_UJI-EMBER", "Barang Jadi"), "qty": 10, "rate": 10000}]})
	so.insert()

def test_idempoten(self):
	terapkan()
	sebelum = jejak_modified()
	terapkan()
	self.assertEqual(jejak_modified(), sebelum)
```

  - `peran_bagian(bagian) -> set[str]` and `modul_aplikasi() -> list[str]` are public helpers in `tampilan.py`.
  - `jejak_modified()` is a test helper: the `modified` values of every Desktop Icon, Workspace Sidebar, Module
    Profile and Role Profile.
  - Run the test module. Expected: FAIL (ImportError). Not run: no site yet.
- [x] **Step 3: Implement `terapkan()`** and the tables. Desktop icons: hidden flag and roles. Sidebars: keep and
  add as `SIDEBAR` says. Module Profiles and Role Profiles: get or create, then update.
- [ ] **Step 4: Run the tests.** Expected: OK. Then `bench --site erp.localhost migrate` and look in the browser as
  Administrator. The desktop shows only the kept icons, and each kept sidebar shows only its links. Not run: no
  site yet.
- [x] **Step 5: Commit** `feat(tampilan): only the used modules, sidebars and role profiles per bagian`.

**Task 3 deviations (2026-10-27, read from the v16.53 source; `.claude/rules/tampilan.md`):**
- v16.53 has no icon grid by default. Desktop Settings is on "Apps", which creates no Desktop Icon rows, and
  `Workspace Sidebar` is an inert archive (both are the "retiring" batch in `frappe/desk/RETIRING.md`). The
  live surfaces are the app's dock (rail of modules), the per-module `Sidebar` and `User.block_modules`. Standard
  `Sidebar` rows refuse edits outside developer mode, so everything is a site layer:
  - `IKON` keys are dock entries (sidebar names). `terapkan()` writes a site `Dock` layer per app (erpnext, hrms):
    `IKON` entries in order, every other entry hidden for everyone. `_halaman_apps()` keeps Desktop Settings on
    "Apps". `test_ikon` became `test_dok`, plus `test_halaman_apps`.
  - There is no "Invoicing" module: its icon pointed at the Accounts module. `IKON`/`SIDEBAR` use `Accounts`, and
    `LABEL = {"Accounts": "Invoicing"}` titles its rail button and sidebar header.
  - `SIDEBAR` is a site `Custom Sidebar` layer per module, written through Frappe's own
    `custom_sidebar._save_customization`. The module's home Workspace stays first (Revision 2 item 4), so
    `test_sidebar` checks Home, then the `SIDEBAR` links. Added because the app's sidebar lacks them: Selling
    "Sales Order Analysis" (Report); Manufacturing "Sales Forecast", "Master Production Schedule", "Item Lead Time";
    Shift & Attendance "Employee".
- Per-bagian visibility needs per-user module blocking (a dock entry has no roles), so `MODUL_BOLEH` holds one
  Module Profile per bagian, named like its Role Profile, instead of "Pabrik"/"Kantor". New
  `test_profil_modul_ikut_ikon` keeps it equal to the modules of each bagian's `IKON` entries, and
  `test_dok_per_bagian` checks each bagian's rail. `test_penjualan_tetap_bisa_buat_order` uses profile
  "Penjualan". Task 8 Step 5 gives each user the Module Profile of their bagian. Module Def names:
  `Shift and Attendance` (hrms), `Accounts`, `Stock`, `Selling`, `Buying`, `Manufacturing`, `Projects`, `Leaves`.
- `PROFIL_PERAN` (from the v16 DocPerms): Gudang Stock Manager + Item Manager; Penjualan Sales User + Accounts
  User; Pembelian Purchase User + Purchase Master Manager + Accounts User; Produksi Manufacturing User +
  Manufacturing Manager; HR HR Manager + HR User; Karyawan Employee; Manajer Proyek Projects User + Projects
  Manager. A static check of `IZIN` against the DocPerm JSON passes; HRMS's install-time permissions are not in it.
- `jejak_modified()` tracks Dock (site layers), Custom Sidebar, Module Profile and Role Profile.
- `buat_pelanggan` takes the first leaf Customer Group: ERPNext refuses a group one.

### Task 4: Indonesian labels

**Files:**
- Create: `erp_internal/translations/id.csv`, `erp_internal/tests/test_bahasa.py`.

**Interfaces:**
- Consumes: `PENGATURAN_SISTEM["language"] == "id"` (Task 2).

`id.csv` holds two columns, source then Indonesian:

| Source | Indonesian | Source | Indonesian |
|---|---|---|---|
| Stock | Stok | Selling | Penjualan |
| Buying | Pembelian | Manufacturing | Produksi |
| Invoicing | Faktur & Pembayaran | Projects | Proyek |
| Shift & Attendance | Absensi | Leaves | Cuti |
| Item | Barang | Warehouse | Gudang |
| Stock Entry | Mutasi Stok | Stock Reconciliation | Stok Opname |
| Stock Balance | Saldo Stok | Stock Ledger | Kartu Stok |
| Customer | Pelanggan | Sales Order | Pesanan Penjualan |
| Delivery Note | Surat Jalan | Sales Invoice | Faktur Penjualan |
| Payment Entry | Pembayaran | Sales Order Analysis | Analisis Pesanan Penjualan |
| Supplier | Pemasok | Material Request | Permintaan Barang |
| Purchase Order | Pesanan Pembelian | Purchase Receipt | Penerimaan Barang |
| Purchase Invoice | Faktur Pembelian | Accounts Receivable | Piutang |
| Accounts Payable | Hutang | BOM | Resep Produk (BOM) |
| Item Lead Time | Lama Produksi Barang | Sales Forecast | Perkiraan Penjualan |
| Master Production Schedule | Jadwal Produksi Induk | Material Requirements Planning Report | Rencana Kebutuhan Material (MRP) |
| Work Order | Perintah Produksi | Project | Proyek |
| Task | Tugas | Timesheet | Catatan Jam Kerja |
| Employee | Karyawan | Employee Checkin | Absen Masuk/Pulang |
| Attendance | Kehadiran | Shift Type | Jenis Shift |
| Shift Assignment | Jadwal Shift | Leave Application | Pengajuan Cuti |
| Leave Allocation | Jatah Cuti | Holiday List | Daftar Hari Libur |

- [x] **Step 1: Write the failing test.**

```python
def test_label_kita_dipakai(self):
	semua = frappe.translate.get_all_translations("id")
	with open(frappe.get_app_path("erp_internal", "translations", "id.csv")) as f:
		for sumber, target, *_ in csv.reader(f):
			self.assertEqual(semua.get(sumber), target, sumber)
```

- [ ] **Step 2: Run it.** Expected: FAIL (FileNotFoundError). Not run: no site yet.
- [x] **Step 3: Write `id.csv`** with the table above, one row per pair.
- [ ] **Step 4: Run it again.** Expected: OK. Then `bench --site erp.localhost clear-cache` and look at the desktop
  and two forms (Sales Order, Work Order). Their titles and sidebars are in Indonesian. Not run: no site yet.
- [x] **Step 5: Commit** `feat(bahasa): Indonesian labels for the kept screens`.

**Task 4 deviations (2026-10-27, Revision 2 item 3 as built):**
- v16.53's user menu has no JS hook for extra rows; it lists `Navbar Settings.settings_dropdown`. The switch is
  two `standard_navbar_items` rows in `hooks.py` ("Bahasa Indonesia" when `frappe.boot.lang` is not `id`,
  "English" when it is), whose action calls `erp_internal.ganti_bahasa(lang)` from `erp_internal.bundle.js`.
  Frappe syncs those rows on `migrate`, not on install.
- `test_semua_teks_kita_diterjemahkan` skips the Navbar rows of other apps that `get_messages_for_app` returns,
  and adds our two navbar labels. New `test_tamu_ditolak`: Guest gets `frappe.PermissionError`.
- `id.csv` also holds our own strings: the `Kind` label and description of `Company.erp_jenis`, the two menu labels
  and the two messages of `bahasa.ganti`. "Invoicing" is the title `tampilan.LABEL` gives the Accounts module.

### Task 5: The factory's sales and purchasing flow

**Files:**
- Modify: `setup.py` (`_alur_jual_beli()` appended to `pastikan_setup`) and `tests/utils.py`.
- Create: `erp_internal/tests/test_alur_jual_beli.py`.

**Interfaces:**
- Produces:
  - `setup.TARIF_PPN = 11` and `setup.PAJAK = {"jual": ("PPN 11%", "PPN Keluaran"), "beli": ("PPN Masukan 11%",
    "PPN Masukan")}` (template name, account name);
  - `tests/utils.py`: `buat_pemasok(nama) -> str` and `stok_awal(company: str, kode: str, qty: float, nama_gudang:
    str, rate: float = 1000) -> None`. `stok_awal` submits a Stock Reconciliation with Opening Stock and difference
    account "Temporary Opening - <abbr>".

Settings:
- Selling Settings `so_required` "Yes" and `dn_required` "No". Buying Settings `po_required` "Yes" and `pr_required`
  "No". Stock Settings `allow_negative_stock` 0 and `valuation_method` "FIFO".
- For each Pabrik company:
  - `enable_perpetual_inventory` = 0;
  - accounts "PPN Keluaran - <abbr>" and "PPN Masukan - <abbr>" (account_type Tax) under "Duties and Taxes -
    <abbr>";
  - a Sales Taxes and Charges Template "PPN 11% - <abbr>" and a Purchase Taxes and Charges Template "PPN Masukan
    11% - <abbr>". Both charge "On Net Total" at `TARIF_PPN`, with `is_default` 0.

- [x] **Step 1: Write the failing tests.**
  - `test_alur_penjualan`: stock 500 of `_UJI-EMBER` in Gudang Barang Jadi. Submit a Sales Order of 100 at 10.000.
    `make_delivery_note(so)` and submit; the Bin `actual_qty` is 400. `make_sales_invoice(dn)` with template "PPN
    11% - _UP", run `set_taxes`, submit; `grand_total` is 1.110.000.
  - `test_surat_jalan_wajib_dari_order`: a Delivery Note with no Sales Order raises `frappe.ValidationError`.
  - `test_alur_pembelian`: submit a Purchase Order of 50 `_UJI-BIJI-PP` (Kg). `make_purchase_receipt(po)` and
    submit; the Bin in Gudang Bahan Baku grows by 50. A Purchase Receipt with no Purchase Order raises
    `frappe.ValidationError`.
  - `test_tanpa_jurnal_stok`: after the Delivery Note, `frappe.db.count("GL Entry", {"voucher_no": dn.name})` is 0.
- [ ] **Step 2: Run them.** Expected: FAIL (templates missing, Delivery Note without an order allowed). Not run:
  no site yet.
- [x] **Step 3: Implement `_alur_jual_beli()`.**
- [ ] **Step 4: Run them again.** Expected: 5 tests OK. Not run: no site yet.
- [x] **Step 5: Write `docs/panduan/penjualan.md`, `pembelian.md` and `gudang.md`** in plain Indonesian: the daily
  steps per bagian, one screenshot per step, taken on `erp.localhost`. Text written; screenshots not taken (no
  site yet): the guides link `docs/panduan/gambar/*.png`, still missing.
- [x] **Step 6: Commit** `feat(alur): sales and purchasing flow, PPN templates, perpetual inventory off`.

**Task 5 deviations (2026-10-28, written without a site; fieldnames and methods read in the v16 source):**
- `make_delivery_note` (`erpnext.selling.doctype.sales_order.sales_order`), `make_sales_invoice`
  (`erpnext.stock.doctype.delivery_note.delivery_note`) and `make_purchase_receipt`
  (`erpnext.buying.doctype.purchase_order.purchase_order`) are the v16 paths. `so_required` is checked in
  `DeliveryNote.validate` and `po_required` in `PurchaseReceipt.validate`, so the refusals raise on `insert`.
- The Sales Invoice gets its taxes by `taxes_and_charges`, an emptied `taxes` table and `set_taxes()` (it only
  fills an empty table on a new doc).
- New `test_pengaturan_alur` (5 tests, not 4): the settings, perpetual inventory off, both templates and the Tax
  accounts.
- `tests/utils.py` gains `daftar_harga(nama, jual)`: an IDR price list. The test site's wizard (HRMS
  `before_tests`) makes INR price lists, which an IDR company would need an exchange rate for. Task 3's
  `test_penjualan_tetap_bisa_buat_order` now uses it too.
- `stok_awal` uses Opening Stock only when the item has no stock entry in that warehouse yet (ERPNext refuses a
  second opening), a plain reconciliation after, and nothing when the stock is already `qty` (ERPNext refuses a
  reconciliation that changes nothing).
- The PPN group is found by name "Duties and Taxes", else the first group of type Tax. A chart without one logs an
  error and skips the templates instead of failing the migrate. An existing template keeps its `is_default`, so
  Task 8's hand-set default survives a migrate; only its tax row is put back.
- v16 also has `Company.valuation_method` (default FIFO); it is left alone (ERPNext refuses a change after stock
  moves).
- Perpetual inventory is set with `db.set_value` (Company's own save rebuilds default accounts) and ERPNext's
  per-request cache entry is dropped.

### Task 6: The import guide and tested templates

**Files:**
- Create: `docs/impor.md`, `erp_internal/tests/test_impor.py`, and `erp_internal/tests/data/{barang,pelanggan,
  pemasok,stok_awal,barang_salah}.csv`.
- Modify: `tests/utils.py`.

**Interfaces:**
- Produces: `tests/utils.py` `impor_csv(doctype: str, path: str, jenis: str = "Insert New Records") ->
  Document`. It creates a Data Import, runs it synchronously and returns the reloaded doc.

- [x] **Step 1: Make the test files from ERPNext itself.** On `erp.localhost`, use Data Import → Download Template.
  Keep the headers exactly as an Indonesian user gets them, and record them in `docs/impor.md`.
  - Item: code, name, group, default UOM, maintain stock, safety stock, and UOMs child (UOM, conversion factor).
  - Customer: name, type, group, territory.
  - Supplier: name, group.
  - Stock Reconciliation: company, posting date, purpose Opening Stock, difference account, and items child (item,
    warehouse, qty, valuation rate).

  Each file holds 3 rows. `barang.csv` gives `_UJI-B1` a Karton conversion of 24. `barang_salah.csv` has one row
  with an Item Group that does not exist.
- [x] **Step 2: Write the failing tests.**
  - `test_impor_barang`: 3 Items, and `_UJI-B1` has a Karton conversion factor of 24.
  - `test_impor_pelanggan_dan_pemasok`: 3 of each.
  - `test_impor_stok_awal`: the Bin `actual_qty` equals the file per row.
  - `test_impor_salah_terbaca`: the Data Import status is not "Success", and its import log names row 1 and the
    Item Group.
- [ ] **Step 3: Run them.** Expected: FAIL (`impor_csv` missing). Not run: no site yet.
- [x] **Step 4: Implement `impor_csv`** and run again. Expected: 4 tests OK. Implemented; run not done: no site yet.
- [x] **Step 5: Write `docs/impor.md`** in plain Indonesian:
  - the order: Barang, Pelanggan, Pemasok, then Stok awal dated the day before go-live;
  - the headers, one example row per file, and how to read the error log, fix the file and import again;
  - a note that each import is checked against Samuel's file counts.
- [x] **Step 6: Commit** `docs(impor): tested Data Import templates and guide`.

**Task 6 deviations (2026-10-28, written without a site):**
- No site to press Download Template on. The headers are built from v16's `data_import/exporter.py`
  (`add_header`: a field's label; a child field as `"<label> (<table label or fieldname>)"`) for an English user
  (Revision 2), so `UOM (uoms)` (Item's `uoms` table has no label), `Item Code (Items)`. The importer also accepts
  the translated labels, so an Indonesian user's template works too. **Re-check every header against the site's
  Download Template** once `erp.localhost` exists, and the button names of v16.53's Data Import wizard in the guide.
- v16.53 checks every Link and Select value before importing (`value_mapping.get_blocking_warnings`). An unknown
  Item Group stops the whole file: no row is imported, the status goes back to Pending, there is no import log, and
  `template_warnings` holds `"<value>" is not a valid Item Group — row 2`, row 2 being the first data row under the
  header (sheet numbering). `test_impor_salah_terbaca` asserts that, not "row 1 in the import log". `docs/impor.md`
  explains both kinds of error (blocked before import, with Value Mappings to fix it; failed rows in the log).
- `impor_csv(doctype, path, jenis, ajukan=False)`: `ajukan` sets `submit_after_import` (Stock Reconciliation).
  It commits like the importer itself (which commits per row), so `test_impor` cleans up its own records at the
  start and end of the class (`bersihkan`: delete the imported items, customers and suppliers, cancel the earlier
  openings of `_UJI-S1..S3`).
- `stok_awal.csv` has no Posting Date column, so the test does not depend on a date (the import day is used); the
  guide's example has it. Customers use the wizard's English groups (`Commercial`, `Individual`, territory `Rest Of
  The World`) that both sites have.
- Numbers in the files are plain (`15000`): with `#.###,##`, v16 reads `15.000` as 15000 and refuses ambiguous
  values; the guide says so.

### Task 7: Server image, compose stack and backups

**Files:**
- Create: `deploy/Containerfile`, `deploy/check_image.sh`, `.github/workflows/image.yml`, `.dockerignore`,
  `deploy/server/docker-compose.yml`, `deploy/server/.env.example`, `deploy/server/cadangan.sh`,
  `deploy/server/README.md`.

**Interfaces:**
- Consumes: `versi.json`.
- Produces: image `ghcr.io/delta-anugrah/erp-internal:<vX.Y.Z>`, the compose stack (variables `ERP_IMAGE`, `SITE`,
  `DB_ROOT_PASSWORD`, `RCLONE_REMOTE`) and the runbook.

Start from bpt's `deploy/Containerfile`, `deploy/check_image.sh`, `.github/workflows/image.yml` and
`deploy/droplet/docker-compose.yml`. Read them first. These are the changes:
- Apps are cloned by the tags in `versi.json` (`git clone --depth 1 --branch <tag>`): frappe, erpnext and hrms, plus
  `erp_internal` from the build context.
- `BUILD_IMAGE`/`BASE_IMAGE` are `frappe/build:v16.53.0` and `frappe/base:v16.53.0`, pinned by digest. Look the
  digests up with `docker buildx imagetools inspect`.
- `check_image.sh` asserts the three versions inside the image equal `versi.json`, and that `erp_internal` is
  installed.
- Compose keeps bpt's services: configurator, backend, queue, scheduler, websocket, frontend, mariadb 11.8.9,
  redis-cache, redis-queue. It has one site from `SITE`, and the image must be an exact tag (never `latest`). TLS is
  done by the host's reverse proxy (runbook).
- `cadangan.sh` steps:
  1. `docker compose exec -T backend bench --site "$SITE" backup --with-files --compress`.
  2. `rclone copy` of the newest set to `$RCLONE_REMOTE`.
  3. Delete local and remote sets older than 14 days.
  4. Exit non-zero on any failure.

  Cron runs it daily at 02:00 WIB.

- [x] **Step 1: Build.** `docker build -f deploy/Containerfile -t erp-internal:uji .` succeeds, and
  `deploy/check_image.sh erp-internal:uji` exits 0. Done 2026-10-28 on the Mac (linux/arm64, about 20 min, 5.43 GB):
  `OK: frappe v16.53.0 erpnext v16.52.1 hrms v16.52.0 erp_internal 77867c1`. CI builds linux/amd64.
- [ ] **Step 2: Boot it.** Not run: `new-site` needs a database root password (left to Abel); `docker compose
  config` validates the file. `docker compose up -d` with `SITE=erp-uji.localhost` and a new site. Then `curl -fsS -H
  "Host: erp-uji.localhost" http://127.0.0.1:8080/api/method/ping` prints `{"message":"pong"}`.
- [ ] **Step 3: Back it up.** Not run against a real stack (needs Step 2). Dry run with a stub `docker` and a local
  rclone remote passed: three files copied, a 15-day-old set deleted locally and remotely, a bad remote exits non-zero. Run `cadangan.sh` with an rclone remote of type `local` (a temp directory). Expected:
  three files (database, public files, private files). A fake set dated 15 days ago is deleted on the next run.
- [ ] **Step 4: Restore drill.** Not run (needs Step 2); the commands are in the runbook. Restore that backup into a second fresh stack. `ping` answers, and
  `frappe.db.count("Item")` equals the source's.
- [x] **Step 5: Write `deploy/server/README.md`** with these sections:
  - first install: server, DNS, reverse proxy with TLS, `.env`, `up -d`, new site, wizard values, set Jenis;
  - new version: tag, image, pull, `migrate`;
  - backup and restore: the cron line and a monthly restore drill;
  - who holds which secret.
- [x] **Step 6: Commit** `feat(deploy): pinned image, compose stack, nightly off-site backup, runbook`. Tag `v0.1.0`
  only with Abel's approval (not tagged).

**Task 7 deviations (2026-10-28):**
- `frappe/build` has no `v16.53.0` tag; its tags follow the frappe_docker release. `BUILD_IMAGE` is
  `frappe/build:v16.52.1` and `BASE_IMAGE` `frappe/base:v16.53.0`, both pinned by index digest, both from the
  2026-10-27 release (same Python 3.14.10). The base already ships Node 24.22.1, so bpt's Node swap is dropped.
- The apps are cloned by bench (`bench init --frappe-branch <tag>`, `bench get-app --branch <tag>`, which run
  `git clone --depth 1 --branch`), reading the tags from `versi.json` in the build; the build fails unless
  `git describe --tags --exact-match` equals the pin. `BUILD_INFO` records the tags and `ERP_SHA`.
- `check_image.sh` compares each app's tag and `__version__` with the host's `versi.json`, imports
  `erp_internal`, checks `erp_internal.bundle.js`, Python 3.14, Node 24, socket.io deps, WeasyPrint and baked-in
  credentials. `apps.txt` is compared as a set: bench writes it as `frappe hrms erpnext erp_internal` and the
  configurator rewrites it alphabetically.
- Compose: bpt's services without its droplet caps and `oom_score_adj` (our own server); a `logs` volume; the
  frontend serves `SITE` whatever the Host header (`FRAPPE_SITE_NAME_HEADER: ${SITE}`); `tools` mounts
  `./cadangan` for restores. The variable is `DB_ROOT_PASSWORD` (plan) where bpt has `MARIADB_ROOT_PASSWORD`;
  `.env` also holds `ADMIN_PASSWORD`.
- `cadangan.sh` copies the three data files only; the site config backup (it holds the database password) stays on
  the server and the encryption key is kept with the secrets (runbook). It reads only `SITE` and `RCLONE_REMOTE`
  from `.env`, checks the remote holds the 3 files, and deletes sets older than `SIMPAN_HARI` (14) days. Bash 3
  compatible (no `mapfile`).

### Task 8: Go-live wave 1, the factory

Manual, with Samuel. It needs his answers to questions 1, 3, 6 and 7 (§12) and his master data. Nothing here is
code. Record every value used in `deploy/server/README.md` or CLAUDE.md, never secrets.

- [ ] **Step 1: Bring the server up.**
  - Follow the runbook. Site `erp.<domain>`.
  - Wizard: the factory's real name and abbreviation, Indonesia, Asia/Jakarta, IDR, fiscal year January–December.
  - Set its Jenis to Pabrik and run `migrate`.
- [ ] **Step 2: Create the office company now** (Jenis Kantor), so Part C needs no restructuring.
- [ ] **Step 3: PPN.** If the factory is PKP, set `is_default` 1 on "PPN 11% - <abbr>" and "PPN Masukan 11% -
  <abbr>".
- [ ] **Step 4: Import Samuel's data** with `docs/impor.md`.
  - Counts must equal his files.
  - Five random items' stock must equal a physical count.
- [ ] **Step 5: Create the users.**
  - One per person, with the Role Profile and Module Profile of their bagian (Task 3 deviations) and a User
    Permission on the factory company.
  - Samuel gets System Manager.
  - Passwords are handed over in person.
- [ ] **Step 6: Backups.** Run `cadangan.sh`, find the off-site copy, and do one restore drill on a scratch stack.
- [ ] **Step 7: Train.** 30 minutes per bagian with `docs/panduan/{gudang,penjualan,pembelian}.md`.
- [ ] **Step 8: Accept.** One real order goes Sales Order → Delivery Note → Sales Invoice (→ payment) on day one,
  and Samuel signs off. Write the go-live date in CLAUDE.md.

---

## Part B: production and the forecast

### Task 9: Sales history (Riwayat Penjualan)

**Files:**
- Create: module "Perencanaan" (`modules.txt` and `erp_internal/perencanaan/__init__.py`), DocType
  `erp_internal/perencanaan/doctype/riwayat_penjualan/` (json, py; delete the generated test stub),
  `erp_internal/tests/test_riwayat_penjualan.py`, `erp_internal/tests/data/riwayat.csv`.
- Modify: `tampilan.SIDEBAR["Manufacturing"]` (append "Riwayat Penjualan"), `docs/impor.md` (a Riwayat Penjualan
  section), `tests/test_tampilan.py` (`IZIN`: Penjualan and Produksi create it, Gudang does not).

**Interfaces:**
- Produces: DocType `Riwayat Penjualan` with these fields:
  - `company` (Link Company, required, in list view);
  - `item_code` (Link Item, required, in list view);
  - `item_name` (Data, fetched from `item_code.item_name`, read only);
  - `bulan` (Date, required, in list view; description "Tanggal berapa pun; disimpan sebagai tanggal 1");
  - `qty` (Float, required, in list view);
  - `stock_uom` (Link UOM, fetched from `item_code.stock_uom`, read only).

  Autoname hash, sort `bulan` desc. Permissions: System Manager, Sales Manager and Manufacturing Manager get full
  access plus import; Sales User and Manufacturing User get read, report and export.

Controller rules:
- `validate`:
  - `bulan` becomes `get_first_day(bulan)`;
  - `qty < 0` → `frappe.throw("Qty tidak boleh minus.")`;
  - an item that is not a stock item → `frappe.throw("Barang {0} bukan barang stok.")`;
  - another row with the same (company, item_code, bulan) → `frappe.throw("Riwayat {item} bulan {MM-YYYY} sudah
    ada.", frappe.UniqueValidationError)`.
- Module-level `on_doctype_update()` adds `frappe.db.add_unique("Riwayat Penjualan", ("company", "item_code",
  "bulan"), constraint_name="unik_riwayat")`.

- [x] **Step 1: Write the failing tests.**
  - `test_bulan_jadi_tanggal_1`: 17 May 2026 is stored as 2026-05-01.
  - `test_duplikat_ditolak` (Review Focus 1): a second row for one company, item and month raises
    `frappe.UniqueValidationError`.
  - `test_qty_minus_ditolak`.
  - `test_impor_riwayat`: `riwayat.csv` (2 items × 6 months) gives 12 rows; importing it again adds 0 rows and the
    Data Import is not "Success".
  - `test_tampilan.test_izin_per_bagian` runs again with the new `IZIN` rows.
- [ ] **Step 2: Run them.** Expected: FAIL (the DocType doesn't exist). Not run: no site yet.
- [x] **Step 3: Implement the DocType** (JSON by hand, `modified` bumped), the controller and `on_doctype_update`.
  Then `bench --site erp-test.localhost migrate` (not run: no site yet).
- [ ] **Step 4: Run them again.** Expected: OK. Not run: no site yet.
- [x] **Step 5: Commit** `feat(planning): Sales History, one row per company, item and month`.

**Task 9 deviations (2026-10-28, written without a site; Revision 2 names):**
- DocType `Sales History` in module `Planning` (`erp_internal/planning/doctype/sales_history/`), test
  `tests/test_sales_history.py`. English labels (Company, Item, Item Name, Month, Qty, Stock UOM); the description
  and messages are English source with `id.csv` rows, like every string of ours. Title field `item_code`.
- Permissions: **Sales User also gets full access plus import**, not only read. Penjualan's Role Profile has Sales
  User and no Sales Manager (Task 3), and §9 says Penjualan creates Sales History. Manufacturing User reads,
  reports and exports, as planned.
- `SIDEBAR` adds Sales History to **Selling** too, not only Manufacturing: Penjualan has no Manufacturing module.
  Module `Planning` has no rail entry and stays blocked in every Module Profile (`modul_aplikasi` includes it),
  which hides navigation only; the sidebar links are gated by DocPerm.
- The duplicate message names the month as `MM-YYYY` (`strftime`), the item in bold. New
  `test_bukan_barang_stok_ditolak`.
- `riwayat.csv` uses the English template headers `Company,Item,Month,Qty` and dates `15-MM-2026` (unambiguous
  `dd-mm-yyyy`, day 15 to show the 1st-of-month rule). The importer commits, so the test cleans up its rows
  (like `test_impor`). `tests/utils.py` gains `riwayat(company, kode, bulan, qty)` (get or create, for Tasks 11-13).
- `id.csv` also holds the DocType's labels and its roles (`get_messages_for_app` returns both).


### Task 10: The forecast math (pure functions)

**Files:**
- Create: `erp_internal/perencanaan/rumus.py`, `erp_internal/tests/test_rumus.py`.

**Interfaces:**
- Produces:
  - `BULAN_RIWAYAT = 3`;
  - `bulan_acuan(hari_ini: date, dari: date, jumlah: int = BULAN_RIWAYAT) -> list[date]`: `jumlah` first-of-month
    dates, oldest first, ending with the month before min(the month of `hari_ini`, the month of `dari`);
  - `rata_rata(per_bulan: dict[date, float], bulan: list[date]) -> float`: a missing month counts as 0;
  - `bulatkan(qty: float) -> int`: `max(0, ceil(round(qty, 6)))`;
  - `ada_riwayat(per_bulan: dict[date, float], bulan: list[date]) -> bool`: true when any month in `bulan` is
    above 0.

- [ ] **Step 1: Write the failing tests** (`UnitTestCase`).

```python
def test_bulan_acuan_sebelum_bulan_berjalan(self):
	self.assertEqual(bulan_acuan(date(2026, 11, 20), date(2026, 12, 1)), [date(2026, 8, 1), date(2026, 9, 1), date(2026, 10, 1)])

def test_bulan_acuan_dari_mundur(self):
	self.assertEqual(bulan_acuan(date(2026, 11, 20), date(2026, 10, 15)), [date(2026, 7, 1), date(2026, 8, 1), date(2026, 9, 1)])

def test_bulan_acuan_lewat_tahun(self):
	self.assertEqual(bulan_acuan(date(2027, 1, 5), date(2027, 2, 1)), [date(2026, 10, 1), date(2026, 11, 1), date(2026, 12, 1)])

def test_rata_rata_bulan_kosong_nol(self):
	b = [date(2026, 8, 1), date(2026, 9, 1), date(2026, 10, 1)]
	self.assertAlmostEqual(rata_rata({date(2026, 9, 1): 300, date(2026, 10, 1): 400}, b), 233.3333, places=3)

def test_bulatkan(self):
	self.assertEqual([bulatkan(x) for x in (233.34, 233.0, 233.0000000001, 0, -5, 0.0000001)], [234, 233, 233, 0, 0, 0])

def test_ada_riwayat(self):
	b = [date(2026, 9, 1)]
	self.assertEqual([ada_riwayat({}, b), ada_riwayat({b[0]: 0}, b), ada_riwayat({b[0]: 5}, b)], [False, False, True])
```

- [ ] **Step 2: Run them.** Expected: FAIL (ImportError).
- [ ] **Step 3: Implement the four functions.** Use `frappe.utils.add_months` and `get_first_day`; there is no DB
  access.
- [ ] **Step 4: Run them again.** Expected: 6 tests OK.
- [ ] **Step 5: Commit** `feat(perencanaan): forecast math, last 3 full months averaged and rounded up`.

### Task 11: Fill the forecast from history

**Files:**
- Create: `erp_internal/perencanaan/forecast.py`, `erp_internal/public/js/sales_forecast.js`,
  `erp_internal/tests/test_forecast.py`.
- Modify: `hooks.py` (`doctype_js = {"Sales Forecast": "public/js/sales_forecast.js"}`) and `tests/utils.py`.

**Interfaces:**
- Consumes: `rumus.bulan_acuan`, `rata_rata`, `bulatkan` and `ada_riwayat` (Task 10); `Riwayat Penjualan`
  (Task 9).
- Produces:
  - `forecast.qty_per_bulan(company: str, items: list[str], dari: date, sampai: date) -> dict[str, dict[date,
    float]]`: item → first of month → quantity. It adds Riwayat Penjualan `qty` to Sales Order Item `stock_qty`, from
    Sales Orders with `docstatus` 1 of the company, grouped by the month of `transaction_date`.
  - `forecast.isi(doc: Document, hari_ini: date) -> dict`, which does no permission check, and
    `@frappe.whitelist() forecast.isi_dari_riwayat(sales_forecast: str) -> dict`. Both return `{"diisi": int,
    "tanpa_riwayat": list[str], "bulan": list[str]}`, with months as "MM-YYYY".
  - `tests/utils.py` `buat_order(company: str, pelanggan: str, kode: str, qty: float, tanggal: date, kirim: date,
    satuan: str | None = None, submit: bool = True) -> Document` and `buat_perkiraan(company: str, items: list[str],
    dari: date, periode: int) -> Document`. `buat_perkiraan` makes a draft Monthly Sales Forecast with
    `parent_warehouse` set to the company's root warehouse.

Rules:
- `isi_dari_riwayat` first calls `frappe.has_permission("Sales Forecast", "write", doc=doc, throw=True)`.
- The doc must be a draft with `frequency` "Monthly", else `frappe.throw("Isi dari Riwayat cuma untuk Perkiraan
  Penjualan bulanan yang masih draf.")`. Then it calls `isi(doc, getdate(today()))` and `doc.save()`.
- `isi`:
  1. With no `items` rows, call `doc.generate_demand()`. If there are also no `selected_items`,
     `frappe.throw("Pilih barangnya dulu.")`.
  2. The months are `bulan_acuan(hari_ini, doc.from_date)`.
  3. Every row of an item gets `bulatkan(rata_rata(...))`.
  4. An item without history gets 0 and is listed in `tanpa_riwayat`.
- JS: a button "Isi dari Riwayat" when `frm.doc.docstatus === 0 && !frm.is_new()`. It calls the method with
  `freeze: true`, then `frm.reload_doc()` and `frappe.msgprint`. The message is "Diisi dari rata-rata {bulan}." plus,
  when the list is non-empty, "Belum ada riwayat: {barang}. Isi angkanya manual."

- [ ] **Step 1: Write the failing tests.** Let `m(k)` be the first day of the month `k` months before today. Item A
  has Riwayat 300 in each of `m(3)`, `m(2)` and `m(1)`. The forecast starts at `m(-1)` with 2 periods.
  - `test_rata_rata_dari_riwayat`: both rows of A get 300; `bulan` lists the three months.
  - `test_order_ikut_dihitung`: B has no Riwayat. Sales Orders of 100 in `m(2)` and 200 in `m(1)` give 100.
  - `test_satuan_lain_dihitung_stok_qty` (Review Focus 2): C ordered as 3 Karton (24) in each month gives 72.
  - `test_draf_batal_dan_amend` (Review Focus 3): D gets a draft order of 999, a cancelled order of 999, and an order
    of 30 that is cancelled and amended to 30. The result is 10.
  - `test_perusahaan_lain_diabaikan` (Review Focus 5): an order of A for `_Uji Pabrik 2` changes nothing.
  - `test_tanpa_riwayat`: E gets 0 and `"E" in tanpa_riwayat`.
  - `test_ditolak_sesudah_submit_atau_mingguan`: a submitted forecast and a Weekly one both raise
    `frappe.ValidationError` from `isi_dari_riwayat`.
  - `test_izin`: as a user with Role Profile Gudang, `isi_dari_riwayat` raises `frappe.PermissionError`.
- [ ] **Step 2: Run them.** Expected: FAIL (ImportError).
- [ ] **Step 3: Implement** `qty_per_bulan` (two grouped queries, summed in Python), `isi`, `isi_dari_riwayat` and
  the JS.
- [ ] **Step 4: Run them again.** Expected: 8 tests OK. Then `bench build --app erp_internal` and try the button on
  `erp.localhost`.
- [ ] **Step 5: Commit** `feat(perencanaan): fill Sales Forecast from sales history and orders`.

### Task 12: The production flow (defaults and a chain test)

**Files:**
- Modify: `setup.py` (`_produksi()` appended to `pastikan_setup`) and `tests/utils.py`.
- Create: `erp_internal/tests/test_alur_produksi.py`, `docs/panduan/produksi.md`.

**Interfaces:**
- Consumes: `forecast.isi` (Task 11), ERPNext's `create_mps`, the MRP report's `execute` and `make_stock_entry`.
- Produces:
  - `tests/utils.py` `buat_bom(kode: str, bahan: dict[str, float], jumlah: float = 1) -> str` (submitted, default);
  - `lama_produksi(kode: str, per_hari: float, cadangan: float = 0, beli_hari: float = 0) -> str`, which gets or
    creates the Item Lead Time.

Settings:
- Manufacturing Settings:
  - `default_wip_warehouse` = Gudang Produksi, `default_fg_warehouse` = Gudang Barang Jadi and
    `default_scrap_warehouse` = Gudang Reject, all of the first Pabrik company by creation;
  - `backflush_raw_materials_based_on` "BOM".
- Item Group defaults per Pabrik company: Barang Jadi → Gudang Barang Jadi; Bahan Baku, Bahan Penolong and Kemasan →
  Gudang Bahan Baku.

- [ ] **Step 1: Write the failing chain test** `test_forecast_sampai_barang_jadi`:
  1. Fixtures: `_UJI-EMBER` (Barang Jadi) with BOM 0.25 Kg `_UJI-BIJI-PP` + 1 `_UJI-KEMASAN`, and Item Lead Time
     500 per day with 1 buffer day. Riwayat of 3000 in each of the last 3 months. Stock of the raw materials is
     enough for 3000.
  2. `buat_perkiraan` from next month, 1 period, then `forecast.isi(doc, today())`. Its row is 3000. Submit.
  3. `create_mps(sf.name)`, then insert.
  4. Run the MRP report `execute` with `company`, `from_date`, `to_date`, `mps` and the default filters from its JS.
     The `_UJI-EMBER` row has `required_qty` 3000.
  5. A Work Order of 3000 made with no warehouses set gets `wip_warehouse` Gudang Produksi - _UP and `fg_warehouse`
     Gudang Barang Jadi - _UP.
  6. After material transfer and `make_stock_entry(wo, "Manufacture", 3000)`, the finished-goods Bin grows by 3000
     and the PP Bin shrinks by 750.
- [ ] **Step 2: Run it.** Expected: FAIL (the Work Order's warehouses are empty or wrong).
- [ ] **Step 3: Implement `_produksi()`.**
- [ ] **Step 4: Run it again.** Expected: OK. If ERPNext's MRP API differs from this description, stop and report
  the difference; don't patch ERPNext.
- [ ] **Step 5: Write `docs/panduan/produksi.md`** in plain Indonesian:
  - filling Item Lead Time and BOM;
  - each month: Perkiraan Penjualan → Isi dari Riwayat → check → submit → Jadwal Produksi Induk → MRP → Perintah
    Produksi;
  - every Monday: Siap Order.
- [ ] **Step 6: Commit** `feat(produksi): manufacturing defaults and the forecast-to-stock chain test`.

### Task 13: The Siap Order report

**Files:**
- Create: `erp_internal/perencanaan/report/siap_order/{siap_order.json,siap_order.py,siap_order.js}`,
  `erp_internal/tests/test_siap_order.py`.
- Modify: `rumus.py` (two functions), `tampilan.SIDEBAR["Manufacturing"]` ("Siap Order" first),
  `tests/test_tampilan.py` (a report permission test).

**Interfaces:**
- Consumes:
  - `setup.gudang`, `tests.utils.buat_order`, `buat_perkiraan`, `buat_bom`, `lama_produksi` and `stok_awal`;
  - ERPNext `erpnext.manufacturing.doctype.master_production_schedule.master_production_schedule.get_own_lead_time(lead_time,
    qty, is_manufactured)`.
- Produces:
  - `rumus.STATUS = ("Telat", "Mulai minggu ini", "Isi lama produksi", "Terjadwal", "Aman")`, which is also the sort
    order;
  - `rumus.hitung_kurang(stok: float, terbuka: float, perkiraan: float, dipesan: float, produksi: float, safety:
    float) -> int`;
  - `rumus.hitung_jadwal(kurang: int, lama: float | None, terbuka: float, terdekat: date | None, stok: float,
    produksi: float, awal: date, hari_ini: date) -> dict` → `{"tanggal_butuh": date | None, "mulai": date | None,
    "status": str}`;
  - `siap_order.data(company: str, bulan: date, gudang: str, item_group: str, hari_ini: date) -> list[dict]` and
    `siap_order.execute(filters=None)`.

Formula: spec §10, exactly. `hitung_kurang` is `butuh` and `kurang`. `hitung_jadwal` handles the statuses in this
order:
1. `kurang` 0 → Aman, with no dates.
2. `lama` None → Isi lama produksi, with no dates.
3. Otherwise compute `tanggal_butuh` and `mulai` and apply the date statuses.

Report:
- Script Report "Siap Order", module Perencanaan, ref doctype Work Order.
- Roles: Manufacturing User, Manufacturing Manager, Sales User, Sales Manager, System Manager.
- Filters:
  - `company` (Link, required, default the user's default company);
  - `bulan` (Date, default the first day of this month);
  - `gudang` (Link Warehouse; empty means `setup.gudang(company, "Gudang Barang Jadi")`);
  - `item_group` (Link, default "Barang Jadi", children included by lft/rgt).
- Rows: every enabled stock item in the group, sorted by `STATUS` and then by `mulai`.
- Columns (label, fieldname):
  - Produk `item_code`, Nama `item_name`, Stok `stok`;
  - Order Belum Dikirim `terbuka`, Perkiraan Bulan Ini `perkiraan`, Sudah Dipesan Bulan Ini `dipesan`;
  - Sedang Diproduksi `produksi`, Safety Stock `safety`, Kurang `kurang`;
  - Lama Produksi (hari) `lama`, Mulai Paling Lambat `mulai`, Status `status`.
- The JS formatter colours the status: Telat red, Mulai minggu ini orange, Terjadwal blue, Aman green, Isi lama
  produksi grey.

- [ ] **Step 1: Write the failing unit tests for `rumus`.**

```python
H = date(2026, 11, 20)

def test_contoh_spesifikasi(self):
	kurang = hitung_kurang(stok=100, terbuka=300, perkiraan=1000, dipesan=300, produksi=50, safety=20)
	self.assertEqual(kurang, 870)
	j = hitung_jadwal(kurang, lama=5.35, terbuka=300, terdekat=date(2026, 11, 25), stok=100, produksi=50, awal=date(2026, 11, 1), hari_ini=H)
	self.assertEqual(j, {"tanggal_butuh": date(2026, 11, 25), "mulai": date(2026, 11, 19), "status": "Telat"})

def test_aman(self):
	self.assertEqual(hitung_jadwal(0, None, 0, None, 500, 0, date(2026, 11, 1), H), {"tanggal_butuh": None, "mulai": None, "status": "Aman"})

def test_isi_lama_produksi(self):
	self.assertEqual(hitung_jadwal(10, None, 10, H, 0, 0, date(2026, 11, 1), H)["status"], "Isi lama produksi")

def test_mulai_minggu_ini_dan_terjadwal(self):
	self.assertEqual(hitung_jadwal(10, 2, 10, date(2026, 11, 25), 0, 0, date(2026, 11, 1), H)["status"], "Mulai minggu ini")
	self.assertEqual(hitung_jadwal(10, 2, 10, date(2026, 12, 15), 0, 0, date(2026, 11, 1), H)["status"], "Terjadwal")

def test_kurang_cuma_dari_perkiraan(self):
	# orders are covered, so the need date is the month start, or today once it has started
	self.assertEqual(hitung_jadwal(100, 3, 0, None, 0, 0, date(2026, 12, 1), H)["tanggal_butuh"], date(2026, 12, 1))
	self.assertEqual(hitung_jadwal(100, 3, 0, None, 0, 0, date(2026, 11, 1), H)["tanggal_butuh"], H)
```

- [ ] **Step 2: Write the failing integration tests** for `siap_order.data`. Each one builds its own items on
  `_Uji Pabrik`.
  - `test_angka_per_kolom`: stock 100, an open order of 300 due in 5 days, a submitted forecast of 1000 for this
    month, 300 already ordered this month, a not-started Work Order of 50, safety 20, and Item Lead Time 200 per day
    with buffer 1. Expected: `kurang` 870, `lama` 5.35, status Telat.
  - `test_order_satuan_lain` (Review Focus 2): an open order of 2 Karton (24) gives `terbuka` 48.
  - `test_tanpa_lama_produksi` (Review Focus 4): no Item Lead Time and `kurang` > 0 give "Isi lama produksi" with
    `mulai` None.
  - `test_perusahaan_lain_diabaikan` (Review Focus 5): orders, stock, a forecast and a Work Order of `_Uji Pabrik 2`
    for the same item change nothing.
  - `test_order_selesai_diabaikan`: Closed and Completed orders don't count in `terbuka`.
  - `test_perkiraan_terbaru_dipakai`: of two submitted forecasts for the month, the one with the newer
    `posting_date` is used.
  - In `test_tampilan`, `test_izin_siap_order`: `frappe.get_doc("Report", "Siap Order").is_permitted()` is true as
    Produksi and Penjualan, false as Gudang.
- [ ] **Step 3: Run them.** Expected: FAIL (ImportError, report missing).
- [ ] **Step 4: Implement** the two `rumus` functions, then the report:
  - one grouped query each for stock, open orders (with the earliest date), orders this month, the newest forecast
    and Work Orders;
  - Item Lead Time rows read with the fields `get_own_lead_time` uses;
  - JSON by hand, then migrate.
- [ ] **Step 5: Run them again.** Expected: OK. Then open the report on `erp.localhost` as Administrator.
- [ ] **Step 6: Commit** `feat(perencanaan): Siap Order report, what is short and when to start`.

### Task 14: Go-live wave 2, production

Manual, with Samuel. It needs his answers to questions 2 and 4 and the factory's history.

- [ ] **Step 1: Import Riwayat Penjualan** for at least the 3 months before the go-live month, using
  `docs/impor.md`. Totals per month must equal Samuel's file.
- [ ] **Step 2: Enter production data.**
  - Item Lead Time for every finished product: capacity per day and buffer, from Samuel.
  - BOMs: the 20 products with the most volume first.
  - Safety stock only where Samuel gives a number (default 0).
- [ ] **Step 3: First forecast.** Next month's Perkiraan Penjualan → Isi dari Riwayat → review with Samuel →
  submit → Jadwal Produksi Induk → MRP → Perintah Produksi.
- [ ] **Step 4: Train** Produksi and Penjualan with `docs/panduan/produksi.md`.
- [ ] **Step 5: Accept.** Siap Order lists every finished product with a status, and five products checked by hand
  agree. Write the date in CLAUDE.md.

---

## Part C: the office (attendance and projects)

### Task 15: Attendance (HRMS)

**Files:**
- Modify: `setup.py` (`_kantor()` appended to `pastikan_setup`).
- Create: `erp_internal/tests/test_absen.py`, `docs/panduan/absen.md`.

**Interfaces:**
- Consumes: `setup.perusahaan("Kantor")`; HRMS test helpers as references (`hrms/hr/doctype/shift_type/test_shift_type.py`,
  `employee_checkin/test_employee_checkin.py`).
- Produces:
  - `setup.SHIFT_KANTOR`:

    ```python
    {"name": "Kantor", "start_time": "08:00:00", "end_time": "17:00:00", "enable_auto_attendance": 1,
     "determine_check_in_and_check_out": "Alternating entries as IN and OUT during the same shift",
     "working_hours_calculation_based_on": "First Check-in and Last Check-out",
     "begin_check_in_before_shift_start_time": 60, "allow_check_out_after_shift_end_time": 120,
     "late_entry_grace_period": 10, "enable_late_entry_marking": 1, "early_exit_grace_period": 10,
     "enable_early_exit_marking": 1}
    ```

  - `setup.JENIS_CUTI = {"Cuti Tahunan": {"max_leaves_allowed": 12, "is_lwp": 0}, "Sakit": {"is_lwp": 0}, "Izin":
    {"is_lwp": 1}}`.

Settings:
- HR Settings `allow_employee_checkin_from_mobile_app` 1 and `allow_geolocation_tracking` 1.
- Per Kantor company, a Holiday List "Libur <abbr> <year>" for this year and next. Saturdays and Sundays are weekly
  offs, and national holidays are left for HR to enter. It is the company's default holiday list and the shift's.
- `process_attendance_after` is site config `erp_mulai_absen`, or today when the shift is first created.

- [ ] **Step 1: Write the failing tests** on an employee of `_Uji Kantor` with a "Kantor" shift assignment, on a
  past working day.
  - `test_hadir_tepat_waktu`: check-ins at 08:05 (IN) and 17:10 (OUT), then `process_auto_attendance()`. Expected:
    Attendance "Present" with `late_entry` 0.
  - `test_telat`: IN at 08:25 gives `late_entry` 1.
  - `test_cuti_tahunan_maks_12`: with an allocation of 12, a 13-day Leave Application raises
    `frappe.ValidationError`.
  - `test_sabtu_bukan_alpa`: no "Absent" is marked on a Saturday.
- [ ] **Step 2: Run them.** Expected: FAIL (shift "Kantor" missing).
- [ ] **Step 3: Implement `_kantor()`.**
- [ ] **Step 4: Run them again.** Expected: 4 tests OK.
- [ ] **Step 5: Write `docs/panduan/absen.md`** in plain Indonesian:
  - open `https://erp.<domain>/hrms` on the phone → Add to Home Screen;
  - check in and check out, with location allowed;
  - apply for leave;
  - for HR: entering national holidays each year from the SKB.
- [ ] **Step 6: Commit** `feat(absen): office shift with auto attendance, holidays, leave types`.

### Task 16: Projects

**Files:**
- Modify: `setup.py` (`_proyek()` appended to `pastikan_setup`).
- Create: `erp_internal/tests/test_proyek.py`, `docs/panduan/proyek.md`.

**Interfaces:**
- Produces: `setup.JENIS_KEGIATAN = ("Pengembangan", "Rapat", "Dukungan Klien", "Administrasi")`, Activity Types with
  no billing or costing rates.

- [ ] **Step 1: Write the failing tests.**
  - `test_alur_proyek`: a Manajer Proyek user creates a Project and a Task assigned to a Karyawan user. The Karyawan
    user creates and submits their own Timesheet: 2 hours, activity "Pengembangan", on that Task. The Task's
    `actual_time` is then 2.
  - `test_jenis_kegiatan`: all four Activity Types exist.
  - `test_gudang_tidak_baca_proyek`: as Gudang, `frappe.has_permission("Project", "read")` is false.
- [ ] **Step 2: Run them.** Expected: FAIL (Activity Types missing).
- [ ] **Step 3: Implement `_proyek()`** and run again. Expected: 3 tests OK.
- [ ] **Step 4: Write `docs/panduan/proyek.md`** in plain Indonesian: projects, tasks, the daily timesheet, and what
  the Manajer Proyek checks each week.
- [ ] **Step 5: Commit** `feat(proyek): activity types and the project flow`.

### Task 17: Go-live wave 3, the office

Manual, with Samuel. It needs his answers to questions 5 and 7.

- [ ] **Step 1: Import the employees** (name, gender, date of birth, joining date, company Kantor), with a Data
  Import template made like Task 6's. Counts must equal the list.
- [ ] **Step 2: Create the users.**
  - Role Profile Karyawan, HR or Manajer Proyek; Module Profile "Kantor"; a User Permission on the office company;
    `Employee.user_id` linked.
  - Shift assignments to "Kantor".
  - Leave allocations of Cuti Tahunan 12.
  - HR enters this year's national holidays.
- [ ] **Step 3: Phones.** Install Frappe HR on each phone with `docs/panduan/absen.md`.
- [ ] **Step 4: First week.** Compare attendance with the current method daily and fix missed check-ins.
- [ ] **Step 5: Projects.** Enter the current projects and tasks, and start daily timesheets.
- [ ] **Step 6: Accept.** One week of attendance with every gap explained, and every active project has tasks and
  timesheets. Write the date in CLAUDE.md.
