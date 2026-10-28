# ERP Internal

ERPNext v16 for the plastic factory (stock, sales, purchasing, production with a monthly forecast) and the office
(attendance, projects). This repo is the Frappe app `erp_internal`.

- Design: `docs/superpowers/specs/2026-10-27-erp-internal-design.md`
- Plan: `docs/superpowers/plans/2026-10-27-erp-internal-plan.md` (read its "Revision 2" and "Revision 3" first)

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
   7. `wizard`: completes the setup wizard of `erp.localhost` without a browser, ticks PT Contoh Plastik's `erp_aktif` (Run by ERP Internal) and runs
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
| Company | PT Contoh Plastik (DATA CONTOH) |
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

The Apps screen tiles and each module's rail top slot show the same mark, and the tiles are named Operations
(ERPNext), HR (Frappe HR) and System (Frappe, Developer only); Indonesian: Operasional, SDM, Sistem. That is
`tampilan.merek_aplikasi` (`extend_bootinfo`, the boot copy of `app_data` only).

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

Browser check of each role's screens (needs `bench start` and the sample users `developer@`, `admin@`, `user@contoh.test` of `contoh.py`):
`cd tools && npm install && npx playwright install chromium`, then `ERP_SANDI=<password> node tools/cek_layar.mjs`
(the password is `SAMPLE_PASSWORD` in the bench's `.env`). Screenshots land in `tools/hasil/` (not committed). The user guides' pictures (`docs/panduan/gambar/`) are retaken the same way with `tools/panduan_gambar.mjs`. If
`bench build` ran while `bench start` was up, restart `bench start` first: the web process keeps the old
`assets.json` and the desk loads blank. If `bench start` stops at once with "Address already in use" on 11002 or
13002, a Redis from an earlier run is still up: `lsof -nP -iTCP:11002 -iTCP:13002 -sTCP:LISTEN`, stop those
`redis-server` processes, start again.

## Factory flow and data import

- Every Delivery Note and Purchase Receipt comes from an order, stock never goes negative, stock posts no journal
  entries, and the company gets PPN templates that are never the default (not PKP: invoices only record) (`setup._alur_jual_beli`). Staff guides:
  `docs/panduan/{penjualan,pembelian,gudang}.md`.
- Importing the old data (items, customers, suppliers, opening stock): `docs/impor.md`; its CSV files are tested
  by `erp_internal/tests/test_impor.py` (`erp_internal/tests/data/`). Sales History (monthly quantities per item):
  `docs/impor.md` section 5, tested by `tests/test_sales_history.py` (`tests/data/riwayat.csv`).
- Production (`erp_internal/planning/`, module Planning): the company's Work Orders default to its Gudang
  Produksi / Barang Jadi / Reject and items to their group's warehouse (`setup._produksi`). A draft monthly Sales
  Forecast gets "Fill from History" (`planning/forecast.py`: the last 3 full months of Sales History and submitted
  orders, rounded up), then MPS → MRP → Work Order; the Order Readiness report shows what is short and when to
  start (`planning/rumus.py`, design §10). It needs read permission on the chosen Company (and Warehouse);
  other companies' stock is refused. Staff guide: `docs/panduan/produksi.md`.

## Roles

Three Role Profiles (`erp_internal/tampilan.py` `PROFIL_PERAN`), all in the one company:

- **User**: daily work in every used module (stock entries, orders, deliveries, receipts, invoices, work orders,
  timesheets, own check-ins and leave). No settings, no users.
- **Admin**: also the manager roles (items, suppliers, BOMs, stock reconciliation, HR), users and the business
  settings (rail entry Settings). `erp_internal/pengguna.py` lets an Admin give only the Admin and User roles and
  never change a Developer's account. Guide: `docs/panduan/admin.md`.
- **Developer**: Admin plus System Manager (Build, System Settings).

## Office: attendance and projects

- Attendance by phone with location on stock HRMS (`setup._kantor`): one shift "Kantor" 08:00-17:00 with auto
  attendance (`SHIFT_KANTOR`), Saturday and Sunday off in a yearly "Libur <abbr> <year>" list assigned to the
  company, leave types Cuti Tahunan (12), Sakit, Izin. Staff guide: `docs/panduan/absen.md`.
- Projects (`setup._proyek`): Activity Types Pengembangan, Rapat, Dukungan Klien, Administrasi without rates; a
  User submits only their own timesheets (`erp_internal/proyek.py`); Admin and Developer can submit
  anyone's. Staff guide: `docs/panduan/proyek.md`.

## Sample data

`erp_internal/contoh.py` fills a dev site with DATA CONTOH (tagged): one sample company (PT Contoh Plastik), products
with BOMs, lead times and stock, customers, suppliers, 6 months of Sales History, open orders, employees on the
shift, one project, and one user per role (`developer@`, `admin@`, `user@contoh.test`):

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
