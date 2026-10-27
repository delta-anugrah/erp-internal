# TODO

Order follows the plan (`docs/superpowers/plans/2026-10-27-erp-internal-plan.md`, Revisions 2 and 3 first).

## Waiting on Abel
- [ ] Create the two dev sites in your own terminal: `tools/setup_bench.sh sites wizard` (the permission check stops
      Claude from running `bench new-site`). Then `bench --site erp-test.localhost run-tests --module erp_internal.tests.test_situs`.

## Waiting on Mas Samuel
- See `docs/menunggu-samuel.md`. Nothing there blocks the local build.

## Part A: foundation and the factory
- [~] Task 1: repo, bench, sites, app (sites waiting on Abel)
- [~] Task 2: site setup on every migrate (written, tests not run)
- [ ] Task 3: only the used modules
- [ ] Task 4: English default, Indonesian switch
- [ ] Task 4b: friendly screens
- [ ] Task 5: sales and purchasing flow
- [ ] Task 6: import guide
- [ ] Task 7: server image, compose, backups (local)
- [ ] Task 8: go-live wave 1 (local dry run only)

## Part B: production and forecast
- [ ] Task 9: Sales History
- [ ] Task 10: forecast math
- [ ] Task 11: Fill from History
- [ ] Task 12: production flow
- [ ] Task 13: Order Readiness report
- [ ] Task 14: go-live wave 2 (local dry run only)

## Part C: office
- [ ] Task 15: attendance
- [ ] Task 16: projects
- [ ] Task 17: go-live wave 3 (local dry run only)
- [ ] `erp_internal/contoh.py` sample data (Revision 3 item 4)
