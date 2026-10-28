// Browser check of the screens each role gets (plan Task 4b). Needs `bench start`, the sample users of
// `erp_internal.contoh.buat_contoh` (one per Role Profile: developer@, admin@, user@contoh.test) and their
// shared password.
//
//   cd tools && npm install && npx playwright install chromium
//   ERP_SANDI=<password> node tools/cek_layar.mjs          # ERP_URL defaults to http://erp.localhost:8002
//
// For each user it opens the apps screen, the module home and one new form, and asserts: the page is full
// width, the ERPNext and HRMS rails show only that profile's modules, Frappe's own tile (Build) shows for
// Developer only, and there is no console error and no dialog. Screenshots go to tools/hasil/ (gitignored). Exit code 1 on any failure.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
const SANDI = process.env.ERP_SANDI;
const HASIL = join(dirname(fileURLToPath(import.meta.url)), "hasil");

// Keep in step with erp_internal/tampilan.py: IKON (profile → rail modules) and the module each opens on.
const KERJA = [
	"Stock",
	"Selling",
	"Buying",
	"Manufacturing",
	"Accounts",
	"Projects",
	"Shift & Attendance",
	"Leaves",
];
const PROFIL = {
	Developer: { modul: [...KERJA, "Setup"], build: true, rumah: "Manufacturing", form: "Work Order" },
	Admin: { modul: [...KERJA, "Setup"], build: false, rumah: "Home", form: "User" },
	User: { modul: KERJA, build: false, rumah: "Selling", form: "Sales Order" },
};
const APLIKASI = ["erpnext", "hrms"]; // the apps whose rails tampilan.py arranges

const surel = (profil) => `${profil.toLowerCase()}@contoh.test`;
// frappe.router.shell_slug: lower case, "&" spelled out, spaces to dashes
const slug = (shell) => shell.toLowerCase().replace(/&/g, " and ").trim().replace(/\s+/g, "-");

if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (SAMPLE_PASSWORD in the bench's .env).");
	process.exit(2);
}
mkdirSync(HASIL, { recursive: true });

const gagal = [];
const browser = await chromium.launch();

for (const [profil, harap] of Object.entries(PROFIL)) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	const galat = [];
	page.on("console", (m) => m.type() === "error" && galat.push(m.text()));
	page.on("pageerror", (e) => galat.push(String(e)));
	const cek = (syarat, pesan) => syarat || gagal.push(`${profil}: ${pesan}`);

	const masuk = await page.request.post(`${URL}/api/method/login`, {
		form: { usr: surel(profil), pwd: SANDI },
	});
	if (!masuk.ok()) {
		gagal.push(`${profil}: login failed (${masuk.status()})`);
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
		await page.screenshot({ path: join(HASIL, `${slug(profil)}-${nama}.png`), fullPage: true });

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
			// The rail of each app tile on this user's Apps screen: the resolved entries that are shown
			// and lead to a sidebar. A tile with none would open a blocked module.
			const { rail, kosong, tile } = await page.evaluate((APLIKASI) => {
				const sidebars = frappe.boot.module_sidebars || {};
				const tile = (frappe.boot.app_data || []).filter((a) => a.on_apps_screen);
				const per_app = tile.map((a) => [
					a.app_name,
					(frappe.boot.dock?.[a.app_name] || a.dock || [])
						.filter((e) => !e.hidden && e.link_type === "Sidebar" && sidebars[e.link_to])
						.map((e) => e.link_to),
				]);
				return {
					rail: per_app.filter(([app]) => APLIKASI.includes(app)).flatMap(([, m]) => m),
					kosong: per_app.filter(([, m]) => !m.length).map(([app]) => app),
					tile: tile.map((a) => a.app_name),
				};
			}, APLIKASI);
			cek(!kosong.length, `Apps screen tiles with nothing behind them: [${kosong}]`);
			const lebih = rail.filter((m) => !harap.modul.includes(m));
			const kurang = harap.modul.filter((m) => !rail.includes(m));
			cek(!lebih.length && !kurang.length, `rail extra [${lebih}] missing [${kurang}]`);
			cek(tile.includes("frappe") === harap.build, `Framework (Build) tile ${harap.build ? "missing" : "shown"}`);
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
console.log(`cek_layar: ${Object.keys(PROFIL).length} users OK, screenshots in ${HASIL}`);
