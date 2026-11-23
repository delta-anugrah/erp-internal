# Samuel's requests of 2026-11-23: three roles, machine lock, Pluit, daily input, expenses (design)

Date: 2026-11-23. Asked by Abel, from Mas Samuel's WhatsApp of the same day. Repo: erp-internal (branch
`feat/lokal`). Decisions: `docs/menunggu-samuel.md`, table "Answers and new requests (Mas Samuel, WhatsApp
2026-11-23)", items 1-5 and 7. Item 6 (Seal Cap) waits for his lists and is not designed here, but nothing here may
block it. Abel added two requests in the session: every real document gets its photo attached, and pigment stock.

Samuel's two templates are kept beside this file:

- `2026-11-23-samuel/input-harian.jpeg`: his daily production Excel. One sheet per week ("Tanggal: 23.11.2026 -
  28.11.2026", "Teknisi Pagi: Yudi", "Teknisi Malam: Fadli"), then one block per customer PO: "No.Po.
  039-NKP/EPP/DA/2026-11", "PO : 400.000 pcs", "Packing plastik isi : 560 pcs", "Isi Perkarung : 19.600 pcs", a
  table No | Tanggal | Merk | Warna | Shift 1 (08.00-20.00) | Shift 2 (20.00-08.00) | Keterangan with one row per
  production day, a green TOTAL row (sum per shift, grand total under Keterangan), the machine (M1H) in a pink
  cell on the right, and a yellow "CLOSE/DONE" above it when the PO is complete.
- `2026-11-23-samuel/po.png`: the lines of one of his POs: blue header NO. | ORDER | QTY | SATUAN | TGL KIRIM |
  HARGA, the row "1. Seal Cap NKP (Neutral) - M1G | 400.000 | PCS | 27 November 2026 | @24/pcs", grey and white
  rows, a red box "TOTAL Rp. 9.600.000,00". Only this part of the PO was shared; its header (logo, number,
  customer, date) is not known yet.

## Why

The app works, but Samuel wants it simpler and closer to how the factory already works, before an admin is hired
this week and demo videos are made:

- Production people only type the day's output, in the same layout as his Excel, nothing else. Admin plans
  (Work Orders), sells, buys, ships and records expenses, and may only look at production figures.
- A Work Order must not land on a machine that cannot make the item.
- Finished goods sit in two places: the factory and a second warehouse in Pluit.
- He wants a monthly cost picture: operator wages follow how long the machines run (105.000 per 12 h shift),
  plus electricity, fixed salaries and fuel.
- Nobody should have to relearn a layout: screens and prints follow his own Excel and PO.
- Abel: every document that has a paper original carries its photo or scan; pigment (the colourant) is stocked
  and used up by production (Samuel: "1 gram pigment : 1 kg bahan", a pigment has a colour, a ratio and a price
  per kg).

## Goals

1. **Three roles: Super Admin, Admin, Produksi.** Super Admin is us (today's Developer, no limits). Admin runs
   the business: Work Orders, BOMs, Sales Orders, Purchase Orders, delivery notes, raw material in, expenses; sees
   the daily production but cannot change it. Produksi only enters the daily production and sees nothing outside
   production.
2. **Machine lock.** A Work Order refuses a machine that has no Machine Capacity row for its item, and the form
   offers only the item's machines.
3. **Warehouse Pluit.** A second finished-goods warehouse. Every delivery note names where it ships from, factory
   or Pluit, chosen by Admin each time.
4. **Daily input like his Excel.** One block per Work Order, one row per production day, Shift 1 and Shift 2
   columns, Keterangan, TOTAL, the machine, CLOSE/DONE, the technicians of each shift. Produksi types into it;
   Admin sees it read only. The Production Floor stays where Admin finds an empty machine.
5. **Monthly expenses.** Operator wages counted from how the machines ran (both shifts = 24 h = 2 operator
   shifts, one shift = 12 h = 1, none = off = 0) at 105.000 per shift; electricity, fixed salaries (the same every
   month), fuel and other costs entered by Admin as plain expenses (fuel is not linked to deliveries).
6. **His templates.** The daily recap on screen, printed and as an Excel file in his Excel's layout; the Sales
   Order and Purchase Order print in his PO's layout.
7. **Real documents attached.** A document with a paper original cannot be submitted without its photo or scan;
   a delivery note gets the signed copy after delivery, and a list shows what is still missing.
8. **Pigment.** One pigment per colour, bought and stocked per kg, with a ratio (grams per kg of plastic); the
   machine-capacity BOMs add it, so production uses it up by itself.
9. Docs, guides, sample data and checks follow (CLAUDE.md, README, `docs/`, `docs/panduan/`, `contoh.py`,
   `cek_layar`).

## Non-goals

- Item 6, the Seal Cap line (price by machine, brand codes, machines M1x): later, on top of this.
- The DigitalOcean server, backups and the domain (own session), the demo videos and the admin's onboarding.
- Accounting entries for expenses: no journal, no expense accounts. The company only records (Samuel
  2026-10-28: no invoices for now), and the monthly report is the view he asked for.
- Payroll per operator, operator names per machine, attendance of factory staff.
- Changing how rejects are recorded or valued; the Production Floor page itself; Plan vs Actual and Order
  Readiness beyond what Pluit and the roles require.
- A print layout for documents Samuel sent no template for (delivery note, invoice): they keep ERPNext's.

## Anti-goals (a failure even if it works)

- Produksi meeting a layout that reads differently from his Excel, or any screen beyond production.
- Admin able to change a production figure through any path (form, list, API, the new page).
- Production numbers kept in a second place that can drift from the stock: the daily input is a view and editor
  of Production Entries, never its own copy.
- A rule that stops the factory from recording production (the attachment rule never touches production).
- Pigment or attachment rules that break the sample data, the tests or the existing flows.

## Constraints

- Frappe v16.53, ERPNext v16.52, HRMS v16.52 (`versi.json`). ERPNext and HRMS are never patched; every change is
  ours and re-applied idempotently on `after_install`/`after_migrate`. Setup must not fail before the wizard.
- One company (`setup.perusahaan()`). English UI with every string of ours in `erp_internal/translations/id.csv`.
  Python identifiers Indonesian, comments English; URLs, API paths and page routes English (`lantai.md`).
- Behaviour hangs off module-level tables; a module, DocType or rule is added by a table row, not a special case.
- Tests in `erp_internal/tests/`, `frappe.tests` classes, get-or-create fixtures in `tests/utils.py`, dates
  passed in (never the real date).
- Every UI change is checked at 390 px and 768 px (memory "Cek responsive"); `cek_layar` for each profile.

## Approaches (how, with the pick)

**Daily input screen.** (a) A Desk page that draws his Excel's blocks and writes one Production Entry per filled
cell. (b) A new DocType per Work Order whose child table is the grid, synced to Production Entries on save. (c)
Keep the Production Entry form and add a report in his layout. **Pick (a).** (c) is not "input like this"; (b)
keeps the figures twice (the sheet and the entries), and a cancelled entry would leave the sheet wrong. With (a)
the Production Entry stays the only record: stock, Plan vs Actual and the expense report read it as today.

**Operator shifts for the expense report.** (a) Derive them from the daily input: a machine ran a shift on a day
when that shift has a recorded quantity on that machine. (b) Admin sets each machine's state (24 h, 12 h, off)
with the date it starts, and the report counts days by state. **Pick (a).** Samuel asked for it to be automatic
("yg shift itu di buat otomatis aja, misal mesin nyala 12 jam di potong 1 shift operator otomatis"); his Excel's
Shift 1 and Shift 2 columns are exactly the 12 h blocks; (b) adds a setting someone must keep current and that can
disagree with the production record. A machine that runs without anyone entering its output costs no operator in
the report, which makes a missing entry visible rather than hidden. This is the main call for Abel to check.

**Attachment rule.** (a) Refuse submit without at least one file attached (the form's sidebar Attach). (b) An
Attach field added to each DocType. (c) Never refuse, only list what is missing. **Pick (a), with (c) for the
delivery note**, whose original (the copy the customer signs) only exists after the goods left; refusing its
submit would keep sold goods in stock for days. (b) adds a field to nine DocTypes and holds one file only.

**Pigment.** (a) One template item "PIGMEN" with the products' own `Warna` attribute; each colour's pigment is a
variant with its ratio. (b) Plain items with a colour field. (c) The Machine Capacity row's masterbatch field.
**Pick (a):** ERPNext then guarantees one pigment per colour and only known colours, and a product variant finds
its pigment by the same `Warna` value. (c) is one item per row, but a row covers several colours.

**Pluit on a delivery note.** (a) Keep Gudang Barang Jadi as the default and let Admin change it. (b) No
default: the source warehouse must be picked on every delivery note. **Pick (b):** Samuel's words are "pilih gudang
pabrik atau pluit setiap mau kirim"; with a default a forgotten switch takes stock from the wrong place silently
whenever both hold the item.

## Design

### 1. Three roles

Role Profiles and their Module Profiles (`tampilan.PROFIL_PERAN`, `MODUL_BOLEH`, `IKON`):

| Profile | Was | Roles | Menu headers |
|---|---|---|---|
| Super Admin | Developer | System Manager + Admin's roles (unchanged) | everything kept; Module Profile blocks only `MODUL_MATI` |
| Admin | Admin | unchanged (`_PERAN_ADMIN`: the managers, the *User roles, `ERP Admin`) | Stock, Selling, Buying, Manufacturing, Projects, HR, Settings |
| Produksi | User | `ERP User` only (no Stock User any more) | Manufacturing |

- **Rename, not new records.** A patch renames Role Profile and Module Profile "Developer" → "Super Admin" and
  "User" → "Produksi" (only when the old exists and the new does not); Frappe's rename moves every user with it.
  The constants follow (`SUPER_ADMIN`, `ADMIN`, `PRODUKSI`). The sample login `user@example.com` stays and becomes
  the Produksi sample user (my call: renaming sample logins touches every tool for no gain).
- **Admin cannot change production.** Production Entry's own permissions keep create, write, submit, cancel and
  amend for System Manager and `ERP User` only; Manufacturing Manager and Manufacturing User (both held by Admin)
  keep read, report, print and export. The daily input page shows Admin no input.
- **Produksi's rights** (`ERP User`): Production Entry (create, submit, cancel, amend; its JSON), read Work Order,
  Company (every profile reads Company), Workstation, Machine Capacity, Reject Reason (not Item: the item master
  carries prices, and the page reads what it shows on the server); the Production Floor
  (view and `set_status`, unchanged: Samuel allowed it 2026-11-02 and the floor is production), the Daily Input
  page, Plan vs Actual. Taken away: Sales History read and Order Readiness (selling and stock planning), and the
  reads granted only for the delivery note and Material Receipt forms (Price List, Account, Stock Settings,
  Customer Group in `setup.IZIN_TAMBAHAN`). A new table of grants to withdraw removes exactly those Custom DocPerm
  rights of `ERP User`, nothing set by anyone else.
- **Stock moves of a Production Entry are made by the system.** Produksi holds no stock role, so Production
  Entry's Manufacture and Repack entries are inserted, submitted and cancelled with permissions ignored; they stay
  bounded by the Work Order and its BOM. `batas_user.py` (which kept the old User to three jobs inside Stock User)
  and its hooks go: permissions now say it. Its tests become Produksi tests (cannot make a Stock Entry, Delivery
  Note or Sales Order, cannot read Sales History or a Price List, can submit a Production Entry that moves stock).
- **Output only through a Production Entry.** Admin keeps Stock Manager, so a permission cannot stop the Work
  Order's own Finish button (a Manufacture Stock Entry made straight from the order, Admin's step in the guide
  today), whose output would never reach the daily input, Plan vs Actual or the operator shifts. A Stock Entry
  check refuses a Manufacture entry that no Production Entry made, except for System Manager (Super Admin), and
  refuses cancelling a Production Entry's own entries except through that Production Entry. The Work Order form
  hides Finish from everyone else. New Work Orders skip the material transfer by default (`skip_transfer` 1, a
  Property Setter), so Produksi's entries never wait for Admin's Start; material is taken from Gudang Bahan Baku as
  output is entered. Admin may still untick it and use Start for an order that transfers.
- `pengguna.py` is unchanged: an Admin hands out the Admin and Produksi profiles, never Super Admin.
- Menus: `IKON["Stock"]` becomes Admin only; Produksi's Manufacturing shows only what it may read (Production
  Floor, Daily Input, Work Order, Machine Capacity, Plan vs Actual).

### 2. Work Order machine lock

- Work Order `validate`, and `before_update_after_submit` when the machine changed: a machine (`erp_mesin`) with
  no enabled Machine Capacity row for the item (`kapasitas.kapasitas(item, machine)` is None) is refused:
  "Gayung Lumba Super Merah is not made on Mesin 05. Machines for it: Mesin 02, Mesin 03." Next to `mesin_aktif`
  and `kunci_mesin` in `kapasitas.py`, same rule for a submitted order: one already on its machine keeps running.
- **An item with no capacity row at all** (today Gantungan Dinda Super, Toples Dinda, Garpu Makan, the spoons, …:
  not in Samuel's list) may go on any numbered machine: there is no list to check against, and refusing would stop
  their production until Samuel sends figures (anti-goal). The Machine field then offers every numbered machine and
  the form says "No Machine Capacity row for this item yet: every machine is allowed." (my call).
- The form's Machine field lists only the item's machines (a query returning the machines whose capacity row
  covers the item; numbered machines only, as today).
- An order without a machine stays allowed, as today. The daily input shows its block with the cells closed and
  "No machine yet: Admin sets it on the Work Order" (Produksi cannot write a Work Order).

### 3. Warehouse Pluit

- "Gudang Pluit" joins the warehouses setup makes for each company (today `setup.GUDANG_PABRIK`), so it is never
  disabled as unused.
- Delivery Note: "Set Source Warehouse" is required and has no default (a Property Setter), and on validate
  every line takes that warehouse. Moving goods from the factory to Pluit is a Stock Entry "Material Transfer"
  (Gudang Barang Jadi → Gudang Pluit), made by Admin.
- Order Readiness: with no warehouse picked, its stock is the sum of both finished-goods warehouses (a table,
  e.g. `GUDANG_JUAL`); a picked warehouse still means only that one.

### 4. Daily input (Desk page "Daily Input", route `daily-input`)

What the page shows, top to bottom (Samuel's sheet, `input-harian.jpeg`):

```
Daily Input                                   [This week ▾]  [Print]  [Excel]
Tanggal        : 23.11.2026 - 29.11.2026
Teknisi Pagi   : [Yudi      ]   (Shift 1)
Teknisi Malam  : [Fadli     ]   (Shift 2)

No.Po. 039-NKP/EPP/DA/2026-11                                         CLOSE/DONE
PO : 400.000 pcs     Packing: Pack isi 560 pcs · Karung isi 19.600 pcs
No  Tanggal    Merk  Warna    Shift 1        Shift 2        Keterangan
                              (08.00-20.00)  (20.00-08.00)
1   11-11-2026 NKP   Neutral  [ 13.384]      [      ]       [         ]     M1H
2   12-11-2026 NKP   Neutral  [       ]      [ 39.936]      [         ]
…
    TOTAL                     176.149        223.851        400.000
[+ Add date]
```

- **Blocks.** One per submitted Work Order that is Not Started or In Process, plus those Completed, Stopped or
  Closed whose last entry falls in the chosen week (read only, CLOSE/DONE when Completed). Ordered by machine
  number, then Work Order. A machine filter at the top shows one block. Each block shows the order's whole
  history, as his sheet does.
- **Block header.** No.Po.: the customer's PO number (`po_no` of the Work Order's Sales Order), else the Work Order
  name. "PO": the order qty in its stock UOM. Packing: each packing UOM of the item with its pcs (Pack, Karung,
  Dus, Gross, …). Machine: the order's machine, large, at the right like his pink cell. CLOSE/DONE (yellow) when
  the order is Completed.
- **Rows.** Every date that has an entry, oldest first, then one empty row for today while today has none.
  "+ Add date" adds a past date (not before the order's creation, not after today). Merk is the item's brand
  (Seal Cap's brand code later, item 6), Warna the variant's `Warna`. On a phone Merk and Warna fold away (they
  are in the block header too).
- **Cells.** Shift 1 and Shift 2 hold good pieces. Leaving a changed cell saves it at once: no entry and a number
  → a new submitted Production Entry (work order, its machine, date, shift, good qty, the shift's technician, the
  row's Keterangan); a different number → the cell's entries are cancelled and a new one is made; emptied (or 0)
  → its entries are cancelled. A refusal (future date, order not open, more than the order allows, machine not set)
  shows on the cell, not in a dialog, and the cell keeps the number typed.
- **Cells the grid does not own.** A cell whose entries were not made the grid's way (more than one entry, any
  reject, or run hours other than the shift's) shows their good pieces read only, with "Change it in the
  Production Entry form" and a link: replacing it would drop rejects and their stock moves (my call).
- **Keterangan.** Stored as `notes` of that date's entries of that order (allowed to change after submit). A
  note on a row with no number is refused: there is no entry to hold it.
- **Technicians.** A new field `technician` on Production Entry. The page header's Teknisi Pagi (Shift 1) and
  Teknisi Malam (Shift 2) start with the last names used and are written on each entry the page makes. The week's
  header shows the names found in that week's entries, per shift.
- **Rejects** are not in the grid: his Excel has none, and every reject is reground (Samuel 2026-11-02). The
  Production Entry form keeps its reject table for whoever records them (my call).
- **Who.** Produksi (and Super Admin) type; Admin sees the same page without inputs; the server checks the
  Production Entry rights on every write and the Work Order rights on every read.
- **Shift names and hours** come from `setup.SHIFT_PABRIK`; a table beside it gives each shift's clock times
  (Shift 1 08.00-20.00, Shift 2 20.00-08.00). Shift 2 belongs to the date its evening started.
- **Overproduction.** Manufacturing Settings allow 10 % over a Work Order's qty (today 0), so a last shift's real
  count can be entered (my call). More is refused on the cell with ERPNext's message.
- **Where.** In the menu as an entry of its own under the Production Floor (`MENU_ATAS`), and in Manufacturing's
  sidebar and home in place of the Production Entry list (the list stays reachable by URL, its count of 12
  shortcuts stays). "Record Output" on a Work Order opens the page at that order.
- **Print and Excel** (goal 6): the chosen week's blocks, in the same layout. Print opens the page's blocks as a
  printable page (A4 landscape) and the browser's print; Excel downloads an `.xlsx` with his sheet's header rows,
  colours (blue column header, green TOTAL, pink machine cell, yellow CLOSE/DONE) and number format, one sheet,
  blocks one under another.

### 5. Monthly expenses

- **DocType Expense Entry** (module Planning, submittable, `EXP-.YYYY.-.#####`): Date, Category (Link Expense
  Category), Amount (IDR), Repeat (Once, Every month, Per machine shift; default Once), Until (date, may be set
  after submit, empty = still running; only for the two repeating kinds), Notes, Company (fills itself and stays
  hidden, like Production Entry). Admin (`ERP Admin`) and System Manager create, submit, cancel; nobody else reads.
  Two Per machine shift entries of one category may not overlap in time ("End the earlier one first").
- **DocType Expense Category**: a plain list like Reject Reason. Setup adds the missing ones of a table, never
  deletes: Gaji Operator, Gaji Karyawan Tetap, Listrik, Bensin, Lainnya. Admin may add more.
- **Report Monthly Expenses** (Script Report, Admin and System Manager; filters Company, Month): one row per
  category with the month's amount, and a total.
  - Once: entries dated in the month.
  - Every month: its amount in every month from its date's month to its Until month.
  - Per machine shift: its amount × the machine shifts in the month between its date and Until. A machine shift is
    one distinct (machine, date, shift) of the submitted Production Entries; two orders on one machine in one shift
    count once. Under the category, one indented row per machine: shifts, days at 24 h (both shifts), days at
    12 h (one shift).
- The operator wage is one entry Admin makes at go-live: Gaji Operator, 105.000, Per machine shift, from the first
  production day (onboarding checklist and guide; the sample data has it). A raise ends it (Until) and starts a new
  one, so past months keep their rate.

### 6. Samuel's templates

- Daily recap: section 4 (page, print, Excel).
- **Sales Order and Purchase Order print** ("PO Samuel", default print format of both): his PO's table and total
  box exactly (`po.png`): NO., ORDER (item name), QTY (whole number with dots), SATUAN (UOM in capitals), TGL KIRIM
  (the line's delivery or required-by date, "27 November 2026", Indonesian month names), HARGA ("@24/pcs": the rate
  per UOM), red TOTAL box ("Rp. 9.600.000,00"). Above it a header in the same style: the company logo and name,
  the title, the document's number (a Sales Order also shows the customer's PO number), the party and the date.
  The header is our design until Samuel's full PO arrives. Item 6 will add the machine after the item name in red
  ("- M1G").

### 7. Real documents attached

- Table `WAJIB_LAMPIRAN` (DocType → when): Sales Order, Sales Invoice, Purchase Order, Purchase Receipt, Purchase
  Invoice, Payment Entry; Stock Entry only for Material Receipt; Expense Entry only for Once. `before_submit`
  refuses a document of the table with no File attached to it: "Attach a photo or scan of the real document
  before you submit." Production's own entries (Manufacture, Repack), Work Orders, BOMs, Production Entries, Stock
  Reconciliations and repeating expenses need none.
- Delivery Note: submitted as today; its signed copy is attached afterwards (attachments stay open on a submitted
  document).
- **Report Missing Documents** (Admin, System Manager): the submitted documents of the table and every submitted
  Delivery Note that have no attachment, newest first, linked. Super Admin and Admin follow up from it.
- The forms of the table and Delivery Note show a short orange note while nothing is attached (submitted delivery
  note: "Attach the signed delivery note.").
- An amended document keeps its attachments (Frappe copies them); a mapped one (Sales Order → Delivery Note)
  starts without, as it should.

### 8. Pigment

- Item Group "Pigmen" (default warehouse Gudang Bahan Baku, `setup.GUDANG_GRUP`), and a template item "PIGMEN"
  (stock UOM Kg, variants on `Warna`) made with Samuel's data, beside the raw materials (`penjualan.muat`). Each
  colour's pigment is a variant (PIGMEN-MRH, …) with "Pigment Ratio (g per kg)" (a custom Item field shown only on
  pigments, default 1, more than 0) and its price per kg in the buying list `Harga Bahan Baku`. Samuel's list of
  pigments is still to come; until then Admin creates them (guide), the sample data has two.
- The machine-capacity BOM of a variant adds the pigment of the variant's `Warna`, when one is enabled: kg per
  piece = material per piece (kg, part and runner as today) × ratio ÷ 1000 (1 g per kg). The material line is
  unchanged (the pigment comes on top; masterbatch keeps its own rule). A colour without a pigment (Bening,
  Campur, …) gets no line.
- A pigment added, disabled or given another ratio rebuilds the capacity BOMs in a background job
  (`buat_bom_kapasitas` for every enabled row: identical BOMs stay, others are replaced as today). Open Work Orders
  keep the BOM they started with.
- Pigment is bought per kg like the raw materials (Purchase Order → Purchase Receipt, or a Material Receipt) and
  used up by each Production Entry's Manufacture (and reject) entry through the BOM.

### Data and migration

- Patches: rename the profiles (section 1); nothing else moves data. Setup adds Gudang Pluit, the Expense
  Categories, the Item Group, the Property Setters (delivery note warehouse, shift options), the custom Item field,
  the Production Entry fields and the overproduction setting on the next migrate.
- `contoh.py` (dev only): the Produksi sample user, a week of daily input written through the page's own save,
  technicians, a transfer to Pluit and a delivery from it, two pigments with BOMs that use them, expense entries of
  each kind including the operator wage, and an attachment on every sample document that needs one.

### Tests and checks

- New and changed tests per section: profiles and their rights (each profile's reads and refusals, Admin cannot
  write a Production Entry by any path, Produksi's Production Entry moves stock), the machine lock (new, draft,
  moved order, item without rows), Pluit (required warehouse, lines follow it, Order Readiness sums both), the page's
  server side (read model of a block, each cell rule, refusals, technicians, notes, rights), Excel and print output
  (cells and colours at known places), expenses (each repeat kind, overlap refused, machine-shift counting with two
  orders in one shift, days 24 h/12 h), attachments (each DocType of the table refused and passed, delivery note
  passes, the report), pigment (BOM line per colour, none for a colour without pigment, rebuild after a ratio
  change, stock used by a Production Entry).
- `/run-checks`; `cek_layar` for Super Admin, Admin and Produksi (menus, homes, the new page at 390 px and
  768 px); `lantai.mjs` only if the Production Floor changes (it should not).

### Docs

CLAUDE.md, README, `docs/panduan/` (produksi: daily input; user.md becomes the Produksi guide; admin: roles,
expenses, missing documents, onboarding steps; gudang: Pluit; pembelian: pigment; penjualan: warehouse pick, the
signed copy), the access PDF (`Hak-Akses-ERP-Delta-Anugrah-revisi.pdf`) regenerated, `docs/menunggu-samuel.md`,
`docs/TODO.md`, `docs/PROGRESS.md`.

## Calls made (for Abel to check)

1. Operator shifts come from the daily input (a shift with a number = the machine ran it), not from a machine
   state someone sets.
2. The grid takes good pieces only, like his Excel; rejects stay in the Production Entry form, and a cell made
   there is read only in the grid.
3. The machine lock leaves an item with no Machine Capacity row free to use any machine (today several real
   products have none).
4. Output is recorded only through Production Entries: the Work Order's Finish button is Super Admin's only, and
   new Work Orders skip the material transfer.
5. Attachments: refused at submit for the eight kinds in section 7; the delivery note's signed copy comes after,
   listed in Missing Documents until it is attached.
6. Profiles renamed (Developer → Super Admin, User → Produksi); the sample login `user@example.com` stays.
7. Produksi keeps the Production Floor (view and machine status) and Plan vs Actual.
8. A delivery note's source warehouse must be picked every time (no default).
9. Work Orders accept up to 10 % over their qty.
10. Expenses are recorded only, no accounting entries.
11. The PO print layout serves both Sales Order and Purchase Order; its header is ours until his full PO arrives.

## Needed from Samuel (none blocks the build)

- His full PO (the header part) for the print; the Excel file itself is a nice-to-have (the picture suffices).
- His pigment list: colour, ratio, price per kg.
- Item 6's lists, as already noted.

## Left to the builder

The page's exact markup, styles and keyboard flow (Tab and Enter move like Excel), icons (from the lucide sprite,
`test_ikon_ada`), Indonesian strings, the print CSS, the Excel styling details, the names of new functions and
tables, and how the work is split into tasks.
