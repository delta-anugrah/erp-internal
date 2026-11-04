---
name: run-checks
description: Run before calling any erp-internal task done - migrates the dev sites, runs the app's tests and lint, and checks commits carry no Claude attribution.
---
From `~/Desktop/Projects/erp-internal-bench` (sites must exist: `tools/setup_bench.sh sites wizard`):

1. `bench --site erp-test.localhost migrate && bench --site erp.localhost migrate`
2. `bench --site erp-test.localhost run-tests --app erp_internal` - all must pass; report the count.
3. `cd ~/Desktop/Projects/erp-internal && ruff check erp_internal && ruff format --check erp_internal`
4. If JS changed: `bench build --app erp_internal`.
5. If screens changed: `node tools/cek_layar.mjs` (Task 4b) and look at `tools/hasil/` (each home may hold at most `PINTASAN_MAKS` = 12 shortcuts; raise it in `tools/cek_layar.mjs` only on purpose and say so); if the Production Floor
   page changed, also `node tools/lantai.mjs`.
6. If shell scripts or Makefiles changed: `bash -n deploy/server/*.sh tools/*.sh && shellcheck -x deploy/server/*.sh tools/setup_lokal.sh`,
   and `make -n setup-local WIZARD=otomatis` / `make -C deploy/server -n langkah` read right.
7. `git log --format=%B origin/main..HEAD | grep -ci co-authored` must print 0.
8. Run the `docs-sync` agent with the changed files; update `docs/TODO.md` and `docs/PROGRESS.md`.

Write results exactly as run; a step not run is "not run" with the reason.
