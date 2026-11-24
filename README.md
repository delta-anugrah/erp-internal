# ERP Internal

ERPNext v16 for the plastic factory (stock, sales, purchasing, production with a monthly forecast) and the office
(attendance, projects). This repo is the Frappe app `erp_internal`.

- Design: `docs/superpowers/specs/2026-10-27-erp-internal-design.md`
- Plan: `docs/superpowers/plans/2026-10-27-erp-internal-plan.md` (read its "Revision 2", "Revision 3" and "Revision 4" first)
- Plan vs Actual: spec `docs/superpowers/specs/2026-10-28-plan-vs-actual-design.md`, plan
  `docs/superpowers/plans/2026-10-29-plan-vs-actual-plan.md`

## Run it on your computer

ERP Internal with the factory's real catalog, sales and machines, on http://localhost:8080. You need only Docker:
it runs the same stack as the server. `make setup` sets it up once, right after the clone; `make up` starts it every
time after.

### What you need (once)

1. **Docker Desktop**, installed and running (the whale icon is steady, not animating).
   - **Windows**: Docker Desktop with the WSL 2 backend; under Settings > Resources > WSL integration, switch
     Ubuntu on. Then open the **Ubuntu** terminal (Microsoft Store, "Ubuntu") and type every command below in it,
     never in PowerShell. Once, in Ubuntu: `sudo apt update && sudo apt install -y make git curl openssl`.
   - **Mac**: `make` and `git` come with the Xcode command line tools (`xcode-select --install` if the terminal
     asks for them).
2. **The repo.** It is private: your GitHub account must be invited to `delta-anugrah`.

   ```bash
   git clone https://github.com/delta-anugrah/erp-internal.git
   cd erp-internal
   ```

### First time: `make setup`

```bash
make setup
```

It asks a few questions first, then works by itself for 10-30 minutes (building the image is most of it). Every
question shows a suggestion in `[brackets]`: press **Enter** to take it.

1. **The setup wizard** (the company's first settings), automatic or by hand:

   ```text
   Setup wizard (the company's first settings): fill it in automatically, or by hand in the browser?
     1) Automatically (suggested: press Enter)
     2) By hand in the browser
     Your choice [1]:
   ```

   Then the values, one per line with what each is for. Only the company name and its abbreviation can be changed:
   they are already typed in, so Enter keeps them, Backspace changes them (Ctrl+U clears the line):

   ```text
   Automatic values. The first two are filled in: Enter keeps them, Backspace changes them.
     Company name: on invoices, reports and every document
     Company name: PT Delta Anugrah
     Abbreviation: short code added to account and warehouse names
     Abbreviation: DAN
     Fiscal year:       2026                 (the bookkeeping year, 1 January to 31 December)
     Country:           Indonesia            (tax and address formats)
     Time zone:         Asia/Jakarta         (the clock of every document)
     Currency:          IDR                  (the money every price and report is in)
     Language:          English              (each user can switch to Indonesian later)
     Chart of accounts: Standard             (the list of bookkeeping accounts)
   ```

   Choose **1** unless you want to see the wizard yourself.
2. **The accounts.** With the automatic wizard, tick the accounts to create (Up/Down move, Space ticks, Enter goes
   on); Administrator is always there:

   ```text
   Which accounts do you want to create?  (Up/Down move, Space tick, Enter continue)
      [x] Administrator  always created; the built-in super user
    > [ ] Super Admin    everything, plus system settings (for the IT people)
      [ ] Admin          manager: Work Orders, BOMs, users, items, customers, machines
      [ ] Produksi       production output and machine status only
   ```

   Administrator needs only a password (you sign in with the name `Administrator`); every other account an email and
   a password. Each password is typed twice, shows as `*`, and needs at least 8 characters. One account per role is
   enough to start; everyone else gets an account from an Admin in the app later.
   With the wizard **by hand**, only the Administrator password is asked: the other accounts can exist only after
   the wizard (see below).

When it ends:

- **Automatic**: `Ready: open http://localhost:8080 and sign in as Administrator or with an account made here.`
  Samuel's catalog, sales and machines are already loaded.
- **By hand**: it prints the last steps, the same every time you run `make up` until the wizard is done:
  1. open http://localhost:8080 and sign in as `Administrator` with the password you typed;
  2. fill in the wizard with the values printed under it. Two things the wizard does differently: its Chart of
     Accounts suggests "Indonesia - Chart of Accounts", pick **Standard**; its "A little about you" step (kind of
     work, team size) changes nothing here, answer as you like (Manufacturing);
  3. in "Create your account" make your own account: it becomes the **Super Admin** (all rights);
  4. when the wizard is done, run `make up`: it makes your wizard account the Super Admin and loads Samuel's data
     (a few minutes; the background job the wizard starts does it too, but only after the wizard's own jobs,
     which can take many minutes). Then add the Admin and Produksi accounts in the app (Users, with the
     Admin or Produksi role profile).

### Every day after

| You want to | Type |
|---|---|
| Start it | `make up` (seconds, no questions; the first start after a by-hand wizard may take a few minutes while Samuel's data loads; before `make setup` it only says to run that first) |
| Stop it (the data stays) | `make down` |
| Get the newest version | `git pull`, then `make update-local` (rebuilds and migrates; your data and your edits stay; Samuel's data is never loaded twice) |
| Use another port | the very first time only: `make setup PORT=8090` (kept in `.local/.env`) |
| A new person's account, or a forgotten password | an Admin in the app: Users. Everyone changes their own password under their avatar, My Settings, Change Password. |

`make start` and `make start-local` are the same as `make up` (`make start` goes once the real server is live). Everything local is in `.local/` (git-ignored: generated passwords,
the wizard answer, the backups folder); the data is in Docker volumes of the compose project `erp-local`.

### When something goes wrong

| The terminal says | Do this |
|---|---|
| `missing: docker` (or `curl`, `openssl`) | Install it (step "What you need"), then the same command again. |
| `Docker does not answer: start Docker Desktop and try again` | Start Docker Desktop, wait for it, the same command again. |
| `Not set up yet: run make setup first` | `make setup` once, then `make up`. |
| `This asks a few questions: run it in a terminal.` | Run `make setup` in a terminal window, not from a script. |
| `no answer on http://localhost:8080 in 2 minutes` | Docker may still be busy: the same command again. Still failing: the line shows the `docker compose ... logs` command to see why. |
| `port is already allocated` | Something else uses port 8080: `make down` in the other copy, or set this one up with `make setup PORT=8090`. |
| Any other error during the first setup | Run `make setup` again: every step skips what is done and goes on where it stopped; the questions are not asked again. |

Starting over from nothing (this **deletes all data** of this copy):
`make down`, then `docker compose -p erp-local --project-directory .local -f deploy/server/docker-compose.yml down -v`
and `rm -rf .local`, then `make setup`.

## Make commands

Repo root (`Makefile`, on your computer):

| Command | What it does |
|---|---|
| `make help` | Lists these commands. |
| `make setup` | Once, after the clone (no `.local/siap`): `tools/setup_lokal.sh` asks the wizard question (kept in `.local/wizard`) and the accounts, then runs `setup-local`, waits for the stack, makes the accounts (`.local/akun-siap`; the generated `ADMIN_PASSWORD` then leaves `.local/.env`), writes `.local/siap` and prints where to go. Rerun after a failure, it goes on without asking again; once `.local/siap` exists it only says to use `make up`. |
| `make up` | Same as `make start-local` (`make start` too, until the real server is live): starts the containers, waits for them and prints the last line (Ready, or the by-hand wizard's steps). Without `.local/siap` it only says to run `make setup` first. |
| `make down` | Stops the stack; the data stays. |
| `make update-local` | After `git pull`: rebuilds the image from the repo (a released `ERP_IMAGE` in `.local/.env` is pulled again instead; change its tag there to move on), migrates, starts the stack. Never reloads Samuel's data. Run `make setup` first: on a copy never set up it builds, then only says to run `make setup`. |
| `make wizard-selesai` | Exit 0 when the setup wizard is done (used for the last line). |
| `make lanjut` | After the wizard: our setup, the wizard's account as Super Admin, Samuel's data the first time (run by `setup_lokal.sh` until `.local/lanjut-siap`). |
| `make dev` | For coding (not Docker): starts `erp-mariadb` and `bench start` in the bench of `tools/setup_bench.sh` (Python reloads, JS/CSS rebuild; a DocType change needs `bench migrate`). Without the bench it says so. |

`setup-local` is `check-local`, `env-local`, `image-local`, then the server Makefile's `db`, `site` (also sets
`erp_produksi`: real data, sample data refused) and, with `WIZARD=otomatis`, `wizard`; then `configure-local`
(migrate, host name, scheduler); then up. After the wizard, however it was filled, `erp_internal.wizard` ticks the
company's `erp_aktif` and, in a background job and again through `make lanjut` (run by `setup_lokal.sh` until
`.local/lanjut-siap`), makes the wizard's own account a Super Admin and loads Samuel's data once (marker
`erp_data_samuel`). `ERP_IMAGE=ghcr.io/delta-anugrah/erp-internal:vX.Y.Z`
on `make setup` pulls a released image instead of building one (needs `docker login ghcr.io` first: the
image is private). `PROYEK=<name>` (with another `PORT` and `ERP_IMAGE`) runs a second stack beside the first, for
a test.

Server (`deploy/server/Makefile`, run in `~/erp` on the server; runbook `deploy/server/README.md`):

| Command | What it does |
|---|---|
| `make help` | Lists the steps. |
| `make setup` | Runs `setup.sh`: the questions (GitHub token, site address, app version, backup destination, wizard, accounts; each skipped when already answered), `.env`, then `langkah` (`check check-env pull db site`), `wizard configure` (automatic) or `configure` (by hand), the accounts, `lanjut` once the wizard is done, `up ping cron`, and the last line. |
| `make env SITE=… ERP_IMAGE=… [RCLONE_REMOTE=…]` | Writes `.env` with generated passwords, once, without questions. |
| `make langkah` | The steps before the wizard: `check check-env pull db site` (`make -n langkah` prints their commands). |
| `make wizard-selesai` | Exit 0 when the setup wizard is done, 1 when not. |
| `make check` | Tools on the host (docker, compose, openssl, curl, crontab; rclone only with a backup destination) and the time zone Asia/Jakarta. |
| `make check-env` | `.env` is mode 600, has `ERP_IMAGE`, `SITE`, `DB_ROOT_PASSWORD`, `ERP_IMAGE` is an exact tag. |
| `make pull` | Pulls the image (needs `docker login ghcr.io`; `make setup` does it). |
| `make db` | Starts MariaDB, Redis and the configurator. |
| `make site` | Makes the site if missing, installs any missing app, sets `erp_produksi`. |
| `make wizard` | Completes the setup wizard (skipped when done). |
| `make configure` | Migrates, sets `host_name`, turns the scheduler on. |
| `make lanjut` | After the wizard: our setup, the company on Admin/Produksi accounts, Samuel's data the first time. |
| `make up` | Starts the whole stack. |
| `make ping` | Checks that the stack answers on `127.0.0.1:PORT` (8080 unless `.env` sets PORT). |
| `make cron` | Adds the nightly backup line to the crontab, once. |
| `make backup` | One backup by hand (`cadangan.sh`; without `RCLONE_REMOTE` it stays in `./cadangan`). |

## Dev setup (macOS)

Needs Docker, `python3.14`, Node 24 with yarn, `redis-server` and `pipx install frappe-bench`.

1. Create `~/Desktop/Projects/erp-internal-bench/.env` (mode 0600) with `DB_ROOT_PASSWORD=...` and
   `ADMIN_PASSWORD=...`. Never commit it. Another folder: set `ERP_BENCH`.
2. Run `tools/setup_bench.sh`. It skips every part that already exists:
   1. `db`: container `erp-mariadb` (mariadb:11.8.9, 127.0.0.1:3308, utf8mb4);
   2. `bench`: `bench init` with the Frappe tag from `versi.json` and Python 3.14;
   3. `ports`: web 8002, socketio 9002, redis queue 11002, redis cache 13002, DB 127.0.0.1:3308;
   4. `apps`: erpnext and hrms at their pinned tags;
   5. `link`: `apps/erp_internal` → this repo, `pip install -e`, `sites/apps.txt`;
   6. `sites`: `erp.localhost` and `erp-test.localhost` (`allow_tests`) with erpnext, hrms and erp_internal;
   7. `wizard`: completes the setup wizard of `erp.localhost` without a browser, ticks PT Delta Anugrah's `erp_aktif` (Run by ERP Internal) and runs
      `migrate`, which builds its warehouses, item groups, UOMs, production defaults and holiday lists (`erp_internal/setup.py`).
3. `cd ~/Desktop/Projects/erp-internal-bench && bench start`, then open http://erp.localhost:8002 and sign in as
   Administrator.

### Setup wizard values (erp.localhost)

| Field | Value |
|---|---|
| Language | English |
| Country | Indonesia |
| Time zone | Asia/Jakarta |
| Currency | IDR |
| Company | PT Delta Anugrah (DATA CONTOH on dev; renamed from PT Contoh Plastik 2026-10-29) |
| Abbreviation | CPL |
| Chart of accounts | Standard |
| Fiscal year | 1 January to 31 December of the current year |

No extra user is created; Administrator only. `erp-test.localhost` is completed on the first test run by our
`before_tests` hook (`erp_internal.tests.utils.sebelum_tes`), which runs HRMS's (company `_Test Company`, INR; our
tests make their own IDR companies and price lists) and then our setup. That first run takes about 8 minutes.

## Branding

The site shows PT Delta Anugrah's mark and the name "Delta Anugrah" on the login page, the top left of the Apps
screen, the loading splash and the browser tab. Setup sets it on every migrate (`setup.MEREK`, System Settings
`app_name`). The files are `erp_internal/public/images/`: `delta-anugrah.svg` (the vector, redrawn by hand from the
original 200 px `delta-anugrah.jpeg`, kept beside it), and rendered from the SVG `delta-anugrah.png` (512 px,
transparent), `favicon-32.png` and `favicon-192.png`. Settings point at the SVG; the favicon stays PNG.

The Apps screen tiles are named ERP (ERPNext), HR (Frappe HR), Production Floor (the floor page, for Manufacturing
User and Produksi) and System (Frappe, Super Admin only); Indonesian: ERP, SDM, Sistem. Each has its own icon in one style, a Delta-blue rounded square with a white Lucide glyph
(ISC licence): `aplikasi-erp.svg` (factory), `aplikasi-hr.svg` (users), `aplikasi-sistem.svg` (settings), `aplikasi-lantai.svg` (gauge). The
sidebar header inside an app shows that app's icon (System app: the rail's top slot). That is `tampilan.merek_aplikasi` (`extend_bootinfo`, the boot
copy of `app_data` only); a workspace saved from the desk keeps them (`erp_internal/ruang_kerja.py`).

## Language

The UI is English. Each user switches to Indonesian, and back, from the user menu ("Bahasa Indonesia" /
"English"); the Indonesian is `erp_internal/translations/id.csv`. Dates, numbers, time zone and currency are
Indonesian for everyone.

## Tests

```bash
cd ~/Desktop/Projects/erp-internal-bench
bench --site erp-test.localhost run-tests --app erp_internal
bench --site erp-test.localhost run-tests --module erp_internal.tests.test_situs   # one file
```

Browser check of each role's screens (needs `bench start` and the sample users `developer@`, `admin@`, `user@example.com` of `contoh.py`):
`cd tools && npm install && npx playwright install chromium`, then `ERP_SANDI=<password> node tools/cek_layar.mjs`
(the password is `SAMPLE_PASSWORD` in the bench's `.env`). It also checks the app version under the login card (as a guest) and at the foot of each role's Settings dialog. Screenshots land in `tools/hasil/` (not committed). The user guides' pictures (`docs/panduan/gambar/`) are retaken the same way with `tools/panduan_gambar.mjs` (name a picture to retake only it: `produksi-1`; Admin's screens as `admin@`, `gudang-2`/`gudang-3` too, since Produksi records production only).
`tools/lantai.mjs` checks the Production Floor page (`/desk/production-floor`, Manufacturing's first link) the same
way: the 14 machines in floor order, status lamps, labels, the side panel and its status buttons, live updates, the
info bar, the attention card, the loading screen, the dark decor, the glass look in light and dark, a plain table without WebGL, and the smoothness budget (frame rate,
dropped frames, long tasks, draw calls) in a visible browser; the header of `tools/lantai.mjs` lists the cases (it turns the inactive machines on during the run and back off at exit, so run it on `erp.localhost` only); `.claude/rules/lantai.md` has the budget and the lessons. If
`bench build` ran while `bench start` was up, restart `bench start` first: the web process keeps the old
`assets.json` and the desk loads blank. If `bench start` stops at once with "Address already in use" on 11002 or
13002, a Redis from an earlier run is still up: `lsof -nP -iTCP:11002 -iTCP:13002 -sTCP:LISTEN`, stop those
`redis-server` processes, start again.

`tools/e2e_samuel.mjs` runs each profile's main flow for Samuel's 2026-11-23 requests in the browser (Produksi's
Daily Input, Admin's Work Order, Sales Order, Delivery Note from Gudang Pluit, expenses and reports, Super Admin's
PO print): `ERP_SANDI=<password> node tools/e2e_samuel.mjs`, exit code 1 on a failed step. It deletes what it made
where ERPNext allows; each run leaves a cancelled Production Entry, its cancelled Stock Entries and a cancelled
Delivery Note on `erp.localhost`.

## Factory flow and data import

- Purchase Orders and Sales Orders are Admin's since 2026-11-23 (Samuel; printed in his PO layout, `PO Samuel`); a
  Delivery Note may still be made directly without a Sales Order, every Purchase Receipt comes from an order, stock never goes negative, stock posts no journal
  entries, and the company gets PPN templates that are never the default (not PKP: invoices only record) (`setup._alur_jual_beli`). Staff guides:
  `docs/panduan/{penjualan,pembelian,gudang}.md`.
- Importing the old data (items, customers, suppliers, opening stock): `docs/impor.md`; its CSV files are tested
  by `erp_internal/tests/test_impor.py` (`erp_internal/tests/data/`). Sales History (monthly quantities per item):
  `docs/impor.md` section 5, tested by `tests/test_sales_history.py` (`tests/data/riwayat.csv`).
- The factory's master data (Dinda House Ware price list, 14 injection machines): `bench --site erp.localhost
  execute erp_internal.master.muat` reads `erp_internal/data/{katalog,mesin,merek_epp}.json` (templates with only the listed
  variants, packings, price list `Harga Pola 2026`, also the Sales Order default while Selling Settings still says Standard Selling, Workstations `Mesin 01`..`14`, the 21 Seal Cap brands with their Inserts (pcs)); rerun after a new file
  (`docs/impor.md`, tested by `tests/test_master.py`).
- The factory's sales Excel (2026-10-29), after `master.muat`: `bench --site erp.localhost execute erp_internal.penjualan.muat`
  reads `erp_internal/data/penjualan_2026.json`: the types and products it sells beyond the price list, 7 raw
  materials with their price per kg (buying list `Harga Bahan Baku`, also the Purchase Order default while Buying
  Settings still says Standard Buying), Sales History January-September 2026 (spread evenly over the colours) and each
  variant's `safety_stock` (half an average month) (`docs/impor.md`, tested by
  `tests/test_penjualan.py`).
- The item-to-machine list (2026-11-02), after `penjualan.muat`: `bench --site erp.localhost execute
  erp_internal.mesin_barang.muat` reads `erp_internal/data/mesin_barang.json` and makes a Machine Capacity row per
  template + Jenis and machine ("( n )" = the mould's cavities) (54 rows) and their BOMs (`docs/impor.md`, tested by `tests/test_mesin_barang.py`). Machines 1, 7, 9-14 are inactive (`mesin.json` `aktif`).
- Production (`erp_internal/planning/`, module Planning): the company's Work Orders default to its Gudang
  Produksi / Barang Jadi / Reject and items to their group's warehouse (`setup._produksi`). A draft monthly Sales
  Forecast gets "Fill from History" (`planning/forecast.py`: the last 3 full months of Sales History and submitted
  orders, rounded up), then MPS → MRP → Work Order; the Order Readiness report shows what is short and when to
  start (`planning/rumus.py`, design §10). It needs read permission on the chosen Company (and Warehouse);
  other companies' stock is refused. Staff guide: `docs/panduan/produksi.md`.
- Production (capacity and output): Machine Capacity per product per machine (`planning/kapasitas.py`). "Make BOMs"
  and the Excel import (`docs/impor.md` section 6) build one default BOM per variant per machine; a draft Work Order
  with a machine gets that machine's BOM (`pilih_bom`). Production Entry (typed in the Daily Input page; "Record Output" on a Work Order opens it) books the
  good pieces (Manufacture) and the rejects (Repack into Gudang Reject) as two Stock Entries; the Plan vs Actual
  report compares them with the target. Guide: `docs/panduan/produksi.md`.
- Samuel's requests of 2026-11-23 (spec `docs/superpowers/specs/2026-11-23-permintaan-samuel-design.md`): a Work
  Order takes only a machine its item's Machine Capacity lists; a second sales warehouse Gudang Pluit, picked per
  Delivery Note; the Daily Input page in his Excel layout (Shift 1 / Shift 2, technicians, TOTAL) with Print and
  Excel; paper documents attached before submit and the Missing Documents report; Expense Entry (Once, Every month,
  Per machine shift) and the Monthly Expenses report with pigment and packing used by production; print formats
  `PO Samuel` / `PO Samuel Beli`; pigment per colour (`PIGMEN`, grams) and packing per product (Item Packing) in the
  capacity BOMs; the Seal Cap brand codes with their mould inserts. Guides: `docs/panduan/admin.md`, `produksi.md`.
  Browser run of each profile's flow: `ERP_SANDI=… node tools/e2e_samuel.mjs` (see Tests).
- Missing data notices (Abel 2026-11-24, `erp_internal/kelengkapan.py`): products without packing, colours without a
  pigment, products without a selling price or machine capacity, no running Gaji Operator expense, pigment or packing
  without stock. Orange notes on the Item, Sales Order and Work Order forms and in Monthly Expenses, each with a link
  to the place it is fixed, and the report Settings → Missing Data listing all of them.

## Screens

On ERP and HR pages the left side is one labelled menu instead of Frappe's icon rail (`erp_internal/public/js/menu_samping.js`,
`tampilan.menu_samping`): a collapsible header per module, with its icon (`IKON_MODUL`), and the module's links under it. The
page's module opens by itself; several can be open at once. Frappe's own System app keeps its rail.
Every module shows only what the guides' flows use (`tampilan.IKON`, `SIDEBAR`, `PINTASAN`); each home is a row of
shortcuts to the same links as its menu entries, nothing else:

| Menu header | Home and links |
|---|---|
| Stock | Stock Entry, Delivery Note, Item, Brand, Warehouse, Stock Balance, Stock Ledger, Missing Documents |
| Selling | Customer, Open Sales Orders (Sales Order), Delivery Note, Unpaid Sales Invoices (Sales Invoice), Payment Entry, Sales History |
| Buying | Supplier, Pending Material Requests (Material Request), Purchase Order, Purchase Receipt, Purchase Invoice, Expense Entry, Monthly Expenses |
| Production Floor, Daily Input (own menu entries, first) | the floor page; the Daily Input page |
| Manufacturing | Production Floor (home shortcut only), Work Orders in Process (Work Order), Daily Input (page; also an own menu entry), Plan vs Actual, Machine Capacity, then Admin only: Sales History, Master Production Schedule, MRP, Order Readiness, BOM, Sales Forecast, Item Lead Time |
| Projects | Open Projects (Project), My Open Tasks (Task), New Timesheet |
| HR (HR app; its home is our Workspace "HR") | Employee, Employee Checkin, Today's Attendance (Attendance), New Leave Application, Shift Type, Shift Assignment, Holiday List, Leave Allocation |
| Settings (Admin) | Users, Company, Opening Stock & Stock Count (Stock Reconciliation), Stock, Selling, Buying, Manufacturing, Reject Reason, Accounts, Projects and HR Settings, Missing Data |

The menu folds to a rail of module icons and opens again with the 32 px arrow at the panel's bottom edge; the browser
remembers the choice (`erp_internal/public/css/erp_internal.css` keeps the arrow visible). On a phone it is Frappe's drawer.

The table is Admin's view. A Produksi user's menu has only Manufacturing (`IKON`, `MODUL_BOLEH`); within them they see only what their roles read. A direct URL to another permitted
doctype or report still opens. Unused modules (`tampilan.MODUL_MATI`) and HR's unused DocTypes (`tampilan.DOCTYPE_MATI`:
recruitment, appraisal, training, expenses, travel, lifecycle, vehicles, skills, overtime) are locked for everyone but
Administrator and their reports are disabled; remove an entry and migrate to unlock it.

## Roles

Three Role Profiles (`erp_internal/tampilan.py` `PROFIL_PERAN`), all in the one company:

- **Produksi** (was User; Samuel 2026-11-23): `ERP User` only, no stock role. Creates only Production Entries (their
  stock moves are made by the system), sets a machine's status on the Production Floor, and reads Work Orders,
  machines, Machine Capacity and Plan vs Actual; menu Manufacturing only. Guide: `docs/panduan/user.md`.
- **Admin**: the manager roles (Work Orders, items, suppliers, BOMs, stock, delivery notes, raw material in, stock
  reconciliation, selling, buying, projects, HR), users and the business
  settings (menu header Settings). `erp_internal/pengguna.py` lets an Admin give only the Admin and Produksi roles and
  never change a Super Admin's account. Admin only views Production Entries; a Manufacture straight from a Work
  Order (its Finish button) is refused, so all output goes through a Production Entry. Guide: `docs/panduan/admin.md`.
- **Super Admin** (was Developer): Admin plus System Manager (Build, System Settings, the Work Order's Finish, and
  Production Entries).

## Office: attendance and projects

- Attendance by phone with location on stock HRMS (`setup._kantor`): one shift "Kantor" 08:00-17:00 with auto
  attendance (`SHIFT_KANTOR`), Saturday and Sunday off in a yearly "Libur <abbr> <year>" list assigned to the
  company, leave types Cuti Tahunan (12), Sakit, Izin. Staff guide: `docs/panduan/absen.md`.
- Projects (`setup._proyek`): Activity Types Pengembangan, Rapat, Dukungan Klien, Administrasi without rates; an
  employee (Projects User and Employee roles, outside the Produksi profile) submits only their own timesheets (`erp_internal/proyek.py`); Admin and Super Admin can submit
  anyone's. Staff guide: `docs/panduan/proyek.md`.

## Sample data

`erp_internal/contoh.py` fills a dev site with DATA CONTOH (tagged): one company (PT Delta Anugrah, abbreviation CPL, with its logo), products
with BOMs, lead times and stock, two packing items on the products, two pigments (Merah, Biru) with stock and buying
prices, customers, suppliers, 6 months of Sales History, open orders, 10 Machine Capacity rows with their BOMs (packing
included), 4 open Work Orders (plus one older order without a machine) with 7 days of output ending yesterday (Shift 1
with rejects, technician Yudi; Shift 2 typed through Daily Input, technician Fadli), a transfer to Gudang Pluit and a
delivery note from it, four expenses (operator wage per machine shift, fixed salaries every month, electricity and
fuel once), employees on the shift, one project, and one user per role (`developer@`, `admin@`, `user@example.com`):

```bash
bench --site erp.localhost set-config erp_sandi_contoh <password>
bench --site erp.localhost execute erp_internal.contoh.buat_contoh
```

It is idempotent (a second run writes nothing) and refuses to run on a site with `erp_produksi` set. On the dev
Mac the password is kept only in `~/Desktop/Projects/erp-internal-bench/.env` as `SAMPLE_PASSWORD`.

## Server

### Put it on the server: `make setup`

Before it, by hand (`deploy/server/README.md` steps 1-3): an Ubuntu server with Docker and the user `deploy`, a DNS
record for the address (for example `app.deltaanugrah.com`) pointing at it, and the reverse proxy with TLS. Then,
as `deploy`, copy the files of `deploy/server/` into `~/erp` and:

```bash
cd ~/erp
make setup
```

It asks, each with a suggestion in `[brackets]` (Enter takes it), and skips what is already answered:

1. **GitHub user name and token**, to download the app: a token with only `read:packages`. A wrong token says
   `That token did not work (it needs read:packages), try again.` Skipped when the server is already signed in.
   If Docker does not answer it stops with `Docker does not answer for <user>: install Docker and add <user> to the
   docker group (README step 1).`
2. **Site address**: exactly what people type in the browser, e.g. `app.deltaanugrah.com` (anything else is asked
   again).
3. **App version**: the newest release is suggested (`vX.Y.Z`); without a release yet, type the version. Not three
   numbers: `A version has three numbers, like v0.1.0, try again.`
4. **Backup destination**: an rclone remote like `r2:erp-backup/erp`, or Enter to `skip`. Skipped, the nightly
   backup still runs and stays in `~/erp/cadangan` on the server only; add `RCLONE_REMOTE=...` to `.env` (and
   install rclone) later to copy it off the server.
5. **The setup wizard**, automatic or by hand, and 6. **the accounts**: the same as on your computer (above).

Then it runs every step (10-20 minutes the first time) and ends with `Ready: https://<address>` or, by hand, the
wizard's last steps (the last one: `make setup` again once the wizard is done, to load Samuel's data). Run
`make setup` again any time: it asks nothing already answered and skips every step that is
done. Afterwards: `make backup` and a restore drill (`deploy/server/README.md`).

### The image

The image is built from `deploy/Containerfile` (Frappe, ERPNext and HRMS at the tags in `versi.json`) by
`.github/workflows/image.yml` on a `vX.Y.Z` tag and checked by `deploy/check_image.sh`. The workflow refuses a tag that is
not `v` + `erp_internal.__version__` (the version on the login page and in Settings): bump `erp_internal/__init__.py`
before tagging (`deploy/server/README.md` "New version"). The stack, backups
(`cadangan.sh`) and the runbook: `deploy/server/README.md`. Locally:

```bash
docker build -f deploy/Containerfile -t erp-internal:uji . && deploy/check_image.sh erp-internal:uji
```
