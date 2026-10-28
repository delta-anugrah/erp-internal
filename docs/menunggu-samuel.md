# Waiting for Mas Samuel

None of these blocks the local build: each has a default (plan, Revision 3). When an answer arrives, change the
place in the last column and strike the row.

| # | Question | Default until answered | Where the answer goes |
|---|---|---|---|
| 1 | Legal names and 3-letter abbreviations of the factory and the office company | PT Contoh Plastik (CPL), PT Contoh Kantor (CKT) | go-live wizard, Task 8 |
| 2 | Where past orders are kept and how many months (at least 3 per product) | 6 months of sample Sales History | Sales History import, Task 14 |
| 3 | Invoices from the system? Is the factory PKP (PPN)? | invoices on, PPN templates not default | template `is_default`, Task 8 |
| 4 | Products, machines, capacity per day per product, materials per product, minimum stock | 5 sample products | Items, BOMs, Item Lead Time, Task 14 |
| 5 | Attendance by phone (location) or fingerprint (brand)? Office hours, headcount | phone, 08:00-17:00 | `setup.SHIFT_KANTOR`, Task 15 |
| 6 | Server provider and budget, domain, off-site backup bucket | local compose stack only | `deploy/server/.env`, Task 7/8 |
| 7 | Who uses it, and in which bagian | one sample user per bagian | users at go-live |
| 8 | Office days off and leave: Saturday off? Which leave types and how many days of annual leave? | Saturday and Sunday off; Cuti Tahunan 12, Sakit, Izin (unpaid); national holidays entered by HR from the SKB | `setup.LIBUR_MINGGUAN`, `setup.JENIS_CUTI`, Task 15/17 |

## Answers (Mas Samuel, 2026-10-28)

| # | Answer | What it changes |
|---|---|---|
| 1 | Delta Anugrah | the company name at go-live; one company or two (factory and office) still to confirm |
| 2 | Excel, a year or more; he will send it | Sales History import (`docs/impor.md`) |
| 3 | No invoices for now, only recording; invoices may stay for recording | PPN not needed (not PKP); invoices optional |
| 4 | All of it exists; he will send the data | Items, BOMs, Item Lead Time at go-live |
| 5 | Fingerprint, but HR is not a priority now | attendance waits; phone check-in stays built |
| 6 | Roles: admin and user only | replaces the seven bagian at go-live |
| 7 | "host" (meaning still to confirm) | server, Task 7/8 |
