# ERP Internal (plastic factory + office): design

Date 2026-10-27. Status: draft for Abel's review. Asked by Mas Samuel in a chat to Abel on 2026-10-27; Abel agreed
the scope the same day. Task 1 of the plan moves this file to `docs/superpowers/specs/` in the new repo.

## Revision 2 (Abel, 2026-10-27 23:00)

- **The UI is English by default.** Each user can switch to Indonesian with one click in the user menu. Our own
  text is English, translated in `translations/id.csv`, and a test makes sure every string of ours is translated.
  This replaces "Indonesian locale/labels" in §6 and §8. Number, date, time zone and currency stay Indonesian.
- **English names.** `Riwayat Penjualan` becomes DocType `Sales History`. "Siap Order" becomes the report `Order
  Readiness`. In Indonesian the user still sees the old names.
- **Friendly screens** ("usahakan semuanya user friendly"):
  - full width by default ("W-FULL");
  - every module opens on a home page with big shortcuts for that bagian;
  - forms lose the fields of features we don't use;
  - company and warehouse are filled in by default;
  - a browser check runs as each bagian.

  Plan: Revision 2, item 4.
- The repo `delta-anugrah/erp-internal` (private) exists since 2026-10-27.

## 1. Why

Samuel's message:

> buat erpnext buat internal kita juga ya. mungkin nov/dec sy mau terapin inventory, sales, purchase, project
> management, absen. ini yg pabrik plastik sy mau buat invetory dlu sm penjualan. soalnya skrg issue di produksi, jadi
> sy mw systemnya ngebantu biar klo ada orderan brgnya udah siap. based on previous order, jadi ada monthly forecast
> gitu + production. jadi produksi perlu brp hari -> inventory -> penjualan

The plastic factory starts production only after an order arrives, so orders ship late. Samuel wants the system to
predict each month's demand from past orders and to know how many days production takes. Then production starts
early enough that the goods are already in stock when the order comes in. The chain is: production lead time, then
stock, then sales.

Plain ERPNext, no 3D or animation (unlike BPT).

## 2. Who uses it

One site with two companies (Abel, 2026-10-27):

- **The plastic factory** (`Company.erp_jenis` = Pabrik): stock, sales, purchasing, production with the monthly
  forecast. It goes first.
- **Our office** (`erp_jenis` = Kantor): attendance and project management.

People work in a *bagian* (section). Each bagian is one Role Profile plus a Module Profile (§9). Samuel is the owner
and holds System Manager.

## 3. Goals and success

1. The factory runs stock, sales and purchasing in the system on real data by mid-November 2026.
2. Every week the factory sees, per product, what is short and the latest day production must start (the "Siap
   Order" report). The numbers come from a forecast that is filled automatically from past orders. The team plans
   production from it.
3. The office runs attendance and projects by mid-December 2026.
4. Measure of the outcome: how many sales order lines ship on or before their delivery date, per month from go-live.
   ERPNext's standard Sales Order Analysis report shows the delay; nothing is built for it.

## 4. Non-goals

- Accounting beyond invoices and payments. No financial statements, journals, budgets or banking (all hidden).
  Perpetual inventory is off, so stock posts no GL.
- e-Faktur/Coretax, payroll, recruitment, appraisals, expense claims, CRM, assets, quality, subcontracting, support,
  website/portal.
- Fingerprint-machine integration. If Samuel picks a machine (§12 q5), it becomes a separate follow-up.
- Statistical or AI forecasting. The forecast is a plain average of the last 3 months, and people can edit it.
- Anything from BPT: twin, Asisten, replication, whitelabel.
- Deleting ERPNext modules. Unused modules are hidden only.
- A data generator for demos. Tests carry their own data, and go-live uses Samuel's real data.

## 5. Anti-goals (a failure even if it works)

- Staff find it slower than their Excel: too many menus, English labels, fields they never use.
- A forecast nobody can explain or override.
- Demand counted twice: a history file imported twice, imported history plus live orders for the same month, or
  cancelled and amended orders.
- Lost data because the server has no tested off-site backup.
- Sharing a bench, site, database or server with BPT, or touching the sawit server.

## 6. Platform (Claude's calls, unless Abel objects)

- Frappe v16.53.0, ERPNext v16.52.1 and HRMS v16.52.0 are the newest stable tags on 2026-10-27. They are pinned in
  `versi.json`. v15 has no Sales Forecast and no Master Production Schedule, so it does not fit.
- Python 3.14, Node 24, MariaDB 11.8.9 and Redis, which are v16's minimums. The dev Mac already has Python 3.14.8 and
  Node 24.22.1.
- One custom app, `erp_internal`, holds every customisation. A fresh site is fully rebuilt by
  `bench migrate`. It lives in a new private repo, `erp-internal` (GitHub org `delta-anugrah`, created by Abel or on
  his approval).
- Production runs on a separate server, never the sawit droplet. It uses a Docker image built on a version tag,
  following bpt's `deploy/Containerfile`, `.github/workflows/image.yml` and `deploy/droplet/docker-compose.yml`.
- Dev setup:
  - folder `~/Desktop/Projects/erp-internal/`, holding the repo `erp_internal/`, the bench `bench/` (the app
    symlinked in, like bpt) and `.env` with the secrets (mode 0600);
  - MariaDB container `erp-mariadb` on 127.0.0.1:3308;
  - bench ports 8002/9002/11002/13002;
  - sites `erp.localhost` and `erp-test.localhost`.

## 7. What ERPNext v16 already does (checked in the v16 source, 2026-10-27)

- **Sales Forecast.** You pick items and periods, and it makes demand rows set to 1.0 each, typed in by hand.
  `create_mps` turns it into a **Master Production Schedule**. The schedule takes demand from the forecast, open
  sales orders and material requests. Each row gets `order_release_date` = delivery date minus the lead time,
  added up through the BOM.
- **Item Lead Time** (stock module): capacity per day, manufacturing minutes, shifts, number of workstations,
  purchase time, buffer time and daily yield.
- **Material Requirements Planning Report**: demand against supply (stock, work orders, purchase orders), safety
  stock, lead time and release date. It has a "Make Purchase / Work Order" button.
- **Exponential Smoothing Forecasting** report. It forecasts from past orders but cannot fill the Sales Forecast form.
- **HRMS**:
  - check-in from the Frappe HR mobile web app, with geolocation (HR Settings);
  - auto attendance per Shift Type, with late entry and early exit;
  - leave types, allocations and applications.
- **Projects**: Project, Task, Timesheet.

## 8. What we build

1. **Site setup on every migrate** (idempotent):
   - Indonesian locale: language `id`, Asia/Jakarta, IDR, `dd-mm-yyyy`, `#.###,##`;
   - security defaults: sign-up off, error tracebacks off, OAuth dynamic client registration off, password policy
     score 2;
   - the `Company.erp_jenis` field;
   - item groups and UOMs;
   - the factory's warehouses: Gudang Bahan Baku, Gudang Produksi, Gudang Barang Jadi, Gudang Reject (ERPNext's
     empty default warehouses are disabled);
   - selling, buying and manufacturing defaults.
2. **Only the used modules show.**
   - Desktop icons kept: Stock, Selling, Buying, Manufacturing, Invoicing (factory) and Projects, Shift & Attendance,
     Leaves (office). Every other ERPNext/HRMS icon is hidden on every migrate, like bpt's `_sembunyikan_ikon`.
   - Sidebars are cut down to the screens in §9. There are Module Profiles "Pabrik" and "Kantor", and one Role
     Profile per bagian.
   - This is tidying, not a security fence. Staff are internal, and a hidden screen's URL still opens for a role
     that can read it.
3. **Indonesian labels** for the screens we keep, in `erp_internal/translations/id.csv`.
4. **Sales and purchasing flow.**
   - Sales: Sales Order, Delivery Note (surat jalan), Sales Invoice (faktur), Payment Entry.
   - Purchasing: Purchase Order, Purchase Receipt, Purchase Invoice.
   - A Delivery Note needs a Sales Order, and a Purchase Receipt needs a Purchase Order.
   - PPN 11% templates exist on both sides but stay off by default until Samuel confirms the factory is PKP (§12 q3).
5. **Import.** A tested guide (`docs/impor.md`) for items, customers, suppliers, opening stock and sales history,
   using ERPNext's Data Import from Excel.
6. **Sales history (`Riwayat Penjualan`).** Monthly quantity per company, item and month, imported from Samuel's
   records. There is exactly one row per (company, item, month). History is not imported as Sales Orders, because
   they would show up as open orders and stock demand.
7. **Forecast fill.** An "Isi dari Riwayat" button on a draft monthly Sales Forecast does this:
   - Per item, it takes the average of the last 3 full calendar months before the current month (or before the
     forecast's start month, if that is earlier). A month without sales counts as 0.
   - It reads Riwayat Penjualan plus submitted Sales Orders: stock quantity, by order date.
   - It rounds up to whole units and puts that number in every period of the forecast.
   - Items with no history get 0 and are named in the message, so someone types their number. The months used are
     named too.
   - People can edit every number before submitting.
8. **Production.** All of this is standard ERPNext:
   - Item Lead Time per product (capacity per day plus buffer days), BOMs, and Manufacturing Settings warehouses;
   - then Sales Forecast → Master Production Schedule → MRP report → Work Orders.
9. **"Siap Order" report.** Per finished product for a month it shows: stock, open orders, forecast, already ordered
   this month, in production, safety stock, short, days needed, latest start date and a status. The statuses are
   Telat, Mulai minggu ini, Terjadwal, Aman and Isi lama produksi; the formula is in §10. It is a summary for people.
   The MRP report stays the planner that creates the orders.
10. **Attendance** (office company):
    - shift "Kantor", 08:00–17:00, with auto attendance from check-ins made on a phone with location (the Frappe HR
      web app); late after 10 minutes;
    - a Holiday List with Saturdays and Sundays off. HR enters the national holidays from the government's yearly
      decree; they are never hard-coded.
    - leave types: Cuti Tahunan (12 days a year), Sakit, Izin.
11. **Projects**: Project, Task, Timesheet, and four activity types.
12. **Server**:
    - a pinned image and compose stack;
    - a nightly backup to an off-site S3-compatible bucket, kept for 14 days;
    - a restore drill before go-live;
    - a runbook.

## 9. Bagian (Role Profiles) and what each may do

| Bagian | Company | Creates | Must not create |
|---|---|---|---|
| Pemilik (System Manager) | both | everything kept | — |
| Gudang | Pabrik | Item, Stock Entry, Stock Reconciliation, Delivery Note, Purchase Receipt | Sales Order, Purchase Order, Work Order, Employee |
| Penjualan | Pabrik | Customer, Sales Order, Delivery Note, Sales Invoice, Payment Entry, Riwayat Penjualan | Purchase Order, Work Order, Stock Reconciliation |
| Pembelian | Pabrik | Supplier, Material Request, Purchase Order, Purchase Invoice | Sales Order, Work Order |
| Produksi | Pabrik | BOM, Item Lead Time, Sales Forecast, Master Production Schedule, Work Order, Stock Entry, Riwayat Penjualan | Sales Invoice, Purchase Order |
| HR | Kantor | Employee, Shift Type, Holiday List, Attendance, Leave Allocation | Sales Order, Stock Entry |
| Karyawan | Kantor | Employee Checkin, Leave Application, Timesheet (own) | Employee, Sales Order, Stock Entry |
| Manajer Proyek | Kantor | Project, Task, Timesheet | Sales Order, Employee |

Siap Order is readable by Produksi, Penjualan and Pemilik. Every user except Pemilik gets a User Permission on their
company.

## 10. Siap Order formula (Claude's call)

The inputs are product P, month M (its first day is `awal`), warehouse G and `hari_ini`.

- `stok`: actual quantity of P in G.
- `terbuka`: Σ (qty − delivered_qty) × conversion_factor over P's lines on submitted Sales Orders of the company
  whose status is not Closed or Completed.
- `terdekat`: the earliest delivery date among those lines.
- `perkiraan`: Σ demand_qty of P dated in M, from the newest submitted Sales Forecast of the company (by posting
  date) that has rows in M.
- `dipesan`: Σ stock_qty of P on the company's submitted Sales Orders dated in M.
- `produksi`: Σ (qty − produced_qty) of the company's submitted Work Orders for P with status Not Started or In
  Process.
- `safety`: `Item.safety_stock`.
- `butuh` = `terbuka` + max(0, `perkiraan` − `dipesan`) + `safety`.
- `kurang` = ceil(max(0, `butuh` − `stok` − `produksi`)).
- `lama`: ERPNext's `get_own_lead_time(<P's Item Lead Time>, kurang, True)`. If P has no Item Lead Time, the status
  is "Isi lama produksi" and no date is shown.
- `tanggal_butuh` = `terdekat` when `terbuka` > `stok` + `produksi`, otherwise max(`awal`, `hari_ini`).
- `mulai` = `tanggal_butuh` − ceil(`lama`) days.
- Status:
  - `kurang` = 0: Aman;
  - `mulai` before `hari_ini`: Telat;
  - `mulai` no later than `hari_ini` + 7: Mulai minggu ini;
  - otherwise: Terjadwal.

## 11. Phases and target dates

These dates assume Samuel's answers (§12) arrive in the first week.

- **Part A** (plan Tasks 1–8): foundation, the factory's stock, sales and purchasing, and the server. The factory
  goes live around mid-November.
- **Part B** (Tasks 9–14): sales history, forecast fill, production flow and Siap Order. It goes live around early
  December.
- **Part C** (Tasks 15–17): attendance and projects. They go live around mid-December.

## 12. Open questions (only Samuel can answer)

1. What are the legal names and abbreviations of both companies? (Task 8.) Until then, dev uses "PT Contoh
   Plastik" (CPL) and "PT Contoh Kantor" (CKT).
2. Where are past orders kept (Excel, a book, other software), and how many months back? The forecast needs at
   least 3 months. (Task 14.)
3. Should the system issue invoices, and is the factory PKP (charges PPN)? (Tasks 5 and 8.) Default: invoices on,
   PPN templates off.
4. How many products, which machines, and what capacity per day per product? (Task 14.)
5. Attendance by phone (location) or by fingerprint machine (which brand)? Office hours and headcount? (Task 15.)
   Default: phone, 08:00–17:00.
6. Which server provider and budget, which domain, and which off-site backup bucket? (Tasks 7 and 8.)
7. Who uses it: names and bagian per person. (Tasks 8, 14 and 17.)

## 13. Left to the builder

- The exact ERPNext roles inside each Role Profile. The permission tests pin what each bagian may and may not create.
- Workspace layouts beyond the sidebar lists; print formats (ERPNext's defaults, plus the letterhead logo when one
  is given); naming series (ERPNext's defaults).

## 14. Risks

- Sales Forecast and MPS are new in ERPNext (2025). The chain test (plan Task 12) catches a regression, and versions
  change only on purpose.
- ERPNext's Indonesian translation has gaps. Our `id.csv` covers the kept screens; screens we don't use may stay in
  English.
- Samuel's history may be messy. Riwayat Penjualan refuses duplicates and negative quantities, and the guide says
  how to fix and re-import.
- Two companies share one site. Role and Module Profiles plus a User Permission on Company keep each person in
  their own company.
