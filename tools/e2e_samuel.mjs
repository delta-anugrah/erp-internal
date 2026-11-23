// End-to-end browser run of each profile's main flow for Samuel's 2026-11-23 requests. Needs `bench start` and
// the sample data of `erp_internal.contoh.buat_contoh` (its users and their shared password).
//
//   ERP_SANDI=<password> node tools/e2e_samuel.mjs     # ERP_URL defaults to http://erp.localhost:8002
//
// Produksi types a day in Daily Input and sees TOTAL move, then empties the cell again. Admin makes a Work Order
// on a listed machine (and is refused on an unlisted one), a Sales Order (refused without an attachment, submitted
// with one), a Delivery Note from Gudang Pluit and an Expense Entry, then opens Monthly Expenses and Missing
// Documents. Super Admin opens a Purchase Order in the "PO Samuel Beli" print format (its default). The forms are
// filled through the open form (`cur_frm`), so their scripts and the server's checks run as that user. Every
// document made here is cancelled and deleted at the end where ERPNext allows it: each run leaves the cancelled
// Production Entry, its cancelled Stock Entries and the cancelled Delivery Note on erp.localhost (ERPNext never
// deletes a submitted-then-cancelled document with ledger rows); no further cleanup is needed. Screenshots
// (1440 and 390 px wide) go to tools/hasil/e2e-*.png.
// Exit code 1 on any failed step or console error.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
const SANDI = process.env.ERP_SANDI;
const HASIL = join(dirname(fileURLToPath(import.meta.url)), "hasil");
// Keep in step with contoh.py (sample company CPL, items, customer, machines) and setup.GUDANG_JUAL.
const WH = (nama) => `${nama} - CPL`;
const ITEM_WO = "CTH-EMBER-10L"; // Machine Capacity rows on Mesin 02 and 03
const MESIN_TERDAFTAR = "Mesin 03";
const MESIN_LAIN = "Mesin 04";
const PELANGGAN = "Toko Contoh Sejahtera";
const PEMASOK = "PT Contoh Biji Plastik";

if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (SAMPLE_PASSWORD in the bench's .env).");
	process.exit(2);
}
mkdirSync(HASIL, { recursive: true });

const hasil = []; // [step, ok, note]
const langkah = (nama, ok, catatan = "") => {
	hasil.push([nama, ok, catatan]);
	console.log(`${ok ? "PASS" : "FAIL"} ${nama}${catatan ? `: ${catatan}` : ""}`);
};
const dibuat = []; // [user, doctype, name]: cancelled and deleted at the end

const browser = await chromium.launch();

async function masuk(email) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	const galat = [];
	// A refusal the run asks for (417 and its server traceback in the console) is no error of the page.
	page.on("console", (m) => {
		const t = m.text();
		if (m.type() === "error" && !/status of 417|frappe\.exceptions\.ValidationError/.test(t)) galat.push(t);
	});
	page.on("pageerror", (e) => galat.push(String(e)));
	const r = await page.request.post(`${URL}/api/method/login`, { form: { usr: email, pwd: SANDI } });
	if (!r.ok()) throw new Error(`login as ${email} failed (${r.status()})`);
	await page.goto(`${URL}/desk`);
	await page.waitForLoadState("networkidle");
	return { context, page, galat, email };
}

// Two screenshots of what is shown: 1440 px and 390 px wide.
async function foto(page, nama) {
	await page.screenshot({ path: join(HASIL, `e2e-${nama}-1440.png`) });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForTimeout(800);
	await page.screenshot({ path: join(HASIL, `e2e-${nama}-390.png`) });
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.waitForTimeout(500);
}

// The open message dialogs' text, then close them.
async function pesan(page) {
	const teks = await page.evaluate(() =>
		[...document.querySelectorAll(".msgprint-dialog .msgprint")]
			.filter((e) => e.offsetParent)
			.map((e) => e.innerText.trim())
			.filter(Boolean)
			.join(" | ")
	);
	await page.evaluate(() => {
		frappe.hide_msgprint?.(true);
		for (const d of document.querySelectorAll(".modal.show")) $(d).modal("hide");
	});
	await page.waitForTimeout(400);
	return teks;
}

// A new form of `dt` filled in the browser: header fields, then rows ([table, {field: value}]). Returns once the
// values have settled; nothing is saved.
async function isiForm(page, dt, kepala, baris = []) {
	// A fresh page load per form: nothing of the previous form (or its redirects) is left.
	await page.goto(`${URL}/desk/${dt.toLowerCase().replace(/ /g, "-")}/new`);
	await page.waitForFunction((dt) => window.cur_frm?.doctype === dt && cur_frm.doc.__islocal, dt, { timeout: 30000 });
	await page.waitForLoadState("networkidle");
	await page.evaluate(
		async ({ dt, kepala, baris }) => {
			const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));
			for (const [f, v] of Object.entries(kepala)) {
				await cur_frm.set_value(f, v);
				await tunggu(400);
			}
			for (const [tabel, nilai] of baris) {
				const row = (cur_frm.doc[tabel] || []).find((r) => !r.item_code) || cur_frm.add_child(tabel);
				for (const [f, v] of Object.entries(nilai)) {
					await frappe.model.set_value(row.doctype, row.name, f, v);
					await tunggu(700);
				}
				cur_frm.refresh_field(tabel);
			}
		},
		{ dt, kepala, baris }
	);
	await page.waitForLoadState("networkidle");
}

// Save (or "Submit") the open form; returns {name, docstatus, pesan} with any message dialog's text.
async function simpan(page, aksi = "Save") {
	await page.evaluate(async (aksi) => {
		try {
			await cur_frm.save(aksi);
		} catch (e) {
			// the message dialog holds the reason
		}
	}, aksi);
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(1200);
	const doc = await page.evaluate(() => ({ name: cur_frm.doc.name, docstatus: cur_frm.doc.docstatus, baru: !!cur_frm.doc.__islocal }));
	return { ...doc, pesan: await pesan(page) };
}

// Attach a small file to a saved document, as the logged-in user (the photo or scan of the paper).
async function lampirkan(page, dt, nama) {
	const token = await page.evaluate(() => frappe.csrf_token);
	const r = await page.request.post(`${URL}/api/method/upload_file`, {
		headers: { "X-Frappe-CSRF-Token": token },
		multipart: {
			file: { name: `${nama}.txt`, mimeType: "text/plain", buffer: Buffer.from(`scan of ${dt} ${nama}`) },
			doctype: dt,
			docname: nama,
			is_private: "1",
		},
	});
	if (!r.ok()) throw new Error(`upload_file ${r.status()}`);
	await page.evaluate(() => cur_frm.reload_doc());
	await page.waitForLoadState("networkidle");
}

const panggil = (page, method, args) =>
	page.evaluate(
		([method, args]) =>
			frappe
				.xcall(method, args)
				.then((m) => ({ ok: true, m }))
				.catch((e) => ({ ok: false, e: e?.message || JSON.stringify(e) || String(e) })),
		[method, args]
	);

// A report opened by route; returns once its rows have drawn (or 20 s).
async function bukaLaporan(page, nama) {
	await page.evaluate((nama) => frappe.set_route("query-report", nama), nama);
	await page
		.waitForFunction(() => document.querySelectorAll(".dt-row:not(.dt-row-header)").length > 0, null, { timeout: 20000 })
		.catch(() => {});
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(1200);
	return page.evaluate(() => document.body.innerText);
}

async function selesai(sesi, nama) {
	if (sesi.galat.length) langkah(`${nama}: no console error`, false, sesi.galat.slice(0, 3).join(" | "));
	else langkah(`${nama}: no console error`, true);
}

// --- Produksi: a day in Daily Input -------------------------------------------------------------------------
async function produksi() {
	const s = await masuk("user@example.com");
	const { page } = s;
	await page.evaluate(() => frappe.set_route("daily-input"));
	await page.waitForSelector("section[data-wo]", { timeout: 20000 });
	await page.waitForLoadState("networkidle");
	const hari_ini = await page.evaluate(() => frappe.datetime.get_today());
	const kunci = `${hari_ini}|Shift 1`;
	// The first block whose today's Shift 1 cell is empty and typeable, on an enabled machine, with room for 1.000
	// more pieces (an order takes no output past its quantity).
	const wo = await page.evaluate(async (kunci) => {
		for (const s of document.querySelectorAll("section[data-wo]")) {
			const inp = s.querySelector(`input[data-key="${CSS.escape(kunci)}"]`);
			if (!inp || inp.value) continue;
			const o = (await frappe.db.get_value("Work Order", s.dataset.wo, ["qty", "produced_qty", "erp_mesin"])).message;
			const mati = (await frappe.db.get_value("Workstation", o.erp_mesin, "disabled")).message?.disabled;
			if (o.qty - o.produced_qty >= 1000 && !mati) return s.dataset.wo;
		}
		return null;
	}, kunci);
	if (!wo) {
		langkah("Produksi: Daily Input has an open order with today's cell", false);
		return s;
	}
	const blok = `section[data-wo="${wo}"]`;
	const sel = page.locator(`${blok} input[data-key="${kunci}"]`);
	const total = () => page.locator(`${blok} .erp-ih-semua`).innerText();
	const angka = (t) => Number(t.replace(/\./g, "").trim() || 0);
	const awal = angka(await total());
	await sel.fill("1.000");
	await sel.press("Tab");
	await page.waitForFunction(
		([blok, n]) => Number((document.querySelector(`${blok} .erp-ih-semua`)?.innerText || "").replace(/\./g, "")) === n,
		[blok, awal + 1000],
		{ timeout: 20000 }
	).catch(() => {});
	const sesudah = angka(await total());
	const galat = await page.locator(`${blok} .erp-ih-galat`).allInnerTexts();
	langkah(
		"Produksi: typed 1.000 in today's Shift 1 and TOTAL moved",
		sesudah === awal + 1000,
		`${wo}: ${awal} → ${sesudah} ${galat.join(" ").trim()}`
	);
	await foto(page, "daily-input");
	// Empty it again: the entry is cancelled and TOTAL is back.
	const sel2 = page.locator(`${blok} input[data-key="${kunci}"]`);
	await sel2.fill("");
	await sel2.press("Tab");
	await page.waitForFunction(
		([blok, n]) => Number((document.querySelector(`${blok} .erp-ih-semua`)?.innerText || "").replace(/\./g, "")) === n,
		[blok, awal],
		{ timeout: 20000 }
	).catch(() => {});
	const akhir = angka(await total());
	langkah("Produksi: emptied the cell and TOTAL is back", akhir === awal, `${akhir}`);
	return s;
}

// --- Admin -----------------------------------------------------------------------------------------------------
async function admin() {
	const s = await masuk("admin@example.com");
	const { page } = s;
	// Each step on its own: one that throws is a failed step, the next still runs.
	const coba = async (nama, fn) => {
		try {
			await fn();
		} catch (e) {
			langkah(nama, false, e.message.split("\n")[0]);
		}
	};

	await coba("Admin: Work Order on an unlisted machine is refused", async () => {
		await isiForm(page, "Work Order", { production_item: ITEM_WO, qty: 100, erp_mesin: MESIN_LAIN });
		const r = await simpan(page);
		langkah("Admin: Work Order on an unlisted machine is refused", r.baru && /is not made on/.test(r.pesan), r.pesan.slice(0, 160));
	});

	await coba("Admin: Work Order on a listed machine submitted", async () => {
		await isiForm(page, "Work Order", { production_item: ITEM_WO, qty: 100, erp_mesin: MESIN_TERDAFTAR });
		let r = await simpan(page);
		if (!r.baru) {
			dibuat.push([s, "Work Order", r.name]);
			r = await simpan(page, "Submit");
		}
		langkah("Admin: Work Order on a listed machine submitted", r.docstatus === 1, `${r.name} ${r.pesan.slice(0, 160)}`);
	});

	await coba("Admin: Sales Order with an attachment submitted", async () => {
		const kirim = await page.evaluate(() => frappe.datetime.add_days(frappe.datetime.get_today(), 7));
		// ERPNext refuses a second Sales Order on one customer PO number: a new one per run.
		const po = `E2E-SO-${Date.now()}`;
		await isiForm(page, "Sales Order", { customer: PELANGGAN, delivery_date: kirim, po_no: po }, [
			["items", { item_code: "CTH-GAYUNG", qty: 10 }],
		]);
		let r = await simpan(page);
		if (r.baru) throw new Error(`not saved: ${r.pesan.slice(0, 160)}`);
		dibuat.push([s, "Sales Order", r.name]);
		const so = r.name;
		r = await simpan(page, "Submit");
		langkah("Admin: Sales Order without an attachment is refused", r.docstatus === 0 && /Attach a photo/.test(r.pesan), r.pesan.slice(0, 160));
		await lampirkan(page, "Sales Order", so);
		r = await simpan(page, "Submit");
		langkah("Admin: Sales Order with an attachment submitted", r.docstatus === 1, `${so} ${r.pesan.slice(0, 160)}`);
	});

	await coba("Admin: Delivery Note from Gudang Pluit submitted", async () => {
		await isiForm(page, "Delivery Note", { customer: PELANGGAN, set_warehouse: WH("Gudang Pluit") }, [
			["items", { item_code: "CTH-EMBER-10L", qty: 5 }],
		]);
		let r = await simpan(page);
		if (!r.baru) {
			dibuat.push([s, "Delivery Note", r.name]);
			r = await simpan(page, "Submit");
		}
		const gudang = await page.evaluate(() => (cur_frm.doc.items || []).map((i) => i.warehouse).join(","));
		langkah(
			"Admin: Delivery Note from Gudang Pluit submitted",
			r.docstatus === 1 && gudang === WH("Gudang Pluit"),
			`${r.name} ${gudang} ${r.pesan.slice(0, 160)}`
		);
		await foto(page, "delivery-note-pluit");
	});

	await coba("Admin: Expense Entry refused without a receipt, submitted with one", async () => {
		await isiForm(page, "Expense Entry", { category: "Lainnya", amount: 50000, repeat: "Once", notes: "E2E" });
		let r = await simpan(page);
		if (r.baru) throw new Error(`not saved: ${r.pesan.slice(0, 160)}`);
		dibuat.push([s, "Expense Entry", r.name]);
		const biaya = r.name;
		r = await simpan(page, "Submit");
		const tolak = r.docstatus === 0 && /Attach a photo/.test(r.pesan);
		await lampirkan(page, "Expense Entry", biaya);
		r = await simpan(page, "Submit");
		langkah(
			"Admin: Expense Entry refused without a receipt, submitted with one",
			tolak && r.docstatus === 1,
			`${biaya} ${r.pesan.slice(0, 160)}`
		);
		await foto(page, "expense-entry");
	});

	await coba("Admin: Monthly Expenses opens with Gaji Operator", async () => {
		const teks = await bukaLaporan(page, "Monthly Expenses");
		const p = await pesan(page);
		langkah("Admin: Monthly Expenses opens with Gaji Operator", /Gaji Operator/.test(teks) && !p, p.slice(0, 160));
		await foto(page, "monthly-expenses");
	});

	await coba("Admin: Missing Documents opens", async () => {
		const teks = await bukaLaporan(page, "Missing Documents");
		const p = await pesan(page);
		langkah("Admin: Missing Documents opens", !p && /Missing Documents/.test(teks), p.slice(0, 160));
		await foto(page, "missing-documents");
	});
	return s;
}

// --- Super Admin: the PO print ------------------------------------------------------------------------------
async function superAdmin() {
	const s = await masuk("developer@example.com");
	const { page } = s;
	const besok = await page.evaluate(() => frappe.datetime.add_days(frappe.datetime.get_today(), 7));
	await isiForm(page, "Purchase Order", { supplier: PEMASOK, schedule_date: besok }, [
		["items", { item_code: "CTH-BIJI-PP", qty: 500, rate: 21000, warehouse: WH("Gudang Bahan Baku") }],
	]);
	const r = await simpan(page);
	if (r.baru) {
		langkah("Super Admin: draft Purchase Order saved", false, r.pesan.slice(0, 160));
		return s;
	}
	dibuat.push([s, "Purchase Order", r.name]);
	const bawaan = await page.evaluate(() => frappe.get_meta("Purchase Order").default_print_format);
	langkah("Super Admin: PO Samuel Beli is the Purchase Order's default print format", bawaan === "PO Samuel Beli", bawaan);
	const cetak = `${URL}/printview?doctype=Purchase%20Order&name=${encodeURIComponent(r.name)}&format=PO%20Samuel%20Beli&no_letterhead=0`;
	const resp = await page.goto(cetak);
	await page.waitForLoadState("networkidle");
	const isi = await page.locator("body").innerText();
	langkah(
		"Super Admin: PO Samuel Beli print opens",
		resp.ok() && isi.includes(r.name) && !/Traceback|Error/.test(isi),
		`${resp.status()} ${r.name}`
	);
	await foto(page, "po-samuel");
	await page.goto(`${URL}/desk`);
	await page.waitForLoadState("networkidle");
	return s;
}

const sesi = [];
for (const [nama, jalan] of [
	["Produksi", produksi],
	["Admin", admin],
	["Super Admin", superAdmin],
]) {
	try {
		const s = await jalan();
		sesi.push([nama, s]);
	} catch (e) {
		langkah(`${nama}: flow ran`, false, e.message);
	}
}

// Clean up: newest first, cancel what is submitted, then delete, each as the user who made it.
for (const [s, dt, nama] of dibuat.reverse()) {
	const doc = await panggil(s.page, "frappe.client.get_value", { doctype: dt, filters: nama, fieldname: "docstatus" });
	if (doc.ok && doc.m?.docstatus === 1) {
		const c = await panggil(s.page, "frappe.client.cancel", { doctype: dt, name: nama });
		if (!c.ok) langkah(`cleanup: cancel ${dt} ${nama}`, false, c.e);
	}
	// A cancelled Delivery Note keeps its (cancelled) stock ledger rows, so ERPNext never deletes it: left cancelled.
	if (dt === "Delivery Note") continue;
	const d = await panggil(s.page, "frappe.client.delete", { doctype: dt, name: nama });
	if (!d.ok) langkah(`cleanup: delete ${dt} ${nama}`, false, d.e);
}

for (const [nama, s] of sesi) {
	await selesai(s, nama);
	await s.context.close();
}
await browser.close();

const gagal = hasil.filter(([, ok]) => !ok);
console.log(`e2e_samuel: ${hasil.length - gagal.length}/${hasil.length} steps passed; screenshots in ${HASIL}`);
process.exit(gagal.length ? 1 : 0);
