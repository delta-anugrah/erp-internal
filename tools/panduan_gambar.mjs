// Screenshots for the staff guides (docs/panduan/*.md → docs/panduan/gambar/). Needs `bench start` and the
// sample data of `erp_internal.contoh.buat_contoh` with its users (`<bagian>@contoh.test`) and their password.
//
//   ERP_SANDI=<password> node tools/panduan_gambar.mjs     # ERP_URL defaults to http://erp.localhost:8002
//
// Each picture is taken as the bagian the guide is for, at 1440x900. A screen with a sample record opens that
// record; one without (no Purchase Order or Purchase Receipt in the sample data, no Material Transfer) opens a new
// form and fills it in the browser without saving, so nothing is written. Exit code 1 on an error dialog or a
// console error.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
const SANDI = process.env.ERP_SANDI;
const GAMBAR = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "panduan", "gambar");

// The first record of a doctype the user can read, newest last (the sample data's first is its showcase).
const pertama = (page, dt) =>
	page.evaluate(
		(dt) => frappe.db.get_list(dt, { fields: ["name"], order_by: "creation asc", limit: 1 }),
		dt
	).then((r) => r[0]?.name);

// Open a new, unsaved form and fill it: header fields, then the first child row of `tabel`.
const isi_baru = (page, dt, kepala, tabel, baris) =>
	page.evaluate(
		async ({ dt, kepala, tabel, baris }) => {
			await frappe.new_doc(dt);
			const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
			for (let i = 0; i < 50 && cur_frm?.doctype !== dt; i++) await tunggu(100);
			for (const [f, v] of Object.entries(kepala)) {
				await cur_frm.set_value(f, v);
				await tunggu(300);
			}
			if (tabel) {
				const row = cur_frm.doc[tabel]?.[0] || cur_frm.add_child(tabel);
				for (const [f, v] of Object.entries(baris)) {
					await frappe.model.set_value(row.doctype, row.name, f, v);
					await tunggu(700);
				}
				cur_frm.refresh_field(tabel);
			}
		},
		{ dt, kepala, tabel, baris }
	);

const buka = (page, dt) =>
	pertama(page, dt).then((nama) => {
		if (!nama) throw new Error(`no ${dt} in the sample data`);
		return page.evaluate(([dt, nama]) => frappe.set_route("Form", dt, nama), [dt, nama]);
	});

const besok = () => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

// The rail module each bagian works in (erp_internal/tampilan.py), opened first so the form keeps its sidebar.
const RUMAH = { penjualan: "Selling", pembelian: "Buying", gudang: "Stock" };

// file → [bagian user, how to reach the screen]
const GAMBAR_LIST = {
	"penjualan-1": ["penjualan", (p) => buka(p, "Sales Order")],
	"penjualan-2": ["penjualan", (p) => buka(p, "Delivery Note")],
	"penjualan-3": ["penjualan", (p) => buka(p, "Sales Invoice")],
	"pembelian-2": [
		"pembelian",
		(p) =>
			isi_baru(
				p,
				"Purchase Order",
				{
					supplier: "PT Contoh Biji Plastik",
					schedule_date: besok(),
					taxes_and_charges: "PPN Masukan 11% - CPL",
				},
				"items",
				{ item_code: "CTH-BIJI-PP", qty: 500, rate: 21000, warehouse: "Gudang Bahan Baku - CPL" }
			),
	],
	"pembelian-3": [
		"pembelian",
		(p) =>
			isi_baru(
				p,
				"Purchase Receipt",
				{ supplier: "PT Contoh Biji Plastik", set_warehouse: "Gudang Bahan Baku - CPL" },
				"items",
				{ item_code: "CTH-BIJI-PP", qty: 480, rejected_qty: 20, rate: 21000 }
			),
	],
	"gudang-1": [
		"gudang",
		(p) =>
			isi_baru(
				p,
				"Stock Entry",
				{
					stock_entry_type: "Material Transfer",
					from_warehouse: "Gudang Bahan Baku - CPL",
					to_warehouse: "Gudang Produksi - CPL",
				},
				"items",
				{ item_code: "CTH-BIJI-HDPE", qty: 100, t_warehouse: "Gudang Produksi - CPL" }
			)
				// Show both warehouses and the item row: open the section, scroll past the checkboxes.
				.then(() => p.locator(".section-head", { hasText: "Default Warehouse" }).click())
				.then(() => p.waitForTimeout(800))
				.then(() =>
					p
						.locator(".section-head", { hasText: "Default Warehouse" })
						.evaluate((el) => el.scrollIntoView({ block: "start" }))
				),
	],
};

if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (SAMPLE_PASSWORD in the bench's .env).");
	process.exit(2);
}
mkdirSync(GAMBAR, { recursive: true });

const gagal = [];
const browser = await chromium.launch();

for (const [nama, [user, ke]] of Object.entries(GAMBAR_LIST)) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	const galat = [];
	page.on("console", (m) => m.type() === "error" && galat.push(m.text()));
	page.on("pageerror", (e) => galat.push(String(e)));

	const masuk = await page.request.post(`${URL}/api/method/login`, {
		form: { usr: `${user}@contoh.test`, pwd: SANDI },
	});
	if (!masuk.ok()) {
		gagal.push(`${nama}: login as ${user} failed (${masuk.status()})`);
		await context.close();
		continue;
	}
	await page.goto(`${URL}/desk`);
	await page.waitForLoadState("networkidle");
	try {
		await page.evaluate((ws) => frappe.set_route("Workspaces", ws), RUMAH[user]);
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(800);
		await ke(page);
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1200);
		// Close the "new form" Quick Entry, if any, and any alert toast; keep error dialogs to fail on them.
		const pesan = page.locator(".modal.show.msgprint-dialog, .modal.show .msgprint");
		if (await pesan.count()) {
			gagal.push(`${nama}: a message dialog is open: ${(await pesan.allInnerTexts()).join(" ").slice(0, 200)}`);
		}
		await page.screenshot({ path: join(GAMBAR, `${nama}.png`) });
	} catch (e) {
		gagal.push(`${nama}: ${e.message}`);
	}
	if (galat.length) gagal.push(`${nama}: console errors: ${galat.slice(0, 3).join(" | ")}`);
	await context.close();
}

await browser.close();
if (gagal.length) {
	console.error(gagal.join("\n"));
	process.exit(1);
}
console.log(`panduan_gambar: ${Object.keys(GAMBAR_LIST).length} screenshots in ${GAMBAR}`);
