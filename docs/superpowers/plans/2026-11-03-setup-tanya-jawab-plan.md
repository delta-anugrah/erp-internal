# One-command setup with questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `make setup` (server) and `make start-local` (local) ask a few plain questions in the terminal, then run
every step; the setup wizard is filled automatically or by hand; a `setup_wizard_complete` hook finishes the site
either way and seeds Samuel's data once.

**Architecture:** One Python module `erp_internal/wizard.py` (the hook, plus `lanjutkan()` that does the slow work:
`pastikan_setup`, company on Admin/User accounts, the one-time data seed). Shell: a sourced prompt library
`deploy/server/tanya.sh` used by `akun.sh` and `wizard.sh` (moved/new, all in `deploy/server/` because only that
folder is on the server), and two thin drivers: `deploy/server/setup.sh` (server, `make setup` calls it) and
`tools/setup_lokal.sh` (local, `make start-local` calls it on a first run). The drivers ask everything first, then
run the existing Makefile steps.

**Tech Stack:** Frappe v16.53 hooks, bash 3.2-compatible scripts (macOS and WSL), GNU Make 3.81, Docker compose.

**Spec:** `docs/superpowers/specs/2026-11-03-setup-tanya-jawab-design.md` (read it first, esp. "Decided" and
"Anti-goals").

## Global Constraints

- Every question: one plain line saying what it is for, a suggested answer, Enter accepts it.
- One option or value per line, each saying what it is for (the spec's example block is the exact layout).
- No secret on a command line, in a Makefile, in a file (except the generated `DB_ROOT_PASSWORD`, and
  `ADMIN_PASSWORD` until the typed one replaces it), or on screen; passwords typed blind, `*` per character.
- The hook must never fail the wizard and must not make it slow: catch, `frappe.log_error`, carry on; slow work
  goes to a background job.
- Samuel's data: only with `erp_produksi` set, only once per site (marker), never on dev or test sites.
- Wizard values: company `PT Delta Anugrah`, abbreviation `DAN` (both changeable), fiscal year = current calendar
  year, Indonesia, Asia/Jakarta, IDR, English, chart of accounts Standard, no demo data.
- Python: tabs, double quotes, 110 columns; identifiers Indonesian, comments English; every `_()` string gets an
  `id.csv` row. Scripts run on macOS bash 3.2 (no `declare -A`, no `${x,,}`, no `mapfile`).
- Commits: Conventional Commits, no Claude attribution, on `feat/lokal`.

## Decisions this plan adds (not in the spec)

- **By-hand wizard: only the Administrator password is asked in the terminal.** Role Profiles (Developer, Admin,
  User) are made by setup only after the wizard, so other accounts cannot exist before it. The wizard's own account
  becomes Developer; that person adds Admin/User accounts in the app. `akun.buat` refuses a non-Administrator
  account before the wizard with a clear message. (Answers the spec's "accounts made before the wizard" item.)
- **The data load:** the hook enqueues `lanjutkan()` (`queue="long"`, `enqueue_after_commit=True`,
  `job_id="erp_lanjutkan"`, `deduplicate=True`); the automatic path also runs it directly through `make lanjut`,
  so the terminal shows it. The second run is a no-op (marker `erp_data_samuel` in global defaults).
- **When the wizard question is asked:** on a run without the done marker (`.siap` on the server, `.local/siap`
  locally), and on a later run that finds the wizard still incomplete.

## Review Focus

1. Browser wizard on a real site: the account made in "Create your account" ends up in the Developer profile,
   whether its email arrives in `args` or only as the session user. Checked by hand in Task 5.
2. Rerunning `make setup` / `make start-local` after a by-hand path where the wizard is not done yet: no second
   account prompt, the wizard question comes back, the final message repeats the browser instructions. Task 5.
3. Skipped backup destination: `make setup` and the nightly `cadangan.sh` both succeed, with one warning line.
   Test in Task 3.
4. A GitHub token that is wrong or has no `read:packages`: login fails with a plain line and asks again; no
   version suggestion is not an error. Task 3.
5. `make update-local` after edits in the app: Samuel's data is not reloaded (no `data-local`, marker set). Task 4.

---

### Task 1: The wizard hook and `lanjutkan()`

**Files:**
- Create: `erp_internal/wizard.py`
- Modify: `erp_internal/hooks.py` (add `setup_wizard_complete = "erp_internal.wizard.selesai"` near `after_install`)
- Modify: `erp_internal/akun.py` (`_buat`: refuse non-Administrator entries before the wizard)
- Modify: `erp_internal/translations/id.csv`
- Test: `erp_internal/tests/test_wizard.py`, `erp_internal/tests/test_akun.py`

**Interfaces:**
- Produces: `selesai(args: dict) -> None` (the hook; returns at once on a site with `allow_tests`, else calls
  `_selesai`), `_selesai(args: dict) -> None` (ticks `erp_aktif` on `args["company_name"]` if that Company exists,
  puts the wizard user in the Developer profile, enqueues `lanjutkan`; any exception is logged, never raised),
  `lanjutkan() -> list[str] | None` (bench-callable: prints its lines, returns None from the terminal like
  `akun.buat`; does nothing before the wizard), `PENANDA_DATA = "erp_data_samuel"`, `MUAT = ("master",
  "penjualan", "mesin_barang")`.
- The wizard user: `args.get("email")`, else `frappe.session.user` unless it is Administrator or Guest; made
  Developer with `utils.buat_pengguna(email, DEVELOPER, None, None)` only if the User exists.
- `lanjutkan`: `setup.pastikan_setup()`; then every enabled User whose Role Profile is ADMIN or USER and who has no
  Company User Permission gets `utils.buat_pengguna(email, profil, profil, company)` with the first
  `setup.perusahaan()`; then, if `frappe.conf.get("erp_produksi")` and `not frappe.db.get_default(PENANDA_DATA)`,
  `import_module(f"erp_internal.{m}").muat()` for each of `MUAT`, then `frappe.db.set_default(PENANDA_DATA, 1)`;
  `frappe.db.commit()` at the end.

- [x] **Step 1: Write the failing tests** in `test_wizard.py` (`IntegrationTestCase`; company from
  `utils.buat_perusahaan`, then `frappe.db.set_value("Company", nama, "erp_aktif", 0)` to start unticked):
  - `test_lewat_di_situs_tes`: `with patch("frappe.enqueue") as e: wizard.selesai({"company_name": nama})` →
    `erp_aktif` still 0, `e.assert_not_called()` (the test site has `allow_tests`).
  - `test_centang_dan_developer`: a plain User `_uji.wizard@example.com` (no profile);
    `wizard._selesai({"company_name": nama, "email": "_uji.wizard@example.com"})` with `frappe.enqueue` patched →
    `erp_aktif == 1`, role profiles `== [DEVELOPER]`, enqueue called once with `"erp_internal.wizard.lanjutkan"`
    and `job_id="erp_lanjutkan"`.
  - `test_tidak_pernah_gagal`: patch `utils.buat_pengguna` to raise `Exception("x")`; `_selesai(...)` returns
    without raising, and `frappe.get_all("Error Log", {"method": ("like", "%wizard%")})` grew by one.
  - `test_data_sekali`: patch the three `muat` functions (`erp_internal.master.muat`, `.penjualan.muat`,
    `.mesin_barang.muat`) and `frappe.db.set_default`/`get_default` backed by a dict; with
    `patch.dict(frappe.conf, {"erp_produksi": 1})` call `wizard.lanjutkan()` twice → each `muat` called once;
    without `erp_produksi` → never called.
  - `test_sebelum_wizard`: `patch("frappe.is_setup_complete", return_value=False)`, `lanjutkan()` → no `muat`
    call, `pastikan_setup` not called (patch it).
  - `test_akun_dapat_perusahaan`: a User with Role Profile ADMIN and no Company User Permission → after
    `lanjutkan()` (loads patched) it has one for `setup.perusahaan()[0]`.
  - In `test_akun.py`, `test_tolak_akun_sebelum_wizard`: with `frappe.is_setup_complete` patched False,
    `akun.buat({"Administrator": "rahasia-123", "akun": [{"profil": ADMIN, ...}]})` raises
    `frappe.ValidationError`; `akun.buat({"Administrator": "rahasia-123"})` passes (restore Administrator's
    password afterwards like the existing tests do, if they do; else leave Administrator out and only assert the
    refusal).

- [x] **Step 2: Run them to see them fail**
  Run: `cd ~/Desktop/Projects/erp-internal-bench && bench --site erp-test.localhost run-tests --module erp_internal.tests.test_wizard`
  Expected: FAIL, `No module named 'erp_internal.wizard'`.

- [x] **Step 3: Write `wizard.py`, the hook line, the `akun._buat` check** (message: "Create the Developer,
  Admin and User accounts after the setup wizard; for now only Administrator.") and its `id.csv` row.

- [x] **Step 4: Run the tests**
  Run: `bench --site erp-test.localhost run-tests --module erp_internal.tests.test_wizard` and
  `--module erp_internal.tests.test_akun`, then `--module erp_internal.tests.test_bahasa` (translations).
  Expected: all OK.

- [x] **Step 5: Commit** `feat(wizard): finish the site from setup_wizard_complete and seed Samuel's data once`

### Task 2: Shared prompts, the account picker and the wizard question

**Files:**
- Create: `deploy/server/tanya.sh` (sourced library), `deploy/server/wizard.sh` (sourced library)
- Move: `tools/akun.sh` → `deploy/server/akun.sh` (`git mv`), turned into a sourced library
- Modify: `Makefile` (root) line that runs `tools/akun.sh` (until Task 4 replaces it)

**Interfaces (all bash functions, results in global variables, bash 3.2):**
- `tanya.sh`: `perlu_terminal` (exit 1 with "Run this in a terminal." when stdin/stdout is not a tty),
  `tanya LABEL SARAN KETERANGAN` → `JAWAB` (prints `LABEL (KETERANGAN)` then `  [SARAN]: `; Enter keeps SARAN;
  empty SARAN means an answer is required), `pilih_satu JUDUL OPSI...` → `PILIHAN` (1-based; prints one option
  per line as `  1) ...`, first marked "(suggested: press Enter)"), `baca_sandi`, `sandi_baru`, `json`,
  `email_benar` (moved unchanged from `akun.sh`).
- `akun.sh`: `tanya_akun [--hanya-admin]` → `ERP_AKUN` (the JSON `akun.buat` reads; with `--hanya-admin` no
  checklist, Administrator only, and a line "Developer, Admin and User accounts: in the app after the wizard; the
  account you make in the wizard is the Developer."), `buat_akun COMPOSE` (runs
  `ERP_AKUN=… $COMPOSE run --rm -T -e ERP_AKUN tools bash -c 'bench --site "$SITE" execute erp_internal.akun.buat'`,
  then `unset ERP_AKUN`). No marker writing inside; the drivers own markers.
- `wizard.sh`: `tanya_wizard` → `WIZARD` (`otomatis` | `tangan`), `COMPANY`, `ABBR` (exported); prints exactly
  the spec's block (question, two options, then "Automatic values (Enter keeps each one):" with Company name,
  Abbreviation asked through `tanya`, and Fiscal year, Country, Currency printed as fixed lines with their
  meanings). For `tangan` the same values list is printed under "Type these in the wizard:".
  `petunjuk_wizard URL` prints the by-hand ending: "Open URL, sign in as Administrator with the password you just
  typed, fill in the wizard with the values above. The account you create there is the Developer; if you use an
  email typed here, the wizard's password wins." then the values list.

- [x] **Step 1: Write the libraries; move `akun.sh` with `git mv` so history follows.**
- [x] **Step 2: Check syntax and lint**
  Run: `bash -n deploy/server/tanya.sh deploy/server/akun.sh deploy/server/wizard.sh && (command -v shellcheck >/dev/null && shellcheck -x deploy/server/*.sh || echo "shellcheck not installed")`
  Expected: no output from `bash -n`; shellcheck clean or reported missing.
- [x] **Step 3: Try the prompts by hand** with a scratch script in the scratchpad that sources the three files and
  calls `tanya_wizard; tanya_akun; echo "$WIZARD $COMPANY $ABBR"; echo "${#ERP_AKUN}"` (never echo the JSON).
  Expected: options one per line, Enter accepts suggestions, passwords show `*`, Backspace works, length printed.
- [x] **Step 4: Commit** `refactor(deploy): shared terminal prompts, account picker and wizard question`

### Task 3: Server `make setup` asks, then runs every step

**Files:**
- Create: `deploy/server/setup.sh` (the server driver; `make setup` runs it)
- Modify: `deploy/server/Makefile`, `deploy/server/cadangan.sh`, `deploy/server/.env.example`

**Interfaces:**
- Consumes: Task 2's functions; Task 1's `erp_internal.wizard.lanjutkan`.
- Makefile changes:
  - `setup:` runs `./setup.sh`; the old step chain becomes `langkah` (internal): `check check-env pull db site`.
  - `env`: `RCLONE_REMOTE` optional (written only when given); `SITE` and `ERP_IMAGE` still required.
  - `check-env`: required keys `ERP_IMAGE SITE DB_ROOT_PASSWORD` (`ADMIN_PASSWORD` is removed once the typed
    password is set, so it is no longer required).
  - `check`: `rclone` required only when `.env` has a non-empty `RCLONE_REMOTE`.
  - `site`: after `install-app`, `bench --site "$SITE" set-config -p erp_produksi 1` (moved from `configure`).
  - `configure`: drop the `erp_aktif` line and the `erp_produksi` line.
  - New `lanjut`: `bench --site "$SITE" execute erp_internal.wizard.lanjutkan`.
  - New `wizard-selesai` (internal): exits 0 when `frappe.is_setup_complete` prints True, 1 otherwise, no other
    output.
- `setup.sh` flow (each question skipped when its answer is already there):
  1. `perlu_terminal`.
  2. GitHub: skipped when `docker login ghcr.io` already has credentials (`grep -q ghcr.io ~/.docker/config.json`).
     Else `tanya` the GitHub user name, `baca_sandi` the token; `docker login ghcr.io -u USER --password-stdin`
     (token on stdin); failure → "That token did not work (it needs read:packages), try again." and ask again.
  3. Site address: `tanya "Site address" "" "the exact address people type in the browser, e.g. app.deltaanugrah.com"`;
     skipped when `.env` has `SITE`.
  4. Version: suggestion = newest `vX.Y.Z` tag of `ghcr.io/delta-anugrah/erp-internal`: token from
     `https://ghcr.io/token?scope=repository:delta-anugrah/erp-internal:pull` (basic auth through `curl -K -` on
     stdin, never `-u` on the command line), then `/v2/delta-anugrah/erp-internal/tags/list`, filtered
     `^v[0-9]+\.[0-9]+\.[0-9]+$`, `sort -V | tail -1`. No token this run or no tag → no suggestion, answer
     required. Skipped when `.env` has `ERP_IMAGE`.
  5. Backup destination: `tanya "Backup destination" "skip" "an rclone remote like r2:erp-backup/erp; skip keeps backups on this server only"`;
     `skip` → no `RCLONE_REMOTE`. Skipped when `.env` exists.
  6. `make env SITE=… ERP_IMAGE=… [RCLONE_REMOTE=…]` (non-secret values only) when `.env` is missing.
  7. Wizard question (`tanya_wizard`) when `.siap` is missing.
  8. Accounts (`tanya_akun`, `--hanya-admin` when `WIZARD=tangan`) when `.akun-siap` is missing.
  9. `make langkah`; on a rerun with `.siap` present, `make wizard-selesai` decides whether to ask the wizard
     question now.
  10. `otomatis`: `make wizard configure lanjut COMPANY=… ABBR=…`; `tangan`: `make configure`.
  11. Accounts: `buat_akun "docker compose"`, then `touch .akun-siap`; if typed, delete the `ADMIN_PASSWORD=` line
      from `.env` (`sed -i.bak` then remove the `.bak`, keep mode 600).
  12. `make up ping cron`; `touch .siap`.
  13. Final message: automatic → "Ready: https://SITE (sign in as Administrator or an account above)."; by hand
      while the wizard is incomplete → `petunjuk_wizard "https://SITE"`; then the backup line: with a destination
      "Next: make backup, then a restore drill (README)."; without one "Backups stay on this server only; to copy
      them off it, add RCLONE_REMOTE=<remote> to .env and install rclone."
- `cadangan.sh`: `RCLONE_REMOTE` optional; when empty, after the local copy log "no RCLONE_REMOTE: kept in
  ./cadangan only", skip `rclone copy`/`lsf`/`delete`, still prune the local folder, exit 0.

- [x] **Step 1: Write the failing check** for the optional remote, in the scratchpad: a fake `docker` on `PATH`
  that answers the three `exec`/`cp` calls of `cadangan.sh` (prints three file names, creates them on `cp`), a
  `.env` with only `SITE=x`; `./cadangan.sh` must exit 0 and print the "kept in ./cadangan only" line.
  Run it now: expected FAIL, `RCLONE_REMOTE missing`.
- [x] **Step 2: Change `cadangan.sh`; rerun the check** → exit 0 with the line. Also rerun with
  `RCLONE_REMOTE=x` and a fake `rclone` to confirm the copy path still runs.
- [x] **Step 3: Change the Makefile and write `setup.sh`.**
- [x] **Step 4: Dry runs**
  Run: `cd deploy/server && make -n langkah && make -n wizard configure lanjut && bash -n setup.sh`
  Expected: `site` prints the `erp_produksi` line, `configure` has no `erp_aktif`, `lanjut` prints the execute line.
  Run: `make env SITE=a.b ERP_IMAGE=x:v0.0.1` in a scratch copy of the folder → `.env` without `RCLONE_REMOTE`,
  then `make check-env` → `check-env OK`.
- [x] **Step 5: Commit** `feat(deploy): make setup asks its questions, backup destination optional`

### Task 4: Local `make start-local` asks the same, and `make dev`

**Files:**
- Create: `tools/setup_lokal.sh` (local driver)
- Modify: `Makefile` (root)

**Interfaces:**
- Consumes: Task 2's libraries (sourced from `deploy/server/`), Task 3's `site` (sets `erp_produksi`), `lanjut`,
  `wizard-selesai`.
- Root Makefile:
  - `start-local`: with `.local/siap` → `up -d`, ping, and when the wizard is still incomplete
    (`wizard-selesai` through `-f deploy/server/Makefile COMPOSE=…`) print `petunjuk_wizard
    http://localhost:PORT`; without it → `tools/setup_lokal.sh`.
  - `setup-local` keeps `db site` from the server Makefile and adds `wizard` + `lanjut` only when
    `WIZARD=otomatis`; `configure-local` drops the `erp_aktif` and `erp_produksi` lines; `data-local` is deleted
    (the one-time seed is `lanjutkan`), so `update-local` no longer reloads data.
  - New `start`: the same as `start-local` (Abel 2026-11-03: the short name people type; `start-local` stays).
    `help` lists `make start` first (deviation, Abel 2026-11-04: `make up` is the main name, `make start` and
    `make start-local` stay aliases until the real server is live; `make stop` is now `make down`).
  - New `dev`: `BENCH ?= $(HOME)/Desktop/Projects/erp-internal-bench`; when `$(BENCH)/apps/erp_internal` is
    missing print "No bench at BENCH: run tools/setup_bench.sh first." and exit 1; else `docker start
    erp-mariadb >/dev/null` and `cd $(BENCH) && bench start`. `help` lists it: "make dev  code on the bench:
    Python reloads, JS/CSS rebuild; a DocType change needs bench migrate".
- `tools/setup_lokal.sh`: `perlu_terminal`; `tanya_wizard`; `tanya_akun` (`--hanya-admin` for `tangan`);
  `make setup-local WIZARD=… COMPANY=… ABBR=…`; `buat_akun "$COMPOSE"`; `touch .local/akun-siap .local/siap`;
  final message as on the server with `http://localhost:PORT` (no backup line).

- [x] **Step 1: Write the driver and the Makefile changes.**
- [x] **Step 2: Dry run**
  Run: `make -n setup-local WIZARD=otomatis | grep -c lanjutkan` → `1`; `WIZARD=tangan` → `0`;
  `make -n update-local | grep -c "\.muat"` → `0`; `make dev BENCH=/nope` → the "No bench" line, exit 1.
- [x] **Step 3: Commit** `feat(local): start-local asks the wizard question; make dev`

### Task 5: End-to-end runs (needs Abel's OK: wipes the local stack)

The local stack in `.local/` holds a site. Before this task, ask Abel whether it may be removed
(`make down; docker compose -p erp-local --project-directory .local -f deploy/server/docker-compose.yml down -v; rm -rf .local`).

- [x] **Step 1: Automatic path, local.** `make start-local`, Enter on every suggestion, Administrator + one Admin
  account. Expected: ends with "Ready", sign in as Administrator and as the Admin works, Item count > 0
  (`… run --rm -T tools bash -c 'bench --site "$SITE" execute frappe.db.count --args "[\"Item\"]"'`), Admin has a
  Company User Permission. Run `make start-local` again: no question, seconds. `make update-local`: no `muat`
  output, an item edited in the app keeps its edit.
- [x] **Step 2: By-hand path, local** (wipe again with Abel's OK). Choose 2, Administrator password only.
  Expected: ends with the browser instructions; `make start-local` again repeats them and asks nothing; fill the
  wizard in the browser (Chrome tools) with a new account; within a minute the background job has run (Item count
  > 0) and that account's role profile is Developer (Review Focus 1). Then the by-hand message stops.
- [x] **Step 3: Server flow on the Mac** in a scratch copy of `deploy/server/` with `PORT=8081`, a local image tag
  `erp-internal:v0.0.0` (`docker tag erp-internal:local erp-internal:v0.0.0`), compose project `erp-uji`: run
  `./setup.sh`, skip the GitHub question (already logged in, or answer and let it fail once to see the retry
  line), skip the backup. Expected: setup ends with the "Backups stay on this server only" line; `make backup` exits
  0. Tear it down after (`down -v`).
- [x] **Step 4: Full test run** `bench --site erp-test.localhost run-tests --app erp_internal` → all OK (number in
  the report).

### Task 6: Docs

**README.md must let a first-time reader use it without asking anyone (Abel 2026-11-03):** for local and for the
server, what to install first, the one command (`make start` / `make setup`), every question it asks with what to
answer, the automatic and by-hand wizard paths, where to open the app and who to sign in as, how to stop, start
again, update, and what to do when something fails (the error lines the scripts print). Plain words, one step per
line.

**Files:** `README.md` ("Run it on your computer", "Make commands", rewritten as above), `deploy/server/README.md` ("First install",
restore drill: `--admin-password "$(openssl rand -hex 12)"` since `.env` may have no `ADMIN_PASSWORD`, file table:
the new scripts, "copy this folder's files"), `deploy/server/.env.example`, `CLAUDE.md` (the `Makefile, tools/akun.sh`
row → `deploy/server/akun.sh`, `tools/setup_lokal.sh`, `wizard.py`; Commands block: `make dev`, `make setup`),
`docs/impor.md` (Samuel's data loads by itself once on a real site; the manual commands stay for a reload),
`docs/TODO.md`, `docs/PROGRESS.md`.

- [x] **Step 1:** `grep -rn "tools/akun.sh\|data-local\|make env\|ADMIN_PASSWORD\|RCLONE_REMOTE" --include=*.md . | grep -v superpowers` and fix each hit.
- [x] **Step 2:** Run the `docs-sync` agent with the changed files; fix what it finds.
- [x] **Step 3:** Commit `docs: one-command setup with questions`.

## Deviations made while building (2026-11-03)

- The wizard answer is kept in `.wizard` (server) / `.local/wizard` (local) and never asked again; a later run that
  finds the wizard incomplete reprints the by-hand steps instead of asking again (a run that failed after the
  wizard would otherwise ask a pointless question). To switch from by hand to automatic, delete that file.
- Task 1: `lanjutkan(cetak=True)`: returns its lines with `cetak=False` (tests, the queued job), prints them from
  bench. It does not commit (bench execute and the background job do; a commit flushed mail in tests). It does not
  filter on enabled users.
- Task 2: the terminal message is "This asks a few questions: run it in a terminal."; the by-hand heading is "Values
  to type in the wizard later (Enter keeps each one):"; the fixed values also list Time zone, Language and Chart of
  accounts; `petunjuk_wizard` has no "the wizard's password wins" line (by hand only Administrator is asked).
- Task 3: the `wizard` target greps `true` case-insensitively (bench execute prints JSON `true`).
- Task 4: `.local/siap` is written by `tools/setup_lokal.sh` at the very end; the wizard check is the root
  Makefile's own `wizard-selesai`, the last line `tools/setup_lokal.sh --pesan`; the generated `ADMIN_PASSWORD` also
  leaves `.local/.env`. `PROYEK ?= erp-local` names the compose project, so a test stack runs beside a real one.
- Final review (`e368a26`): `setup.sh` checks `docker info` before the token and stops on a non-auth `docker
  login` error; address, version and backup answers are validated before `make env`; `lanjut` is no longer chained
  to `wizard configure` (Task 3 step 10) nor in `setup-local` (Task 4): `setup.sh` and `setup_lokal.sh` (through
  the new root `lanjut` target) run it once the wizard is done, until `.lanjut-siap` / `.local/lanjut-siap`, so
  Task 4's dry run now counts 0; `wizard.selesai` keeps the account in global default `erp_wizard_developer`;
  `lanjutkan` runs under the site filelock `erp_lanjutkan`; the `ERP_AKUN` message names `make start`/`make setup`.
- 2026-11-05 (Abel): the first run moved to a new root target `setup` (`check-local env-local`, then
  `tools/setup_lokal.sh`; with `.local/siap` it only prints "Already set up: make up starts it"). `start-local`
  (= `up`, `start`) only starts: without `.local/siap` it prints "Not set up yet: run make setup first" and exits 1. The `ERP_AKUN` message now reads "ERP_AKUN is not
  set: run make setup." (`akun.py`, `id.csv`).
- 2026-11-06 (Abel): `petunjuk_wizard URL PERINTAH`: step 5 of the by-hand ending reads "When the wizard is done,
  run PERINTAH here: it loads Samuel's data (a few minutes)." (`make up` from `tools/setup_lokal.sh`, `make setup`
  from `deploy/server/setup.sh`) instead of "Wait a minute after the wizard". In the by-hand rerun the wizard's own
  `delete_dynamic_links` jobs (~1 s each) kept the queued `lanjutkan` waiting over 3 minutes, so Task 5 step 2's
  "within a minute" no longer holds; the command runs `lanjut` itself.
- Task 5: run beside Abel's stack (`~/Desktop/coba-erp`, project `erp-local`) instead of wiping it: projects
  `erp-tanya` (automatic, port 8081) and `erp-tangan` (by hand, port 8082), image `erp-internal:uji-setup`. The
  name `erp-uji` was taken by the 10-31 rehearsal's volumes.
- After Abel's first `make start` (2026-11-03): the company name and abbreviation come already typed in
  (`tanya_isi` in `tanya.sh`: Enter keeps, Backspace and Ctrl+U change, arrows ignored) instead of `[brackets]`, so it
  is plain which value Enter keeps. macOS bash 3.2 has no `read -i`, and its `read -n1` leaves the terminal's line
  editing on (its Backspace could not erase the filled-in text): `tanya_isi` sets `-icanon` itself and restores the
  saved mode; the EXIT trap also restores `icanon`. Driven through a pty with `/bin/bash` 3.2: Enter, Backspace,
  Ctrl+U, an empty answer asked again, arrows ignored, the mode restored.
