# Progress log

Newest first. One entry per working session: what changed, test results as run, what is next.

## 2026-10-27 (night): Tasks 2, 3, 4, 4b written, no site yet
- Task 2: `setup.pastikan_setup()` on `after_install`/`after_migrate` (System Settings, sign-up and OAuth
  registration off, Global Defaults, `Company.erp_jenis`, item groups, UOMs, factory warehouses);
  `tests/test_setup.py` (5 tests), `tests/utils.py`. The `wizard` part now sets Jenis and migrates.
  Checked: `py_compile`, `ruff check`, `ruff format --check`; every fieldname read in the v16 JSON under `apps/`.
  Tests not run: no site yet.

## 2026-10-27 (evening)
- Design and plan written; repo `delta-anugrah/erp-internal` created (private). `main` needs a PR, so work goes on
  branch `feat/lokal`.
- Revision 2: English UI by default with an Indonesian switch, full width, friendly screens.
- Revision 3: everything local first; Samuel's questions have defaults (`docs/menunggu-samuel.md`).
- Task 1 (`421bf7c`): MariaDB `erp-mariadb` on 3308, bench at `~/Desktop/Projects/erp-internal-bench` on the pinned
  v16 tags, app scaffolded and linked, `tools/setup_bench.sh`, setup-bench skill. Sites not created yet: `bench
  new-site` was refused by the permission check, so Abel runs `tools/setup_bench.sh sites wizard`. Tests not run.
