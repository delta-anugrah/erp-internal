# TODO

Order follows the plan (`docs/superpowers/plans/2026-10-27-erp-internal-plan.md`, Revisions 2 and 3 first).

## Waiting on Abel
- [ ] After the sites exist: run Tasks 2-6's, 9-13's, 15-16's and `test_contoh`'s tests, re-check `docs/impor.md`'s headers against Download Template,
      take the `docs/panduan/` screenshots (incl. `produksi.md`), try Fill from History and Order Readiness in
      the browser, then Task 7 Steps 2-4 (compose boot, `cadangan.sh`, restore drill).
- [ ] Sample data on `erp.localhost`: `bench --site erp.localhost set-config erp_sandi_contoh <password>`, then
      `bench --site erp.localhost execute erp_internal.contoh.buat_contoh`; then `ERP_SANDI=<password> node
      tools/cek_layar.mjs`, and try the phone check-in (`/hrms`) and a timesheet as `karyawan@contoh.test`.
- [ ] Create the two dev sites in your own terminal: `tools/setup_bench.sh sites wizard` (the permission check stops
      Claude from running `bench new-site`). Then `bench --site erp-test.localhost run-tests --module erp_internal.tests.test_situs`.

## Waiting on Mas Samuel
- See `docs/menunggu-samuel.md`. Nothing there blocks the local build.

## Part A: foundation and the factory
- [~] Task 1: repo, bench, sites, app (sites waiting on Abel)
- [~] Task 2: site setup on every migrate (written, tests not run)
- [~] Task 3: only the used modules (written, tests not run)
- [~] Task 4: English default, Indonesian switch (written, tests not run)
- [~] Task 4b: friendly screens (written, tests not run; `cek_layar` also needs `contoh.py`'s users)
- [~] Task 5: sales and purchasing flow (written, tests not run; guide screenshots wait for the site)
- [~] Task 6: import guide (written, tests not run; headers to re-check against the site's Download Template)
- [~] Task 7: server image, compose, backups (image built and checked locally; compose boot, backup and restore
      drill wait for a site: `new-site` needs the database root password)
- [ ] Task 8: go-live wave 1 (local dry run only)

## Part B: production and forecast
- [~] Task 9: Sales History (written, tests not run)
- [x] Task 10: forecast math (`test_rumus.py`, now 13 unit tests incl. Task 13's, OK without a site; rerun under `bench run-tests` later)
- [~] Task 11: Fill from History (written, tests not run; try the button after `bench build`)
- [~] Task 12: production flow (written, tests not run; guide screenshots wait for the site)
- [~] Task 13: Order Readiness report (written; rumus unit tests OK, integration tests incl. the 2 permission tests not run)
- [ ] Task 14: go-live wave 2 (local dry run only)

## Part C: office
- [~] Task 15: attendance (written, tests not run; HRMS app buttons to check on the site)
- [~] Task 16: projects (written incl. the own-timesheet guard `proyek.py`, tests not run)
- [ ] Task 17: go-live wave 3 (local dry run only)
- [~] `erp_internal/contoh.py` sample data (Revision 3 item 4; written, `test_contoh` not run, not yet run on `erp.localhost`)
