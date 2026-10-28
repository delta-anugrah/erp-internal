// Browser check of the screens each bagian gets (plan Task 4b). Needs `bench start`, the sample users of
// `erp_internal.contoh.buat_contoh` (one per bagian, `<bagian>@contoh.test`) and their shared password.
//
//   cd tools && npm install && npx playwright install chromium
//   ERP_SANDI=<password> node tools/cek_layar.mjs          # ERP_URL defaults to http://erp.localhost:8002
//
// For each bagian user it opens the apps screen, the module home and one new form, and asserts:
// the page is full width, the rail shows only that bagian's modules, and there is no console error and no
// dialog. Screenshots go to tools/hasil/ (gitignored). Exit code 1 on any failure.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
const SANDI = process.env.ERP_SANDI;
const HASIL = join(dirname(fileURLToPath(import.meta.url)), "hasil");

// Keep in step with erp_internal/tampilan.py: IKON (bagian → rail modules) and the module each opens on.
const BAGIAN = {
	Gudang: { modul: ["Stock"], rumah: "Stock", form: "Stock Entry" },
	Penjualan: { modul: ["Stock", "Selling", "Accounts"], rumah: "Selling", form: "Sales Order" },
	Pembelian: { modul: ["Stock", "Buying", "Accounts"], rumah: "Buying", form: "Purchase Order" },
	Produksi: { modul: ["Stock", "Manufacturing"], rumah: "Manufacturing", form: "Work Order" },
	HR: { modul: ["Shift & Attendance", "Leaves"], rumah: "Shift & Attendance", form: "Employee" },
	Karyawan: {
		modul: ["Projects", "Shift & Attendance", "Leaves"],
		rumah: "Leaves",
		form: "Leave Application",
	},
	"Manajer Proyek": { modul: ["Projects"], rumah: "Projects", form: "Project" },
};

const surel = (bagian) => `${bagian.toLowerCase().replace(/ /g, "")}@contoh.test`;
// frappe.router.shell_slug: lower case, "&" spelled out, spaces to dashes
const slug = (shell) => shell.toLowerCase().replace(/&/g, " and ").trim().replace(/\s+/g, "-");

if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (site config erp_sandi_contoh).");
	process.exit(2);
}
mkdirSync(HASIL, { recursive: true });

const gagal = [];
const browser = await chromium.launch();

for (const [bagian, harap] of Object.entries(BAGIAN)) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	const galat = [];
	page.on("console", (m) => m.type() === "error" && galat.push(m.text()));
	page.on("pageerror", (e) => galat.push(String(e)));
	const cek = (syarat, pesan) => syarat || gagal.push(`${bagian}: ${pesan}`);

	const masuk = await page.request.post(`${URL}/api/method/login`, {
		form: { usr: surel(bagian), pwd: SANDI },
	});
	if (!masuk.ok()) {
		gagal.push(`${bagian}: login failed (${masuk.status()})`);
		await context.close();
		continue;
	}

	const langkah = [
		["desk", () => page.goto(`${URL}/desk`)],
		// The module home as the rail opens it: its Workspace (a URL spells "Shift & Attendance" with
		// the "&", which only the router's workspace table knows).
		["rumah", () => page.evaluate((ws) => frappe.set_route("Workspaces", ws), harap.rumah)],
		["form", () => page.evaluate((dt) => frappe.new_doc(dt), harap.form)],
	];
	for (const [nama, buka] of langkah) {
		await buka();
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(HASIL, `${slug(bagian)}-${nama}.png`), fullPage: true });

		cek(
			await page.evaluate(() => document.body.classList.contains("full-width")),
			`${nama}: not full width`
		);
		// An error or message dialog (frappe.msgprint); a Quick Entry dialog of a new form is fine.
		const pesan = page.locator(".modal.show.msgprint-dialog, .modal.show .msgprint");
		cek(
			(await pesan.count()) === 0,
			`${nama}: a message dialog is open: ${(await pesan.allInnerTexts()).join(" ").slice(0, 200)}`
		);

		if (nama === "desk") {
			// The rail of the apps this user opens from the Apps screen (Frappe's own app is not one of
			// them): the resolved entries that are shown and lead to a sidebar.
			const rail = await page.evaluate(() =>
				Object.entries(frappe.boot.dock || {})
					.filter(([app]) => (frappe.boot.apps_data?.apps || []).some((a) => a.name === app))
					.flatMap(([, entries]) => entries)
					.filter((e) => !e.hidden && e.link_type === "Sidebar")
					.filter((e) => (frappe.boot.module_sidebars || {})[e.link_to])
					.map((e) => e.link_to)
			);
			const lebih = rail.filter((m) => !harap.modul.includes(m));
			const kurang = harap.modul.filter((m) => !rail.includes(m));
			cek(!lebih.length && !kurang.length, `rail extra [${lebih}] missing [${kurang}]`);
		}
	}
	cek(!galat.length, `console errors: ${galat.slice(0, 3).join(" | ")}`);
	await context.close();
}

await browser.close();
if (gagal.length) {
	console.error(gagal.join("\n"));
	process.exit(1);
}
console.log(`cek_layar: ${Object.keys(BAGIAN).length} bagian OK, screenshots in ${HASIL}`);
