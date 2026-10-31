// Browser check of the Production Floor page (/desk/production-floor). Needs `bench start` and the sample users.
//
//   cd tools && npm install && npx playwright install chromium
//   ERP_SANDI=<password> node tools/lantai.mjs          # ERP_URL defaults to http://erp.localhost:8002
//
// Asserts: one canvas in the shadow root, no message dialog, one WebGL context after leaving and coming back
// 5 times, and 14 slot markers in floor order (front row 1..7, back row 14..8, left to right, back row above the
// front row on screen). Screenshot in tools/hasil/ (gitignored). Exit code 1 on any failure.
//
// Then, with the machines (pass case names to run only some: `node tools/lantai.mjs states perf`):
//   states       six statuses set through set_status on Mesin 01-06; lamps, pulse, dimming, screen, ring breath and motion read back
//                from info().mesin (statuses restored after)
//   13-machines  Mesin 05's erp_nomor set to 0 for the run (bench execute; restored after): 13 machines, slot 5
//                empty, no dialog; a duplicate and an unknown number land in the spare row
//   no-webgl     --disable-webgl: the plain table with 14 rows, no canvas, no dialog; the same when the bundle fails
//   perf         headed Chromium 1440x900 @2x: 10 s scripted orbit with two status changes, first 2 s dropped:
//                >= 57 fps, intervals > 25 ms <= 1 %, max <= 50 ms, no long task, <= 100 draw calls, <= 250k
//                triangles; 20 status changes grow no geometry, texture or shader program (p95 printed only)
//   adaptive     CPU throttled 6x: pixel ratio 1 within 4 s, the reset button answers within 300 ms
//   label        machine 3's label reads "03 · <brand> <tonnage>T" over its machine; no label writes while the camera
//                rests; labels behind the camera hide
//   label-rapi   at 1440x900, 1280x720 and 390x844 from the default camera: no two full labels intersect, no visible
//                label intersects a card, the selected label (Mesin 05 through the table) is full, no full/compact
//                switch over 2 s of rest; zoomed in twice no visible label intersects the KPI row
//   pilih        a real click on Mesin 03 opens its panel and flies the camera to it; Open machine goes to the form;
//                a bottom sheet at 390 px wide
//   pabrik       the decor is drawn; every machine's andon point projects inside the canvas with nothing in front of it from
//                the default camera; Mesin 01 set to Problem has a red, pulsing floor ring (restored after)
//   zona         the zones' props and floor lettering: the six strings in English and (user switched) Indonesian, every
//                lettering plate on the slab and at its zone, building + zones <= 100 calls / 250k triangles, 20 status
//                changes grow no geometry, texture or program (language switched back after)
//   status       the Problem button: spinner and disabled until the answer, the server's status (get_value), the
//                chip, the lamp; a refused change is an inline note; an unchanged refetch touches no machine
//   wo, xss      a submitted In Process Work Order (40 produced) on Mesin 03: label item and progress, panel link;
//                then an item name and a model of <img src=x onerror=...> show as text (Work Order removed after)
//   set_value    frappe.db.set_value on a status (no event) with ?poll=3: the view follows
//   poll         /socket.io blocked, ?poll=3: a status change still shows
//   live         realtime on, default 60 s poll: a change from another tab shows within 5 s
//   reconnect    the socket forced to disconnect and reconnect: a change made elsewhere shows within 5 s (the poll is 60 s)
//   notes        get_data answering 500 on the first load: an inline note, no dialog; an empty floor has its own note;
//                the next good fetch clears it
//   panel-quiet  an unchanged refetch writes nothing into the open panel; aria-live is on the chip, not the panel
//   strip        back to the floor from a Work Order form (sidebar link, browser back): host left edge = page body's
//                left edge (no empty strip), no dialog
//   hidden       page left / tab hidden: no get_data on a nudge; on return the change shows within 3 s
//   id           user@example.com in Indonesian: "Lantai Produksi" and the status names (switched back after)
//   hud          the info bar: company name, a ticking clock, 14 machines, status chips and KPIs equal to get_data(),
//                a table row selects like a scene click, nothing covers the panel, camera +/−, the table's fold is
//                remembered; at 390 px two compact rows, the table collapsed, the bottom sheet on top
//   hud-live     the dot reads Live with realtime, "Updated HH:MM" with /socket.io blocked
//   hud-xss      a company name of <img onerror> shows as text; only a same-origin /files/ logo becomes an image
//   hidup        Mesin 01 Production, 02 Problem, 03 Off (restored after): an operator at 01, a technician at 02, nobody at
//                03; parts fall within 2 cycles; no forklift; the "simulated" note is in the HUD
//                (13-machines, adaptive and hidden also check the life layer: figures and bins follow the drawn
//                machines; after the quality drop no part falls; hidden: the mould cycle stands still
//                and returns without a jump)
//   perhatian    02 Problem, 03 Idle, 04 Maintenance (the rest Production): the attention card reads 02, 04, 03; a click
//                selects 04; all Production says "All machines running"; it sits under the machine table, top left
//                (statuses restored after)
//   dekor-gelap  dark theme: info().pabrik and info().zona report the dark palette (walls, roof cap, truck, props darker
//                than light), the floor lettering keeps >= 3:1 against its zone in both themes
//   memuat       the loading screen is up before the first data, gone after data and the first frame; a failed first
//                load gives way to the note
//   glass        every fixed card's backdrop-filter blurs; every text >= 4.5:1 on its card, light and dark; with
//                prefers-reduced-transparency (CDP) every card and label is opaque with no backdrop-filter
// ERP_BENCH (default ~/Desktop/Projects/erp-internal-bench) and ERP_SITE (erp.localhost) are for bench execute.

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
const SANDI = process.env.ERP_SANDI;
const HASIL = join(dirname(fileURLToPath(import.meta.url)), "hasil");
const BENCH = process.env.ERP_BENCH || join(homedir(), "Desktop/Projects/erp-internal-bench");
const SITUS = process.env.ERP_SITE || "erp.localhost";
const KASUS = process.argv.slice(2);
const jalankan = (nama) => !KASUS.length || KASUS.includes(nama);
const DASAR = !KASUS.length || KASUS.includes("dasar");
// Headless Chromium's own GL runs the scene at 60 fps here; ERP_GL=swiftshader forces software GL (about 12 fps,
// for a machine without a GPU). The perf and adaptive cases always run headed on the real GPU.
const ARGS_GL = process.env.ERP_GL === "swiftshader" ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [];

if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (SAMPLE_PASSWORD in the bench's .env).");
	process.exit(2);
}
mkdirSync(HASIL, { recursive: true });

const gagal = [];
const cek = (syarat, pesan) => syarat || gagal.push(pesan);

const browser = await chromium.launch({ args: ARGS_GL });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Every WebGL context any canvas asks for, to prove the page keeps one for the whole session.
await context.addInitScript(() => {
	window.__konteks = 0;
	const asli = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function (jenis, ...sisa) {
		if (/webgl/i.test(jenis) && !this.__dihitung) {
			this.__dihitung = true;
			window.__konteks += 1;
		}
		return asli.call(this, jenis, ...sisa);
	};
});
const page = await context.newPage();
const galat = [];
page.on("console", (m) => m.type() === "error" && galat.push(m.text()));
page.on("pageerror", (e) => galat.push(String(e)));

const masuk = await page.request.post(`${URL}/api/method/login`, { form: { usr: "user@example.com", pwd: SANDI } });
if (!masuk.ok()) {
	console.error(`login failed (${masuk.status()})`);
	process.exit(1);
}

if (DASAR) {
await page.goto(`${URL}/desk/production-floor`);
try {
	await page.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 20000 });
} catch {
	gagal.push("erp.lantai.aktif never appeared (page or bundle missing)");
}
await page.waitForTimeout(1500);

if (!gagal.length) {
	const pesan = page.locator(".modal.show.msgprint-dialog, .modal.show .msgprint");
	cek((await pesan.count()) === 0, `a message dialog is open: ${(await pesan.allInnerTexts()).join(" ").slice(0, 200)}`);

	const kanvas = await page.evaluate(() => {
		const host = document.querySelector(".lantai-host");
		return { n: host?.shadowRoot?.querySelectorAll("canvas").length ?? -1, luar: host ? host.querySelectorAll("canvas").length : -1 };
	});
	cek(kanvas.n === 1, `canvases in the shadow root: ${kanvas.n}`);
	cek(kanvas.luar === 0, `canvases outside the shadow root: ${kanvas.luar}`);

	// Slot markers: screen position of each, from the active camera.
	const penanda = await page.evaluate(() => erp.lantai.aktif.info().penanda);
	cek(penanda.length === 14, `slot markers: ${penanda.length}`);
	if (penanda.length === 14) {
		const per = Object.fromEntries(penanda.map((p) => [p.nomor, p]));
		const urut = (nomor) => nomor.map((n) => per[n]);
		const depan = urut([1, 2, 3, 4, 5, 6, 7]);
		const belakang = urut([14, 13, 12, 11, 10, 9, 8]);
		const naik = (l) => l.every((p, i) => i === 0 || p.x > l[i - 1].x);
		cek(depan.every(Boolean) && naik(depan), `front row 1..7 not left to right: ${JSON.stringify(depan)}`);
		cek(belakang.every(Boolean) && naik(belakang), `back row 14..8 not left to right: ${JSON.stringify(belakang)}`);
		const yDepan = Math.min(...depan.map((p) => p.y));
		const yBelakang = Math.max(...belakang.map((p) => p.y));
		cek(yBelakang < yDepan, `back row is not above the front row (back max y ${yBelakang}, front min y ${yDepan})`);
	}
	await page.screenshot({ path: join(HASIL, "lantai.png") });

	// Leave and come back 5 times: still one canvas, one context.
	for (let i = 0; i < 5; i++) {
		await page.evaluate(() => frappe.set_route("Workspaces", "Manufacturing"));
		await page.waitForTimeout(700);
		await page.evaluate(() => frappe.set_route("production-floor"));
		await page.waitForTimeout(700);
	}
	// While the page is hidden the loop must stand still; back on the page it must draw again.
	const total = () => page.evaluate(() => erp.lantai.aktif.info().total);
	await page.evaluate(() => frappe.set_route("Workspaces", "Manufacturing"));
	await page.waitForTimeout(500);
	const a1 = await total();
	await page.waitForTimeout(1000);
	cek((await total()) === a1, "frames kept drawing while the page was hidden");
	await page.evaluate(() => frappe.set_route("production-floor"));
	await page.waitForTimeout(500);
	const a2 = await total();
	await page.waitForTimeout(500);
	cek((await total()) > a2, "frames did not advance after returning to the page");

	const akhir = await page.evaluate(() => ({
		konteks: erp.lantai.aktif.info().konteks,
		hitung: window.__konteks,
		kanvas: document.querySelector(".lantai-host")?.shadowRoot?.querySelectorAll("canvas").length,
	}));
	cek(akhir.konteks === 1, `info().konteks after 5 round trips: ${akhir.konteks}`);
	cek(akhir.hitung === 1, `WebGL contexts created by the browser: ${akhir.hitung}`);
	cek(akhir.kanvas === 1, `canvases after 5 round trips: ${akhir.kanvas}`);
}
// Race: leave before the bundle has loaded (fresh load, route away in the same tick): the scene mounts paused.
{
	const p2 = await context.newPage();
	await p2.goto(`${URL}/desk`);
	await p2.waitForFunction(() => window.frappe?.boot && frappe.set_route);
	await p2.evaluate(() => {
		frappe.set_route("production-floor");
		frappe.set_route("Workspaces", "Manufacturing");
	});
	try {
		await p2.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 20000 });
		await p2.waitForTimeout(500);
		const t = () => p2.evaluate(() => erp.lantai.aktif.info().total);
		const b1 = await t();
		await p2.waitForTimeout(1000);
		cek((await t()) === b1, "the scene draws although the page was left before it mounted");
	} catch {
		gagal.push("race check: the page was never mounted (route away too early to test)");
	}
	await p2.close();
}
// Background tab: the page loads while the browser tab is hidden; once the tab shows, the scene must draw.
{
	const p3 = await context.newPage();
	await p3.addInitScript(() => {
		let fals = true;
		Object.defineProperty(document, "hidden", { configurable: true, get: () => fals });
		window.__tampilkan = () => {
			fals = false;
			document.dispatchEvent(new Event("visibilitychange"));
		};
	});
	await p3.goto(`${URL}/desk/production-floor`);
	try {
		await p3.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 20000 });
		await p3.waitForTimeout(500);
		const t = () => p3.evaluate(() => erp.lantai.aktif.info().total);
		const c1 = await t();
		await p3.waitForTimeout(500);
		cek((await t()) === c1, "the scene draws in a hidden browser tab");
		await p3.evaluate(() => window.__tampilkan());
		await p3.waitForTimeout(700);
		const c2 = await t();
		await p3.waitForTimeout(500);
		cek((await t()) > c2, "the scene stays frozen after the browser tab became visible");
	} catch {
		gagal.push("background tab check: the page was never mounted");
	}
	await p3.close();
}
} // DASAR

// --- helpers for the machine cases ---------------------------------------------------------------------------

// A whitelisted method called from the page with the session's CSRF token; never through frappe.call (no dialogs).
const api = (p, metode, args = {}, post = true) =>
	p.evaluate(
		async ({ metode, args, post }) => {
			const r = await fetch(`/api/method/${metode}`, {
				method: post ? "POST" : "GET",
				headers: { "Content-Type": "application/json", Accept: "application/json", "X-Frappe-CSRF-Token": frappe.csrf_token },
				body: post ? JSON.stringify(args) : undefined,
			});
			const j = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(`${metode}: HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
			return j.message;
		},
		{ metode, args, post }
	);
const bench = (...args) => execFileSync("bench", ["--site", SITUS, ...args], { cwd: BENCH, encoding: "utf8" });
const dialog = async (p) => p.locator(".modal.show.msgprint-dialog, .modal.show .msgprint").count();

async function bukaLantai(ctx, { tunggu = true } = {}) {
	const p = await ctx.newPage();
	p.__galat = [];
	p.on("console", (m) => m.type() === "error" && p.__galat.push(m.text()));
	p.on("pageerror", (e) => p.__galat.push(String(e)));
	await p.goto(`${URL}/desk/production-floor`, { waitUntil: "domcontentloaded", timeout: 60000 });
	await p.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 20000 });
	if (tunggu) await p.waitForFunction(() => (erp.lantai.aktif.info().mesin || []).length > 0, null, { timeout: 10000 });
	return p;
}
async function konteksMasuk(b, opsi = {}) {
	const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...opsi });
	const r = await ctx.request.post(`${URL}/api/method/login`, { form: { usr: "user@example.com", pwd: SANDI } });
	if (!r.ok()) throw new Error(`login failed (${r.status()})`);
	return ctx;
}
const hexJarak = (a, b) => {
	if (!a || !b) return 999;
	const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
	const [x, y] = [n(a), n(b)];
	return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
};
// Statuses of the given machines from data(), to put them back after a case.
async function catatStatus(p, nama) {
	const d = await api(p, "erp_internal.production_floor.get_data", {}, false);
	return Object.fromEntries(d.mesin.filter((m) => nama.includes(m.name)).map((m) => [m.name, m.status || ""]));
}
// set_status refuses an empty status (not one of the Workstation's options), so an originally empty one goes back
// through bench execute.
async function pulihkanStatus(p, asli) {
	for (const [mesin, status] of Object.entries(asli)) {
		try {
			if (status) await api(p, "erp_internal.production_floor.set_status", { machine: mesin, status });
			else bench("execute", "frappe.db.set_value", "--args", JSON.stringify(["Workstation", mesin, "status", ""]));
		} catch (e) {
			gagal.push(`could not restore ${mesin} to ${status}: ${e.message}`);
		}
	}
}

// --- states: the spec's status table ---------------------------------------------------------------------------
if (jalankan("states")) {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const RENCANA = {
		"Mesin 01": "Production",
		"Mesin 02": "Off",
		"Mesin 03": "Idle",
		"Mesin 04": "Problem",
		"Mesin 05": "Maintenance",
		"Mesin 06": "Setup",
	};
	// Lit segment, its steady colour, pulse Hz, body brightness, platen motion, screen brightness, ring breath Hz.
	const HARAP = {
		Production: ["hijau", "#22d36b", 0, 1, true, 1.3, 0.4],
		Off: [null, null, 0, 0.38, false, 0.06, 0],
		Idle: ["kuning", "#ffc21a", 0, 0.78, false, 0.2, 0],
		Problem: ["merah", null, 1.25, 1, false, 0.7, 0],
		Maintenance: ["biru", "#3d8bff", 0, 0.6, false, 0.3, 0],
		Setup: ["kuning", null, 0.45, 1, false, 0.7, 0],
	};
	const asli = await catatStatus(p, Object.keys(RENCANA));
	try {
		for (const [mesin, status] of Object.entries(RENCANA)) {
			const baris = await api(p, "erp_internal.production_floor.set_status", { machine: mesin, status });
			cek(baris?.status === status, `set_status ${mesin} → ${status} answered ${JSON.stringify(baris)?.slice(0, 120)}`);
		}
		await p.evaluate(() => erp.lantai.aktif.muat());
		// Wait for the easing itself: every steady lamp at its colour and every body at its brightness (a fixed delay
		// flaked when a slow frame stretched the easing), with a timeout; the checks below then report what is left.
		const sasaran = Object.fromEntries(Object.entries(RENCANA).map(([n, s]) => [n, { warna: HARAP[s][1], redup: HARAP[s][3], terang: HARAP[s][5] }]));
		await p
			.waitForFunction(
				(sasaran) => {
					const jarak = (a, b) => {
						if (!a) return 999;
						const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
						return Math.max(...n(a).map((v, i) => Math.abs(v - n(b)[i])));
					};
					const info = erp.lantai.aktif.info();
					return Object.entries(sasaran).every(([nama, t]) => {
						const m = info.mesin.find((x) => x.nama === nama);
						if (!m || Math.abs(m.redup - t.redup) >= 0.01 || Math.abs(m.terang - t.terang) >= 0.01) return false;
						if (t.warna && jarak(m.warna, t.warna) > 6) return false;
						return m.gerak ? m.amp > 0.9 || info.kualitas.rendah : m.amp === 0;
					});
				},
				sasaran,
				{ timeout: 10000, polling: 50 }
			)
			.catch(() => {});
		const info = await p.evaluate(() => erp.lantai.aktif.info());
		const per = Object.fromEntries(info.mesin.map((m) => [m.nama, m]));
		for (const [mesin, status] of Object.entries(RENCANA)) {
			const m = per[mesin];
			const [lampu, warna, denyut, redup, gerak, terang, nadi] = HARAP[status];
			if (!cek(m, `${mesin} not drawn`)) continue;
			cek(m.status === status, `${mesin} status ${m.status}, wanted ${status}`);
			cek(m.lampu === lampu, `${mesin} (${status}) lamp ${m.lampu}, wanted ${lampu}`);
			if (warna) cek(hexJarak(m.warna, warna) <= 6, `${mesin} (${status}) lamp colour ${m.warna}, wanted ${warna}`);
			cek(m.denyut === denyut, `${mesin} (${status}) pulse ${m.denyut} Hz, wanted ${denyut}`);
			cek(Math.abs(m.redup - redup) < 0.01, `${mesin} (${status}) body ${m.redup}, wanted ${redup}`);
			cek(m.gerak === gerak, `${mesin} (${status}) motion ${m.gerak}, wanted ${gerak}`);
			cek(Math.abs(m.terang - terang) < 0.01, `${mesin} (${status}) screen ${m.terang}, wanted ${terang}`);
			cek(m.nadi === nadi, `${mesin} (${status}) ring breath ${m.nadi} Hz, wanted ${nadi}`);
			if (!gerak) cek(m.amp === 0, `${mesin} (${status}) platen still moving (amp ${m.amp})`);
			else if (!info.kualitas.rendah) cek(m.amp > 0.9, `${mesin} (Production) platen not cycling (amp ${m.amp})`);
		}
		// Problem blinks hard: its red lamp is seen fully lit and nearly dark within two periods.
		const warnaMerah = [];
		for (let i = 0; i < 16; i++) {
			warnaMerah.push(await p.evaluate(() => erp.lantai.aktif.info().mesin.find((m) => m.nama === "Mesin 04")?.warna));
			await p.waitForTimeout(90);
		}
		const merah = warnaMerah.map((h) => parseInt(String(h).slice(1, 3), 16) || 0);
		cek(per["Mesin 04"]?.kedip === true, "Problem lamp is not marked as blinking");
		// The hex is sRGB: the dark phase (0.05 linear) reads about 0x3f.
		cek(Math.max(...merah) >= 230 && Math.min(...merah) <= 80, `Problem lamp does not blink on and off: ${warnaMerah.join(" ")}`);
		// Production's ring breathes (brightness swings) while its lamp stays steady; Idle's ring is still.
		const terangCincin = (h) => Math.max(...[1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16)));
		const napas = { "Mesin 01": [], "Mesin 03": [] };
		for (let i = 0; i < 14; i++) {
			const ms = await p.evaluate(() => erp.lantai.aktif.info().mesin.filter((m) => m.nama === "Mesin 01" || m.nama === "Mesin 03"));
			for (const m of ms) napas[m.nama].push(terangCincin(m.cincin));
			await p.waitForTimeout(100);
		}
		const ayun = (a) => Math.max(...a) - Math.min(...a);
		cek(ayun(napas["Mesin 01"]) >= 40, `Production ring does not breathe: ${napas["Mesin 01"].join(" ")}`);
		cek(ayun(napas["Mesin 03"]) <= 3, `Idle ring is not still: ${napas["Mesin 03"].join(" ")}`);
		cek((await dialog(p)) === 0, "states: a message dialog is open");
		await p.screenshot({ path: join(HASIL, "lantai-status.png") });
	} finally {
		await pulihkanStatus(p, asli);
	}
	cek(!p.__galat.length, `states: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	await ctx.close();
}

// --- 13 machines, duplicates and unknown numbers ----------------------------------------------------------------
if (jalankan("13-machines")) {
	const ctx = await konteksMasuk(browser);
	const ubah = (n) => bench("execute", "frappe.db.set_value", "--args", JSON.stringify(["Workstation", "Mesin 05", "erp_nomor", n]));
	const nomorAsli = JSON.parse(
		bench("execute", "frappe.db.get_value", "--args", JSON.stringify(["Workstation", "Mesin 05", "erp_nomor"])).trim().split("\n").pop()
	);
	try {
		ubah(0);
		const p = await bukaLantai(ctx);
		await p.waitForTimeout(800);
		const info = await p.evaluate(() => erp.lantai.aktif.info());
		cek(info.mesin.length === 13, `13 machines: drawn ${info.mesin.length}`);
		cek(!info.mesin.some((m) => m.nomor === 5 || m.nama === "Mesin 05"), "13 machines: Mesin 05 is still drawn");
		const tanda = Object.fromEntries(info.penanda.map((m) => [m.nomor, m.tampak]));
		cek(tanda[5] === true, "13 machines: slot 5's marker is not showing (slot not empty)");
		cek(Object.entries(tanda).every(([n, t]) => (Number(n) === 5) === t), `13 machines: marker visibility ${JSON.stringify(tanda)}`);
		cek((await dialog(p)) === 0, "13 machines: a message dialog is open");
		const hid = info.hidup;
		const gambar = new Set(info.mesin.map((m) => m.nama));
		cek(hid?.tong?.length === 13, `13 machines: ${hid?.tong?.length} bins`);
		cek(hid?.tong?.every((t) => gambar.has(t.nama)) && !hid.tong.some((t) => t.nama === "Mesin 05"), "13 machines: a bin for a machine that is not drawn");
		cek(hid?.orang?.length <= 13 && hid.orang.every((o) => gambar.has(o.nama)), `13 machines: ${hid?.orang?.length} figures, one for a machine not drawn`);
		await p.screenshot({ path: join(HASIL, "lantai-13.png") });

		// Duplicate number 3 and an unknown number 99: both in the spare row, the real 03 stays in its slot.
		const dup = await p.evaluate(async () => {
			const d = await erp.lantai.ambil();
			d.mesin.push({ ...d.mesin[0], name: "Uji Ganda", nomor: 3 }, { ...d.mesin[0], name: "Uji 99", nomor: 99 });
			erp.lantai.aktif.perbarui(d);
			const m = erp.lantai.aktif.info().mesin;
			const h = erp.lantai.aktif.info().hidup;
			erp.lantai.aktif.perbarui({ mesin: [] });
			erp.lantai.aktif.perbarui({ mesin: null });
			await erp.lantai.aktif.muat();
			return { m, h, sesudah: erp.lantai.aktif.info().mesin.length };
		});
		const per = Object.fromEntries(dup.m.map((m) => [m.nama, m]));
		cek(per["Mesin 03"]?.slot === 3, `duplicate: Mesin 03 left its slot (${JSON.stringify(per["Mesin 03"])})`);
		for (const n of ["Uji Ganda", "Uji 99"])
			cek(per[n] && per[n].slot === null && per[n].z > 5, `duplicate: ${n} not in the spare row (${JSON.stringify(per[n])})`);
		cek(per["Uji Ganda"]?.x !== per["Uji 99"]?.x, "duplicate: two spare machines share a spot");
		cek(dup.h?.tong?.length === 15, `duplicate: ${dup.h?.tong?.length} bins for 15 drawn machines`);
		cek(dup.h?.orang?.every((o) => o.z > -9 && o.z < 12), "duplicate: a figure stands outside the building");
		cek(dup.sesudah === 13, `after the duplicate check the floor shows ${dup.sesudah} machines`);
		cek(!p.__galat.length, `13 machines: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} finally {
		try {
			ubah(nomorAsli);
		} catch (e) {
			gagal.push(`could not restore Mesin 05's erp_nomor to ${nomorAsli}: ${e.message}`);
		}
	}
	await ctx.close();
}

// --- no WebGL: the plain table -------------------------------------------------------------------------------------
if (jalankan("no-webgl")) {
	const tanpa = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] });
	const baris = (p) =>
		p.evaluate(() => {
			const r = document.querySelector(".lantai-host")?.shadowRoot;
			return {
				baris: r?.querySelectorAll("table tbody tr").length ?? -1,
				kepala: [...(r?.querySelectorAll("thead th") || [])].map((t) => t.textContent),
				kanvas: r?.querySelectorAll("canvas").length ?? -1,
			};
		});
	for (const [judul, rusak] of [
		["no-webgl", false],
		["bundle fails", true],
	]) {
		const ctx = await konteksMasuk(rusak ? browser : tanpa);
		if (rusak) await ctx.route(/lantai\.bundle.*\.js/, (r) => r.abort());
		const p = await ctx.newPage();
		const galatP = [];
		p.on("pageerror", (e) => galatP.push(String(e)));
		await p.goto(`${URL}/desk/production-floor`);
		try {
			await p.waitForFunction(
				() => document.querySelector(".lantai-host")?.shadowRoot?.querySelectorAll("table tbody tr").length >= 14,
				null,
				{ timeout: 20000 }
			);
		} catch {
			/* reported below */
		}
		const t = await baris(p);
		cek(t.baris === 14, `${judul}: table rows ${t.baris}`);
		cek(t.kepala.length === 4, `${judul}: table headers ${JSON.stringify(t.kepala)}`);
		cek(t.kanvas === 0, `${judul}: canvases ${t.kanvas}`);
		cek((await dialog(p)) === 0, `${judul}: a message dialog is open`);
		cek(!galatP.length, `${judul}: page errors: ${galatP.join(" | ").slice(0, 300)}`);
		await p.screenshot({ path: join(HASIL, `lantai-${rusak ? "tanpa-bundle" : "tanpa-webgl"}.png`) });
		await ctx.close();
	}
	await tanpa.close();
}

// Runs one case; an exception fails that case and the run goes on (the case's own finally restores its records).
async function kasus(nama, fn) {
	try {
		await fn();
	} catch (e) {
		gagal.push(`${nama}: ${String(e.message || e).split("\n")[0].slice(0, 300)}`);
	}
}

// --- Task 5: labels, selection, status from the floor, live updates ---------------------------------------------

// The shadow root's text and state for one machine: its label and, when open, the panel.
const labelDari = (p, nama) =>
	p.evaluate((nama) => {
		const r = erp.lantai.aktif.host.shadowRoot;
		const el = [...r.querySelectorAll(".label")].find((e) => e.dataset.mesin === nama);
		if (!el) return null;
		const k = el.querySelector(".isi").getBoundingClientRect();
		return {
			judul: el.querySelector(".judul")?.textContent,
			chip: el.querySelector(".chip")?.textContent,
			chipStatus: el.querySelector(".chip")?.dataset.status,
			wo: el.querySelector(".wo")?.hidden === false ? el.querySelector(".wo").textContent : null,
			bar: el.querySelector(".wo-bar span")?.style.width || null,
			tampak: el.style.visibility !== "hidden" && k.width > 0,
			x: k.left + k.width / 2,
			bawah: k.bottom,
		};
	}, nama);
const panelDari = (p) =>
	p.evaluate(() => {
		const el = erp.lantai.aktif.host.shadowRoot.querySelector(".panel");
		if (!el || el.hidden) return null;
		const k = el.getBoundingClientRect();
		const tombol = [...el.querySelectorAll(".status button")];
		return {
			nama: el.dataset.mesin,
			teks: el.textContent,
			judul: el.querySelector(".judul")?.textContent,
			wo: el.querySelector(".wo a")?.textContent || null,
			tombol: tombol.map((b) => ({ status: b.dataset.status, teks: b.textContent.trim(), aktif: b.getAttribute("aria-pressed") === "true", mati: b.disabled, sibuk: b.classList.contains("sibuk") })),
			catatan: el.querySelector(".catatan")?.hidden === false ? el.querySelector(".catatan").textContent : null,
			kotak: { x: k.left, y: k.top, l: k.width, t: k.height, kanan: k.right, bawah: k.bottom },
		};
	});
const mesinInfo = (p, nama) => p.evaluate((nama) => erp.lantai.aktif.info().mesin.find((m) => m.nama === nama), nama);
// Back to the floor after following a link: wait for the form to finish loading first, or its late render
// replaces the route again.
async function kembaliKeLantai(p) {
	await p.waitForFunction(() => window.cur_frm?.doc && !frappe.router?.current_route?.includes?.("production-floor"), null, { timeout: 8000 }).catch(() => {});
	await p.waitForTimeout(400);
	await p.evaluate(() => frappe.set_route("production-floor"));
	const ok = await p
		.waitForFunction(() => frappe.get_route_str() === "production-floor", null, { timeout: 8000 })
		.then(() => true, () => false);
	if (!ok) throw new Error(`could not return to the floor: ${await p.evaluate(() => `${location.pathname} ${frappe.get_route_str()}`)}`);
	await p.waitForTimeout(500);
}
// A real click on a machine's body, at its projected screen point.
async function klikMesin(p, nama) {
	const m = await mesinInfo(p, nama);
	const kotak = await p.locator(".lantai-host").boundingBox();
	if (!m?.layar) throw new Error(`${nama}: no screen point in info()`);
	await p.mouse.click(kotak.x + m.layar.x, kotak.y + m.layar.y);
}
// GET with query args (frappe.client.get_value takes them from the query string).
const ambilNilai = (p, doctype, nama, field) =>
	p.evaluate(
		async ({ doctype, nama, field }) => {
			const q = new URLSearchParams({ doctype, filters: nama, fieldname: field });
			const r = await fetch(`/api/method/frappe.client.get_value?${q}`, { headers: { Accept: "application/json" } });
			return (await r.json()).message?.[field];
		},
		{ doctype, nama, field }
	);
const tunggu = (p, fn, arg, ms = 8000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
const setNilai = (doctype, nama, field, nilai) => bench("execute", "frappe.db.set_value", "--args", JSON.stringify([doctype, nama, field, nilai]));
// bench execute prints a string bare and anything else as JSON; "None" for a null.
const ambilBench = (doctype, nama, field) => {
	const baris = bench("execute", "frappe.db.get_value", "--args", JSON.stringify([doctype, nama, field])).trim().split("\n").pop();
	if (baris === "None" || baris === "") return null;
	try {
		return JSON.parse(baris);
	} catch {
		return baris;
	}
};
const galatNyata = (l) => l.filter((t) => !/socket\.io|Failed to load resource|ERR_FAILED|net::/i.test(t));

if (jalankan("label")) await kasus("label", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	await p.waitForTimeout(1500); // damping settles
	const d = await api(p, "erp_internal.production_floor.get_data", {}, false);
	const m3 = d.mesin.find((m) => m.nomor === 3);
	const harap = `03 · ${m3.merek} ${m3.tonase}T`;
	const l3 = await labelDari(p, m3.name);
	cek(l3?.judul === harap, `label: ${m3.name} reads ${JSON.stringify(l3?.judul)}, wanted ${JSON.stringify(harap)}`);
	cek(l3?.chip && l3.chipStatus === (m3.status || "Idle"), `label: ${m3.name} chip ${JSON.stringify(l3)}`);
	const semua = await p.evaluate(() => erp.lantai.aktif.host.shadowRoot.querySelectorAll(".label").length);
	cek(semua === d.mesin.length, `label: ${semua} labels for ${d.mesin.length} machines`);
	// The label sits over its machine: same x (± 30 px), above the body's centre.
	const info3 = await mesinInfo(p, m3.name);
	const kotak = await p.locator(".lantai-host").boundingBox();
	if (l3 && info3?.layar) {
		cek(Math.abs(l3.x - (kotak.x + info3.layar.x)) < 30, `label: ${m3.name} label x ${l3.x} vs machine ${kotak.x + info3.layar.x}`);
		cek(l3.bawah < kotak.y + info3.layar.y, `label: ${m3.name} label is not above its machine`);
	}
	// No camera motion → no label writes.
	const tulis1 = await p.evaluate(() => erp.lantai.aktif.info().label.tulis);
	await p.waitForTimeout(1000);
	const tulis2 = await p.evaluate(() => erp.lantai.aktif.info().label.tulis);
	cek(tulis1 === tulis2, `label: labels rewritten without a camera change (${tulis1} → ${tulis2})`);
	// A camera standing in the aisle looking at the front row: the back row is behind it, its labels hide.
	await p.evaluate(() => erp.lantai.aktif.lihat([0, 1.6, 0], [0, 1.6, 10]));
	await p.waitForTimeout(300);
	const belakang = d.mesin.find((m) => m.nomor === 11);
	const lb = await labelDari(p, belakang.name);
	cek(lb && !lb.tampak, `label: ${belakang.name}'s label shows although it is behind the camera`);
	await p.screenshot({ path: join(HASIL, "lantai-label-lorong.png") });
	await p.evaluate(() => erp.lantai.aktif.host.shadowRoot.querySelector(".reset").click());
	await p.waitForTimeout(800);
	const lb2 = await labelDari(p, belakang.name);
	cek(lb2?.tampak, `label: ${belakang.name}'s label stays hidden after reset`);
	await p.screenshot({ path: join(HASIL, "lantai-label.png") });
	cek((await dialog(p)) === 0, "label: a message dialog is open");
	cek(!galatNyata(p.__galat).length, `label: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	await ctx.close();
});

if (jalankan("pilih")) await kasus("pilih", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	await p.waitForTimeout(1500);
	const kamera0 = await p.evaluate(() => erp.lantai.aktif.info().kamera);
	await klikMesin(p, "Mesin 03");
	const terbuka = await tunggu(p, () => erp.lantai.aktif.host.shadowRoot.querySelector(".panel")?.hidden === false, null, 3000);
	cek(terbuka, "pilih: a click on Mesin 03 opened no panel");
	const pn = await panelDari(p);
	cek(pn?.nama === "Mesin 03", `pilih: the panel shows ${pn?.nama}`);
	cek(pn?.tombol.length === 6, `pilih: ${pn?.tombol.length} status buttons`);
	cek(/Open machine/.test(pn?.teks || ""), "pilih: no Open machine button");
	// The fly: 700 ms, then the camera rests near Mesin 03.
	await p.waitForTimeout(900);
	const sesudah = await p.evaluate(() => ({ i: erp.lantai.aktif.info(), m: erp.lantai.aktif.info().mesin.find((m) => m.nama === "Mesin 03") }));
	const jarak = Math.hypot(sesudah.i.target[0] - sesudah.m.x, sesudah.i.target[2] - sesudah.m.z);
	cek(jarak < 0.3, `pilih: the camera target is ${jarak.toFixed(2)} from Mesin 03 after the fly`);
	cek(Math.hypot(...sesudah.i.kamera.map((v, i) => v - kamera0[i])) > 3, "pilih: the camera did not move");
	cek(sesudah.i.pilih === "Mesin 03", `pilih: info().pilih ${sesudah.i.pilih}`);
	await p.screenshot({ path: join(HASIL, "lantai-pilih.png") });
	// "Open machine" goes to the Workstation form.
	await p.locator(".lantai-host .panel .buka").click();
	cek(await tunggu(p, () => location.pathname.startsWith("/desk/workstation/Mesin"), null, 5000), `pilih: Open machine went to ${await p.evaluate(() => location.pathname)}`);
	await kembaliKeLantai(p);
	// Close button, then a click on empty floor keeps it closed.
	if ((await panelDari(p)) === null) await klikMesin(p, "Mesin 03");
	await p.locator(".lantai-host .panel .tutup").click();
	cek((await panelDari(p)) === null, "pilih: the close button left the panel open");
	cek((await dialog(p)) === 0, "pilih: a message dialog is open");
	cek(!galatNyata(p.__galat).length, `pilih: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	await ctx.close();

	// Phone width: the panel is a bottom sheet.
	const hp = await konteksMasuk(browser, { viewport: { width: 390, height: 844 } });
	const q = await bukaLantai(hp);
	await q.waitForTimeout(1200);
	await q.evaluate(() => erp.lantai.aktif.pilih("Mesin 03"));
	await q.waitForTimeout(900);
	const ph = await panelDari(q);
	cek(ph && Math.abs(ph.kotak.bawah - 844) <= 1 && ph.kotak.l >= 380, `pilih: phone panel is not a bottom sheet ${JSON.stringify(ph?.kotak)}`);
	await q.screenshot({ path: join(HASIL, "lantai-pilih-hp.png") });
	await hp.close();
});

if (jalankan("status")) await kasus("status", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const NAMA = "Mesin 03";
	const asli = await catatStatus(p, [NAMA]);
	try {
		await p.waitForTimeout(1200);
		await klikMesin(p, NAMA);
		await tunggu(p, () => erp.lantai.aktif.host.shadowRoot.querySelector(".panel")?.hidden === false, null, 3000);
		// A slow answer: the clicked button spins and every button waits.
		await ctx.route("**/api/method/erp_internal.production_floor.set_status", async (r) => {
			await new Promise((s) => setTimeout(s, 700));
			await r.continue();
		});
		await p.locator('.lantai-host .panel .status button[data-status="Problem"]').click();
		await p.waitForTimeout(150);
		const sibuk = await panelDari(p);
		const tProblem = sibuk?.tombol.find((t) => t.status === "Problem");
		cek(tProblem?.sibuk && tProblem?.mati, `status: the Problem button shows no spinner while saving ${JSON.stringify(tProblem)}`);
		cek(sibuk?.tombol.every((t) => t.mati), "status: other buttons stay clickable while saving");
		await tunggu(p, () => !erp.lantai.aktif.host.shadowRoot.querySelector(".panel .status button.sibuk"), null, 5000);
		await ctx.unroute("**/api/method/erp_internal.production_floor.set_status");
		cek((await ambilNilai(p, "Workstation", NAMA, "status")) === "Problem", `status: server status after the click is ${await ambilNilai(p, "Workstation", NAMA, "status")}`);
		const l = await labelDari(p, NAMA);
		cek(l?.chipStatus === "Problem", `status: the label chip reads ${l?.chipStatus}`);
		const pn = await panelDari(p);
		cek(pn?.tombol.find((t) => t.status === "Problem")?.aktif, "status: the panel does not mark Problem as current");
		cek(pn?.tombol.every((t) => !t.mati), "status: buttons stay disabled after the answer");
		cek(await tunggu(p, (n) => erp.lantai.aktif.info().mesin.find((m) => m.nama === n)?.lampu === "merah", NAMA, 3000), "status: the scene's lamp is not red");

		// A refusal: an inline note with the server's message, never a dialog.
		await ctx.route("**/api/method/erp_internal.production_floor.set_status", (r) =>
			r.fulfill({
				status: 417,
				contentType: "application/json",
				body: JSON.stringify({ exc_type: "ValidationError", _server_messages: JSON.stringify([JSON.stringify({ message: "Ditolak <b>uji</b>" })]) }),
			})
		);
		await p.locator('.lantai-host .panel .status button[data-status="Off"]').click();
		await tunggu(p, () => erp.lantai.aktif.host.shadowRoot.querySelector(".panel .catatan")?.hidden === false, null, 3000);
		const tolak = await panelDari(p);
		cek(tolak?.catatan?.includes("Ditolak uji"), `status: refusal note ${JSON.stringify(tolak?.catatan)}`);
		cek((await dialog(p)) === 0, "status: a refusal opened a dialog");
		cek(tolak?.tombol.find((t) => t.status === "Problem")?.aktif, "status: a refused change moved the current status");
		await ctx.unroute("**/api/method/erp_internal.production_floor.set_status");

		// Diffing: a refetch with nothing changed touches no machine; one change touches only that machine.
		const sentuh = () => p.evaluate(() => Object.fromEntries(erp.lantai.aktif.info().mesin.map((m) => [m.nama, m.sentuh])));
		const s1 = await sentuh();
		await p.evaluate(() => erp.lantai.aktif.muat());
		await p.evaluate(() => erp.lantai.aktif.muat());
		const s2 = await sentuh();
		cek(JSON.stringify(s1) === JSON.stringify(s2), `status: an unchanged refetch touched machines ${JSON.stringify(s1)} → ${JSON.stringify(s2)}`);
		await p.locator('.lantai-host .panel .status button[data-status="Idle"]').click();
		await tunggu(p, () => !erp.lantai.aktif.host.shadowRoot.querySelector(".panel .status button.sibuk"), null, 5000);
		await p.waitForTimeout(600); // the realtime nudge's refetch too
		const s3 = await sentuh();
		const disentuh = Object.keys(s3).filter((k) => s3[k] !== s2[k]);
		cek(JSON.stringify(disentuh) === JSON.stringify([NAMA]), `status: one change touched ${JSON.stringify(disentuh)}`);
		cek((await panelDari(p))?.catatan === null, "status: the refusal note stayed after a good change");
		await p.screenshot({ path: join(HASIL, "lantai-status-panel.png") });
		cek(!galatNyata(p.__galat).length, `status: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} finally {
		await ctx.unroute("**/api/method/erp_internal.production_floor.set_status").catch(() => {});
		await pulihkanStatus(p, asli);
	}
	await ctx.close();
});

// A submitted Work Order on Mesin 03, In Process at 40 of four BOM batches, for the "wo" and "xss" cases; removed after.
if (jalankan("wo") || jalankan("xss")) await kasus("wo/xss", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	let wo = null;
	let diajukan = false;
	const modelAsli = ambilBench("Workstation", "Mesin 03", "erp_model");
	try {
		const bom = await p.evaluate(async () => {
			const q = new URLSearchParams({ doctype: "BOM", filters: JSON.stringify({ is_default: 1, docstatus: 1, is_active: 1 }), fieldname: JSON.stringify(["name", "item", "quantity"]) });
			return (await (await fetch(`/api/method/frappe.client.get_value?${q}`, { headers: { Accept: "application/json" } })).json()).message;
		});
		if (!bom?.name) throw new Error("no default BOM on the site for a sample Work Order");
		// Four BOM batches, so no raw material row turns fractional.
		const q = Number(bom.quantity) || 1;
		const QTY = q * Math.max(4, Math.ceil(100 / q)); // whole BOM batches, and more than the 40 produced
		const baru = await api(p, "frappe.client.insert", {
			doc: { doctype: "Work Order", production_item: bom.item, bom_no: bom.name, qty: QTY, company: await p.evaluate(() => frappe.defaults.get_default("company")), erp_mesin: "Mesin 03" },
		});
		wo = baru.name;
		const kirim = await api(p, "frappe.client.submit", { doc: baru });
		diajukan = true;
		setNilai("Work Order", wo, "status", "In Process");
		setNilai("Work Order", wo, "produced_qty", 40);
		await p.evaluate(() => erp.lantai.aktif.muat());

		if (jalankan("wo")) {
			const ok = await tunggu(p, () => erp.lantai.aktif.host.shadowRoot.querySelector('.label[data-mesin="Mesin 03"] .wo')?.hidden === false, null, 5000);
			cek(ok, "wo: Mesin 03's label shows no Work Order");
			const l = await labelDari(p, "Mesin 03");
			cek(l?.wo?.includes(kirim.item_name || bom.item), `wo: label Work Order text ${JSON.stringify(l?.wo)}`);
			const qtyTeks = await p.evaluate((n) => format_number(n, null, 0), QTY);
			cek(new RegExp(`40\\s*/\\s*${qtyTeks.replace(/\./g, "\\.")}`).test(l?.wo || ""), `wo: label progress text ${JSON.stringify(l?.wo)}, wanted 40 / ${qtyTeks}`);
			cek(l?.bar === `${Math.round((40 / QTY) * 100)}%`, `wo: progress bar width ${l?.bar}, wanted ${Math.round((40 / QTY) * 100)}%`);
			await p.evaluate(() => erp.lantai.aktif.pilih("Mesin 03"));
			await p.waitForTimeout(800);
			const pn = await panelDari(p);
			cek(pn?.wo === wo, `wo: panel Work Order link ${pn?.wo}`);
			await p.screenshot({ path: join(HASIL, "lantai-wo.png") });
			await p.locator(".lantai-host .panel .wo a").click();
			const ke = encodeURIComponent(wo).toLowerCase();
			cek(await tunggu(p, (ke) => location.pathname.toLowerCase().includes(ke), ke, 5000), `wo: the link went to ${await p.evaluate(() => location.pathname)}`);
			await kembaliKeLantai(p);
		}
		if (jalankan("xss")) {
			const RACUN = "<img src=x onerror=window.kena=1>";
			setNilai("Work Order", wo, "item_name", RACUN);
			setNilai("Workstation", "Mesin 03", "erp_model", RACUN);
			await p.evaluate(() => erp.lantai.aktif.muat());
			await p.evaluate(() => erp.lantai.aktif.pilih("Mesin 03"));
			await p.waitForTimeout(1000);
			const l = await labelDari(p, "Mesin 03");
			const pn = await panelDari(p);
			const hasil = await p.evaluate(() => ({ kena: window.kena, img: [...erp.lantai.aktif.host.shadowRoot.querySelectorAll("img")].filter((i) => !i.closest(".logo")).length }));
			cek(hasil.kena === undefined, "xss: window.kena was set (record text ran as HTML)");
			cek(hasil.img === 0, `xss: ${hasil.img} <img> elements in the floor (besides the company logo)`);
			cek(l?.wo?.includes(RACUN), `xss: the label does not show the item name as text: ${JSON.stringify(l?.wo)}`);
			cek(pn?.teks?.includes(RACUN), "xss: the panel does not show the text");
			await p.screenshot({ path: join(HASIL, "lantai-xss.png") });
		}
		cek((await dialog(p)) === 0, "wo/xss: a message dialog is open");
		cek(!galatNyata(p.__galat).length, `wo/xss: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} catch (e) {
		gagal.push(`wo/xss: ${e.message}`);
	} finally {
		try {
			setNilai("Workstation", "Mesin 03", "erp_model", modelAsli);
			if (wo && diajukan) {
				setNilai("Work Order", wo, "status", "Not Started");
				bench("execute", "frappe.client.cancel", "--args", JSON.stringify(["Work Order", wo]));
			}
			if (wo) bench("execute", "frappe.client.delete", "--args", JSON.stringify(["Work Order", wo]));
		} catch (e) {
			gagal.push(`wo/xss: cleanup of ${wo}: ${e.message.slice(0, 300)}`);
		}
	}
	await ctx.close();
});

// Status written without any event (as ERPNext's Job Card does): the poll picks it up.
if (jalankan("set_value")) await kasus("set_value", async () => {
	const ctx = await konteksMasuk(browser);
	const NAMA = "Mesin 04";
	const asli = ambilBench("Workstation", NAMA, "status");
	const tujuan = asli === "Off" ? "Maintenance" : "Off";
	try {
		const p = await ctx.newPage();
		await p.goto(`${URL}/desk/production-floor?poll=3`, { waitUntil: "domcontentloaded", timeout: 60000 });
		await p.waitForFunction(() => window.erp?.lantai?.aktif?.info().mesin?.length > 0, null, { timeout: 20000 });
		cek((await p.evaluate(() => erp.lantai.aktif.info().poll)) === 3, `set_value: ?poll=3 gave a poll of ${await p.evaluate(() => erp.lantai.aktif.info().poll)} s`);
		setNilai("Workstation", NAMA, "status", tujuan);
		const ok = await tunggu(p, ([n, s]) => erp.lantai.aktif.info().mesin.find((m) => m.nama === n)?.status === s, [NAMA, tujuan], 9000);
		cek(ok, `set_value: the view did not follow ${NAMA} → ${tujuan} within 9 s`);
		cek((await labelDari(p, NAMA))?.chipStatus === tujuan, `set_value: ${NAMA}'s chip did not follow`);
	} finally {
		setNilai("Workstation", NAMA, "status", asli ?? "");
	}
	await ctx.close();
});

// Realtime blocked: the poll keeps the view current, no dialog.
if (jalankan("poll")) await kasus("poll", async () => {
	const ctx = await konteksMasuk(browser);
	await ctx.route("**/socket.io/**", (r) => r.abort());
	await ctx.routeWebSocket(/socket\.io/, (ws) => ws.close());
	const NAMA = "Mesin 05";
	const p = await ctx.newPage();
	p.__galat = [];
	p.on("pageerror", (e) => p.__galat.push(String(e)));
	await p.goto(`${URL}/desk/production-floor?poll=3`, { waitUntil: "domcontentloaded", timeout: 60000 });
	await p.waitForFunction(() => window.erp?.lantai?.aktif?.info().mesin?.length > 0, null, { timeout: 20000 });
	const asli = await catatStatus(p, [NAMA]);
	const tujuan = asli[NAMA] === "Maintenance" ? "Setup" : "Maintenance";
	try {
		cek(!(await p.evaluate(() => frappe.realtime?.socket?.connected)), "poll: socket.io is connected although it is blocked");
		await api(p, "erp_internal.production_floor.set_status", { machine: NAMA, status: tujuan });
		const ok = await tunggu(p, ([n, s]) => erp.lantai.aktif.info().mesin.find((m) => m.nama === n)?.status === s, [NAMA, tujuan], 9000);
		cek(ok, `poll: the view did not follow ${NAMA} → ${tujuan} within 9 s without realtime`);
		cek((await dialog(p)) === 0, "poll: a message dialog is open");
		cek(!p.__galat.length, `poll: page errors: ${p.__galat.join(" | ").slice(0, 300)}`);
	} finally {
		await pulihkanStatus(p, asli);
	}
	await ctx.close();
});

// Realtime: a change made elsewhere shows within a few seconds, with the 60 s poll.
if (jalankan("live")) await kasus("live", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const lain = await ctx.newPage();
	await lain.goto(`${URL}/desk`);
	await lain.waitForFunction(() => window.frappe?.csrf_token);
	const NAMA = "Mesin 06";
	const asli = await catatStatus(p, [NAMA]);
	const tujuan = asli[NAMA] === "Setup" ? "Idle" : "Setup";
	try {
		cek((await p.evaluate(() => erp.lantai.aktif.info().poll)) === 60, "live: the default poll is not 60 s");
		await p.waitForTimeout(1500); // the socket joins its rooms
		await api(lain, "erp_internal.production_floor.set_status", { machine: NAMA, status: tujuan });
		const ok = await tunggu(p, ([n, s]) => erp.lantai.aktif.info().mesin.find((m) => m.nama === n)?.status === s, [NAMA, tujuan], 5000);
		cek(ok, `live: the realtime nudge did not bring ${NAMA} → ${tujuan} within 5 s`);
	} finally {
		await pulihkanStatus(p, asli);
	}
	await ctx.close();
});

// Reconnect: Frappe's realtime server keeps no room state, so after the socket reconnects (sleep, network blip, a
// `bench start` restart) the floor must join the Workstation room again. A forced disconnect and reconnect, then a
// change made elsewhere shows within 5 s (the poll is 60 s).
if (jalankan("reconnect")) await kasus("reconnect", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const lain = await ctx.newPage();
	await lain.goto(`${URL}/desk`);
	await lain.waitForFunction(() => window.frappe?.csrf_token);
	const NAMA = "Mesin 06";
	const asli = await catatStatus(p, [NAMA]);
	const tujuan = asli[NAMA] === "Setup" ? "Idle" : "Setup";
	try {
		await tunggu(p, () => frappe.realtime.socket?.connected === true, null, 8000);
		await p.waitForTimeout(1500);
		await p.evaluate(() => frappe.realtime.socket.disconnect());
		await p.waitForTimeout(500);
		await p.evaluate(() => frappe.realtime.socket.connect());
		cek(await tunggu(p, () => frappe.realtime.socket.connected === true, null, 8000), "reconnect: the socket did not reconnect");
		await p.waitForTimeout(1500); // the new connection joins its rooms
		await api(lain, "erp_internal.production_floor.set_status", { machine: NAMA, status: tujuan });
		const ok = await tunggu(p, ([n, s]) => erp.lantai.aktif.info().mesin.find((m) => m.nama === n)?.status === s, [NAMA, tujuan], 5000);
		cek(ok, `reconnect: after a socket reconnect the nudge did not bring ${NAMA} → ${tujuan} within 5 s`);
	} finally {
		await pulihkanStatus(p, asli);
	}
	await ctx.close();
});

// Notes: a failed first load and an empty floor each say so on the floor (a glass card, no dialog), and the note
// clears on the next good fetch.
if (jalankan("notes")) await kasus("notes", async () => {
	const ctx = await konteksMasuk(browser);
	const GAGAL = "The machine list could not be loaded.";
	const KOSONG = "No numbered machines yet (set Machine No. on a Workstation).";
	const catatan = (p) =>
		p.evaluate(() => {
			const n = erp.lantai.aktif.host.shadowRoot.querySelector(".catatan-lantai");
			if (!n || n.hidden) return null;
			const k = n.getBoundingClientRect();
			return { teks: n.textContent, lebar: k.width, tinggi: k.height, kartu: n.classList.contains("kartu") };
		});
	const POLA = "**/api/method/erp_internal.production_floor.get_data";
	const q = await ctx.newPage();
	q.__galat = [];
	q.on("pageerror", (e) => q.__galat.push(String(e)));
	await q.route(POLA, (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
	await q.goto(`${URL}/desk/production-floor`, { waitUntil: "domcontentloaded", timeout: 60000 });
	await q.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 20000 });
	cek(await tunggu(q, () => !!erp.lantai.aktif.host.shadowRoot.querySelector(".catatan-lantai:not([hidden])"), null, 8000), "notes: no note after a failed first load");
	let n = await catatan(q);
	cek(n?.teks === GAGAL, `notes: failed load says ${JSON.stringify(n?.teks)}`);
	cek(n?.kartu && n.lebar > 100 && n.tinggi > 10, "notes: the failure note is not a visible glass card");
	cek(await q.evaluate(() => { const m = erp.lantai.aktif.host.shadowRoot.querySelector(".memuat"); return !m || m.hidden; }), "notes: the loading screen is still up after a failed first load");
	cek((await dialog(q)) === 0, "notes: a dialog opened on a failed load");
	// An empty floor.
	await q.unroute(POLA);
	await q.route(POLA, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: { mesin: [], perusahaan: { nama: "Uji", logo: null }, waktu: "" } }) }));
	await q.evaluate(() => erp.lantai.aktif.muat());
	await tunggu(q, (t) => erp.lantai.aktif.host.shadowRoot.querySelector(".catatan-lantai")?.textContent === t, KOSONG, 5000);
	n = await catatan(q);
	cek(n?.teks === KOSONG, `notes: an empty floor says ${JSON.stringify(n?.teks)}`);
	// A good fetch clears it.
	await q.unroute(POLA);
	await q.evaluate(() => erp.lantai.aktif.muat());
	cek(await tunggu(q, () => erp.lantai.aktif.host.shadowRoot.querySelector(".catatan-lantai")?.hidden === true && erp.lantai.aktif.info().mesin.length > 0, null, 8000), "notes: the note did not clear after a good fetch");
	cek((await dialog(q)) === 0, "notes: a dialog is open");
	cek(!q.__galat.length, `notes: page errors: ${q.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	await ctx.close();
});

// --- perhatian: the attention card (machines that are not producing, worst first) ---------------------------------
if (jalankan("perhatian")) await kasus("perhatian", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const d0 = await api(p, "erp_internal.production_floor.get_data", {}, false);
	const semua = d0.mesin.map((m) => m.name);
	const asli = await catatStatus(p, semua);
	const baris = () =>
		p.evaluate(() => {
			const r = erp.lantai.aktif.host.shadowRoot;
			const k = r.querySelector(".perhatian");
			const asal = erp.lantai.aktif.host.getBoundingClientRect();
			const kotak = (e) => { const b = e.getBoundingClientRect(); return { x: b.left - asal.left, y: b.top - asal.top, kanan: b.right - asal.left, bawah: b.bottom - asal.top }; };
			return {
				ada: !!k,
				tampak: !!k && !k.hidden && k.getClientRects().length > 0,
				kosong: r.querySelector(".perhatian .kosong")?.hidden === false ? r.querySelector(".perhatian .kosong").textContent : null,
				baris: [...r.querySelectorAll(".perhatian li[data-mesin]")].filter((l) => !l.hidden).map((l) => ({ nama: l.dataset.mesin, teks: l.textContent, status: l.querySelector(".chip")?.dataset.status })),
				kotak: k ? kotak(k) : null,
				tabel: kotak(r.querySelector(".tabel")),
				bar: kotak(r.querySelector(".bar")),
				kpi: kotak(r.querySelector(".kpi")),
				halangan: erp.lantai.aktif.info().halangan,
			};
		});
	try {
		for (const n of semua) await api(p, "erp_internal.production_floor.set_status", { machine: n, status: "Production" });
		const nama = (nomor) => d0.mesin.find((m) => m.nomor === nomor).name;
		await api(p, "erp_internal.production_floor.set_status", { machine: nama(2), status: "Problem" });
		await api(p, "erp_internal.production_floor.set_status", { machine: nama(3), status: "Idle" });
		await api(p, "erp_internal.production_floor.set_status", { machine: nama(4), status: "Maintenance" });
		await p.evaluate(() => erp.lantai.aktif.muat());
		cek(await tunggu(p, () => erp.lantai.aktif.host.shadowRoot.querySelectorAll(".perhatian li[data-mesin]").length === 3, null, 8000), "perhatian: the card did not list the three machines");
		let b = await baris();
		cek(b.tampak, "perhatian: the attention card is not visible");
		cek(b.baris.map((r) => r.nama).join() === [2, 4, 3].map(nama).join(), `perhatian: order ${b.baris.map((r) => r.nama).join(",")}, wanted 02, 04, 03`);
		cek(b.baris.map((r) => r.status).join() === "Problem,Maintenance,Idle", `perhatian: chips ${b.baris.map((r) => r.status)}`);
		// Top left, under the machine table, which sits right under the top bar (not at the bottom any more).
		cek(b.tabel.x < 40 && b.tabel.y >= b.bar.bawah - 1 && b.tabel.y < 200, `perhatian: the machine table is not top left under the bar ${JSON.stringify([b.tabel, b.bar])}`);
		cek(b.kotak && b.kotak.x < 40 && b.kotak.y >= b.tabel.bawah - 1 && b.kotak.y - b.tabel.bawah < 30, `perhatian: the card is not directly under the table ${JSON.stringify([b.kotak, b.tabel])}`);
		cek(b.halangan.some((h) => b.kotak && Math.abs(h.x0 - b.kotak.x) <= 2 && Math.abs(h.y0 - b.kotak.y) <= 2 && h.y1 - h.y0 > 20), "perhatian: info().halangan does not list the attention card");
		// A click selects the machine like a table row.
		await p.evaluate((n) => erp.lantai.aktif.host.shadowRoot.querySelector(`.perhatian li[data-mesin="${n}"]`).click(), nama(4));
		cek(await tunggu(p, (n) => erp.lantai.aktif.info().pilih === n, nama(4), 3000), "perhatian: a click on the 04 row did not select Mesin 04");
		await p.evaluate(() => erp.lantai.aktif.pilih(null));
		// All running.
		for (const n of [2, 3, 4]) await api(p, "erp_internal.production_floor.set_status", { machine: nama(n), status: "Production" });
		await p.evaluate(() => erp.lantai.aktif.muat());
		cek(await tunggu(p, () => erp.lantai.aktif.host.shadowRoot.querySelectorAll(".perhatian li[data-mesin]:not([hidden])").length === 0, null, 8000), "perhatian: rows are left with every machine in Production");
		b = await baris();
		cek(b.kosong === "All machines running", `perhatian: the empty text is ${JSON.stringify(b.kosong)}`);
		cek((await dialog(p)) === 0, "perhatian: a dialog is open");
		cek(!galatNyata(p.__galat).length, `perhatian: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} finally {
		await pulihkanStatus(p, asli);
	}
	await ctx.close();
});

// --- dekor-gelap: the building and the zones have a dark palette; the floor lettering stays readable --------------------
if (jalankan("dekor-gelap")) await kasus("dekor-gelap", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const baca = async (tema) => {
		await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);
		await p.waitForTimeout(700);
		return p.evaluate(() => ({ pabrik: erp.lantai.aktif.info().pabrik, zona: erp.lantai.aktif.info().zona }));
	};
	const terang = (hex) => {
		const [R, G, B] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
		return 0.2126 * R + 0.7152 * G + 0.0722 * B;
	};
	try {
		const terangTema = await baca("light");
		const gelap = await baca("dark");
		cek(terangTema.pabrik?.tema === "light" && terangTema.zona?.tema === "light", `dekor-gelap: light themes ${terangTema.pabrik?.tema}/${terangTema.zona?.tema}`);
		cek(gelap.pabrik?.tema === "dark" && gelap.zona?.tema === "dark", `dekor-gelap: dark themes ${gelap.pabrik?.tema}/${gelap.zona?.tema}`);
		for (const k of ["dinding", "atap", "truk"]) {
			const a = terangTema.pabrik?.[k];
			const g = gelap.pabrik?.[k];
			cek(a && g && terang(g) < terang(a) * 0.6 && terang(g) < 0.25, `dekor-gelap: pabrik ${k} light ${a} dark ${g} (dark must be clearly darker, relative luminance < 0.25)`);
		}
		const a = terangTema.zona?.alat;
		const g = gelap.zona?.alat;
		cek(a && g && terang(g) < terang(a) * 0.8, `dekor-gelap: zona props light ${a} dark ${g}`);
		for (const [nm, i] of [["light", terangTema], ["dark", gelap]]) {
			const kon = i.zona?.kontras || {};
			cek(Object.keys(kon).length === 6, `dekor-gelap: ${nm} contrast for ${Object.keys(kon).length} zones`);
			for (const [z, r] of Object.entries(kon)) cek(r >= 3, `dekor-gelap: ${nm} lettering of ${z} has ${Number(r).toFixed(2)}:1 against its zone (need 3:1)`);
		}
		await p.waitForTimeout(500);
		await p.screenshot({ path: join(HASIL, "lantai-gelap.png") });
		cek((await dialog(p)) === 0, "dekor-gelap: a dialog is open");
	} finally {
		await p.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
	}
	await ctx.close();
});

// --- memuat: the loading screen ---------------------------------------------------------------------------------------------
if (jalankan("memuat")) await kasus("memuat", async () => {
	const ctx = await konteksMasuk(browser);
	const POLA = "**/api/method/erp_internal.production_floor.get_data";
	let lepas;
	const tahan = new Promise((f) => (lepas = f));
	await ctx.route(POLA, async (r) => {
		await tahan;
		await r.continue();
	});
	const p = await ctx.newPage();
	p.__galat = [];
	p.on("pageerror", (e) => p.__galat.push(String(e)));
	await p.goto(`${URL}/desk/production-floor`, { waitUntil: "domcontentloaded", timeout: 60000 });
	await p.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 20000 });
	await p.waitForTimeout(800); // frames run, data does not come
	const m = await p.evaluate(() => {
		const e = erp.lantai.aktif.host.shadowRoot.querySelector(".memuat");
		return e && !e.hidden ? { teks: e.textContent, kartu: !!e.querySelector(".kartu") || e.classList.contains("kartu"), anim: getComputedStyle(e.querySelector(".putar")).animationName } : null;
	});
	cek(m && m.teks.includes("Loading production floor"), `memuat: before the data the screen reads ${JSON.stringify(m?.teks)}`);
	cek(m?.kartu, "memuat: the loading screen is not glass");
	cek(m && m.anim !== "none", `memuat: no animation (${m?.anim})`);
	lepas();
	cek(await tunggu(p, () => { const e = erp.lantai.aktif.host.shadowRoot.querySelector(".memuat"); return (!e || e.hidden) && erp.lantai.aktif.info().mesin.length > 0; }, null, 8000), "memuat: the loading screen is still up after the data came");
	cek((await dialog(p)) === 0, "memuat: a dialog is open");
	cek(!galatNyata(p.__galat).length, `memuat: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	await ctx.close();
});

// Panel-quiet: a refetch with unchanged data writes nothing into the open panel (no text, no attribute), and the
// live regions are the status chip and the inline note, not the whole panel.
if (jalankan("panel-quiet")) await kasus("panel-quiet", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	await klikMesin(p, "Mesin 03");
	await tunggu(p, () => erp.lantai.aktif.info().pilih === "Mesin 03", null, 5000);
	await p.waitForTimeout(1500); // the camera flight ends
	await p.evaluate(() => {
		const panel = erp.lantai.aktif.host.shadowRoot.querySelector(".panel");
		window.__ubah = 0;
		new MutationObserver((l) => (window.__ubah += l.length)).observe(panel, { subtree: true, childList: true, characterData: true, attributes: true });
	});
	const sebelum = await p.evaluate(() => erp.lantai.aktif.info().muat);
	await p.evaluate(() => erp.lantai.aktif.muat());
	await tunggu(p, (n) => erp.lantai.aktif.info().muat > n, sebelum, 5000);
	await p.waitForTimeout(500);
	cek((await p.evaluate(() => window.__ubah)) === 0, `panel-quiet: an unchanged refetch wrote ${await p.evaluate(() => window.__ubah)} mutations into the panel`);
	const live = await p.evaluate(() => {
		const r = erp.lantai.aktif.host.shadowRoot;
		return { panel: r.querySelector(".panel").hasAttribute("aria-live"), chip: r.querySelector(".panel .chip").getAttribute("aria-live") };
	});
	cek(!live.panel && live.chip === "polite", `panel-quiet: aria-live on the panel ${live.panel}, on the chip ${live.chip}`);
	await ctx.close();
});

// Strip: coming back to the floor from a Work Order form (by the sidebar link and by the browser's back) leaves no
// empty strip: the host's left edge equals the page body's, and the body starts at the rail, not at where a sidebar was.
if (jalankan("strip")) await kasus("strip", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const kiri = () =>
		p.evaluate(() => {
			const w = document.querySelector('[data-page-route="production-floor"]');
			const b = w.querySelector(".page-body").getBoundingClientRect();
			const h = erp.lantai.aktif.host.getBoundingClientRect();
			return { host: Math.round(h.left), body: Math.round(b.left) };
		});
	const direkt = await kiri();
	// Late layout: Desk hides the sidebar 1.2 s after the page shows (a slow machine); the host must follow, not
	// rely on a fixed delay.
	await p.evaluate(() => {
		const sb = frappe.app.sidebar;
		const orig = sb.apply_page_visibility.bind(sb);
		sb.apply_page_visibility = () => setTimeout(orig, 1200);
	});
	for (const cara of ["link", "back"]) {
		await p.evaluate(() => frappe.set_route("Form", "Work Order", "new"));
		await p.waitForFunction(() => window.cur_frm?.doctype === "Work Order", null, { timeout: 8000 });
		await p.waitForTimeout(800);
		if (cara === "link") {
			await p.locator(".body-sidebar .sidebar-item-label", { hasText: "Production Floor" }).first().click();
		} else {
			await p.evaluate(() => history.back());
		}
		await p.waitForFunction(() => frappe.get_route_str() === "production-floor", null, { timeout: 8000 });
		await p.waitForTimeout(3000);
		const k = await kiri();
		if (k.host !== k.body) gagal.push(`strip (${cara}): host left ${k.host} != page body left ${k.body}`);
		if (k.host !== direkt.host) gagal.push(`strip (${cara}): host left ${k.host}, direct load had ${direkt.host}`);
		if (await dialog(p)) gagal.push(`strip (${cara}): a message dialog is open`);
	}
	console.log(`strip: host left ${direkt.host} on a direct load, same after the sidebar link and after back, with the sidebar hidden 1.2 s late`);
	await ctx.close();
});

// Hidden: neither the Desk page left nor a hidden browser tab fetches on a nudge; back on screen, the view catches
// up at once (not at the next 60 s poll).
if (jalankan("hidden")) await kasus("hidden", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const NAMA = "Mesin 09";
	const asli = await catatStatus(p, [NAMA]);
	let ambil = 0;
	p.on("request", (r) => r.url().includes("production_floor.get_data") && (ambil += 1));
	const lihatStatus = (s) => tunggu(p, ([n, s]) => erp.lantai.aktif.info().mesin.find((m) => m.nama === n)?.status === s, [NAMA, s], 3000);
	try {
		await p.waitForTimeout(1500); // the socket joins its rooms
		// 1. Leave the Desk page.
		await p.evaluate(() => frappe.set_route("Workspaces", "Manufacturing"));
		await p.waitForTimeout(500);
		ambil = 0;
		await api(p, "erp_internal.production_floor.set_status", { machine: NAMA, status: "Problem" });
		await p.waitForTimeout(2000);
		cek(ambil === 0, `hidden: ${ambil} get_data request(s) while the page was left`);
		await p.evaluate(() => frappe.set_route("production-floor"));
		cek(await lihatStatus("Problem"), "hidden: back on the page, the change made while away did not show within 3 s");
		// 2. Hide the browser tab.
		await p.evaluate(() => {
			Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await p.waitForTimeout(300);
		// The mould cycle's phase stands for the whole loop (the forklift that did this is gone).
		const fase = () => p.evaluate(() => erp.lantai.aktif.info().mesin[0]?.fase ?? null);
		const g1 = await fase();
		ambil = 0;
		await api(p, "erp_internal.production_floor.set_status", { machine: NAMA, status: "Off" });
		await p.waitForTimeout(2000);
		cek(ambil === 0, `hidden: ${ambil} get_data request(s) while the tab was hidden`);
		const g2 = await fase();
		cek(g1 !== null && g1 === g2, `hidden: the mould cycle ran while hidden (${g1} -> ${g2})`);
		await p.evaluate(() => {
			delete document.hidden;
			document.dispatchEvent(new Event("visibilitychange"));
		});
		// The first frames back: at most one step (dt is clamped to 0.1 s), not the 2 s that passed.
		const g3 = await p.evaluate(async () => {
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
			return erp.lantai.aktif.info().mesin[0]?.fase ?? null;
		});
		// Two frames of at most 0.1 s on a 5 s cycle: 0.04 of a cycle (wrapping past 1 counts the short way).
		const sauh = g2 !== null && g3 !== null ? Math.min(Math.abs(g3 - g2), 1 - Math.abs(g3 - g2)) : Infinity;
		cek(sauh <= 0.05, `hidden: the mould cycle jumped ${sauh.toFixed?.(3)} of a cycle on return`);
		cek(await lihatStatus("Off"), "hidden: the tab shown again did not catch up within 3 s");
		cek((await dialog(p)) === 0, "hidden: a message dialog is open");
	} finally {
		await pulihkanStatus(p, asli);
	}
	await ctx.close();
});

// Indonesian: the page title and the status names.
if (jalankan("id")) await kasus("id", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	try {
		await api(p, "erp_internal.bahasa.ganti", { lang: "id" });
		await p.close();
		const q = await bukaLantai(ctx);
		await q.waitForTimeout(800);
		cek((await q.title()).includes("Lantai Produksi"), `id: page title ${await q.title()}`);
		const d = await api(q, "erp_internal.production_floor.get_data", {}, false);
		const jalan = d.mesin.find((m) => m.status === "Production");
		if (jalan) cek((await labelDari(q, jalan.name))?.chip === "Produksi", `id: Production chip reads ${(await labelDari(q, jalan.name))?.chip}`);
		await q.evaluate(() => erp.lantai.aktif.pilih("Mesin 03"));
		await q.waitForTimeout(600);
		const pn = await panelDari(q);
		const teks = Object.fromEntries((pn?.tombol || []).map((t) => [t.status, t.teks]));
		cek(teks.Problem === "Masalah" && teks.Maintenance === "Pemeliharaan" && teks.Off === "Mati", `id: status buttons ${JSON.stringify(teks)}`);
		cek(/Buka mesin/.test(pn?.teks || ""), "id: Open machine is not translated");
		await q.screenshot({ path: join(HASIL, "lantai-id.png") });
	} catch (e) {
		gagal.push(`id: ${e.message}`);
	} finally {
		try {
			setNilai("User", "user@example.com", "language", "en");
			bench("execute", "frappe.clear_cache", "--kwargs", JSON.stringify({ user: "user@example.com" }));
		} catch (e) {
			gagal.push(`id: could not switch user@example.com back to English: ${e.message.slice(0, 200)}`);
		}
	}
	await ctx.close();
});

// --- Task 6: the info bar, the machine table, the camera bar and the glass look -----------------------------------

// The info bar's figures, the table and the card boxes, read from the shadow root.
const hudDari = (p) =>
	p.evaluate(() => {
		const r = erp.lantai.aktif.host.shadowRoot;
		const teks = (s) => r.querySelector(s)?.textContent ?? null;
		const kotak = (s) => {
			const e = r.querySelector(s);
			if (!e || e.hidden || getComputedStyle(e).display === "none") return null;
			const k = e.getBoundingClientRect();
			return { x: k.left, y: k.top, kanan: k.right, bawah: k.bottom };
		};
		return {
			nama: teks(".nama-perusahaan"),
			inisial: r.querySelector(".logo .inisial")?.hidden ? null : teks(".logo .inisial"),
			logo: r.querySelector(".logo img")?.getAttribute("src") ?? null,
			jumlah: teks(".pil.jumlah"),
			live: teks(".live .teks"),
			liveData: r.querySelector(".live")?.dataset.live,
			waktu: teks(".jam .waktu"),
			tanggal: teks(".jam .tanggal"),
			kpi: Object.fromEntries(
				[...r.querySelectorAll(".kpi .sel")].map((s) => [s.dataset.kpi, { nilai: s.querySelector(".nilai").textContent, ket: s.querySelector(".ket").textContent }])
			),
			legenda: Object.fromEntries([...r.querySelectorAll(".legenda .chip")].map((c) => [c.dataset.status, c.querySelector(".jumlah").textContent])),
			baris: [...r.querySelectorAll(".tabel tbody tr")].map((t) => ({ nama: t.dataset.mesin, teks: t.textContent, dipilih: t.classList.contains("dipilih") })),
			tutup: r.querySelector(".tabel").hasAttribute("data-tutup"),
			kotak: { bar: kotak(".bar"), kpi: kotak(".kpi"), tabel: kotak(".tabel"), kamera: kotak(".kamera"), panel: kotak(".panel") },
		};
	});
const tumpang = (a, b) => a && b && a.x < b.kanan - 1 && b.x < a.kanan - 1 && a.y < b.bawah - 1 && b.y < a.bawah - 1;
// The panel is on top: points inside it hit the panel, not a card of the info bar.
const panelDiAtas = (p) =>
	p.evaluate(() => {
		const r = erp.lantai.aktif.host.shadowRoot;
		const pn = r.querySelector(".panel");
		const k = pn.getBoundingClientRect();
		const titik = [
			[0.5, 0.1],
			[0.1, 0.5],
			[0.9, 0.5],
			[0.5, 0.9],
			[0.1, 0.95],
			[0.9, 0.95],
		].map(([fx, fy]) => [k.left + k.width * fx, k.top + k.height * fy]);
		return titik.filter(([x, y]) => !pn.contains(r.elementFromPoint(x, y))).map(([x, y]) => `${Math.round(x)},${Math.round(y)}`);
	});

// Labels declutter: from `info().label.kotak` (the boxes the label code placed), checked against the DOM sizes, the
// cards' rectangles (`info().halangan`) and each other.
const beririsan = (a, b, m = 0) => a.x0 < b.x1 - m && a.x1 > b.x0 + m && a.y0 < b.y1 - m && a.y1 > b.y0 + m;
const labelRapi = (p) =>
	p.evaluate(() => {
		const i = erp.lantai.aktif.info();
		const r = erp.lantai.aktif.host.shadowRoot;
		const asal = erp.lantai.aktif.host.getBoundingClientRect();
		const dom = {};
		for (const el of r.querySelectorAll(".label")) {
			const k = el.querySelector(".isi").getBoundingClientRect();
			dom[el.dataset.mesin] = { x0: k.left - asal.left, y0: k.top - asal.top, x1: k.right - asal.left, y1: k.bottom - asal.top, hidden: el.style.visibility === "hidden" };
		}
		return { label: i.label, halangan: i.halangan, dom };
	});
if (jalankan("label-rapi")) await kasus("label-rapi", async () => {
	for (const [l, t] of [[1440, 900], [1280, 720], [390, 844]]) {
		const nm = `label-rapi ${l}x${t}`;
		const ctx = await konteksMasuk(browser, { viewport: { width: l, height: t } });
		const p = await bukaLantai(ctx);
		await p.waitForTimeout(2500);
		let s = await labelRapi(p);
		const kotak = s.label?.kotak;
		cek(Array.isArray(kotak) && kotak.length > 0, `${nm}: info().label.kotak ${JSON.stringify(kotak)}`);
		cek(Array.isArray(s.halangan) && s.halangan.length > 0, `${nm}: info().halangan ${JSON.stringify(s.halangan)}`);
		if (Array.isArray(kotak) && Array.isArray(s.halangan)) {
			const penuh = kotak.filter((k) => !k.ringkas);
			for (let a = 0; a < penuh.length; a++)
				for (let b = a + 1; b < penuh.length; b++)
					cek(!beririsan(penuh[a], penuh[b]), `${nm}: full labels ${penuh[a].nama} and ${penuh[b].nama} intersect`);
			for (const k of kotak)
				for (const h of s.halangan) cek(!beririsan(k, h), `${nm}: label ${k.nama} sits under a card ${JSON.stringify(h)}`);
			// The cached boxes are the real ones (± 2 px).
			for (const k of kotak) {
				const d = s.dom[k.nama];
				cek(d && Math.abs(d.x0 - k.x0) <= 2 && Math.abs(d.x1 - k.x1) <= 2 && Math.abs(d.y0 - k.y0) <= 2 && Math.abs(d.y1 - k.y1) <= 2, `${nm}: ${k.nama} cached box ${JSON.stringify(k)} vs DOM ${JSON.stringify(d)}`);
			}
			cek(typeof s.label.ringkas === "number" && typeof s.label.tersembunyi === "number", `${nm}: ringkas/tersembunyi missing`);
			cek(penuh.length >= 1, `${nm}: no full label at all`);
			// With the table open the default view fits the free area: nothing hidden, all 14 labels shown.
			if (l >= 1280) cek(s.label.tersembunyi === 0 && kotak.length === 14, `${nm}: default view hides ${s.label.tersembunyi} labels, shows ${kotak.length} of 14`);
		}
		// Hysteresis for real (once): dolly out until a label flips between full and compact, then jiggle the camera by a
		// few px around that point; nobody may flip back.
		if (l === 1440) {
			const r = await p.evaluate(async () => {
				const a = erp.lantai.aktif;
				const rAF = () => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
				const pos = (d) => a.lihat([0, d * 0.5, d * 0.86], [0, 0, 0]);
				const vektor = () => JSON.stringify(a.info().label.kotak.map((k) => [k.nama, k.ringkas]));
				let sebelum = null;
				let ketemu = null;
				for (let d = 70; d >= 25 && ketemu === null; d -= 0.2) {
					pos(d);
					await rAF();
					const v = vektor();
					if (sebelum !== null && v !== sebelum) ketemu = d;
					sebelum = v;
				}
				if (ketemu === null) return { ketemu };
				const awal = vektor();
				const beda = [];
				for (let n = 0; n < 12; n++) {
					for (const dd of [0.15, 0, -0.15, 0]) {
						pos(ketemu + dd);
						await rAF();
						if (vektor() !== awal) beda.push(ketemu + dd);
					}
				}
				return { ketemu, beda };
			});
			cek(r.ketemu !== null && r.ketemu !== undefined, `${nm}: no full/compact flip found while dollying out`);
			cek(!r.beda?.length, `${nm}: labels flipped while the camera jiggled by a few px: ${JSON.stringify(r.beda)}`);
		}
		// The selected label stays full (through the table, like a user).
		const d = await api(p, "erp_internal.production_floor.get_data", {}, false);
		const m5 = d.mesin.find((m) => m.nomor === 5);
		await p.evaluate((n) => erp.lantai.aktif.host.shadowRoot.querySelector(`tr[data-mesin="${n}"]`).click(), m5.name);
		await p.waitForTimeout(2500);
		s = await labelRapi(p);
		const k5 = s.label?.kotak?.find((k) => k.nama === m5.name);
		cek(k5 && !k5.ringkas, `${nm}: selected label ${JSON.stringify(k5)} is not full`);
		// Hysteresis: after the rest no label switches between full and compact.
		const a1 = JSON.stringify((s.label?.kotak || []).map((k) => [k.nama, k.ringkas]));
		await p.waitForTimeout(2000);
		const s2 = await labelRapi(p);
		cek(a1 === JSON.stringify((s2.label?.kotak || []).map((k) => [k.nama, k.ringkas])), `${nm}: labels switched during a 2 s rest`);
		// Zoomed in twice from the default view: nothing under the KPI row.
		await p.evaluate(() => erp.lantai.aktif.host.shadowRoot.querySelector(".kamera .reset").click());
		await p.evaluate(() => erp.lantai.aktif.pilih(null));
		await p.waitForTimeout(1200);
		for (let n = 0; n < 2; n++) {
			await p.evaluate(() => erp.lantai.aktif.host.shadowRoot.querySelector(".kamera .zum-masuk").click());
			await p.waitForTimeout(700);
		}
		await p.waitForTimeout(1500);
		s = await labelRapi(p);
		const kpi = await p.evaluate(() => {
			const h = erp.lantai.aktif.host;
			const a = h.getBoundingClientRect();
			const k = h.shadowRoot.querySelector(".kpi").getBoundingClientRect();
			return { x0: k.left - a.left, y0: k.top - a.top, x1: k.right - a.left, y1: k.bottom - a.top };
		});
		for (const k of s.label?.kotak || []) cek(!beririsan(k, kpi), `${nm} zoomed: label ${k.nama} sits under the KPI row`);
		await p.screenshot({ path: join(HASIL, `lantai-label-rapi-${l}.png`) });
		cek((await dialog(p)) === 0, `${nm}: a message dialog is open`);
		await ctx.close();
	}
});
// --- pabrik: the building and the outside, the andon points stay clear, the floor rings follow the statuses ----------
if (jalankan("pabrik")) await kasus("pabrik", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const asli = await catatStatus(p, ["Mesin 01"]);
	try {
		await p.waitForTimeout(1500);
		const i = await p.evaluate(() => erp.lantai.aktif.info());
		cek(i.pabrik?.calls > 0, `pabrik: info().pabrik ${JSON.stringify(i.pabrik)}`);
		cek(i.pabrik?.tris > 0 && i.pabrik.tris < 120000, `pabrik: the decor's triangles ${i.pabrik?.tris}`);
		const lebar = 1440;
		const tinggi = 900;
		const andon = await p.evaluate(() => erp.lantai.aktif.periksaAndon());
		cek(andon.length === 14, `pabrik: ${andon.length} andon points`);
		for (const a of andon) {
			cek(a.layar.depan && a.layar.x > 0 && a.layar.x < lebar && a.layar.y > 0 && a.layar.y < tinggi, `pabrik: ${a.nama}'s andon is off the canvas at ${Math.round(a.layar.x)},${Math.round(a.layar.y)}`);
			cek(a.mesinPertama, `pabrik: a ray to ${a.nama}'s andon hits something else first (${a.pertama?.toFixed(2)} of ${a.jarak.toFixed(2)})`);
			cek(a.pertama !== null && a.pertama >= a.jarak - 0.5, `pabrik: something stands in front of ${a.nama}'s andon (${a.pertama?.toFixed(2)} of ${a.jarak.toFixed(2)})`);
		}
		// The ring takes the status colour; Problem pulses like its lamp.
		await api(p, "erp_internal.production_floor.set_status", { machine: "Mesin 01", status: "Problem" });
		await p.evaluate(() => erp.lantai.aktif.muat());
		await tunggu(p, () => erp.lantai.aktif.info().mesin.find((m) => m.nama === "Mesin 01")?.status === "Problem", null, 5000);
		await p.waitForTimeout(800);
		const cincin = new Set();
		for (let k = 0; k < 8; k++) {
			cincin.add(await p.evaluate(() => erp.lantai.aktif.info().mesin.find((m) => m.nama === "Mesin 01")?.cincin));
			await p.waitForTimeout(110);
		}
		cek(cincin.size >= 3, `pabrik: the Problem ring does not pulse: ${[...cincin].join(" ")}`);
		cek([...cincin].every((h) => { const n = [1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16)); return n[0] > n[1] + 20 && n[0] > n[2] + 20; }), `pabrik: the Problem ring is not red: ${[...cincin].join(" ")}`);
		await p.screenshot({ path: join(HASIL, "lantai-pabrik.png") });
		cek((await dialog(p)) === 0, "pabrik: a message dialog is open");
		cek(!p.__galat.length, `pabrik: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} finally {
		await pulihkanStatus(p, asli);
		await ctx.close();
	}
});
// --- zona: the zones' props and floor lettering, English and Indonesian, the budget, nothing new after load ----------
if (jalankan("zona")) await kasus("zona", async () => {
	const ctx = await konteksMasuk(browser);
	const ENGLISH = ["Raw Material", "Finished Goods", "Reject", "Mould Storage", "Grinder", "QC Office"];
	const INDONESIA = ["Bahan Baku", "Barang Jadi", "Reject", "Gudang Cetakan", "Penggiling", "QC / Kantor"];
	let p = await bukaLantai(ctx);
	try {
		await p.waitForTimeout(1200);
		const i = await p.evaluate(() => erp.lantai.aktif.info());
		cek(i.zona?.calls > 0, `zona: info().zona ${JSON.stringify(i.zona)}`);
		cek(JSON.stringify(i.zona?.tulisan) === JSON.stringify(ENGLISH), `zona: lettering in English ${JSON.stringify(i.zona?.tulisan)}`);
		const jumlah = (i.pabrik?.calls || 0) + (i.zona?.calls || 0);
		cek(jumlah > 0 && jumlah <= 100, `zona: draw calls of building + zones ${jumlah}`);
		cek((i.pabrik?.tris || 0) + (i.zona?.tris || 0) <= 250000, `zona: triangles of building + zones ${(i.pabrik?.tris || 0) + (i.zona?.tris || 0)}`);
		cek(i.render.calls <= 100 && i.render.triangles <= 250000, `zona: rendered ${i.render.calls} calls, ${i.render.triangles} triangles`);
		// Every lettering plate lies on the slab and touches its own zone.
		const { SLAB, ZONA } = await import("../erp_internal/public/js/lantai/denah.js");
		for (const [nama, k] of Object.entries(i.zona?.pelat || {})) {
			const z = ZONA[nama];
			cek(k.x0 >= SLAB.x0 && k.x1 <= SLAB.x1 && k.z0 >= SLAB.z0 && k.z1 <= SLAB.z1, `zona: the ${nama} lettering leaves the slab ${JSON.stringify(k)}`);
			cek(k.x0 >= z.x0 - 0.01 && k.x1 <= z.x1 + 0.01 && k.z1 > z.z0 && k.z0 < z.z1 + 0.5 && k.z0 >= z.z0 - 0.01, `zona: the ${nama} lettering is not at its zone ${JSON.stringify(k)}`);
		}
		cek(Object.keys(i.zona?.pelat || {}).length === 6, `zona: ${Object.keys(i.zona?.pelat || {}).length} lettering plates`);
		// 20 status changes grow no geometry, texture or program.
		const m = await p.evaluate(async () => {
			const nilai = () => {
				const k = erp.lantai.aktif.info();
				return { ...k.memory, programs: k.programs };
			};
			const d = await erp.lantai.ambil();
			const awal = nilai();
			const STATUS = ["Production", "Off", "Idle", "Problem", "Maintenance", "Setup"];
			for (let n = 0; n < 20; n++) {
				d.mesin[n % d.mesin.length].status = STATUS[n % STATUS.length];
				erp.lantai.aktif.perbarui(d);
				await new Promise((r) => setTimeout(r, 60));
			}
			return { awal, akhir: nilai() };
		});
		cek(m.akhir.geometries <= m.awal.geometries && m.akhir.textures <= m.awal.textures && m.akhir.programs <= m.awal.programs, `zona: 20 status changes grew ${JSON.stringify(m)}`);
		await p.evaluate(() => erp.lantai.aktif.muat());
		await p.screenshot({ path: join(HASIL, "lantai-zona.png") });
		// Indonesian: the same strings, translated.
		await api(p, "erp_internal.bahasa.ganti", { lang: "id" });
		await p.close();
		p = await bukaLantai(ctx);
		await p.waitForTimeout(800);
		const j = await p.evaluate(() => erp.lantai.aktif.info());
		cek(JSON.stringify(j.zona?.tulisan) === JSON.stringify(INDONESIA), `zona: lettering in Indonesian ${JSON.stringify(j.zona?.tulisan)}`);
		await p.screenshot({ path: join(HASIL, "lantai-zona-id.png") });
		cek((await dialog(p)) === 0, "zona: a message dialog is open");
		cek(!p.__galat.length, `zona: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} finally {
		try {
			setNilai("User", "user@example.com", "language", "en");
			bench("execute", "frappe.clear_cache", "--kwargs", JSON.stringify({ user: "user@example.com" }));
		} catch (e) {
			gagal.push(`zona: could not switch user@example.com back to English: ${e.message.slice(0, 200)}`);
		}
		await ctx.close();
	}
});
if (jalankan("hud")) await kasus("hud", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	await p.evaluate(() => {
		try {
			localStorage.removeItem("erp.lantai.tabelTutup");
		} catch {
			/* nothing stored */
		}
	});
	await p.reload({ waitUntil: "domcontentloaded" });
	await p.waitForFunction(() => window.erp?.lantai?.aktif?.info().mesin?.length > 0, null, { timeout: 20000 });
	await p.waitForTimeout(800);
	const d = await api(p, "erp_internal.production_floor.get_data", {}, false);
	const h = await hudDari(p);
	cek(d.perusahaan?.nama && h.nama === d.perusahaan.nama, `hud: company name ${JSON.stringify(h.nama)}, server ${JSON.stringify(d.perusahaan)}`);
	cek(h.inisial || h.logo, "hud: neither a logo nor initials");
	cek(/\b14\b/.test(h.jumlah || ""), `hud: machine chip reads ${JSON.stringify(h.jumlah)}`);
	cek(h.kpi.mesin?.nilai === "14", `hud: Machines KPI ${JSON.stringify(h.kpi.mesin)}`);
	// Status chips (the legend) count the server's statuses, an empty one as Idle.
	const per = {};
	for (const m of d.mesin) per[m.status || "Idle"] = (per[m.status || "Idle"] || 0) + 1;
	for (const s of ["Production", "Setup", "Idle", "Problem", "Maintenance", "Off"])
		cek(h.legenda[s] === String(per[s] || 0), `hud: ${s} chip ${h.legenda[s]}, server ${per[s] || 0}`);
	const prod = per.Production || 0;
	cek(h.kpi.jalan?.nilai === String(prod), `hud: Running ${JSON.stringify(h.kpi.jalan)}, server ${prod}`);
	const util = Math.round((prod / d.mesin.length) * 100);
	cek((h.kpi.jalan?.ket || "").includes(`${util}%`), `hud: utilization ${JSON.stringify(h.kpi.jalan?.ket)}, wanted ${util}%`);
	cek(h.kpi.masalah?.nilai === String(per.Problem || 0), `hud: Problem KPI ${JSON.stringify(h.kpi.masalah)}`);
	const wo = d.mesin.map((m) => m.wo).filter(Boolean);
	cek(h.kpi.wo?.nilai === String(wo.filter((w) => w.status === "In Process").length), `hud: Work Orders running ${JSON.stringify(h.kpi.wo)}`);
	const fmt = await p.evaluate((ws) => ws.map((n) => format_number(n, null, 0)), [wo.reduce((a, w) => a + (w.produced_qty || 0), 0), wo.reduce((a, w) => a + (w.qty || 0), 0)]);
	cek(h.kpi.hasil?.nilai === `${fmt[0]} / ${fmt[1]}`, `hud: Output ${JSON.stringify(h.kpi.hasil)}, wanted ${fmt[0]} / ${fmt[1]}`);
	// The clock ticks: a new text within 2 s.
	const w1 = h.waktu;
	cek(/\d\d.\d\d.\d\d/.test(w1 || ""), `hud: clock reads ${JSON.stringify(w1)}`);
	cek(await tunggu(p, (w) => erp.lantai.aktif.host.shadowRoot.querySelector(".jam .waktu").textContent !== w, w1, 2000), "hud: the clock did not change within 2 s");
	cek(h.tanggal, "hud: no date");
	// Table: one row per machine in floor order; a row click selects like a click in the scene.
	cek(h.baris.length === d.mesin.length && h.baris.every((b, i) => b.nama === d.mesin[i].name), `hud: table rows ${h.baris.map((b) => b.nama).join(",")}`);
	cek(!h.tutup, "hud: the machine table starts collapsed on a wide screen");
	await p.locator('.lantai-host .tabel tbody tr[data-mesin="Mesin 05"]').click();
	cek(await tunggu(p, () => erp.lantai.aktif.info().pilih === "Mesin 05", null, 2000), "hud: a row click did not select Mesin 05");
	await p.waitForTimeout(900); // the fly
	const pn = await panelDari(p);
	cek(pn?.nama === "Mesin 05", `hud: the row click opened ${pn?.nama}`);
	const sesudah = await p.evaluate(() => ({ i: erp.lantai.aktif.info(), m: erp.lantai.aktif.info().mesin.find((m) => m.nama === "Mesin 05") }));
	cek(Math.hypot(sesudah.i.target[0] - sesudah.m.x, sesudah.i.target[2] - sesudah.m.z) < 0.3, "hud: the row click did not fly the camera to Mesin 05");
	const h2 = await hudDari(p);
	cek(h2.baris.find((b) => b.nama === "Mesin 05")?.dipilih, "hud: the selected row is not marked");
	cek(await p.evaluate(() => [...erp.lantai.aktif.host.shadowRoot.querySelectorAll(".label.dipilih")].map((l) => l.dataset.mesin).join()) === "Mesin 05", "hud: the label of the row's machine is not selected");
	// Nothing covers the open panel.
	for (const [n, k] of Object.entries(h2.kotak)) if (n !== "panel") cek(!tumpang(h2.kotak.panel, k), `hud: the panel overlaps the ${n} ${JSON.stringify([h2.kotak.panel, k])}`);
	const ditutupi = await panelDiAtas(p);
	cek(!ditutupi.length, `hud: points of the panel are covered at ${ditutupi.join(" ")}`);
	await p.screenshot({ path: join(HASIL, "lantai-hud-panel.png") });
	// Camera bar: + brings the camera closer, − takes it back; home is the default view.
	const jarak = () => p.evaluate(() => {
		const i = erp.lantai.aktif.info();
		return Math.hypot(...i.kamera.map((v, k) => v - i.target[k]));
	});
	const j0 = await jarak();
	await p.locator(".lantai-host .kamera .zum-masuk").click();
	await p.waitForTimeout(400);
	const j1 = await jarak();
	cek(j1 < j0 * 0.9, `hud: + did not zoom in (${j0.toFixed(2)} → ${j1.toFixed(2)})`);
	await p.locator(".lantai-host .kamera .zum-keluar").click();
	await p.waitForTimeout(400);
	const j2 = await jarak();
	cek(Math.abs(j2 - j0) < 0.2, `hud: − did not zoom back out (${j0.toFixed(2)} → ${j1.toFixed(2)} → ${j2.toFixed(2)})`);
	// Collapse: remembered across a reload.
	await p.locator(".lantai-host .panel .tutup").click();
	await p.locator(".lantai-host .tabel .lipat").click();
	cek((await hudDari(p)).tutup, "hud: the fold button did not collapse the table");
	await p.reload({ waitUntil: "domcontentloaded" });
	await p.waitForFunction(() => window.erp?.lantai?.aktif?.info().mesin?.length > 0, null, { timeout: 20000 });
	cek((await hudDari(p)).tutup, "hud: the collapsed table opened again after a reload");
	await p.locator(".lantai-host .tabel .lipat").click();
	cek(!(await hudDari(p)).tutup, "hud: the fold button did not open the table");
	cek((await dialog(p)) === 0, "hud: a message dialog is open");
	cek(!galatNyata(p.__galat).length, `hud: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	await ctx.close();

	// Phone width: two compact rows, the table collapsed, the bottom sheet over everything.
	const hp = await konteksMasuk(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
	const q = await bukaLantai(hp);
	await q.waitForTimeout(1000);
	const hh = await hudDari(q);
	cek(hh.tutup, "hud: the machine table is open on a phone");
	cek(hh.kotak.bar && hh.kotak.bar.kanan <= 390 && hh.kotak.kpi && hh.kotak.kpi.kanan <= 390, `hud: the bar is wider than the phone ${JSON.stringify(hh.kotak)}`);
	cek(!tumpang(hh.kotak.bar, hh.kotak.kpi), "hud: the bar and the KPI row overlap on a phone");
	const lebar = await q.evaluate(() => document.documentElement.scrollWidth);
	cek(lebar <= 390, `hud: the page scrolls sideways on a phone (${lebar} px)`);
	await q.screenshot({ path: join(HASIL, "lantai-hud-hp.png") });
	await q.evaluate(() => erp.lantai.aktif.pilih("Mesin 03"));
	await q.waitForTimeout(900);
	const tertutup = await panelDiAtas(q);
	cek(!tertutup.length, `hud: on a phone, points of the panel are covered at ${tertutup.join(" ")}`);
	await q.screenshot({ path: join(HASIL, "lantai-hud-hp-panel.png") });
	await hp.close();
});

// Realtime blocked: the dot says when the view was last updated instead of "Live".
if (jalankan("hud-live")) await kasus("hud-live", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	cek(await tunggu(p, () => erp.lantai.aktif.host.shadowRoot.querySelector(".live").dataset.live === "1", null, 6000), `hud-live: the dot does not read Live with realtime on (${(await hudDari(p)).live})`);
	cek((await hudDari(p)).live === "Live", `hud-live: the dot reads ${(await hudDari(p)).live}`);
	await ctx.close();
	const blok = await konteksMasuk(browser);
	await blok.route("**/socket.io/**", (r) => r.abort());
	await blok.routeWebSocket(/socket\.io/, (ws) => ws.close());
	const q = await blok.newPage();
	await q.goto(`${URL}/desk/production-floor`, { waitUntil: "domcontentloaded", timeout: 60000 });
	await q.waitForFunction(() => window.erp?.lantai?.aktif?.info().mesin?.length > 0, null, { timeout: 20000 });
	await q.waitForTimeout(1500);
	const h = await hudDari(q);
	cek(/^Updated \d\d.\d\d$/.test(h.live || "") && h.liveData === "0", `hud-live: with realtime blocked the dot reads ${JSON.stringify(h.live)} (${h.liveData})`);
	await blok.close();
});

// A company name and logo from the server are data: text only, and only a same-origin file as the image.
if (jalankan("hud-xss")) await kasus("hud-xss", async () => {
	const RACUN = "<img src=x onerror=window.kena=1>";
	for (const [logo, boleh] of [
		["javascript:window.kena=2", false],
		["https://contoh.invalid/logo.png", false],
		["//contoh.invalid/files/logo.png", false],
		["/files/logo-uji.png", true],
	]) {
		const ctx = await konteksMasuk(browser);
		await ctx.route("**/api/method/erp_internal.production_floor.get_data*", async (r) => {
			const asli = await r.fetch();
			const j = await asli.json();
			j.message.perusahaan = { nama: RACUN, logo };
			await r.fulfill({ response: asli, json: j });
		});
		const p = await bukaLantai(ctx);
		await p.waitForTimeout(700);
		const h = await hudDari(p);
		cek(h.nama === RACUN, `hud-xss: the company name shows ${JSON.stringify(h.nama)}`);
		cek((await p.evaluate(() => window.kena)) === undefined, `hud-xss: script ran (window.kena set) with logo ${logo}`);
		const img = await p.evaluate(() => [...erp.lantai.aktif.host.shadowRoot.querySelectorAll("img")].map((i) => i.getAttribute("src")));
		if (boleh) cek(img.length === 1 && img[0]?.endsWith("/files/logo-uji.png"), `hud-xss: a same-origin file logo was not used (${JSON.stringify(img)})`);
		else cek(img.every((s) => s === null), `hud-xss: logo ${logo} became an image src ${JSON.stringify(img)}`);
		if (!boleh) cek(h.inisial === "IS", `hud-xss: initials ${JSON.stringify(h.inisial)} for a refused logo`);
		await ctx.close();
	}
	// A Work Order item name is data too: in the attention card it shows as text.
	{
		const ctx = await konteksMasuk(browser);
		await ctx.route("**/api/method/erp_internal.production_floor.get_data*", async (r) => {
			const asli = await r.fetch();
			const j = await asli.json();
			j.message.mesin[0].status = "Problem";
			j.message.mesin[0].wo = { name: "WO-X", item_code: "X", item_name: RACUN, qty: 10, produced_qty: 1, status: "In Process" };
			await r.fulfill({ response: asli, json: j });
		});
		const p = await bukaLantai(ctx);
		await p.waitForTimeout(900);
		const k = await p.evaluate((n) => {
			const l = erp.lantai.aktif.host.shadowRoot.querySelector(`.perhatian li[data-mesin="${n}"]`);
			return l ? { teks: l.textContent, img: l.querySelectorAll("img").length } : null;
		}, (await p.evaluate(() => erp.lantai.aktif.info().mesin[0].nama)));
		cek(k && k.teks.includes(RACUN) && k.img === 0, `hud-xss: the attention card shows ${JSON.stringify(k)}`);
		cek((await p.evaluate(() => window.kena)) === undefined, "hud-xss: script ran from the attention card");
		await ctx.close();
	}
});

// Glass: every fixed card blurs what is behind it (the moving labels do not, see label.js), and every text keeps 4.5:1 against its card over the floor, light and
// dark. The backdrop is taken as the scene's background colour (the floor under the cards is close to it).
// --- hidup: the simulated life layer (operators, technicians, parts) and its note ---------------------------------------
if (jalankan("hidup")) await kasus("hidup", async () => {
	const ctx = await konteksMasuk(browser);
	const p = await bukaLantai(ctx);
	const RENCANA = { "Mesin 01": "Production", "Mesin 02": "Problem", "Mesin 03": "Off" };
	const asli = await catatStatus(p, Object.keys(RENCANA));
	try {
		for (const [machine, status] of Object.entries(RENCANA)) await api(p, "erp_internal.production_floor.set_status", { machine, status });
		await p.evaluate(() => erp.lantai.aktif.muat());
		const siap = await tunggu(p, (r) => Object.entries(r).every(([n, s]) => erp.lantai.aktif.info().mesin.find((m) => m.nama === n)?.status === s), RENCANA, 6000);
		cek(siap, "hidup: the three statuses did not show");
		await p.waitForTimeout(600);
		const h = await p.evaluate(() => erp.lantai.aktif.info().hidup);
		cek(h?.aktif === true, `hidup: info().hidup ${JSON.stringify(h)?.slice(0, 200)}`);
		if (!h) return;
		cek(h.operator >= 1 && h.teknisi >= 1, `hidup: ${h.operator} operator(s), ${h.teknisi} technician(s)`);
		const di = (n) => h.orang.filter((o) => o.nama === n).map((o) => o.jenis);
		cek(di("Mesin 01").join() === "operator", `hidup: Mesin 01 (Production) has ${di("Mesin 01")}`);
		cek(di("Mesin 02").join() === "teknisi", `hidup: Mesin 02 (Problem) has ${di("Mesin 02")}`);
		cek(di("Mesin 03").length === 0, `hidup: Mesin 03 (Off) has ${di("Mesin 03")}`);
		cek(h.orang.length === h.operator + h.teknisi, "hidup: the figure list and the counts disagree");
		cek(h.calls > 0 && h.calls <= 12 && h.tris < 60000, `hidup: calls ${h.calls}, triangles ${h.tris}`);
		// Parts fall once per mould cycle (5 s): within 2 cycles plus a margin.
		const dulu = h.jatuh;
		cek(await tunggu(p, (n) => erp.lantai.aktif.info().hidup.jatuh > n, dulu, 12000), `hidup: no part fell within 2 cycles (${dulu})`);
		cek((await p.evaluate(() => erp.lantai.aktif.info().hidup.tong.length)) === (await p.evaluate(() => erp.lantai.aktif.info().mesin.length)), "hidup: bins and machines differ");
		// The forklift is out for now (Abel, 2026-10-29).
		cek(!("forklift" in h), "hidup: the life layer still reports a forklift");
		// The note says it is simulated, in the HUD.
		const nota = await p.evaluate(() => erp.lantai.aktif.host.shadowRoot.querySelector(".hud .simulasi")?.textContent ?? null);
		cek(nota === "Operators and parts are simulated", `hidup: the note reads ${JSON.stringify(nota)}`);
		await p.screenshot({ path: join(HASIL, "lantai-hidup.png") });
		cek((await dialog(p)) === 0, "hidup: a message dialog is open");
		cek(!p.__galat.length, `hidup: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} finally {
		await pulihkanStatus(p, asli);
		await ctx.close();
	}
});
if (jalankan("glass")) await kasus("glass", async () => {
	const ctx = await konteksMasuk(browser, { deviceScaleFactor: 2 });
	const p = await bukaLantai(ctx);
	await p.waitForTimeout(1200);
	await p.evaluate(() => erp.lantai.aktif.pilih("Mesin 03"));
	await p.waitForTimeout(1200);
	const KARTU = [".bar", ".kpi", ".tabel", ".kamera", ".panel", ".label .isi"];
	// The labels move with the camera: glass fill and edge without the blur (label.js), so no blur asserted.
	const TANPA_BLUR = [".label .isi"];
	for (const tema of ["light", "dark"]) {
		await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);
		await p.waitForTimeout(500);
		const hasil = await p.evaluate((KARTU) => {
			const r = erp.lantai.aktif.host.shadowRoot;
			const host = erp.lantai.aktif.host;
			const c = document.createElement("canvas");
			c.width = c.height = 1;
			const g = c.getContext("2d", { willReadFrequently: true });
			// Any CSS colour to [r, g, b, a] through the canvas.
			const warna = (css) => {
				g.clearRect(0, 0, 1, 1);
				g.fillStyle = "rgba(0,0,0,0)";
				g.fillStyle = css;
				g.fillRect(0, 0, 1, 1);
				const d = g.getImageData(0, 0, 1, 1).data;
				return [d[0], d[1], d[2], d[3] / 255];
			};
			const atas = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
			const terang = (w) => {
				const [R, G, B] = w.map((v) => {
					const s = v / 255;
					return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
				});
				return 0.2126 * R + 0.7152 * G + 0.0722 * B;
			};
			const rasio = (a, b) => {
				const [x, y] = [terang(a), terang(b)].sort((m, n) => n - m);
				return (x + 0.05) / (y + 0.05);
			};
			const latar = warna(getComputedStyle(host).getPropertyValue("--lantai-latar").trim()).slice(0, 3);
			const blur = {};
			const buruk = [];
			let terendah = 99;
			for (const sel of KARTU) {
				const kartu = r.querySelector(sel);
				if (!kartu) {
					buruk.push(`${sel}: missing`);
					continue;
				}
				const cs = getComputedStyle(kartu);
				blur[sel] = cs.backdropFilter || cs.webkitBackdropFilter;
				// Every visible text node's element inside the card.
				const jalan = document.createTreeWalker(kartu, NodeFilter.SHOW_TEXT);
				const dilihat = new Set();
				while (jalan.nextNode()) {
					const e = jalan.currentNode.parentElement;
					if (!jalan.currentNode.textContent.trim() || dilihat.has(e) || !e.getClientRects().length) continue;
					if (getComputedStyle(e).visibility === "hidden") continue;
					dilihat.add(e);
					// Backgrounds from the card down to the text's element, over the floor.
					const rantai = [];
					for (let x = e; x; x = x.parentElement) {
						rantai.unshift(x);
						if (x === kartu) break;
					}
					let bg = latar;
					for (const x of rantai) bg = atas(warna(getComputedStyle(x).backgroundColor), bg);
					const teks = atas(warna(getComputedStyle(e).color), bg);
					const k = rasio(teks, bg);
					terendah = Math.min(terendah, k);
					if (k < 4.5) buruk.push(`${sel} "${e.textContent.trim().slice(0, 24)}" ${k.toFixed(2)}`);
				}
			}
			return { blur, buruk, terendah, tema: host.dataset.tema };
		}, KARTU);
		cek(hasil.tema === tema, `glass: the host's theme is ${hasil.tema}, Desk's ${tema}`);
		for (const [sel, b] of Object.entries(hasil.blur))
			if (!TANPA_BLUR.includes(sel)) cek(/blur/.test(b || ""), `glass (${tema}): ${sel} backdrop-filter ${JSON.stringify(b)}`);
		cek(!hasil.buruk.length, `glass (${tema}): contrast under 4.5:1: ${hasil.buruk.slice(0, 6).join("; ")}`);
		console.log(`glass (${tema}): lowest text contrast ${hasil.terendah.toFixed(2)}:1`);
		await p.screenshot({ path: join(HASIL, `lantai-kaca-${tema === "light" ? "terang" : "gelap"}.png`) });
	}
	await p.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
	// Less transparency asked for (CDP media emulation; Playwright's emulateMedia has no such option): every card
	// and every label turns solid.
	const cdp = await ctx.newCDPSession(p);
	await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
	cek(await p.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches), "glass: reduced transparency is not emulated");
	for (const tema of ["light", "dark"]) {
		await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), tema);
		await p.waitForTimeout(300);
		const tembus = await p.evaluate((KARTU) => {
			const r = erp.lantai.aktif.host.shadowRoot;
			const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
			const alfa = (css) => {
				c.clearRect(0, 0, 1, 1);
				c.fillStyle = "rgba(0,0,0,0)";
				c.fillStyle = css;
				c.fillRect(0, 0, 1, 1);
				return c.getImageData(0, 0, 1, 1).data[3];
			};
			const semua = KARTU.flatMap((sel) => [...r.querySelectorAll(sel)].map((e) => [sel, e]));
			return {
				n: semua.length,
				buruk: semua
					.filter(([, e]) => alfa(getComputedStyle(e).backgroundColor) < 255 || !/^(none)?$/.test(getComputedStyle(e).backdropFilter))
					.map(([sel, e]) => `${sel}${e.closest(".label")?.dataset.mesin ? ` (${e.closest(".label").dataset.mesin})` : ""}: ${getComputedStyle(e).backgroundColor} ${getComputedStyle(e).backdropFilter}`),
			};
		}, KARTU);
		cek(tembus.n >= 19, `glass (reduced, ${tema}): only ${tembus.n} cards and labels found`);
		cek(!tembus.buruk.length, `glass (reduced, ${tema}): not solid: ${tembus.buruk.slice(0, 4).join("; ")}`);
	}
	await p.screenshot({ path: join(HASIL, "lantai-kaca-padat.png") });
	await p.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
	await cdp.send("Emulation.setEmulatedMedia", { features: [] });
	await ctx.close();
});

cek(!galat.length, `console errors: ${galat.slice(0, 3).join(" | ").slice(0, 400)}`);
// The headless pages above still draw their scenes; close them so the headed cases measure this page alone.
await browser.close();

// --- perf: headed, real GPU -------------------------------------------------------------------------------------
if (jalankan("perf")) {
	const nyata = await chromium.launch({ headless: false });
	let p;
	let asli = {};
	const janji = []; // status changes in flight, awaited before the restore
	try {
		const ctx = await konteksMasuk(nyata, { deviceScaleFactor: 2 });
		p = await bukaLantai(ctx);
		asli = await catatStatus(p, ["Mesin 07", "Mesin 08"]);
		await p.waitForTimeout(1000);
		await p.evaluate(() => {
			window.__ft = [];
			window.__lt = [];
			const mulai = performance.now();
			window.__mulai = mulai;
			new PerformanceObserver((l) => {
				for (const e of l.getEntries()) if (e.startTime >= mulai) window.__lt.push(`${((e.startTime - mulai) / 1000).toFixed(2)}s:${e.duration}`);
			}).observe({ type: "longtask", buffered: true });
			// Two clocks per frame: the rAF timestamp (vsync-aligned; Chrome keeps it on the beat even when the main
			// thread stalled, so it only feeds the informational p95) and performance.now() inside the callback, which
			// shows a stall as a long interval (dropped frames, max).
			let akhir = 0;
			let akhirKini = 0;
			const ukur = (t) => {
				const kini = performance.now();
				if (akhir) window.__ft.push([kini - mulai, t - akhir, kini - akhirKini]);
				akhir = t;
				akhirKini = kini;
				if (!window.__berhenti) requestAnimationFrame(ukur);
			};
			requestAnimationFrame(ukur);
		});
		// Orbit by dragging the canvas for 10 s; two status changes at 3 s and 6 s.
		const cx = 720;
		const cy = 450;
		await p.mouse.move(cx, cy);
		await p.mouse.down();
		const t0 = Date.now();
		const ubah = [
			[3000, "Mesin 07", "Problem"],
			[6000, "Mesin 08", "Maintenance"],
		];
		while (Date.now() - t0 < 10000) {
			const t = (Date.now() - t0) / 1000;
			await p.mouse.move(cx + Math.sin(t * 0.9) * 300, cy + Math.sin(t * 0.5) * 40);
			while (ubah.length && Date.now() - t0 >= ubah[0][0]) {
				const [, mesin, status] = ubah.shift();
				janji.push(api(p, "erp_internal.production_floor.set_status", { machine: mesin, status }).then(() => p.evaluate(() => erp.lantai.aktif.muat())));
			}
			await p.waitForTimeout(8);
		}
		await p.mouse.up();
		await Promise.all(janji);
		const hasil = await p.evaluate(() => {
			window.__berhenti = true;
			const sisa = window.__ft.filter(([t]) => t >= 2000);
			const ft = sisa.map(([, d]) => d).sort((a, b) => a - b); // rAF stamps
			const nyata = sisa.map(([, , d]) => d).sort((a, b) => a - b); // performance.now()
			const detik = sisa.length ? (sisa[sisa.length - 1][0] - sisa[0][0] + sisa[0][2]) / 1000 : 1;
			const info = erp.lantai.aktif.info();
			return {
				n: ft.length,
				fps: ft.length / detik,
				jatuh: nyata.filter((d) => d > 25).length,
				p95: ft[Math.floor(ft.length * 0.95)],
				max: nyata[nyata.length - 1],
				median: nyata[Math.floor(nyata.length / 2)],
				lambat: sisa.filter(([, , d]) => d > 25).map(([t, , d]) => `${(t / 1000).toFixed(2)}s:${d.toFixed(1)}`),
				panjang: window.__lt.filter((s) => parseFloat(s) >= 2), // after the 2 s warm-up, like the frames
				render: info.render,
				memory: info.memory,
				kualitas: info.kualitas,
				mesin: info.mesin.filter((m) => ["Mesin 07", "Mesin 08"].includes(m.nama)).map((m) => [m.nama, m.status]),
			};
		});
		console.log(`perf: ${hasil.n} frames, ${hasil.fps.toFixed(1)} fps, dropped (>25 ms) ${hasil.jatuh} (${((100 * hasil.jatuh) / hasil.n).toFixed(2)} %), median ${hasil.median?.toFixed(2)} ms, p95 (rAF, info only) ${hasil.p95?.toFixed(2)} ms, max ${hasil.max?.toFixed(2)} ms, long tasks ${hasil.panjang.length}, draw calls ${hasil.render.calls}, triangles ${hasil.render.triangles}, pixel ratio ${hasil.kualitas.rasio}${hasil.kualitas.rendah ? " (lowered)" : ""}`);
		if (process.env.ERP_RINCI) console.log(`perf: intervals over 25 ms: ${hasil.lambat.join(" ")}`);
		// p95 of rAF intervals is printed, not asserted: on a 60 Hz display it sits at ~18.6 ms even for an empty
		// WebGL canvas (Chrome's frame-clock jitter). Dropped frames and the frame rate are what a user sees.
		cek(hasil.fps >= 57, `perf: ${hasil.fps.toFixed(1)} fps < 57`);
		cek(hasil.jatuh <= hasil.n * 0.01, `perf: ${hasil.jatuh} of ${hasil.n} frames dropped (> 25 ms), over 1 %`);
		cek(hasil.max <= 50, `perf: max ${hasil.max?.toFixed(2)} ms > 50`);
		cek(hasil.panjang.length === 0, `perf: long tasks ${JSON.stringify(hasil.panjang)}`);
		cek(hasil.render.calls <= 100, `perf: draw calls ${hasil.render.calls} > 100`);
		cek(hasil.render.triangles <= 250000, `perf: triangles ${hasil.render.triangles} > 250000`);
		cek(!hasil.kualitas.rendah, "perf: adaptive quality dropped on this machine");
		cek(
			JSON.stringify(hasil.mesin) === JSON.stringify([["Mesin 07", "Problem"], ["Mesin 08", "Maintenance"]]),
			`perf: status changes not shown: ${JSON.stringify(hasil.mesin)}`
		);
		// Label text waits for the camera to rest (label.js DIAM), then follows.
		const labelIkut = await p
			.waitForFunction(
				() => {
					const r = erp.lantai.aktif.host.shadowRoot;
					const st = (n) => [...r.querySelectorAll(".label")].find((e) => e.dataset.mesin === n)?.querySelector(".chip")?.dataset.status;
					return st("Mesin 07") === "Problem" && st("Mesin 08") === "Maintenance";
				},
				null,
				{ timeout: 4000 }
			)
			.then(() => true, () => false);
		cek(labelIkut, "perf: the labels did not follow the status changes once the camera rested");
		await p.screenshot({ path: join(HASIL, "lantai-perf.png") });

		// 20 status changes on the page: no new geometry or texture.
		const memori = await p.evaluate(async () => {
			const STATUS = ["Production", "Off", "Idle", "Problem", "Maintenance", "Setup"];
			const d = await erp.lantai.ambil();
			const nilai = () => {
				const i = erp.lantai.aktif.info();
				return { ...i.memory, programs: i.programs };
			};
			const awal = nilai();
			for (let i = 0; i < 20; i++) {
				d.mesin[i % d.mesin.length].status = STATUS[i % STATUS.length];
				erp.lantai.aktif.perbarui(d);
				await new Promise((r) => setTimeout(r, 120));
			}
			await erp.lantai.aktif.muat();
			return { awal, akhir: nilai() };
		});
		console.log(`perf: memory before ${JSON.stringify(memori.awal)}, after 20 changes ${JSON.stringify(memori.akhir)}`);
		cek(memori.akhir.geometries <= memori.awal.geometries, `perf: geometries grew ${memori.awal.geometries} → ${memori.akhir.geometries}`);
		cek(memori.akhir.textures <= memori.awal.textures, `perf: textures grew ${memori.awal.textures} → ${memori.akhir.textures}`);
		cek(memori.akhir.programs <= memori.awal.programs, `perf: shader programs grew ${memori.awal.programs} → ${memori.akhir.programs}`);

		// Default view and a close-up, for a look by eye.
		await p.evaluate(() => erp.lantai.aktif.host.shadowRoot.querySelector(".reset").click());
		await p.waitForTimeout(600);
		await p.screenshot({ path: join(HASIL, "lantai-mesin.png") });
		await p.mouse.move(720, 600);
		for (let i = 0; i < 12; i++) {
			await p.mouse.wheel(0, -240);
			await p.waitForTimeout(60);
		}
		await p.waitForTimeout(900);
		await p.screenshot({ path: join(HASIL, "lantai-dekat.png") });
		cek(!p.__galat.length, `perf: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} finally {
		await Promise.allSettled(janji);
		if (p) await pulihkanStatus(p, asli);
		await nyata.close();
	}
}

// --- adaptive quality under a 6x slower CPU ---------------------------------------------------------------------
if (jalankan("adaptive")) {
	const nyata = await chromium.launch({ headless: false });
	try {
		const ctx = await konteksMasuk(nyata, { deviceScaleFactor: 2 });
		const p = await bukaLantai(ctx);
		await p.waitForTimeout(500);
		const { kualitas: sebelum, kamera: kameraAwal } = await p.evaluate(() => erp.lantai.aktif.info());
		cek(sebelum.rasio === 2 && !sebelum.rendah, `adaptive: quality before throttling ${JSON.stringify(sebelum)}`);
		// The scene's own frame work is too light to slow down even at 20x, so a slow laptop is stood in for by a fixed
		// amount of other main-thread work per frame: ~6 ms on this CPU (still 60 fps), ~36 ms once throttled 6x.
		const putaran = await p.evaluate(() => {
			// Calibrate: inner loops of 1000 iterations per millisecond, unthrottled.
			let n = 0;
			let k = 0;
			const t = performance.now();
			while (performance.now() - t < 100) {
				for (let i = 0; i < 1000; i++) n += Math.sqrt(i + n) % 3;
				k++;
			}
			window.__sink = n;
			return Math.round((k / 100) * 6);
		});
		await p.evaluate((putaran) => {
			const kerja = () => {
				let n = 0;
				for (let k = 0; k < putaran; k++) for (let i = 0; i < 1000; i++) n += Math.sqrt(i + n) % 3;
				window.__sink = n;
				if (!window.__cukup) requestAnimationFrame(kerja);
			};
			requestAnimationFrame(kerja);
		}, putaran);
		await p.waitForTimeout(2500);
		const tanpaRem = await p.evaluate(() => erp.lantai.aktif.info().kualitas);
		cek(!tanpaRem.rendah, `adaptive: quality dropped before throttling (with the extra work alone) ${JSON.stringify(tanpaRem)}`);
		const cdp = await ctx.newCDPSession(p);
		await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
		const mulai = Date.now();
		try {
			await p.waitForFunction(() => erp.lantai.aktif.info().kualitas.rasio === 1, null, { timeout: 4000, polling: 100 });
			console.log(`adaptive: pixel ratio 1 after ${Date.now() - mulai} ms (fps ${(await p.evaluate(() => erp.lantai.aktif.info().fps)).toFixed(1)})`);
		} catch {
			gagal.push(`adaptive: pixel ratio still ${await p.evaluate(() => erp.lantai.aktif.info().kualitas.rasio)} after 4 s`);
		}
		await p.waitForTimeout(800);
		const info = await p.evaluate(() => erp.lantai.aktif.info());
		cek(info.pabrik?.turun === true, `adaptive: the window glow did not dim (${info.pabrik?.turun})`);
		cek(info.mesin.every((m) => m.amp < 0.5), `adaptive: platens kept cycling after quality dropped (${info.mesin.map((m) => m.amp.toFixed(2)).join(" ")})`);
		// The life layer stops with it: no part falls for 2 s.
		cek(info.hidup?.aktif === false, `adaptive: the life layer is still active after the drop (${JSON.stringify(info.hidup?.aktif)})`);
		const h2 = await p.evaluate(() => erp.lantai.aktif.info().hidup);
		await p.waitForTimeout(2000);
		const h3 = await p.evaluate(() => erp.lantai.aktif.info().hidup);
		cek(h2 && h3 && h2.jatuh === h3.jatuh, `adaptive: parts kept falling after the drop (${h2?.jatuh} -> ${h3?.jatuh})`);
		// Move the camera, then a raw click on the reset button: the view is back within 300 ms.
		await p.mouse.move(700, 450);
		await p.mouse.down();
		await p.mouse.move(900, 420, { steps: 5 });
		await p.mouse.up();
		await p.waitForTimeout(300);
		const kotak = await p.locator(".lantai-host .reset").boundingBox();
		// Input to the next drawn frame, timed by the page: the browser's pointerdown stamp to the frame after the click.
		await p.evaluate(() => {
			const b = erp.lantai.aktif.host.shadowRoot.querySelector(".reset");
			window.__tekan = window.__selesai = null;
			b.addEventListener("pointerdown", (e) => (window.__tekan = e.timeStamp), { once: true });
			b.addEventListener("click", () => requestAnimationFrame(() => (window.__selesai = performance.now())), { once: true });
		});
		const t0 = Date.now();
		await p.mouse.click(kotak.x + kotak.width / 2, kotak.y + kotak.height / 2);
		let lama = Infinity;
		try {
			await p.waitForFunction(() => window.__selesai != null, null, { timeout: 3000 });
			lama = await p.evaluate(() => window.__selesai - window.__tekan);
		} catch {
			/* reported below */
		}
		console.log(`adaptive: reset click: input to next frame ${lama.toFixed?.(1) ?? lama} ms (with the tool's round trips ${Date.now() - t0} ms)`);
		cek(lama < 300, `adaptive: reset click took ${lama} ms`);
		await p.waitForTimeout(500);
		const sesudah = await p.evaluate(() => erp.lantai.aktif.info().kamera);
		const jauh = Math.hypot(...sesudah.map((v, i) => v - kameraAwal[i]));
		cek(jauh < 0.05, `adaptive: the camera drifted ${jauh.toFixed(2)} from the default view after reset`);
		await p.evaluate(() => (window.__cukup = true));
		await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
		cek(!p.__galat.length, `adaptive: console errors: ${p.__galat.slice(0, 3).join(" | ").slice(0, 300)}`);
	} finally {
		await nyata.close();
	}
}

if (gagal.length) {
	console.error("GAGAL:\n- " + gagal.join("\n- "));
	process.exit(1);
}
console.log(`OK: production-floor (${KASUS.length ? KASUS.join(", ") : "1 canvas, 1 context, 14 markers in floor order, states, 13-machines, no-webgl, label, label-rapi, pabrik, zona, pilih, status, wo, xss, set_value, poll, live, reconnect, notes, panel-quiet, strip, hidden, id, hud, hud-live, hud-xss, perhatian, dekor-gelap, memuat, hidup, glass, perf, adaptive"})`);
