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
      `migrate`, which builds the factory warehouses, item groups and UOMs (`erp_internal/setup.py`).
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

No extra user is created; Administrator only. `erp-test.localhost` is completed by ERPNext's `before_tests` on the
first test run.

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

Browser check of each bagian's screens (needs `bench start` and the sample users):
`cd tools && npm install && npx playwright install chromium`, then `ERP_SANDI=<password> node tools/cek_layar.mjs`.
Screenshots land in `tools/hasil/` (not committed).
