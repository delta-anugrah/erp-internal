---
name: run-checks
description: Run before calling any erp-internal task done - migrates the dev sites, runs the app's tests and lint, and checks commits carry no Claude attribution.
---
From `~/Desktop/Projects/erp-internal-bench` (sites must exist: `tools/setup_bench.sh sites wizard`):

1. `bench --site erp-test.localhost migrate && bench --site erp.localhost migrate`
2. `bench --site erp-test.localhost run-tests --app erp_internal` - all must pass; report the count.
3. `cd ~/Desktop/Projects/erp-internal && uvx ruff@0.17.6 check erp_internal && uvx ruff@0.17.6 format --check erp_internal`
   (the version CI pins in `.github/workflows/ci.yml`).
4. If JS changed: `bench build --app erp_internal`.
5. If screens changed: `node tools/cek_layar.mjs` (Task 4b) and look at `tools/hasil/` (each home may hold at most `PINTASAN_MAKS` = 13 shortcuts, each an `.erp-kartu` with its icon and line, a failure naming the bare ones; raise it in `tools/cek_layar.mjs` only on purpose and say so); if the Production Floor
   page changed, also `node tools/lantai.mjs`. If roles, Daily Input, the Work Order machine lock or the PO print
   changed: `node tools/e2e_samuel.mjs` (each profile's flow, all steps PASS) and `node tools/lantai.mjs` (its wo/xss
   cases make a Work Order through the machine lock).
6. If shell scripts or Makefiles changed: `for f in deploy/*.sh deploy/server/*.sh tools/*.sh; do bash -n "$f" || echo "FAIL $f"; done` (bash -n reads only its first file) and `shellcheck -x deploy/*.sh deploy/server/*.sh tools/setup_lokal.sh`,
   and `make -n setup-local WIZARD=otomatis` / `make -C deploy/server -n langkah` read right.
   If `deploy/Containerfile`, `versi.json`, `deploy/*.sh` or `.github/workflows/` changed: `docker build -f
   deploy/Containerfile -t erp-internal:uji . && deploy/check_image.sh erp-internal:uji && deploy/ci_tes.sh
   erp-internal:uji` (what CI's "Tes" runs), and actionlint on the workflow.
7. `git log --format=%B origin/main..HEAD | grep -ci co-authored` must print 0.
8. Run the `docs-sync` agent with the changed files; update `docs/TODO.md` and `docs/PROGRESS.md`.

Write results exactly as run; a step not run is "not run" with the reason.
