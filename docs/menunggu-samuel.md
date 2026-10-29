# Waiting for Mas Samuel

None of these blocks the local build: each has a default (plan, Revision 3). When an answer arrives, change the
place in the last column and strike the row.

| # | Question | Default until answered | Where the answer goes |
|---|---|---|---|
| ~~1~~ | ~~Legal names and abbreviations of the factory and the office company~~ | answered: one company, PT Delta Anugrah (DAN) | go-live wizard, Task 8 |
| 2 | Where past orders are kept and how many months (at least 3 per product) | 6 months of sample Sales History | Sales History import, Task 14 |
| 3 | Invoices from the system? Is the factory PKP (PPN)? | invoices on, PPN templates not default | template `is_default`, Task 8 |
| 4 | ~~Products, machines~~ (received 2026-10-28). Still open: capacity per product per machine (cycle time, cavities), which mould runs on which machine, raw material per product (kg per pcs and material per product arrived 2026-10-29; masterbatch still open), minimum stock per product (suggested from sales since 2026-10-29: confirm only); spoons per Sendok Makan pack; confirm the "per ball" contents taken from the price ratio and Gantungan Dinda Super's Dus price (262.250, but 3 x 87.550 = 262.650) | 5 sample products for BOMs and lead times; real items without BOM, lead time or safety stock | BOMs, Item Lead Time, Item `safety_stock`, `data/katalog.json` (`docs/impor.md`) |
| 4b | Production recording (asked 2026-10-29, none answered): the shifts and their hours (how many, how long); the reject types the operators use; is the runner reground and reused (counts less material) or thrown away; the column headers of the capacity Excel he will send | 3 shifts of 8 h (Shift 1-3); 7 reject types (Short Shot, Flashing, Belang / Warna, Pecah / Retak, Bubble, Sink Mark, Lainnya); runner thrown away (`runner_reground` 0); the headers `KOLOM_IMPOR` already reads (by meaning, so a renamed header still maps) | `setup.SHIFT_PABRIK`, `setup.ALASAN_REJECT` (Reject Reason rows), `kapasitas.RUNNER_DIGILING`, `impor_kapasitas.KOLOM_IMPOR` |
| 5 | Attendance by phone (location) or fingerprint (brand)? Office hours, headcount | phone, 08:00-17:00 | `setup.SHIFT_KANTOR`, Task 15 |
| 6 | Server provider and budget, domain, off-site backup bucket | local compose stack only | `deploy/server/.env`, Task 7/8 |
| 7 | Who uses it, and as Admin or User | one sample user per role (`developer@`, `admin@`, `user@example.com`) | users at go-live |
| 8 | Office days off and leave: Saturday off? Which leave types and how many days of annual leave? | Saturday and Sunday off; Cuti Tahunan 12, Sakit, Izin (unpaid); national holidays entered by HR from the SKB | `setup.LIBUR_MINGGUAN`, `setup.JENIS_CUTI`, Task 15/17 |
| 9 | Factory shifts: how many, and their hours? (asked 2026-10-29) | `setup.SHIFT_PABRIK`: Shift 1, 2, 3 of 8 h each | Plan vs Actual target per shift, Production Entry |
| 10 | Which reject types are recorded? (asked 2026-10-29) | the sample Reject Reasons: Short Shot, Flashing, Belang / Warna, Bubble, Pecah / Retak, Sink Mark | Reject Reason list, Plan vs Actual reason columns |
| ~~11~~ | ~~Runner (the leftover plastic in the mould's channels): ground and reused, or thrown away? (asked 2026-10-29)~~ answered 2026-10-29: treat it as thrown away | counted in the material per shot (`runner_weight`), not returned to stock | capacity BOM material, a regrind item if reused |
| 12 | Which item runs on which machine? Also: is the "Gr" column of his capacity Excel really kg? (asked 2026-10-29) | no Machine Capacity rows for the real items; weights read as kg; the Excel's cycle time, cavities, kg per pcs and material per product wait in `data/penjualan_2026.json` (`spesifikasi`) | Machine Capacity rows (Excel import), `buat_bom_kapasitas` |
| 13 | How many pcs in a "Ball Kecil" (Sendok Bebek Catering) and a "Pack" (Sendok Panjang JSW)? | not converted to pcs: Sendok Bebek is stocked and sold in `Ball Kecil` (`SENDOK-BEBEK-CMP`), Sendok Panjang JSW is taken to be Sendok Makan Pack (same price 6.250) | Item UOM conversion, `master.PISAH` |
| 14 | Sales Excel (2026-10-29), loaded by `penjualan.muat`: (a) sales are per product and type, not per colour; (b) colours of the new types are guessed: Gayung Lumba Soft = DX's (Hijau, Ungu, Orange), Gayung Bajigur DX Soft = DX's, Gantungan Folding Soft = Super's, Gantungan Dinda Hitam = Hitam, Toples Nastar = Bening, Sendok Bebek = one "Campur"; (c) the Excel's prices are lower than the price list (Gayung Lumba Super 16.500 vs 20.500 a lusin): which is the selling price? (d) its Total row leaves out row 1 (Gantungan Dinda Super); (e) "Gayung Bajigur DX, Soft" is one sales figure for two types | (a) spread evenly over the colours (Abel 2026-10-29); (b) as listed; (c) `Harga Pola 2026` stays, the new types have no price; (d) every row counted; (e) spread over both types' colours | `data/penjualan_2026.json` (`produk_baru`, `penjualan`), rerun `penjualan.muat` |

## Answers (Mas Samuel, 2026-10-28)

| # | Answer | What it changes |
|---|---|---|
| 1 | Delta Anugrah, one company (confirmed by Abel 2026-10-28) | done: `erp_aktif` on one company, wizard name PT Delta Anugrah (DAN) (plan Revision 4) |
| 2 | Excel, a year or more; he will send it | Sales History import (`docs/impor.md`) |
| 3 | No invoices for now, only recording; invoices may stay for recording | done: invoice screens kept, PPN templates never default |
| 4 | All of it exists; he will send the data. 2026-10-28: the price list "POLA PLASTIK TAHUN 2026" (Dinda House Ware, 20 products) and the 14 machines arrived | done: `erp_internal/master.py` loads them (21 templates, 84 variants, 157 prices in `Harga Pola 2026`, `Mesin 01`..`14`); BOMs, Item Lead Time and minimum stock is suggested from sales (`penjualan.muat`, 2026-10-29); BOMs and Item Lead Time wait for the rest of 4 |
| 5 | Fingerprint, but HR is not a priority now | attendance waits; phone check-in stays built |
| 6 | Roles: admin and user only | done: Role Profiles User, Admin, Developer (plan Revision 4) |
| 7 | "host" (meaning still to confirm) | server, Task 7/8 |
| 4 (2026-10-28 17:40) | Machines often switch products; material price changes per purchase batch; minimum stock is what he wants the software to work out; reject is internal only (bad or broken pieces), never from customers | machine per Work Order (`erp_mesin`), so switching is fine; material cost follows each purchase through stock valuation, so only grams per pcs and PP/HDPE are needed; minimum stock to be suggested from the sales history (Excel, row 2; done 2026-10-29: `safety_stock` = half an average month, `penjualan.STOK_MIN_BULAN`); reject goes to Gudang Reject at production, no customer-return flow |
