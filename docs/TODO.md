# TODO

Order follows the plan (`docs/superpowers/plans/2026-10-27-erp-internal-plan.md`, Revisions 4, 2 and 3 first).

Last full run (2026-11-23, plan Task 2: Produksi records production only): 262 tests (13 unit + 249
integration), all OK; `cek_layar` 3 users OK. Before that (Task 1, profile rename): 265 tests, all OK. Before that
(price list defaults): 263 tests (13 unit + 250 integration), all OK. Before that
(2026-11-06, make setup / make up): 263 tests, all OK. Before that
(2026-11-04, HR DocTypes locked): `run-tests --app erp_internal` 262 tests (13 unit + 249 integration), all
OK (then `test_modul_mati` 11 OK after the Employee form fix); before that (module and report lock) 260 tests, all OK; `cek_layar` 3 users OK (back button and unused modules included); `lantai.mjs` all OK (60 fps). Before that
(2026-11-03, app version): 252 tests, all OK; `cek_layar` 3 users OK (login and Settings version included). Before that (one-command setup): 248 tests, all OK.
Before that (2026-11-03, accordion menu): `run-tests --app erp_internal` 239 tests (13 unit + 226 integration),
all OK; `cek_layar` 3 users OK (menu checks included); `lantai.mjs` all OK (pilih and perf rerun alone: during the
full run they failed on load); `denah.test.mjs` 6 OK.
Before that (2026-11-03, guide pictures): 233 tests (13 unit + 220 integration), all OK; since then
`test_set_status_mesin_tidak_aktif` (module `test_production_floor` 16 OK, twice) and `test_akun` 2 OK.
Before that (2026-11-02, item-to-machine list): 232 tests (13 unit + 219 integration), 231 OK + 1 fixed and rerun.
Before that (2026-11-02, after the simpler User role): `bench --site erp-test.localhost run-tests --app erp_internal`:
222 tests (13 unit + 209 integration), all OK. `node tools/cek_layar.mjs`: 3 users OK, every home shortcuts only.

## Next: Samuel's requests of 2026-11-23 (decisions in `docs/menunggu-samuel.md`, 2026-11-23 table)
- [x] Commit the price list default fix, after `/run-checks` (2026-11-23: 263 tests OK).
- [x] Spec `docs/superpowers/specs/2026-11-23-permintaan-samuel-design.md` (items 1-5, 7, plus Abel's attachments and
      pigment; Samuel's two pictures beside it) and plan `docs/superpowers/plans/2026-11-23-permintaan-samuel-plan.md`
      (12 tasks), 2026-11-23.
- [ ] Abel: read the spec's "Calls made" (11) and agree or change them before the build.
- [x] Plan Task 1: profiles renamed Super Admin / Admin / Produksi (`9cc5116`, patch `profil_tiga`).
- [x] Plan Task 2: Produksi records production only (`ERP User` alone), Admin only views it, `batas_user.py`
      removed, Finish on a Work Order Super Admin's only, new Work Orders skip the transfer.
- [x] Plan Task 3: Work Order machine lock (`kapasitas.mesin_terdaftar`, `cari_mesin`).
- [x] Plan Task 4: warehouse Pluit (`GUDANG_JUAL`, `pengiriman.ikut_gudang`, Order Readiness sums both).
- [x] Plan Task 5: real documents attached (`lampiran.py`, report Missing Documents, `test_lampiran`).
- [x] Plan Task 6: Daily Input server (`daily_input.py`, one Production Entry per cell, `test_input_harian`).
- [ ] Build the plan's remaining tasks:
      Daily Input page like Samuel's Excel with print and Excel; monthly expenses (operator shifts
      from the daily input); PO print; pigment.
- [ ] Item 6 Seal Cap (Rp23/Rp24 by machine, brand codes, M1x machines): waits for Samuel's lists.
- [ ] DigitalOcean server in its own session (backups admin PC + Cloudflare R2; domain later).
- [ ] Test everything together, then demo videos (Produksi, Admin) and the new admin's onboarding.

## Next: one-command setup with questions, wizard automatic or by hand (Abel, 2026-11-03)
- [x] Spec `docs/superpowers/specs/2026-11-03-setup-tanya-jawab-design.md` (builder check done, Abel's answers in).
- [x] Plan `docs/superpowers/plans/2026-11-03-setup-tanya-jawab-plan.md`, built (Tasks 1-6): `make up`, `make setup`,
      `make dev`, `erp_internal/wizard.py`; end to end on the Mac, automatic and by hand (PROGRESS 2026-11-03).
- [x] `make setup` once after the clone (the questions and the whole setup), `make up` only starts (Abel 2026-11-05).
- [x] `make setup`, then `make up`, from a fresh clone on the Mac: automatic and by hand (2026-11-06, PROGRESS).
- [ ] The same on Samuel's Windows/WSL.
- [x] By-hand ending now says "When the wizard is done, run make up here" (`make setup` on the server) instead of
      "wait a minute": the wizard's own jobs kept the background load waiting over 3 minutes (Abel 2026-11-06).
- [ ] On the real server: `make setup` (needs the server, Samuel question 6).
- [x] The app version (`v0.0.1`) under the login card and at the foot of the Settings dialog's left menu
      (`erp_internal/versi.py`, `public/js/versi.js`); the image workflow refuses a tag other than
      `v` + `erp_internal.__version__`. Tests `test_versi`, `cek_layar` checks both.
- [ ] Abel: look at the version on the login page and in Settings (avatar menu, My Settings).
- [x] Unused modules locked (`tampilan.MODUL_MATI`, Abel 2026-11-04): no menu, search or URL for anyone but Administrator.
- [x] HR's unused DocTypes locked the same way (`tampilan.DOCTYPE_MATI`, Abel 2026-11-04): recruitment, appraisal,
      training, expenses, travel, lifecycle, vehicles, skills, overtime; attendance, shift and leave stay open.
- [ ] Abel: as Admin, open HR (Attendance, Leave Application) and check nothing you use is gone.
- [ ] Then the same setup work for BPT, then the sawit autoerp, one at a time in their own sessions.

## Done: one labelled menu instead of the icon rail (Abel, 2026-11-03)
- [x] Spec `docs/superpowers/specs/2026-11-03-sidebar-accordion-design.md`, plan `docs/superpowers/plans/2026-11-03-sidebar-accordion-plan.md`.
- [x] `tampilan.menu_samping` (`erp_menu` in boot), `IKON_MODUL`, `IKON_RUMAH`, link icons that no longer repeat their
  module's icon; `public/js/menu_samping.js` (one collapsible header per module, ERP and HR share it, dock-less);
  `cek_layar` checks it per role; guide pictures retaken (9).
- [ ] Abel: try it in the browser (`bench build --app erp_internal` already run; hard reload), incl. a phone.

## Done: run it on a laptop with only Docker (2026-11-03)
- [x] Root `Makefile`: `make start-local` (first time `setup-local`: check-local, env-local, image-local, the server
      Makefile's `db site wizard`, configure-local, data-local, up; then ping-local and the accounts once; later runs
      only start the containers), `stop` (now `down`), `update-local`. `users`/`password` dropped (Abel 2026-11-03): an Admin
      makes later accounts and resets passwords in the app. Compose project `erp-local`, `.local/`
      git-ignored, image `erp-internal:local` built from the repo or a released `ERP_IMAGE`.
- [x] `tools/akun.sh` checklist (Administrator always; Super Admin, Admin, Produksi optional; were Developer, Admin, User), Administrator password only; the others each email + password, typed twice,
      shown as `*` (echo off for the whole answer) → `erp_internal/akun.py` in env `ERP_AKUN`; `test_akun` OK.
- [x] `deploy/server/Makefile` targets in English: check, check-env, configure, backup. `.gitattributes` LF everywhere.
- [x] Real run on the Mac 2026-11-03 from an empty `.local` and no volumes: setup 7 min 40 s (image already built,
      a build is 10-20 min), 127 items, 54 Machine Capacity rows, 513 Sales History rows; the account picker (Admin + User,
      every refusal tried), logins by API 200 (wrong password 401), `make stop` (now `make down`), `make start-local` again in 24 s.
- [ ] Samuel: a fresh clone on his Mac. Not tried yet: Windows + WSL, `make update-local`.

## Done: a simpler User role (Samuel 2026-11-02)
Samuel agreed: User records only the three daily jobs, everything else is view only; purchasing and selling are not
used for now. Admin makes Work Orders, BOMs and master data (items, customers, machines).
- [x] User = Stock User + our role `ERP User` (`tampilan.PERAN_USER`): creates only Production Entry, a Delivery Note
      made directly (`so_required` No) and a Material Receipt Stock Entry (`batas_user.py`); Stock User's other
      documents (`HANYA_ADMIN`) and Work Orders, BOMs, items, customers are read only. `test_batas_user`.
- [x] User reads: Production Floor, Stock Balance, Stock Ledger, Item, Warehouse, Plan vs Actual, Order Readiness,
      Work Order. Rail: Stock and Manufacturing only; Delivery Note moved into Stock's sidebar and home.
- [x] User may change a machine's status on the Production Floor (Samuel 2026-11-02): `set_status` lets `ERP User`
      change the status only (Workstation stays read only); an inactive machine is refused with a note
      (`test_set_status_mesin_tidak_aktif`).
- [x] Production Entry still makes its Manufacture/Repack entries as the User (flag `FLAG_HASIL`), and cancels them.
- [x] Admin unchanged. Projects and HR are Admin's now (`test_proyek` uses an office worker with the roles given directly).
- [x] Guides: `docs/panduan/user.md` (new), `gudang.md` (raw material in, direct delivery), `penjualan.md`/
      `pembelian.md` "not used yet", `admin.md`, `produksi.md`, `proyek.md`, `absen.md`.
- [x] Access PDF rebuilt from the live permissions: `~/Desktop/Hak-Akses-ERP-Delta-Anugrah-revisi.pdf` (Abel sends it).
- [x] `cek_layar` 3 users 2026-11-02 (web only, no socket.io): User rail Stock + Manufacturing, Sales Forecast moved
      last in Manufacturing so User's home has no gap. `run-tests --app erp_internal`: 222 OK (13 unit + 209 integration).
- [x] Retook `docs/panduan/gambar/` with `tools/panduan_gambar.mjs` (9 pictures, as `admin@`; `gudang-2` Material
      Receipt and `gudang-3` direct Delivery Note as `user@`, in `gudang.md`). Found: User's forms hit 403 on Stock
      Settings and Customer Group; read added (`setup.IZIN_TAMBAHAN`, `test_batas_user.test_baca_untuk_form`).
      Save + Submit of both as `user@` in the browser OK 2026-11-02.

## Done: item-to-machine list into Machine Capacity (Samuel 2026-11-02)
Samuel's Excel `Perhitungan & Penjualan Barang Plastik (1).xlsx` (Abel's Downloads, 2026-11-02) has a new sheet
"Mesin & Kapasitas": No. Mesin, Kapasitas (tonnage), Barang Cetak; the machine cell is merged over its items.
33 pairs on 6 machines: 2 (180 Ton), 3 (260 Ton), 4 (210 Ton), 5 (160 Ton), 6 (160 Ton), 8 (360 Ton). One item may
run on several machines (Pot Bunga on 2, 4 and 6). Sheet "Bahan Baku" keeps cycle time, cavities, kg per pcs and material.
- [x] `data/mesin_barang.json` (the sheet; the xlsx itself was gone from Downloads, copied from the earlier
      session's dump) and `mesin_barang.muat`: 46 Machine Capacity rows + BOMs, idempotent, `test_mesin_barang` (8).
      Loaded on `erp.localhost` 2026-11-02 (168 records, second run 0).
- [x] Names matched in the file's `barang`. Samuel 2026-11-02 (via Abel): Gantungan DX = Gantungan Dinda DX, Folding
      one item on the stick's machines (135 s a set), Body PLN dropped: 54 rows.
- [x] Samuel 2026-11-02 (via Abel): machines 1, 7 and 9-14 are made inactive for now; "( 2 )"/"( 4 )" after a name is
      the mould's cavity count (so the same product may have other cavities on another machine).
- [x] Machines 1, 7, 9-14: `mesin.json` `"aktif": false` → Workstation `disabled` + status Off (`master._mesin`);
      `kapasitas.mesin_aktif` refuses a new or moved Work Order on them; the Production Floor still shows them (Off).
      Sample data moved from Mesin 01/02 to 02/03. "( n )" read as `cavities`.
- [x] Tonnage: `mesin.json` already has it and matches the sheet (2: 180, 3: 260, 4: 210, 5: 160, 6: 160, 8: 360).
- [ ] Optional, Samuel: Toples Nastar 40 s per set, runner weight per mould (`menunggu-samuel.md` row 15 d, e).
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
- [x] 2026-11-23, with Samuel's items as `admin@` (script, rolled back): SO → DN → SI → Payment, PO → PR → PI all OK.
      Found: the global defaults `selling_price_list`/`buying_price_list` stayed Standard Selling/Buying (orders made
      by the server at price 0, PO always), since `set_single_value` skips the Settings' validate. Fixed in
      `master._harga_bawaan` (buying: `penjualan._bahan` → `Harga Bahan Baku`), `patches/harga_bawaan.py`.
- [ ] Abel: in the browser as `admin@`, a new Sales Order and Purchase Order fill their rates by themselves.
- [ ] Optional: the official vector logo from the designer. `delta-anugrah.svg` is our redraw of the 200 px JPEG;
      replace it under the same name and rerender the PNGs (no code change).
- [x] Add `127.0.0.1 erp.localhost` to `/etc/hosts` (sudo; present, checked 2026-11-03): Node's socket.io can't resolve `*.localhost` on macOS,
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
- [x] Production Floor (`/desk/production-floor`, signed in as `user@example.com`). 2026-11-03: `lantai.mjs` all cases OK,
  perf 60.0 fps with 0 frames over 25 ms. Earlier, 2026-10-31: `lantai.mjs` (states, label, pilih,
  status, live, reconnect, hud, perhatian, dekor-gelap, glass, memuat, strip, id, 13-machines, no-webgl, zona; all OK), perf then
  1.65-2 % frames over 25 ms (budget 1 %) with the Mac at load 12-20 from other Docker projects; fixed by the 2026-11-03 run.
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
  - [x] Labels shrink to a chip where they would overlap and never sit under a card.
        Fixed 2026-11-03: the front row has one depth seen square on, so float noise decided which label was placed
        first; level labels now keep a fixed order (`label.js` `SERI`). `lantai.mjs` all cases OK.
        Before: 2026-11-03: `label-rapi 1440x900` fails "labels flipped while the camera jiggled by a few px" (no label code
        changed since); every other `lantai.mjs` case OK.
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
- [x] Capacity: which item runs on which machine (asked 2026-10-29; list received 2026-11-02, loaded by `mesin_barang.muat`, see above). Samuel's Excel (2026-10-29) gave cycle time,
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
