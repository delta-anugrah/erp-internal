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
   7. `wizard`: completes the setup wizard of `erp.localhost` without a browser, sets PT Contoh Plastik's Jenis to Pabrik and runs
      `migrate`, which builds the factory warehouses, item groups, UOMs and production defaults (`erp_internal/setup.py`).
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

No extra user is created; Administrator only. `erp-test.localhost` is completed by HRMS's `before_tests` on the
first test run (company `_Test Company`, INR; our tests make their own IDR companies and price lists).

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

Browser check of each bagian's screens (needs `bench start` and the sample users of `contoh.py`):
`cd tools && npm install && npx playwright install chromium`, then `ERP_SANDI=<password> node tools/cek_layar.mjs`.
Screenshots land in `tools/hasil/` (not committed).

## Factory flow and data import

- Every Delivery Note and Purchase Receipt comes from an order, stock never goes negative, stock posts no journal
  entries, and each factory gets PPN templates that are not the default (`setup._alur_jual_beli`). Staff guides:
  `docs/panduan/{penjualan,pembelian,gudang}.md`.
- Importing the old data (items, customers, suppliers, opening stock): `docs/impor.md`; its CSV files are tested
  by `erp_internal/tests/test_impor.py` (`erp_internal/tests/data/`). Sales History (monthly quantities per item):
  `docs/impor.md` section 5, tested by `tests/test_sales_history.py` (`tests/data/riwayat.csv`).
- Production (`erp_internal/planning/`, module Planning): each factory's Work Orders default to its Gudang
  Produksi / Barang Jadi / Reject and items to their group's warehouse (`setup._produksi`). A draft monthly Sales
  Forecast gets "Fill from History" (`planning/forecast.py`: the last 3 full months of Sales History and submitted
  orders, rounded up), then MPS → MRP → Work Order; the Order Readiness report shows what is short and when to
  start (`planning/rumus.py`, design §10). It needs read permission on the chosen Company (and Warehouse);
  other companies' stock is refused. Staff guide: `docs/panduan/produksi.md`.

## Office: attendance and projects

- Attendance by phone with location on stock HRMS (`setup._kantor`): one shift "Kantor" 08:00-17:00 with auto
  attendance (`SHIFT_KANTOR`), Saturday and Sunday off in a yearly "Libur <abbr> <year>" list assigned to each
  office company, leave types Cuti Tahunan (12), Sakit, Izin. Staff guide: `docs/panduan/absen.md`.
- Projects (`setup._proyek`): Activity Types Pengembangan, Rapat, Dukungan Klien, Administrasi without rates; a
  Karyawan submits only their own timesheets (`erp_internal/proyek.py`); Projects and HR roles can
  submit anyone's. Staff guide: `docs/panduan/proyek.md`.

## Sample data

`erp_internal/contoh.py` fills a dev site with DATA CONTOH (tagged): both sample companies, products with BOMs,
lead times and stock, customers, suppliers, 6 months of Sales History, open orders, office employees on the shift,
one project, and one user per bagian (`<bagian>@contoh.test`):

```bash
bench --site erp.localhost set-config erp_sandi_contoh <password>
bench --site erp.localhost execute erp_internal.contoh.buat_contoh
```

It is idempotent and refuses to run on a site with `erp_produksi` set.

## Server

The image is built from `deploy/Containerfile` (Frappe, ERPNext and HRMS at the tags in `versi.json`) by
`.github/workflows/image.yml` on a `vX.Y.Z` tag and checked by `deploy/check_image.sh`. The stack, backups
(`cadangan.sh`) and the runbook: `deploy/server/README.md`. Locally:

```bash
docker build -f deploy/Containerfile -t erp-internal:uji . && deploy/check_image.sh erp-internal:uji
```
