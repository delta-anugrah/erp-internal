# Progress log

Newest first. One entry per working session: what changed, test results as run, what is next.

## 2026-11-25, module home cards
- Abel: the module homes looked empty (one short row of small shortcuts). Each shortcut is now a taller card: the
  link's sidebar icon in a soft Delta-blue square and the count on top, then the title and one line saying what it
  is for (`tampilan.KETERANGAN`, Indonesian in `id.csv`), sent with the icon in boot `erp_pintasan`
  (`menu_samping`) and drawn by `public/js/pintasan.js` (wraps Frappe's shortcut widget; falls back to the plain
  card on any error), CSS `.erp-kartu`. Titles wrap instead of being cut at 768 px; phones drop the minimum height.
- `cek_layar` now fails on a home shortcut without its card icon or line (pintasan.js falls back silently) and
  names it. It caught Super Admin's Expense Entry and Machine Capacity: they sit bare in Planning's own sidebar,
  which overwrote their icon; `erp_pintasan` now keeps the first icon found (else `IKON_LINK`), and
  `test_kartu_pintasan` checks Admin and Super Admin on Stock, Buying and Manufacturing.
- Checked: screenshots at 1440, 768 and 390 px (Admin Stock and Selling, Produksi Manufacturing), no console error;
  `test_tampilan` 27 OK, `test_kartu_pintasan` OK after the fix, `test_bahasa` 6 OK; `cek_layar` 3 users OK; full
  run 386 (13 unit + 373 integration) OK; ruff clean.

## 2026-11-25, Seal Cap packing prices
- Samuel 2026-11-25: Plastik 35x50 and Plastik 30x45 500 per piece (both sizes the same), Karung 3.500.
  `seal_cap.json` `harga_kemasan`; `seal_cap.muat` sets each as the item's valuation rate (when 0) and as an Item
  Price per Buah in `Harga Bahan Baku` (when missing), so a purchase or receipt of packing starts at that price and
  the Monthly Expenses' Kemasan row (stock value used) follows it. A price
  Admin changed stays (`test_harga_kemasan_admin_tetap`).
- `master.muat` on erp.localhost: first run wrote 7, second 0; the three prices and valuations are in.
- Tests as run: `test_seal_cap` 21 OK; full run 385 (13 unit + 372 integration) OK.
- Next: Abel's manual test from the guide; Samuel's confirmations.

## 2026-11-24, PR #11 merged; browser check of the guide
- PR #11 (Tasks 1-16) merged into `main` as `2b4a7d0` after CI "Tes" passed on `83d5b92` and Abel's approval.
- On erp.localhost, as run: `tools/e2e_samuel.mjs` 15/15, `tools/cek_layar.mjs` 3 users OK. A one-off browser run
  (admin@ and user@) of the guide's Seal Cap and Missing Data steps, all as expected: Seal Cap SKI Biru on Mesin 04
  → 24, Mesin 14 → 23, no machine refused; `SAL-ORD-2026-00009` submitted, PO Samuel print shows Mesin 04;
  `MFG-WO-2026-00018` made from it takes Mesin 04 and BOM `BOM-SEAL-CAP-SKI-BRU-001`; Material Receipt
  `MAT-STE-2026-00278` (BB-SEAL-CAP, PIGMEN-BRU, Plastik 35x50, Karung); Produksi typed 1.000 in Daily Input:
  stock +1.000 Seal Cap, -0,88 Kg material, -13,2 g pigment, -1 bag, -0,05 sack. Missing Data fix link opens the
  Packing table; BASKOM-20 note; Sales Order line CTH-BASKOM-40 shows "has no selling price" with its link;
  Produksi can open neither Missing Data nor Sales Orders. These documents stay on erp.localhost.
- Guide artifact (manual book, 31 steps incl. Seal Cap and Missing Data) updated for Abel's manual test.
- Next: Abel's manual test from the guide; Samuel's confirmations (`docs/menunggu-samuel.md`).

## 2026-11-25, CI: database snapshot dropped
- Measured on GitHub after PR #12: "Foto" made the snapshot (1.05 MB) with the erpnext + hrms site install taking
  about 1.5 min on the runner (10 min on the busy Mac). PR #12's "Tes" took 28 min (build 10 with cache, site and
  tests 15), against 40 for the first run. The snapshot would save about 1 min a pull request and cost a job on
  every merge, so `ci.yml` and `deploy/ci_tes.sh` are back to the PR #11 versions (comment notes why).
- Local image `erp-internal:ci` and the Actions cache entry removed.

## 2026-11-25, CI: database snapshot for pull requests
- `deploy/ci_tes.sh` `FOTO=<dir>`: the test site starts from `<dir>/dasar.sql.gz` (frappe, erpnext, hrms installed)
  and installs only erp_internal; without it the site is made in full and the snapshot written first
  (`HANYA_FOTO=1` stops there). `ci.yml` job "Foto" (push to main) makes it once per `versi.json` + `ci_tes.sh`
  and saves it to the Actions cache; "Tes" on a pull request restores it; a tag always installs from scratch.
- Local, as run: actionlint and shellcheck clean; snapshot 1.1 MB in 10.5 min; tests from it 367 OK. Site setup went
  from about 15.5 to about 5 min, but the whole run was 1820 s against 1795 s before, because the tests themselves
  took 1530 s against 863 s: the Mac was busy (load average 8-11, another session's bench running), so the local
  timing is not a fair comparison. To measure on GitHub after the merge (the snapshot exists only once "Foto" ran on
  main).

## 2026-11-24, CI: `image.yml` replaced by `ci.yml`
- `.github/workflows/ci.yml`, one job "Tes": a pull request to main runs ruff 0.17.6, builds the image (GHCR registry
  cache `:buildcache`), `check_image.sh` and the new `deploy/ci_tes.sh` (all tests in the image, own MariaDB and
  Redis); drafts and docs-only pull requests skip the work. A `vX.Y.Z` tag must be on main and equal `__version__`,
  then the same build, check and tests, then the push to GHCR. No deploy from CI.
- Local, as run: actionlint and shellcheck clean; `uvx ruff@0.17.6` clean; `docker build` (arm64, no cache) about
  45 min; `deploy/check_image.sh erp-internal:ci` OK; `deploy/ci_tes.sh erp-internal:ci` 367 tests OK in 863 s,
  30 min in all (the new site with erpnext and hrms takes about 15 min).
- Not yet run on GitHub. Next: first pull request run (note its minutes), then Abel makes "Tes" a required check on
  main and limits `v*` tags to admins.

## 2026-11-24, Task 16: the Seal Cap line (item 6, spec A6)
- `seal_cap.py` + `data/seal_cap.json` (Samuel's table of 2026-11-24), loaded by `master.muat`: Item Attribute
  `Merk`, template `SEAL-CAP` with 17 variants (`SEAL-CAP-MHG-CKM` ...; the code is the Merk attribute, no Brand on the variants), Brands MHG, SE, RPE, CN,
  packing items Plastik 35x50, Plastik 30x45, Karung and two Packing rows per variant, `PIGMEN` Coklat Muda, Hijau,
  Pink, Putih, Coklat (ratio 1) and 350.000/Kg for pigments without a price in Harga Bahan Baku, customer
  PT. Empat Putra Pangestu. Mesin 14 active.
- Price by machine: `HARGA_MESIN` (Mesin 04 Rp24, Mesin 14 Rp23); Sales Order Item `erp_mesin`, set in the form
  (`public/js/sales_order.js`) and on save (`before_validate`), refused without a machine of the table; a Work Order
  from the line takes the machine; PO Samuel prints " - Mesin 04" in red. Neutral needs no pigment; Missing Data
  skips the selling-price check for Seal Cap; Daily Input's Merk reads the `Merk` attribute.
- erp.localhost: `master.muat` wrote 39 records, the second run 0.
- Tests as run: `test_seal_cap` 15 OK (red first: import error); `run-tests --app erp_internal` 379 (13 unit + 366 integration)
  OK (first run: `test_mesin_barang.test_bom` failed, its BOM now has the Biru pigment line: test updated; after the
  0.88 g weight only `test_seal_cap` rerun, 15 OK); ruff clean;
  `bench build` + clear-cache; browser check as admin@ (Sales Order for EPP, Seal Cap MHG on Mesin 04: rate 24 in the
  form and after save, 480.000; print "Seal Cap MHG Coklat Muda - Mesin 04" in red; 1440/768/390 px; draft deleted);
  `cek_layar` 3 users OK.
- Cavities 20, cycle time 14 s (Samuel 13-14 s), part weight 0.88 g (to be confirmed), runner 0 stored in
  `seal_cap.json` `kapasitas`; `muat` makes the Machine Capacity rows on Mesin 04 and 14 (and their BOMs) once
  `material` is filled in too.
- Review fixes: Update Items after submit cannot change a Seal Cap price (`harga_terkunci`), margin and pricing
  rules cleared, no Brand on the variants (cleared once on erp.localhost), the form also reacts to item and UOM.
  `test_seal_cap` 16 OK; `run-tests --app erp_internal` 380 (13 unit + 367 integration) OK; browser check rerun OK.
- Material (Samuel 16:40): `BB-SEAL-CAP` "Bahan Seal Cap", Bahan Baku, Kg, 13.500/kg in Harga Bahan Baku ("category
  sendiri" read as its own item, not a new Item Group); 0.88 g confirmed. `muat` now makes the Machine Capacity rows
  on Mesin 04 and 14 (5.142,86 pcs/hour) and 34 capacity BOMs (material 0.00088 kg, the colour's pigment 0.00088 g,
  bag and sack per their pieces). erp.localhost: `master.muat` wrote 39, then 0; a Seal Cap Work Order on Mesin 04
  (BOM-SEAL-CAP-MHG-CKM-001) submitted through bench, then cancelled and deleted. `test_seal_cap` 19 OK; `run-tests --app erp_internal` 383 (13 unit + 370
  integration): 382 OK, `test_mesin_barang.test_jumlah` failed (Mesin 14 now has a capacity row: expected list
  updated), module rerun 8 OK; ruff clean.
- After 2033cab the controller ran the full suite: 383 (13 unit + 370 integration), all OK. Docs sync (Neutral in
  every colour list, item 6 marked built, the after-submit price lock in spec A6, admin guide "Merek atau warna Seal
  Cap baru", stock note in gudang/produksi). Missing Data on erp.localhost now: 23 packing, 6 colours, 20 prices,
  7 capacity, 0 wage, 8 stock. `lantai.mjs` rerun after Mesin 14 became active: all OK (disabled machines restored).
- Next: Samuel confirms "category sendiri"; stock of BB-SEAL-CAP, the new pigments and packing before output.

## 2026-11-24, Task 15: missing data notices (Abel)
- `kelengkapan.py`: one table `CEK` (packing, pigment per colour, selling price, Gaji Operator expense, machine
  capacity, pigment/packing stock), each row with a fix the desk opens (`public/js/kelengkapan.js`, Abel: every
  notice links straight to its fix). Report Settings → Missing Data (Admin); orange notes on Item, Sales Order (draft),
  Work Order (open) and the Monthly Expenses message. `WARNA_TANPA_PIGMEN`: Bening, Bening Transparan, Campur (Neutral added in Task 16).
- erp.localhost now: 23 products without packing, 9 colours without a pigment, 20 products without a price in Harga
  Pola 2026 (the `CTH-` sample products sit on their own list), 7 without machine capacity, wage and stock 0.
- Tests as run: `test_kelengkapan` 15 OK (red first: import error); `run-tests --app erp_internal` 364 (13 unit + 351
  integration) OK; ruff clean; `cek_layar` 3 users OK; browser check as admin@ at 1440 and 390 px (report links,
  packing and pigment links, Item and Sales Order notes, Item Price and Purchase Order prefills) OK.
- Next: Samuel's pigment and packing lists clear most rows.

## 2026-11-23, final review fixes (Samuel's 2026-11-23 requests)
- Daily Input: a Completed order's cells stay editable for Produksi (`STATUS_BISA_DIUBAH`; the cancel reopens the
  order), no "+ Add date" on a completed block; both shifts fit 390 px and the 768 px view beside the sidebar
  (container query on `.erp-ih`). `test_order_selesai_bisa_dibetulkan` (red first: `boleh_isi` False).
- `kapasitas._ingatkan_stok`: an orange note when a pigment or packing item has no stock in Gudang Bahan Baku
  (`test_peringatan_tanpa_stok`, red first). Work Order Item `rate`/`amount` on permlevel 1 (`setup.HARGA_TERSEMBUNYI`),
  read by the Manufacturing roles (`test_harga_wo_tersembunyi`). PO print labels in `_()`; Monthly Expenses escapes text.
- `e2e_samuel.mjs` prints the Purchase Order in `PO Samuel Beli` and checks it is the default (15/15); `lantai.mjs`
  `strip` opens an existing Work Order. Docs synced (guides: stock before pigment/packing, Sales/Purchase Orders used
  by Admin since 2026-11-23).
- Tests as run: `run-tests --app erp_internal` 349 (13 unit + 336 integration) OK; ruff clean; `cek_layar` 3 users OK;
  `e2e_samuel.mjs` 15/15; `lantai.mjs` all cases OK (perf 60.0 fps, 0 dropped).

## 2026-11-23, plan Task 12 (sample data, guides, full check): Samuel's 2026-11-23 requests built (Tasks 1-14)
- What the plan built (entries below per task): roles Super Admin / Admin / Produksi (1-2), Work Order machine lock
  (3), Gudang Pluit (4), attachments + Missing Documents (5), Daily Input server, page, Print and Excel (6-8),
  Expense Entry + Monthly Expenses (9), PO print formats (10), pigment per colour (11), packing per product (13),
  Seal Cap brand codes (14).
- `contoh.py`: Shift 1 entries carry technician Yudi, Shift 2 is typed through `daily_input.save_cell` (Fadli); the
  orders' quantity covers both shifts, the order is found by tag, start date and qty, its `creation` set back to the
  window's first day (Daily Input refuses earlier dates); open sample orders on another machine (the Mesin 01 era)
  are stopped. Packing CTH-DUS / CTH-PLASTIK (Buah) on the products (`KEMASAN_PRODUK`; erp.localhost's CTH-KARDUS is
  in whole-number Pcs, so it stays only in the hand-made BOMs), pigments Merah and Biru with stock and Kg prices in
  `Harga Bahan Baku`, a transfer to Gudang Pluit and an attached delivery note from it, expenses `BIAYA` (a
  Per machine shift wage made by hand on a site is reused: two would overlap). `tests.utils.nilai_atribut` split out
  of `buat_varian`; `buat_pigmen` no longer makes a test template and saves only on a change.
- `test_contoh.test_contoh_baru` (red first: ImportError of `KEMASAN_PRODUK`); `test_hari_berikutnya` keys entries
  by shift too. `test_contoh` 9 OK. Full `run-tests --app erp_internal`: 346 tests (13 unit + 333 integration), OK.
  `ruff check` / `ruff format --check` clean. `bench build --app erp_internal`, migrate both sites, `buat_contoh` on
  erp.localhost twice (same counts). `cek_layar` 3 users OK.
- New `tools/e2e_samuel.mjs`: Produksi types 1.000 in Daily Input (TOTAL moves) and empties it; Admin: Work Order
  refused on Mesin 04, submitted on Mesin 03; Sales Order refused without an attachment, submitted with one;
  Delivery Note from Pluit; Expense Entry refused without its receipt, submitted with it; Monthly Expenses and
  Missing Documents open; Super Admin: PO Samuel print. 14/14; it cancels and deletes what it made (a cancelled
  Delivery Note stays: ERPNext never deletes one with stock ledger rows). Screenshots 1440/390 in `tools/hasil/`.
- Guide pictures retaken (`panduan_gambar.mjs`, 12): new `produksi-2` (Daily Input), `admin-1` (Monthly Expenses),
  `admin-2` (Missing Documents), shown in `produksi.md` and `admin.md`. The access PDF was not regenerated: no tool
  or source for it exists (made by hand 2026-11-02, gone from the Desktop).
- `lantai.mjs` rerun 2026-11-23 (final review): all cases OK, perf 60.0 fps, 0 dropped, 34 draw calls; `strip` failed
  first (Produksi may not open a new Work Order form since Task 2) and now opens an existing order.
- Next: Abel reviews and approves the PR/tag; Samuel's full PO header, pigment list and item 6 lists.

## 2026-11-23, plan Task 14 (Seal Cap brand codes and their mould inserts)
- `data/merek_epp.json` (21 rows of Samuel's "List Insert EPP - Delta"), Brand custom field `erp_jumlah_insert`
  ("Inserts (pcs)", `setup.FIELD_MEREK`), `master._merek` (count and KET set only when the Brand is new, so an
  Admin's count stays); Brand is in Stock's sidebar and home (Admin has Item Manager). `test_master` 10 OK
  (1 new). Next: Task 12 (sample data).

## 2026-11-23, plan Task 13 (Packing, Pigmen and Kemasan in Monthly Expenses)
- Child DocType Item Packing (`packing_item` filtered to group Kemasan, `pieces`), Item field `erp_kemasan`
  ("Packing", on templates, variants and Barang Jadi, not on Kemasan or Pigmen); UOM Buah (fractional,
  `setup.SATUAN_KEMASAN`) for packing items. `kapasitas.kemasan(item)` (variant rows, else template's; disabled packing
  left out), `baris_bom` adds 1 / pieces per row; `perlu_segarkan` + `item_berubah` (Item on_update, replaces
  `pigmen_berubah`) queue the same `_antre` rebuild; `cek_kemasan` refuses 0 pieces. Monthly Expenses:
  `BIAYA_STOK`, `pemakaian()` (stock value used by Production Entries' Manufacture/Repack), rows Pigmen and Kemasan
  before Total. `test_bom_kapasitas` 20 OK (3 new), `test_biaya` 12 OK (1 new). Next: Task 12 (sample data).
- Review fixes: `cek_kemasan` refuses a packing item stocked in a whole-number UOM; `contoh.py` CTH-KARDUS in Buah
  (new sites; erp.localhost's existing item keeps Pcs, `buat_contoh` still runs). A reject's Repack skips packing
  lines (reground, never packed) and any line that rounds to 0. `test_bom_kapasitas` 23 OK, `test_biaya` 12 OK,
  `test_hasil_produksi` 17 OK, `test_contoh` 8 OK.

## 2026-11-23, plan Task 11 (Pigment)
- Item Group Pigmen, UOM Gram (fractions), Item field `erp_rasio_pigmen` (g per kg); `penjualan._pigmen` makes the
  template `PIGMEN` (stock Gram, Kg = 1000, purchase UOM Kg, variants on Warna; no variants until Samuel's list).
  `kapasitas.baris_bom(row, item)` adds the colour's pigment in grams (part kg x ratio); `cek_pigmen` (ratio > 0),
  `pigmen_berubah` (Item on_update) queues `segarkan_bom`. `test_bom_kapasitas` 15 OK (6 new), `test_penjualan` 8 OK.
  Next: sample data (Task 12).
- Review fixes: the rebuild never loses a change (`_antre` after commit sets a cache flag, `segarkan_bom` repeats
  passes with a fresh snapshot until it stays clear), BOMs in `setup.perusahaan()[0]`, a PermissionError row is
  logged too, `setup._pigmen` brings the template at migrate. `test_bom_kapasitas` 17 OK, `test_penjualan` 8 OK,
  `test_setup` 10 OK.

## 2026-11-23, plan Task 10 (PO print in Samuel's layout)
- Print formats "PO Samuel" (Sales Order) and "PO Samuel Beli" (Purchase Order), both standard, custom Jinja, one body
  `templates/po_samuel.html`; `cetak.py` (`FORMAT_CETAK`, `tanggal_panjang`, jinja method in `hooks.py`);
  `setup._format_cetak` makes each the default print format. `test_cetak` OK. Next: pigment (Task 11).

## 2026-11-23, plan Task 9 (Monthly expenses)
- DocTypes Expense Entry and Expense Category (seeded from `setup.KATEGORI_BIAYA`), report Monthly Expenses
  (`jumlah`, `shift_mesin`), Once entries need an attachment (`lampiran`), Buying sidebar and home. `test_biaya`
  11 tests OK. Go-live step in `docs/panduan/admin.md` "Biaya bulanan". Next: Task 10.

## 2026-11-23, plan Task 8 (Daily recap print and Excel)
- `daily_input.py`: `WARNA_EXCEL`, `buku` (openpyxl, Samuel's layout), `export_excel`, `print_html` (template
  `templates/input_harian_cetak.html`, A4 landscape, record text escaped); `get_data` blocks gain `dibuat` (the order's
  creation date), which "+ Add date" now uses instead of a `frappe.client.get_value` call. Print and Excel buttons in
  the page header. Checked in a browser as `admin@`: print page, downloaded xlsx colours, 768 and 390 px.

## 2026-11-23, plan Task 7 (Daily Input page)
- Page `daily-input` (`input_harian.bundle.js`, `.erp-ih-*` CSS) in Samuel's Excel layout; menu entry under the
  Production Floor (`MENU_ATAS`), in Manufacturing's sidebar and home in place of the Production Entry list; "Record
  Output" opens it at the order. `run-tests --app erp_internal` 301 tests (13 unit + 288 integration) OK; `cek_layar`
  3 users OK (Produksi types and clears a cell, Admin no input, 1440/768/390 px). Next: Task 8.

## 2026-11-23, plan Task 6 (Daily Input, server side)
- `erp_internal/daily_input.py`: `get_data` (week's Work Order blocks), `save_cell` (one submitted Production Entry
  per filled cell, replaced or cancelled inside a savepoint), `save_note`, `baca_jumlah`, `minggu`. Production Entry
  gains `technician`; `notes` changes after submit. `setup.JAM_SHIFT`; Manufacturing Settings allow 10 %
  overproduction. `test_input_harian` 14 OK. Next: Task 7, the Desk page.

## 2026-11-23, plan Task 5 (real documents attached)
- `lampiran.WAJIB_LAMPIRAN` (Sales Order, Sales Invoice, Purchase Order, Purchase Receipt, Purchase Invoice,
  Payment Entry, Stock Entry only for Material Receipt) with `before_submit` `cek_lampiran`; `LAMPIRAN_NANTI` = Delivery
  Note. Report Missing Documents (Stock sidebar and home, Admin and Super Admin, icon `paperclip`), orange note on the
  forms (`public/js/lampiran.js`, `frappe.boot.erp_lampiran`). Tests and `contoh.py` attach through
  `tests.utils.lampirkan` before every submit of a covered DocType.
  No module run recorded; covered by the full runs (301 at Task 7, 346 at Task 12).

## 2026-11-23, plan Task 4 (Warehouse Pluit)
- `setup.GUDANG_PABRIK` gains Gudang Pluit, `GUDANG_JUAL` = Barang Jadi + Pluit; `_gudang_kirim` makes Delivery Note
  `set_warehouse` required (Property Setter); `pengiriman.ikut_gudang` (Delivery Note `validate`) copies it to every
  line. Order Readiness stock sums both selling warehouses when no warehouse is picked (`_stok` takes a list). Delivery
  notes in `test_alur_jual_beli`, `test_tampilan` and `tools/panduan_gambar.mjs` now set `set_warehouse`.
  No module run recorded; covered by the full runs (301 at Task 7, 346 at Task 12).

## 2026-11-23, plan Task 3 (Work Order machine lock)
- `kapasitas.mesin_item` / `cari_mesin` / `mesin_terdaftar`: a Work Order takes only a machine Machine Capacity
  lists for its item (variant row, else template); no row at all means any machine; a submitted order already on its
  machine keeps running. `work_order.js`: Machine link query and a note when the item has no row. New fixture
  `utils.buat_wo`. Tests fixed for the lock: `test_bom_kapasitas.test_kunci_mesin`, `test_plan_vs_actual.test_kapasitas`;
  `tools/lantai.mjs` wo/xss picks an item listed for Mesin 03.
  No module run recorded; covered by the full runs (301 at Task 7, 346 at Task 12).

## 2026-11-23, plan Tasks 1 and 2 (Samuel's three roles)
- Task 1 (`9cc5116`): profiles renamed Developer → Super Admin, User → Produksi (patch `profil_tiga`, users move
  with the rename; it skips a rename when the new name exists: erp-test had a stale "Produksi" profile, deleted by
  hand). 265 tests OK.
- Task 2: Produksi = `ERP User` only (no Stock User): creates Production Entries, sets machine status, reads Work
  Order, Workstation, Machine Capacity, Reject Reason, Company, Plan vs Actual; menu Manufacturing only. Admin only
  views Production Entry. A PE's stock entries are made with permissions ignored; `production_entry.cek_stock_entry`
  refuses a Manufacture no PE made (Work Order Finish, System Manager excepted; `work_order.js` hides Finish) and
  cancelling a PE's own entry directly. `setup.IZIN_DICABUT` drops the old User's reads (Price List, Account, Stock
  Settings, Customer Group); Sales History and Order Readiness lose `ERP User`. New Work Orders skip the transfer
  (`setup.BAWAAN_WO`). `batas_user.py` and its test removed. Manufacturing's sidebar and home put Produksi's links
  first (no gaps on its home). Delivery notes and Material Receipts are Admin's (guides updated, gudang-2/3
  pictures retaken as admin@).
- Tests: `run-tests --app erp_internal` 262 (13 unit + 249 integration) all OK; ruff OK; `cek_layar` 3 users OK;
  Finish hidden for Admin and Produksi, shown for Super Admin at 1440/768/390 px (scratch Playwright check).
- Next: plan Task 3 (Work Order machine lock).

## 2026-11-23, later (spec and plan for Samuel's requests)
- Committed the price list fix (`2300877`) after `/run-checks` (263 tests OK).
- Spec `docs/superpowers/specs/2026-11-23-permintaan-samuel-design.md` and plan
  `docs/superpowers/plans/2026-11-23-permintaan-samuel-plan.md` (12 tasks) for items 1-5 and 7 of the 2026-11-23
  table, plus Abel's two additions: every document with a paper original gets its photo before submit (delivery
  note: the signed copy afterwards, listed in a Missing Documents report) and pigment (Samuel: 1 g per kg of
  material; colour, ratio, price per kg) as `PIGMEN` variants in the capacity BOMs. Samuel's daily Excel and PO
  pictures, recovered from the morning session, are in `docs/superpowers/specs/2026-11-23-samuel/`.
- Main calls for Abel (spec "Calls made"): operator shifts counted from the daily input, no machine state to set;
  the grid takes good pieces only; profiles renamed in place (sample logins unchanged). Nothing built yet.

## 2026-11-23 (sales and purchase flow with Samuel's data)
- Samuel asked whether purchasing, selling and production are ready. A script as `admin@` on `erp.localhost`
  (Samuel's `BASKOM-20-HTM-HTM`, `BB-PP-WARNA`; rolled back): SO → DN → SI → Payment Entry, PO → PR → PI all OK.
- Bug found and fixed: SO came from Standard Selling and PO at rate 0, because `set_single_value` on Selling/Buying
  Settings leaves the global defaults the forms and the server read. `master._harga_bawaan` now syncs them (and,
  via `penjualan._bahan`, makes `Harga Bahan Baku` the buying default); `patches/harga_bawaan.py` for loaded sites.
- Tests: `test_master` 9 OK, `test_penjualan` 7 OK, `test_alur_jual_beli` 5 OK; ruff OK. `/run-checks` later the
  same day: both sites migrated (the patch set `Harga Pola 2026` / `Harga Bahan Baku` on `erp.localhost`),
  `run-tests --app erp_internal` 263 tests (13 unit + 250 integration) all OK, `ruff check`/`format --check` OK.
- The `erp-mariadb` container was gone (volume kept): recreated with `tools/setup_bench.sh db`.
- Samuel's WhatsApp the same day: three roles (Super Admin/Admin/Produksi), a machine lock on Work Orders, warehouse
  Pluit, daily input like his Excel, monthly expenses, the Seal Cap product line (lists pending), screens following
  his templates, DigitalOcean hosting, demo videos. All written down in `docs/menunggu-samuel.md` (2026-11-23
  table) and `docs/TODO.md`; nothing of it built yet. Next: commit the fix, then spec + plan items 1-5.

## 2026-11-05 (make setup, then make up)
- Abel: `make setup` is the one-time step after the clone (wizard question, accounts, the whole setup through
  `tools/setup_lokal.sh`); `make up` (= `start-local`, `start`) only starts the containers, pings and prints the
  last line. Without `.local/siap`, `make up` says to run `make setup` first; with it, `make setup` says to use
  `make up`. The same split as the server's `make setup` / `make up`.
- The `ERP_AKUN` message (`akun.py`) now reads "ERP_AKUN is not set: run make setup." (its `id.csv` row too); the
  docstrings of `akun.py`, `wizard.py`, `test_akun.py` say `make setup`.
- Docs: README, CLAUDE.md, `deploy/server/README.md`, `docs/impor.md`, the setup plan's deviations, TODO.
- Checked: `bash -n` + shellcheck on `setup_lokal.sh` clean; on a copy with no `.local/`, `make up` stops with
  "Not set up yet" and `make setup` reaches the questions (refused without a terminal, as before); here
  `make setup` says "Already set up". `test_bahasa` 6 OK, `test_akun` 3 OK. Not run: ruff (not installed here;
  only strings and docstrings changed).
- Full run from a fresh copy of the working tree (project `erp-uji-klon`, port 8091, image built new, answers
  typed through `expect`): `make up` first refused ("Not set up yet"); `make setup` asked the wizard (automatic,
  PT Delta Anugrah / DAN kept) and the accounts (Administrator + Developer), built, ended "Ready", Samuel's data
  loaded (127 Items, 54 Machine Capacity rows, company `erp_aktif`, the Developer on profile Developer); both logins
  OK; `make setup` again said "Already set up"; `make down` then `make up` with no terminal: no questions, Ready in
  27 s, logins still OK; `akun.buat` without `ERP_AKUN` shows the new message. Test stack removed (`down -v`).
- 2026-11-06: automatic path run again from a fresh copy: Ready. By-hand path from a fresh copy (`erp-uji-tangan`,
  port 8092): `make setup` asked only the Administrator password and ended with "One step left"; the wizard filled
  in the browser (Playwright: suggested "Indonesia - Chart of Accounts" changed to Standard, own account made);
  ~3 minutes later Samuel's data was still not loaded (the worker was busy with the wizard's own
  `delete_dynamic_links` jobs, about 1 s each), so `make up` ran `lanjut` itself: wizard account → Developer,
  data loaded (127 Items, 54 Machine Capacity), Ready, 3 min 18 s; next `make up` 30 s; `make setup` again
  "Already set up". Both test stacks removed. `/run-checks`: `run-tests --app erp_internal` 263 tests (13 unit +
  250 integration), all OK; shellcheck and `bash -n` clean; `make -n setup-local WIZARD=otomatis` reads right;
  no new commits, so no attribution lines. Not run: ruff (not installed here).
- Then (Abel): the by-hand ending's step 5 names the command that loads the data, `petunjuk_wizard URL PERINTAH`
  (`make up` locally, `make setup` on the server), instead of "wait a minute"; README and
  `deploy/server/README.md` say the same. Checked: the printed steps, `bash -n`, shellcheck. Removed the unused
  images `erp-internal:uji-klon` and `erp-internal:uji`.

## 2026-11-03 (app version on screen)
- `erp_internal/versi.py` (`di_login`, hooks `update_website_context`): `v0.0.1` under the login card;
  `public/js/versi.js`: the same at the foot of the Settings dialog's left menu (the user's Settings only). The image
  workflow's tag check now also refuses a tag other than `v` + `erp_internal.__version__`; runbook "New version"
  says to bump it first. `tools/cek_layar.mjs` checks both (login as a guest, Settings per role).
- Tests as run: `test_versi` 4 OK; `cek_layar` 3 users OK; ruff clean; full run 252 tests (13 unit + 239 integration),
  all OK. Checked in a browser
  (Playwright): login page and the User's Settings dialog show `v0.0.1`.
- Wizard prompt: company name and abbreviation now come already typed in (`tanya.sh` `tanya_isi`; Abel during his
  first `make start`). Tested through a pty with macOS `/bin/bash` 3.2 (Enter, Backspace, Ctrl+U, empty, arrows,
  terminal mode restored); shellcheck and `bash -n` clean.
- 2026-11-04 (Abel after his `make start`, all fine): Production Floor back button (top left, arrow, to
  `/desk/manufacturing`; `cek_layar` clicks it for each role); `make up` (main name; `make start` kept as the same
  until the real server is live) and `make down` (was `make stop`); docs and the `ERP_AKUN` message say `make up`.
- Audit of unused modules (CRM, Assets, Quality, Support, Subcontracting, Payroll, ...): they were only hidden from
  the menu for Admin/User; their documents still opened by search and URL, and Developer saw them all. Now locked
  (Abel's yes): `tampilan.MODUL_MATI`, one Custom DocPerm for the Administrator role per DocType (91), a Developer
  Module Profile, Administrator's own blocks, `saring_modul_mati` on every boot. Bulk Transaction left open (bulk
  actions log there); HR next, DocType by DocType.
- Tests as run: `test_modul_mati` 6 OK, `test_tampilan` 25 OK, `test_akun` 3 OK; `cek_layar` 3 users OK (now also the
  floor's back button, the unused modules: boot, menu, `/desk/lead`, `/api/resource/Lead` 403); 16 used forms opened
  per role in a browser with no popup, 403 or error (User's popups only on forms it never had: Quotation, Sales
  Invoice, Employee). Full run 258 tests (13 unit + 245 integration),
  all OK; `lantai.mjs` all OK (60 fps, 0 dropped). An earlier `lantai.mjs` run cut off by a session restart had left
  machines 1, 7, 9-14 enabled on `erp.localhost`: restored by `master.muat`; `lantai.mjs` now also copes with no
  disabled machine.
- Security review: unlocking now touches only DocTypes `_kunci_modul` locked itself (global default
  `erp_modul_terkunci`), never a hand-set Administrator-only Custom DocPerm; `test_modul_mati` 7 OK.
- Checked on Abel's Docker stack (`make update-local`, temporary `_cek.*` accounts, deleted afterwards): the version,
  the back button, `/api/resource/Lead` 403, `/desk/lead` refused, no locked module in the menu. The search bar still
  offered the CRM report "Lead Conversion Time" (it reads Communication, which stays open): every report of
  `MODUL_MATI` is now disabled (`_matikan_laporan`, tracked in `erp_laporan_mati`), and boot drops reports, pages and
  dashboards by module. `test_modul_mati` 8 OK; full run 260 tests (13 unit + 247 integration), all OK; rechecked on
  the rebuilt stack: the report is gone from the search bar.
- Responsive (Abel): the login version, the floor's back button and the Settings version checked at 390 px and 768 px
  (no overflow, no sideways scroll). Found and fixed: the floor's output card ran past a phone's edge ("39.427 / 3…"):
  its "/ plan" now sits under the figure below 760 px. `cek_layar` now checks the floor on a phone per role.
- HR's unused DocTypes locked (Abel's yes to the proposed list): `tampilan.DOCTYPE_MATI` (50 DocTypes:
  recruitment, appraisal, training, expense claims and advances, travel, onboarding/separation/promotion/transfer,
  grievance, vehicles, skills, daily work summary, health insurance, overtime), the menu-only modules Recruitment,
  Performance, Expenses, Tenure, Tax and Benefits added to `MODUL_MATI`, and their reports disabled (by
  `ref_doctype`, plus `LAPORAN_MATI` Vehicle Expenses). Attendance, check-ins, shifts, leave, holidays, HR Settings
  and their masters stay open. Goes into PR #9 (Abel: start now).
- Found in Playwright (Admin and Developer): the Employee form popped "Insufficient Permission for Salary Structure"
  since the Payroll lock (HRMS `get_assignable_masters`). Routed to `tampilan.master_karyawan`, which answers False
  for a master the user cannot read. Employee, Attendance, Leave Application, Shift Assignment, Employee Checkin
  forms now open with no popup or 4xx.
- Tests as run: full run 262 tests (13 unit + 249 integration), all OK before the override; `test_modul_mati` 11 OK
  after it; `cek_layar` 3 users OK (now also `/api/resource/Expense Claim` 403, Attendance 200); ruff clean.
- Next: Abel checks HR as Admin; PR #9 review.

## 2026-11-03 (one-command setup, built)
- Plan `docs/superpowers/plans/2026-11-03-setup-tanya-jawab-plan.md` (deviations at its end), built inline:
  `erp_internal/wizard.py` (`setup_wizard_complete` hook: erp_aktif, queue `lanjutkan`; `lanjutkan`: setup, the
  wizard's account into Developer, company on Admin/User accounts, Samuel's data once with `erp_produksi`,
  marker `erp_data_samuel`), `akun.buat` refuses other accounts before the wizard; `deploy/server/{tanya,akun,
  wizard}.sh` (shared prompts; `tools/akun.sh` moved), `deploy/server/setup.sh` (`make setup` asks token, address,
  version, backup or skip, wizard, accounts), `tools/setup_lokal.sh` (`make start` = `start-local`), `make dev`,
  `PROYEK` for a second local stack; `data-local` removed (update never reloads Samuel's data); `cadangan.sh`
  and `check` without a backup destination. README rewritten for first-time readers (local and server).
- Tests as run: `test_wizard` 7 OK, `test_akun` 3 OK, `test_bahasa` 6 OK, `test_setup` 9 OK; full
  `run-tests --app erp_internal` 246 OK before the last fix (rerun after it: see TODO); shellcheck and `bash -n`
  clean; prompts driven through a pty (Enter defaults, Backspace, `*`, checklist); `cadangan.sh` with a fake
  docker, with and without a remote; `make -n` of `setup-local`/`update-local`/`langkah`.
- End to end on the Mac beside Abel's own stack: automatic `make start` from nothing (project `erp-tanya`, port
  8081): Ready, Administrator and a User sign in, Item 127, Workstation 14, erp_aktif 1, the User has the
  company, marker set; a second `make start` 19 s, no question. By hand (`erp-tangan`, 8082): the by-hand steps
  printed, the wizard filled in the browser: it found a real bug (the Developer Role Profile does not exist at
  hook time, and the failure kept the data job from being queued), fixed (`b36a5b7`), then rerun from nothing:
  data in ~70 s, the wizard's account Developer, no Error Log, `make start` then says Ready. Server `setup.sh`
  with a fake make/docker: wrong token asked again, `https://` dropped, `v` added, backup skipped (no
  `RCLONE_REMOTE`), `ADMIN_PASSWORD` removed, steps in order. Not run: a real server (none yet), `make
  update-local` on the test stack (covered by `make -n` and the marker).
- Final review (fresh reviewer): no critical; 3 important fixed (`e368a26`): a docker problem no longer looks like
  a wrong token, answers are checked before `.env` is written, and the drivers run `lanjut` until it has run once
  after the wizard (the hook keeps the wizard's account in `erp_wizard_developer`; a file lock keeps the queued job
  and `make lanjut` apart). 12 minors deferred (ledger list in the final message). Full run after the fixes:
  248 OK (13 unit + 235 integration).
- Next: Abel tries `make start` himself; the version display task.

## 2026-11-03 (setup design)
- Spec `docs/superpowers/specs/2026-11-03-setup-tanya-jawab-design.md`: `make setup` (server) as one command
  with plain questions (token, address, version, backup skippable, wizard automatic by default or by hand,
  accounts), the same wizard question in `make start-local`, a `setup_wizard_complete` hook (erp_aktif,
  pastikan_setup, Samuel's data once on a real site, the wizard's own account into Developer), `make dev`.
  Builder check done; Abel's answers in. No code yet; not committed.
- Next: Abel approves the spec, then the plan.

## 2026-11-03 (accordion menu)
- PR #7 merged. The icon rail on ERP and HR pages is one labelled menu: a collapsible header per module (icon + name,
  `IKON_MODUL`), the module's links under it, the page's module open, folds to a rail of module icons, phone drawer
  the same. `tampilan.menu_samping` sends `erp_menu`; `public/js/menu_samping.js` patches Frappe's Sidebar (falls back
  to Frappe's own on an error); Frappe's System app keeps its rail. Link icons fixed (Stock Entry, Delivery Note,
  Warehouse, Purchase Order, Work Order, Project, settings rows, Home).
- Tests: `run-tests --app erp_internal` 239 (13 unit + 226 integration) OK; `test_tampilan` 25 OK; `cek_layar` 3 users
  OK (one earlier run failed on Developer homes from the 800 ms home wait, rerun clean); `lantai.mjs` OK (pilih and
  perf failed while the full run loaded the machine, OK alone); `denah.test.mjs` 6 OK; `panduan_gambar` 9 retaken.
- Next: Abel tries it, then PR to main.

## 2026-11-03 (local stack with only Docker)
- Root `Makefile` for Samuel's laptop (Mac, or Windows through WSL): `make start-local` runs the server compose stack as
  project `erp-local` (`--project-directory .local`, git-ignored and in .dockerignore), builds `erp-internal:local` or
  pulls `ERP_IMAGE`, reuses the server Makefile's `db site wizard`, then `configure-local`, `data-local` (master,
  penjualan, mesin_barang), up, ping, and the first time `tools/akun.sh`. After one full run (`.local/siap`) it
  only starts the containers. `stop`, `update-local`; `make users`/`make password` were made, then dropped the same day
  (Abel: an Admin makes later accounts and resets passwords in the app). README "Run it on your computer", "Make commands".
- `tools/akun.sh` (checklist, passwords as `*`, min 8) hands accounts to `erp_internal/akun.py` in env `ERP_AKUN`.
  Found in the real run: keys typed faster than the one-character reads showed the password in clear between them;
  echo is now off for the whole answer.
- `deploy/server/Makefile`: cek → check, cek-env → check-env, aktif → configure, cadangan → backup (script name kept).
  `.gitattributes`: LF everywhere.
- Tests as run: `run-tests --module erp_internal.tests.test_akun` OK (2 tests after `ganti_sandi` was dropped), `test_bahasa` 6 OK; `docker build` of
  `erp-internal:local` OK; a real `make start-local` from nothing (7 min 40 s), the account picker (also again after removing `.local/akun-siap`), logins
  by API, `make stop` + `make start-local` (24 s). Not run: the full `run-tests --app`, `make update-local`, Windows.
- Next: Samuel tries a fresh clone; deploy stays parked.

## 2026-11-03 (label jiggle)
- `label-rapi 1440x900` flip found: at the dolly-out threshold 06 went compact and 03/05/07 full, or the reverse, on a
  0.15 m camera move. Cause: the front row lies at one view depth when seen square on, so the nearest-first sort was
  decided by float noise. `label.js`: labels within `SERI` (0.25 m) of each other in depth go full-last-frame first,
  then floor order; `adegan.proyeksi` gives `dalam` as view depth in metres (was NDC z).
- Tests as run: `lantai.mjs label-rapi` OK; `lantai.mjs` all cases OK (perf 60.0 fps, 0 dropped, 34 draw calls);
  `node --test tools/denah.test.mjs` 6 OK. Machines back to disabled + Off.
- PR #4 (this fix) merged 2026-11-03 (Abel approved).
- Next: what Samuel answers (`docs/menunggu-samuel.md`), DigitalOcean server and go-live.

## 2026-11-02 (guide pictures)
- `tools/panduan_gambar.mjs` retook all 9 pictures; new `gudang-2` (Material Receipt) and `gudang-3` (direct
  Delivery Note) taken as `user@` (an optional third item per picture names the user), shown in `gudang.md`.
- Bug found by it: as User, filling a Material Receipt asked Stock Settings and a Delivery Note's customer asked
  Customer Group, both 403 with an error dialog. `ERP User` now reads both (`setup.IZIN_TAMBAHAN`). In the browser
  as `user@`: MAT-STE-2026-00121 and MAT-DN-2026-00004 saved and submitted, no console error.
- `run-tests --module erp_internal.tests.test_batas_user`: 10 OK (new `test_baca_untuk_form`).
- `set_status` refuses an inactive machine (ERPNext's `disabled_workstation` kept it Off: a silent no-op before);
  id.csv row; `test_production_floor.test_set_status_mesin_tidak_aktif`. `lantai.mjs` turns the inactive machines on
  for the run and back off at exit (also Ctrl-C); wo/xss makes its Work Order via bench execute as Administrator
  (the sample User may not create one, inserted with docstatus 1). Found by a `lantai.mjs` run that failed on Mesin 01
  and the Work Order. The fixture `buat_mesin` of `test_production_floor` now resets `disabled`.
- Tests as run: `run-tests --app erp_internal` 233 OK (13 unit + 220 integration, before the set_status test);
  `--module erp_internal.tests.test_production_floor` 16 OK twice; `test_bahasa` 6 OK; `cek_layar` 3 users OK;
  `node --test tools/denah.test.mjs` OK; `lantai.mjs` all cases OK except `label-rapi 1440x900` (labels flip while
  the camera jiggles; open item in TODO), `wo xss` rerun OK after the docstatus fix. Machines back to disabled + Off.
- PR #2 and PR #3 (these fixes) merged 2026-11-03 (Abel approved).
- Next (done 2026-11-03): `label-rapi 1440x900` fixed (see the label jiggle entry); PR #2 and #3 merged and pushed.

## 2026-11-02 (item-to-machine list)
- Samuel's sheet "Mesin & Kapasitas" into `data/mesin_barang.json` (the xlsx was gone from Downloads; copied from
  the earlier session's dump of it) and `mesin_barang.muat`: 46 Machine Capacity rows (32 pairs on machines 2-6, 8)
  from `penjualan_2026.json` `spesifikasi`, "( n )" = the mould's cavities, Toples Nastar body + lid 40 s, then
  their BOMs. Samuel's answers the same day: Gantungan DX = Gantungan Dinda DX, Gantungan Folding one item on the
  stick's machines (2, 3, 6; 135 s a set), Body PLN dropped: 54 rows, `test_mesin_barang` 8 OK.
- Machines 1, 7, 9-14 inactive: `mesin.json` `aktif` → Workstation disabled + Off; `kapasitas.mesin_aktif` refuses
  a new or moved Work Order on them. `contoh.py` moved its sample capacity and orders from Mesin 01/02 to 02/03.
- Dev site: `master.muat` (9 written), `mesin_barang.muat` (168 written, second run 0), `contoh.buat_contoh` rerun.
- Tests: `test_mesin_barang` (8 OK), `test_bom_kapasitas.test_mesin_tidak_aktif`. Full run 232 (13 unit + 219
  integration): 231 OK, 1 error in the new `test_mesin_tidak_aktif` (it edited a field locked after submit); fixed
  to call `mesin_aktif` directly, `test_bom_kapasitas` rerun 9 OK.

## 2026-11-02 (a simpler User role)
- Samuel: User records only daily output, deliveries and raw material in; the rest is read only. User = Stock User +
  `ERP User` (`tampilan.PERAN_USER`); `batas_user.py` keeps a User to a Material Receipt Stock Entry (Production
  Entry's own entries pass by `FLAG_HASIL`) and makes Stock User's other documents read only (`HANYA_ADMIN`).
  `ERP User` reads Workstation, Price List, Account, Machine Capacity, Reject Reason, Sales History; sets a machine's
  status only. Rail Stock + Manufacturing; Delivery Note in Stock; `so_required` No (direct Delivery Note).
  `tampilan._pengguna_profil` resaves users whose roles lag behind their profile at migrate.
- Tests: `test_batas_user` (new, 8); `test_surat_jalan_langsung`, `test_user_tetap_bisa_buat_surat_jalan`,
  `test_proyek` with an office worker (roles given directly). `run-tests --app erp_internal`: 222 OK (13 unit + 209
  integration). `cek_layar` 3 users OK (found and fixed: a gap on User's Manufacturing home, Sales Forecast moved last).
- Security review fix: Production Entry `on_submit` empties client-sent `manufacture_entry`/`reject_entry` before
  filling them (cancel would have cancelled another Stock Entry past `batas_user`; a straight submit too); `test_tautan_entri_dari_klien`. `test_batas_user` 9 OK,
  `test_hasil_produksi` 14 OK.
- Guides: new `docs/panduan/user.md`; gudang, penjualan, pembelian, admin, produksi, proyek, absen updated. Access PDF
  `~/Desktop/Hak-Akses-ERP-Delta-Anugrah-revisi.pdf`. Samuel (via Abel): machines 1, 7, 9-14 inactive for now;
  "( 2 )"/"( 4 )" is the cavity count.

## 2026-11-02 (Samuel's answers)
- Samuel: two factory shifts of 12 h (`setup.SHIFT_PABRIK` now Shift 1 and 2, 12 h; Production Entry options, id.csv,
  `test_plan_vs_actual` follow); roles Admin and User are enough; each item is tied to particular machines (list
  still to come). `docs/menunggu-samuel.md` rows 4b, 7, 9, 12 and the production guide updated.
- Access PDF for Samuel (per section, CRUD/WRITE/READ per feature for Admin and User, read from `erp.localhost`
  with the three sample users). Samuel then chose a simpler User role (TODO "Next: a simpler User role").
- Sample resin receipts raised by half (`contoh.TERIMA_BAHAN`: 12 h shifts make more). `run-tests --app erp_internal`: 214 OK
  (13 unit + 201 integration).

## 2026-10-31 (Abel's manual tests)
- Wrap-up: a submitted Work Order's machine now changes only while Not Started or In Process (Abel's call;
  `kapasitas.kunci_mesin`, the form's field read-only otherwise; `test_kunci_mesin`). Catalog against the paper list
  (`data/katalog.json` vs `erp.localhost`): 228 matches, 0 differences. Production vs Idle by Playwright: clear.
  `run-tests --app erp_internal`: 214 OK (13 unit + 201 integration).
- Capacity import tested in the browser with a file built from the sample rows: New 1, Changed 1, Unchanged 9, one BOM made.
- Fixed from it: the import dialog closes after Apply unless a row is Refused; BOM alerts read "BOMs made: N, ..." (id.csv);
  Production Entry Good Qty, Reject Qty and the reject rows' Qty have precision 0 (Indonesian "5,000" read as 5000).
- Record Output on MFG-WO-2026-00004 (100 good, 5 Bubble, Shift 1): produced 7.548 → 7.648, MAT-STE-2026-00061/62.
- Plan vs Actual checked by Playwright as `user@`: both target modes × six groupings, English and Indonesian, no
  error; today's entry shows only with To Date = today (the default ends yesterday, by design).
- TODO browser items by Playwright/API (Abel away): Indonesian screens, Fill from History, Order Readiness, roles,
  admin refusing Developer, the sales flow to Paid, tiles/HR title/avatar, Sales History per month: all OK. The sales
  flow found Sales Orders defaulting to the empty Standard Selling list (Rate 0): `master.muat` now makes
  `Harga Pola <year>` the default while it is still Standard Selling (`_harga_bawaan`, `test_daftar_harga_bawaan`,
  `test_master` 9 OK).
- `lantai.mjs` with the Mac loaded by other Docker projects (load 12-130): every functional case OK after reruns;
  `label-rapi` fails its jiggle check (front labels settle in two camera moves), `perf` 1.65-2 % slow frames.
  A case cut short under load left Mesin 06 at Problem; put back to Production.

## 2026-10-31 (real `make setup` and restore drill on the Mac)
- Image `erp-internal:v0.0.1` built from `feat/lokal`, `deploy/check_image.sh` OK.
- `make env`, `db`, `site`, `wizard`, `aktif`, `up`, `ping`, `cadangan` against it (compose project `erp-uji`, scratch
  folder): all OK, fresh site 8 m 40 s, second run of `site`/`wizard` skipped. Fixed on the way: `tools` now waits for
  the configurator (it read the image's default Redis port); `site` installs each missing app (a run cut off halfway
  left a site the next run skipped with no apps); `PORT` in `.env` for a drill stack beside production.
- Restore drill (project `erp-pulih`, port 8081) from the backup in the rclone remote, after `master.muat` and
  `penjualan.muat` on the source: Item 127, Item Price 164, Sales History 513, Workstation 14, Company 1 on both;
  `ping` OK. `buat_contoh` refused on the source (`erp_produksi`).

## 2026-10-30 (Abel's evening list, 8 items)
- Committed the 2026-10-29 work (company rename + logo, Production vs Idle, `penjualan.py`) in 4 commits.
- Production Floor: every row faces the camera (front row lamps visible); Problem blinks hard (1.25 Hz on/off); forklift
  removed (HUD: "Operators and parts are simulated"; `denah.JALUR` kept).
- Hash names hidden: Sales History `title` "ITEM · MM-YYYY" (patch `judul_riwayat`), no ID column/filter on Sales History
  and Machine Capacity, links show the title, form sidebar hash hidden. Production Entry `PE-…` kept.
- Order Readiness leaves templates out. Folded sidebar arrow is a 32 px button. `tampilan.IKON_LINK`: an icon on every
  sidebar link. Production Floor tile on the Apps screen (default reading of "production floor di desk").
- `deploy/server/Makefile` (`make env`, `make setup`), dry run with a fake docker/bench/crontab.
- Tests as run: `run-tests --app erp_internal` 13 unit + 199 integration OK; `cek_layar` 3 users OK; `node --test
  tools/denah.test.mjs` 6 OK; full `lantai.mjs`: all OK except `perf` and `poll` while the Mac's load average was ~65,
  both OK on a rerun (perf 59.9 fps, 0.82 % dropped, max 41.9 ms, 0 long tasks); ruff clean.
- Found on the way: a `bench build` while redis is down leaves old asset hashes in redis (Desk without CSS); rerun
  `bench build --app erp_internal` with `bench start` up.

## 2026-10-29 (company name and logo on dev, Production vs Idle)
- `erp.localhost`: Company PT Contoh Plastik renamed PT Delta Anugrah (abbreviation CPL kept, warehouses keep `- CPL`), logo
  attached; backup `20261029_160326-erp_localhost-database.sql.gz` before. `contoh.PERUSAHAAN` and `setup_bench.sh` use the new
  name; `contoh._logo` attaches `delta-anugrah.png` once.
- Production Floor: Production's floor ring breathes (0.4 Hz) and its screen is lit; Idle is dimmer (0.78) with a dark screen
  (`GAYA` `nadi`, `layar`). `lantai.mjs states` checks screen brightness, ring breath and a still Idle ring.
- Tests as run: `node tools/lantai.mjs states hud perf` OK (perf 60.0 fps, 0 dropped, 0 long tasks, 35 calls, 37,428 triangles);
  `run-tests --module erp_internal.tests.test_contoh` 8 OK.
- Samuel's sales Excel (Abel's paste, 2026-10-29): `penjualan.py` + `data/penjualan_2026.json`. New types/products
  (Soft, DX Soft, Gantungan Dinda Hitam, Toples Nastar, Sendok Bebek in UOM `Ball Kecil`; colours guessed, no price),
  7 raw materials (Kg, buying list `Harga Bahan Baku`), Sales History Jan-Sep spread evenly over colours (Abel's
  choice), `safety_stock` = half an average month. On `erp.localhost`: 513 rows over 90 variants, every Excel row and
  month matches, second run writes 0. The Excel's Total row leaves out row 1. Open points: `docs/menunggu-samuel.md` row 14.
- Tests: `run-tests --module erp_internal.tests.test_penjualan` 7 OK; full `run-tests --app erp_internal` ran 195 integration tests, 1 failure (`test_bahasa`: the new message had no Indonesian), fixed in `id.csv`, `test_bahasa` 6 OK on rerun; `uvx ruff check erp_internal/` clean.

## 2026-10-29 (Production Floor Revision 2, Task 5 of 5)
- Left column under the top bar: machine table, then the attention card (not in Production: Problem, Maintenance, Setup, Idle, Off; row click selects). Loading screen until first data and frame. Dark palette for the building, truck, props; lettering contrast >= 3:1 in both themes (`info().zona.kontras`). New cases `perhatian`, `dekor-gelap`, `memuat`; `hud-xss` and `notes` extended.
- Tests as run: `node --test tools/denah.test.mjs` 6 OK; full `node tools/lantai.mjs` all cases OK (perf 60.0 fps, 0 dropped, 0 long tasks, 35 calls, 37,428 triangles; an earlier run under heavy machine load showed 1-2 long tasks, rerun clean); `tools/cek_layar.mjs` 3 users OK; `run-tests --app erp_internal` on erp-test 188 OK; docker build and `deploy/check_image.sh erp-internal:uji` OK.
- Abel: restart `bench start` after the build.

## 2026-10-29 (sample data rerun on a later day)
- `contoh._order` finds a sample Work Order by its plan start among the orders not Stopped or Closed; on another day
  it cancels the earlier run's Production Entries inside the new window, stops that order (`_lepas`) and makes a
  new one. No more `db.set_value` on a submitted order's qty or dates. New test `test_hari_berikutnya`.
- Tests as run: `run-tests --module erp_internal.tests.test_contoh` 8 OK (twice); full run 201 (13 unit + 188
  integration) OK; ruff check clean.
- Abel 2026-10-29: the home shortcut cap stays 12 (`PINTASAN_MAKS`). Samuel asked about shifts, reject types and
  runner (`docs/menunggu-samuel.md` rows 9-11).

## 2026-10-29 (Plan vs Actual, whole-branch review fixes)
- `Work Order.erp_mesin` is now `allow_on_submit` (migrate both sites): a submitted order's machine can change, so the
  Production Entry refusal "change the Work Order's machine first" can be followed. The report puts the whole target on
  the current machine (past days too); said in `docs/panduan/produksi.md`. `pilih_bom` stays draft-only and now filters
  BOMs by the order's company.
- Plan vs Actual: the Shift filter is filled from `plan_vs_actual.shift()` (`SHIFT_PABRIK`), `execute` refuses an
  unknown shift; reason column labels are raw (no `escape_html`, `&` shows in Excel/CSV).
- Capacity import: the header is the first of the first 10 non-empty rows that names at least 2 known columns (a title
  row or blank rows above are fine; the CSV separator is chosen over those lines). `docs/impor.md` updated.
- `contoh.py`: sample Work Orders plan first entry day to yesterday; qty = good pieces / a target share (1.0, 1.0, 0.72,
  0.95), so Mesin 01 reads 100 % (green) and Mesin 02 76 % (red); an older sample order gets the new dates and qty by
  `db.set_value`. Removed the dead `jenis is None` branch in `kapasitas()`; produksi.md fixes (material warehouse, shifts).
- Tests as run: full run 200 (13 unit + 187 integration) OK; ruff check and format clean; `buat_contoh` twice on
  `erp.localhost`, second run changed nothing.

## 2026-10-29 (Plan vs Actual, Task 6 of 6)
- Task 6: `contoh.py` now also makes 10 Machine Capacity rows (5 products on Mesin 01 and 02) with their BOMs
  (`buat_bom_kapasitas`), 4 open Work Orders and 28 Production Entries (7 days ending yesterday, Shift 1, rejects by
  day), all tagged DATA CONTOH. The entries are back-dated, so the resin and masterbatch come in by Material Receipt
  dated the day before the first entry, and by a second receipt one second after any older opening-stock Stock
  Reconciliation inside the window (a reconciliation resets the stock to its figure and would starve the later days).
  `DIBUAT` gained Machine Capacity, Work Order, Production Entry and Stock Entry.
- `tools/cek_layar.mjs`: `PINTASAN_MAKS` 10 to 12 (the plan added Production Entry, Plan vs Actual and Machine
  Capacity to Manufacturing's home and Reject Reason to Setup's: 12 and 11 shortcuts). Say so if you prefer trimming.
- ruff: fixed an import order and formatting in four files of the plan (`uvx ruff check erp_internal`, `format --check`).
- Tests as run: full run 196 (13 unit + 183 integration) OK; `cek_layar` 3 users OK; `buat_contoh` twice on
  `erp.localhost`, identical counts (Production Entry 28, Machine Capacity 10, Work Order 5 incl. one older).
- Next: Abel's browser checks in `docs/TODO.md`; Samuel's answers in `docs/menunggu-samuel.md` row 4b.

## 2026-10-29 (Plan vs Actual, Task 5 of 6)
- Task 5: Script Report Plan vs Actual (module Planning, `ref_doctype` Production Entry; Manufacturing User/Manager,
  System Manager), in Manufacturing's sidebar and home after Order Readiness. Cells (machine, day, Work Order, shift)
  with a target from the Work Order (even over its planned days; split over shifts by recorded hours) or from
  Machine Capacity (`pcs_per_hour` × recorded hours; none without a capacity row), grouped by `KELOMPOK`;
  dynamic reject-reason columns, Achieved % pill (`CAPAI_HIJAU` 100 / `CAPAI_KUNING` 85, sent on the column),
  bar chart. Company permission checked, submitted entries and orders of that company only.
- Tests as run: `test_plan_vs_actual` 11 OK, `test_tampilan` and `test_bahasa` OK; full run in the commit message
  below. Review notes: a reason column is `r_` + scrubbed name with non-word characters turned into `_`.

## 2026-10-29 (Plan vs Actual, Task 4 of 6)
- Task 4: DocTypes Reject Reason (seeded from `setup.ALASAN_REJECT`, never deleted), Production Entry
  (`PE-.YYYY.-.#####`, submittable) and its child Production Entry Reject. Submit: ERPNext's Manufacture entry for the
  good pieces (`make_stock_entry`, counts toward the Work Order) and a Repack entry for the rejects (BOM material from
  the order's source warehouse, never WIP, the item into the company's Default Scrap Warehouse; no process loss), both as the
  current user and dated on the entry; cancel cancels both. `setup.SHIFT_PABRIK`/`jam_shift` (Shift choices by
  Property Setter), "Record Output" on Work Order (`public/js/work_order.js`), sidebar after Work Order and Reject
  Reason under Settings, 39 Indonesian rows, fixture `buat_hasil`, guide section "Catat hasil produksi".
- Tests as run: `run-tests --app erp_internal`: 165 tests OK (11 in `test_hasil_produksi`). Review fixes: rejects never
  take WIP material, atomic submit by savepoint, cancel on a Stopped order refused with a clear message;
  `test_hasil_produksi` 13 OK.
- Next: Task 5, the Plan vs Actual report.

## 2026-10-29 (Plan vs Actual, Task 3 of 6)
- Task 3: Excel import of machine capacity. `planning/impor_kapasitas.py` (`KOLOM_IMPOR`, `normal`, `angka`, `baca`,
  `pratinjau`, `terapkan`), list button "Import from Excel" in `machine_capacity_list.js` (Preview, Apply, every cell
  escaped), sample `tests/data/kapasitas.xlsx` from `tools/contoh_kapasitas.py`, 33 Indonesian rows,
  `docs/impor.md` section 6. Preview writes nothing; Apply writes New/Changed rows and their BOMs per row in a savepoint.
- Tests as run: `run-tests --app erp_internal`: 151 tests OK (135 + 16 in `test_impor_kapasitas`).
- Next: Task 4, Production Entry.

## 2026-10-29 (Plan vs Actual, Task 1 of 6)
- Task 1 (`203969e` and a follow-up): DocType Machine Capacity (module Planning; Manufacturing Manager writes, Manufacturing User
  reads), `planning/kapasitas.py` (`kapasitas()` lookup: variant row, template + Jenis, template; `jenis_varian`,
  `RUNNER_DIGILING`, `runner_digiling()` for the form), sidebar and shortcut after BOM, 35 Indonesian rows,
  fixtures `buat_varian`/`buat_mesin`/`buat_kapasitas`. Material must be a stock item counted in Kg.
- Tests as run: `run-tests --app erp_internal`: 128 tests OK (123 + 5 in `test_kapasitas`).
- Next: Task 2, BOMs from capacity rows.

## 2026-10-29 (Plan vs Actual, Task 2 of 6)
- Task 2: `kapasitas.varian_tercakup`, `baris_bom`, `buat_bom_kapasitas(nama, company=None)` (button "Make BOMs" on
  Machine Capacity, Manufacturing Manager; no save hook), `pilih_bom` on Work Order `before_validate` (not `validate`:
  ERPNext builds the required items in `validate`, so the BOM must be swapped before). Custom fields `BOM.erp_mesin`
  and `BOM.erp_kapasitas` (`setup.FIELD_BOM`). Hand-made BOMs are never touched. `test_bom_kapasitas`: 7 tests.
- Next: Task 3, the Excel import of capacity.

## 2026-10-28 (Production Floor, Tasks 1-7 of 7)
- Revision 1 (Abel, `dfcc7cf`, `e2bd3d7`): English route and endpoints, an info bar like BPT Live's, a liquid glass
  look. Tasks renumbered: 4 rename, 5 labels and panel, 6 info bar and glass, 7 navigation and docs.
- Task 1 (`87f6a48`, `3850564`; its hooks/setup/id.csv hunks landed in `89d75b8`): `erp_internal/lantai.py`
  `data()`, POST `ubah_status` (refuses an unnumbered machine before saving), `siarkan` (event `erp_lantai`, name
  only); `Work Order.erp_mesin` (Link Workstation, `link_filters` erp_nomor > 0). `test_lantai` 11 OK.
- Task 2 (`6741a41`..`b7a666a`): page `lantai-produksi`, `lantai.bundle.js` (three 0.160.0 from the root
  `package.json`), `public/js/lantai/adegan.js`; pauses on page hide, on a hidden tab, and when left before it mounts.
- Task 3 (`fa3d01e`, `0c22390`): `public/js/lantai/mesin.js`, 14 instanced machines (10 draw calls, 14,394
  triangles), status lamps and platen motion per the spec, adaptive quality, a plain table without WebGL or bundle.
  Perf gate reworked (spec and plan amended): ≥ 57 fps, ≤ 1 % frames over 25 ms, max ≤ 50 ms, 0 long tasks; the old
  p95 ≤ 18.5 ms sat on Chrome's rAF noise floor (an empty canvas measures 18.6).
- Tests: `run-tests --app erp_internal` 118 OK; `node tools/lantai.mjs` all cases OK twice (60.0 fps, 0 dropped,
  max 21.2 ms).
- Task 4 (`2b85bf9`): English public names. `erp_internal/production_floor.py` `get_data()`, POST
  `set_status(machine, status)`, event `production_floor`; page `production-floor`; the old Page `lantai-produksi` is
  deleted on migrate (names above are the pre-rename ones). `test_production_floor` 11 OK, suite 118 OK.
- Task 5 (`09da58b`, `f0578e4`): `public/js/lantai/label.js` (labels by textContent, text written once the camera
  rests 120 ms) and `panel.js` (details, Work Order link, six status buttons posting `set_status`, inline refusal
  note, bottom sheet under 760 px); a 700 ms camera flight to the clicked machine; live updates (realtime
  `production_floor` + `doctype_subscribe("Workstation")`, 250 ms debounced full refetch, 60 s poll, `?poll=<s>` for
  tests, nothing fetched while the page or tab is hidden, catch-up on return). `lantai.mjs` cases label, pilih,
  status, wo, xss, set_value, poll, live, id, hidden: all OK; perf 60.0 fps, 0 dropped, max 20.0 ms, 10 draw calls.
- Task 6 (`434f1d8`, `9664463`): `hud.js` (top bar with the company logo and name, live dot, 1 s clock, KPI cards,
  collapsible machine table whose rows select, +/−/home camera bar) and `kaca.js` (liquid glass, light/dark);
  `get_data()` gained `perusahaan`. Labels are glass without blur (14 moving blurred labels broke the dropped-frame
  gate) and label, clock and bar text wait for the camera to rest (a text write during a drag stalls Chrome 50-100 ms);
  without glass support the cards turn solid. `lantai.mjs` cases hud, hud-live, hud-xss, glass added.
- Task 7: Production Floor is the first link of Manufacturing's sidebar and home (`tampilan.SIDEBAR`/`PINTASAN`/`NAMA_LINK`,
  `test_production_floor_in_manufacturing`); `cek_layar.mjs` checks the link, the shortcut and the way back (it now
  stays under `/desk/manufacturing/`, no more `/desk/accounts/`); `.claude/rules/lantai.md`, a section in
  `docs/panduan/produksi.md` with `docs/panduan/gambar/produksi-1.png` (`panduan_gambar.mjs produksi-1`), README,
  CLAUDE.md, the spec's two accepted deviations.
- Image: `docker build -f deploy/Containerfile -t erp-internal:uji .` exit 0, `deploy/check_image.sh erp-internal:uji` OK
  (lantai.bundle.js included).
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal` 122 OK; `node tools/cek_layar.mjs` 3 users OK;
  `node tools/lantai.mjs` all cases OK (perf 59.8 fps, 0.41 % frames over 25 ms, max 36.3 ms, 0 long tasks, 10 draw
  calls, 14,394 triangles; adaptive: pixel ratio 1 after 2.4 s).
- Fix rounds: no empty strip when returning to the floor (a `ResizeObserver` on the page body and sidebar calls
  `fit()`; `lantai.mjs strip` delays the sidebar hide 1.2 s and fails without the observer); review fixes: the
  nudge has an empty payload and skips non-machine Workstations, `set_status` answers a missing and a forbidden
  machine alike, the company name needs read on that Company, page roles Manufacturing User only.
- Final review fixes (commit `fix(lantai): nudge on Work Order progress, resubscribe after reconnect, empty and failed
  floor notes`): Work Order hook is `on_change` (ERPNext sets `produced_qty` and status with `db_set`, which fires only
  that); the nudge goes to the `doctype:Workstation` room (`publish_realtime(doctype=...)` without a docname had been
  broadcasting to every System User, so the subscription did nothing), and the page re-joins it on each socket
  `connect` and in `lanjut()`; an inline note for a failed first load and for an empty floor; the open panel writes a
  node only when its text changed and waits for the camera to rest, `aria-live` moved to the chip and the note; id.csv
  "Live" = "Live"; `states` waits for the lamps' easing instead of a fixed delay; `test_bahasa` skips built bundles
  (a minified three.js has `_("x","y",...)` calls the scanner read as messages after a production `bench build`).
  Tests: `run-tests --app erp_internal` 123 OK; `node tools/lantai.mjs` all cases OK incl. new `reconnect`, `notes`,
  `panel-quiet` (perf 485 frames, 60.0 fps, 2 dropped = 0.41 %, max 30.6 ms, 0 long tasks, 10 draw calls; adaptive
  pixel ratio 1 after 2.4 s); `node tools/cek_layar.mjs` 3 users OK. Abel: restart `bench start` (hooks.py changed).
- Next: Abel looks at the floor in his Chrome (smoothness), adds `erp.localhost` to `/etc/hosts`, restarts `bench start`;
  security review and docs sync of the whole feature; then review and merge.

## 2026-10-28 (Samuel's real master data: catalog and machines)
- `erp_internal/master.py` `muat()` reads `erp_internal/data/katalog.json` (price list "POLA PLASTIK TAHUN 2026",
  Dinda House Ware, 20 products) and `data/mesin.json` (14 machines), idempotent (`docs/impor.md`).
- Items: one template per product in Barang Jadi, brand Dinda House Ware, attributes Jenis/Warna (Ukuran for
  Toples Dinda), only the listed combinations; Sendok Makan split into `SENDOK-MAKAN-PACK` (stock Pack) and
  `SENDOK-MAKAN` (Pcs). Stock UOM Pcs, Lusin 12, Gross 144, Ball/Dus/Ikat per variant from the packing text; four
  "per ball" packings taken from the price ratio (noted). 21 templates, 84 variants.
- Price List `Harga Pola 2026` (selling, IDR): 157 Item Prices. Garpu Makan has none.
- Workstations `Mesin 01`..`14`, type Injection Moulding, custom fields `erp_nomor` (floor order), `erp_merek`,
  `erp_model`, `erp_tonase`, `erp_tahun`, `erp_negara` (`setup.FIELD_MESIN`).
- `setup.py`: UOMs Gross, Ball, Dus, Ikat, Pack; Item Variant Settings `allow_different_uom` 1
  (`PENGATURAN_VARIAN`, `_varian`). `id.csv`: the machine field labels.
- `erp.localhost`: migrate, `muat` twice (282 records written, then 0). Tests: `test_master` 8 OK; full run
  13 unit + 107 integration OK. ruff check/format clean.

## 2026-10-28 (avatar pointer, sidebar fold arrow)
- The sidebar toggle was there but hidden: Frappe v16.53 shows the fold arrow only while the pointer is on
  the panel's 8 px edge (BPT's older Frappe has a "Collapse" button instead). `public/css/erp_internal.css`
  (`app_include_css`, a plain file: no build, no restart) keeps the arrow visible on a desktop and gives the
  Apps screen avatar a pointer. `cek_layar` checks the avatar cursor and, per user, folds the sidebar, reloads
  (still folded) and reopens it: 3 users OK.

## 2026-10-28 (HR home title, workspace saves keep the tiles)
- HR home: our own site Workspace "HR" (`tampilan.RUMAH_SENDIRI`, `_rumah_sendiri`), first in the Shift &
  Attendance sidebar. Page title, breadcrumb and browser tab read "HR" ("SDM" in Indonesian). Route
  `/desk/shift-and-attendance/hr`; the old home's route still opens. `test_rumah_hr`.
- `erp_internal/ruang_kerja.py` + `hooks.override_whitelisted_methods`: Frappe's five workspace writes run, then our
  tile layers on their `app_data`. Checked in the browser as user@ (private workspace saved and deleted: ERP and HR
  with our icons both times). `test_ruang_kerja`.
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal`: 13 unit + 99 integration, OK.

## 2026-10-28 (short screens; sample users on @example.com)
- Sample users are `developer@`, `admin@`, `user@example.com` (`contoh.surel`, tests, tools, docs). On
  `erp.localhost` the three were renamed with `rename_doc` (Employee links follow); no `@contoh.test` user is left.
- Samuel found the module homes far too long. `tampilan.py`: the rail is Stock, Selling, Buying, Manufacturing,
  Projects, HR (`Shift & Attendance`, label) and Settings (Admin); Accounts and Leaves lost their icons (modules
  still allowed: `MODUL_TANPA_IKON`). Homes are shortcuts only (`BLOK_TETAP = ()`: no number or link cards) and
  equal their sidebars (`test_rumah_sama_dengan_sidebar`, `test_rel_pendek`). Payment Entry moved into Selling,
  Order Readiness only in Manufacturing, Sales Order Analysis gone, Stock Reconciliation under Settings as
  "Opening Stock & Stock Count", leave and holidays in HR. `_baris_sidebar` no longer picks the Project and
  Attendance dashboards for the DocType links. The list per module is in README "Screens".
- Guides updated (absen, gudang, produksi, admin menu paths); `panduan_gambar` retook the 6 pictures.
  `cek_layar` now screenshots every home on each user's rail and fails on a non-shortcut widget or more than 10.
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal`: 13 unit + 95 integration, OK; ruff clean;
  `migrate` on both sites. `cek_layar`: 3 users OK (20 home screenshots). No JS/CSS build.

## 2026-10-28 (SVG logo, app tiles renamed)
- `delta-anugrah.svg`: the mark redrawn by hand (one outline, dark 14-unit edge under the blue fill, colours sampled
  from the JPEG: #1f4782, #111216), compared rendered against the JPEG (shape off by under 1 % of pixels). The
  512 px PNG and both favicons are rendered from it (cairosvg via uvx). `setup.LOGO` points at the SVG.
- `tampilan.merek_aplikasi` (`extend_bootinfo`): tiles named ERP, HR, System (id: ERP, SDM, Sistem), each with its
  own icon (Delta-blue rounded square, white Lucide glyph: factory, users, settings; `aplikasi-*.svg`), also on the
  rail's top slot. `test_merek_aplikasi`; `cek_layar` checks each tile's name and icon and the rail's top icon.
- No JS/CSS changed, no build.

## 2026-10-28 (Delta Anugrah logo)
- `erp_internal/public/images/`: the original `delta-anugrah.jpeg` (200 px), a transparent trimmed
  `delta-anugrah.png` (168 px, Pillow via uvx) and `favicon-32.png`, `favicon-192.png`.
- `setup.MEREK` (Website Settings app_name, app_logo, splash_image, favicon; Navbar Settings app_logo) and System
  Settings `app_name` "Delta Anugrah", set in `_pengaturan` on every migrate, saved only on a difference;
  `test_setup.test_merek`.
- Browser (Playwright, developer@): logo on /login, top left of the Apps screen, splash, favicon on login and desk,
  no dialog, page styled. Inside a module the rail's top slot keeps ERPNext's logo (Frappe's per-app mark).
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal`: Ran 91 tests, OK. `uvx ruff check`,
  `uvx ruff format --check`: clean. `migrate` on both sites.
- No JS/CSS changed, no build. Next: a sharper source file from the designer (TODO).

## 2026-10-28 (Revision 4: one company, three roles)
- Samuel's answers (Abel confirmed): one company (PT Delta Anugrah), roles Admin and User (plus Developer), no PKP.
- Code: `Company.erp_aktif` replaces `erp_jenis`, every ticked company gets the factory and the office
  (`setup.perusahaan()`); `tampilan.PROFIL_PERAN` is Developer, Admin, User, Admin's rail adds Setup ("Settings":
  users, Company, business settings); new role `ERP Admin` with User rights (`setup.IZIN_TAMBAHAN`, now
  (doctype, role, permlevel, rights)); new `erp_internal/pengguna.py` keeps an Admin to Admin and User roles and off
  Developer accounts; `proyek.PERAN_ATASAN` is Admin and Developer; `contoh.py` one company, users `developer@`,
  `admin@`, `user@example.com`; `tools/setup_bench.sh` ticks `erp_aktif`.
- Reviewer (general-purpose agent with `.claude/agents/reviewer.md`): no privilege escalation found; fixed
  `setup_bench.sh`, HR saving an Employee linked to a Developer (only access fields are refused now,
  `pengguna.FIELD_AKSES`), a new User under a Developer's name (`cek_user_awal`), `buat_pengguna` clearing
  `block_modules`; added tests for those paths, an unticked company and an Admin submitting someone's timesheet.
- Dev sites: one-off script (not in the repo) on `erp.localhost` deleted PT Contoh Kantor and its sample records,
  the seven `<bagian>@example.com` users, the seven old Role and Module Profiles and the `erp_jenis` field; on
  `erp-test.localhost` only the field. Then `migrate` on both and `buat_contoh` twice on `erp.localhost` (same
  counts both runs: Company 1, User 3, Employee 5, ...).
- Tests: `bench --site erp-test.localhost run-tests --app erp_internal`: 13 unit + 89 integration, all OK.
  `uvx ruff check erp_internal`, `uvx ruff format --check erp_internal`: clean. No JS/CSS changed, no build.
- Browser: `node tools/cek_layar.mjs`: 3 users OK; `node tools/panduan_gambar.mjs`: 6 screenshots retaken as
  `user@` (Purchase Order without a PPN template).
- Docs: CLAUDE.md, README, `.claude/rules/tampilan.md`, guides (who does what; new `docs/panduan/admin.md`), plan
  Revision 4, spec note, TODO, `menunggu-samuel.md`, `deploy/server/README.md` step 8.
- Next: Abel's manual checks in TODO (Admin refused when giving Developer), Task 7 drill, go-live with PT Delta
  Anugrah.


## 2026-10-28 (first run on the sites)
- Tests: `bench --site erp-test.localhost migrate`, then `bench --site erp-test.localhost run-tests --app
  erp_internal`: 13 unit + 77 integration tests, all OK (run 5 of the day; first run 25 ran, 17 failed).
  Per module: absen 5, alur_jual_beli 5, alur_produksi 2, bahasa 6, contoh 5, forecast 9, impor 4,
  order_readiness 9, proyek 5, rumus 13, sales_history 5, setup 7, situs 2, tampilan 13.
- Code fixes: `before_tests` hook completes the test site's wizard (Frappe runs only the tested app's hook);
  `setup.IMPOR_BOLEH` lets Data Import take Stock Reconciliation; Gudang has Stock User and Manufacturing User
  reads Company (`IZIN_TAMBAHAN`); `tampilan.saring_aplikasi` (`extend_bootinfo`) hides an Apps screen tile with
  nothing on the user's rail (HR's ERPNext tile opened a blocked module); `tests.utils.buat_pengguna` saves only
  on a change, so a `buat_contoh` rerun writes nothing.
- Test fixes (expectations wrong for v16): amended copy's docstatus, `selected_items` rows in Sales Forecast Item,
  shift times as `timedelta`, the Employee role needs an Employee record, a Karyawan's own-Employee permission
  refuses another's timesheet at insert, Sales History test rows committed by the importer.
- `erp.localhost`: migrated, `bench build --app erp_internal`, `erp_sandi_contoh` set (password only in the
  bench's `.env` as `SAMPLE_PASSWORD`), `buat_contoh` run twice: the second run changed no row in any table.
- `node tools/cek_layar.mjs` (Playwright 1.49.1, Chromium installed): 7 bagian OK, 21 screenshots in
  `tools/hasil/` checked (full width, only the bagian's rail and Apps screen, no message dialog). Script fixes:
  open the module home by its Workspace, count only message dialogs, check Apps screen tiles.
- Dry runs of the go-live tasks 8, 14 and 17 on `erp.localhost` (results in the plan under each task): imports
  through the worker, the PPN switch, an order to payment as Penjualan, Fill from History → MPS → MRP → Work Order
  as Produksi, Order Readiness checked by hand for 5 products, employee import, check-in, auto attendance,
  a timesheet as Karyawan. Not run: Task 7's compose boot, backup and restore drill (needs the root password).
- Next: Abel runs Task 7 Steps 2-4, takes the guide screenshots, tries the buttons in the browser and a phone
  check-in.

## 2026-10-28 (security fixes)
- 731d843: Order Readiness checks Company read, and the Warehouse's company and read, before reading Bin, Sales
  Order and Work Order (2 new tests).
- 4e815e4: `erp_internal/proyek.py`, Timesheet `before_submit`: an Employee submits only their own timesheet
  (`test_timesheet_orang_lain_ditolak`).
- Tests not run: no site yet.

## 2026-10-28 (evening): Tasks 15, 16 and the sample data, no site yet
- Task 15: `setup._kantor()` (HR Settings mobile check-in and geolocation on; shift "Kantor" 08:00-17:00 with auto
  attendance from `SHIFT_KANTOR`; per office company "Libur <abbr> <year>" for this year and next, Saturday and
  Sunday off, with a submitted company Holiday List Assignment, which v16 HRMS reads instead of the company default;
  leave types Cuti Tahunan 12, Sakit, Izin unpaid); `tests/test_absen.py` (5 tests); `buat_karyawan`,
  `penugasan_shift`, `jatah_cuti`; `docs/panduan/absen.md`. Tests not run: no site yet.
- Task 16: `setup._proyek()` (Activity Types Pengembangan, Rapat, Dukungan Klien, Administrasi without rates; the
  Employee role may submit Timesheets, `IZIN_TAMBAHAN`); `tests/test_proyek.py` (5 tests, incl. the own-timesheet guard, 4e815e4); `docs/panduan/proyek.md`.
  Tests not run.
- Revision 3 item 4: `erp_internal/contoh.py` `buat_contoh()` (both sample companies, 9 items with BOMs, lead
  times and stock, 3 customers, 2 suppliers, 6 months of Sales History, 4 open orders, 7 users, 5 employees on the
  shift with annual leave, one project with 3 tasks; tag DATA CONTOH; refused with `erp_produksi`, needs
  `erp_sandi_contoh`); `tests/test_contoh.py` (5 tests). Not run on any site.
- Checked without a site: `uvx ruff check`, `ruff format --check`, `py_compile`; imports with the bench's Python;
  every fieldname and Select value against the v16 JSON (Shift Type, HR Settings, Leave Type, Holiday List,
  Holiday List Assignment, Activity Type, Timesheet); `process_auto_attendance`, Employee Checkin, Leave
  Application and Timesheet read in the source; the tests' date helpers for every weekday; Frappe's
  `extract_messages_from_python_code`/`_javascript_code` find an `id.csv` row for every string of the app.
- Next: Abel creates the sites; `/run-checks`; `buat_contoh` on `erp.localhost`; `cek_layar`.

## 2026-10-28 (later): Part B, Tasks 9-13, no site yet
- Task 9: DocType `Sales History` (module `Planning`), unique per company, item and month (validate +
  `unik_riwayat` constraint); `tests/test_sales_history.py` (5 tests), `tests/data/riwayat.csv`, `docs/impor.md`
  section 5. Checked: `ruff check`, `ruff format --check`, `py_compile`, JSON valid, offline scan that every label,
  role and `_()` string has an `id.csv` row. Tests not run: no site yet.
- Task 10: `planning/rumus.py` (`bulan_acuan`, `rata_rata`, `bulatkan`, `ada_riwayat`), `tests/test_rumus.py`.
  Run with the bench's Python and no site (`frappe.local.session` stubbed): 6 tests OK.
- Task 11: `planning/forecast.py` (`qty_per_bulan`, `isi`, `isi_dari_riwayat`), the "Fill from History" button
  (`public/js/sales_forecast.js`, `doctype_js`), `tests/test_forecast.py` (9 tests), `buat_order`,
  `buat_perkiraan`, `akar_gudang`. Checked: ruff, `py_compile`, `node --check`, import with the bench's Python,
  translation scan. Tests and the button not run: no site yet.
- Task 12: `setup._produksi()` (Company default WIP/FG/scrap warehouses per factory, backflush by BOM, Item Group
  default warehouses), `tests/test_alur_produksi.py` (2 tests: defaults, forecast → MPS → MRP → Work Order →
  stock), `buat_bom`, `lama_produksi`, `docs/panduan/produksi.md`. v16 differences: the WO defaults live on
  Company, and the MRP report spreads a monthly forecast over daily rows (test sums them). Tests not run.
- Task 13: `rumus.STATUS`, `hitung_kurang`, `hitung_jadwal`; Script Report `Order Readiness` (ref doctype Sales
  History, JS colours and Indonesian statuses by context); `tests/test_order_readiness.py` (9 tests, incl. 2 permission tests, 731d843),
  `test_tampilan.test_izin_order_readiness`. `tests/test_rumus.py`: 13 unit tests OK without a site. Checked:
  ruff, `compileall`, `node --check`, JSON, Frappe's own extractors find a row for every string, the spec's
  lead time (`get_own_lead_time` 870 / 200 + 1 = 5.35). Integration tests not run: no site yet.
- Next: Abel creates the sites; run every test (`/run-checks`), fix what fails, `bench build`, try Fill from
  History and Order Readiness in the browser; then `contoh.py`.

## 2026-10-28: Tasks 5, 6, 7 written, no site yet
- Task 5: `setup._alur_jual_beli()` (order-first selling and buying, no negative stock, FIFO, perpetual inventory
  off per factory, PPN accounts and templates, not default); `tests/test_alur_jual_beli.py` (5 tests);
  `tests/utils.py` `buat_pemasok`, `daftar_harga`, `stok_awal`; guides `docs/panduan/{penjualan,pembelian,gudang}.md`
  (no screenshots yet). Checked: `py_compile`, `ruff check`, `ruff format --check`; the settings fields, mapper
  paths and refusals read in the v16 source. Tests not run: no site yet.
- Task 6: `tests/utils.impor_csv`, `tests/test_impor.py` (4 tests), `tests/data/{barang,pelanggan,pemasok,stok_awal,
  barang_salah}.csv`, `docs/impor.md`. Headers built from v16's `exporter.py` (no site to download from); v16.53
  blocks a file with an unknown link before importing, so the wrong-file test reads `template_warnings`.
  Checked: `py_compile`, ruff. Tests not run: no site yet.
- Task 7: `deploy/Containerfile`, `deploy/check_image.sh`, `.github/workflows/image.yml`, `.dockerignore`,
  `deploy/server/{docker-compose.yml,.env.example,cadangan.sh,README.md}`. `docker build` passed locally (arm64,
  ~20 min, 5.43 GB) and `check_image.sh` printed OK with the three pinned tags. `docker compose config` and
  `shellcheck` clean; `cadangan.sh` dry run with a stub docker and a local rclone remote passed. Not run: compose
  boot, real backup and restore drill (need `new-site`, i.e. a database root password).
- Next: Abel creates the sites; run every test; fix what fails; then Task 8's local dry run.

## 2026-10-27 (night): Tasks 2, 3, 4, 4b written, no site yet
- Task 2: `setup.pastikan_setup()` on `after_install`/`after_migrate` (System Settings, sign-up and OAuth
  registration off, Global Defaults, `Company.erp_jenis`, item groups, UOMs, factory warehouses);
  `tests/test_setup.py` (5 tests), `tests/utils.py`. The `wizard` part now sets Jenis and migrates.
  Checked: `py_compile`, `ruff check`, `ruff format --check`; every fieldname read in the v16 JSON under `apps/`.
  Tests not run: no site yet.
- Task 3: `tampilan.terapkan()`. v16.53 has no icon grid on the default Apps page, so the tables write site layers:
  a `Dock` layer per app (`IKON`), a `Custom Sidebar` per module (`SIDEBAR`), one Module Profile per bagian
  (`MODUL_BOLEH`) and the Role Profiles (`PROFIL_PERAN`). `tests/test_tampilan.py` (9 tests). Checked offline: the
  tables against the shipped dock/sidebar/DocPerm JSON, and the dock and sidebar layers merged with Frappe's own
  `resolve_layers`/`merged_arrangement` (all 8 sidebars and both docks as expected). Tests not run.
- Task 4: `translations/id.csv` (the plan's table plus our own strings), `bahasa.ganti` and the user-menu switch
  (`standard_navbar_items` in `hooks.py`, `public/js/erp_internal.bundle.js`); `tests/test_bahasa.py` (5 tests).
  Checked: every `_()`/`__()` string and menu label has a row (regex scan), `node --check`. Tests not run.
- Task 4b: full width by default (bundle), module homes as `Custom Workspace` (`PINTASAN`), shorter forms
  (`SEMBUNYI`, 89 fields on 10 forms), Company default warehouse and default Company permission
  (`setup._bawaan`), `tools/cek_layar.mjs` + `tools/package.json`. Checked offline: every `SEMBUNYI` field exists
  and is not required, every `PINTASAN` target exists except Order Readiness (Task 13), every stats filter
  evaluates in Node, every label has an `id.csv` row. Tests and `cek_layar` not run.
- Next: Abel runs `tools/setup_bench.sh sites wizard`; then `/run-checks` (all tests), fix what fails, then
  Task 5. `cek_layar` waits for `contoh.py`.

## 2026-10-27 (evening)
- Design and plan written; repo `delta-anugrah/erp-internal` created (private). `main` needs a PR, so work goes on
  branch `feat/lokal`.
- Revision 2: English UI by default with an Indonesian switch, full width, friendly screens.
- Revision 3: everything local first; Samuel's questions have defaults (`docs/menunggu-samuel.md`).
- Task 1 (`421bf7c`): MariaDB `erp-mariadb` on 3308, bench at `~/Desktop/Projects/erp-internal-bench` on the pinned
  v16 tags, app scaffolded and linked, `tools/setup_bench.sh`, setup-bench skill. Sites not created yet: `bench
  new-site` was refused by the permission check, so Abel runs `tools/setup_bench.sh sites wizard`. Tests not run.
