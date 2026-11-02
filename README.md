# ERP Internal

ERPNext v16 for the plastic factory (stock, sales, purchasing, production with a monthly forecast) and the office
(attendance, projects). This repo is the Frappe app `erp_internal`.

- Design: `docs/superpowers/specs/2026-10-27-erp-internal-design.md`
- Plan: `docs/superpowers/plans/2026-10-27-erp-internal-plan.md` (read its "Revision 2", "Revision 3" and "Revision 4" first)
- Plan vs Actual: spec `docs/superpowers/specs/2026-10-28-plan-vs-actual-design.md`, plan
  `docs/superpowers/plans/2026-10-29-plan-vs-actual-plan.md`

## Dev setup (macOS)

Needs Docker, `python3.14`, Node 24 with yarn, `redis-server` and `pipx install frappe-bench`.

1. Create `~/Desktop/Projects/erp-internal-bench/.env` (mode 0600) with `DB_ROOT_PASSWORD=...` and
   `ADMIN_PASSWORD=...`. Never commit it. Another folder: set `ERP_BENCH`.
2. Run `tools/setup_bench.sh`. It skips every part that already exists:
   1. `db`: container `erp-mariadb` (mariadb:11.8.9, 127.0.0.1:3308, utf8mb4);
   2. `bench`: `bench init` with the Frappe tag from `versi.json` and Python 3.14;
   3. `ports`: web 8002, socketio 9002, redis queue 11002, redis cache 13002, DB 127.0.0.1:3308;
   4. `apps`: erpnext and hrms at their pinned tags;
   5. `link`: `apps/erp_internal` → this repo, `pip install -e`, `sites/apps.txt`;
   6. `sites`: `erp.localhost` and `erp-test.localhost` (`allow_tests`) with erpnext, hrms and erp_internal;
   7. `wizard`: completes the setup wizard of `erp.localhost` without a browser, ticks PT Delta Anugrah's `erp_aktif` (Run by ERP Internal) and runs
      `migrate`, which builds its warehouses, item groups, UOMs, production defaults and holiday lists (`erp_internal/setup.py`).
3. `cd ~/Desktop/Projects/erp-internal-bench && bench start`, then open http://erp.localhost:8002 and sign in as
   Administrator.

### Setup wizard values (erp.localhost)

| Field | Value |
|---|---|
| Language | English |
| Country | Indonesia |
| Time zone | Asia/Jakarta |
| Currency | IDR |
| Company | PT Delta Anugrah (DATA CONTOH on dev; renamed from PT Contoh Plastik 2026-10-29) |
| Abbreviation | CPL |
| Chart of accounts | Standard |
| Fiscal year | 1 January to 31 December of the current year |

No extra user is created; Administrator only. `erp-test.localhost` is completed on the first test run by our
`before_tests` hook (`erp_internal.tests.utils.sebelum_tes`), which runs HRMS's (company `_Test Company`, INR; our
tests make their own IDR companies and price lists) and then our setup. That first run takes about 8 minutes.

## Branding

The site shows PT Delta Anugrah's mark and the name "Delta Anugrah" on the login page, the top left of the Apps
screen, the loading splash and the browser tab. Setup sets it on every migrate (`setup.MEREK`, System Settings
`app_name`). The files are `erp_internal/public/images/`: `delta-anugrah.svg` (the vector, redrawn by hand from the
original 200 px `delta-anugrah.jpeg`, kept beside it), and rendered from the SVG `delta-anugrah.png` (512 px,
transparent), `favicon-32.png` and `favicon-192.png`. Settings point at the SVG; the favicon stays PNG.

The Apps screen tiles are named ERP (ERPNext), HR (Frappe HR), Production Floor (the floor page, for Manufacturing
User) and System (Frappe, Developer only); Indonesian: ERP, SDM, Sistem. Each has its own icon in one style, a Delta-blue rounded square with a white Lucide glyph
(ISC licence): `aplikasi-erp.svg` (factory), `aplikasi-hr.svg` (users), `aplikasi-sistem.svg` (settings), `aplikasi-lantai.svg` (gauge). The
rail's top slot inside an app shows that app's icon. That is `tampilan.merek_aplikasi` (`extend_bootinfo`, the boot
copy of `app_data` only); a workspace saved from the desk keeps them (`erp_internal/ruang_kerja.py`).

## Language

The UI is English. Each user switches to Indonesian, and back, from the user menu ("Bahasa Indonesia" /
"English"); the Indonesian is `erp_internal/translations/id.csv`. Dates, numbers, time zone and currency are
Indonesian for everyone.

## Tests

```bash
cd ~/Desktop/Projects/erp-internal-bench
bench --site erp-test.localhost run-tests --app erp_internal
bench --site erp-test.localhost run-tests --module erp_internal.tests.test_situs   # one file
```

Browser check of each role's screens (needs `bench start` and the sample users `developer@`, `admin@`, `user@example.com` of `contoh.py`):
`cd tools && npm install && npx playwright install chromium`, then `ERP_SANDI=<password> node tools/cek_layar.mjs`
(the password is `SAMPLE_PASSWORD` in the bench's `.env`). Screenshots land in `tools/hasil/` (not committed). The user guides' pictures (`docs/panduan/gambar/`) are retaken the same way with `tools/panduan_gambar.mjs` (name a picture to retake only it: `produksi-1`).
`tools/lantai.mjs` checks the Production Floor page (`/desk/production-floor`, Manufacturing's first link) the same
way: the 14 machines in floor order, status lamps, labels, the side panel and its status buttons, live updates, the
info bar, the attention card, the loading screen, the dark decor, the glass look in light and dark, a plain table without WebGL, and the smoothness budget (frame rate,
dropped frames, long tasks, draw calls) in a visible browser; the header of `tools/lantai.mjs` lists the cases; `.claude/rules/lantai.md` has the budget and the lessons. If
`bench build` ran while `bench start` was up, restart `bench start` first: the web process keeps the old
`assets.json` and the desk loads blank. If `bench start` stops at once with "Address already in use" on 11002 or
13002, a Redis from an earlier run is still up: `lsof -nP -iTCP:11002 -iTCP:13002 -sTCP:LISTEN`, stop those
`redis-server` processes, start again.

## Factory flow and data import

- A Delivery Note is made directly (Samuel 2026-11-02: no Sales Orders for now), every Purchase Receipt comes from
  an order, stock never goes negative, stock posts no journal
  entries, and the company gets PPN templates that are never the default (not PKP: invoices only record) (`setup._alur_jual_beli`). Staff guides:
  `docs/panduan/{penjualan,pembelian,gudang}.md`.
- Importing the old data (items, customers, suppliers, opening stock): `docs/impor.md`; its CSV files are tested
  by `erp_internal/tests/test_impor.py` (`erp_internal/tests/data/`). Sales History (monthly quantities per item):
  `docs/impor.md` section 5, tested by `tests/test_sales_history.py` (`tests/data/riwayat.csv`).
- Samuel's real master data (Dinda House Ware price list, 14 injection machines): `bench --site erp.localhost
  execute erp_internal.master.muat` reads `erp_internal/data/{katalog,mesin}.json` (templates with only the listed
  variants, packings, price list `Harga Pola 2026`, also the Sales Order default while Selling Settings still says Standard Selling, Workstations `Mesin 01`..`14`); rerun after a new file
  (`docs/impor.md`, tested by `tests/test_master.py`).
- Samuel's sales Excel (2026-10-29), after `master.muat`: `bench --site erp.localhost execute erp_internal.penjualan.muat`
  reads `erp_internal/data/penjualan_2026.json`: the types and products it sells beyond the price list, 7 raw
  materials with their price per kg, Sales History January-September 2026 (spread evenly over the colours) and each
  variant's `safety_stock` (half an average month) (`docs/impor.md` "Excel penjualan Samuel", tested by
  `tests/test_penjualan.py`).
- Production (`erp_internal/planning/`, module Planning): the company's Work Orders default to its Gudang
  Produksi / Barang Jadi / Reject and items to their group's warehouse (`setup._produksi`). A draft monthly Sales
  Forecast gets "Fill from History" (`planning/forecast.py`: the last 3 full months of Sales History and submitted
  orders, rounded up), then MPS → MRP → Work Order; the Order Readiness report shows what is short and when to
  start (`planning/rumus.py`, design §10). It needs read permission on the chosen Company (and Warehouse);
  other companies' stock is refused. Staff guide: `docs/panduan/produksi.md`.
- Production (capacity and output): Machine Capacity per product per machine (`planning/kapasitas.py`). "Make BOMs"
  and the Excel import (`docs/impor.md` section 6) build one default BOM per variant per machine; a draft Work Order
  with a machine gets that machine's BOM (`pilih_bom`). Production Entry ("Record Output" on a Work Order) books the
  good pieces (Manufacture) and the rejects (Repack into Gudang Reject) as two Stock Entries; the Plan vs Actual
  report compares them with the target. Guide: `docs/panduan/produksi.md`.

## Screens

Every module shows only what the guides' flows use (`tampilan.IKON`, `SIDEBAR`, `PINTASAN`); each home is a row of
shortcuts to the same links as its sidebar, nothing else:

| Rail icon | Home and sidebar |
|---|---|
| Stock | Stock Entry, Delivery Note, Item, Warehouse, Stock Balance, Stock Ledger |
| Selling | Customer, Open Sales Orders (Sales Order), Delivery Note, Unpaid Sales Invoices (Sales Invoice), Payment Entry, Sales History |
| Buying | Supplier, Pending Material Requests (Material Request), Purchase Order, Purchase Receipt, Purchase Invoice |
| Manufacturing | Production Floor, Sales History, Master Production Schedule, MRP, Work Orders in Process (Work Order), Production Entry, Order Readiness, Plan vs Actual, BOM, Machine Capacity, Sales Forecast, Item Lead Time |
| Projects | Open Projects (Project), My Open Tasks (Task), New Timesheet |
| HR (HR app; its home is our Workspace "HR") | Employee, Employee Checkin, Today's Attendance (Attendance), New Leave Application, Shift Type, Shift Assignment, Holiday List, Leave Allocation |
| Settings (Admin) | Users, Company, Opening Stock & Stock Count (Stock Reconciliation), Stock, Selling, Buying, Manufacturing, Reject Reason, Accounts, Projects and HR Settings |

The sidebar folds into the rail and opens again with the round arrow at the panel's bottom edge (when the panel is folded, in the dock above the profile avatar); the browser
remembers the choice (`erp_internal/public/css/erp_internal.css` keeps the arrow visible).

The table is Admin's view. A User's rail has only Stock and Manufacturing (`IKON`, `MODUL_BOLEH`); within them they see only what their roles read. A direct URL to another permitted
doctype or report still opens.

## Roles

Three Role Profiles (`erp_internal/tampilan.py` `PROFIL_PERAN`), all in the one company:

- **User** (Samuel 2026-11-02): Stock User plus `ERP User`. Creates only Production Entries, Delivery Notes made
  directly and Material Receipt stock entries, sets a machine's status on the Production Floor, and reads stock,
  items, Work Orders, BOMs and the production reports; rail Stock and Manufacturing (`erp_internal/batas_user.py`).
  Guide: `docs/panduan/user.md`.
- **Admin**: also the manager roles (Work Orders, items, suppliers, BOMs, stock reconciliation, selling, buying,
  projects, HR), users and the business
  settings (rail entry Settings). `erp_internal/pengguna.py` lets an Admin give only the Admin and User roles and
  never change a Developer's account. Guide: `docs/panduan/admin.md`.
- **Developer**: Admin plus System Manager (Build, System Settings).

## Office: attendance and projects

- Attendance by phone with location on stock HRMS (`setup._kantor`): one shift "Kantor" 08:00-17:00 with auto
  attendance (`SHIFT_KANTOR`), Saturday and Sunday off in a yearly "Libur <abbr> <year>" list assigned to the
  company, leave types Cuti Tahunan (12), Sakit, Izin. Staff guide: `docs/panduan/absen.md`.
- Projects (`setup._proyek`): Activity Types Pengembangan, Rapat, Dukungan Klien, Administrasi without rates; an
  employee (Projects User and Employee roles, outside the User profile) submits only their own timesheets (`erp_internal/proyek.py`); Admin and Developer can submit
  anyone's. Staff guide: `docs/panduan/proyek.md`.

## Sample data

`erp_internal/contoh.py` fills a dev site with DATA CONTOH (tagged): one company (PT Delta Anugrah, abbreviation CPL, with its logo), products
with BOMs, lead times and stock, customers, suppliers, 6 months of Sales History, open orders, 10 Machine Capacity rows with their BOMs, 4 open Work Orders (plus one older order without a machine) and 28 Production Entries over the last 7 days, employees on the
shift, one project, and one user per role (`developer@`, `admin@`, `user@example.com`):

```bash
bench --site erp.localhost set-config erp_sandi_contoh <password>
bench --site erp.localhost execute erp_internal.contoh.buat_contoh
```

It is idempotent (a second run writes nothing) and refuses to run on a site with `erp_produksi` set. On the dev
Mac the password is kept only in `~/Desktop/Projects/erp-internal-bench/.env` as `SAMPLE_PASSWORD`.

## Server

The image is built from `deploy/Containerfile` (Frappe, ERPNext and HRMS at the tags in `versi.json`) by
`.github/workflows/image.yml` on a `vX.Y.Z` tag and checked by `deploy/check_image.sh`. The stack, backups
(`cadangan.sh`) and the runbook: `deploy/server/README.md`. Locally:

```bash
docker build -f deploy/Containerfile -t erp-internal:uji . && deploy/check_image.sh erp-internal:uji
```
