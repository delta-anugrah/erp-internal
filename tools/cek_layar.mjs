// Browser check of the screens each role gets (plan Task 4b). Needs `bench start`, the sample users of
// `erp_internal.contoh.buat_contoh` (one per Role Profile: developer@, admin@, user@example.com) and their
// shared password.
//
//   cd tools && npm install && npx playwright install chromium
//   ERP_SANDI=<password> node tools/cek_layar.mjs          # ERP_URL defaults to http://erp.localhost:8002
//
// For each user it opens the apps screen, the module home and one new form, and asserts: the page is full
// width, the ERPNext and HRMS rails show only that profile's modules, Frappe's own tile (Build) shows for
// Super Admin only, the app version shows on the login page and in Settings, the unused modules (MODUL_MATI) and HR DocTypes (DOCTYPE_MATI) are offered nowhere and refused by URL, and there is no console error and no dialog. Screenshots go to tools/hasil/ (gitignored). Exit code 1 on any failure.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
const SANDI = process.env.ERP_SANDI;
// Keep in step with tampilan.NAMA_APLIKASI / IKON_APLIKASI, and hooks.add_to_apps_screen (Production Floor).
const IKON_TILE = {
	ERP: "/images/aplikasi-erp.svg",
	HR: "/images/aplikasi-hr.svg",
	System: "/images/aplikasi-sistem.svg",
	"Production Floor": "/images/aplikasi-lantai.svg",
};
const HASIL = join(dirname(fileURLToPath(import.meta.url)), "hasil");

// Keep in step with erp_internal/tampilan.py: IKON (profile → rail modules) and the module each opens on. Produksi
// has Manufacturing only (Samuel, 2026-11-23).
const KERJA = ["Stock", "Selling", "Buying", "Manufacturing", "Projects", "Shift & Attendance"];
// Rail module → its home Workspace (tampilan.PINTASAN keys). Every home is shortcuts only, at most PINTASAN_MAKS.
const RUMAH = { Setup: "Home", "Shift & Attendance": "HR" };
const PINTASAN_MAKS = 12; // was 10: Plan vs Actual added 3 shortcuts to Manufacturing (12) and 1 to Setup (11); Missing Data (2026-11-24) made Setup 12, at the cap
const PROFIL = {
	"Super Admin": { modul: [...KERJA, "Setup"], build: true, rumah: "Manufacturing", form: "Work Order" },
	Admin: { modul: [...KERJA, "Setup"], build: false, rumah: "Home", form: "User" },
	Produksi: { modul: ["Manufacturing"], build: false, rumah: "Manufacturing", form: "Production Entry" },
};
// The module whose pages the menu checks open (Stock where the profile has it): a list in the menu, a list of the
// module that is not in the menu, and a link to follow on a phone.
const MENU = {
	Stock: { daftar: "stock-entry", tanpa_link: "batch", awal: "item", link: "Warehouse" },
	Manufacturing: { daftar: "work-order", tanpa_link: "workstation", awal: "machine-capacity", link: "Work Order" },
};
const modul_menu = (harap) => (harap.modul.includes("Stock") ? "Stock" : "Manufacturing");
const APLIKASI = ["erpnext", "hrms"]; // the apps whose rails tampilan.py arranges
// tampilan.LABEL: the menu header of a module shown under another name.
const LABEL = { "Shift & Attendance": "HR", Setup: "Settings" };

// The sample logins keep their old names (contoh.SUREL).
const SUREL = { "Super Admin": "developer@example.com", Admin: "admin@example.com", Produksi: "user@example.com" };
const surel = (profil) => SUREL[profil];
// frappe.router.shell_slug: lower case, "&" spelled out, spaces to dashes
const slug = (shell) => shell.toLowerCase().replace(/&/g, " and ").trim().replace(/\s+/g, "-");

if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (SAMPLE_PASSWORD in the bench's .env).");
	process.exit(2);
}
mkdirSync(HASIL, { recursive: true });

const gagal = [];
const browser = await chromium.launch();

// The app version under the login card (erp_internal/versi.py), read as a guest.
{
	const tamu = await browser.newPage();
	await tamu.goto(`${URL}/login`);
	const versi = await tamu.locator(".for-login .erp-versi").innerText().catch(() => "");
	if (!/^v\d+\.\d+\.\d+$/.test(versi)) gagal.push(`login page: version "${versi}"`);
	await tamu.screenshot({ path: join(HASIL, "login.png") });
	await tamu.close();
}

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
					// The Production Floor tile opens its page, not a rail.
					kosong: per_app.filter(([app, m]) => !m.length && app !== "erp_internal").map(([app]) => app),
					tile: tile.map((a) => a.app_name),
				};
			}, APLIKASI);
			cek(!kosong.length, `Apps screen tiles with nothing behind them: [${kosong}]`);
			const lebih = rail.filter((m) => !harap.modul.includes(m));
			const kurang = harap.modul.filter((m) => !rail.includes(m));
			cek(!lebih.length && !kurang.length, `rail extra [${lebih}] missing [${kurang}]`);
			cek(tile.includes("frappe") === harap.build, `System (Build) tile ${harap.build ? "missing" : "shown"}`);
			cek(tile.includes("erp_internal"), "Production Floor tile missing");
			const lantai = await page.locator(".icons > *", { hasText: "Production Floor" }).locator("a.icon-title").getAttribute("href");
			cek(lantai === "/desk/manufacturing/production-floor", `Production Floor tile leads to ${lantai}`);
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
			// Folded, the menu is a rail of module icons only (public/css/erp_internal.css), and the arrow is a
			// 32 px button nothing covers (Abel, 2026-10-29).
			const ikon_lipat = await page.evaluate(() => ({
				kepala: [...document.querySelectorAll(".section-item .section-break .sidebar-item-icon")].filter((e) => e.offsetParent).length,
				tautan: [...document.querySelectorAll(".section-item .nested-container .item-anchor")].filter((e) => e.offsetParent).length,
			}));
			cek(ikon_lipat.kepala === harap.modul.length && ikon_lipat.tautan === 0, `folded menu: ${JSON.stringify(ikon_lipat)}`);
			const lipat = await panah.evaluate((e) => {
				const r = e.getBoundingClientRect();
				return { w: r.width, h: r.height, atas: e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
			});
			cek(lipat.w >= 32 && lipat.h >= 32 && lipat.atas, `folded sidebar arrow: ${JSON.stringify(lipat)}`);
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
			// The sidebar header shows the icon of the app the module belongs to (Frappe's dock-less header).
			const atas = await page.locator(".sidebar-header .header-logo img").first().getAttribute("src");
			cek(Object.values(IKON_TILE).some((i) => atas?.endsWith(i)), `sidebar header logo: ${atas}`);
		}
		if (nama === "form") {
			// One labelled menu instead of the rail (public/js/menu_samping.js, Abel 2026-11-03): no dock, the
			// profile's modules as headers in rail order, each with an icon, the page's module open with its link lit
			// (on a list: Admin's new User form is a dialog over the desk, which lights nothing).
			const mm = modul_menu(harap);
			await page.goto(`${URL}/desk/${slug(mm)}/${MENU[mm].daftar}`);
			await page.waitForLoadState("networkidle");
			await page.waitForTimeout(800);
			const menu = await page.evaluate(() => ({
				dok: !!document.querySelector("#desk-dock:not(.hidden)"),
				kelas: document.body.classList.contains("erp-menu"),
				kepala: [...document.querySelectorAll(".section-item")]
					.filter((e) => e.querySelector(":scope > .standard-sidebar-item .section-break"))
					.map((e) => ({
						label: e.dataset.id,
						ikon: !!e.querySelector(".section-break .sidebar-item-icon svg"),
						buka: !e.querySelector(":scope > .nested-container").classList.contains("hidden"),
						aktif: !!e.querySelector(".active-sidebar"),
					})),
			}));
			const label = harap.modul.map((m) => LABEL[m] || m);
			cek(!menu.dok && menu.kelas, `menu page still shows the dock (${menu.dok}) or lacks erp-menu (${menu.kelas})`);
			cek(JSON.stringify(menu.kepala.map((k) => k.label)) === JSON.stringify(label), `menu headers: ${menu.kepala.map((k) => k.label)}`);
			cek(menu.kepala.every((k) => k.ikon), "a menu header has no icon");
			const lit = menu.kepala.filter((k) => k.aktif);
			cek(lit.length === 1 && lit[0].label === mm && lit[0].buka, `${mm} not open and lit: ${JSON.stringify(lit)}`);
			await page.screenshot({ path: join(HASIL, `${slug(profil)}-menu.png`) });
			// Another module's link opens in its own shell, with that module open and only that link lit. Delivery
			// Note sits under both Stock and Selling. Produksi has one module only.
			const [dari, ke, link] = ["Stock", "Selling", "Delivery Note"];
			if (harap.modul.includes(ke)) {
				await page.evaluate((s) => frappe.set_route("Workspaces", s), dari);
				await page.waitForLoadState("networkidle");
				await page.waitForTimeout(800);
				const kepala_ke = page.locator(`.section-item[data-id="${LABEL[ke] || ke}"]`);
				if (await kepala_ke.locator(":scope > .nested-container.hidden").count()) await kepala_ke.locator(".section-break").first().click();
				await kepala_ke.locator(".nested-container .item-anchor", { hasText: link }).first().click();
				await page.waitForLoadState("networkidle");
				await page.waitForTimeout(1000);
				cek(page.url().includes(`/desk/${slug(ke)}/${slug(link)}`), `${ke} ▸ ${link} opened ${page.url()}`);
				const lit2 = await page.evaluate(() =>
					[...document.querySelectorAll(".active-sidebar")].map((e) => e.closest(".section-item")?.dataset.id)
				);
				cek(lit2.length === 1 && lit2[0] === (LABEL[ke] || ke), `lit after ${ke} ▸ ${link}: ${lit2}`);
			}
			if (profil === "Admin") {
				// Accounts has no header; a page Frappe opens there still shows the menu.
				await page.goto(`${URL}/desk/accounts/sales-invoice`);
				await page.waitForLoadState("networkidle");
				await page.waitForTimeout(800);
				const n = await page.locator(".section-item .section-break").count();
				cek(n === label.length, `Accounts page menu headers: ${n}`);
			}
			if (profil === "Super Admin") {
				// Frappe's own System app keeps its rail.
				await page.goto(`${URL}/desk/build`);
				await page.waitForLoadState("networkidle");
				await page.waitForTimeout(800);
				cek(await page.locator("#desk-dock:not(.hidden)").count(), "Build lost its rail");
				cek(!(await page.evaluate(() => document.body.classList.contains("erp-menu"))), "Build shows the ERP menu");
			}
		}
	}
	// Every module home on this user's rail: shortcuts only (no link card, number card, chart or onboarding),
	// each a card with its icon and line (pintasan.js falls back silently, so it is counted here), and short.
	// Screenshots: <profile>-home-<module>.png.
	for (const modul of harap.modul) {
		await page.evaluate((ws) => frappe.set_route("Workspaces", ws), RUMAH[modul] || modul);
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(800);
		await page.screenshot({ path: join(HASIL, `${slug(profil)}-home-${slug(modul)}.png`), fullPage: true });
		const { pintasan, lain, polos } = await page.evaluate(() => {
			const w = [...document.querySelectorAll(".layout-main-section .widget")].filter((e) => e.offsetParent);
			const p = w.filter((e) => e.classList.contains("shortcut-widget-box"));
			return {
				pintasan: p.length,
				lain: w.length - p.length,
				polos: p
					.filter(
						(e) =>
							!e.classList.contains("erp-kartu") ||
							!e.querySelector(".erp-kartu-ikon") ||
							!e.querySelector(".widget-subtitle")?.textContent.trim()
					)
					.map((e) => e.getAttribute("aria-label")),
			};
		});
		cek(pintasan > 0 && pintasan <= PINTASAN_MAKS && lain === 0, `home ${modul}: ${pintasan} shortcuts, ${lain} other widgets`);
		cek(polos.length === 0, `home ${modul}: shortcuts without their icon or line [${polos}]`);
		// The menu opens on the module whose home this is.
		const buka = await page.evaluate(() =>
			[...document.querySelectorAll(".section-item")]
				.filter((e) => e.querySelector(":scope > .nested-container:not(.hidden) .item-anchor"))
				.map((e) => e.dataset.id)
		);
		cek(buka.includes(LABEL[modul] || modul), `home ${modul}: open menu sections [${buka}]`);
		const pesan = page.locator(".modal.show.msgprint-dialog, .modal.show .msgprint");
		cek((await pesan.count()) === 0, `home ${modul}: a message dialog is open`);
	}
	// The Production Floor: a shortcut on Manufacturing's home and the first link of its sidebar; it opens the page
	// and a Work Order form, then back, stays under /manufacturing/.
	await page.evaluate(() => frappe.set_route("Workspaces", "Manufacturing"));
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(800);
	const atas = await page.locator(".body-sidebar .sidebar-item-label", { hasText: "Production Floor" }).count();
	cek(atas === 1, `Manufacturing sidebar: ${atas} Production Floor links`);
	// A menu entry of its own, first, not under Manufacturing (tampilan.MENU_ATAS, Abel 2026-11-03).
	const lantai_menu = await page.evaluate(() => {
		const a = [...document.querySelectorAll(".sidebar-items .item-anchor")].find((e) => e.textContent.includes("Production Floor"));
		return { sub: !!a?.closest(".nested-container"), pertama: document.querySelector(".sidebar-items > *")?.contains(a) };
	});
	cek(!lantai_menu.sub && lantai_menu.pertama, `Production Floor menu entry: ${JSON.stringify(lantai_menu)}`);
	await page.locator(".layout-main-section .shortcut-widget-box", { hasText: "Production Floor" }).first().click();
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(1500);
	cek(page.url().endsWith("/production-floor"), `floor shortcut opened ${page.url()}`);
	await page.evaluate(() => frappe.set_route("List", "Work Order"));
	await page.waitForTimeout(1000);
	await page.evaluate(() => history.back());
	await page.waitForTimeout(1500);
	// The floor page hides the sidebar on purpose (full-bleed); coming back must still name Manufacturing.
	cek(page.url().includes("/manufacturing/production-floor"), `floor after a Work Order list: ${page.url()}`);
	// Its back button (top left) leads to Manufacturing's home without the browser's Back.
	await page.locator(".kembali").click();
	await page.waitForURL(/\/desk\/manufacturing\/?$/, { timeout: 5000 }).catch(() => {});
	cek(/\/desk\/manufacturing\/?$/.test(page.url()), `floor back button opened ${page.url()}`);
	// Daily Input (page daily-input, Samuel 2026-11-23): a menu entry of its own; Produksi types a number into an empty
	// Shift 1 cell and sees TOTAL change, then clears it; Admin sees no input. 1440, 768 and 390 px, no sideways scroll.
	const harian = await page.evaluate(() => {
		const a = [...document.querySelectorAll(".sidebar-items .item-anchor")].find((e) => e.textContent.includes("Daily Input"));
		return { ada: !!a, sub: !!a?.closest(".nested-container") };
	});
	cek(harian.ada && !harian.sub, `Daily Input menu entry: ${JSON.stringify(harian)}`);
	await page.goto(`${URL}/desk/manufacturing/daily-input`);
	await page.waitForLoadState("networkidle");
	await page.locator(".erp-ih-kepala").waitFor({ timeout: 10000 }).catch(() => {});
	const n_blok = await page.locator(".erp-ih-blok").count();
	const n_isi = await page.locator(".erp-ih input[data-key]").count();
	cek(n_blok > 0, "Daily Input: no Work Order block (the sample data has open orders)");
	if (profil === "Admin") cek(n_isi === 0, `Daily Input: Admin sees ${n_isi} inputs`);
	if (profil === "Produksi") {
		// The first block whose empty Shift 1 cell takes a piece (a full order refuses it on the cell: try the next).
		const angka = (t) => Number((t || "").replace(/\./g, "")) || 0;
		let ditulis = false;
		for (const blok of await page.locator(".erp-ih-blok").all()) {
			const sel = blok.locator('input[data-key$="|Shift 1"]').last();
			if (!(await sel.count()) || (await sel.inputValue()) !== "") continue;
			// Room for one more piece, so the order stays open (its block keeps its inputs for the clearing).
			const po = angka((await blok.locator(".erp-ih-ringkas span").first().innerText()).match(/[\d.]+/)?.[0]);
			if (angka(await blok.locator("tfoot .erp-ih-semua").innerText()) + 1 >= po) continue;
			const total = blok.locator("tfoot td.erp-ih-angka").first();
			const awal = angka(await total.innerText());
			await sel.fill("1");
			await sel.press("Enter"); // moves to the next cell, which saves this one
			const naik = await page
				.waitForFunction(([wo, n]) => {
					const s = document.querySelector(`section[data-wo="${CSS.escape(wo)}"]`);
					return Number(s?.querySelector("tfoot td.erp-ih-angka")?.textContent.replace(/\./g, "")) === n;
				}, [await blok.getAttribute("data-wo"), awal + 1], { timeout: 15000 })
				.then(() => true)
				.catch(() => false);
			if (!naik) {
				cek(await blok.locator(".erp-ih-galat").count(), "Daily Input: a cell neither saved nor said why");
				await sel.fill("");
				continue;
			}
			// Clear it again: the entry is cancelled and TOTAL is back.
			await page.screenshot({ path: join(HASIL, `${slug(profil)}-harian-isi.png`) });
			const wo = await blok.getAttribute("data-wo");
			const lagi = page.locator(`section[data-wo="${wo}"] input[data-key$="|Shift 1"]`).last();
			if (!(await lagi.count())) {
				cek(false, `Daily Input: ${wo} lost its inputs after a save; cancel its entry of today by hand`);
				break;
			}
			await lagi.fill("");
			await lagi.press("Tab");
			const turun = await page
				.waitForFunction(([wo, n]) => {
					const s = document.querySelector(`section[data-wo="${CSS.escape(wo)}"]`);
					return Number(s?.querySelector("tfoot td.erp-ih-angka")?.textContent.replace(/\./g, "")) === n;
				}, [wo, awal], { timeout: 15000 })
				.then(() => true)
				.catch(() => false);
			cek(turun, `Daily Input: clearing the cell of ${wo} did not bring TOTAL back to ${awal}`);
			ditulis = true;
			break;
		}
		cek(ditulis, "Daily Input: no block took a number in an empty Shift 1 cell");
		// "Record Output" on a Work Order opens the page at that order's block only.
		const wo = await page.locator(".erp-ih-blok").first().getAttribute("data-wo");
		await page.evaluate(() => frappe.set_route("List", "Work Order"));
		await page.waitForTimeout(1000);
		await page.evaluate((wo) => {
			frappe.route_options = { work_order: wo };
			frappe.set_route("daily-input");
		}, wo);
		await page.waitForFunction(() => document.querySelectorAll(".erp-ih-blok").length === 1, null, { timeout: 10000 }).catch(() => {});
		cek((await page.locator(".erp-ih-blok").count()) === 1, "Daily Input at one Work Order: not one block");
	}
	for (const lebar of [1440, 768, 390]) {
		await page.setViewportSize({ width: lebar, height: 900 });
		await page.waitForTimeout(500);
		const geser = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
		cek(geser <= 0, `Daily Input at ${lebar} px scrolls sideways by ${geser} px`);
		await page.screenshot({ path: join(HASIL, `${slug(profil)}-harian-${lebar}.png`), fullPage: true });
	}
	await page.setViewportSize({ width: 1440, height: 900 });
	// The user's Settings dialog (avatar menu > My Settings) ends its left menu with the app version (public/js/versi.js).
	await page.evaluate(() => frappe.require("user_settings_dialog.bundle.js").then(() => frappe.ui.show_user_settings("profile")));
	const versi = page.locator(".settings-dialog-sidebar .erp-versi");
	await versi.waitFor({ timeout: 5000 }).catch(() => {});
	const harap_versi = await page.evaluate(() => `v${frappe.boot.versions.erp_internal}`);
	cek((await versi.count()) === 1 && (await versi.innerText()) === harap_versi, `Settings dialog: no version ${harap_versi}`);
	await page.screenshot({ path: join(HASIL, `${slug(profil)}-settings.png`) });
	await page.keyboard.press("Escape");
	cek(!galat.length, `console errors: ${galat.slice(0, 3).join(" | ")}`);
	// Modules nobody uses (tampilan.MODUL_MATI): not in the search bar or a menu, refused by URL. After the console
	// check: the refusal logs a 403.
	const mati = await page.evaluate(() => ({
		cari: ["Lead", "Asset", "Issue", "Quality Goal", "Salary Slip", "Job Applicant", "Appraisal", "Expense Claim"].filter((d) =>
			frappe.boot.user.can_read.includes(d)
		),
		menu: Object.keys(frappe.boot.module_sidebars || {}).filter((s) =>
			/^(CRM|Assets|Quality|Support|Payroll|Recruitment|Performance|Expenses|Tenure)$/.test(s)
		),
	}));
	cek(!mati.cari.length && !mati.menu.length, `unused modules still offered: ${JSON.stringify(mati)}`);
	await page.goto(`${URL}/desk/lead`);
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(800);
	// Not permitted, or Not found for Super Admin (System Manager reads Page, so the route falls through to a 404).
	cek(/Not permitted|Not found/i.test(await page.locator("body").innerText()), "/desk/lead opened");
	const api = await page.request.get(`${URL}/api/resource/Lead?limit=1`);
	cek(api.status() === 403, `/api/resource/Lead: ${api.status()}`);
	// HR's unused DocTypes (tampilan.DOCTYPE_MATI) are refused too; the attendance the office uses stays open where the
	// profile has HR.
	const klaim = await page.request.get(`${URL}/api/resource/Expense Claim?limit=1`);
	cek(klaim.status() === 403, `/api/resource/Expense Claim: ${klaim.status()}`);
	if (harap.modul.includes("Shift & Attendance")) {
		const absen = await page.request.get(`${URL}/api/resource/Attendance?limit=1`);
		cek(absen.status() === 200, `/api/resource/Attendance: ${absen.status()}`);
	}
	await context.close();

	// Phone width: Frappe's drawer shows the same menu and shuts after a link click.
	const hp = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: undefined });
	const ph = await hp.newPage();
	await ph.request.post(`${URL}/api/method/login`, { form: { usr: surel(profil), pwd: SANDI } });
	// A page of the module with no link of its own in the menu lights nothing: the drawer still opens on it.
	const mm = modul_menu(harap);
	await ph.goto(`${URL}/desk/${slug(mm)}/${MENU[mm].tanpa_link}`);
	await ph.waitForLoadState("networkidle");
	await ph.locator(".sidebar-toggle-btn").first().click();
	await ph.waitForTimeout(600);
	cek(
		await ph.locator(`.section-item[data-id="${mm}"] > .nested-container:not(.hidden) .item-anchor`).first().isVisible(),
		`phone drawer on a ${mm} page with no menu link: ${mm} not open`
	);
	await ph.goto(`${URL}/desk/${slug(mm)}/${MENU[mm].awal}`);
	await ph.waitForLoadState("networkidle");
	await ph.locator(".sidebar-toggle-btn").first().click();
	await ph.waitForTimeout(600);
	const n_hp = await ph.locator(".section-item .section-break:visible").count();
	cek(n_hp === harap.modul.length, `phone drawer menu headers: ${n_hp}`);
	await ph.screenshot({ path: join(HASIL, `${slug(profil)}-menu-hp.png`) });
	await ph.locator(`.section-item[data-id="${mm}"] .nested-container .item-anchor`, { hasText: MENU[mm].link }).first().click();
	// The router writes the shell into the URL a moment after the click.
	const tujuan = `/desk/${slug(mm)}/${slug(MENU[mm].link)}`;
	await ph.waitForURL((u) => u.pathname.startsWith(tujuan), { timeout: 5000 }).catch(() => {});
	cek(ph.url().includes(tujuan), `phone link opened ${ph.url()}`);
	cek(!(await ph.locator(".body-sidebar-container.expanded").count()), "phone drawer still open after a link");
	// The Production Floor on a phone: its back button and the output card stay on screen, no sideways scroll.
	await ph.goto(`${URL}/desk/manufacturing/production-floor`);
	await ph.waitForLoadState("networkidle");
	await ph.waitForTimeout(3000);
	const lantaiHp = await ph.evaluate(() => {
		const root = [...document.querySelectorAll("*")].find((e) => e.shadowRoot?.querySelector(".kembali"))?.shadowRoot;
		const kotak = (sel) => root?.querySelector(sel)?.getBoundingClientRect();
		const ok = (r) => !!r && r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1;
		return { kembali: ok(kotak(".kembali")), hasil: ok(kotak('.sel[data-kpi="hasil"] .nilai')), lebar: document.documentElement.scrollWidth <= innerWidth };
	});
	cek(lantaiHp.kembali && lantaiHp.hasil && lantaiHp.lebar, `phone floor: ${JSON.stringify(lantaiHp)}`);
	await ph.screenshot({ path: join(HASIL, `${slug(profil)}-lantai-hp.png`) });
	await hp.close();
}

await browser.close();
if (gagal.length) {
	console.error(gagal.join("\n"));
	process.exit(1);
}
console.log(`cek_layar: ${Object.keys(PROFIL).length} users OK, screenshots in ${HASIL}`);
