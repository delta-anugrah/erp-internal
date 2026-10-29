# Plan vs Actual and machine capacity

Asked by Mas Samuel on 2026-10-28, through Abel. Abel, the same evening: build what does not wait on Samuel, as
dynamic as possible, never tied to one situation. Abel, 2026-10-29: BOMs are made from the capacity table in this
round, so real products can be recorded as soon as Samuel's Excel is in. Every default below that Samuel has not confirmed is marked
**(our call)**; his answers change a table, not the design.

Two features, built in this order because the second feeds the first:

1. **Machine capacity**: per product per machine, cycle time, cavities, part weight, runner per shot and material,
   plus an Excel import, and a BOM made from each row.
2. **Plan vs Actual**: a form to record what each machine produced per shift, and a report of target against
   output, rejects and their reasons, and % achieved.

## Why

Samuel runs 14 injection moulding machines that often switch products (`docs/menunggu-samuel.md`, row 4). He wants
to see, per machine and per day, whether the plan was met and what went to reject. Rejects are internal only (bad
or broken pieces) and go to Gudang Reject; customers never return goods through this. Material price changes per
purchase batch, so cost follows stock valuation; the capacity table only needs grams and the material.

## Goals

- One place to record a machine's output per shift, which moves the stock by itself: good pieces to Gudang Barang
  Jadi, rejects to Gudang Reject, raw material consumed for both.
- One report that answers "did machine X hit its target, and why not" for any date range, grouped the way the
  reader wants.
- A capacity table per product per machine that Samuel's Excel can fill, which the report can use as the target.

## Non-goals

- No operator entry at the machine (tablet, scanner). The form is filled by the factory admin (role User) from the
  operators' notes **(our call; Samuel's roles are Admin and User only)**.
- No customer returns, no reject rework flow. Rejects sit in Gudang Reject as stock of the same item.
- No change to the Production Floor page (it may read this later).
- No money in the report: pieces only.

## Anti-goals (a failure even if it works)

- A report that only works for "yesterday per machine". Every grouping and date range must work.
- A Work Order marked Completed while rejects, not good pieces, made up the count.
- An import that silently drops or guesses a row. Every row is created, updated or refused with a reason.
- Anything Samuel's answers would force us to rewrite rather than re-configure.

## 1. Machine capacity

### What is stored

A new DocType **Machine Capacity** (module Planning), one row per product per machine. Fields:

| Field | Type | Notes |
|---|---|---|
| `item` | Link Item, required | a template (e.g. `GAYUNG-LUMBA`) or one variant. A template's row covers all its variants; a variant's own row wins over its template's. Colour never changes the mould, so Samuel's rows will usually be per template or per Jenis **(our call)**. |
| `jenis` | Data, optional | an Item Attribute Value of attribute `Jenis` (`Super`, `DX`, …), only with a template `item`: the row covers that template's variants of that Jenis. |
| `workstation` | Link Workstation, required | numbered machines only (`erp_nomor > 0`, same link filter as `Work Order.erp_mesin`) |
| `cycle_time` | Float, seconds, required, > 0 | one shot |
| `cavities` | Int, required, ≥ 1 | pieces per shot |
| `part_weight` | Float, grams per piece, required, > 0 | |
| `runner_weight` | Float, grams per shot, ≥ 0 | sprue and runner |
| `runner_reground` | Check, default from `RUNNER_DIGILING` | open question to Samuel: reground or thrown away. Reground: runner is not consumed material. Thrown away: it is. |
| `material` | Link Item (group Bahan Baku), required | PP, HDPE, … as items, not a fixed list |
| `masterbatch` | Link Item (group Bahan Baku), optional | |
| `masterbatch_percent` | Percent, optional | of the material weight |
| `disabled` | Check | a machine that no longer runs this mould |
| computed, read-only: `pcs_per_hour` | Float | `3600 / cycle_time × cavities` |
| computed, read-only: `material_per_pcs` | Float, grams | `part_weight + (0 if runner_reground else runner_weight / cavities)` |

Unique on (`item`, `jenis`, `workstation`). Name: `{item}-{workstation}` style autoname or hash; the builder picks, as long
as the import can find a row by the pair.

Who: read for every role that reads Work Order; write for Manufacturing Manager (Admin and Developer profiles)
**(our call: it changes targets)**. Shown in Manufacturing's sidebar after Production Floor, through the tables
in `tampilan.py` like every other screen.

### Lookup

One function, `kapasitas(item, workstation) -> row | None`: the enabled variant row, else the enabled template +
Jenis row (the variant's own Jenis attribute), else the enabled template row with no Jenis, else None. The report
and the BOM step use only this.

### BOM from a capacity row (Abel, 2026-10-29)

Real products have no BOM, and a Work Order needs one. So each enabled capacity row makes BOMs:

- One BOM per **variant** covered by the row (a variant row: itself; a template + Jenis row: every variant with that
  Jenis; a template row: every variant not covered by a more specific row), per machine. A BOM is per variant
  because ERPNext's Work Order takes a BOM of its production item.
- Lines: `material` at `material_per_pcs / 1000` kg; with a masterbatch, the material line is reduced and a
  masterbatch line added so the two add up to `material_per_pcs` and the masterbatch is `masterbatch_percent` of
  it **(our call: the percent is of the total resin mix)**. Quantity 1 piece in the variant's stock UOM.
- The BOM records its machine (`BOM.erp_mesin`, custom field) and its source row. It is made by a button on the
  capacity row ("Make BOMs") and by the import's Apply. When the row changes, a new BOM is made and set default for
  that machine, and the old one is deactivated if no open Work Order uses it; a submitted BOM is never edited.
- One BOM per variant is ERPNext's default (`is_default`): the one for the machine with the most recent change
  **(our call)**. A Work Order with `erp_mesin` set picks the BOM made for that machine when there is one
  (Work Order `validate` or the form, builder's choice), else ERPNext's default.
- BOMs made by hand (the sample products' BOMs) are never touched.

### Excel import

Samuel's file arrives tomorrow and its layout is unknown, so the import reads headers by meaning, not by position:

- A page or a button on the Machine Capacity list: upload `.xlsx` (and `.csv`), see a preview table of every row
  with its result (new, changed, unchanged, refused + reason), then **Apply**. Nothing is written before Apply.
- **Headers by alias**, case and spacing ignored, in one table `KOLOM_IMPOR` (e.g. cycle time: `cycle time`,
  `ct`, `siklus`, `cycle (detik)`; cavities: `cavity`, `cav`, `jumlah cavity`; part weight: `berat`, `gram`,
  `berat produk`, `weight`; runner: `runner`, `sprue`, `berat runner`; material: `bahan`, `material`, `pp/hdpe`;
  machine: `mesin`, `machine`, `no mesin`). A new alias is a table edit.
- **Product** by item code, or by product name and Jenis the way `master.py` names them (e.g. "Gayung Lumba-Lumba"
  + "Super"), using `master.py`'s spellings table (`SAMA`). **Machine** by number (`3`, `03`, `Mesin 03`) or name.
  **Material** by item code or name; an unknown material is refused, never created **(our call: a typo must not
  create stock items)**.
- Numbers with Indonesian or English separators (`2,5`, `2.5`, `1.250`) as `docs/impor.md` already rules: an
  ambiguous one is refused.
- Running the same file twice writes nothing the second time.
- A sample file the tests import for real lives in `erp_internal/tests/data/` (our own made-up layout with Indonesian
  headers and a few bad rows), and `docs/impor.md` gets a section for it.

## 2. Plan vs Actual

### Recording output: Production Entry

A new submittable DocType **Production Entry** (module Planning), one per machine per shift per Work Order:

| Field | Notes |
|---|---|
| `company` | default company |
| `posting_date` | required |
| `shift` | Select from `SHIFT_PABRIK`, required |
| `workstation` | numbered machine; defaults from the Work Order's `erp_mesin` |
| `work_order` | submitted, not Completed/Closed/Stopped, same company |
| `item` | from the Work Order, read-only |
| `good_qty` | ≥ 0 |
| `rejects` | child table **Production Entry Reject**: `reason` (Link **Reject Reason**), `qty` > 0 |
| `reject_qty` | sum of `rejects`, read-only |
| `hours` | run hours in this shift, default the shift's length; used by the capacity target |
| `notes` | |
| `stock_entry` | read-only links to what submit made |

**Reject Reason** is a tiny DocType (name only, plus `disabled`) that Admin can extend. Setup seeds `ALASAN_REJECT`
**(our call, until Samuel lists his)**: Short Shot, Flashing, Belang / Warna, Pecah / Retak, Bubble, Sink Mark,
Lainnya.

**On submit** the stock moves by itself, through ERPNext's own Work Order entries so Work Order progress stays right:

- raw material for good + reject pieces is consumed (backflush by BOM, as `PENGATURAN_PRODUKSI` already sets);
- good pieces land in the Work Order's FG warehouse (Gudang Barang Jadi) and count as the Work Order's produced
  qty;
- reject pieces land in the company's `default_scrap_warehouse` (Gudang Reject) as the same item, and do **not**
  count toward produced qty.

The builder must verify against ERPNext v16's Stock Entry and Work Order code which mechanism gives exactly that
(e.g. a Manufacture entry for good + reject with the reject as process loss and a matching reject row, or a
Manufacture entry for the good pieces plus a second entry for the rejects) and pin it with a test that checks
Bin quantities and `Work Order.produced_qty`. Whether a Material Transfer for Manufacture happens first follows the
Work Order's `skip_transfer`; the entry must work for both.

**On cancel** the stock entries it made are cancelled. A Production Entry is never edited after submit.

Validation: the Work Order's machine, if set, must equal the entry's machine (a warning, not a refusal, is enough
if the builder finds machines get swapped mid-order **(our call: refuse; set the Work Order's machine first)**);
good + reject > 0; the date is not in the future.

### The report: Plan vs Actual

A Script Report (module Planning), company-scoped like Order Readiness (Company permission checked, every query
filtered by company, submitted entries only).

**Filters**

- Company (required), From / To date (default: the last 7 days ending yesterday **(our call)**).
- Machine, Item (template or variant: a template matches its variants), Work Order, Shift: all optional.
- **Group by**: Machine, Machine + Day (default), Day, Item, Work Order, Shift. The rows and totals regroup; no
  separate report per grouping.
- **Target from**: `Work Order` (default, Samuel's words "for now") or `Capacity`.

**Target**

Target is computed per machine × day × Work Order, then summed into whatever grouping is chosen:

- `Work Order`: the order's qty spread evenly over its planned days, `planned_start_date` to `planned_end_date`,
  else `expected_delivery_date` (inclusive, every calendar day **(our call)**). With neither, the whole qty lands on
  the start day. Days inside the filter range only. The target goes to the order's `erp_mesin`; an order with no
  machine shows its target under a "No machine" row (its output still shows under the machine that recorded it)
  **(our call)**.
- **Group by Shift** in Work Order mode: a day's target is split over that day's shifts by the hours recorded in
  each; a day with a target and no entries splits it evenly over `SHIFT_PABRIK` **(our call)**.
- `Capacity`: `pcs_per_hour` from Machine Capacity (`kapasitas()`) × the hours recorded in that day's Production
  Entries for that machine and order. A pair with no capacity row has no target and shows "No capacity" instead
  of 0 %.
- A target with no output (planned, nothing recorded) still shows a row: 0 produced, 0 %.

**Columns**: the group keys, Target, Good, Reject, Reject %, Achieved % (`good / target`), then one column per
Reject Reason that occurs in the result (dynamic columns). Achieved % colours: green ≥ `CAPAI_HIJAU` (100),
orange ≥ `CAPAI_KUNING` (85), red below **(our call)**.

**Chart**: Target vs Good per group, Reject stacked.

**Who**: the roles that read Work Order (Manufacturing User and Manager, System Manager). It sits in Manufacturing's
sidebar next to Order Readiness.

## Constraints (from this repo's rules)

- English UI text in `_()`/`__()` with an Indonesian row in `translations/id.csv`; Indonesian Python identifiers,
  English comments.
- Behaviour in module-level tables (`SHIFT_PABRIK`, `ALASAN_REJECT`, `RUNNER_DIGILING`, `KOLOM_IMPOR`,
  `CAPAI_HIJAU`, `CAPAI_KUNING`), so Samuel's answers are table edits.
- Setup idempotent on `after_install`/`after_migrate`; nothing set by hand.
- ERPNext never patched; DocType JSON with a bumped `modified`.
- Tests in `erp_internal/tests/` with `tests/utils.py` fixtures and explicit dates; the full run stays green.
- Docs in the same commit: CLAUDE.md, `docs/panduan/produksi.md`, `docs/impor.md`, `docs/menunggu-samuel.md`,
  `docs/TODO.md`, `docs/PROGRESS.md`.

## Defaults until Samuel answers

| Table | Default | Question |
|---|---|---|
| `SHIFT_PABRIK` | 3 shifts × 8 h: Shift 1, 2, 3 | how many shifts and hours per shift |
| `ALASAN_REJECT` | the list above | which reject types they see |
| `RUNNER_DIGILING` | 0 (thrown away, counts as material) | is the runner reground |
| Import aliases | the list above | the real Excel headers |

## Left to the builder

- The stock mechanism for rejects (above), proven by a test.
- Naming of the two new DocTypes' records, the preview UI of the import (page or dialog), the chart type.
- Whether Production Entry gets a "New Production Entry" shortcut on the Work Order form (nice to have).
