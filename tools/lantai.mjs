// Browser check of the Production Floor page (/desk/lantai-produksi). Needs `bench start` and the sample users.
//
//   cd tools && npm install && npx playwright install chromium
//   ERP_SANDI=<password> node tools/lantai.mjs          # ERP_URL defaults to http://erp.localhost:8002
//
// Asserts: one canvas in the shadow root, no message dialog, one WebGL context after leaving and coming back
// 5 times, and 14 slot markers in floor order (front row 1..7, back row 14..8, left to right, back row above the
// front row on screen). Screenshot in tools/hasil/ (gitignored). Exit code 1 on any failure.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
const SANDI = process.env.ERP_SANDI;
const HASIL = join(dirname(fileURLToPath(import.meta.url)), "hasil");

if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (SAMPLE_PASSWORD in the bench's .env).");
	process.exit(2);
}
mkdirSync(HASIL, { recursive: true });

const gagal = [];
const cek = (syarat, pesan) => syarat || gagal.push(pesan);

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
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
	const akhir = await page.evaluate(() => ({
		konteks: erp.lantai.aktif.info().konteks,
		hitung: window.__konteks,
		kanvas: document.querySelector(".lantai-host")?.shadowRoot?.querySelectorAll("canvas").length,
	}));
	cek(akhir.konteks === 1, `info().konteks after 5 round trips: ${akhir.konteks}`);
	cek(akhir.hitung === 1, `WebGL contexts created by the browser: ${akhir.hitung}`);
	cek(akhir.kanvas === 1, `canvases after 5 round trips: ${akhir.kanvas}`);
}
cek(!galat.length, `console errors: ${galat.slice(0, 3).join(" | ").slice(0, 400)}`);

await browser.close();
if (gagal.length) {
	console.error("GAGAL:\n- " + gagal.join("\n- "));
	process.exit(1);
}
console.log("OK: lantai-produksi (1 canvas, 1 context, 14 markers in floor order)");
