# One-command setup with questions, and a choice of wizard (design)

Date: 2026-11-03. Asked by Abel. Repo: erp-internal (branch `feat/lokal`).

## Why

Setting up ERP Internal must be as simple and short as possible, for Abel now and for Samuel (not technical,
Windows through WSL) later. Today the server needs a long `make env SITE=… ERP_IMAGE=… RCLONE_REMOTE=…` line,
the password of Administrator lives only in a generated file, and the setup wizard is always filled by a script
with values nobody sees. Abel wants one command per place, plain questions in the terminal with a suggested
answer, and the choice to fill the wizard by hand in the browser.

## Goals

1. **Server: one command, `make setup`.** It asks everything it needs, then runs every step it runs today
   (check, pull, db, site, wizard if chosen, configure, up, ping, cron). No `make env` line to type.
2. **Local: `make start-local` asks the same wizard question** as the server (mirror of the server, Abel).
3. **Wizard choice, asked once:** automatic (default) or by hand in the browser.
   - Automatic: the values are shown first, one per line, each with what it is for, and each can be changed.
   - By hand: setup stops short of the wizard and ends with "open <url>, sign in as Administrator, fill in the
     wizard"; the values to type are printed in the same list.
4. **Everything that needs the wizard runs from a `setup_wizard_complete` hook**, whichever way the wizard was
   filled: tick `erp_aktif` on the wizard's company, run `setup.pastikan_setup`, and on a real site load Samuel's
   data (`master`, `penjualan`, `mesin_barang` `.muat`). Safe and a no-op before the wizard; running it twice
   changes nothing.
5. **Server accounts like local:** `make setup` asks the Administrator password and the optional Developer /
   Admin / User accounts in the terminal, the same picker as `tools/akun.sh`.
6. **`make dev`:** one command for coding on the bench (`bench start`: Python reloads itself, JS/CSS rebuild
   themselves; DocType changes still need `bench migrate`).
7. Docs follow (README, `deploy/server/README.md`, CLAUDE.md, `docs/`).

## Non-goals

- Dev site (`erp.localhost` on the bench) and test site keep their automatic wizard (`tools/setup_bench.sh`,
  `before_tests`), unchanged. Sample data (`contoh.py`) stays dev only.
- No change to how backups work, the image build, or the compose stack.
- DNS for the domain stays by hand (it is set where the domain was bought).
- The same work for BPT or the sawit autoerp: later, one at a time, each in its own session, only once this one
  works here (Abel 2026-11-03).

## Anti-goals (would be a failure even if it works)

- A long or technical question flow. Every question: one plain line saying what it is for, a suggested answer,
  Enter accepts it.
- Choices or values printed side by side. **One option or value per line, each saying what it is for**
  (Abel 2026-11-03). Example:

  ```
  Setup wizard: fill it in automatically, or by hand in the browser?
    1) Automatically (suggested: press Enter)
    2) By hand in the browser

  Automatic values (Enter keeps each one):
    Company name:   PT Delta Anugrah   (on invoices, reports and every document)
    Abbreviation:   DAN                (short code added to account and warehouse names)
    Fiscal year:    2026               (the bookkeeping year, 1 January to 31 December)
    Country:        Indonesia          (tax and address formats)
    Currency:       IDR                (the money every price and report is in)
  ```

- A secret on a command line, in the Makefile, or shown on screen (passwords are typed blind, `*` per character,
  as `tools/akun.sh` does today).
- The wizard failing because of our hook (the hook runs inside the wizard; an exception there rolls the whole
  wizard back), or timing out because a data load is slow in a browser request.

## Decided

- **Questions of `make setup` (server), in this order**, each skipped when its answer is already in `.env`:
  1. GitHub token to download the app (`docker login ghcr.io`), skipped when already logged in.
  2. Site address (e.g. `app.deltaanugrah.com`; it must be the exact address typed in the browser).
  3. App version (suggested: the newest release tag; Enter accepts).
  4. Backup destination (rclone remote); **may be skipped**. Skipped: setup does not fail; nightly backups stay
     on the server only and a line says how to add the destination later.
  5. Wizard: automatic (default) or by hand, with the values list above.
  6. Accounts: Administrator password (required), then optional Developer / Admin / User (email + password).
- Answers that the stack needs on every start go in `.env` (mode 600) as today; the generated database password
  stays generated. Account passwords are never written to a file (they go through an environment variable to
  `erp_internal.akun.buat`, as now).
- `make start-local` (local) asks only the wizard question and the accounts; the site address, version and
  backup are fixed locally as today (`erp.localhost`, port 8080, the image built from the repo).
- Wizard values: company `PT Delta Anugrah`, abbreviation `DAN`, fiscal year = current calendar year, Indonesia,
  Asia/Jakarta, IDR, English, chart of accounts Standard, no demo data. The company and abbreviation can be
  changed in the question; the rest are fixed.
- Samuel's data is loaded on the server too once the wizard is done (Abel: "semua data dari samuel ikut di
  seed"), automatic or by hand.
- The hook loads Samuel's data only on a real site (`erp_produksi` set), so dev and test sites never get it.
  `erp_produksi` is therefore set when the site is made, before the wizard (today `configure` sets it after).

- **The wizard's own account** (the browser wizard, signed in as Administrator, requires "Create your account":
  name, email, password; Frappe makes it a System Manager): the hook puts that user in the **Developer** Role
  Profile (Abel 2026-11-03). If its email is one typed in the terminal, the wizard's password wins; say so on the
  by-hand path's printed instructions.
- **Samuel's data is a one-time seed** (Abel 2026-11-03): loaded once, when the wizard completes. Later updates
  (`make update-local`, a new image on the server) never reload it, so edits made in the app are kept.
  `data-local` leaves `update-local`.

### Calls made by Claude after the builder check (Abel to confirm while reading)

- **Skipped backup destination:** `cadangan.sh` still makes the nightly backup into `./cadangan` and only skips
  the upload, with a one-line warning; `check-env` no longer requires `RCLONE_REMOTE`, and `check` requires
  `rclone` only when it is set. (This is a small change to backups, needed so a skipped answer does not make the
  nightly job fail.)
- **Accounts on a second run:** asked once, then a marker file (like local `.local/akun-siap`) keeps later runs
  from touching live passwords. The generated `ADMIN_PASSWORD` is only for `bench new-site`; once the typed
  password is set it is removed from `.env` so no stale password stays there.
- **App version:** the suggestion is the newest `vX.Y.Z` tag of `ghcr.io/delta-anugrah/erp-internal`, read with
  the token from question 1 (so the token comes first). No release yet: no suggestion, the person types it.

## Current state (what to build on)

- `Makefile` (root): `start-local` → `setup-local` reuses `deploy/server/Makefile`'s `db site wizard`, then
  `configure-local` (erp_aktif, migrate, host_name, erp_produksi, scheduler), `data-local`, up, `ping-local`,
  then `tools/akun.sh` once (`.local/akun-siap`).
- `deploy/server/Makefile`: `env` (needs SITE/ERP_IMAGE/RCLONE_REMOTE on the command line), `check-env` (all
  five keys required, exact `:vX.Y.Z` tag), `wizard` (calls `setup_complete` with COMPANY/ABBR/TAHUN),
  `configure` (sets `erp_aktif` by COMPANY name). Only `Makefile`, `docker-compose.yml`, `cadangan.sh` and
  `.env` are in `~/erp` on the server; `cadangan.sh` refuses to run without `RCLONE_REMOTE`.
- `setup.pastikan_setup` (after_install / after_migrate) is already safe before the wizard: it returns early
  when `frappe.is_setup_complete()` is false.
- Frappe runs each `setup_wizard_complete` hook as a wizard stage with the wizard's args (`company_name`, …);
  an exception fails and rolls back the wizard (`frappe/desk/page/setup_wizard/setup_wizard.py`).
- `akun.buat` gives Admin/User accounts the first `erp_aktif` company; before the wizard there is none.

## Left to the builder

- Script language and file layout for the question flow (bash like `tools/akun.sh` is the obvious fit; the
  server needs its copy in `deploy/server/` since only that folder is on the server). Sharing one script
  between local and server is welcome if it stays simple.
- How the hook avoids a slow wizard: e.g. the data load as a background job (`frappe.enqueue`) after the wizard
  commits, or kept inline if it is measured fast enough. It must not fail the wizard.
- How accounts made before the wizard get their company once it exists (e.g. the hook sets it), so an Admin or
  User made before a by-hand wizard ends up like one made after.
- How `make setup`/`start-local` know the wizard is still to be done on later runs (e.g. ask again only while
  `frappe.is_setup_complete()` is false) and what the final message says in each case.
- Removing the `configure`/`configure-local` `erp_aktif` line once the hook does it; keeping `make env`
  working non-interactively for scripts is optional.
- `make dev` details (e.g. refuse cleanly when the bench is missing and point to `tools/setup_bench.sh`).
- Tests: the hook (before the wizard, after, twice, with and without `erp_produksi`), and `akun.buat` before the
  wizard. The shell flow is checked by hand and with `make -n`.
