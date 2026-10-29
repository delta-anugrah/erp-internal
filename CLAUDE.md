# CLAUDE.md

ERP Internal: a custom Frappe app (`erp_internal`) on ERPNext v16 + HRMS v16 for Mas Samuel's plastic factory
(stock, sales, purchasing, production with a monthly forecast and the Order Readiness report) and our office
(attendance, projects), all in ONE company (PT Delta Anugrah at go-live) with three roles: Developer, Admin, User
(Samuel, 2026-10-28). Plain ERPNext showing only the modules in use, nothing from BPT.

Status 2026-10-29: every code task (1-6, 4b, 9-13, 15, 16, `contoh.py`) runs on the dev sites, redone for one
company and three roles (plan "Revision 4"): 128 tests OK (`run-tests --app erp_internal`, incl. `test_production_floor` and `test_kapasitas`), `cek_layar` 3 users OK (short homes, Samuel 2026-10-28), sample
data and guide screenshots on `erp.localhost`, local dry runs of the go-live tasks 8, 14 and 17 done (results in
the plan). Open: Task 7's compose boot, backup and restore drill (Abel: needs the database root password), and the
real go-live with Samuel.

- Design: `docs/superpowers/specs/2026-10-27-erp-internal-design.md`
- Plan: `docs/superpowers/plans/2026-10-27-erp-internal-plan.md`. Its "Revision 4" (one company, three roles),
  "Revision 2" and "Revision 3" sections override the rest (English UI by default with an Indonesian switch, English DocType/report names, full width,
  friendly screens; everything built and dry-run locally first).
- Open questions for Samuel and their defaults: `docs/menunggu-samuel.md`.

## Where things are

| Path | What |
|---|---|
| `~/Desktop/Projects/erp-internal` | This repo. It is the app root (`pyproject.toml`, package `erp_internal/`). Commit here. |
| `~/Desktop/Projects/erp-internal-bench` | The bench (not a repo). `apps/erp_internal` is a symlink to this repo. |
| `~/Desktop/Projects/erp-internal-bench/.env` | Secrets, mode 0600, never committed: `DB_ROOT_PASSWORD`, `ADMIN_PASSWORD`, `SAMPLE_PASSWORD` (= `erp_sandi_contoh`). |
| Docker `erp-mariadb` | MariaDB 11.8.9 on 127.0.0.1:3308, volume `erp-mariadb`, utf8mb4. |
| Bench ports | web 8002, socketio 9002, redis queue 11002, redis cache 13002. |
| Sites | `erp.localhost` (dev; wizard: PT Contoh Plastik, CPL) and `erp-test.localhost` (`allow_tests`). |
| `erp_internal/contoh.py` | DATA CONTOH for dev sites (`buat_contoh`): one company, users `developer@`, `admin@`, `user@example.com`, password `erp_sandi_contoh`; refused with `erp_produksi`. |
| `erp_internal/master.py` | Samuel's real master data from `erp_internal/data/katalog.json` (Dinda House Ware price list) and `mesin.json` (14 machines): Item templates with only the listed variants, packings, price list `Harga Pola <year>`, Workstations `Mesin 01`..`14`. Idempotent; how to rerun: `docs/impor.md`. |
| `erp_internal/planning/kapasitas.py`, DocType Machine Capacity (`planning/doctype/machine_capacity/`) | Per product per machine: cycle time, cavities, part and runner weight, material (a Kg stock item). The controller computes `pcs_per_hour` and `material_per_pcs`; `kapasitas(item, workstation)` finds the enabled row (variant row, else its template's row for the variant's `Jenis`, else the template's blank-Jenis row, else None); `RUNNER_DIGILING` is the new row's reground default (open question to Samuel). In Manufacturing's sidebar and shortcuts after BOM. |
| `erp_internal/production_floor.py` | Server side of the Production Floor page: `get_data()` (numbered machines, status, running Work Order, and `perusahaan` {nama, logo}: the default company, both only for a user who may read that Company, else the app name), `set_status(machine, status)`, and `siarkan` (doc events on Workstation and Work Order, realtime event `production_floor`, an empty payload, not sent for a Workstation that is no numbered machine). `Work Order.erp_mesin` is the machine link (`setup.FIELD_WO_MESIN`, filtered to numbered machines). |
| `erp_internal/erp_internal/page/production_floor/`, `public/js/lantai.bundle.js`, `public/js/lantai/adegan.js`, `mesin.js`, `label.js`, `panel.js`, `hud.js`, `kaca.js` | The Production Floor page (`/desk/production-floor`): a small page script (`erp.lantai.tabel` is the plain machine table shown without WebGL or when the bundle fails, filled by its own `erp.lantai.ambil`), the bundle (`erp.lantai.pasang(host)`, three.js from the repo-root `package.json`/`yarn.lock`, Shadow DOM, one WebGL context kept across leave/return; it fetches `get_data()` itself with plain fetch, never frappe.call, and refetches everything on the realtime nudge `production_floor` (sent to the `doctype:Workstation` room by Workstation `on_update` and Work Order `on_change`; the page joins the room again on every socket reconnect; debounced 250 ms) and on a 60 s poll while shown, `?poll=<s>` for tests), the scene (floor, aisle lines, 14 slot markers in `BARIS` order, a 700 ms camera flight to a selected machine, adaptive quality: mean frame over 22 ms for 2 s → pixel ratio 1 and still platens), the machines (one InstancedMesh per part, status → andon lamp, pulse, dimming and platen motion from `GAYA`; a duplicate or unknown number goes to the spare row; a refresh with the same machines touches only the rows that changed), the labels (`label.js`: "03 · NISSEI 260T", status chip, Work Order item and progress; textContent only; text waits until the camera rests, see the comment there) and the side panel (`panel.js`: details, Work Order link, six status buttons posting `set_status` with the CSRF token, a refusal as an inline note, Open machine; a text only when it changed, and not mid-drag; a bottom sheet under 760 px). The info bar (`hud.js`): top bar with the company logo (same-origin `/files/` only, else initials), live dot ("Live" / "Updated HH:MM") and a 1 s clock, KPI row (machines, running + utilization, problem, Work Orders running, output), a collapsible machine table (fold kept in localStorage, collapsed under 760 px) whose rows select like a scene click, and the camera bar (+, −, home = `.reset`). Its figures and the clock write only while the camera rests (Chrome stalls on a text repaint during a drag). The glass look is `kaca.js` (`.kartu`, light/dark from Desk's `data-theme` via the host's `data-tema`; the moving labels have no backdrop blur, for the frame budget). `tools/lantai.mjs` checks it in a browser (`ERP_SANDI=… node tools/lantai.mjs [case …]`; perf and adaptive run headed). It is the first link of Manufacturing's sidebar and home (`tampilan.NAMA_LINK`). Lessons, the smoothness budget and the two accepted deviations: `.claude/rules/lantai.md`. |

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
bench --site erp.localhost set-config erp_sandi_contoh <password>   # the sample users' password (dev only)
bench --site erp.localhost execute erp_internal.contoh.buat_contoh   # DATA CONTOH; refused with erp_produksi
bench --site erp.localhost execute erp_internal.master.muat          # Samuel's catalog and machines; a second run writes nothing
ERP_SANDI=<SAMPLE_PASSWORD> node tools/cek_layar.mjs   # each role's screens; restart bench start after a build
ERP_SANDI=<SAMPLE_PASSWORD> node tools/lantai.mjs     # Production Floor page; perf and adaptive open a visible browser
# from the repo: the server image and its check (deploy/server/README.md is the runbook)
docker build -f deploy/Containerfile -t erp-internal:uji . && deploy/check_image.sh erp-internal:uji
```

Workflow skill: `/setup-bench` (`.claude/skills/setup-bench/SKILL.md`).

## Rules (the plan's Global Constraints, as revised)

- One company: setup builds for each Company with `erp_aktif` ticked (`setup.perusahaan()`); a real site has one.
- Three Role Profiles (`tampilan.PROFIL_PERAN`): User (daily work), Admin (manager roles, users, business
  settings under the Settings rail entry; role `ERP Admin`), Developer (Admin plus System Manager). `pengguna.py`
  keeps an Admin from handing out any role outside Admin and User or touching a Developer account (User
  validate/has_permission, Has Role insert); `test_pengguna` tries every path.
- A report that reads with `get_all` checks the caller's Company/Warehouse permission itself (Order Readiness).
- `tampilan.saring_aplikasi` (`extend_bootinfo`) hides an Apps screen tile with nothing on that user's rail; it
  must never fail boot. `hooks.py` `before_tests` completes the test site's wizard (`tests.utils.sebelum_tes`).
- `erp_internal/proyek.py`: Timesheet `before_submit` (hooks.py `doc_events`) lets only Admin and Developer
  (`PERAN_ATASAN`) submit someone else's timesheet; `setup.IZIN_TAMBAHAN` gives Employee `submit`.

- Pinned tags only, never a develop branch. Change a pin on purpose, with the full test run.
- Every customisation lives in `erp_internal` and is re-applied idempotently on `after_install`/`after_migrate`.
  Nothing set by hand on a site unless migrate would set it again. Setup must not fail before the wizard is done.
- ERPNext and HRMS modules are hidden, never deleted or patched.
- Never share a bench, site, database or server with BPT (`~/Desktop/Projects/pertamina/*`, `bpt-mariadb` on 3307,
  bpt.localhost, cloud.localhost, onprem.localhost) or the sawit server.
- UI is English by default; each user can switch to Indonesian (`erp_internal/translations/id.csv`). Our text is
  English source in `_()`/`__()`. Python identifiers are Indonesian; comments and docstrings English.
- Locale: time zone Asia/Jakarta, currency IDR, date `dd-mm-yyyy`, number `#.###,##`.
- Site config of ours: `erp_produksi` (set on the server: refuses `contoh.py`), `erp_sandi_contoh` (dev: the
  sample users' password), `erp_mulai_absen` (first day of auto attendance; default the day the shift is made).
- ruff with tabs, double quotes, 110 columns (`pyproject.toml`).
- Tests: `frappe.tests` classes, all in `erp_internal/tests/`; fixtures as get-or-create helpers in
  `tests/utils.py`; date records relative to `today()`.
- Docs follow code in the same commit: CLAUDE.md, README.md, `docs/`.
- Conventional Commits, no Claude attribution. Work on `feat/lokal`; `main` is protected (PR only). Tag and deploy
  only with Abel's approval. Every PR: assignee `marcoabelz`, reviewer `supportusahaai`
  (`gh pr create --assignee marcoabelz --reviewer supportusahaai`).

## Working here

- Status and next steps: `docs/TODO.md`; what happened per session: `docs/PROGRESS.md`; Samuel's open questions and
  their defaults: `docs/menunggu-samuel.md`. Update all three when a task ends.
- `/run-checks` before calling a task done; reviewer agents: `reviewer` (a task against the plan), `docs-sync`
  (docs after a change). Rules per area: `.claude/rules/`.
- Work on branch `feat/lokal`; `main` takes PRs only.
