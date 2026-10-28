// Browser check of the screens each role gets (plan Task 4b). Needs `bench start`, the sample users of
// `erp_internal.contoh.buat_contoh` (one per Role Profile: developer@, admin@, user@example.com) and their
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
// Keep in step with tampilan.NAMA_APLIKASI / IKON_APLIKASI.
const IKON_TILE = {
	ERP: "/images/aplikasi-erp.svg",
	HR: "/images/aplikasi-hr.svg",
	System: "/images/aplikasi-sistem.svg",
};
const HASIL = join(dirname(fileURLToPath(import.meta.url)), "hasil");

// Keep in step with erp_internal/tampilan.py: IKON (profile → rail modules) and the module each opens on.
const KERJA = ["Stock", "Selling", "Buying", "Manufacturing", "Projects", "Shift & Attendance"];
// Rail module → its home Workspace (tampilan.PINTASAN keys). Every home is shortcuts only, at most this many.
const RUMAH = { Setup: "Home", "Shift & Attendance": "HR" };
const PINTASAN_MAKS = 10;
const PROFIL = {
	Developer: { modul: [...KERJA, "Setup"], build: true, rumah: "Manufacturing", form: "Work Order" },
	Admin: { modul: [...KERJA, "Setup"], build: false, rumah: "Home", form: "User" },
	User: { modul: KERJA, build: false, rumah: "Selling", form: "Sales Order" },
};
const APLIKASI = ["erpnext", "hrms"]; // the apps whose rails tampilan.py arranges

const surel = (profil) => `${profil.toLowerCase()}@example.com`;
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
			cek(tile.includes("frappe") === harap.build, `System (Build) tile ${harap.build ? "missing" : "shown"}`);
			// Our names and icons on every tile (tampilan.merek_aplikasi), never an app's own.
			const ubin = await page.locator(".icons > *").evaluateAll((l) =>
				l.map((t) => [
					t.querySelector(".icon-title")?.innerText.trim(),
					t.querySelector("img.app-icon")?.getAttribute("src"),
				])
			);
			cek(
				ubin.length && ubin.every(([t, src]) => IKON_TILE[t] && src?.endsWith(IKON_TILE[t])),
				`tiles: ${JSON.stringify(ubin)}`
			);
		}
		if (nama === "desk") {
			// The avatar at the top right opens the user menu, so it shows a pointer (public/css/erp_internal.css).
			const kursor = await page.locator(".desktop-avatar .avatar").first().evaluate((e) => getComputedStyle(e).cursor);
			cek(kursor === "pointer", `avatar cursor: ${kursor}`);
		}
		if (nama === "rumah") {
			// The sidebar folds and opens with its edge arrow (visible: public/css/erp_internal.css), and the
			// choice survives a reload the way Frappe keeps it.
			const lebar = () => page.evaluate(() => Math.round(document.querySelector(".body-sidebar").getBoundingClientRect().width));
			const panah = page.locator(".sidebar-collapse-arrow");
			cek(await panah.isVisible(), "sidebar arrow not visible");
			const buka = await lebar();
			await panah.click();
			await page.waitForTimeout(700);
			const tutup = await lebar();
			await page.reload();
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(1000);
			const setelah_muat = await lebar();
			await page.locator(".sidebar-collapse-arrow").click();
			await page.waitForTimeout(700);
			const buka_lagi = await lebar();
			cek(
				buka > 100 && tutup < buka && setelah_muat === tutup && buka_lagi === buka,
				`sidebar fold: open ${buka}, folded ${tutup}, after reload ${setelah_muat}, reopened ${buka_lagi}`
			);
			await page.screenshot({ path: join(HASIL, `${slug(profil)}-sidebar.png`) });
			// The rail's top slot shows the icon of the app the module belongs to.
			const atas = await page.locator(".dock-logo .header-logo img").first().getAttribute("src");
			cek(Object.values(IKON_TILE).some((i) => atas?.endsWith(i)), `rail top logo: ${atas}`);
		}
	}
	// Every module home on this user's rail: shortcuts only (no link card, number card, chart or onboarding),
	// and short. Screenshots: <profile>-home-<module>.png.
	for (const modul of harap.modul) {
		await page.evaluate((ws) => frappe.set_route("Workspaces", ws), RUMAH[modul] || modul);
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(HASIL, `${slug(profil)}-home-${slug(modul)}.png`), fullPage: true });
		const { pintasan, lain } = await page.evaluate(() => {
			const w = [...document.querySelectorAll(".layout-main-section .widget")].filter((e) => e.offsetParent);
			return {
				pintasan: w.filter((e) => e.classList.contains("shortcut-widget-box")).length,
				lain: w.filter((e) => !e.classList.contains("shortcut-widget-box")).length,
			};
		});
		cek(pintasan > 0 && pintasan <= PINTASAN_MAKS && lain === 0, `home ${modul}: ${pintasan} shortcuts, ${lain} other widgets`);
		const pesan = page.locator(".modal.show.msgprint-dialog, .modal.show .msgprint");
		cek((await pesan.count()) === 0, `home ${modul}: a message dialog is open`);
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
