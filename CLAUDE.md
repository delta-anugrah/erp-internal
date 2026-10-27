# CLAUDE.md

ERP Internal: a custom Frappe app (`erp_internal`) on ERPNext v16 + HRMS v16 for Mas Samuel's plastic factory
(stock, sales, purchasing, production with a monthly forecast and the Order Readiness report) and our office
(attendance, projects). Plain ERPNext showing only the modules in use, nothing from BPT.

Status 2026-10-27: Task 1 is partly done. Container, bench, apps and the empty app exist; the two sites, the
wizard and the first test run are not done yet (`tools/setup_bench.sh sites wizard`, then the test). Next: Task 2.

- Design: `docs/superpowers/specs/2026-10-27-erp-internal-design.md`
- Plan: `docs/superpowers/plans/2026-10-27-erp-internal-plan.md`. Its "Revision 2" and "Revision 3" sections
  override the rest (English UI by default with an Indonesian switch, English DocType/report names, full width,
  friendly screens; everything built and dry-run locally first).
- Open questions for Samuel and their defaults: `docs/menunggu-samuel.md`.

## Where things are

| Path | What |
|---|---|
| `~/Desktop/Projects/erp-internal` | This repo. It is the app root (`pyproject.toml`, package `erp_internal/`). Commit here. |
| `~/Desktop/Projects/erp-internal-bench` | The bench (not a repo). `apps/erp_internal` is a symlink to this repo. |
| `~/Desktop/Projects/erp-internal-bench/.env` | Secrets, mode 0600, never committed: `DB_ROOT_PASSWORD`, `ADMIN_PASSWORD`. |
| Docker `erp-mariadb` | MariaDB 11.8.9 on 127.0.0.1:3308, volume `erp-mariadb`, utf8mb4. |
| Bench ports | web 8002, socketio 9002, redis queue 11002, redis cache 13002. |
| Sites | `erp.localhost` (dev; wizard: PT Contoh Plastik, CPL) and `erp-test.localhost` (`allow_tests`). |

Versions are pinned in `versi.json`: frappe v16.53.0, erpnext v16.52.1, hrms v16.52.0. Python 3.14, Node 24.

## Commands

```bash
tools/setup_bench.sh                     # whole dev setup; rerunnable, skips what exists
tools/setup_bench.sh sites wizard        # only some parts: db bench ports apps link sites wizard
cd ~/Desktop/Projects/erp-internal-bench
bench start                              # its own terminal tab; http://erp.localhost:8002
bench --site erp.localhost migrate
bench --site erp-test.localhost run-tests --app erp_internal
bench --site erp-test.localhost run-tests --module erp_internal.tests.test_situs
```

Workflow skill: `/setup-bench` (`.claude/skills/setup-bench/SKILL.md`).

## Rules (the plan's Global Constraints, as revised)

- Pinned tags only, never a develop branch. Change a pin on purpose, with the full test run.
- Every customisation lives in `erp_internal` and is re-applied idempotently on `after_install`/`after_migrate`.
  Nothing set by hand on a site unless migrate would set it again. Setup must not fail before the wizard is done.
- ERPNext and HRMS modules are hidden, never deleted or patched.
- Never share a bench, site, database or server with BPT (`~/Desktop/Projects/pertamina/*`, `bpt-mariadb` on 3307,
  bpt.localhost, cloud.localhost, onprem.localhost) or the sawit server.
- UI is English by default; each user can switch to Indonesian (`erp_internal/translations/id.csv`). Our text is
  English source in `_()`/`__()`. Python identifiers are Indonesian; comments and docstrings English.
- Locale: time zone Asia/Jakarta, currency IDR, date `dd-mm-yyyy`, number `#.###,##`.
- ruff with tabs, double quotes, 110 columns (`pyproject.toml`).
- Tests: `frappe.tests` classes, all in `erp_internal/tests/`; fixtures as get-or-create helpers in
  `tests/utils.py`; date records relative to `today()`.
- Docs follow code in the same commit: CLAUDE.md, README.md, `docs/`.
- Conventional Commits, no Claude attribution. Work on `feat/lokal`; `main` is protected (PR only). Tag and deploy
  only with Abel's approval.
