---
name: setup-bench
description: Sets up a dev machine for erp_internal (MariaDB container erp-mariadb, the bench at ~/Desktop/Projects/erp-internal-bench with pinned Frappe/ERPNext/HRMS v16, sites erp.localhost and erp-test.localhost, the setup wizard) and checks it with the site test. Use when a machine has no bench yet or the bench or sites must be rebuilt.
disable-model-invocation: true
argument-hint: "[parts: db bench ports apps link sites wizard]"
---

# Set up the erp_internal bench

It creates a container, a bench and two sites, so run it only when asked. Never print or commit the values in `.env`.
Never touch BPT: `~/Desktop/Projects/pertamina/*`, the bpt-bench, container `bpt-mariadb` (3307), sites
bpt.localhost, cloud.localhost, onprem.localhost.

1. Check the prerequisites: `docker info`, `python3.14 --version`, `node --version` (24), `yarn --version`,
   `redis-server --version`, `bench --version`.
2. Check the ports are free, or held by this bench already:
   `for p in 3308 8002 9002 11002 13002; do lsof -nP -iTCP:$p -sTCP:LISTEN; done`. A taken port: pick the next free
   one, change it in `tools/setup_bench.sh` and CLAUDE.md.
3. `$ERP_BENCH/.env` (default `~/Desktop/Projects/erp-internal-bench/.env`) must exist with mode 0600 and hold
   `DB_ROOT_PASSWORD` and `ADMIN_PASSWORD`. The developer writes it; never ask for the values in chat.
4. Run `tools/setup_bench.sh $ARGUMENTS` from the repo (all parts when no argument). Every part skips what exists.
   `bench init` and the two `new-site` runs take several minutes each.
5. Check: `git -C $ERP_BENCH/apps/<app> describe --tags` equals `versi.json` for frappe, erpnext and hrms;
   `bench --site erp.localhost execute frappe.is_setup_complete` prints `true`.
6. Run the test: `cd $ERP_BENCH && bench --site erp-test.localhost run-tests --module erp_internal.tests.test_situs`
   (2 tests OK). The first run also completes the test site's wizard (our `before_tests` hook, `erp_internal.tests.utils.sebelum_tes`, which runs HRMS's).
7. `part_sites`/`part_wizard` start the bench's Redis as daemons when `bench start` isn't running. Before `bench
   start`, stop them: `redis-cli -p 13002 shutdown nosave; redis-cli -p 11002 shutdown nosave`.
8. Optional, dev only: sample data. The developer sets the sample users' password in their own terminal
   (`bench --site erp.localhost set-config erp_sandi_contoh <password>`; never print it), then
   `bench --site erp.localhost execute erp_internal.contoh.buat_contoh`. A site with `erp_produksi` (the server)
   refuses it.
