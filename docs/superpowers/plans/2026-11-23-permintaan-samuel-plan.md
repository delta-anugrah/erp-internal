# Samuel's requests of 2026-11-23 Implementation Plan

Status: built 2026-11-23 (Tasks 1-14), Tasks 15-16 added and built 2026-11-24; progress in docs/TODO.md; deviations under each task.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three roles (Super Admin, Admin, Produksi), a Work Order machine lock, warehouse Pluit, a daily input page
in Samuel's Excel layout with print and Excel export, monthly expenses, his PO print, attached real documents and
pigment stock.

**Architecture:** Everything lives in the `erp_internal` app and is re-applied by `setup.pastikan_setup` on migrate.
Production Entry stays the only production record: the daily input page (`erp_internal/daily_input.py` + a Desk page)
reads and writes Production Entries, and the expense report counts machine shifts from them. Roles are Role Profile
tables in `tampilan.py`; rules are module-level tables (`lampiran.WAJIB_LAMPIRAN`, `setup.GUDANG_JUAL`,
`setup.KATEGORI_BIAYA`, `kapasitas.TEMPLATE_PIGMEN`).

**Tech Stack:** Frappe v16.53.0, ERPNext v16.52.1, HRMS v16.52.0, Python 3.14, openpyxl (Frappe's own), plain JS in
the app bundle, Jinja print formats.

**Spec:** `docs/superpowers/specs/2026-11-23-permintaan-samuel-design.md` (pictures in
`docs/superpowers/specs/2026-11-23-samuel/`). Read it before any task.

## Global Constraints

- ERPNext and HRMS are never patched; every customisation is in `erp_internal`, idempotent, applied on
  `after_install`/`after_migrate`; setup must not fail before the setup wizard.
- English UI text in `_()`/`__()`, each string with an Indonesian row in `erp_internal/translations/id.csv`
  (`test_semua_teks_kita_diterjemahkan` fails otherwise). Python identifiers Indonesian, comments and docstrings
  English; URLs, API paths, page routes and realtime events English.
- ruff: tabs, double quotes, 110 columns. JS/CSS with tabs.
- Tests: `frappe.tests.IntegrationTestCase`/`UnitTestCase` in `erp_internal/tests/`, get-or-create fixtures in
  `tests/utils.py`, dates passed in, never the real date.
- Locale: Asia/Jakarta, IDR, `dd-mm-yyyy`, `#.###,##`. One company (`setup.perusahaan()`).
- Behaviour hangs off module-level UPPER_CASE tables: change the table, not a special case.
- Docs follow code in the same commit: CLAUDE.md, README.md, `docs/`, `.claude/rules/`.
- Every UI change checked at 390 px and 768 px.
- Conventional Commits on `feat/lokal`, never a `Co-Authored-By` or other Claude attribution.
- Shell for agents: one simple command per call (no `$(...)`, loops or subshells); read files with Read.
- Test run: `cd ~/Desktop/Projects/erp-internal-bench && bench --site erp-test.localhost run-tests --module
  erp_internal.tests.<module>`; after a DocType or patch change first `bench --site erp-test.localhost migrate`.

## Review Focus

1. **The same cell saved twice** (two phones, a double Enter): the cell must end with exactly one submitted
   Production Entry. Test `test_dua_kali_satu_entri` in Task 6.
2. **A number typed the Indonesian way** ("13.384", "13384"): both mean 13384 pieces; "13,5" or "-5" is refused,
   empty means 0. Test `test_baca_jumlah` in Task 6.
3. **A replacement that ERPNext refuses** (more than the order allows, no stock on that date): the old entry must
   stay submitted and the stock unchanged. Test `test_sel_gagal_tetap_lama` in Task 6.
4. **A Work Order moved to another machine mid-run**: earlier entries keep their machine, new ones take the new
   machine, operator shifts count each entry's own machine. Tests `test_mesin_diganti` (Task 6) and
   `test_shift_ikut_mesin_entri` (Task 9).
5. **Month boundaries in the expense report**: a monthly entry dated the 31st counts in every later month, an
   Until in mid-month still counts that month, per-shift counting stops at Until inclusive. Test
   `test_batas_bulan` in Task 9.

---

### Task 1: Profiles renamed to Super Admin, Admin, Produksi

**Files:**
- Modify: `erp_internal/tampilan.py` (constants, `IKON`, `MODUL_BOLEH`, `PROFIL_PERAN`, `PERAN_BOLEH_ADMIN`, `blok_profil`, `_profil_modul`)
- Create: `erp_internal/patches/profil_tiga.py`; Modify: `erp_internal/patches.txt`
- Modify: `erp_internal/akun.py`, `erp_internal/wizard.py`, `erp_internal/contoh.py` (`surel`, `KARYAWAN`, `_pengguna`, `_kantor`)
- Modify tests using `DEVELOPER`/`USER`: `test_akun.py`, `test_batas_user.py`, `test_bom_kapasitas.py`, `test_hasil_produksi.py`, `test_impor_kapasitas.py`, `test_modul_mati.py`, `test_pengguna.py`, `test_ruang_kerja.py`, `test_tampilan.py` (its `surel` strips spaces), `test_wizard.py`
- Create: `erp_internal/tests/test_peran.py`
- Modify: `tools/cek_layar.mjs` (`PROFIL` keys, `surel`), CLAUDE.md, `.claude/rules/tampilan.md`, `docs/panduan/admin.md` (profile names)

**Interfaces:**
- Produces: `tampilan.SUPER_ADMIN = "Super Admin"`, `tampilan.ADMIN = "Admin"`, `tampilan.PRODUKSI = "Produksi"`
  (replacing `DEVELOPER` and `USER`); `tampilan.NAMA_LAMA = {"Developer": SUPER_ADMIN, "User": PRODUKSI}`;
  `profil_tiga.ganti_nama(lama: str, baru: str) -> bool`; `contoh.SUREL = {SUPER_ADMIN: "developer@example.com",
  ADMIN: "admin@example.com", PRODUKSI: "user@example.com"}` (sample logins unchanged).
- Rights do not change in this task (Produksi still holds Stock User + `ERP User`; Task 2 changes them).

- [ ] **Step 1: Write the failing tests** in `erp_internal/tests/test_peran.py`

```python
class TestPeran(IntegrationTestCase):
	def test_tiga_profil(self):
		self.assertEqual(list(PROFIL_PERAN), [SUPER_ADMIN, ADMIN, PRODUKSI])
		for nama in (SUPER_ADMIN, ADMIN, PRODUKSI):
			self.assertTrue(frappe.db.exists("Role Profile", nama))
			self.assertTrue(frappe.db.exists("Module Profile", nama))
		self.assertFalse(frappe.db.exists("Role Profile", "Developer"))
		self.assertFalse(frappe.db.exists("Role Profile", "User"))

	def test_ganti_nama_bawa_pengguna(self):
		# A profile under an old name keeps its users after the rename; a second run changes nothing.
		frappe.get_doc({"doctype": "Role Profile", "role_profile": "_Uji Lama", "roles": [{"role": "Stock User"}]}).insert()
		frappe.get_doc({"doctype": "Module Profile", "module_profile_name": "_Uji Lama"}).insert()
		u = buat_pengguna("_uji.peran.lama@example.com", "_Uji Lama", "_Uji Lama", None)
		self.assertTrue(profil_tiga.ganti_nama("_Uji Lama", "_Uji Baru"))
		user = frappe.get_doc("User", u)
		self.assertEqual([r.role_profile for r in user.role_profiles], ["_Uji Baru"])
		self.assertEqual(user.module_profile, "_Uji Baru")
		self.assertFalse(profil_tiga.ganti_nama("_Uji Lama", "_Uji Baru"))
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bench --site erp-test.localhost run-tests --module erp_internal.tests.test_peran`
Expected: ImportError on `SUPER_ADMIN` / `profil_tiga`.

- [ ] **Step 3: Rename the constants and add the patch**

`tampilan.py`: `SUPER_ADMIN, ADMIN, PRODUKSI = "Super Admin", "Admin", "Produksi"` and every use of `DEVELOPER`/`USER`
across the files above. `profil_tiga.ganti_nama(lama, baru)` renames the Role Profile and the Module Profile named
`lama` to `baru` with `frappe.rename_doc(..., force=True)` when `lama` exists and `baru` does not, and returns
whether it renamed anything; `execute()` calls it for each pair of `tampilan.NAMA_LAMA`. Add
`erp_internal.patches.profil_tiga` under `[post_model_sync]`. `contoh.surel(profil)` returns `SUREL[profil]`;
`tools/cek_layar.mjs` keys `PROFIL` by the new names and maps them to the same three logins.

- [ ] **Step 4: Run the touched modules and migrate the dev site**

Run: `bench --site erp-test.localhost migrate`, then `run-tests --module` for `test_peran`, `test_tampilan`,
`test_pengguna`, `test_akun`, `test_wizard`, `test_modul_mati`, `test_ruang_kerja`, `test_contoh`.
Expected: all OK. Then `bench --site erp.localhost migrate` and check `developer@example.com` now has Role Profile
"Super Admin" and `user@example.com` "Produksi".

- [ ] **Step 5: Commit**

```bash
git add erp_internal tools/cek_layar.mjs CLAUDE.md .claude/rules/tampilan.md docs/panduan/admin.md
git commit -m "feat(tampilan): profiles Super Admin, Admin, Produksi (renamed from Developer, User)"
```

---

### Task 2: Produksi enters production only; Admin only views it

**Files:**
- Modify: `erp_internal/tampilan.py` (`PROFIL_PERAN[PRODUKSI] = (PERAN_USER,)`, `IKON["Stock"] = (ADMIN,)`, `MODUL_BOLEH[PRODUKSI] = ("Manufacturing",)`)
- Modify: `erp_internal/setup.py` (`IZIN_TAMBAHAN`, new `IZIN_DICABUT`, `_proyek`)
- Modify: `erp_internal/planning/doctype/production_entry/production_entry.json` (permissions), `production_entry.py` (`FLAG_HASIL` moves here, `_ajukan`, `on_cancel`, new `cek_stock_entry`)
- Modify: `erp_internal/planning/doctype/sales_history/sales_history.json`, `erp_internal/planning/report/order_readiness/order_readiness.json` (drop `ERP User`)
- Delete: `erp_internal/batas_user.py`, `erp_internal/tests/test_batas_user.py`; Modify: `erp_internal/hooks.py` (its import, `has_permission`; Stock Entry `validate` and `before_cancel` now call `production_entry.cek_stock_entry`)
- Modify: `erp_internal/setup.py` (`BAWAAN_WO = {"skip_transfer": 1}`, `_bawaan_wo`: Property Setter `default` per field), `erp_internal/public/js/work_order.js` (remove ERPNext's "Finish" button unless the user has System Manager), `docs/panduan/produksi.md` (lines 92-95: Start optional, Finish Super Admin only, output through Daily Input)
- Modify: `erp_internal/tests/test_peran.py`, `test_tampilan.py` (`IZIN`, menu expectations), `test_hasil_produksi.py`
- Modify: `tools/cek_layar.mjs` (Produksi: modules `["Manufacturing"]`, home Manufacturing, form Production Entry), `tools/panduan_gambar.mjs` (delivery note and Material Receipt pictures as `admin@`)
- Modify: CLAUDE.md (drop the `batas_user.py` row, the Rules' role lines), `.claude/rules/tampilan.md`, `docs/panduan/user.md` (now the Produksi guide), `docs/panduan/gudang.md` and `penjualan.md` (delivery notes and Material Receipts are Admin's)

**Interfaces:**
- Consumes: Task 1's `PRODUKSI`, `ADMIN`, `SUPER_ADMIN`.
- Produces: `setup.IZIN_DICABUT: tuple[tuple[str, str, int, tuple[str, ...]], ...]` (same shape as `IZIN_TAMBAHAN`);
  Production Entry's Manufacture/Repack entries are made and cancelled with `flags.ignore_permissions = True` and
  `flags[FLAG_HASIL] = True`; `production_entry.FLAG_HASIL = "erp_hasil_produksi"`;
  `production_entry.cek_stock_entry(doc, method=None)` (Stock Entry `validate`, `before_cancel`): refuses a
  Manufacture without `FLAG_HASIL` unless the user has System Manager (`_("Record output in Daily Input.")`), and a
  cancel without the flag of an entry a submitted Production Entry names in `manufacture_entry` or `reject_entry`
  (`_("Cancel Production Entry {0} instead.")`).

- [ ] **Step 1: Write the failing tests** (in `test_peran.py`)

```python
	def test_produksi_hanya_produksi(self):
		u = buat_pengguna("_uji.peran.produksi@example.com", PRODUKSI, PRODUKSI, self.pabrik)
		for dt in ("Production Entry",):
			self.assertTrue(frappe.has_permission(dt, "create", user=u))
		for dt in ("Work Order", "Workstation", "Machine Capacity", "Reject Reason", "Company"):
			self.assertTrue(frappe.has_permission(dt, "read", user=u), dt)
		for dt in ("Stock Entry", "Delivery Note", "Sales Order", "Sales History", "Price List", "Account",
				"Stock Settings", "Customer Group", "Item", "BOM"):
			self.assertFalse(frappe.has_permission(dt, "read", user=u), dt)

	def test_admin_hanya_lihat_produksi(self):
		u = buat_pengguna("_uji.peran.admin@example.com", ADMIN, ADMIN, self.pabrik)
		self.assertTrue(frappe.has_permission("Production Entry", "read", user=u))
		for hak in ("create", "write", "submit", "cancel", "amend", "delete"):
			self.assertFalse(frappe.has_permission("Production Entry", hak, user=u), hak)

	def test_izin_dicabut(self):
		for doctype, peran, level, _hak in IZIN_DICABUT:
			self.assertFalse(frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": peran, "permlevel": level}))
```

In `test_hasil_produksi.py` add `test_produksi_tanpa_hak_stok`: as a Produksi user, `buat_hasil(wo, good=10,
rejects={"Bubble": 2})` submits, Gudang Barang Jadi +10 and Gudang Reject +2; `pe.cancel()` as the same user puts
both back. Add `test_finish_hanya_super_admin`: as an Admin user, `frappe.get_doc(make_stock_entry(wo,
"Manufacture", 5)).insert()` raises `frappe.ValidationError`; as Administrator (System Manager) it inserts; and
`test_entri_pe_batal_lewat_pe`: cancelling `pe.manufacture_entry` directly raises, cancelling `pe` cancels it. In
`test_peran.py` add `test_wo_tanpa_transfer`: `frappe.new_doc("Work Order").skip_transfer == 1`. Replace `test_tampilan.IZIN` with: Produksi creates only `["Production Entry"]` and none of `_HARIAN`,
`BOM`, `Workstation`, `Machine Capacity`, `_KELOLA`, `_BUILD`; Admin creates `_HARIAN`, `_KELOLA`, Project, MPS and
not `_BUILD` or Production Entry; Super Admin creates `_KELOLA`, `_BUILD` and Production Entry.

- [ ] **Step 2: Run them to verify they fail**

Run: `run-tests --module erp_internal.tests.test_peran`. Expected: FAIL (Produksi reads Stock Entry, Admin creates
Production Entry).

- [ ] **Step 3: Implement**

Produksi profile = `(PERAN_USER,)`. Production Entry JSON: Manufacturing Manager and Manufacturing User keep only
read, report, export, print, email, share. `IZIN_TAMBAHAN` loses the four `PERAN_USER` rows (Price List, Account,
Stock Settings, Customer Group) and gains `("Work Order", PERAN_USER, 0, ("read",))` and `("Company", PERAN_USER,
0, ("read",))`; those four go to `IZIN_DICABUT`, whose Custom DocPerm rows (`parent`, `role`, `permlevel`) `_proyek`
deletes with `frappe.db.delete` when they exist, then `frappe.clear_cache(doctype=...)` (Frappe has no
`remove_permission` helper; the Role Permission Manager's `remove` is the whitelisted UI path). `ProductionEntry._ajukan` and `on_cancel` set `se.flags.ignore_permissions =
True` beside `FLAG_HASIL`. Delete `batas_user.py`, its hooks and test; hook `cek_stock_entry` in its place.
`_bawaan_wo` runs in `pastikan_setup` after the wizard; `work_order.js` calls `frm.remove_custom_button(__("Finish"))`
in `refresh` when `!frappe.user.has_role("System Manager")` (ERPNext's handler runs first).

- [ ] **Step 4: Run the tests**

Run: `bench --site erp-test.localhost migrate`, then `run-tests --module` for `test_peran`, `test_tampilan`,
`test_hasil_produksi`, `test_production_floor`, `test_plan_vs_actual`, `test_order_readiness`, `test_contoh`.
Expected: all OK.

- [ ] **Step 5: Screens** — `bench build --app erp_internal`, restart `bench start`, `ERP_SANDI=… node
  tools/cek_layar.mjs`. Expected: 3 users OK; Produksi's menu shows Manufacturing only.

- [ ] **Step 6: Commit**

```bash
git add -A erp_internal tools CLAUDE.md .claude/rules/tampilan.md docs/panduan
git commit -m "feat(peran): Produksi only records production, Admin views it; batas_user removed"
```

---

### Task 3: Work Order machine lock

**Files:**
- Modify: `erp_internal/planning/kapasitas.py` (`mesin_item`, `cari_mesin`, `mesin_terdaftar`), `erp_internal/hooks.py` (Work Order events), `erp_internal/public/js/work_order.js` (query on `erp_mesin`)
- Modify: `erp_internal/tests/utils.py` (new `buat_wo`), `test_kapasitas.py`. Tests whose items have no capacity row at all pass unchanged (any machine is allowed); check only those whose item has a row on another machine than its Work Order's: `test_bom_kapasitas.py`, `test_mesin_barang.py`, `erp_internal/contoh.py`, and `tools/lantai.mjs` (the `wo`/`xss` cases' Work Order on `erp.localhost`, where Samuel's items have rows)
- Modify: CLAUDE.md (kapasitas row), `docs/panduan/produksi.md` (machine list per item)

**Interfaces:**
- Produces:
  - `kapasitas.mesin_item(item: str) -> list[str]`: the numbered machines `kapasitas(item, m)` finds a row for,
    sorted by `erp_nomor`; empty when the item (and its template) has no enabled row at all.
  - `kapasitas.cari_mesin(doctype, txt, searchfield, start, page_len, filters) -> list[tuple]` (whitelisted link
    query; `filters["item"]`): `mesin_item` filtered by `txt`, or every enabled numbered machine when `mesin_item`
    is empty.
  - `kapasitas.mesin_terdaftar(doc, method=None) -> None` (Work Order `validate` and `before_update_after_submit`).
  - `tests.utils.buat_wo(item: str, mesin: str | None, qty: float = 1000, company: str = "_Uji Pabrik", bom: str | None = None, **lain) -> str`:
    inserts and submits a Work Order (`skip_transfer` 1, `bom_no` = `bom` or the item's default BOM) on `mesin`;
    `lain` overrides any field. It makes no capacity row: the caller adds one when the test needs the lock.

- [ ] **Step 1: Write the failing tests** (`test_kapasitas.py`)

```python
	def test_mesin_di_luar_daftar_ditolak(self):
		buat_kapasitas(self.barang, self.mesin_a, material=self.bahan)
		wo = self.order_draft(self.mesin_b)
		with self.assertRaisesRegex(frappe.ValidationError, self.mesin_a):  # the message names the right machine
			wo.insert()

	def test_barang_tanpa_baris_bebas(self):
		# No list to check against: any numbered machine (several real products have no row yet).
		self.assertTrue(self.order_draft(self.mesin_b, item=self.barang_tanpa_baris).insert().name)
		hasil = cari_mesin("Workstation", "", "name", 0, 50, {"item": self.barang_tanpa_baris})
		self.assertTrue({self.mesin_a, self.mesin_b} <= {r[0] for r in hasil})

	def test_order_tanpa_mesin_boleh(self):
		self.assertTrue(self.order_draft(None, item=self.barang_tanpa_baris).insert().name)

	def test_pindah_mesin_setelah_submit(self):
		buat_kapasitas(self.barang, self.mesin_a, material=self.bahan)
		wo = frappe.get_doc("Work Order", buat_wo(self.barang, self.mesin_a))
		wo.erp_mesin = self.mesin_b
		with self.assertRaises(frappe.ValidationError):
			wo.save()

	def test_cari_mesin(self):
		buat_kapasitas(self.barang, self.mesin_a, material=self.bahan)
		hasil = cari_mesin("Workstation", "", "name", 0, 20, {"item": self.barang})
		self.assertEqual([r[0] for r in hasil], [self.mesin_a])
```

- [ ] **Step 2: Run to verify they fail** — Run `run-tests --module erp_internal.tests.test_kapasitas`. Expected: FAIL.

- [ ] **Step 3: Implement** `mesin_item`, `cari_mesin`, `mesin_terdaftar` beside `mesin_aktif` (same "a submitted
  order already on its machine keeps running" rule; an item with no row at all passes). Message: `"{item} is not
  made on {machine}. Machines for it: {list}."`. `work_order.js` shows `__("No Machine Capacity row for this item
  yet: every machine is allowed.")` under the Machine field when `mesin_item` is empty. Hooks: Work Order `validate`:
  `[mesin_aktif, mesin_terdaftar]`; `before_update_after_submit`: `[kunci_mesin, mesin_aktif, mesin_terdaftar]`.
  `work_order.js`: `frm.set_query("erp_mesin", () => ({query: "erp_internal.planning.kapasitas.cari_mesin",
  filters: {item: frm.doc.production_item}}))`. Then `buat_wo` and any test fix the run below shows.

- [ ] **Step 4: Run** `test_kapasitas`, `test_bom_kapasitas`, `test_hasil_produksi`, `test_plan_vs_actual`,
  `test_production_floor`, `test_mesin_barang`, `test_contoh`. Expected: all OK. Then `ERP_SANDI=… node
  tools/lantai.mjs wo xss` (needs `bench start`). Expected: OK, or fix its Work Order's machine to one listed for
  its item.

- [ ] **Step 5: Commit** — `git commit -m "feat(kapasitas): a Work Order takes only a machine listed for its item"`

---

### Task 4: Warehouse Pluit

**Files:**
- Modify: `erp_internal/setup.py` (`GUDANG_PABRIK` + "Gudang Pluit", new `GUDANG_JUAL`, new `_gudang_kirim`, called in `pastikan_setup`)
- Create: `erp_internal/pengiriman.py` (`ikut_gudang`); Modify: `erp_internal/hooks.py` (Delivery Note `validate`)
- Modify: `erp_internal/planning/report/order_readiness/order_readiness.py` (`data`, `_stok`), `order_readiness.js` (filter description)
- Modify tests: `test_setup.py`, `test_alur_jual_beli.py` (every delivery note sets `set_warehouse`), `test_order_readiness.py`
- Modify: CLAUDE.md, `docs/panduan/gudang.md` (Pluit, Material Transfer), `docs/panduan/penjualan.md` (pick the warehouse)

**Interfaces:**
- Produces: `setup.GUDANG_JUAL = ("Gudang Barang Jadi", "Gudang Pluit")`; `pengiriman.ikut_gudang(doc, method=None)`;
  `order_readiness._stok(kode: list[str], gudang: list[str]) -> dict[str, float]`.

- [ ] **Step 1: Write the failing tests**

```python
	# test_setup.py
	def test_gudang_pluit(self):
		wh = gudang(self.pabrik, "Gudang Pluit")
		self.assertEqual(frappe.db.get_value("Warehouse", wh, ["disabled", "is_group"]), (0, 0))

	# test_alur_jual_beli.py
	def test_gudang_kirim_wajib(self):
		dn = self.surat_jalan(set_warehouse=None)
		with self.assertRaises(frappe.MandatoryError):
			dn.insert()
		dn.set_warehouse = gudang(self.pabrik, "Gudang Pluit")
		dn.items[0].warehouse = gudang(self.pabrik, "Gudang Barang Jadi")
		dn.insert()
		self.assertEqual({i.warehouse for i in dn.items}, {dn.set_warehouse})

	# test_order_readiness.py
	def test_stok_dua_gudang(self):
		stok_awal(self.pabrik, self.kode, 30, "Gudang Barang Jadi")
		stok_awal(self.pabrik, self.kode, 20, "Gudang Pluit")
		baris = self.baris(gudang=None)
		self.assertEqual(baris["stok"], 50)
		self.assertEqual(self.baris(gudang=gudang(self.pabrik, "Gudang Pluit"))["stok"], 20)
```

- [ ] **Step 2: Run to verify they fail** (the three modules). Expected: FAIL.

- [ ] **Step 3: Implement.** `_gudang_kirim` writes a Property Setter `reqd` 1 on Delivery Note `set_warehouse`
  (only when it differs). `ikut_gudang` sets every line's `warehouse` to `set_warehouse` when that is set. Order
  Readiness sums `actual_qty` of `Bin` over `GUDANG_JUAL` (as the company's warehouses) when no warehouse is picked.

- [ ] **Step 4: Run** `test_setup`, `test_alur_jual_beli`, `test_order_readiness`, `test_contoh`. Expected: all OK.

- [ ] **Step 5: Commit** — `git commit -m "feat(gudang): warehouse Pluit; every delivery note names its warehouse"`

---

### Task 5: Real documents attached

**Files:**
- Create: `erp_internal/lampiran.py`; Modify: `erp_internal/hooks.py` (`before_submit` per DocType of the table, `extend_bootinfo` + `erp_internal.lampiran.boot`)
- Create: `erp_internal/planning/report/missing_documents/` (`.json`, `.py`, `.js`, `__init__.py`)
- Create: `erp_internal/public/js/lampiran.js`; Modify: `erp_internal/public/js/erp_internal.bundle.js` (import)
- Modify: `erp_internal/tampilan.py` (`SIDEBAR["Stock"]`, `PINTASAN["Stock"]`, `IKON_LINK`: "Missing Documents", icon `paperclip`), `erp_internal/translations/id.csv`
- Modify: `erp_internal/tests/utils.py` (new `lampirkan`, used in `buat_order` before submit), `test_alur_jual_beli.py`, `erp_internal/contoh.py` (`_jual_beli`, `_terima_bahan` attach before submit)
- Create: `erp_internal/tests/test_lampiran.py`
- Modify: CLAUDE.md, `docs/panduan/penjualan.md`, `pembelian.md`, `gudang.md`, `admin.md`

**Interfaces:**
- Produces:
  - `lampiran.WAJIB_LAMPIRAN: dict[str, tuple[str, tuple[str, ...]] | None]` = Sales Order, Sales Invoice, Purchase
    Order, Purchase Receipt, Purchase Invoice, Payment Entry → None; Stock Entry → `("purpose", ("Material
    Receipt",))`. Task 9 adds Expense Entry → `("repeat", ("Once",))`.
  - `lampiran.LAMPIRAN_NANTI = ("Delivery Note",)`
  - `lampiran.wajib(doc) -> bool`, `lampiran.ada_lampiran(doctype: str, nama: str) -> bool`,
    `lampiran.cek_lampiran(doc, method=None) -> None`, `lampiran.boot(bootinfo) -> None` (sets
    `bootinfo.erp_lampiran = {"wajib": {dt: cond}, "nanti": [...]}`).
  - `tests.utils.lampirkan(doctype: str, nama: str) -> str` (a small private `.txt` File attached; returns its name).

- [ ] **Step 1: Write the failing tests** (`test_lampiran.py`)

```python
	def test_tanpa_lampiran_ditolak(self):
		so = buat_order(self.pabrik, self.pelanggan, self.kode, 5, self.hari, self.hari, submit=False)
		with self.assertRaisesRegex(frappe.ValidationError, "real document"):
			so.submit()
		lampirkan("Sales Order", so.name)
		so.submit()
		self.assertEqual(so.docstatus, 1)

	def test_hanya_material_receipt(self):
		self.assertTrue(wajib(frappe._dict(doctype="Stock Entry", purpose="Material Receipt")))
		self.assertFalse(wajib(frappe._dict(doctype="Stock Entry", purpose="Manufacture")))
		self.assertFalse(wajib(frappe._dict(doctype="Delivery Note")))
		self.assertFalse(wajib(frappe._dict(doctype="Work Order")))

	def test_laporan_surat_jalan_tanpa_lampiran(self):
		dn = self.surat_jalan_diajukan()  # submitted without an attachment
		nama = [r["name"] for r in execute({"company": self.pabrik})[1]]
		self.assertIn(dn, nama)
		lampirkan("Delivery Note", dn)
		self.assertNotIn(dn, [r["name"] for r in execute({"company": self.pabrik})[1]])

	def test_boot(self):
		bootinfo = frappe._dict()
		boot(bootinfo)
		self.assertIn("Sales Order", bootinfo.erp_lampiran["wajib"])
		self.assertEqual(bootinfo.erp_lampiran["nanti"], ["Delivery Note"])
```

- [ ] **Step 2: Run to verify they fail** — `run-tests --module erp_internal.tests.test_lampiran`. Expected: ImportError.

- [ ] **Step 3: Implement.** `cek_lampiran` raises `frappe.ValidationError` with `_("Attach a photo or scan of the
  real document before you submit.")` when `wajib(doc)` and not `ada_lampiran`. The report (Script Report, roles
  System Manager and `ERP Admin`, filter Company, Company permission checked like Order Readiness) lists, newest
  first, submitted documents of `WAJIB_LAMPIRAN` (with their condition) and `LAMPIRAN_NANTI` that have no File:
  columns Document Type (`doctype`), Document (`name`, Dynamic Link on `doctype`), Date (`tanggal`: posting or
  transaction date). `lampiran.js` registers a `refresh` handler per DocType of
  `frappe.boot.erp_lampiran` and calls `frm.set_intro(..., "orange")` while the form has no attachment (draft:
  "Attach a photo or scan of the real document before you submit."; submitted delivery note: "Attach the signed
  delivery note."). Add `lampirkan` before every submit of a covered DocType in tests and sample data.

- [ ] **Step 4: Run** `test_lampiran`, `test_alur_jual_beli`, `test_forecast`, `test_order_readiness`,
  `test_tampilan`, `test_contoh`. Expected: all OK. `bench build --app erp_internal`; open a new Sales Order as
  `admin@` and see the orange note.

- [ ] **Step 5: Commit** — `git commit -m "feat(lampiran): real documents attached before submit; Missing Documents report"`

---

### Task 6: Daily input, server side

> Deviation (as built): each block also carries `dibuat` (the order's creation date, the lower bound of "+ Add
> date", added in Task 8). Final review: a Completed order's cells stay editable (`STATUS_BISA_DIUBAH`).

**Files:**
- Modify: `erp_internal/planning/doctype/production_entry/production_entry.json` (field `technician` Data "Technician" after `hours`; `notes` `allow_on_submit` 1)
- Modify: `erp_internal/setup.py` (`JAM_SHIFT = {"Shift 1": "08.00-20.00", "Shift 2": "20.00-08.00"}` beside `SHIFT_PABRIK`; `PENGATURAN_PRODUKSI["overproduction_percentage_for_work_order"] = 10`)
- Create: `erp_internal/daily_input.py`
- Create: `erp_internal/tests/test_input_harian.py`
- Modify: CLAUDE.md (new row), `erp_internal/translations/id.csv`

**Interfaces:**
- Consumes: Task 2's rights (Produksi creates Production Entries, Admin reads), Task 3's `buat_wo`.
- Produces (`daily_input.py`):
  - `baca_jumlah(teks: str | int | float | None) -> int`: whole pieces; dots are thousands separators; empty → 0;
    a comma, a minus or other text raises `frappe.ValidationError`.
  - `minggu(tanggal: date) -> tuple[date, date]`: Monday and Sunday of that week.
  - `get_data(dari: str | None = None, sampai: str | None = None, work_order: str | None = None) -> dict`
    (whitelisted, GET): `{"dari", "sampai", "shift": [{"nama", "jam"}], "boleh_isi": bool, "teknisi":
    {shift: [names in the week]}, "teknisi_terakhir": {shift: name}, "blok": [blok]}` where `blok = {"work_order",
    "po_no", "qty", "uom", "item_code", "item_name", "merk", "warna", "kemasan": [{"uom", "isi"}], "mesin",
    "nomor_mesin", "status", "selesai", "boleh_isi", "baris": [{"tanggal", "nilai": {shift: int | None},
    "kunci": {shift: str | None}, "catatan"}], "total": {shift: int, "semua": int}}`; `kunci[shift]` is the first
    entry's name when the cell is not the grid's own (more than one entry, any reject, or `hours` other than
    `jam_shift(shift)`), else None. Which orders: section 4 of the spec.
  - `save_cell(work_order: str, tanggal: str, shift: str, qty: str, teknisi: str | None = None, catatan: str |
    None = None) -> dict` (whitelisted, POST): applies the cell rule, returns the order's `blok`.
  - `save_note(work_order: str, tanggal: str, catatan: str) -> dict` (whitelisted, POST): returns the `blok`.

- [ ] **Step 1: Write the failing tests** (`test_input_harian.py`)

```python
	def test_baca_jumlah(self):
		self.assertEqual(baca_jumlah("13.384"), 13384)
		self.assertEqual(baca_jumlah("13384"), 13384)
		self.assertEqual(baca_jumlah(""), 0)
		for salah in ("13,5", "-5", "abc", "1.2.3x"):
			with self.assertRaises(frappe.ValidationError):
				baca_jumlah(salah)

	def test_sel_baru(self):
		blok = save_cell(self.wo, str(self.kemarin), "Shift 1", "300", teknisi="Yudi")
		self.assertEqual(self.entri(self.kemarin, "Shift 1"), [(300, "Yudi")])
		self.assertEqual(blok["total"], {"Shift 1": 300, "Shift 2": 0, "semua": 300})

	def test_sel_diganti(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "300")
		save_cell(self.wo, str(self.kemarin), "Shift 1", "250")
		self.assertEqual([q for q, _t in self.entri(self.kemarin, "Shift 1")], [250])
		self.assertEqual(frappe.db.get_value("Work Order", self.wo, "produced_qty"), 250)

	def test_sel_dikosongkan(self):
		save_cell(self.wo, str(self.kemarin), "Shift 2", "300")
		save_cell(self.wo, str(self.kemarin), "Shift 2", "")
		self.assertEqual(self.entri(self.kemarin, "Shift 2"), [])

	def test_dua_kali_satu_entri(self):
		for _ in range(2):
			save_cell(self.wo, str(self.kemarin), "Shift 1", "300")
		self.assertEqual(len(self.entri(self.kemarin, "Shift 1")), 1)

	def test_sel_gagal_tetap_lama(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "300")  # order qty 1000, 10 % over allowed
		with self.assertRaises(frappe.ValidationError):
			save_cell(self.wo, str(self.kemarin), "Shift 1", "1200")
		self.assertEqual([q for q, _t in self.entri(self.kemarin, "Shift 1")], [300])

	def test_catatan(self):
		with self.assertRaises(frappe.ValidationError):
			save_note(self.wo, str(self.kemarin), "mesin panas")
		save_cell(self.wo, str(self.kemarin), "Shift 1", "300")
		save_cell(self.wo, str(self.kemarin), "Shift 2", "200")
		blok = save_note(self.wo, str(self.kemarin), "mesin panas")
		self.assertEqual(blok["baris"][0]["catatan"], "mesin panas")

	def test_blok(self):
		save_cell(self.wo_so, str(self.kemarin), "Shift 1", "1000")  # the whole order
		blok = next(b for b in get_data(str(self.kemarin), str(self.kemarin))["blok"] if b["work_order"] == self.wo_so)
		self.assertEqual(blok["po_no"], "039-NKP/EPP/DA/2026-11")
		self.assertTrue(blok["selesai"])
		self.assertEqual(blok["kemasan"], [{"uom": "Karton", "isi": 24}])

	def test_teknisi_minggu(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "10", teknisi="Yudi")
		save_cell(self.wo, str(self.kemarin), "Shift 2", "10", teknisi="Fadli")
		data = get_data(str(self.kemarin), str(self.kemarin))
		self.assertEqual(data["teknisi"], {"Shift 1": ["Yudi"], "Shift 2": ["Fadli"]})
		self.assertEqual(data["teknisi_terakhir"]["Shift 2"], "Fadli")

	def test_admin_tidak_bisa_isi(self):
		frappe.set_user(self.admin)
		self.assertFalse(get_data()["boleh_isi"])
		with self.assertRaises(frappe.PermissionError):
			save_cell(self.wo, str(self.kemarin), "Shift 1", "5")

	def test_order_tanpa_mesin(self):
		with self.assertRaisesRegex(frappe.ValidationError, "machine"):
			save_cell(self.wo_tanpa_mesin, str(self.kemarin), "Shift 1", "5")

	def test_sel_dari_form_terkunci(self):
		pe = buat_hasil(self.wo, good=50, rejects={"Bubble": 3}, posting_date=self.kemarin)
		baris = self.baris(self.wo, self.kemarin)  # test helper: that date's row of the block, from get_data
		self.assertEqual(baris["kunci"]["Shift 1"], pe.name)
		with self.assertRaisesRegex(frappe.ValidationError, "Production Entry form"):
			save_cell(self.wo, str(self.kemarin), "Shift 1", "60")
		self.assertEqual(frappe.db.get_value("Production Entry", pe.name, "docstatus"), 1)

	def test_mesin_diganti(self):
		save_cell(self.wo, str(self.kemarin), "Shift 1", "10")
		self.pindah_mesin(self.wo, self.mesin_b)
		save_cell(self.wo, str(self.hari_ini), "Shift 1", "10")
		self.assertEqual(self.mesin_entri(self.kemarin), self.mesin_a)
		self.assertEqual(self.mesin_entri(self.hari_ini), self.mesin_b)
```

Setup: `_Uji Pabrik`, an item with `{"Karton": 24}`, a BOM, material stock back-dated 30 days (`stok_awal(...,
tanggal=add_days(today(), -30))`), `self.wo = buat_wo(..., qty=1000)`, `self.wo_so` made from a Sales Order with
`po_no` "039-NKP/EPP/DA/2026-11" (attached first, Task 5), an order without machine, a Produksi user as the session
user, `self.admin` an Admin user; `self.hari_ini = getdate(today())`, `self.kemarin` the day before (dates relative
to `today()`, as CLAUDE.md asks, since a Production Entry refuses a future date).

`tests/utils.stok_awal` gains `tanggal: date | None = None`: the reconciliation's posting date (`set_posting_time`
1), so back-dated entries find stock.

- [ ] **Step 2: Run to verify they fail** — `run-tests --module erp_internal.tests.test_input_harian`. Expected: ImportError.

- [ ] **Step 3: Implement `daily_input.py`.**

`get_data` checks `frappe.has_permission("Work Order", "read", throw=True)`; `boleh_isi` is
`frappe.has_permission("Production Entry", "create")`. `save_cell` and `save_note` check Production Entry create,
submit and cancel (`throw=True`), lock the order with `frappe.db.get_value("Work Order", wo, "name",
for_update=True)`, refuse an order without `erp_mesin` (`_("No machine yet: Admin sets it on the Work Order.")`), a date
after today and a cell that is not the grid's own (`_("Change it in the Production Entry form.")`), then inside
`frappe.db.savepoint("input_harian")`: cancel the cell's submitted entry unless it already holds the new value,
and make one new entry when the value is above 0 (company, work order,
its machine, date, shift, `hours` from `jam_shift`, `good_qty`, `technician`, `notes`); on any exception roll back to
the savepoint and re-raise. A cell whose value and note are unchanged writes nothing.

- [ ] **Step 4: Run** `test_input_harian`, `test_hasil_produksi`, `test_plan_vs_actual`. Expected: all OK.

- [ ] **Step 5: Commit** — `git commit -m "feat(produksi): daily input server, one Production Entry per filled cell"`

---

### Task 7: Daily Input page

> Deviation (as built): "+ Add date" reads the block's `dibuat` instead of a `frappe.client.get_value` call; a
> completed block has no "+ Add date"; the layout tightens by a container query so both shifts fit 390 px.

**Files:**
- Create: `erp_internal/erp_internal/page/daily_input/` (`daily_input.json`: roles `ERP User`, Manufacturing User, Manufacturing Manager, System Manager; `daily_input.js`, small: loads the bundle and calls `erp.input_harian.pasang(wrapper)`; `__init__.py`)
- Create: `erp_internal/public/js/input_harian.bundle.js`; Modify: `erp_internal/public/css/erp_internal.css` (classes `.erp-ih-*`)
- Modify: `erp_internal/tampilan.py` (`MENU_ATAS = ("production-floor", "daily-input")`; `SIDEBAR["Manufacturing"]` and `PINTASAN["Manufacturing"]`: "daily-input" in place of "Production Entry"; `NAMA_LINK["daily-input"] = "Daily Input"`; `IKON_LINK["daily-input"] = "sheet"`, or another icon `test_ikon_ada` finds)
- Modify: `erp_internal/public/js/work_order.js` ("Record Output" → `frappe.set_route("daily-input")` with `frappe.route_options = {work_order}`)
- Modify: `erp_internal/translations/id.csv`, `tools/cek_layar.mjs`, `docs/panduan/produksi.md` ("Input harian" replaces "Catat hasil produksi"), `docs/panduan/user.md`, CLAUDE.md, `.claude/rules/tampilan.md`

**Interfaces:**
- Consumes: Task 6's `get_data`, `save_cell`, `save_note` (called with plain `fetch` and the CSRF token, never
  `frappe.call`, so a refusal shows on the cell without a dialog; see `.claude/rules/lantai.md`).
- Produces: route `daily-input` reading `frappe.route_options.work_order` (filter to one block).

- [ ] **Step 1: Write the failing test** (`test_tampilan.py`)

```python
	def test_halaman_input_harian(self):
		roles = {r.role for r in frappe.get_doc("Page", "daily-input").roles}
		self.assertEqual(roles, {"ERP User", "Manufacturing User", "Manufacturing Manager", "System Manager"})
		self.assertIn("daily-input", MENU_ATAS)
		self.assertIn("daily-input", SIDEBAR["Manufacturing"])
		self.assertNotIn("Production Entry", SIDEBAR["Manufacturing"])
```

- [ ] **Step 2: Run to verify it fails** — `run-tests --module erp_internal.tests.test_tampilan`. Expected: FAIL.

- [ ] **Step 3: Build the page** as the spec's section 4 sketch: header (week picker, Teknisi Pagi/Malam inputs
  filled from `teknisi_terakhir`, kept for the page's later saves), machine filter, one block per `blok` in his
  layout (No, Tanggal, Merk, Warna, Shift 1 and Shift 2 with `jam` under the name, Keterangan, TOTAL, machine cell,
  CLOSE/DONE), "+ Add date" (a date input limited to the order's creation date..today). Inputs only when
  `boleh_isi`; save on change (blur or Enter), Tab/Enter move to the next cell; a refusal puts the server's message
  under the cell (`textContent`) and keeps the typed number; numbers shown with dots. A cell with `kunci` shows its
  number read only with a link to that Production Entry; a block without machine shows its cells closed and "No
  machine yet: Admin sets it on the Work Order". Under 760 px Merk and Warna hide. Record text goes in by
  `textContent` only.

- [ ] **Step 4: Run** `test_tampilan` (all, including `test_rumah_sama_dengan_sidebar`, `test_ikon_ada`,
  `test_semua_teks_kita_diterjemahkan`). Expected: OK. `bench build --app erp_internal`, restart `bench start`,
  `bench --site erp.localhost clear-cache`.

- [ ] **Step 5: Browser check.** Extend `tools/cek_layar.mjs`: Produksi opens the page, types a number into an empty
  Shift 1 cell of a sample order and sees TOTAL change, then clears it again; Admin sees no input; screenshots at
  1440, 768 and 390 px wide with no horizontal page scroll. Run `ERP_SANDI=… node tools/cek_layar.mjs`. Expected:
  3 users OK.

- [ ] **Step 6: Commit** — `git commit -m "feat(produksi): Daily Input page in Samuel's Excel layout"`

---

### Task 8: Daily recap print and Excel

**Files:**
- Modify: `erp_internal/daily_input.py` (`WARNA_EXCEL`, `buku`, `export_excel`, `print_html`)
- Create: `erp_internal/templates/input_harian_cetak.html`
- Modify: `erp_internal/public/js/input_harian.bundle.js` (Print and Excel buttons), `erp_internal/translations/id.csv`, `tests/test_input_harian.py`, `docs/panduan/produksi.md`, `docs/panduan/admin.md`

**Interfaces:**
- Consumes: Task 6's `get_data` dict.
- Produces: `WARNA_EXCEL = {"no_po": "FCE4D6", "kepala": "9DC3E6", "total": "A9D08E", "mesin": "F2CEEF", "selesai":
  "FFFF00"}` (fills read off `input-harian.jpeg`; CLOSE/DONE text red `FF0000`, machine text red);
  `buku(data: dict) -> openpyxl.Workbook`; `export_excel(dari: str, sampai: str) -> None` (whitelisted; sets
  `frappe.response` filename `input-harian-<dari>-<sampai>.xlsx`, `filecontent`, `type` "binary");
  `print_html(dari: str, sampai: str) -> str` (whitelisted).

- [ ] **Step 1: Write the failing tests**

```python
	def test_excel_tata_letak(self):
		save_cell(self.wo_so, str(self.kemarin), "Shift 1", "400")
		ws = buku(get_data(str(self.kemarin), str(self.kemarin), work_order=self.wo_so)).active
		self.assertEqual(ws["A1"].value, "Tanggal")
		sel = {c.value: c for row in ws.iter_rows() for c in row if c.value}
		self.assertEqual(sel["No.Po. 039-NKP/EPP/DA/2026-11"].fill.fgColor.rgb[-6:], WARNA_EXCEL["no_po"])
		self.assertEqual(sel["Shift 1\n(08.00-20.00)"].fill.fgColor.rgb[-6:], WARNA_EXCEL["kepala"])
		self.assertEqual(sel["TOTAL"].fill.fgColor.rgb[-6:], WARNA_EXCEL["total"])
		self.assertIn(400, [c.value for c in ws[sel["TOTAL"].row]])

	def test_excel_kosong(self):
		ws = buku({**get_data(str(self.jauh), str(self.jauh)), "blok": []}).active
		self.assertEqual(ws["A1"].value, "Tanggal")
		self.assertEqual(ws.max_row, 3)  # Tanggal, Teknisi Pagi, Teknisi Malam

	def test_cetak(self):
		save_cell(self.wo_so, str(self.kemarin), "Shift 1", "1000")
		html = print_html(str(self.kemarin), str(self.kemarin))
		for teks in ("No.Po. 039-NKP/EPP/DA/2026-11", "TOTAL", "CLOSE/DONE", "08.00-20.00"):
			self.assertIn(teks, html)
```

- [ ] **Step 2: Run to verify they fail.** Expected: ImportError on `buku`.

- [ ] **Step 3: Implement.** One sheet, his header rows (Tanggal "dd.mm.yyyy - dd.mm.yyyy", Teknisi Pagi, Teknisi
  Malam), then per block: the No.Po. cell, "PO : 400.000 pcs", packing and per-sack text, the column header row, one
  row per date (dates `dd-Mon-yy` like his), TOTAL row with the grand total under Keterangan, the machine in a merged
  cell beside the rows, CLOSE/DONE above it when `selesai`, a blank row between blocks; number format `#,##0`
  (Excel shows his separators). `print_html` renders the template (A4 landscape `@page`) with the same data; the
  page's Print button opens it in a new window and calls `print()`; Excel downloads through
  `/api/method/erp_internal.daily_input.export_excel`.

- [ ] **Step 4: Run** `test_input_harian`. Expected: OK. Open both from the page as `admin@` and compare with
  `input-harian.jpeg`.

- [ ] **Step 5: Commit** — `git commit -m "feat(produksi): daily recap print and Excel in Samuel's layout"`

---

### Task 9: Monthly expenses

**Files:**
- Create: `erp_internal/planning/doctype/expense_category/` (json, py, `__init__.py`): field `category_name` (Data, unique, autoname `field:category_name`), `disabled`
- Create: `erp_internal/planning/doctype/expense_entry/` (json, py, `__init__.py`): submittable, autoname `EXP-.YYYY.-.#####`; fields `posting_date` (Date, reqd, Today), `category` (Link Expense Category, reqd), `amount` (Currency, reqd), `repeat` (Select `Once\nEvery month\nPer machine shift`, default Once, reqd), `until` (Date, `allow_on_submit`, `depends_on: eval:doc.repeat!='Once'`), `notes` (Small Text), `company` (Link Company, reqd, `depends_on: eval:!doc.company`), `amended_from`; permissions System Manager and `ERP Admin` (create, read, write, submit, cancel, amend, report, export, print)
- Create: `erp_internal/planning/report/monthly_expenses/` (json, py, js, `__init__.py`): roles System Manager, `ERP Admin`
- Modify: `erp_internal/setup.py` (`KATEGORI_BIAYA = ("Gaji Operator", "Gaji Karyawan Tetap", "Listrik", "Bensin", "Lainnya")`, `_kategori_biaya`), `erp_internal/lampiran.py` (`WAJIB_LAMPIRAN["Expense Entry"] = ("repeat", ("Once",))`), `erp_internal/tampilan.py` (`SIDEBAR["Buying"]`, `PINTASAN["Buying"]` + "Expense Entry", "Monthly Expenses"; `IKON_LINK`: `wallet`, `chart-column`), `id.csv`
- Create: `erp_internal/tests/test_biaya.py`
- Modify: CLAUDE.md, `docs/panduan/admin.md` (expenses, the operator wage entry at go-live)

**Interfaces:**
- Consumes: Production Entries (Task 6 writes them the usual way), `lampiran` (Task 5).
- Produces (`planning/report/monthly_expenses/monthly_expenses.py`):
  - `shift_mesin(company: str, dari: date, sampai: date) -> dict[str, dict]`: machine →
    `{"shift": int, "hari_24": int, "hari_12": int}` from distinct (workstation, posting_date, shift) of submitted
    Production Entries.
  - `jumlah(entri, awal: date, akhir: date, shift: Callable[[date, date], int]) -> float`: one entry's amount in
    the month `awal..akhir`.
  - `execute(filters) -> tuple[list, list]`: rows `{"kategori", "keterangan", "jumlah", "indent"}`, a Total row.

- [ ] **Step 1: Write the failing tests** (`test_biaya.py`)

```python
	def test_sekali(self):
		self.biaya("Listrik", 2_500_000, "Once", date(2026, 11, 5), lampir=True)
		self.assertEqual(self.bulan(date(2026, 11, 1))["Listrik"], 2_500_000)
		self.assertNotIn("Listrik", self.bulan(date(2026, 12, 1)))

	def test_sekali_wajib_lampiran(self):
		with self.assertRaisesRegex(frappe.ValidationError, "real document"):
			self.biaya("Bensin", 100_000, "Once", date(2026, 11, 5), lampir=False)

	def test_tiap_bulan_dan_sampai(self):
		e = self.biaya("Gaji Karyawan Tetap", 9_000_000, "Every month", date(2026, 9, 1))
		self.assertEqual(self.bulan(date(2026, 11, 1))["Gaji Karyawan Tetap"], 9_000_000)
		frappe.db.set_value("Expense Entry", e, "until", date(2026, 10, 15))  # allowed after submit
		self.assertNotIn("Gaji Karyawan Tetap", self.bulan(date(2026, 11, 1)))

	def test_per_shift_mesin(self):
		self.biaya("Gaji Operator", 105_000, "Per machine shift", date(2026, 11, 1))
		self.hasil(self.wo, date(2026, 11, 3), "Shift 1")
		self.hasil(self.wo, date(2026, 11, 3), "Shift 2")
		self.hasil(self.wo_lain, date(2026, 11, 3), "Shift 2")  # same machine, same shift: counted once
		self.hasil(self.wo, date(2026, 11, 4), "Shift 1")
		self.assertEqual(shift_mesin(self.pabrik, date(2026, 11, 1), date(2026, 11, 30))[self.mesin],
			{"shift": 3, "hari_24": 1, "hari_12": 1})
		self.assertEqual(self.bulan(date(2026, 11, 1))["Gaji Operator"], 3 * 105_000)

	def test_shift_ikut_mesin_entri(self):
		self.hasil(self.wo, date(2026, 11, 3), "Shift 1")
		self.pindah_mesin(self.wo, self.mesin_b)
		self.hasil(self.wo, date(2026, 11, 4), "Shift 1")
		s = shift_mesin(self.pabrik, date(2026, 11, 1), date(2026, 11, 30))
		self.assertEqual((s[self.mesin]["shift"], s[self.mesin_b]["shift"]), (1, 1))

	def test_tumpang_tindih_ditolak(self):
		self.biaya("Gaji Operator", 105_000, "Per machine shift", date(2026, 11, 1))
		with self.assertRaisesRegex(frappe.ValidationError, "End the earlier"):
			self.biaya("Gaji Operator", 110_000, "Per machine shift", date(2026, 12, 1))

	def test_batas_bulan(self):
		self.biaya("Gaji Karyawan Tetap", 1_000, "Every month", date(2026, 1, 31))
		self.assertEqual(self.bulan(date(2026, 2, 1))["Gaji Karyawan Tetap"], 1_000)
		e = self.biaya("Gaji Operator", 100, "Per machine shift", date(2026, 3, 1))
		frappe.db.set_value("Expense Entry", e, "until", date(2026, 3, 15))
		self.hasil(self.wo, date(2026, 3, 15), "Shift 1")
		self.hasil(self.wo, date(2026, 3, 16), "Shift 1")
		self.assertEqual(self.bulan(date(2026, 3, 1))["Gaji Operator"], 100)

	def test_hanya_admin(self):
		u = buat_pengguna("_uji.biaya.produksi@example.com", PRODUKSI, PRODUKSI, self.pabrik)
		self.assertFalse(frappe.has_permission("Expense Entry", "read", user=u))
		a = buat_pengguna("_uji.biaya.admin@example.com", ADMIN, ADMIN, self.pabrik)
		self.assertTrue(frappe.has_permission("Expense Entry", "submit", user=a))
```

`self.biaya(...)` inserts and submits (attaching first when `lampir`); `self.bulan(d)` runs `execute({"company":
self.pabrik, "bulan": d})` and maps category → amount (top rows only); `self.hasil` submits a Production Entry on
that date and shift (`buat_hasil(..., posting_date=…, shift=…)`).

- [ ] **Step 2: Run to verify they fail.** Expected: `DoesNotExistError` for the DocTypes.

- [ ] **Step 3: Implement.** Expense Entry `validate`: `until` empty for Once, not before `posting_date`;
  `before_submit` (and `before_update_after_submit` when `until` changes): another submitted Per machine shift entry
  of the same category whose period overlaps raises `_("End the earlier one first: {0}.")`. Report filters Company
  (default) and Month (a date; its month); Company permission checked; rows: one per category with an amount that
  month, under Per machine shift one indented row per machine ("12 shifts · 4 days 24 h · 4 days 12 h"), then Total.

- [ ] **Step 4: Run** `bench --site erp-test.localhost migrate`, then `test_biaya`, `test_lampiran`, `test_tampilan`.
  Expected: all OK.

- [ ] **Step 5: Commit** — `git commit -m "feat(biaya): Expense Entry and the Monthly Expenses report"`

---

### Task 10: Sales Order and Purchase Order print in Samuel's PO layout

**Files:**
- Create: `erp_internal/templates/po_samuel.html` (shared body), `erp_internal/erp_internal/print_format/po_samuel/po_samuel.json` (Sales Order) and `erp_internal/erp_internal/print_format/po_samuel_beli/po_samuel_beli.json` (Purchase Order), both Jinja, standard, including the template
- Create: `erp_internal/cetak.py` (`tanggal_panjang`, `FORMAT_CETAK`, used by setup); Modify: `erp_internal/hooks.py` (`jinja = {"methods": ["erp_internal.cetak.tanggal_panjang"]}`), `erp_internal/setup.py` (`_format_cetak`: Property Setter `default_print_format` per `FORMAT_CETAK`)
- Create: `erp_internal/tests/test_cetak.py`
- Modify: CLAUDE.md, `docs/panduan/penjualan.md`, `pembelian.md`

**Interfaces:**
- Produces: `cetak.FORMAT_CETAK = {"Sales Order": "PO Samuel", "Purchase Order": "PO Samuel Beli"}`;
  `cetak.tanggal_panjang(tanggal) -> str` ("27 November 2026", Indonesian month names: Januari … Desember).

- [ ] **Step 1: Write the failing tests** (`test_cetak.py`)

```python
	def test_tanggal_panjang(self):
		self.assertEqual(tanggal_panjang(date(2026, 11, 27)), "27 November 2026")
		self.assertEqual(tanggal_panjang(date(2026, 8, 1)), "1 Agustus 2026")

	def test_po_samuel(self):
		so = self.order(qty=400_000, rate=24, uom="Pcs", kirim=date(2026, 11, 27))  # attached and submitted
		html = frappe.get_print("Sales Order", so.name, print_format="PO Samuel")
		for teks in ("NO.", "ORDER", "QTY", "SATUAN", "TGL KIRIM", "HARGA", "400.000", "PCS",
				"27 November 2026", "@24/pcs", "Rp. 9.600.000,00"):
			self.assertIn(teks, html)

	def test_format_bawaan(self):
		for dt, nama in FORMAT_CETAK.items():
			self.assertEqual(frappe.get_meta(dt).default_print_format, nama)
```

- [ ] **Step 2: Run to verify they fail.** Expected: ImportError.

- [ ] **Step 3: Implement** the layout of `po.png`: blue header row (`#0D47A1`-like, white bold capitals), rows
  alternating light grey and white, ORDER = item name, QTY with dots and no decimals, SATUAN = UOM in capitals, TGL
  KIRIM = the line's `delivery_date` (Sales Order) or `schedule_date` (Purchase Order) via `tanggal_panjang`, HARGA =
  `"@" + rate without decimals when whole + "/" + uom in lower case`, red TOTAL box with `"Rp. " + grand total`
  (`#.###,##`). Header above: company logo and name, title "PURCHASE ORDER", number (Sales Order: the customer's PO
  number, else the document name), party, date.

- [ ] **Step 4: Run** `bench --site erp-test.localhost migrate`, `test_cetak`. Expected: OK. Print a sample order
  on `erp.localhost` and compare with `po.png`.

- [ ] **Step 5: Commit** — `git commit -m "feat(cetak): Sales and Purchase Order print in Samuel's PO layout"`

---

### Task 11: Pigment

> Deviation (as built): the rebuild is `_antre` after commit (cache flag `KUNCI_SEGARKAN_LAGI`) and `segarkan_bom`
> runs pass after pass until the flag stays clear; `pigmen_berubah` became `item_berubah` with `perlu_segarkan`
> (Task 13), which also shows an orange note when the pigment has no stock in Gudang Bahan Baku.

> **Amended 2026-11-23 17:06 (spec Addendum A1): pigment is stocked in grams, bought in kg.** Where this task
> says Kg for the pigment, read: stock UOM Gram (a UOM with `must_be_whole_number` 0; make it in setup if the
> site lacks one), UOM conversion Kg = 1000, `purchase_uom` Kg, Item Price per Kg in `Harga Bahan Baku`. The BOM
> line is in grams: `qty = round(flt(row.material_per_pcs) / 1000 * ratio, 6)` (material_per_pcs is in grams, so
> /1000 gives kg, × g per kg). The tests below change accordingly: `test_pigmen_per_warna` expects `(pg, 0.1)`,
> `test_rasio_berubah_bom_baru` `(pg, 0.15)`, `test_produksi_memakai_pigmen` stocks 1000 g and expects 950 g
> left. Add `test_beli_per_kg`: a Purchase Receipt (attached, Task 5) of 2 Kg of a pigment puts 2000 g in stock.

**Files:**
- Modify: `erp_internal/setup.py` (`GRUP_BARANG` + "Pigmen", `GUDANG_GRUP["Pigmen"] = "Gudang Bahan Baku"`, `FIELD_PIGMEN` on Item in `_field_aktif`: `erp_rasio_pigmen`, Float, "Pigment Ratio (g per kg)", default 1, `depends_on: eval:doc.variant_of=='PIGMEN'`, after `item_group`)
- Modify: `erp_internal/penjualan.py` (`_pigmen(hasil)`: the "PIGMEN" template, group Pigmen, Kg, variants on `Warna`, called in `muat` after `_bahan`)
- Modify: `erp_internal/planning/kapasitas.py` (`TEMPLATE_PIGMEN = "PIGMEN"`, `ATRIBUT_WARNA = "Warna"`, `pigmen`, `baris_bom(row, item=None)`, `buat_bom_kapasitas` passes the item, `cek_pigmen`, `pigmen_berubah`, `segarkan_bom`), `erp_internal/hooks.py` (Item `validate`: `cek_pigmen`; `on_update`: `pigmen_berubah`)
- Modify: `erp_internal/tests/test_bom_kapasitas.py`, `test_penjualan.py`, `erp_internal/translations/id.csv`
- Modify: CLAUDE.md, `docs/impor.md`, `docs/panduan/pembelian.md` (buying pigment), `docs/panduan/produksi.md` (the BOM line), `docs/menunggu-samuel.md` (pigment list asked)

**Interfaces:**
- Produces:
  - `kapasitas.pigmen(item: str) -> tuple[str, float] | None`: (pigment item, ratio) of the variant's `Warna`, from
    an enabled `PIGMEN` variant with that `Warna`.
  - `kapasitas.baris_bom(row, item: str | None = None) -> list[dict]`: today's lines, plus `{"item_code": pigment,
    "qty": round(flt(row.material_per_pcs) / 1000 * ratio / 1000, 6)}` when `pigmen(item)`.
  - `kapasitas.segarkan_bom() -> int`: `buat_bom_kapasitas` for every enabled Machine Capacity row; returns how
    many rows it ran.
  - `kapasitas.pigmen_berubah(doc, method=None)`: for a `PIGMEN` variant that is new or changed `erp_rasio_pigmen`
    or `disabled`, `frappe.enqueue("erp_internal.planning.kapasitas.segarkan_bom", enqueue_after_commit=True,
    job_id="erp_segarkan_bom", deduplicate=True, now=frappe.in_test)`.
  - `kapasitas.cek_pigmen(doc, method=None)`: a `PIGMEN` variant's ratio must be above 0.

- [ ] **Step 1: Write the failing tests** (`test_bom_kapasitas.py`)

```python
	def test_pigmen_per_warna(self):
		merah, bening = buat_varian("_UJI-PG-GAYUNG", ["Super"], ["Merah", "Bening"])
		pg = self.pigmen("Merah", rasio=2)
		baris = buat_kapasitas("_UJI-PG-GAYUNG", self.mesin, material=self.bahan, part_weight=50, runner_weight=0)
		buat_bom_kapasitas(baris)
		self.assertIn((pg, 0.0001), self.isi_bom(merah))  # 50 g = 0.05 kg x 2 g/kg = 0.1 g
		self.assertNotIn(pg, [k for k, _q in self.isi_bom(bening)])

	def test_rasio_berubah_bom_baru(self):
		merah, = buat_varian("_UJI-PG-GAYUNG", ["Super"], ["Merah"])
		pg = self.pigmen("Merah", rasio=1)
		buat_bom_kapasitas(buat_kapasitas("_UJI-PG-GAYUNG", self.mesin, material=self.bahan, part_weight=50, runner_weight=0))
		frappe.get_doc("Item", pg).update({"erp_rasio_pigmen": 3}).save()  # rebuilds now under tests
		self.assertIn((pg, 0.00015), self.isi_bom(merah))

	def test_rasio_nol_ditolak(self):
		with self.assertRaises(frappe.ValidationError):
			self.pigmen("Biru", rasio=0)

	def test_produksi_memakai_pigmen(self):
		merah, = buat_varian("_UJI-PG-GAYUNG", ["Super"], ["Merah"])
		pg = self.pigmen("Merah", rasio=1)
		buat_bom_kapasitas(buat_kapasitas("_UJI-PG-GAYUNG", self.mesin, material=self.bahan, part_weight=50, runner_weight=0))
		stok_awal(self.pabrik, pg, 1, "Gudang Bahan Baku")
		stok_awal(self.pabrik, self.bahan, 100, "Gudang Bahan Baku")
		buat_hasil(buat_wo(merah, self.mesin, qty=1000), good=1000)
		self.assertAlmostEqual(self.stok(pg, "Gudang Bahan Baku"), 1 - 0.05)
```

`self.pigmen(warna, rasio)` gets or creates the `PIGMEN` template (as `penjualan._pigmen` does) and its variant for
`warna`, setting `erp_rasio_pigmen`; `self.isi_bom(item)` is `_isi_bom` of the item's default capacity BOM. In
`test_penjualan.py`: `penjualan.muat` makes the template "PIGMEN" (group Pigmen, Kg, `has_variants`, attribute
`Warna`) and a second run writes nothing.

- [ ] **Step 2: Run to verify they fail.** Expected: FAIL (no pigment line).

- [ ] **Step 3: Implement** as the Interfaces above. `buat_bom_kapasitas` computes `isi` per item with
  `baris_bom(row, item)` (today it uses `baris_bom(row)` for all). `segarkan_bom` runs as the user who saved the
  pigment (Admin has the BOM rights `buat_bom_kapasitas` checks).

- [ ] **Step 4: Run** `bench --site erp-test.localhost migrate`, `test_bom_kapasitas`, `test_penjualan`,
  `test_mesin_barang`, `test_kapasitas`. Expected: all OK.

- [ ] **Step 5: Commit** — `git commit -m "feat(kapasitas): pigment per colour in the capacity BOMs"`

---

### Task 12: Sample data, guides and the full check

> Deviation (as built): the access PDF was not regenerated (no tool or source in the repo; the old one is gone).

> **Order amended 2026-11-23 17:06:** run Tasks 13 and 14 (below) before this one. This task's sample data also
> gets packing (two packing items, packing rows on the sample products, stock and prices) and the Seal Cap
> brands are loaded by `master.muat`; `test_contoh_baru` also asserts a capacity BOM with a packing line. Its
> full check includes an end-to-end browser run (Playwright) of each profile's main flow: Produksi types a day in
> Daily Input; Admin makes a Work Order on a listed machine, a Sales Order with an attachment, a delivery note
> from Pluit, an expense, and opens Monthly Expenses and Missing Documents.

**Files:**
- Modify: `erp_internal/contoh.py` (a week of daily input through `daily_input.save_cell` with technicians "Yudi" and "Fadli"; a Material Transfer to Gudang Pluit and a delivery note from it, attached; two pigments `PIGMEN` Merah and Biru with stock and price in `Harga Bahan Baku`; expense entries: Gaji Operator 105.000 Per machine shift from the first sample production day, Gaji Karyawan Tetap Every month, Listrik and Bensin Once with attachments), `DIBUAT` (+ Expense Entry, Delivery Note), `erp_internal/tests/test_contoh.py`
- Modify: `tools/panduan_gambar.mjs` and the guide pictures in `docs/panduan/gambar/`, the access PDF `Hak-Akses-ERP-Delta-Anugrah-revisi.pdf` (regenerated the way PROGRESS 2026-11-02 records), README ("Make commands" untouched; the feature list), CLAUDE.md (status paragraph, test count), `docs/menunggu-samuel.md` (rows 1-5 and 7 done, the open asks: full PO, pigment list), `docs/TODO.md`, `docs/PROGRESS.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the failing test** (`test_contoh.py`)

```python
	def test_contoh_baru(self):
		buat_contoh()
		self.assertTrue(frappe.db.count("Production Entry", {"technician": "Yudi", "docstatus": 1}))
		self.assertTrue(frappe.db.exists("Expense Entry", {"repeat": "Per machine shift", "amount": 105000, "docstatus": 1}))
		self.assertTrue(frappe.db.exists("Delivery Note", {"set_warehouse": ("like", "Gudang Pluit%"), "docstatus": 1}))
		self.assertEqual(frappe.db.count("Item", {"variant_of": "PIGMEN", "disabled": 0}), 2)
```

- [ ] **Step 2: Run to verify it fails**, then **Step 3: implement** the sample data (idempotent; `test_dua_kali_sama`
  and `test_hari_berikutnya` must stay green).

- [ ] **Step 4: The full check (`/run-checks`):** migrate both sites; `bench --site erp-test.localhost run-tests
  --app erp_internal` (report the count); `ruff check erp_internal && ruff format --check erp_internal` (through
  `uvx` if ruff is not on PATH); `bench build --app erp_internal`; on `erp.localhost` `execute
  erp_internal.contoh.buat_contoh`; `ERP_SANDI=… node tools/cek_layar.mjs`; `node tools/lantai.mjs` only if the
  Production Floor changed; the attribution check; then the `docs-sync` agent with the changed files.

- [ ] **Step 5: Commit** — `git commit -m "docs: guides, sample data and checks for Samuel's 2026-11-23 requests"`

---

### Task 13: Packing used up through the capacity BOM, and pigment/packing in Monthly Expenses

> Deviation (as built): packing items are stocked in UOM Buah (fractional, `setup.SATUAN_KEMASAN`); `cek_kemasan`
> refuses 0 pieces and a whole-number UOM; a reject's Repack takes no packing line and no line that rounds to 0.

Added 2026-11-23 17:06 (spec Addendum A2, A3). Runs after Task 11, before Task 12.

**Files:**
- Create: `erp_internal/planning/doctype/item_packing/` (child DocType "Item Packing", `istable`: `packing_item`
  Link Item reqd, filtered to group Kemasan in the form; `pieces` Int reqd, more than 0, label "Pieces per Packing")
- Modify: `erp_internal/setup.py` (`GRUP_BARANG` + "Kemasan", `GUDANG_GRUP["Kemasan"] = "Gudang Bahan Baku"`;
  custom Item field `erp_kemasan`, Table "Item Packing", label "Packing", after the pigment ratio field, shown
  only when `has_variants` or `variant_of` or the item is a finished product, your call how, not on Kemasan or
  Pigmen items)
- Modify: `erp_internal/planning/kapasitas.py` (`GRUP_KEMASAN = "Kemasan"`, `kemasan(item) -> list[tuple[str,
  int]]`: the variant's rows, else its template's; `baris_bom(row, item)` adds `{"item_code": packing_item, "qty":
  round(1 / pieces, 9)}` per row; the Item `on_update` hook rebuilds capacity BOMs (`segarkan_bom`, the same
  dedup job) when a product's packing rows change or a Kemasan item is enabled/disabled)
- Modify: `erp_internal/planning/report/monthly_expenses/monthly_expenses.py` (`BIAYA_STOK = {"Pigmen":
  "Pigmen", "Kemasan": "Kemasan"}`: report row label → Item Group; `pemakaian(company, awal, akhir) -> dict[str,
  float]`: minus the sum of `stock_value_difference` of submitted Stock Ledger Entries in the month whose item is
  in that group and whose voucher is a Stock Entry named in a submitted Production Entry's `manufacture_entry` or
  `reject_entry`; rows only when not 0; included in Total)
- Modify: `erp_internal/tests/test_bom_kapasitas.py`, `test_biaya.py`, `erp_internal/translations/id.csv`
- Modify: CLAUDE.md, `docs/panduan/pembelian.md` (buying packing), `docs/panduan/produksi.md` (the BOM's packing
  lines), `docs/panduan/admin.md` (setting a product's packing; Monthly Expenses' Pigmen and Kemasan rows)

**Interfaces:**
- Produces: `kapasitas.GRUP_KEMASAN`, `kapasitas.kemasan(item)`, `monthly_expenses.BIAYA_STOK`,
  `monthly_expenses.pemakaian(company, awal, akhir)`.

- [ ] **Step 1: Write the failing tests**

```python
	# test_bom_kapasitas.py
	def test_kemasan_di_bom(self):
		merah, = buat_varian("_UJI-KM-GAYUNG", ["Super"], ["Merah"])
		plastik = self.kemasan("_UJI Plastik isi 560")
		self.isi_kemasan("_UJI-KM-GAYUNG", plastik, 560)  # on the template: the variant inherits it
		buat_bom_kapasitas(buat_kapasitas("_UJI-KM-GAYUNG", self.mesin, material=self.bahan, part_weight=50, runner_weight=0))
		self.assertIn((plastik, round(1 / 560, 9)), self.isi_bom(merah))

	def test_kemasan_berubah_bom_baru(self):
		# changing the template's pieces rebuilds the BOM now under tests (same job as the pigment)
		...

	# test_biaya.py
	def test_pemakaian_pigmen_kemasan(self):
		# a product whose capacity BOM has a pigment and a packing line; stock both with a valuation rate;
		# one Production Entry in Nov 2026; the November report has rows Pigmen and Kemasan equal to the value
		# used (qty used x valuation rate), in Total; December has neither.
		...
```

- [ ] **Step 2: Run to verify they fail.** **Step 3: Implement.** **Step 4: Run** `bench --site erp-test.localhost
  migrate`, `test_bom_kapasitas`, `test_biaya`, `test_tampilan`, `test_hasil_produksi`. **Step 5: Commit** —
  `git commit -m "feat(kapasitas): packing per product in the capacity BOMs; pigment and packing in Monthly Expenses"`

---

### Task 14: Seal Cap brand codes and their mould inserts

Added 2026-11-23 17:06 (spec Addendum A4, picture `docs/superpowers/specs/2026-11-23-samuel/insert-epp.png`).
Runs after Task 13, before Task 12.

**Files:**
- Create: `erp_internal/data/merek_epp.json`: `[{"merk": "APP", "insert": 20, "ket": ""}, ...]`, the 21 rows of
  the picture in its order: APP 20, BEN 20 "1 pc ada bautnya", DBI 18 "2 pcs dibawa pa Udin", GIL 20, GJP 20,
  JAKPRO 20, JUP 20, MTI 20, NDY 20, NKP 21, PAS 20, PPN 20, PT CN 20, PWP 20, SAS 20, SBU 20, SKI 20, SMP 20,
  THP 20, TSE 20, ZPU 20
- Modify: `erp_internal/setup.py` (custom Brand field `erp_jumlah_insert`, Int, label "Inserts (pcs)", after
  `brand`), `erp_internal/master.py` (`_merek()` in `muat`: a Brand per row, `erp_jumlah_insert` and
  `description` set only when the Brand is new), `erp_internal/tampilan.py` (Brand in Stock's sidebar for Admin
  if it is not reachable today; check `test_rumah_sama_dengan_sidebar` and the 12-shortcut cap)
- Modify: `erp_internal/tests/test_master.py` (or the module that tests `master.muat`), `id.csv`
- Modify: CLAUDE.md (master.py row), `docs/impor.md`, `docs/menunggu-samuel.md` (row 6: brand codes received
  with the insert counts, customer EPP; still waiting: machines Rp23/Rp24, colours, pcs per pack and sack)

- [ ] **Step 1: failing test** `test_merek_epp`: after `master.muat`, 21 Brands from the file, NKP has
  `erp_jumlah_insert` 21 and DBI's description "2 pcs dibawa pa Udin"; set NKP to 19, run `muat` again, NKP
  stays 19. **Steps 2-4** as usual (`test_master`, `test_tampilan`). **Step 5: Commit** —
  `git commit -m "feat(master): Seal Cap brand codes with their mould inserts"`

---

### Task 15: Missing data notices (Abel 2026-11-24)

Added and built 2026-11-24 (spec Addendum A5). Abel: users must see what is not set up yet; decision: orange notes on
the forms concerned plus one report for Admin, and every notice links straight to its fix.

**Files:** `erp_internal/kelengkapan.py` (table `CEK`: packing, pigment per colour, selling price, Gaji Operator
expense, machine capacity, pigment/packing stock; `untuk_item`, `untuk_produksi`, `pesan_gaji`),
`erp_internal/public/js/kelengkapan.js` (notes and fix links), report `planning/report/missing_data/` (Settings,
Admin), `monthly_expenses.py` (message), `tampilan.py`, `id.csv`, `tests/test_kelengkapan.py`.

**Deviations:** the Sales Order note is computed client side (lines at rate 0, no server call);
`WARNA_TANPA_PIGMEN` (Bening, Bening Transparan, Campur; Neutral added in Task 16) are not flagged; Monthly Expenses `execute` returns three
values (columns, rows, message); the report shows How to fix before What happens; the stock fix opens a Purchase
Order. Commit: `feat(kelengkapan): notices and a Missing Data report for incomplete set-up`.

### Task 16: Seal Cap line (item 6, Samuel 2026-11-24)

Added and built 2026-11-24 (spec Addendum A6), from Samuel's table `2026-11-23-samuel/seal-cap-epp.png` and his WhatsApp.

**Files:** `erp_internal/seal_cap.py` (`muat`, `HARGA_MESIN`, `harga`, `harga_mesin`, `mesin_dari_so`),
`erp_internal/data/seal_cap.json`, `master.py` (calls `seal_cap.muat`; Warna abbreviations CKM, PTH, NTR),
`data/mesin.json` (Mesin 14 active), `penjualan.py` (`daftar_beli`), `setup.py` (`FIELD_SO_MESIN`), `hooks.py`
(Sales Order `before_validate`, Work Order `before_validate`, `doctype_js` Sales Order), `public/js/sales_order.js`,
`kelengkapan.py` (Neutral; no selling-price check for `HARGA_MESIN` templates), `daily_input.py` (Merk column),
`templates/po_samuel.html`, `id.csv`, `tests/test_seal_cap.py`, `tests/test_mesin_barang.py`.

**Deviations:** the machine prices live in `HARGA_MESIN` (code), not in `seal_cap.json`; a line on a machine
outside the table is refused too ("{0} has no price on {1}. Machines: {2}"); the rate is set on the server in
`before_validate` (so ERPNext's totals follow) and in the form when the machine is picked; the variants, packing
items, pigments, prices and customer are only created, never corrected (Admin keeps them); the Missing Data
selling-price check skips `HARGA_MESIN` templates (their price is by machine); Daily Input's Merk reads the `Merk`
attribute first, since a template save copies the template's (empty) brand over its variants'. Pigments that already
had a price in `Harga Bahan Baku` keep it (the spec says every pigment; the brief says only without a price).
Commit: `feat(seal-cap): Seal Cap items, price by machine, packing and pigment from Samuel's table`.
Folded in (Samuel 2026-11-24, via the coordinator): cavities 20 and cycle time 14 s (he said 13-14 s; the slower
figure keeps targets honest) in `seal_cap.json` `kapasitas` for Mesin 04 and 14; `seal_cap._kapasitas` makes the
Machine Capacity rows and their BOMs only once `part_weight` and `material` are filled in there (tests for both
cases).
Then part weight 0.88 per piece (read as grams, Samuel 2026-11-24, to be confirmed) and runner 0 in the same
block; only the material is missing, so the rows still wait for it.

Review fixes (2026-11-24, commit "fix(seal-cap): price locked after submit; variants keep no copied brand"):
Sales Order `before_update_after_submit` `harga_terkunci` refuses Update Items that leaves a Seal Cap line off its
machine's price; `harga_mesin` also clears margin and pricing rules (an order-level discount still applies); the
variants carry no Brand (the code is the Merk attribute; Item Variant Settings untouched; erp.localhost cleared
once); `sales_order.js` also reacts to item, UOM and conversion factor; guides: order discount, Production Plan.

Material (Samuel 2026-11-24 16:40, commit "feat(seal-cap): Seal Cap material and capacity rows"): new raw
material `BB-SEAL-CAP` "Bahan Seal Cap" (Bahan Baku, Kg, 13.500/kg; "category sendiri" read as its own item, not
an Item Group) from `seal_cap.json` `bahan` (`seal_cap._bahan`, only when missing); `kapasitas.material` set, so
`muat` makes the two Machine Capacity rows and their 34 capacity BOMs.
