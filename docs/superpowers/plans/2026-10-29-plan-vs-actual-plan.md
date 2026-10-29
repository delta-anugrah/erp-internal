# Plan vs Actual and Machine Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A capacity table per product per machine (with an Excel import and BOMs made from it), a Production Entry
form that records each machine's output per shift and moves the stock, and a Plan vs Actual report.

**Architecture:** Three DocTypes in module Planning (Machine Capacity, Reject Reason, Production Entry + child
Production Entry Reject), logic in `erp_internal/planning/kapasitas.py` (lookup + BOMs) and
`erp_internal/planning/impor_kapasitas.py` (Excel), one Script Report `Plan vs Actual`. Stock moves only through
ERPNext's own Stock Entry (Manufacture for good pieces, Repack for rejects). Every behaviour that waits on Samuel is
a module-level table.

**Tech Stack:** Frappe/ERPNext v16 (pinned in `versi.json`), Python 3.14, openpyxl (ships with Frappe), frappe-charts.

**Spec:** `docs/superpowers/specs/2026-10-28-plan-vs-actual-design.md`

## Global Constraints

- UI text English in `_()`/`__()`, each with an Indonesian row in `erp_internal/translations/id.csv` (`test_bahasa`
  fails otherwise). Python identifiers Indonesian, comments and docstrings English.
- Behaviour in UPPER_CASE module tables: `setup.SHIFT_PABRIK = (("Shift 1", 8), ("Shift 2", 8), ("Shift 3", 8))`,
  `setup.ALASAN_REJECT = ("Short Shot", "Flashing", "Belang / Warna", "Pecah / Retak", "Bubble", "Sink Mark",
  "Lainnya")`, `kapasitas.RUNNER_DIGILING = 0`, `impor_kapasitas.KOLOM_IMPOR`, report `CAPAI_HIJAU = 100`,
  `CAPAI_KUNING = 85`.
- Setup idempotent, run from `setup.pastikan_setup` (after_install/after_migrate), writes only what differs; must
  not fail before the wizard is done.
- No `developer_mode`-exported JSON assumptions: DocType/Report JSON written by hand, `modified` bumped on every edit.
- ERPNext never patched. Hand-made BOMs (no `erp_kapasitas`) are never touched.
- Tests: `frappe.tests.IntegrationTestCase` in `erp_internal/tests/`, fixtures get-or-create in `tests/utils.py`,
  dates relative to `today()` and passed explicitly; ruff (tabs, double quotes, 110 cols).
- Docs in the same commit as the code: CLAUDE.md "Where things are", `docs/panduan/produksi.md`, `docs/impor.md`,
  `docs/menunggu-samuel.md`, `docs/TODO.md`, `docs/PROGRESS.md`.
- Conventional Commits, no Claude attribution, branch `feat/lokal`, no push.
- Roles: read for Manufacturing User; write Machine Capacity and Reject Reason for Manufacturing Manager; create,
  submit, cancel Production Entry for Manufacturing User. System Manager everything.
- Full run stays green: `cd ~/Desktop/Projects/erp-internal-bench && bench --site erp-test.localhost run-tests --app erp_internal`.

## Review Focus

1. A Production Entry submitted by a **User-profile user** (not Administrator) posts both stock entries: the
   stock entries are made as that user, so a missing permission shows there, not in an Administrator-only test
   (Task 4, `test_user_biasa_bisa_ajukan`).
2. A capacity row whose material's stock UOM is not `Kg` is refused, else BOM quantities silently mean grams or
   pieces (Task 1, `test_bahan_harus_kg`).
3. Importing the same file twice: the second preview is all Unchanged and Apply makes no new BOM (Task 3,
   `test_impor_dua_kali`).
4. Report filter on a **template** item matches its variants' entries and orders; an order with no machine lands
   on "No machine" (Task 5, `test_template_dan_tanpa_mesin`).
5. Cancelling a Production Entry puts Bins and `Work Order.produced_qty` back exactly (Task 4, `test_batal`).

---

### Task 1: Machine Capacity and the lookup

**Files:**
- Create: `erp_internal/planning/doctype/machine_capacity/{__init__.py,machine_capacity.json,machine_capacity.py}`
- Create: `erp_internal/planning/kapasitas.py`
- Modify: `erp_internal/tampilan.py` (`SIDEBAR["Manufacturing"]` and `PINTASAN["Manufacturing"]`: "Machine
  Capacity" right after "BOM"), `erp_internal/translations/id.csv`
- Modify: `erp_internal/tests/utils.py` (fixtures below)
- Test: `erp_internal/tests/test_kapasitas.py`
- Docs: CLAUDE.md row for `planning/kapasitas.py`

**Interfaces:**
- Produces: DocType `Machine Capacity` fields `item` (Link Item, reqd), `jenis` (Data), `workstation` (Link
  Workstation, reqd, `link_filters` `[["Workstation","erp_nomor",">",0]]`), `cycle_time` (Float, reqd),
  `cavities` (Int, reqd), `part_weight` (Float, reqd), `runner_weight` (Float), `runner_reground` (Check),
  `material` (Link Item, reqd), `masterbatch` (Link Item), `masterbatch_percent` (Percent), `disabled` (Check),
  read-only `pcs_per_hour` (Float), `material_per_pcs` (Float). `autoname: hash`, `allow_import: 1`,
  `track_changes: 1`.
- Produces: `kapasitas.RUNNER_DIGILING: int` (new row's `runner_reground` default, set in the controller's
  `before_insert` when the field was not given).
- Produces: `kapasitas.kapasitas(item: str, workstation: str) -> frappe._dict | None` (the whole row as dict).
- Produces: `kapasitas.jenis_varian(item: str) -> str | None` (the variant's `Jenis` attribute value).
- Produces in `tests/utils.py`: `buat_varian(template: str, jenis: list[str], warna: list[str]) -> list[str]`
  (template in Barang Jadi with attributes Jenis/Warna and one variant per pair, get-or-create, returns variant
  codes in order jenis-major), `buat_mesin(nomor: int) -> str` (Workstation `"_Uji Mesin {nomor:02d}"` with
  `erp_nomor`), `buat_kapasitas(item, mesin, **nilai) -> str` (get-or-create by (item, jenis, workstation)).

- [ ] **Step 1: Write the failing tests** in `test_kapasitas.py`:

```python
def test_hitungan(self):
	# 20 s cycle, 4 cavities, 50 g part, 12 g runner thrown away
	r = frappe.get_doc("Machine Capacity", buat_kapasitas(self.v[0], self.m1, cycle_time=20, cavities=4,
		part_weight=50, runner_weight=12, runner_reground=0, material=self.pp))
	self.assertEqual(r.pcs_per_hour, 720)
	self.assertEqual(r.material_per_pcs, 53)
	r.runner_reground = 1
	r.save()
	self.assertEqual(r.material_per_pcs, 50)

def test_urutan_cari(self):
	# variants: v[0]=Super-Merah, v[1]=Super-Biru, v[2]=DX-Merah
	t = buat_kapasitas(self.tpl, self.m1, cycle_time=30, ...)
	j = buat_kapasitas(self.tpl, self.m1, jenis="Super", cycle_time=25, ...)
	v = buat_kapasitas(self.v[0], self.m1, cycle_time=20, ...)
	self.assertEqual(kapasitas(self.v[0], self.m1).name, v)
	self.assertEqual(kapasitas(self.v[1], self.m1).name, j)
	self.assertEqual(kapasitas(self.v[2], self.m1).name, t)
	self.assertIsNone(kapasitas(self.v[0], self.m2))
	frappe.db.set_value("Machine Capacity", v, "disabled", 1)
	self.assertEqual(kapasitas(self.v[0], self.m1).name, j)

def test_bahan_harus_kg(self):  # Review Focus 2
	with self.assertRaises(frappe.ValidationError):
		buat_kapasitas(self.v[0], self.m1, material=self.kemasan_pcs, ...)

def test_ditolak(self):
	# each of: cycle_time 0, cavities 0, part_weight 0, runner_weight -1, a duplicate (item, jenis, workstation),
	# jenis on a variant item, a jenis value the template's variants never use, an unnumbered Workstation,
	# masterbatch_percent 100  → frappe.ValidationError
```

- [ ] **Step 2: Run, expect FAIL** (`DocType Machine Capacity not found`):
  `bench --site erp-test.localhost run-tests --module erp_internal.tests.test_kapasitas`
- [ ] **Step 3: Implement** the DocType JSON (permissions per Global Constraints), the controller `validate`
  (refusals above; material and masterbatch must be stock items with `stock_uom == "Kg"`; computes the two read-only
  fields with `pcs_per_hour = 3600 / cycle_time * cavities`, `material_per_pcs = part_weight + (0 if
  runner_reground else runner_weight / cavities)`), `kapasitas.py`, the fixtures, sidebar and shortcut, id.csv rows.
- [ ] **Step 4: Run** the module, then `test_tampilan` and `test_bahasa`: all PASS.
- [ ] **Step 5: Commit** `feat(planning): Machine Capacity per product per machine`

### Task 2: BOMs from a capacity row

**Files:**
- Modify: `erp_internal/planning/kapasitas.py`, `erp_internal/setup.py` (`FIELD_BOM`: `BOM.erp_mesin` Link
  Workstation and `BOM.erp_kapasitas` Link Machine Capacity, both read-only, added in `_field_aktif`),
  `erp_internal/hooks.py` (`doc_events` Work Order `validate` → `erp_internal.planning.kapasitas.pilih_bom`),
  `machine_capacity.py` (`on_update` → `buat_bom_kapasitas(self.name)` only when called from the button; see Step 3),
  `machine_capacity.js` (button "Make BOMs" for Manufacturing Manager), id.csv
- Test: `erp_internal/tests/test_bom_kapasitas.py`

**Interfaces:**
- Consumes: `kapasitas()`, `jenis_varian()`, fixtures from Task 1.
- Produces: `kapasitas.varian_tercakup(nama: str) -> list[str]` (variants whose `kapasitas(v, row.workstation)` is
  this row; for a variant row just itself).
- Produces: `kapasitas.baris_bom(row) -> list[dict]` (`[{"item_code", "qty"}]` in kg: material `mix − mb`,
  masterbatch `mb`, where `mix = material_per_pcs / 1000`, `mb = mix × masterbatch_percent / 100`; no masterbatch
  line when either is empty), rounded to 6 decimals.
- Produces: `@frappe.whitelist() kapasitas.buat_bom_kapasitas(nama: str) -> dict` returning
  `{"dibuat": [bom names], "tetap": [bom names], "nonaktif": [bom names]}`. Checks `Machine Capacity` write and
  `BOM` create permission. For each covered variant: if an active submitted BOM with this `erp_kapasitas`, item and
  `erp_mesin` has the same lines → `tetap`; else insert + submit a new one (`quantity 1`, `uom` = variant's stock
  UOM, `is_default 1`, `is_active 1`, `rm_cost_as_per "Valuation Rate"`, company = default company) → `dibuat`,
  then deactivate the older BOMs of the same (item, machine, row) that no Work Order with `docstatus < 2` and status
  not in (`Completed`, `Closed`) uses → `nonaktif`. A disabled row makes nothing and deactivates its unused BOMs.
- Produces: `kapasitas.pilih_bom(doc, method=None) -> None`: on a draft Work Order with `erp_mesin`, when the current
  `bom_no` is empty, the item's default, or a BOM of another machine, set `bom_no` to the newest active submitted
  BOM with `item == production_item` and `erp_mesin == doc.erp_mesin`; otherwise leave it.

- [ ] **Step 1: Write the failing tests**:

```python
def test_baris(self):
	# 50 g part, runner 12 g / 4 cav thrown away, masterbatch 2 %: mix 0.053 kg
	self.assertEqual(baris_bom(row), [{"item_code": PP, "qty": 0.05194}, {"item_code": MB, "qty": 0.00106}])

def test_buat_lalu_tetap(self):
	h = buat_bom_kapasitas(tpl_row)            # template row covers 3 variants
	self.assertEqual(len(h["dibuat"]), 3)
	self.assertEqual(buat_bom_kapasitas(tpl_row)["dibuat"], [])   # second run: all "tetap"
	# each BOM: erp_mesin == m1, erp_kapasitas == tpl_row, is_default 1, items == baris_bom

def test_baris_berubah(self):
	# change cycle_time only → nothing new; change part_weight → 3 new, 3 old deactivated
	# with an open WO on one old BOM → that one stays active

def test_bom_tangan_aman(self):
	hand = buat_bom(v[0], {PP: 0.1})  # tests/utils fixture, no erp_kapasitas
	# disable the row and rerun → hand BOM still is_active 1

def test_pilih_bom_mesin(self):
	# BOMs for v[0] on m1 and m2; a draft WO with erp_mesin=m2 and the item's default BOM gets m2's BOM;
	# a WO whose bom_no is a hand BOM keeps it
```

- [ ] **Step 2: Run, expect FAIL** (`cannot import name 'baris_bom'`).
- [ ] **Step 3: Implement.** The button calls `buat_bom_kapasitas`; `on_update` does not make BOMs by itself (a
  plain save stays cheap; the import calls it explicitly in Task 3).
- [ ] **Step 4: Run** `test_bom_kapasitas`, `test_kapasitas`, `test_alur_produksi`, `test_setup`: PASS.
- [ ] **Step 5: Commit** `feat(planning): BOMs made from machine capacity, machine BOM on Work Orders`

### Task 3: Excel import of machine capacity

**Files:**
- Create: `erp_internal/planning/impor_kapasitas.py`
- Create: `erp_internal/planning/doctype/machine_capacity/machine_capacity_list.js` (button "Import from Excel":
  dialog with an Attach field (private), Preview renders the rows with `frappe.utils.escape_html`, Apply)
- Create: `erp_internal/tests/data/kapasitas.xlsx` (made by `tools/contoh_kapasitas.py`, also committed, so it can be
  remade) with Indonesian headers `Produk, Jenis, No Mesin, Cycle Time (detik), Cavity, Berat (gram), Berat Runner,
  Bahan, Masterbatch, MB %`, 6 good rows (one per lookup level, one by item code, one `Mesin 03` spelling, one
  `2,5` decimal) and 4 bad rows (unknown product, unknown material, machine 99, `1.250` ambiguous)
- Modify: `docs/impor.md` (section "6. Kapasitas mesin": headers and aliases, how matching works, Preview/Apply),
  id.csv
- Test: `erp_internal/tests/test_impor_kapasitas.py`

**Interfaces:**
- Consumes: `buat_bom_kapasitas()`, `master.SAMA`, `master.PISAH`.
- Produces: `KOLOM_IMPOR: dict[str, tuple[str, ...]]` keys `item_code, produk, jenis, mesin, cycle_time, cavities,
  part_weight, runner_weight, material, masterbatch, masterbatch_percent` → aliases as in the spec plus each key's
  own English label. Headers match after `normal(h)`: lowercase, every non-alphanumeric removed
  (`"Cycle Time (detik)"` → `"cycletimedetik"`).
- Produces: `angka(nilai) -> float` (numbers pass through; text: `2,5`/`2.5` → 2.5, `1.250,5` → 1250.5,
  `1,250.5` → 1250.5; `1.250` and `1,250` raise `ValueError("ambiguous")`; empty → 0).
- Produces: `baca(file_url: str) -> list[dict]` (first sheet of `.xlsx` via openpyxl, or `.csv`; first non-empty row
  is the header; a column whose header matches nothing is ignored and reported once).
- Produces: `@frappe.whitelist() pratinjau(file_url: str) -> dict` →
  `{"baris": [{"no": int, "hasil": "New"|"Changed"|"Unchanged"|"Refused", "alasan": str, "item": str,
  "jenis": str, "workstation": str, ...values}], "kolom_asing": [str]}`; writes nothing.
- Produces: `@frappe.whitelist() terapkan(file_url: str) -> dict` → the same rows after writing New/Changed rows and
  calling `buat_bom_kapasitas` for each of them, plus `"bom": {"dibuat": int, "nonaktif": int}`.
- Both methods: caller needs write on Machine Capacity and read on the File (`frappe.get_doc("File",
  {"file_url": file_url})`, `has_permission("read")`); the file must end in `.xlsx` or `.csv`.
- Matching: `item_code` if given; else `produk` + `jenis`: a `master.PISAH` pair names its own template; else the
  template (`has_variants 1`) whose `item_name` equals `produk` (case-insensitive) and `jenis` through
  `master.SAMA["Jenis"]`; a jenis no variant has → Refused. Machine: digits in the cell → Workstation with that
  `erp_nomor`, else by name. Material/masterbatch: item code or `item_name`, never created.

- [ ] **Step 1: Write the failing tests**:

```python
def test_angka(self):
	self.assertEqual([angka(x) for x in (12, "2,5", "2.5", "1.250,5", "1,250.5", "")], [12, 2.5, 2.5, 1250.5, 1250.5, 0])
	for x in ("1.250", "1,250"):
		with self.assertRaises(ValueError): angka(x)

def test_pratinjau_tanpa_tulis(self):
	n = frappe.db.count("Machine Capacity")
	h = pratinjau(self.url)
	self.assertEqual([b["hasil"] for b in h["baris"]].count("New"), 6)
	self.assertEqual({b["no"]: b["hasil"] for b in h["baris"] if b["hasil"] == "Refused"}.keys(), {8, 9, 10, 11})
	self.assertEqual(frappe.db.count("Machine Capacity"), n)

def test_terapkan(self):
	h = terapkan(self.url)
	# 6 rows exist with the file's values (the "2,5" row's cycle_time == 2.5), BOMs made, refusals carry alasan

def test_impor_dua_kali(self):  # Review Focus 3
	terapkan(self.url)
	self.assertEqual({b["hasil"] for b in pratinjau(self.url)["baris"]} - {"Refused"}, {"Unchanged"})
	self.assertEqual(terapkan(self.url)["bom"]["dibuat"], 0)

def test_tanpa_izin(self):
	# as a User-profile user (Manufacturing User only): pratinjau raises frappe.PermissionError
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**, make the sample file with `python3.14 tools/contoh_kapasitas.py`, write the docs section.
- [ ] **Step 4: Run** `test_impor_kapasitas`, `test_bahasa`, `test_impor`: PASS.
- [ ] **Step 5: Commit** `feat(planning): import machine capacity from Excel with preview`

### Task 4: Reject Reason and Production Entry

**Files:**
- Create: `erp_internal/planning/doctype/reject_reason/` (field `reason_name` Data unique, `disabled` Check;
  `autoname: field:reason_name`)
- Create: `erp_internal/planning/doctype/production_entry/` (`.json`, `.py`, `.js`) and
  `erp_internal/planning/doctype/production_entry_reject/` (child: `reason` Link Reject Reason reqd, `qty` Float reqd)
- Modify: `erp_internal/setup.py` (`SHIFT_PABRIK`, `ALASAN_REJECT`, `_alasan_reject()` called from `pastikan_setup`:
  inserts missing reasons, never deletes), `tampilan.py` (Manufacturing: "Production Entry" right after "Work
  Order"; Setup: "Reject Reason"), `erp_internal/public/js/work_order.js` + hooks `doctype_js` (button "Record
  Output" on a submitted, unfinished Work Order opening a new Production Entry with the order filled), id.csv,
  `docs/panduan/produksi.md` (section "Catat hasil produksi")
- Test: `erp_internal/tests/test_hasil_produksi.py`

**Interfaces:**
- Consumes: fixtures `buat_barang`, `buat_bom`, `stok_awal`, `buat_mesin`, `buat_pengguna`.
- Produces: DocType `Production Entry` (`is_submittable 1`, naming `PE-.YYYY.-.#####`) fields `company` (reqd),
  `posting_date` (reqd, default Today), `shift` (Select, options from `SHIFT_PABRIK` names, set in the controller's
  `onload`/JSON; reqd), `work_order` (Link, reqd), `item` (read-only, fetched), `workstation` (Link, reqd, default
  the order's `erp_mesin`), `good_qty` (Float), `rejects` (Table Production Entry Reject), `reject_qty` (Float,
  read-only), `hours` (Float, default the shift's hours), `notes` (Small Text), `manufacture_entry`,
  `reject_entry` (Link Stock Entry, read-only, no_copy).
- Produces: `setup.SHIFT_PABRIK: tuple[tuple[str, float], ...]`, `setup.ALASAN_REJECT: tuple[str, ...]`,
  `setup.jam_shift(nama: str) -> float`.
- Stock mechanism (decided): on submit, if `good_qty > 0`: `make_stock_entry(work_order, "Manufacture", good_qty)`
  inserted and submitted → `manufacture_entry`. If `reject_qty > 0`: a `Repack` Stock Entry with the order's BOM
  exploded for `reject_qty` (`erpnext.manufacturing.doctype.bom.bom.get_bom_items_as_dict(bom, company,
  qty=reject_qty, fetch_exploded=1)`) taken from the warehouse the Manufacture takes them from (the order's
  `wip_warehouse`, or with `skip_transfer` its `source_warehouse` / the item default), and one finished row of
  the order's item, `reject_qty`, into the company's `default_scrap_warehouse` → `reject_entry`. Process loss is not
  used: it would count rejects toward Completed. Both entries are made as the current user (no
  `ignore_permissions`). On cancel: cancel `reject_entry`, then `manufacture_entry`.
- Validation: order submitted, status in (`Not Started`, `In Process`), same company; workstation numbered; if the
  order has `erp_mesin`, it must equal `workstation`; `good_qty >= 0`, `good_qty + reject_qty > 0`; every reject row
  `qty > 0` and its reason not disabled; `posting_date <= today()`; `0 < hours <= 24`.

- [ ] **Step 1: Write the failing tests** (WO of 1000 for a BOM of 0.05 kg PP per piece, `skip_transfer` 1 unless
  said):

```python
def test_bagus_dan_reject(self):
	pe = buat_hasil(wo, good=300, rejects={"Short Shot": 20, "Flashing": 5})
	self.assertEqual(pe.reject_qty, 25)
	self.assertEqual(stok(JADI, barang_jadi) - j0, 300)
	self.assertEqual(stok(JADI, reject) - r0, 25)
	self.assertAlmostEqual(p0 - stok(PP, sumber), 325 * 0.05)
	self.assertEqual(frappe.db.get_value("Work Order", wo, "produced_qty"), 300)

def test_reject_tidak_menyelesaikan(self):
	buat_hasil(wo, good=990, rejects={"Pecah / Retak": 10})
	self.assertEqual(frappe.db.get_value("Work Order", wo, "status"), "In Process")

def test_dengan_transfer(self):
	# skip_transfer 0, 400 transferred: good 300 + reject 25 both take PP from Gudang Produksi

def test_batal(self):  # Review Focus 5
	# submit then cancel: every Bin back to before, produced_qty 0, both stock entries docstatus 2

def test_user_biasa_bisa_ajukan(self):  # Review Focus 1
	frappe.set_user(buat_pengguna("_uji.pe@example.com", "User", "User", self.pabrik))
	buat_hasil(wo, good=10, rejects={"Bubble": 1})   # submits, both entries exist

def test_ditolak(self):
	# machine ≠ the order's erp_mesin, both quantities 0, a reject row qty 0, a tomorrow date, hours 25,
	# a Completed order, a disabled reason → frappe.ValidationError

def test_alasan_bawaan(self):
	self.assertEqual(set(ALASAN_REJECT) <= set(frappe.get_all("Reject Reason", pluck="name")), True)
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** If ERPNext refuses a step of the decided mechanism, stop and report it with the error
  (do not switch to process loss).
- [ ] **Step 4: Run** `test_hasil_produksi`, `test_alur_produksi`, `test_tampilan`, `test_bahasa`, `test_setup`: PASS.
- [ ] **Step 5: Commit** `feat(planning): Production Entry records output per shift and moves good and reject stock`

### Task 5: Plan vs Actual report

**Files:**
- Create: `erp_internal/planning/report/plan_vs_actual/{__init__.py,plan_vs_actual.json,.py,.js}` (Script Report,
  `ref_doctype` Production Entry, roles Manufacturing User, Manufacturing Manager, System Manager)
- Modify: `tampilan.py` (Manufacturing: "Plan vs Actual" right after "Order Readiness"), id.csv,
  `docs/panduan/produksi.md` (section "Laporan Plan vs Actual")
- Test: `erp_internal/tests/test_plan_vs_actual.py`

**Interfaces:**
- Consumes: `kapasitas()`, `setup.SHIFT_PABRIK`, Production Entry fields.
- Produces: `CAPAI_HIJAU = 100`, `CAPAI_KUNING = 85`, `TANPA_MESIN = "No machine"` (the key; shown translated),
  `KELOMPOK = {"Machine": ("mesin",), "Machine + Day": ("mesin", "tanggal"), "Day": ("tanggal",), "Item": ("item",),
  "Work Order": ("work_order",), "Shift": ("shift",)}`.
- Produces: `target_harian(qty: float, mulai: date, selesai: date | None) -> dict[date, float]` (even split over
  inclusive calendar days; `selesai` None or before `mulai` → all on `mulai`).
- Produces: `bagi_shift(target: float, jam: dict[str, float]) -> dict[str, float]` (by recorded hours; all zero or
  empty → evenly over `SHIFT_PABRIK`).
- Produces: `data(f: frappe._dict) -> list[dict]`: base rows per (mesin, tanggal, work_order, shift) with `target`
  (None when Capacity mode has no row), `good`, `reject`, one `r_<scrubbed reason>` per reason, then grouped by
  `KELOMPOK[f.group_by]` summing; a group's target is None only when all its base targets are None. Each row has
  `capai` (`good / target × 100`, None without target), `persen_reject` (`reject / (good + reject) × 100`, 0 when
  both 0), `catatan` ("No capacity" when target None in Capacity mode). Sorted by machine `erp_nomor` (No machine
  last), then date, then the other keys.
- Produces: `execute(filters) -> (columns, data, None, chart)`; filters `company` (reqd), `from_date`, `to_date`
  (JS default: 7 days ending yesterday; `from_date > to_date` → throw), `workstation`, `item`, `work_order`,
  `shift`, `group_by` (default "Machine + Day"), `target_dari` ("Work Order" default, or "Capacity"). Company
  permission checked like `order_readiness.execute`. Item filter: the item and, for a template, every
  `variant_of` it. Work Orders: `docstatus 1`, company, planned window (`planned_start_date` to
  `planned_end_date` or `expected_delivery_date`) intersecting the range. Columns: group keys, Target, Good,
  Reject, Reject %, Achieved %, Note, then one Float column per reason present in the result. JS formatter colours
  Achieved % green ≥ `CAPAI_HIJAU`, orange ≥ `CAPAI_KUNING`, red below (values sent in the report's message or
  duplicated as JS constants with a comment pointing at the Python ones). Chart: bar, labels = group label,
  datasets Target, Good, Reject.

- [ ] **Step 1: Write the failing tests** (`hari_ini` fixed as `getdate(today())`, orders and entries dated
  relative to it):

```python
def test_target_harian(self):
	self.assertEqual(target_harian(900, d(-2), d(0)), {d(-2): 300, d(-1): 300, d(0): 300})
	self.assertEqual(target_harian(900, d(0), None), {d(0): 900})

def test_bagi_shift(self):
	self.assertEqual(bagi_shift(300, {"Shift 1": 8, "Shift 2": 4}), {"Shift 1": 200, "Shift 2": 100})
	self.assertEqual(bagi_shift(300, {}), {"Shift 1": 100, "Shift 2": 100, "Shift 3": 100})

def test_mesin_hari(self):
	# WO 600 on m1 over d(-2)..d(-1); entries d(-2): good 250 + reject 10 Short Shot; d(-1): good 300
	rows = data(f(group_by="Machine + Day"))
	self.assertEqual([(r["tanggal"], r["target"], r["good"], r["reject"], r["capai"]) for r in rows],
		[(d(-2), 300, 250, 10, 250 / 3), (d(-1), 300, 300, 0, 100)])
	self.assertEqual(rows[0]["r_short_shot"], 10)

def test_dua_wo_satu_mesin(self):
	# a second WO on m1 the same days: Machine grouping sums both orders' targets and output

def test_kapasitas(self):
	# capacity 720 pcs/h on m1; entry hours 8 → target 5760; an order on m2 with no capacity row → target None,
	# catatan "No capacity", capai None

def test_template_dan_tanpa_mesin(self):  # Review Focus 4
	# filter item=template finds its variant's WO and entries; a WO without erp_mesin → mesin TANPA_MESIN row last

def test_target_tanpa_hasil(self):
	# a planned day with no entry: good 0, capai 0

def test_perusahaan_lain(self):
	# entries of another company never appear; a user without read on the company → frappe.PermissionError

def test_semua_kelompok(self):
	# every KELOMPOK key: totals of target, good, reject equal the Machine + Day totals
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `test_plan_vs_actual`, `test_tampilan`, `test_bahasa`: PASS.
- [ ] **Step 5: Commit** `feat(planning): Plan vs Actual report per machine, day, item, order or shift`

### Task 6: Sample data, docs and the full run

**Files:**
- Modify: `erp_internal/contoh.py` (`buat_contoh`: capacity rows for the sample products on two machines, their
  BOMs via `buat_bom_kapasitas`, and 7 days of Production Entries with rejects ending yesterday, idempotent like the
  rest of `contoh.py`; refused with `erp_produksi` as it already is), `erp_internal/tests/test_contoh.py` (second
  run writes nothing still holds; at least one Production Entry exists)
- Modify: CLAUDE.md (rows for the new DocTypes, report and modules; Status line), `docs/TODO.md` (manual checks:
  import a file in the browser, record output from a Work Order, open Plan vs Actual in both target modes and in
  Indonesian), `docs/PROGRESS.md`, `docs/menunggu-samuel.md` (row 4: shifts and hours, reject types, runner
  reground, the Excel's headers, each with its default and `setup.SHIFT_PABRIK` / `setup.ALASAN_REJECT` /
  `kapasitas.RUNNER_DIGILING` / `impor_kapasitas.KOLOM_IMPOR` as where the answer goes)

- [ ] **Step 1: Write the failing test** in `test_contoh.py`: after `buat_contoh()`, `frappe.db.count("Production
  Entry", {"docstatus": 1}) > 0` and `frappe.db.count("Machine Capacity") > 0`; a second `buat_contoh()` changes
  neither count.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**, then on the dev site: `bench --site erp.localhost migrate`,
  `bench --site erp.localhost execute erp_internal.contoh.buat_contoh` twice.
- [ ] **Step 4: Full run**: `bench --site erp-test.localhost run-tests --app erp_internal` all OK, and
  `ERP_SANDI=<SAMPLE_PASSWORD> node tools/cek_layar.mjs` 3 users OK (restart `bench start` after `bench build` if
  the JS bundle changed). Record the counts in TODO.md's "Last full run".
- [ ] **Step 5: Commit** `feat(contoh): sample capacity, BOMs and production entries; docs`
