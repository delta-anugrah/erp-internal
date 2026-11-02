# TODO

Order follows the plan (`docs/superpowers/plans/2026-10-27-erp-internal-plan.md`, Revisions 4, 2 and 3 first).

Last full run (2026-10-29, after the sample data rerun fix): `bench --site erp-test.localhost run-tests --app erp_internal`:
214 tests (13 unit + 201 integration, 2026-11-01), all OK. `node tools/cek_layar.mjs`: 3 users OK, every home shortcuts only (cap
`PINTASAN_MAKS` raised 10 to 12: Manufacturing has 12, Setup 11).

## Next: a simpler User role (Samuel 2026-11-02)
Samuel agreed: User records only the three daily jobs, everything else is view only; purchasing and selling are not
used for now. Admin makes Work Orders, BOMs and master data (items, customers, machines).
- [ ] User may create, edit and submit only: Production Entry (daily output), Delivery Note made directly (no Sales
      Order), Stock Entry Material Receipt (raw material in, no Purchase Order). Today User can still make and delete
      Work Orders, BOMs, Sales/Purchase Orders and more (the PDF Abel sent Samuel lists it).
- [ ] User reads only: Production Floor, stock (Stock Balance, Stock Ledger, Item, Warehouse), Plan vs Actual, Order
      Readiness, Work Order. Selling, Buying, Projects and HR leave User's rail.
- [x] User may change a machine's status on the Production Floor (Samuel 2026-11-02): keep it as it is.
- [ ] Check a Stock Entry limited to Material Receipt for User (ERPNext gives one permission for every Stock Entry
      type; Production Entry makes its own Manufacture/Repack entries as the current user, so they must keep working).
- [ ] Admin: Work Order, BOM, Item, Customer, Supplier, Workstation, Machine Capacity (unchanged, already full).
- [ ] Guides: `docs/panduan/gudang.md` (raw material in by Stock Entry, delivery without Sales Order),
      `penjualan.md`/`pembelian.md` marked "not used yet", a short User guide of the three jobs; `cek_layar` and the
      role tests (`test_izin_per_profil`) follow.
- [ ] Rebuild the access PDF (`Hak-Akses-ERP-Delta-Anugrah.pdf`) from the new permissions for Samuel.

## Next: item-to-machine list into Machine Capacity (Samuel 2026-11-02)
Samuel's Excel `Perhitungan & Penjualan Barang Plastik (1).xlsx` (Abel's Downloads, 2026-11-02) has a new sheet
"Mesin & Kapasitas": No. Mesin, Kapasitas (tonnage), Barang Cetak; the machine cell is merged over its items.
33 pairs on 6 machines: 2 (180 Ton), 3 (260 Ton), 4 (210 Ton), 5 (160 Ton), 6 (160 Ton), 8 (360 Ton). One item may
run on several machines (Pot Bunga on 2, 4 and 6). Sheet "Bahan Baku" keeps cycle time, cavities, kg per pcs and material.
- [ ] Copy the sheet into `erp_internal/data/` (json, like `penjualan_2026.json`) and load it: one Machine Capacity row
      per item and machine from the `spesifikasi` already kept, then `buat_bom_kapasitas`. Idempotent, with a test.
- [ ] Match "Barang Cetak" names to our Item templates (e.g. "Gantungan Flash ( 2 )", "Body PLN", "Stik Folding",
      "Body/Tutup Toples Nastar"); list the ones with no item for Samuel.
- [ ] Ask Samuel (`docs/menunggu-samuel.md` row 12): machines 1, 7 and 9-14 are not in the list (idle, or not filled
      in yet?); is "( 2 )"/"( 4 )" after a name the cavity count of that mould (cycle time and cavities may differ per machine)?
- [ ] Workstation tonnage (`Kapasitas`) on Mesin 02..08 if `mesin.json` lacks it.
- BS (reject) answered 2026-11-02: every reject is reground and moulded again, no material is counted as wasted. The
  current flow already counts the reject's material as used (Repack into Gudang Reject); nothing to change for now.

## Plan vs Actual (docs/superpowers/plans/2026-10-29-plan-vs-actual-plan.md)
- [x] Task 1: Machine Capacity and the lookup (`kapasitas.py`, `test_kapasitas`)
- [x] Task 2: BOMs from capacity (Make BOMs button)
- [x] Task 3: Excel import of capacity (`impor_kapasitas.py`, `test_impor_kapasitas`)
- [x] Task 4: Production Entry (stock entries, cancel; `test_hasil_produksi`)
- [x] Task 5: Plan vs Actual report (`planning/report/plan_vs_actual/`, `test_plan_vs_actual`)
- [x] Task 6: sample capacity, BOMs and production entries in `contoh.py` (`test_contoh` 7 OK), docs, full run
- [x] Abel, in the browser on `erp.localhost` (the sample data is there): Machine Capacity list, "Import from Excel"
      with `erp_internal/tests/data/kapasitas.xlsx` (Preview, then Apply; check the BOMs it makes). Done 2026-10-31 with a file of the sample rows (that test file
      only refuses: its items exist only during tests); the dialog now closes after Apply unless a row is Refused.
- [x] Abel: open a Work Order and use its button to record output (good qty, rejects, shift); check the stock entries
      and the order's produced qty.
- [x] Abel: open Plan vs Actual in both target modes (a Work Order's planned days, and Machine Capacity when the order
      has no plan) and group it by Machine, Day, Item, Work Order and Shift; then again in Indonesian.

## Waiting on Abel
- [x] A Work Order's machine changes only while Not Started / In Process (Abel 2026-10-31: lock it). `kapasitas.kunci_mesin`,
      `test_kunci_mesin`; Playwright: read-only on a Completed order, editable In Process.
- [x] In the browser: Machine Capacity list → Import from Excel (Preview, Apply), Make BOMs, Record Output on a Work
      Order, Plan vs Actual in both target modes, in Indonesian too. Done 2026-10-31 (the three items above).
- [x] Task 7 Steps 2-4 (compose boot, `cadangan.sh` against it, restore drill), 2026-10-31 on the Mac with the
      Makefile (the passwords generated into a local `.env`): fresh site, backup, restore drill with equal counts
      (`deploy/server/README.md`). The same again on the DigitalOcean server at go-live.
- [x] Look at the screens in Indonesian once (switch the language in the user menu) and click Fill from History and
      Order Readiness in the browser: their server side ran in the dry runs, the buttons were not clicked. Playwright 2026-10-31 as `user@` in Indonesian: Fill from History (6 rows, message in Indonesian), Order Readiness (102 rows, no template), Sales Order, Work Order, Stock Balance, Production Entry: no dialog, no page error.
- [x] Take the `docs/panduan/` screenshots (`docs/panduan/gambar/*.png`, 6 for penjualan, pembelian, gudang, plus `produksi-1`;
      retake with `ERP_SANDI=<password> node tools/panduan_gambar.mjs`). `absen.md` and `proyek.md`
      reference no picture yet; `produksi.md` has `produksi-1.png` (the Production Floor).
- [ ] Deferred (Samuel 2026-10-31: the office uses fingerprint, HR not a priority; location needs https, so test on the server): try the phone check-in (`/hrms`, Add to Home Screen) as `user@example.com` on a real phone. The sample
      password is `SAMPLE_PASSWORD` in `~/Desktop/Projects/erp-internal-bench/.env`.
- [x] Sign in as `user@` and `admin@example.com`: User has no Settings, Admin does; full width. `cek_layar` 3 users OK 2026-10-31.
- [x] As `admin@`: create a user with Role Profile User, then try to give it Developer (must be refused). Playwright/API 2026-10-31: Developer refused (403, "You cannot give these roles").
- [x] As `user@`: Sales Order → Delivery Note → Sales Invoice → Payment Entry ends Paid. API as `user@` 2026-10-31: SAL-ORD-2026-00007 → MAT-DN-2026-00003 → ACC-SINV-2026-00003 Paid (ACC-PAY-2026-00002). Found: the default price list was the empty Standard Selling (Rate 0), fixed in `master._harga_bawaan`.
- [ ] Optional: the official vector logo from the designer. `delta-anugrah.svg` is our redraw of the 200 px JPEG;
      replace it under the same name and rerender the PNGs (no code change).
- [ ] Add `127.0.0.1 erp.localhost` to `/etc/hosts` (sudo): Node's socket.io can't resolve `*.localhost` on macOS,
      so live updates (Production Floor) fall back to a 60 s poll without it.
- [x] Review and approve PR #1 (`feat/lokal` → `main`) and the Production Floor plan (PR approved by Abel 2026-10-31)
      (`docs/superpowers/plans/2026-10-28-production-floor-plan.md`).
- [x] In the browser: the Delta Anugrah logo and the ERP/HR tiles, the HR home titled "HR", the sidebar arrow folds
      and opens (and stays after a reload), the avatar shows a pointer. `cek_layar` (tiles, fold kept after reload, rail logo) + Playwright (HR home title "HR", avatar cursor pointer) 2026-10-31.
- [x] As `admin@`: open a few catalog items (e.g. Gayung Lumba-Lumba) and check variants, UOMs and the prices in
      `Harga Pola 2026` against Samuel's list. 2026-10-31: every variant, price and packing of `data/katalog.json`
      (the paper list) against `erp.localhost`, 228 matches, 0 differences; the item form opens as `admin@`. The
      Soft types from the sales Excel have no price yet (`docs/menunggu-samuel.md` row 14c).
- [x] After each Production Floor task that runs `bench build`: restart `bench start`, then look at the floor in your
      own Chrome and say whether it feels smooth. Abel 2026-10-31: smooth in his Chrome.
- [ ] Production Floor (`/desk/production-floor`, signed in as `user@example.com`): Ticked items: `lantai.mjs` 2026-10-31 (states, label, pilih,
  status, live, reconnect, hud, perhatian, dekor-gelap, glass, memuat, strip, id, 13-machines, no-webgl, zona; all OK). perf
  60 fps but 1.65-2 % frames over 25 ms (budget 1 %) with the Mac at load 12-20 from other Docker projects.
  - [x] 14 machines in two rows: back 14 13 12 11 10 9 8, front 1 2 3 4 5 6 7.
  - [x] Orbit (drag), zoom (scroll), pan (right drag), then the home button in the camera bar: smooth, no stutter, no error dialog. Abel 2026-10-31.
  - [x] They look like injection moulding machines; JSW, NISSEI and CHENDE in different colours. Abel 2026-10-31: layout fine.
  - [x] Set a machine's status in its Workstation form (Production, Problem, Maintenance, Off), reload the floor:
        green lamp + mould moving + breathing green ring + lit screen, red blinking, blue + dimmed, unlit + darker. Put the status back.
  - [x] Go to another page and come back 5 times: still smooth, the laptop fan stays quiet. Abel 2026-10-31.
  - [x] Labels like "03 · NISSEI 260T" show a status chip, and the Work Order item and progress when one runs.
  - [x] Click a machine: the camera flies to it and a side panel opens (a bottom sheet on a narrow window).
  - [x] Press one of the six status buttons in the panel: the machine changes. Put the status back.
  - [x] Change a status in the Workstation form: the floor follows without a reload (or within 60 s without
        `/etc/hosts`).
  - [x] Top bar: company logo or initials and name, "Live" dot, date and a ticking clock; KPI cards (machines,
        running, problem, Work Orders running, output) match what you see.
  - [x] Machine table (top left, under the bar), with the "Needs attention" card under it: click a row, the camera flies to that machine and the panel opens; the arrow
        folds it and it stays folded after a reload; +, − and home buttons work.
  - [x] Switch Desk to dark (user menu): the cards, labels and text stay readable; same in Indonesian. The building, truck and floor lettering turn dark too.
  - [ ] Labels shrink to a chip where they would overlap and never sit under a card.
        2026-10-31: `lantai.mjs label-rapi` fails one check: dollying out, four front labels change in two steps
        (06 first, 03/05/07 on the next camera move) and the test reads the first step as a flip; nothing flips back.
  - [x] A loading card shows until the floor is ready.
  - [x] Manufacturing in the rail: "Production Floor" is the first link in the sidebar and the first shortcut on
        the home; it opens the floor.
  - [x] Go to a Work Order and come back (sidebar link and browser back): the floor fills the screen, no empty strip.

## Production Floor, next round (Abel, 2026-10-28 22:32)
Plan: `docs/superpowers/plans/2026-10-29-production-floor-richer-plan.md` (spec Revision 2).
- [x] Labels overlap from the default camera (08/09, 05/06): spread or stack them so none covers another.
- [x] Zoomed in, the KPI cards cover the back row's labels: hide or fade a label under a card, or keep labels out
      of the cards' area.
- [x] The floor looks too empty and plain next to BPT Live. Make it richer and livelier: a factory building around
      the floor (walls, roof edge, doors), material and product areas (resin bags by the hoppers, product crates,
      a dryer or mould rack), forklift and operator figures, floor markings, light from the windows. Keep the
      smoothness budget (`.claude/rules/lantai.md`); plan it first (spec revision, then tasks).
- [x] Abel: look at the fuller floor (light and dark, a phone width) and say if the left column, the attention card and
      the loading screen are right. Abel 2026-10-31: the layout looks fine. Also: the default view fits the 14 machines; Raw Material sits under the left column and Reject, grinder, door and truck are off-screen. Say whether the default view should show the whole building.
- [ ] Parked (forklift removed 2026-10-29), only if it comes back: the forklift's rear corner stands about 0.5 m on the end of the "Finished Goods" lettering at its jadi stop
      (`denah.js` JALUR stop 28.3, -7, arriving at about 45°). Move the stop to z <= -9 or x >= 30 and add a body-footprint
      check against the lettering plates to `tools/denah.test.mjs`.
- [x] 2026-10-29: `erp.localhost`'s company renamed PT Contoh Plastik → PT Delta Anugrah (abbreviation CPL kept) with the logo
      (`contoh._logo`), so the floor's top bar shows both. At go-live the wizard makes PT Delta Anugrah; attach the logo there too.
- [x] 2026-10-29: Running reads apart from Idle (breathing green ring, lit screen; Idle dimmer with a dark screen).
- [x] Abel: look at the floor in your own Chrome (restart `bench start` first): is Production vs Idle clear enough now?
      2026-10-31 by Playwright (Abel's ask), 02/04/06 set Idle and put back: yellow chip, no green ring, listed in Needs
      attention; Production keeps its green ring and lit screen.

## Abel 2026-10-29 evening (next session, in order)
- [x] Commit this session's work (company rename + logo, Running vs Idle, `penjualan.py`).
- [x] Production Floor: turn machines 01-07 like 08-14 (lamps visible); Problem's red lamp blinks clearly.
- [x] Production Floor: remove the forklift for now.
- [x] Hide IDs users don't need (Sales History's hash name first; sweep the other forms). Only Sales History and
      Machine Capacity are hash-named; Production Entry's `PE-…` stays (a document number). Company hidden too (2026-10-30, Abel).
- [x] Order Readiness: leave template items out (`has_variants` 0; `test_template_tidak_ikut`).
- [x] Desk sidebar: the collapsed sidebar's expand button is tiny and covered (now a 32 px button in the dock; `cek_layar` checks it).
- [x] Fitting icons for our sidebar links (`tampilan.IKON_LINK`, every shown link of every sidebar; `test_ikon_sidebar`).
- [x] Makefile for the server setup (`deploy/server/Makefile`: `make env`, `make setup`; dry run on a Mac with fakes). A real run waits for the server.
- [x] "Production floor di desk": done as the default, a Production Floor tile on the Apps screen (opens `/desk/manufacturing/production-floor`). Abel confirmed 2026-10-30.

## Waiting on Mas Samuel
- See `docs/menunggu-samuel.md`. Nothing there blocks the local build.
- [ ] Plan vs Actual: reject types (`docs/menunggu-samuel.md` row 10): no answer, keep the defaults (editable list).
      Shifts answered 2026-11-02: two of 12 h (done). Runner: answered 2026-10-29, thrown away (default kept).
- [ ] Capacity: which item runs on which machine (asked 2026-10-29; 2026-11-02: each item has its machines, ask for the list). Samuel's Excel (2026-10-29) gave cycle time,
      cavities, kg per pcs (the "Gr" header is kg), material and its price per kg, and Jan-Sep 2026 sales per item.
- [x] 2026-10-29: that Excel's sales history, raw materials with their price and minimum stock (`penjualan.muat`, run on
      `erp.localhost`: 513 Sales History rows over 90 variants, 7 raw materials; `test_penjualan` 7 OK).
- [ ] Ask Samuel `docs/menunggu-samuel.md` rows 13-14 (Ball Kecil and Pack contents, colours of the new types, which
      price is the selling price).
- [x] Abel: Sales History list (group by Month) and Order Readiness with the new minimum stock on `erp.localhost`. 2026-10-31: list in Indonesian, 9 months Jan-Sep 2026, 90 items with a minimum stock; Order Readiness above.

## Master data
- [x] Samuel's catalog and machines (`erp_internal/master.py`, `test_master` 9 OK; run twice on `erp.localhost`,
      the second run writes nothing): 21 templates, 84 variants, 157 prices in `Harga Pola 2026`, `Mesin 01`..`14`.
- [ ] Still from Samuel (`docs/menunggu-samuel.md` row 4): capacity per product per machine (cycle time, cavities),
      mould per machine, raw material per product (kg per pcs, PP/HDPE, masterbatch), minimum stock, spoons per
      Sendok Makan pack; confirm the "per ball" contents taken from prices and Gantungan Dinda Super's Dus price.
- [ ] At go-live: the items are loaded into the default company's setup (PT Delta Anugrah, CPL, on `erp.localhost`);
      on PT Delta Anugrah's site rerun `muat` after the wizard.

## Part A: foundation and the factory
- [x] Task 1: repo, bench, sites, app (sites by Abel; test site's wizard now via our `before_tests` hook)
- [x] Task 2: site setup on every migrate (`test_setup` 7 OK)
- [x] Task 3: only the used modules (`test_tampilan` 13 OK; Gudang gained Stock User, Apps screen tiles filtered)
- [x] Task 4: English default, Indonesian switch (`test_bahasa` 6 OK)
- [x] Task 4b: friendly screens (`cek_layar` 3 users OK after Revision 4, screenshots checked)
- [~] Task 5: sales and purchasing flow (`test_alur_jual_beli` 5 OK; guide screenshots still to take)
- [x] Task 6: import guide (`test_impor` 4 OK; Stock Reconciliation import allowed by `setup.IMPOR_BOLEH`; headers
      equal the site's Download Template)
- [~] Task 7: server image, compose, backups (image, compose boot, backup and restore drill done locally
      2026-10-31; the server itself waits on Samuel's budget and domain)
- [~] Task 8: go-live wave 1 (local dry run done 2026-10-28; the real go-live waits on Samuel: PT Delta Anugrah,
      tick `erp_aktif`, users as Admin or User)
- [x] Revision 4: one company, three roles (`test_pengguna` 9 OK, `test_tampilan` 14 OK)

## Part B: production and forecast
- [x] Task 9: Sales History (`test_sales_history` 5 OK, twice in a row)
- [x] Task 10: forecast math (`test_rumus` 13 unit tests OK under `bench run-tests`)
- [x] Task 11: Fill from History (`test_forecast` 9 OK; server method ran in the Task 14 dry run)
- [~] Task 12: production flow (`test_alur_produksi` 2 OK; guide screenshots still to take)
- [x] Task 13: Order Readiness report (`test_order_readiness` 9 OK; checked by hand in the Task 14 dry run)
- [~] Task 14: go-live wave 2 (local dry run done 2026-10-28; the real go-live waits on Samuel)

## Part C: office
- [x] Task 15: attendance (`test_absen` 5 OK; check-in and auto attendance in the Task 17 dry run)
- [x] Task 16: projects (`test_proyek` 5 OK)
- [~] Task 17: go-live wave 3 (local dry run done 2026-10-28; the real go-live waits on Samuel)
- [x] `erp_internal/contoh.py` sample data (`test_contoh` 5 OK; run twice on `erp.localhost`, the second run writes
      nothing)
