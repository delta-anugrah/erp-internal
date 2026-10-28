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
//   states       six statuses set through set_status on Mesin 01-06; lamps, pulse, dimming and motion read back
//                from info().mesin (statuses restored after)
//   13-machines  Mesin 05's erp_nomor set to 0 for the run (bench execute; restored after): 13 machines, slot 5
//                empty, no dialog; a duplicate and an unknown number land in the spare row
//   no-webgl     --disable-webgl: the plain table with 14 rows, no canvas, no dialog; the same when the bundle fails
//   perf         headed Chromium 1440x900 @2x: 10 s scripted orbit with two status changes, first 2 s dropped:
//                >= 57 fps, intervals > 25 ms <= 1 %, max <= 50 ms, no long task, <= 60 draw calls, <= 150k
//                triangles; 20 status changes grow no geometry, texture or shader program (p95 printed only)
//   adaptive     CPU throttled 6x: pixel ratio 1 within 4 s, the reset button answers within 300 ms
//   label        machine 3's label reads "03 · <brand> <tonnage>T" over its machine; no label writes while the camera
//                rests; labels behind the camera hide
//   pilih        a real click on Mesin 03 opens its panel and flies the camera to it; Open machine goes to the form;
//                a bottom sheet at 390 px wide
//   status       the Problem button: spinner and disabled until the answer, the server's status (get_value), the
//                chip, the lamp; a refused change is an inline note; an unchanged refetch touches no machine
//   wo, xss      a submitted In Process Work Order (40 produced) on Mesin 03: label item and progress, panel link;
//                then an item name and a model of <img src=x onerror=...> show as text (Work Order removed after)
//   set_value    frappe.db.set_value on a status (no event) with ?poll=3: the view follows
//   poll         /socket.io blocked, ?poll=3: a status change still shows
//   live         realtime on, default 60 s poll: a change from another tab shows within 5 s
//   id           user@example.com in Indonesian: "Lantai Produksi" and the status names (switched back after)
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
	// Lit segment, its steady colour, pulse Hz, body brightness, platen motion.
	const HARAP = {
		Production: ["hijau", "#22d36b", 0, 1, true],
		Off: [null, null, 0, 0.38, false],
		Idle: ["kuning", "#ffc21a", 0, 1, false],
		Problem: ["merah", null, 1, 1, false],
		Maintenance: ["biru", "#3d8bff", 0, 0.6, false],
		Setup: ["kuning", null, 0.45, 1, false],
	};
	const asli = await catatStatus(p, Object.keys(RENCANA));
	try {
		for (const [mesin, status] of Object.entries(RENCANA)) {
			const baris = await api(p, "erp_internal.production_floor.set_status", { machine: mesin, status });
			cek(baris?.status === status, `set_status ${mesin} → ${status} answered ${JSON.stringify(baris)?.slice(0, 120)}`);
		}
		await p.evaluate(() => erp.lantai.aktif.muat());
		// Easing settles in well under a second at 60 fps; allow a slow GL more.
		await p
			.waitForFunction(
				(n) => {
					const m = erp.lantai.aktif.info().mesin.filter((x) => n.includes(x.nama));
					return m.length === n.length && m.every((x) => (x.gerak ? x.amp > 0.9 || erp.lantai.aktif.info().kualitas.rendah : x.amp === 0));
				},
				Object.keys(RENCANA),
				{ timeout: 10000 }
			)
			.catch(() => {});
		await p.waitForTimeout(500);
		const info = await p.evaluate(() => erp.lantai.aktif.info());
		const per = Object.fromEntries(info.mesin.map((m) => [m.nama, m]));
		for (const [mesin, status] of Object.entries(RENCANA)) {
			const m = per[mesin];
			const [lampu, warna, denyut, redup, gerak] = HARAP[status];
			if (!cek(m, `${mesin} not drawn`)) continue;
			cek(m.status === status, `${mesin} status ${m.status}, wanted ${status}`);
			cek(m.lampu === lampu, `${mesin} (${status}) lamp ${m.lampu}, wanted ${lampu}`);
			if (warna) cek(hexJarak(m.warna, warna) <= 6, `${mesin} (${status}) lamp colour ${m.warna}, wanted ${warna}`);
			cek(m.denyut === denyut, `${mesin} (${status}) pulse ${m.denyut} Hz, wanted ${denyut}`);
			cek(Math.abs(m.redup - redup) < 0.01, `${mesin} (${status}) body ${m.redup}, wanted ${redup}`);
			cek(m.gerak === gerak, `${mesin} (${status}) motion ${m.gerak}, wanted ${gerak}`);
			if (!gerak) cek(m.amp === 0, `${mesin} (${status}) platen still moving (amp ${m.amp})`);
			else if (!info.kualitas.rendah) cek(m.amp > 0.9, `${mesin} (Production) platen not cycling (amp ${m.amp})`);
		}
		// Problem pulses: its lamp colour changes between samples.
		const warnaMerah = new Set();
		for (let i = 0; i < 6; i++) {
			warnaMerah.add(await p.evaluate(() => erp.lantai.aktif.info().mesin.find((m) => m.nama === "Mesin 04")?.warna));
			await p.waitForTimeout(110);
		}
		cek(warnaMerah.size >= 3, `Problem lamp does not pulse: ${[...warnaMerah].join(" ")}`);
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
		await p.screenshot({ path: join(HASIL, "lantai-13.png") });

		// Duplicate number 3 and an unknown number 99: both in the spare row, the real 03 stays in its slot.
		const dup = await p.evaluate(async () => {
			const d = await erp.lantai.ambil();
			d.mesin.push({ ...d.mesin[0], name: "Uji Ganda", nomor: 3 }, { ...d.mesin[0], name: "Uji 99", nomor: 99 });
			erp.lantai.aktif.perbarui(d);
			const m = erp.lantai.aktif.info().mesin;
			erp.lantai.aktif.perbarui({ mesin: [] });
			erp.lantai.aktif.perbarui({ mesin: null });
			await erp.lantai.aktif.muat();
			return { m, sesudah: erp.lantai.aktif.info().mesin.length };
		});
		const per = Object.fromEntries(dup.m.map((m) => [m.nama, m]));
		cek(per["Mesin 03"]?.slot === 3, `duplicate: Mesin 03 left its slot (${JSON.stringify(per["Mesin 03"])})`);
		for (const n of ["Uji Ganda", "Uji 99"])
			cek(per[n] && per[n].slot === null && per[n].z > 5, `duplicate: ${n} not in the spare row (${JSON.stringify(per[n])})`);
		cek(per["Uji Ganda"]?.x !== per["Uji 99"]?.x, "duplicate: two spare machines share a spot");
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
		const QTY = (Number(bom.quantity) || 1) * 4;
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
			const hasil = await p.evaluate(() => ({ kena: window.kena, img: erp.lantai.aktif.host.shadowRoot.querySelectorAll("img").length }));
			cek(hasil.kena === undefined, "xss: window.kena was set (record text ran as HTML)");
			cek(hasil.img === 0, `xss: ${hasil.img} <img> elements in the floor`);
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
				for (const e of l.getEntries()) if (e.startTime >= mulai) window.__lt.push(e.duration);
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
				panjang: window.__lt,
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
		cek(hasil.render.calls <= 60, `perf: draw calls ${hasil.render.calls} > 60`);
		cek(hasil.render.triangles <= 150000, `perf: triangles ${hasil.render.triangles} > 150000`);
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
		cek(info.mesin.every((m) => m.amp < 0.5), `adaptive: platens kept cycling after quality dropped (${info.mesin.map((m) => m.amp.toFixed(2)).join(" ")})`);
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
console.log(`OK: production-floor (${KASUS.length ? KASUS.join(", ") : "1 canvas, 1 context, 14 markers in floor order, states, 13-machines, no-webgl, label, pilih, status, wo, xss, set_value, poll, live, id, perf, adaptive"})`);
