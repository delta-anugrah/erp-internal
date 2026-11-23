# Waiting for Mas Samuel

None of these blocks the local build: each has a default (plan, Revision 3). When an answer arrives, change the
place in the last column and strike the row.

| # | Question | Default until answered | Where the answer goes |
|---|---|---|---|
| ~~1~~ | ~~Legal names and abbreviations of the factory and the office company~~ | answered: one company, PT Delta Anugrah (DAN) | go-live wizard, Task 8 |
| 2 | Where past orders are kept and how many months (at least 3 per product) | 6 months of sample Sales History | Sales History import, Task 14 |
| 3 | Invoices from the system? Is the factory PKP (PPN)? | invoices on, PPN templates not default | template `is_default`, Task 8 |
| 4 | ~~Products, machines~~ (received 2026-10-28). Still open: capacity per product per machine (cycle time, cavities), which mould runs on which machine, raw material per product (kg per pcs and material per product arrived 2026-10-29; masterbatch still open), minimum stock per product (suggested from sales since 2026-10-29: confirm only); spoons per Sendok Makan pack; confirm the "per ball" contents taken from the price ratio and Gantungan Dinda Super's Dus price (262.250, but 3 x 87.550 = 262.650) | 5 sample products for BOMs and lead times; real items without BOM, lead time or safety stock | BOMs, Item Lead Time, Item `safety_stock`, `data/katalog.json` (`docs/impor.md`) |
| 4b | Production recording (asked 2026-10-29; shifts answered 2026-11-02, see 9): the reject types the operators use; is the runner reground and reused (counts less material) or thrown away; the column headers of the capacity Excel he will send | 7 reject types (Short Shot, Flashing, Belang / Warna, Pecah / Retak, Bubble, Sink Mark, Lainnya); runner thrown away (`runner_reground` 0); the headers `KOLOM_IMPOR` already reads (by meaning, so a renamed header still maps) | `setup.SHIFT_PABRIK`, `setup.ALASAN_REJECT` (Reject Reason rows), `kapasitas.RUNNER_DIGILING`, `impor_kapasitas.KOLOM_IMPOR` |
| ~~5~~ | ~~Attendance by phone (location) or fingerprint (brand)?~~ answered: fingerprint, HR not a priority (2026-10-28, again 2026-10-31). Still open later: the fingerprint brand, office hours, headcount | phone check-in stays built, 08:00-17:00 | `setup.SHIFT_KANTOR`, Task 15 |
| 6 | Budget, domain, off-site backup bucket (DigitalOcean, confirmed by Samuel 2026-11-23 on his card; backups to the admin's PC and Cloudflare R2; domain later: 2026-11-23 table, item 8) | local compose stack only; the backup bucket is not needed to go live (`make setup` lets you skip it: backups stay in `~/erp/cadangan`) | `deploy/server/.env`, Task 7/8 |
| 7 | Who uses it, and which of them are Admin (roles since 2026-11-23: Super Admin, Admin, Produksi, built: 2026-11-23 table, item 1; a new admin hired this week) | one sample user per role (`developer@` Super Admin, `admin@` Admin, `user@example.com` Produksi) | users at go-live |
| 8 | Office days off and leave: Saturday off? Which leave types and how many days of annual leave? | Saturday and Sunday off; Cuti Tahunan 12, Sakit, Izin (unpaid); national holidays entered by HR from the SKB | `setup.LIBUR_MINGGUAN`, `setup.JENIS_CUTI`, Task 15/17 |
| ~~9~~ | ~~Factory shifts: how many, and their hours?~~ answered 2026-11-02: two shifts of 12 h (clock times Shift 1 08.00-20.00, Shift 2 20.00-08.00, his Excel 2026-11-23; not used by the app yet) | done: `setup.SHIFT_PABRIK` Shift 1 and 2, 12 h each | Plan vs Actual target per shift, Production Entry |
| 10 | Which reject types are recorded? (asked 2026-10-29) | the sample Reject Reasons: Short Shot, Flashing, Belang / Warna, Bubble, Pecah / Retak, Sink Mark | Reject Reason list, Plan vs Actual reason columns |
| ~~11~~ | ~~Runner (the leftover plastic in the mould's channels): ground and reused, or thrown away? (asked 2026-10-29)~~ answered 2026-10-29: treat it as thrown away | counted in the material per shot (`runner_weight`), not returned to stock | capacity BOM material, a regrind item if reused |
| 12 | Which item runs on which machine? 2026-11-02: list received (Excel sheet "Mesin & Kapasitas", 33 pairs on machines 2-6 and 8). Answered 2026-11-02 (via Abel): machines 1, 7, 9-14 inactive for now; "( 2 )"/"( 4 )" is the mould's cavity count. The "Gr" column of his capacity Excel is kg (confirmed, Abel 2026-10-30). | done 2026-11-02: `mesin_barang.muat` makes 46 Machine Capacity rows and their BOMs; machines 1, 7, 9-14 disabled and Off. What is left: row 15 | `data/mesin_barang.json`, rerun `mesin_barang.muat` |
| 13 | How many pcs in a "Ball Kecil" (Sendok Bebek Catering) and a "Pack" (Sendok Panjang JSW)? | not converted to pcs: Sendok Bebek is stocked and sold in `Ball Kecil` (`SENDOK-BEBEK-CMP`), Sendok Panjang JSW is taken to be Sendok Makan Pack (same price 6.250) | Item UOM conversion, `master.PISAH` |
| 14 | Sales Excel (2026-10-29), loaded by `penjualan.muat`: (a) sales are per product and type, not per colour; (b) colours of the new types are guessed: Gayung Lumba Soft = DX's (Hijau, Ungu, Orange), Gayung Bajigur DX Soft = DX's, Gantungan Folding Soft = Super's, Gantungan Dinda Hitam = Hitam, Toples Nastar = Bening, Sendok Bebek = one "Campur"; (c) the Excel's prices are lower than the price list (Gayung Lumba Super 16.500 vs 20.500 a lusin): which is the selling price? (d) its Total row leaves out row 1 (Gantungan Dinda Super); (e) "Gayung Bajigur DX, Soft" is one sales figure for two types | (a) spread evenly over the colours (Abel 2026-10-29); (b) as listed; (c) `Harga Pola 2026` stays, the new types have no price; (d) every row counted; (e) spread over both types' colours | `data/penjualan_2026.json` (`produk_baru`, `penjualan`), rerun `penjualan.muat` |
| 15 | ~~Item-to-machine list (2026-11-02): (a) "Body PLN" (Mesin 02): which product is it? It is not in the price list or the sales Excel. (b) "Stik Folding" (Mesin 02, 03, 06) is one part of Gantungan Folding: on which machines are the Batok and Tongkat moulded? (c) "Gantungan DX" ( 4 ) on Mesin 04, ( 2 ) on Mesin 05: is it Gantungan Dinda DX? (d) Toples Nastar body (30 s) and lid (10 s) on Mesin 05: one set every 40 s? (e) runner weight per shot of each mould?~~ (a)-(c) answered 2026-11-02 (via Abel): Body PLN no longer made; Folding is one item on the machine that moulds the stick; Gantungan DX = Gantungan Dinda DX. (d), (e) optional, not asked yet | (a)-(c) done in `mesin_barang.json` (54 rows); (d) 40 s per set; (e) runner 0, only the piece's weight is counted as material | `data/mesin_barang.json` `barang` (map the name), rerun `mesin_barang.muat` |
| 16 | His full PO: the header (logo, number, customer, date); only the lines table came 2026-11-23 | our header in the same style (spec section 6, plan Task 10) | print formats `PO Samuel`, `PO Samuel Beli` |
| 17 | His pigment list: colour, ratio (g per kg of material; "1 gram pigment : 1 kg bahan"), price per kg | Admin makes pigments by hand, ratio 1 (spec section 8, plan Task 11, built 2026-11-23: template `PIGMEN` stocked in grams, bought per Kg, no variants yet) | `PIGMEN` variants, `penjualan.muat` |

## Answers and new requests (Mas Samuel, WhatsApp 2026-11-23), item 1 built, the rest not yet

Agreed with Abel. Items 1-5 and 7 are specced and planned (`docs/superpowers/specs/2026-11-23-permintaan-samuel-design.md`,
`docs/superpowers/plans/2026-11-23-permintaan-samuel-plan.md`); 6 waits for the lists. Two new asks are rows 16
and 17 of the first table.

| # | Decision | What it changes |
|---|---|---|
| 1 | Three roles: Super Admin (us = today's Developer, no limits), Admin (Work Orders, POs/Sales Orders, delivery notes, raw material in, expenses; daily production view only, cannot change it), Produksi (only daily production input, sees nothing outside production) | done 2026-11-23 (plan Tasks 1-2): profiles renamed, Produksi = `ERP User` only (Production Entry, machine status, read Work Order and Plan vs Actual), Admin only views Production Entry and makes Delivery Notes and Material Receipts; `batas_user.py` removed; Finish on a Work Order is Super Admin's only |
| 2 | Work Order refuses a machine not in the item's Machine Capacity list (Samuel: "biar ga masukin mesin yg gbs produksi brg itu") | Work Order validate in `kapasitas.py` |
| 3 | A second warehouse "Pluit"; a delivery goes from the factory or Pluit, Admin picks per delivery | warehouse setup |
| 4 | Daily input after the job, one screen per Work Order, like his Excel (picture 2026-11-23): per PO rows per date, columns Shift 1 (08-20) and Shift 2 (20-08), total; technician pagi/malam per period. Production Floor stays how Admin finds an empty machine | Production Entry or a new page |
| 5 | Monthly expenses: operator 105.000 per 12 h shift, counted from machine state (24 h = 2 shifts, 12 h = 1, off = 0); electricity, fixed salaries and fuel entered by Admin as plain expenses (fuel not linked to deliveries). Spec call 1: counted from the daily input instead (a shift with a number = the machine ran it), waiting for Abel | new |
| 6 | Second product line "Seal Cap", one customer PO per run (e.g. "Seal Cap NKP (Neutral) - M1G, 400.000 pcs, kirim 27 Nov 2026, @24/pcs"): machines M1x always 24 h, one type per machine; brand codes (NDY, NKP, PPK, SBU, ...: a fixed set) and colours change per PO; the selling price follows the machine (Rp23 or Rp24 per pcs, by contract). Proposed: items split by price (Rp23/Rp24) with variants per brand code and colour; PO → Sales Order → Work Order on the PO's machine | PARTLY ANSWERED 2026-11-23: the 21 brand codes with their mould insert counts arrived (customer EPP; loaded as Brand records with "Inserts (pcs)", plan Task 14, spec A4). STILL WAITING: list of machines (Rp23/Rp24), colours, pcs per pack and per sack |
| 7 | Every Excel/PO screen and print follows Samuel's own templates (no relearning): PO print like his PO picture, daily recap like his Excel, Excel export in the same layout | print formats, report layout |
| 8 | Hosting: DigitalOcean (Samuel's card, paid); backups to the admin's PC and Cloudflare R2; domain later | deploy, separate session |
| 9 | Demo videos for Produksi and Admin after it is built; Abel onboards the new admin (hired this week) | after testing |

## Answers (Mas Samuel, 2026-11-02)

| # | Answer | What it changes |
|---|---|---|
| 9 | Two factory shifts of 12 h | done: `setup.SHIFT_PABRIK` |
| 7 | Admin and User are enough | nothing (already so) |
| 12 | Each item is tied to particular machines; the list came the same day (Excel sheet "Mesin & Kapasitas") | `docs/TODO.md` "Next: item-to-machine list" |
| 11 | Every reject (BS) is reground and moulded again; no material counted as wasted | nothing: reject material already counts as used |
| new | User records only daily output, deliveries and raw material in; everything else view only (Production Floor, stock, production reports, Work Orders). Admin makes Work Orders, BOMs and master data. Purchasing and selling not used for now | done 2026-11-02: `batas_user.py`, guide `docs/panduan/user.md`, PDF `Hak-Akses-ERP-Delta-Anugrah-revisi.pdf` |
| new | User may change a machine's status on the Production Floor | nothing (already so) |

## Answers (Mas Samuel, 2026-10-28)

| # | Answer | What it changes |
|---|---|---|
| 1 | Delta Anugrah, one company (confirmed by Abel 2026-10-28) | done: `erp_aktif` on one company, wizard name PT Delta Anugrah (DAN) (plan Revision 4) |
| 2 | Excel, a year or more; he will send it | Sales History import (`docs/impor.md`) |
| 3 | No invoices for now, only recording; invoices may stay for recording | done: invoice screens kept, PPN templates never default |
| 4 | All of it exists; he will send the data. 2026-10-28: the price list "POLA PLASTIK TAHUN 2026" (Dinda House Ware, 20 products) and the 14 machines arrived | done: `erp_internal/master.py` loads them (21 templates, 84 variants, 157 prices in `Harga Pola 2026`, `Mesin 01`..`14`); BOMs, Item Lead Time and minimum stock is suggested from sales (`penjualan.muat`, 2026-10-29); BOMs and Item Lead Time wait for the rest of 4 |
| 5 | Fingerprint, but HR is not a priority now | attendance waits; phone check-in stays built |
| 6 | Roles: admin and user only | done: Role Profiles User, Admin, Developer (plan Revision 4); renamed Produksi, Admin, Super Admin 2026-11-23 |
| 7 | "host" (meaning still to confirm) | server, Task 7/8 |
| 4 (2026-10-28 17:40) | Machines often switch products; material price changes per purchase batch; minimum stock is what he wants the software to work out; reject is internal only (bad or broken pieces), never from customers | machine per Work Order (`erp_mesin`), so switching is fine; material cost follows each purchase through stock valuation, so only grams per pcs and PP/HDPE are needed; minimum stock to be suggested from the sales history (Excel, row 2; done 2026-10-29: `safety_stock` = half an average month, `penjualan.STOK_MIN_BULAN`); reject goes to Gudang Reject at production, no customer-return flow |
