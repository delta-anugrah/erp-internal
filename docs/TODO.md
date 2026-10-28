# TODO

Order follows the plan (`docs/superpowers/plans/2026-10-27-erp-internal-plan.md`, Revisions 4, 2 and 3 first).

Last full run (2026-10-28, after Production Floor Task 3): `bench --site erp-test.localhost run-tests --app erp_internal`:
13 unit + 118 integration tests, all OK. `node tools/cek_layar.mjs`: 3 users OK, every home shortcuts only.

## Waiting on Abel
- [ ] Task 7 Steps 2-4 (compose boot, `cadangan.sh` against it, restore drill): `new-site` in the stack needs the
      database root password, so it is yours to run (`deploy/server/README.md`). Can wait for the DigitalOcean go-live.
- [ ] Look at the screens in Indonesian once (switch the language in the user menu) and click Fill from History and
      Order Readiness in the browser: their server side ran in the dry runs, the buttons were not clicked.
- [x] Take the `docs/panduan/` screenshots (`docs/panduan/gambar/*.png`, 6 for penjualan, pembelian, gudang;
      retake with `ERP_SANDI=<password> node tools/panduan_gambar.mjs`). `produksi.md`, `absen.md`, `proyek.md`
      reference no picture yet.
- [ ] Try the phone check-in (`/hrms`, Add to Home Screen) as `user@example.com` on a real phone. The sample
      password is `SAMPLE_PASSWORD` in `~/Desktop/Projects/erp-internal-bench/.env`.
- [ ] Sign in as `user@` and `admin@example.com`: User has no Settings, Admin does; full width.
- [ ] As `admin@`: create a user with Role Profile User, then try to give it Developer (must be refused).
- [ ] As `user@`: Sales Order → Delivery Note → Sales Invoice → Payment Entry ends Paid.
- [ ] Optional: the official vector logo from the designer. `delta-anugrah.svg` is our redraw of the 200 px JPEG;
      replace it under the same name and rerender the PNGs (no code change).
- [ ] Add `127.0.0.1 erp.localhost` to `/etc/hosts` (sudo): Node's socket.io can't resolve `*.localhost` on macOS,
      so live updates (Production Floor) fall back to a 60 s poll without it.
- [ ] Review and approve PR #1 (`feat/lokal` → `main`) and the Production Floor plan
      (`docs/superpowers/plans/2026-10-28-production-floor-plan.md`).
- [ ] In the browser: the Delta Anugrah logo and the ERP/HR tiles, the HR home titled "HR", the sidebar arrow folds
      and opens (and stays after a reload), the avatar shows a pointer.
- [ ] As `admin@`: open a few catalog items (e.g. Gayung Lumba-Lumba) and check variants, UOMs and the prices in
      `Harga Pola 2026` against Samuel's list.
- [ ] After each Production Floor task that runs `bench build`: restart `bench start`, then look at the floor in your
      own Chrome and say whether it feels smooth.
- [ ] Production Floor after Task 3 (`/desk/production-floor`, signed in as `user@example.com`):
  - [ ] 14 machines in two rows: back 14 13 12 11 10 9 8, front 1 2 3 4 5 6 7.
  - [ ] Orbit (drag), zoom (scroll), pan (right drag), then "Reset view": smooth, no stutter, no error dialog.
  - [ ] They look like injection moulding machines; JSW, NISSEI and CHENDE in different colours.
  - [ ] Set a machine's status in its Workstation form (Production, Problem, Maintenance, Off), reload the floor:
        green lamp + mould moving, red blinking, blue + dimmed, unlit + darker. Put the status back.
  - [ ] Go to another page and come back 5 times: still smooth, the laptop fan stays quiet.
  - [ ] Labels over the machines, clicking a machine and changing status from the floor come in Task 4, not yet.

## Waiting on Mas Samuel
- See `docs/menunggu-samuel.md`. Nothing there blocks the local build.

## Master data
- [x] Samuel's catalog and machines (`erp_internal/master.py`, `test_master` 8 OK; run twice on `erp.localhost`,
      the second run writes nothing): 21 templates, 84 variants, 157 prices in `Harga Pola 2026`, `Mesin 01`..`14`.
- [ ] Still from Samuel (`docs/menunggu-samuel.md` row 4): capacity per product per machine (cycle time, cavities),
      mould per machine, raw material per product (kg per pcs, PP/HDPE, masterbatch), minimum stock, spoons per
      Sendok Makan pack; confirm the "per ball" contents taken from prices and Gantungan Dinda Super's Dus price.
- [ ] At go-live: the items are loaded into the default company's setup (PT Contoh Plastik on `erp.localhost`);
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
- [~] Task 7: server image, compose, backups (image built and checked; compose boot, backup and restore drill
      waiting on Abel)
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
