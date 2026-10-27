---
paths: ["erp_internal/**", "tools/**"]
---
# Code style

- Python 3.14, ruff (tabs, double quotes, 110 columns). JS/CSS/HTML in the app use tabs (`.editorconfig`).
- Identifiers are Indonesian (`pastikan_setup`, `rumus`, `hitung_kurang`); comments, docstrings and docs English.
- UI text is English source in `_()` / `__()`, with Indonesian in `erp_internal/translations/id.csv`. A test fails on
  any string of ours without a translation.
- Behaviour hangs off module-level UPPER_CASE tables (`GUDANG_PABRIK`, `IKON`, `SIDEBAR`, `SEMBUNYI`): change the
  table, not a special case.
- Setup code is idempotent, writes only what differs, and runs on `after_install` and `after_migrate`.
- Never delete or patch ERPNext/HRMS: hide through tables in `tampilan.py`.
- Tests live in `erp_internal/tests/`, use `frappe.tests.IntegrationTestCase`/`UnitTestCase` and the get-or-create
  fixtures in `tests/utils.py`. Pass `hari_ini` explicitly; never depend on the real date.
- Conventional Commits. Never a `Co-Authored-By` or any Claude attribution line.
