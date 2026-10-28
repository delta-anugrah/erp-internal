// Browser check of the Production Floor page (/desk/lantai-produksi). Needs `bench start` and the sample users.
//
//   cd tools && npm install && npx playwright install chromium
//   ERP_SANDI=<password> node tools/lantai.mjs          # ERP_URL defaults to http://erp.localhost:8002
//
// Asserts: one canvas in the shadow root, no message dialog, one WebGL context after leaving and coming back
// 5 times, and 14 slot markers in floor order (front row 1..7, back row 14..8, left to right, back row above the
// front row on screen). Screenshot in tools/hasil/ (gitignored). Exit code 1 on any failure.
//
// Then, with the machines (pass case names to run only some: `node tools/lantai.mjs states perf`):
//   states       six statuses set through ubah_status on Mesin 01-06; lamps, pulse, dimming and motion read back
//                from info().mesin (statuses restored after)
//   13-machines  Mesin 05's erp_nomor set to 0 for the run (bench execute; restored after): 13 machines, slot 5
//                empty, no dialog; a duplicate and an unknown number land in the spare row
//   no-webgl     --disable-webgl: the plain table with 14 rows, no canvas, no dialog; the same when the bundle fails
//   perf         headed Chromium 1440x900 @2x: 10 s scripted orbit with two status changes, first 2 s dropped:
//                p95 <= 18.5 ms, max <= 50 ms, no long task, <= 60 draw calls, <= 150k triangles; 20 status
//                changes grow no geometry or texture
//   adaptive     CPU throttled 6x: pixel ratio 1 within 4 s, the reset button answers within 300 ms
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
await page.goto(`${URL}/desk/lantai-produksi`);
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
		await page.evaluate(() => frappe.set_route("lantai-produksi"));
		await page.waitForTimeout(700);
	}
	// While the page is hidden the loop must stand still; back on the page it must draw again.
	const total = () => page.evaluate(() => erp.lantai.aktif.info().total);
	await page.evaluate(() => frappe.set_route("Workspaces", "Manufacturing"));
	await page.waitForTimeout(500);
	const a1 = await total();
	await page.waitForTimeout(1000);
	cek((await total()) === a1, "frames kept drawing while the page was hidden");
	await page.evaluate(() => frappe.set_route("lantai-produksi"));
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
		frappe.set_route("lantai-produksi");
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
	await p3.goto(`${URL}/desk/lantai-produksi`);
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
	await p.goto(`${URL}/desk/lantai-produksi`, { waitUntil: "domcontentloaded", timeout: 60000 });
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
	const d = await api(p, "erp_internal.lantai.data", {}, false);
	return Object.fromEntries(d.mesin.filter((m) => nama.includes(m.name)).map((m) => [m.name, m.status || "Idle"]));
}
async function pulihkanStatus(p, asli) {
	for (const [mesin, status] of Object.entries(asli)) {
		try {
			await api(p, "erp_internal.lantai.ubah_status", { mesin, status });
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
			const baris = await api(p, "erp_internal.lantai.ubah_status", { mesin, status });
			cek(baris?.status === status, `ubah_status ${mesin} → ${status} answered ${JSON.stringify(baris)?.slice(0, 120)}`);
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
			ubah(5);
		} catch (e) {
			gagal.push(`could not restore Mesin 05's erp_nomor to 5: ${e.message}`);
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
		await p.goto(`${URL}/desk/lantai-produksi`);
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

// --- perf: headed, real GPU -------------------------------------------------------------------------------------
if (jalankan("perf")) {
	const nyata = await chromium.launch({ headless: false });
	const ctx = await konteksMasuk(nyata, { deviceScaleFactor: 2 });
	const p = await bukaLantai(ctx);
	const asli = await catatStatus(p, ["Mesin 07", "Mesin 08"]);
	try {
		await p.waitForTimeout(1000);
		await p.evaluate(() => {
			window.__ft = [];
			window.__lt = [];
			const mulai = performance.now();
			window.__mulai = mulai;
			new PerformanceObserver((l) => {
				for (const e of l.getEntries()) if (e.startTime >= mulai) window.__lt.push(e.duration);
			}).observe({ type: "longtask", buffered: true });
			let akhir = 0;
			const ukur = (t) => {
				if (akhir) window.__ft.push([t - mulai, t - akhir]);
				akhir = t;
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
		const janji = [];
		while (Date.now() - t0 < 10000) {
			const t = (Date.now() - t0) / 1000;
			await p.mouse.move(cx + Math.sin(t * 0.9) * 300, cy + Math.sin(t * 0.5) * 40);
			while (ubah.length && Date.now() - t0 >= ubah[0][0]) {
				const [, mesin, status] = ubah.shift();
				janji.push(api(p, "erp_internal.lantai.ubah_status", { mesin, status }).then(() => p.evaluate(() => erp.lantai.aktif.muat())));
			}
			await p.waitForTimeout(8);
		}
		await p.mouse.up();
		await Promise.all(janji);
		const hasil = await p.evaluate(() => {
			window.__berhenti = true;
			const ft = window.__ft.filter(([t]) => t >= 2000).map(([, d]) => d).sort((a, b) => a - b);
			const info = erp.lantai.aktif.info();
			return {
				n: ft.length,
				p95: ft[Math.floor(ft.length * 0.95)],
				max: ft[ft.length - 1],
				median: ft[Math.floor(ft.length / 2)],
				lambat: window.__ft.filter(([t, d]) => t >= 2000 && d > 18.5).map(([t, d]) => `${(t / 1000).toFixed(2)}s:${d.toFixed(1)}`),
				panjang: window.__lt,
				render: info.render,
				memory: info.memory,
				kualitas: info.kualitas,
				mesin: info.mesin.filter((m) => ["Mesin 07", "Mesin 08"].includes(m.nama)).map((m) => [m.nama, m.status]),
			};
		});
		console.log(`perf: ${hasil.n} frames, median ${hasil.median?.toFixed(2)} ms, p95 ${hasil.p95?.toFixed(2)} ms, max ${hasil.max?.toFixed(2)} ms, long tasks ${hasil.panjang.length}, draw calls ${hasil.render.calls}, triangles ${hasil.render.triangles}, pixel ratio ${hasil.kualitas.rasio}${hasil.kualitas.rendah ? " (lowered)" : ""}`);
		if (process.env.ERP_RINCI) console.log(`perf: frames over 18.5 ms: ${hasil.lambat.join(" ")}`);
		cek(hasil.n > 300, `perf: only ${hasil.n} frames in 8 s`);
		cek(hasil.p95 <= 18.5, `perf: p95 ${hasil.p95?.toFixed(2)} ms > 18.5`);
		cek(hasil.max <= 50, `perf: max ${hasil.max?.toFixed(2)} ms > 50`);
		cek(hasil.panjang.length === 0, `perf: long tasks ${JSON.stringify(hasil.panjang)}`);
		cek(hasil.render.calls <= 60, `perf: draw calls ${hasil.render.calls} > 60`);
		cek(hasil.render.triangles <= 150000, `perf: triangles ${hasil.render.triangles} > 150000`);
		cek(!hasil.kualitas.rendah, "perf: adaptive quality dropped on this machine");
		cek(
			JSON.stringify(hasil.mesin) === JSON.stringify([["Mesin 07", "Problem"], ["Mesin 08", "Maintenance"]]),
			`perf: status changes not shown: ${JSON.stringify(hasil.mesin)}`
		);
		await p.screenshot({ path: join(HASIL, "lantai-perf.png") });

		// 20 status changes on the page: no new geometry or texture.
		const memori = await p.evaluate(async () => {
			const STATUS = ["Production", "Off", "Idle", "Problem", "Maintenance", "Setup"];
			const d = await erp.lantai.ambil();
			const awal = { ...erp.lantai.aktif.info().memory };
			for (let i = 0; i < 20; i++) {
				d.mesin[i % d.mesin.length].status = STATUS[i % STATUS.length];
				erp.lantai.aktif.perbarui(d);
				await new Promise((r) => setTimeout(r, 120));
			}
			await erp.lantai.aktif.muat();
			return { awal, akhir: { ...erp.lantai.aktif.info().memory } };
		});
		console.log(`perf: memory before ${JSON.stringify(memori.awal)}, after 20 changes ${JSON.stringify(memori.akhir)}`);
		cek(memori.akhir.geometries <= memori.awal.geometries, `perf: geometries grew ${memori.awal.geometries} → ${memori.akhir.geometries}`);
		cek(memori.akhir.textures <= memori.awal.textures, `perf: textures grew ${memori.awal.textures} → ${memori.akhir.textures}`);

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
		await pulihkanStatus(p, asli);
	}
	await nyata.close();
}

// --- adaptive quality under a 6x slower CPU ---------------------------------------------------------------------
if (jalankan("adaptive")) {
	const nyata = await chromium.launch({ headless: false });
	const ctx = await konteksMasuk(nyata, { deviceScaleFactor: 2 });
	const p = await bukaLantai(ctx);
	await p.waitForTimeout(500);
	const { kualitas: sebelum, kamera: kameraAwal } = await p.evaluate(() => erp.lantai.aktif.info());
	cek(sebelum.rasio === 2 && !sebelum.rendah, `adaptive: quality before throttling ${JSON.stringify(sebelum)}`);
	// The scene's own frame work is too light to slow down even at 20x, so a slow laptop is stood in for by a fixed
	// amount of other main-thread work per frame: ~4 ms on this CPU (still 60 fps), ~24 ms once throttled 6x.
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
		return Math.round((k / 100) * 4);
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
		b.addEventListener("click", () => requestAnimationFrame((t) => (window.__selesai = t)), { once: true });
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
	await nyata.close();
}

cek(!galat.length, `console errors: ${galat.slice(0, 3).join(" | ").slice(0, 400)}`);

await browser.close();
if (gagal.length) {
	console.error("GAGAL:\n- " + gagal.join("\n- "));
	process.exit(1);
}
console.log(`OK: lantai-produksi (${KASUS.length ? KASUS.join(", ") : "1 canvas, 1 context, 14 markers in floor order, states, 13-machines, no-webgl, perf, adaptive"})`);
