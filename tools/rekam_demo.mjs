// Records a demo video of one profile's work on erp.localhost, like a person at the keyboard: a drawn cursor that
// glides on curves and pauses before it clicks, typing one key at a time, a soft zoom onto what matters, and a
// caption bar at the bottom. The script of each video (captions and the voice-over text) is in docs/video/.
//
//   ERP_SANDI=<SAMPLE_PASSWORD> node tools/rekam_demo.mjs <video> [out.mp4]   # e.g. lengkap-a1-admin-mulai; default ~/Desktop/demo-<video>.mp4
//
// Needs `bench start`, the sample data (contoh.py) and ffmpeg. The page is 1440x810 CSS px at 1x and encoded to
// 1920x1080 H.264. Headless Chromium's screencast sends 1440x810 frames whatever the device scale factor, so 2x only
// made the browser work harder (the Production Floor's video fell to 7-15 frames a second on a busy laptop); the zoom
// is a CSS transform, so zoomed text is still drawn sharp. The user's language is switched to Indonesian for the take
// and back to what it was after; what the take records is cancelled again at the end.
// Captions here must match docs/video/<name>.md.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
// `node --env-file=<bench>/.env` passes SAMPLE_PASSWORD without typing it on the command line.
const SANDI = process.env.ERP_SANDI || process.env.SAMPLE_PASSWORD;
const NAMA = process.argv[2] || "produksi";
const KELUAR = process.argv[3] || join(homedir(), "Desktop", `demo-${NAMA}.mp4`);
if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (SAMPLE_PASSWORD in the bench's .env).");
	process.exit(2);
}

const acak = (a, b) => a + Math.random() * (b - a);
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// Drawn cursor and caption bar live on <html>, outside <body>, so the zoom (a transform on <body>) leaves them as
// they are; the cursor follows the real mouse events Playwright sends.
const LAPISAN = `
(() => {
	const pasang = () => {
		if (document.getElementById("demo-kursor")) return;
		const k = document.createElement("div");
		k.id = "demo-kursor";
		k.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 11-7 1.2 4.2 7.3-2.6 1.5-4.2-7.3L4 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
		Object.assign(k.style, { position: "fixed", left: "0", top: "0", zIndex: 2147483647, pointerEvents: "none",
			transform: "translate(" + (sessionStorage.kx || 720) + "px," + (sessionStorage.ky || 405) + "px)", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" });
		document.documentElement.appendChild(k);
		document.addEventListener("mousemove", (e) => {
			sessionStorage.kx = e.clientX; sessionStorage.ky = e.clientY;
			k.style.transform = "translate(" + (e.clientX - 3) + "px," + (e.clientY - 2) + "px)";
		}, true);
		document.addEventListener("mousedown", (e) => {
			const r = document.createElement("div");
			Object.assign(r.style, { position: "fixed", left: e.clientX - 18 + "px", top: e.clientY - 18 + "px", width: "36px", height: "36px",
				borderRadius: "50%", border: "3px solid rgba(37,99,235,.75)", zIndex: 2147483646, pointerEvents: "none",
				transition: "transform .45s ease-out, opacity .45s ease-out" });
			document.documentElement.appendChild(r);
			requestAnimationFrame(() => { r.style.transform = "scale(1.8)"; r.style.opacity = "0"; });
			setTimeout(() => r.remove(), 500);
		}, true);
		const t = document.createElement("div");
		t.id = "demo-teks";
		Object.assign(t.style, { position: "fixed", left: "50%", bottom: "34px", transform: "translateX(-50%)", zIndex: 2147483646,
			pointerEvents: "none", maxWidth: "1100px", padding: "12px 26px", borderRadius: "14px", background: "rgba(15,23,42,.84)",
			color: "#fff", font: "600 24px/1.35 Inter, system-ui, sans-serif", textAlign: "center", opacity: "0", transition: "opacity .35s ease" });
		document.documentElement.appendChild(t);
		if (sessionStorage.teks) { t.textContent = sessionStorage.teks; t.style.opacity = "1"; }
		// Blank room under the page, so an element at the very bottom can still scroll to the middle of the screen.
		const ruang = document.createElement("div");
		ruang.id = "demo-ruang";
		ruang.style.height = "60vh";
		// Desk v16 scrolls .main-section, not the window: the room goes at the end of whichever box scrolls.
		const tambah = () => {
			const kotak = document.querySelector(".main-section") || document.body;
			if (kotak && kotak.lastElementChild !== ruang) kotak.appendChild(ruang);
		};
		tambah();
		new MutationObserver(tambah).observe(document.documentElement, { childList: true, subtree: true });
	};
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pasang); else pasang();
})();`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
await ctx.addInitScript(LAPISAN);
// HR's check-in form asks for the location: the take's browser shares a fixed one (the factory's city).
await ctx.grantPermissions(["geolocation"], { origin: URL });
await ctx.setGeolocation({ latitude: -6.12, longitude: 106.79 });
const page = await ctx.newPage();
const galat = [];
page.on("pageerror", (e) => galat.push(String(e)));
// An alert would block every later step; leaving an unsaved form (beforeunload) is allowed.
page.on("dialog", (d) => (d.type() === "beforeunload" ? d.accept() : d.dismiss()).catch(() => {}));
// shortcut: ERPNext's print view asks for the company's missing website, phone, email and address whenever its
// "Company Letterhead" is the letter head; the sample company has none yet (they wait for Samuel's PO header), so
// the take answers "nothing missing". Remove once the Company has them.
await page.route("**/api/method/erpnext.controllers.accounts_controller.get_missing_company_details*", (r) =>
	r.fulfill({ contentType: "application/json", body: '{"message": null}' })
);
const awalProses = Date.now();

const api = (method, args = {}) =>
	page.evaluate(
		([m, a]) => frappe.xcall(m, a).then((x) => ({ ok: true, x })).catch((e) => ({ ok: false, e: String(e?.message || e) })),
		[method, args]
	);

// --- the hand: mouse, keys, zoom, captions ------------------------------------------------------------------------
let pos = { x: 720, y: 405 };
// One hand movement: duration from Fitts' law (far = longer, but not linearly), a minimum-jerk speed profile (slow
// start, fast middle, gentle landing), a slightly bowed path, and on a long move a small overshoot that is corrected
// by a short second movement, as a real hand does. Time-driven, so the speed does not depend on how fast the browser
// answers each move.
async function sapuan(x, y, ms, lengkungMaks) {
	const awal = { ...pos };
	const dx = x - awal.x;
	const dy = y - awal.y;
	const jarak = Math.hypot(dx, dy) || 1;
	const nx = -dy / jarak;
	const ny = dx / jarak;
	const b1 = acak(-lengkungMaks, lengkungMaks) * jarak;
	const b2 = b1 * acak(0.4, 0.9);
	const c1 = { x: awal.x + dx * 0.3 + nx * b1, y: awal.y + dy * 0.3 + ny * b1 };
	const c2 = { x: awal.x + dx * 0.75 + nx * b2, y: awal.y + dy * 0.75 + ny * b2 };
	const mulaiGerak = Date.now();
	for (;;) {
		const t = Math.min(1, (Date.now() - mulaiGerak) / ms);
		const e = t * t * t * (10 - 15 * t + 6 * t * t);
		const u = 1 - e;
		await page.mouse.move(
			u ** 3 * awal.x + 3 * u * u * e * c1.x + 3 * u * e * e * c2.x + e ** 3 * x,
			u ** 3 * awal.y + 3 * u * u * e * c1.y + 3 * u * e * e * c2.y + e ** 3 * y
		);
		if (t >= 1) break;
		await tidur(14);
	}
	pos = { x, y };
}
async function gerak(x, y) {
	const jarak = Math.hypot(x - pos.x, y - pos.y);
	if (jarak < 2) return;
	const ms = (260 + 170 * Math.log2(jarak / 30 + 1)) * acak(0.9, 1.15);
	if (jarak > 250) {
		const lebih = acak(0.025, 0.05);
		await sapuan(x + (x - pos.x) * lebih, y + (y - pos.y) * lebih, ms, 0.12);
		await tidur(acak(40, 90));
		await sapuan(x, y, acak(160, 240), 0.05);
	} else await sapuan(x, y, ms, 0.1);
	await tidur(acak(80, 160));
}
// Scroll smoothly until the element sits in the middle of the area above the caption bar, only when it is not
// already comfortably there (a zoom keeps the element in frame only if it starts away from the page's lower edge).
async function keTengah(loc) {
	await loc.waitFor({ state: "attached", timeout: 20000 }).catch(() => {});
	const geser = await loc
		.evaluate((e, bawah) => {
			const r = e.getBoundingClientRect();
			const area = innerHeight - bawah;
			if (r.top >= 60 && r.bottom <= area - 60) return 0;
			// Desk scrolls an inner box, not the window: scrollIntoView moves whichever ancestor scrolls.
			e.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
			return r.top + r.height / 2 - area / 2;
		}, BAWAH)
		.catch(() => 0);
	if (geser) await tidur(Math.min(900, 300 + Math.abs(geser)));
}
async function kotak(loc) {
	await loc.waitFor({ state: "visible", timeout: 20000 });
	return loc.boundingBox();
}
// While zoomed, a target outside the frame moves the zoom onto it first (same scale), so the cursor never points at
// something off screen; it is a framing failure only if it is still out after that.
async function ke(loc) {
	if (!terzoom) await keTengah(loc);
	await kotak(loc);
	if (terzoom && !(await diBingkai(loc, "probe"))) {
		masalah.pop(); // the probe's own entry: the zoom below decides
		await zoom(loc, skalaTerakhir);
	}
	await diBingkai(loc, "pointed at");
	const k = await loc.boundingBox();
	await gerak(k.x + k.width * acak(0.35, 0.6), k.y + k.height * acak(0.4, 0.6));
}
async function klik(loc) {
	await ke(loc);
	await tidur(acak(350, 650));
	await page.mouse.down();
	await tidur(acak(60, 110));
	await page.mouse.up();
}
async function ketik(teks) {
	await tidur(1000); // a person looks at the field a moment before typing (Abel 2026-11-27)
	for (const h of teks) {
		await page.keyboard.type(h);
		await tidur(h === " " ? acak(150, 260) : acak(80, 180));
	}
}
// Zoom the page onto a locator (scale > 1) or back out (no locator). The element's centre goes to the middle of the
// screen, but the zoomed view never runs past the page's edge (a sidebar at the left edge stays whole): the visible
// window [L, L + W/s] is clamped to [0, W], and the transform origin follows from it (o = L / (1 - 1/s)).
// The element always ends up wholly in frame: the scale shrinks until it fits with 10 % to spare, above the caption
// bar (BAWAH px). A zoom from an already zoomed view first zooms out, so the element is measured unscaled.
// After every zoom the element is measured again: one outside the frame or under the caption bar is a failure of the
// take (`masalah`), reported at the end with a non-zero exit, so a video with a lost element is never used.
const BAWAH = 110;
let terzoom = false;
let skalaTerakhir = 1.5;
const masalah = [];
async function diBingkai(loc, apa) {
	const k = await loc.boundingBox();
	const v = page.viewportSize();
	let ok = false;
	if (k) {
		const dalam = k.x >= -2 && k.y >= -2 && k.x + k.width <= v.width + 2 && k.y + k.height <= v.height + 2;
		let tertutup = false;
		if (k.y + k.height > v.height - BAWAH + 2) {
			// The bottom band is lost only where the caption box is (it is centred); the user button at the
			// sidebar's foot sits beside it.
			const t = await page.evaluate(() => {
				const e = document.getElementById("demo-teks");
				if (!e || e.style.opacity === "0" || !e.textContent) return null;
				const r = e.getBoundingClientRect();
				return { kiri: r.left - 12, kanan: r.right + 12 };
			});
			tertutup = Boolean(t) && k.x < t.kanan && k.x + k.width > t.kiri;
		}
		ok = dalam && !tertutup;
	}
	if (!ok) masalah.push(`${apa}: ${loc} at ${JSON.stringify(k && { x: Math.round(k.x), y: Math.round(k.y), w: Math.round(k.width), h: Math.round(k.height) })}`);
	return ok;
}
async function zoom(loc, skala = 1.5, ms = 900) {
	if (loc && terzoom) await zoom(null, 1, Math.round(ms * 0.7));
	if (loc) await keTengah(loc);
	const k = loc ? await kotak(loc) : null;
	if (k) {
		const v = page.viewportSize();
		const muat = Math.min((v.width * 0.9) / k.width, ((v.height - BAWAH) * 0.9) / k.height);
		if (muat < 1.05) {
			await diBingkai(loc, "too big to zoom");
			return; // already fills the screen: no zoom
		}
	}
	await page.evaluate(
		([k, skala, ms, bawah]) => {
			const b = document.body;
			b.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`;
			if (!k) {
				b.style.transform = "none";
				return;
			}
			const tinggi = innerHeight - bawah;
			const s = Math.max(1.05, Math.min(skala, (innerWidth * 0.9) / k.width, (tinggi * 0.9) / k.height));
			// Visible window's start L puts the centre in the middle of `area`, kept inside the page [0, layar - layar/s].
			const sumbu = (pusat, area, layar) => {
				const kiri = Math.min(Math.max(pusat - area / (2 * s), 0), layar - layar / s);
				return kiri / (1 - 1 / s);
			};
			const ox = sumbu(k.x + k.width / 2, innerWidth, innerWidth) + scrollX;
			const oy = sumbu(k.y + k.height / 2, tinggi, innerHeight) + scrollY;
			b.style.transformOrigin = `${ox}px ${oy}px`;
			b.style.transform = `scale(${s})`;
		},
		[k, skala, ms, BAWAH]
	);
	terzoom = Boolean(k);
	if (k) skalaTerakhir = skala;
	await tidur(ms + 150);
	if (loc) await diBingkai(loc, "zoom");
}
// The voice-over: each caption's narration is the "Narasi" cell of the row with that "Teks layar" in
// docs/video/<NAMA>.md, spoken by edge-tts (voice SUARA at TEMPO, cached in ~/.cache/rekam-demo-suara) one sentence
// at a time: `teks(caption)` speaks the row's first sentence, each `lalu()` the next one, right before the action it
// describes, so the voice says what the screen shows. A sentence waits until the previous one has finished; a new
// caption first speaks what is left of the previous row. Mixed in at each sentence's second by `akhiri`.
const SUARA = process.env.ERP_SUARA || "id-ID-ArdiNeural";
const TEMPO = process.env.ERP_TEMPO || "-10%";
const EDGE_TTS = process.env.EDGE_TTS || join(homedir(), ".local/share/edge-tts-venv/bin/edge-tts");
const NASKAH = new Map(); // caption → [{ teks, berkas, detik }] one per sentence
const narasi = []; // { berkas, t } with t the wall clock second the sentence starts
let selesaiSuara = 0; // wall clock ms the current sentence ends
let sisaKalimat = []; // the current row's sentences not yet spoken
const TANPA_SUARA = process.env.ERP_TANPA_SUARA === "1";
// Splits at ". ", "? ", "! " (a number like 1.250 has no space after its dot).
const kalimat = (s) => s.split(/(?<=[.?!])\s+/).filter(Boolean);
function suaraUntuk(ucapan, tembolok) {
	const kunci = createHash("sha1").update(`${SUARA}|${TEMPO}|${ucapan}`).digest("hex").slice(0, 16);
	const berkas = join(tembolok, `${kunci}.mp3`);
	if (!existsSync(berkas)) {
		// Written aside and renamed once whole: a dropped connection leaves no broken file in the cache.
		const sementara = `${berkas}.tmp.mp3`;
		execFileSync(EDGE_TTS, ["--voice", SUARA, `--rate=${TEMPO}`, "--text", ucapan, "--write-media", sementara]);
		renameSync(sementara, berkas);
	}
	const detik = TANPA_SUARA ? 0 : Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", berkas]).toString());
	return { teks: ucapan, berkas, detik };
}
function siapkanNaskah(nama) {
	const md = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "video", `${nama}.md`);
	if (!existsSync(md)) return;
	const tembolok = join(homedir(), ".cache", "rekam-demo-suara");
	mkdirSync(tembolok, { recursive: true });
	for (const baris of readFileSync(md, "utf8").split("\n")) {
		const sel = baris.split("|").map((s) => s.trim());
		// | No | Detik | Di layar | Teks layar | Narasi |
		if (sel.length < 7 || !/^\d+$/.test(sel[1])) continue;
		// Without voice the sentences are still counted (a dry run catches a missing `lalu()`), never synthesised.
		NASKAH.set(sel[4], kalimat(sel[5]).map((k) => (TANPA_SUARA ? { teks: k, detik: 0 } : suaraUntuk(k, tembolok))));
	}
	const semua = [...NASKAH.values()].flat();
	console.log(`narration: ${NASKAH.size} rows, ${semua.length} sentences, ${semua.reduce((a, n) => a + n.detik, 0).toFixed(0)} s of voice`);
}
async function tungguSuara() {
	const sisa = selesaiSuara - Date.now();
	if (sisa > 0) await tidur(sisa);
}
async function ucapkan(k) {
	await tungguSuara();
	if (k.berkas) narasi.push({ berkas: k.berkas, t: Date.now() / 1000 + 0.15 });
	selesaiSuara = Date.now() + 150 + k.detik * 1000 + 300;
}
// The current row's next sentence, spoken as the action it describes starts.
async function lalu() {
	const k = sisaKalimat.shift();
	if (!k) throw new Error(`lalu(): no sentence left in this row of docs/video/${NAMA}.md`);
	await ucapkan(k);
}
// Chapters for the table of contents (`daftarIsi`) and the MP4's chapter marks: `bab(title)` right before the
// chapter's first caption.
const babList = [];
let tSisip = null; // wall clock second the table of contents card goes in
function bab(judul) {
	babList.push({ judul, t: Date.now() / 1000 });
}
// Marks where the table of contents card goes (after the welcome); the card itself is drawn after the take, once
// every chapter's minute is known, and spliced into the video there (`akhiri`).
async function daftarIsi() {
	while (sisaKalimat.length) await lalu();
	await tungguSuara();
	await teks("");
	tSisip = Date.now() / 1000;
}
async function teks(isi) {
	while (sisaKalimat.length) await lalu();
	await tungguSuara();
	if (isi && NASKAH.size) {
		const k = NASKAH.get(isi);
		if (!k) throw new Error(`caption not in docs/video/${NAMA}.md: ${isi}`);
		sisaKalimat = [...k];
		await lalu();
	}
	if (isi) console.log(`[${((Date.now() - awalProses) / 1000).toFixed(0)}s] ${isi}`);
	const pasang = (isi) => {
		const t = document.getElementById("demo-teks");
		sessionStorage.teks = isi || "";
		if (!t) return;
		if (!isi) {
			t.style.opacity = "0";
			return;
		}
		t.style.opacity = "0";
		setTimeout(() => {
			t.textContent = isi;
			t.style.opacity = "1";
		}, 200);
	};
	// A caption set while a click's page load is under way loses its page: set it again on the new one.
	await page.evaluate(pasang, isi).catch(async () => {
		await page.waitForLoadState("domcontentloaded").catch(() => {});
		await page.evaluate(pasang, isi);
	});
	await tidur(450);
}
async function tunggu(ms = 600) {
	await page.waitForLoadState("networkidle").catch(() => {});
	await tidur(ms);
}

// --- the screencast ----------------------------------------------------------------------------------------------
const FOLDER = mkdtempSync(join(tmpdir(), "rekam-demo-"));
const bingkai = [];
let cdp;
async function mulaiRekam() {
	cdp = await ctx.newCDPSession(page);
	cdp.on("Page.screencastFrame", async (f) => {
		const nama = join(FOLDER, `f${String(bingkai.length).padStart(6, "0")}.jpg`);
		bingkai.push({ t: f.metadata.timestamp, nama });
		writeFileSync(nama, Buffer.from(f.data, "base64"));
		await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
	});
	await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1440, maxHeight: 810, everyNthFrame: 1 });
}
const menit = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
// The table of contents card: the welcome's last frame blurred behind a list of chapters with their minute, drawn
// by the browser at the frames' size (ffmpeg's concat needs every image the same size).
async function gambarDaftarIsi(latar, daftar) {
	const kertas = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
	const isi = daftar.map((b) => `<li><b>${menit(b.detik)}</b><span>${b.judul.replace(/[<&]/g, "")}</span></li>`).join("");
	await kertas.setContent(`<body style="margin:0;height:100vh;overflow:hidden;font-family:Inter,system-ui,sans-serif">
		<div style="position:fixed;inset:-40px;background:url(data:image/jpeg;base64,${readFileSync(latar).toString("base64")}) center/cover;filter:blur(18px) brightness(.55)"></div>
		<div style="position:relative;height:100%;display:grid;place-items:center">
		<div style="min-width:620px;padding:40px 56px;border-radius:24px;background:rgba(15,23,42,.88);color:#fff;box-shadow:0 20px 60px #0006">
		<div style="font-size:40px;font-weight:700;margin-bottom:8px">Daftar isi</div>
		<div style="font-size:21px;opacity:.75;margin-bottom:24px">Geser ke menit bagian yang Anda perlukan</div>
		<ol style="list-style:none;margin:0;padding:0;font-size:28px;font-weight:500;line-height:1.25">${isi}</ol></div></div>
		<style>li{display:flex;gap:28px;padding:9px 0;border-top:1px solid rgba(255,255,255,.12)}b{min-width:84px;color:#93c5fd;font-variant-numeric:tabular-nums}</style></body>`);
	const berkas = join(FOLDER, "daftar-isi.jpg");
	await kertas.screenshot({ path: berkas, type: "jpeg", quality: 92 });
	await kertas.close();
	return berkas;
}
// Encodes the frames, splices in the table of contents card (`daftarIsi`) and mixes in the narration; the MP4 gets
// chapter marks and <video>.bab.txt the same list ("0:00 Title" lines, as YouTube reads them in a description).
async function selesaiRekam() {
	const akhir = Date.now() / 1000;
	await cdp.send("Page.stopScreencast");
	const awal = bingkai[0].t;
	const entri = bingkai.map((f, i) => ({ nama: f.nama, t: f.t, dur: Math.max(0.001, (i + 1 < bingkai.length ? bingkai[i + 1].t : akhir) - f.t) }));
	// Card length: its sentence plus time to read the list.
	const suaraIsi = NASKAH.get("Daftar isi") || [];
	const D = tSisip ? Math.max(8, suaraIsi.reduce((a, k) => a + k.detik, 0) + 3.5) : 0;
	const geser = (t) => t - awal + (tSisip && t >= tSisip ? D : 0); // wall clock → second in the final video
	const daftarBab = [{ judul: "Pembukaan", detik: 0 }, ...babList.map((b) => ({ judul: b.judul, detik: geser(b.t) }))];
	if (tSisip) {
		const i = Math.max(0, entri.findLastIndex((e) => e.t <= tSisip));
		const e = entri[i];
		const sisa = e.t + e.dur - tSisip;
		e.dur = Math.max(0.001, tSisip - e.t);
		const kartu = await gambarDaftarIsi(e.nama, daftarBab);
		entri.splice(i + 1, 0, { nama: kartu, dur: D }, { nama: e.nama, dur: Math.max(0.001, sisa) });
		let t = tSisip - awal + 0.6;
		for (const k of suaraIsi) {
			if (k.berkas) narasi.push({ berkas: k.berkas, detik: t });
			t += k.detik + 0.3;
		}
	}
	let daftar = "";
	for (const e of entri) daftar += `file '${e.nama}'\nduration ${e.dur.toFixed(4)}\n`;
	daftar += `file '${entri.at(-1).nama}'\n`;
	writeFileSync(join(FOLDER, "frames.txt"), daftar);
	const video = join(FOLDER, "video.mp4");
	execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(FOLDER, "frames.txt"),
		"-vf", "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17", video]);
	const total = entri.reduce((a, e) => a + e.dur, 0);
	let meta = ";FFMETADATA1\n";
	daftarBab.forEach((b, i) => {
		const ujung = i + 1 < daftarBab.length ? daftarBab[i + 1].detik : total;
		meta += `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(b.detik * 1000)}\nEND=${Math.round(ujung * 1000)}\ntitle=${b.judul}\n`;
	});
	writeFileSync(join(FOLDER, "bab.txt"), meta);
	const suara = narasi.map((n) => ({ berkas: n.berkas, detik: n.detik ?? geser(n.t) }));
	const masukan = ["-i", video, "-i", join(FOLDER, "bab.txt"), ...suara.flatMap((n) => ["-i", n.berkas])];
	const peta = ["-map", "0:v", "-map_chapters", "1"];
	let saring = [];
	if (suara.length) {
		saring = suara.map((n, i) => {
			const ms = Math.max(0, Math.round(n.detik * 1000));
			return `[${i + 2}:a]adelay=${ms}|${ms}[a${i}]`;
		});
		saring.push(`${suara.map((_, i) => `[a${i}]`).join("")}amix=inputs=${suara.length}:normalize=0:dropout_transition=0[a]`);
		peta.push("-map", "[a]", "-c:a", "aac", "-b:a", "160k");
	}
	execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...masukan, ...(saring.length ? ["-filter_complex", saring.join(";")] : []),
		...peta, "-c:v", "copy", "-movflags", "+faststart", KELUAR]);
	writeFileSync(KELUAR.replace(/\.mp4$/, "") + ".bab.txt", daftarBab.map((b) => `${menit(b.detik)} ${b.judul}`).join("\n") + "\n");
	console.log(`chapters:\n${daftarBab.map((b) => `  ${menit(b.detik)} ${b.judul}`).join("\n")}`);
	return { bingkai: bingkai.length, detik: total.toFixed(1) };
}

// --- the videos ----------------------------------------------------------------------------------------------------
async function produksi() {
	const r = await page.request.post(`${URL}/api/method/login`, { form: { usr: "user@example.com", pwd: SANDI } });
	if (!r.ok()) throw new Error(`login ${r.status()}`);
	await page.goto(`${URL}/desk`);
	await tunggu();
	// An open Seal Cap order on Mesin 04 (the take types its output); found, not assumed.
	const wo = await api("frappe.client.get_list", {
		doctype: "Work Order",
		filters: { production_item: ["like", "SEAL-CAP-%"], erp_mesin: "Mesin 04", docstatus: 1, status: ["in", ["Not Started", "In Process"]] },
		order_by: "creation desc",
		limit_page_length: 1,
		fields: ["name"],
	});
	const WO_SEAL = wo.x?.[0]?.name;
	if (!WO_SEAL) throw new Error("No open Seal Cap Work Order on Mesin 04: make one first (docs/video/produksi.md).");
	// What the take changes, to put back exactly as it was.
	const bahasaAsli = await page.evaluate(() => frappe.boot.lang || "en");
	const statusAsli = (await api("frappe.client.get_value", { doctype: "Workstation", filters: "Mesin 05", fieldname: "status" })).x?.status;
	await api("erp_internal.bahasa.ganti", { lang: "id" });
	const mulai = await page.evaluate(() => frappe.datetime.now_datetime());
	const hari = await page.evaluate(() => frappe.datetime.get_today());
	try {
		await page.goto(`${URL}/desk/manufacturing`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(800);

		// 1. The menu.
		await teks("Produksi cuma lihat 3 menu: Production Floor, Daily Input, dan Manufacturing");
		const menu = page.locator(".body-sidebar, .layout-side-section").first();
		await zoom(menu, 1.6);
		await ke(page.locator('.body-sidebar a[href*="production-floor"]').first());
		await tidur(700);
		await ke(page.locator('.body-sidebar a[href*="daily-input"]').first());
		await tidur(1200);
		await zoom(null);

		// 2. The floor.
		await klik(page.locator('.body-sidebar a[href*="production-floor"]').first());
		await teks("Production Floor: semua mesin dan statusnya, langsung dari data");
		await page.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 30000 });
		await tunggu(3500);
		await ke(page.locator('tr[data-mesin="Mesin 02"]'));
		await tidur(900);
		await ke(page.locator('tr[data-mesin="Mesin 04"]'));
		await tidur(1500);

		// 3. A machine's status.
		await teks("Mesin bermasalah? Klik mesinnya, lalu pilih Problem");
		await klik(page.locator('tr[data-mesin="Mesin 05"]'));
		await tidur(1800);
		await klik(page.locator('button[data-status="Problem"]').first());
		await tidur(3500);
		await teks("Sudah normal lagi? Pilih Production");
		await klik(page.locator('button[data-status="Production"]').first());
		await tidur(2500);
		await page.keyboard.press("Escape");
		await tidur(800);

		// 4. Daily Input.
		await teks("Daily Input: pengganti Excel harian, bentuknya sama");
		await page.goto(`${URL}/desk/manufacturing/daily-input`);
		await page.waitForSelector(`section[data-wo="${WO_SEAL}"]`, { timeout: 30000 });
		await tunggu(1500);
		await ke(page.locator(`section[data-wo="${WO_SEAL}"]`));
		await tidur(1500);

		// 5. The technician.
		await teks("Isi nama teknisi sekali, dipakai terus untuk shift itu");
		const teknisi = page.locator(".erp-ih-teknisi").first();
		await zoom(teknisi, 1.6);
		await klik(teknisi);
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.press("Backspace");
		await ketik("Yudi");
		await page.keyboard.press("Tab");
		await tidur(900);
		await zoom(null);

		// 6-7. Shift 1 and its TOTAL.
		const blok = page.locator(`section[data-wo="${WO_SEAL}"]`);
		const shift1 = blok.locator(`input[data-key="${hari}|Shift 1"]`);
		await teks("Ketik jumlah barang bagus, lalu pindah kotak: langsung tersimpan");
		await zoom(shift1, 1.7);
		await klik(shift1);
		await ketik("1.000");
		await page.keyboard.press("Tab");
		await tidur(1800);
		await teks("TOTAL dan stok barang jadi ikut naik sendiri");
		await ke(blok.locator(".erp-ih-semua"));
		await tidur(2500);
		await zoom(null);

		// 8. Shift 2.
		const shift2 = blok.locator(`input[data-key="${hari}|Shift 2"]`);
		await teks("Shift malam juga sama");
		await klik(shift2);
		await ketik("950");
		await page.keyboard.press("Tab");
		await tidur(2200);

		// 9. A reject.
		await teks("Barang cacat dicatat di form Production Entry, lengkap dengan alasannya");
		await page.goto(`${URL}/desk/manufacturing/production-entry/new`);
		await page.waitForFunction(() => window.cur_frm?.doctype === "Production Entry" && cur_frm.doc.__islocal, null, { timeout: 30000 });
		await tunggu(1200);
		const wo = page.locator('[data-fieldname="work_order"] input').first();
		await klik(wo);
		await ketik(WO_SEAL);
		await tidur(900);
		await page.keyboard.press("Escape");
		await page.keyboard.press("Tab");
		await tunggu(1200);
		await klik(page.locator('[data-fieldname="shift"] select').first());
		await page.locator('[data-fieldname="shift"] select').first().selectOption("Shift 1");
		await tidur(700);
		await ke(page.locator('[data-fieldname="rejects"]').first());
		await page.evaluate(async () => {
			cur_frm.clear_table("rejects"); // the form starts with one empty row, which would block Save
			const row = cur_frm.add_child("rejects");
			await frappe.model.set_value(row.doctype, row.name, "reason", "Flashing");
			await frappe.model.set_value(row.doctype, row.name, "qty", 20);
			cur_frm.refresh_field("rejects");
		});
		await tidur(1500);
		await zoom(page.locator('[data-fieldname="rejects"]').first(), 1.4);
		await tidur(1800);
		await zoom(null);
		await page.keyboard.press("ControlOrMeta+S");
		await tunggu(2000);
		await klik(page.locator(".page-actions .primary-action").first());
		await tidur(1000);
		await klik(page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first());
		await tunggu(2500);

		// 10. The underlined number.
		await teks("Angka bergaris bawah berarti ada catatan reject: klik untuk lihat");
		await page.goto(`${URL}/desk/manufacturing/daily-input`);
		await page.waitForSelector(`section[data-wo="${WO_SEAL}"]`, { timeout: 30000 });
		await tunggu(1500);
		const kunci = page.locator(`section[data-wo="${WO_SEAL}"] a`).filter({ hasText: /1\.000/ }).first();
		await zoom(kunci, 1.7);
		await ke(kunci);
		await tidur(2500);
		await zoom(null);

		// 11. Plan vs Actual.
		await teks("Plan vs Actual: target dibanding hasil, hijau berarti tercapai");
		await page.goto(`${URL}/desk/query-report/Plan vs Actual`);
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(2500);
		await zoom(page.locator(".dt-scrollable, .report-wrapper").first(), 1.3);
		await tidur(3000);
		await zoom(null);

		// 12. Close.
		await teks("Selesai. Produksi cuma mencatat; harga dan stok diurus Admin");
		await page.goto(`${URL}/desk/manufacturing/production-floor`);
		await page.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 30000 });
		await tunggu(4500);
		await teks("");
		await tidur(800);
		return await selesaiRekam();
	} finally {
		// Put the data back: cancel what the take recorded, Mesin 05 in Production, English again.
		const daftar = await api("frappe.client.get_list", {
			doctype: "Production Entry",
			filters: { work_order: WO_SEAL, docstatus: 1, creation: [">=", mulai] },
			fields: ["name"],
		});
		for (const { name } of daftar.x || []) {
			const h = await api("frappe.client.cancel", { doctype: "Production Entry", name });
			if (!h.ok) console.error(`could not cancel ${name}: ${h.e}`);
		}
		if (statusAsli) await api("erp_internal.production_floor.set_status", { machine: "Mesin 05", status: statusAsli });
		await api("erp_internal.bahasa.ganti", { lang: bahasaAsli });
	}
}

// A 15 s sample in the style of docs/video/ringkas-operator.md (rows 2, 6 and 9): the menu, Daily Input, Shift 1.
async function contoh() {
	const r = await page.request.post(`${URL}/api/method/login`, { form: { usr: "user@example.com", pwd: SANDI } });
	if (!r.ok()) throw new Error(`login ${r.status()}`);
	await page.goto(`${URL}/desk`);
	await tunggu();
	const bahasaAsli = await page.evaluate(() => frappe.boot.lang || "en");
	await api("erp_internal.bahasa.ganti", { lang: "id" });
	const mulai = await page.evaluate(() => frappe.datetime.now_datetime());
	const hari = await page.evaluate(() => frappe.datetime.get_today());
	// The block to type in: the first one on the page whose today's Shift 1 cell is empty and typeable.
	let WO = null;
	try {
		await page.goto(`${URL}/desk/manufacturing/daily-input`);
		await page.waitForSelector("section[data-wo]", { timeout: 30000 });
		WO = await page.evaluate((kunci) => {
			for (const s of document.querySelectorAll("section[data-wo]")) {
				const inp = s.querySelector(`input[data-key="${CSS.escape(kunci)}"]`);
				if (inp && !inp.value) return s.dataset.wo;
			}
			return null;
		}, `${hari}|Shift 1`);
		if (!WO) throw new Error("No Daily Input block with an empty Shift 1 cell today (run contoh.buat_contoh).");
		await page.goto(`${URL}/desk/manufacturing`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(500);
		await teks("Terdapat 3 menu utama");
		await zoom(page.locator('.body-sidebar a[href*="daily-input"]').first(), 1.6, 800);
		await ke(page.locator('.body-sidebar a[href*="production-floor"]').first());
		await tidur(350);
		await ke(page.locator('.body-sidebar a[href*="daily-input"]').first());
		await tidur(500);
		await zoom(null, 1, 600);
		await klik(page.locator('.body-sidebar a[href*="daily-input"]').first());
		await teks("Input Harian menggantikan lembar Excel harian");
		await page.waitForSelector(`section[data-wo="${WO}"]`, { timeout: 30000 }).catch(async (e) => {
			await page.screenshot({ path: join(tmpdir(), "rekam-demo-gagal.png") });
			console.error("url", page.url(), "blocks", await page.locator("section[data-wo]").count());
			throw e;
		});
		await tunggu(900);
		const blok = page.locator(`section[data-wo="${WO}"]`);
		const sel = blok.locator(`input[data-key="${hari}|Shift 1"]`);
		await teks("Ketik jumlah barang bagus, lalu tekan Enter");
		await zoom(sel, 1.7, 800);
		await klik(sel);
		await ketik("1.250");
		await page.keyboard.press("Enter");
		await tidur(1300);
		await ke(blok.locator(".erp-ih-semua"));
		await tidur(1300);
		await zoom(null, 1, 700);
		await tidur(400);
		return await selesaiRekam();
	} finally {
		const daftar = await api("frappe.client.get_list", {
			doctype: "Production Entry",
			filters: { work_order: WO, docstatus: 1, creation: [">=", mulai] },
			fields: ["name"],
		});
		for (const { name } of daftar.x || []) {
			const h = await api("frappe.client.cancel", { doctype: "Production Entry", name });
			if (!h.ok) console.error(`could not cancel ${name}: ${h.e}`);
		}
		await api("erp_internal.bahasa.ganti", { lang: bahasaAsli });
	}
}

// --- shared take setup: log in, Indonesian, cleanup -------------------------------------------------------------
// Runs `adegan(ctx)` as `user` with the UI in Indonesian; afterwards cancels what the user submitted during the take
// (each DocType of `dibersihkan`, in that order: dependants first) and deletes their drafts, puts the listed
// machines' statuses back and the user's language back as it was.
async function ambil(user, mesinDipulihkan, adegan, dibersihkan = ["Production Entry"]) {
	const r = await page.request.post(`${URL}/api/method/login`, { form: { usr: user, pwd: SANDI } });
	if (!r.ok()) throw new Error(`login ${user} ${r.status()}`);
	await page.goto(`${URL}/desk`);
	await tunggu();
	const bahasaAsli = await page.evaluate(() => frappe.boot.lang || "en");
	const statusAsli = {};
	for (const m of mesinDipulihkan) {
		statusAsli[m] = (await api("frappe.client.get_value", { doctype: "Workstation", filters: m, fieldname: "status" })).x?.status;
	}
	await api("erp_internal.bahasa.ganti", { lang: "id" });
	const mulai = await page.evaluate(() => frappe.datetime.now_datetime());
	const hari = await page.evaluate(() => frappe.datetime.get_today());
	try {
		return await adegan({ hari });
	} catch (e) {
		const gambar = join(tmpdir(), `rekam-demo-gagal-${NAMA}.png`);
		await page.screenshot({ path: gambar }).catch(() => {});
		const pesan = await page.evaluate(() => [...document.querySelectorAll(".msgprint, .modal.show .modal-body")].map((x) => x.innerText.trim()).filter(Boolean).join(" | ")).catch(() => "");
		console.error(`failed at ${page.url()}; screenshot ${gambar}; dialog: ${pesan.slice(0, 300)}`);
		throw e;
	} finally {
		for (const doctype of dibersihkan) {
			for (const [docstatus, cara] of [[1, "frappe.client.cancel"], [0, "frappe.client.delete"]]) {
				const daftar = await api("frappe.client.get_list", {
					doctype,
					filters: { owner: user, docstatus, creation: [">=", mulai] },
					fields: ["name"],
					order_by: "creation desc",
					limit_page_length: 100,
				});
				for (const { name } of daftar.x || []) {
					const h = await api(cara, { doctype, name });
					if (!h.ok) console.error(`could not ${cara.split(".").pop()} ${doctype} ${name}: ${h.e}`);
				}
			}
		}
		for (const [m, s] of Object.entries(statusAsli)) {
			if (s) await api("erp_internal.production_floor.set_status", { machine: m, status: s });
		}
		await api("erp_internal.bahasa.ganti", { lang: bahasaAsli });
	}
}
const sisi = (href) => page.locator(`.body-sidebar a[href*="${href}"]`).first();
async function bukaInputHarian() {
	await page.waitForSelector("section[data-wo]", { timeout: 30000 });
	await tunggu(1200);
}
// The first Daily Input block whose today's Shift 1 cell is empty and typeable.
async function blokKosong(hari) {
	return page.evaluate((kunci) => {
		for (const s of document.querySelectorAll("section[data-wo]")) {
			const inp = s.querySelector(`input[data-key="${CSS.escape(kunci)}"]`);
			if (inp && !inp.value) return s.dataset.wo;
		}
		return null;
	}, `${hari}|Shift 1`);
}

// --- forms: what a person does on a Desk form ----------------------------------------------------------------------
const kolom = (nama) => page.locator(`.frappe-control[data-fieldname="${nama}"]:visible`).first();
const pilihan = () => page.locator('.awesomplete [role="listbox"]:not([hidden]) [role="option"]:visible');
// Opens a menu link; when its module's section is folded, clicks the section header first.
async function menu(href) {
	const link = page.locator(`.body-sidebar a[href="${href}"]`).first();
	if (!(await link.isVisible().catch(() => false))) {
		const dalam = page.locator(`a[href="${href}"]`); // `has` is relative to the section
		await klik(page.locator(".body-sidebar .section-item").filter({ has: dalam }).locator(".section-break").first());
		await tidur(600);
	}
	await klik(link);
	await tunggu(1500);
}
async function baru() {
	await klik(page.locator(".page-actions .primary-action:visible").first());
	await page.waitForFunction(() => window.cur_frm?.doc?.__islocal, null, { timeout: 30000 });
	await tunggu(1000);
}
async function pilihDariDaftar(cari, pilih) {
	await ketik(cari);
	const opsi = pilihan().filter({ hasText: pilih || cari }).first();
	await opsi.waitFor({ state: "visible", timeout: 15000 });
	await tidur(500);
	await klik(opsi);
	await tunggu(700);
}
// A field inside a folded section: open the section by its heading first, as a person would.
async function bukaBagian(nama) {
	if (await kolom(nama).count()) return;
	const kepala = page.locator(".form-section").filter({ has: page.locator(`[data-fieldname="${nama}"]`) }).locator(".section-head").first();
	if (await kepala.isVisible().catch(() => false)) {
		await klik(kepala);
		await tidur(700);
	}
}
async function isiLink(nama, cari, pilih) {
	await bukaBagian(nama);
	await klik(kolom(nama).locator("input").first());
	await page.keyboard.press("ControlOrMeta+A");
	await pilihDariDaftar(cari, pilih);
}
async function isiKolom(nama, nilai) {
	await bukaBagian(nama);
	await klik(kolom(nama).locator("input, textarea").first());
	await page.keyboard.press("ControlOrMeta+A");
	await ketik(nilai);
	await page.keyboard.press("Escape"); // a date field's calendar
	await page.keyboard.press("Tab");
	await tunggu(600);
}
async function pilihSelect(nama, nilai) {
	const s = kolom(nama).locator("select").first();
	await klik(s);
	await s.selectOption(nilai);
	await tunggu(600);
}
// A table cell: click it (the row turns editable), then its input.
const sel = (tabel, idx, nama) =>
	page.locator(`.frappe-control[data-fieldname="${tabel}"]:visible .grid-row[data-idx="${idx}"] .grid-static-col[data-fieldname="${nama}"]`).first();
async function isiSel(tabel, idx, nama, nilai, pilih) {
	if (!(await sel(tabel, idx, nama).count())) {
		await klik(page.locator(`.frappe-control[data-fieldname="${tabel}"]:visible .grid-add-row`).first());
		await tidur(700);
	}
	await klik(sel(tabel, idx, nama));
	const inp = page.locator(`.frappe-control[data-fieldname="${tabel}"]:visible .grid-row[data-idx="${idx}"] input[data-fieldname="${nama}"]`).first();
	// The row turns editable on the cell's own click handler; a mouse click that lands while the page still settles
	// can miss it, so the same click is sent to the element itself.
	if (!(await inp.isVisible({ timeout: 1500 }).catch(() => false))) await sel(tabel, idx, nama).evaluate((e) => e.click());
	await inp.waitFor({ state: "visible", timeout: 10000 });
	await inp.focus();
	// The editable row takes about 0.3 s to settle: keys typed sooner are lost ("10-12-2026" became "12-2026", an
	// invalid date). A person pauses here anyway; a link cell's list is open meanwhile, so it shows before the search.
	await tidur(500);
	await page.keyboard.press("ControlOrMeta+A");
	if (pilih !== undefined) await pilihDariDaftar(nilai, pilih);
	else {
		await ketik(nilai);
		await tidur(300);
		await page.keyboard.press("Escape"); // a date cell's calendar
		// Leave the cell without Tab: Tab out of a table's last cell adds an empty row, which blocks Save.
		await inp.evaluate((e) => e.blur());
		await tunggu(700);
	}
}
// A date cell through its calendar, as a person picks a date: open the cell, step months with the arrows until the
// target month shows, click the day. `iso` is yyyy-mm-dd.
async function pilihTanggal(tabel, idx, nama, iso) {
	await klik(sel(tabel, idx, nama));
	const inp = page.locator(`.frappe-control[data-fieldname="${tabel}"]:visible .grid-row[data-idx="${idx}"] input[data-fieldname="${nama}"]`).first();
	if (!(await inp.isVisible({ timeout: 1500 }).catch(() => false))) await sel(tabel, idx, nama).evaluate((e) => e.click());
	await inp.waitFor({ state: "visible", timeout: 10000 });
	const kalender = page.locator(".datepicker.active").first();
	await kalender.waitFor({ state: "visible", timeout: 10000 });
	await tidur(700);
	const [y, m, d] = iso.split("-").map(Number);
	const target = y * 12 + (m - 1);
	for (let i = 0; i < 24; i++) {
		// Air datepicker's day cells carry data-month (0-11) and data-year; the shown month is the one not marked other.
		const kini = await kalender.locator(".datepicker--cell-day:not(.-other-month-)").first().evaluate((e) => Number(e.dataset.year) * 12 + Number(e.dataset.month));
		if (kini === target) break;
		await klik(kalender.locator(`.datepicker--nav-action[data-action="${kini < target ? "next" : "prev"}"]`));
		await tidur(450);
	}
	await klik(kalender.locator(`.datepicker--cell-day:not(.-other-month-)[data-date="${d}"]`));
	await tunggu(900);
	await inp.evaluate((e) => e.blur());
	await tunggu(500);
}
async function simpan() {
	await klik(page.locator(".page-actions .primary-action:visible").first());
	// A click that lands while the form still settles is sometimes dropped (HR's leave form): save once more.
	const ok = await page.waitForFunction(() => window.cur_frm && !cur_frm.doc.__islocal && !cur_frm.is_dirty(), null, { timeout: 8000 }).then(() => true).catch(() => false);
	if (!ok && !(await page.locator(".modal.show").isVisible().catch(() => false))) {
		await page.evaluate(() => (cur_frm.is_new() || cur_frm.is_dirty()) && cur_frm.save()).catch(() => {}); // a route change mid-save
		await page.waitForLoadState("domcontentloaded").catch(() => {});
	}
	await page.waitForFunction(() => window.cur_frm && !cur_frm.doc.__islocal && !cur_frm.is_dirty(), null, { timeout: 30000 });
	await tunggu(1200);
}
async function ajukan() {
	await klik(page.locator(".page-actions .primary-action:visible").first());
	await tidur(900);
	await klik(page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first());
	await page.waitForFunction(() => window.cur_frm?.doc?.docstatus === 1, null, { timeout: 60000 });
	await tunggu(1500);
}
// A photo of the real document, through the form's attachment "+" and the upload dialog's "My Device".
async function lampirkan(berkas) {
	await klik(page.locator(".add-attachment-btn:visible").first());
	await page.locator(".modal.show .btn-file-upload").first().waitFor({ state: "visible", timeout: 15000 });
	await tidur(600);
	const [pemilih] = await Promise.all([
		page.waitForEvent("filechooser"),
		klik(page.locator(".modal.show .btn-file-upload").first()),
	]);
	await pemilih.setFiles(berkas);
	await tidur(1200);
	await klik(page.locator(".modal.show .btn-modal-primary").first());
	await page.waitForFunction(() => !document.querySelector(".modal.show") && cur_frm?.get_docinfo?.().attachments?.length, null, { timeout: 30000 });
	await tunggu(1500);
}
// A submitted stock document's View > Stock Ledger (the labels are looked up translated, as the buttons carry
// them), waiting for the report's first row.
async function bukuStok() {
	const [lihat, buku] = await page.evaluate(() => [__("View"), __("Stock Ledger")]);
	await klik(page.locator(`.inner-group-button[data-label="${encodeURIComponent(lihat)}"] button`).first());
	await tidur(700);
	await klik(page.locator('[role="menuitem"]:visible').filter({ hasText: buku }).first());
	await page.waitForSelector(".dt-row-0", { timeout: 30000 });
	await tunggu(1500);
}
// The first report row's cell under the column labelled `label` (translated here).
async function selLaporan(label) {
	const judul = await page.evaluate((l) => __(l), label);
	const kepala = page.locator(".dt-cell--header").filter({ has: page.locator(".dt-cell__content", { hasText: new RegExp(`^\\s*${judul}\\s*$`) }) }).first();
	const kelas = await kepala.getAttribute("class");
	const kol = kelas.match(/dt-cell--col-(\d+)/)[1];
	const sel = page.locator(`.dt-row-0 .dt-cell--col-${kol}`).first();
	await sel.scrollIntoViewIfNeeded(); // a wide report scrolls sideways in its own box
	return sel;
}
async function cetak() {
	const tombol = page.locator('.page-head button:visible:has(use[href="#icon-printer"])').first();
	if (await tombol.count()) await klik(tombol);
	else await page.evaluate(() => cur_frm.print_doc());
	await page.waitForURL(/\/print\//, { timeout: 30000 });
	await tunggu(3000);
}
// Pretend photos of the paper documents attached in the videos (a PO, a supplier's delivery note, a bill),
// drawn by the browser itself.
const dokumen = {};
async function siapkanDokumen() {
	const kertas = await ctx.newPage();
	for (const [nama, judul, baris] of [
		["po-pelanggan", "PURCHASE ORDER", ["PO No. 112/EPP/XI/2026", "Seal Cap MHG Coklat Muda 20.000 pcs", "Kirim: 2 minggu"]],
		["surat-jalan-pemasok", "SURAT JALAN", ["No. SJ-0457", "Bahan Seal Cap 100 Kg", "Pigmen Coklat Muda 500 gr", "Plastik 35x50 100 pcs, Karung 50 pcs"]],
		["nota-listrik", "NOTA PEMBAYARAN LISTRIK", ["Bulan November 2026", "Jumlah Rp 2.500.000", "LUNAS"]],
		["po-pemasok", "PURCHASE ORDER", ["Kepada: PT Biji Plastik Nusantara", "Bahan Seal Cap 500 Kg", "Pigmen Hijau 2 Kg", "Cap dan tanda tangan"]],
		["faktur-pemasok", "FAKTUR", ["No. INV-BPN-0981", "Bahan Seal Cap 480 Kg", "Pigmen Hijau 2 Kg"]],
		["bukti-transfer", "BUKTI TRANSFER", ["Ke: PT Biji Plastik Nusantara", "Berhasil"]],
		["faktur-penjualan", "FAKTUR PENJUALAN", ["Kepada: Toko Maju Jaya", "Tanda tangan dan cap"]],
		["nota-bensin", "NOTA BENSIN", ["SPBU 34-14xxx", "Pertalite", "Jumlah Rp 500.000"]],
	]) {
		await kertas.setViewportSize({ width: 900, height: 1200 });
		await kertas.setContent(`<body style="margin:0;background:#e9e4d8;display:grid;place-items:center;height:100vh;font-family:Georgia,serif">
			<div style="width:720px;height:1000px;background:#fffdf7;box-shadow:0 8px 30px #0003;padding:70px;box-sizing:border-box;transform:rotate(-1.2deg)">
			<h1 style="letter-spacing:2px;border-bottom:3px double #333;padding-bottom:16px">${judul}</h1>
			${baris.map((b) => `<p style="font-size:28px;margin:26px 0">${b}</p>`).join("")}
			<p style="margin-top:220px;font-size:22px">Tanda tangan: ____________</p></div></body>`);
		dokumen[nama] = join(FOLDER, `${nama}.png`);
		await kertas.screenshot({ path: dokumen[nama] });
	}
	await kertas.close();
}
// Moves the cursor over the rows of a report whose text matches, as someone reading it.
async function bacaBaris(pola) {
	const b = page.locator(".dt-row:visible").filter({ hasText: pola }).first(); // the table draws only rows in view
	if (await b.count()) {
		await ke(b.locator(".dt-cell").nth(1));
		await tidur(1500);
	}
}

// docs/video/ringkas-operator.md: an operator's day (about 4 minutes). Row numbers below are the script's; each
// `lalu()` starts the row's next sentence right before the action it describes.
async function ringkasOperator() {
	return ambil("user@example.com", ["Mesin 02"], async ({ hari }) => {
		await page.goto(`${URL}/desk/manufacturing/daily-input`);
		await bukaInputHarian();
		const WO = await blokKosong(hari);
		if (!WO) throw new Error("No Daily Input block with an empty Shift 1 cell today (run contoh.buat_contoh).");
		await page.goto(`${URL}/desk/manufacturing`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);

		// 1-2
		await teks("Kerja harian operator produksi");
		await lalu();
		await daftarIsi();
		// 3
		bab("Menu");
		await teks("Terdapat 3 menu utama");
		await zoom(sisi("daily-input"), 1.6);
		await lalu();
		await ke(sisi("production-floor"));
		await lalu();
		await ke(sisi("daily-input"));
		await lalu();
		await ke(page.locator(".body-sidebar").getByText("Produksi", { exact: true }).nth(1));
		await tungguSuara();
		await zoom(null);
		// 4
		bab("Lantai Produksi");
		await klik(sisi("production-floor"));
		await page.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 30000 });
		await page.locator(".memuat").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await teks("Hijau artinya berproduksi, abu-abu artinya mati");
		await lalu();
		await ke(page.locator('.label[data-mesin="Mesin 02"]'));
		await lalu();
		await ke(page.locator('.label[data-mesin="Mesin 01"]'));
		// 5
		await teks("Mesin rusak? Ubah statusnya menjadi Masalah");
		await klik(page.locator('tr[data-mesin="Mesin 02"]'));
		await tidur(1500);
		await lalu();
		await ke(page.locator(".panel").first());
		await lalu();
		await zoom(page.locator(".panel .status"), 1.6);
		await pilihStatus("Problem");
		await lalu();
		await zoom(null);
		await ke(page.locator('.label[data-mesin="Mesin 02"]'));
		// 6
		await teks("Mesin berjalan kembali? Klik Produksi");
		await pilihStatus("Production");
		await lalu();
		await ke(page.locator('.label[data-mesin="Mesin 02"]'));
		await lalu();
		await klik(page.locator(".panel .tutup"));
		// 7
		bab("Input Harian");
		await teks("Input Harian menyerupai lembar Excel harian");
		await klik(page.locator(".kembali").first());
		await tunggu(1500);
		await klik(sisi("daily-input"));
		await bukaInputHarian();
		await lalu();
		const alat = page.locator(".erp-ih-alat button");
		await lalu();
		await ke(alat.nth(0));
		await tidur(500);
		await ke(alat.nth(1));
		await tidur(500);
		await ke(alat.nth(2));
		// 8
		await teks("Isi nama teknisi setiap shift");
		const pagi = page.locator(".erp-ih-teknisi").nth(0);
		const malam = page.locator(".erp-ih-teknisi").nth(1);
		await zoom(pagi, 1.6);
		await klik(pagi);
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.press("Backspace");
		await ketik("Yudi");
		await lalu();
		await klik(malam);
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.press("Backspace");
		await ketik("Fadli");
		await page.keyboard.press("Tab");
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 9
		const blok = page.locator(`section[data-wo="${WO}"]`);
		const shift1 = blok.locator(`input[data-key="${hari}|Shift 1"]`);
		const shift2 = blok.locator(`input[data-key="${hari}|Shift 2"]`);
		await teks("Satu kotak untuk satu perintah produksi");
		await zoom(blok.locator("thead").first(), 1.5);
		await lalu();
		await ke(blok.locator(".erp-ih-kepala, .erp-ih-po").first());
		await lalu();
		await ke(blok.locator("thead").first());
		await tidur(600);
		await ke(shift1);
		// 10
		await teks("Ketik jumlah barang bagus, lalu tekan Enter");
		await zoom(shift1, 1.8);
		await klik(shift1);
		await ketik("1.250");
		await page.keyboard.press("Enter");
		await tidur(1200);
		await lalu();
		await ke(blok.locator(".erp-ih-semua"));
		// 11
		await teks("Cara mengisi Shift 2 sama");
		await klik(shift2);
		await ketik("1.180");
		await page.keyboard.press("Tab");
		await tidur(1200);
		await lalu();
		await klik(shift2);
		await page.keyboard.press("ControlOrMeta+A");
		await ketik("1.150");
		await page.keyboard.press("Tab");
		await tidur(1200);
		await lalu();
		// 12
		await teks("Catat kejadian pada kolom Keterangan");
		const ket = blok.locator("tr").filter({ has: page.locator(`input[data-key="${hari}|Shift 1"]`) }).locator("td.erp-ih-ket input");
		await klik(ket);
		await ketik("Ganti cetakan jam 10");
		await page.keyboard.press("Enter");
		await tidur(1200);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 13
		bab("Reject");
		await teks("Angka bergaris bawah dibuka lewat form");
		const garis = page.locator(`section[data-wo]:not([data-wo="${WO}"]) td a`).filter({ hasText: /\d/ }).first();
		await zoom(garis, 1.8);
		await ke(garis);
		await lalu();
		await klik(garis);
		await page.waitForFunction(() => window.cur_frm?.doctype === "Production Entry" && !cur_frm.doc.__islocal, null, { timeout: 30000 });
		await tunggu(1200);
		await lalu();
		await zoom(page.locator('[data-fieldname="rejects"]').first(), 1.4);
		await tungguSuara();
		await zoom(null);
		// 14
		await teks("Reject: pilih alasan dan isi jumlahnya");
		await page.goto(`${URL}/desk/manufacturing/production-entry/new`);
		await page.waitForFunction(() => window.cur_frm?.doctype === "Production Entry" && cur_frm.doc.__islocal, null, { timeout: 30000 });
		await tunggu(1200);
		await isiLink("work_order", WO, WO);
		await lalu();
		await ke(kolom("workstation"));
		await lalu();
		await pilihSelect("shift", "Shift 1");
		await lalu();
		await isiKolom("good_qty", "0");
		await lalu();
		await isiSel("rejects", 1, "reason", "Short", "Short Shot");
		await isiSel("rejects", 1, "qty", "35");
		await lalu();
		await simpan();
		await lalu();
		await ajukan();
		// 15
		bab("Cetak dan laporan");
		await teks("Cetak atau unduh rekap mingguan dalam Excel");
		await klik(sisi("daily-input"));
		await bukaInputHarian();
		const cetakIH = page.locator(".erp-ih-alat button, .erp-ih-kepala button").filter({ hasText: /Cetak|Print/ }).first();
		const excel = page.locator(".erp-ih-alat button, .erp-ih-kepala button").filter({ hasText: /Excel/ }).first();
		await zoom(cetakIH, 1.6);
		await lalu();
		page.once("popup", (p) => setTimeout(() => p.close().catch(() => {}), 2500));
		await klik(cetakIH);
		await tidur(1500);
		await lalu();
		await klik(excel);
		await tungguSuara();
		await zoom(null);
		// 16
		await teks("Perbandingan target dan hasil");
		await klik(page.locator(".body-sidebar").getByText("Rencana vs Aktual", { exact: true }).first());
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await lalu();
		await zoom(page.locator(".dt-header, .dt-row-header").first(), 1.5);
		await lalu();
		await zoom(null);
		const pil = page.locator(".dt-row:visible .indicator-pill").first();
		if (await pil.count()) await ke(pil);
		// 17
		await teks("Setiap shift: periksa mesin, lalu catat hasil");
		await lalu();
		await ke(sisi("production-floor"));
		await lalu();
		await klik(sisi("daily-input"));
		await bukaInputHarian();
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	});
}
// Clicks a machine status button in the open panel and waits until the server's answer shows it pressed (a busy
// bench can take seconds; a click while the panel still waits is ignored, so the next step must not start earlier).
async function pilihStatus(status) {
	await klik(page.locator(`.panel button[data-status="${status}"]`));
	await page.locator(`.panel button[data-status="${status}"][aria-pressed="true"]`).waitFor({ timeout: 30000 });
	await tidur(600);
}

// docs/video/ringkas-admin.md: an Admin's day (about 9 minutes). Row numbers below are the script's; each `lalu()`
// starts the row's next sentence right before the action it describes.
async function ringkasAdmin() {
	const dibersihkan = ["Delivery Note", "Stock Entry", "Work Order", "Sales Order", "Expense Entry", "Item Price"];
	return ambil("admin@example.com", ["Mesin 04"], async ({ hari }) => {
		await siapkanDokumen();
		const kirim = await page.evaluate((h) => frappe.datetime.add_days(h, 14), hari); // yyyy-mm-dd
		await page.goto(`${URL}/desk/home`);
		await tunggu(2000);
		await mulaiRekam();
		await tidur(600);

		// 1-2
		await teks("Kerja harian Admin, dari Purchase Order (PO) hingga biaya");
		await lalu();
		await daftarIsi();
		// 3
		bab("Menu");
		await teks("Semua menu tersedia di sebelah kiri");
		const susuri = async (judul) => {
			for (const t of judul) {
				const l = page.locator(".body-sidebar").getByText(t, { exact: true }).last(); // last: "Pengaturan" is also the sidebar's title
				if (await l.isVisible().catch(() => false)) {
					await ke(l);
					await tidur(350);
				}
			}
		};
		await susuri(["Lantai Produksi", "Input Harian", "Stok", "Penjualan", "Pembelian", "Produksi"]);
		await lalu();
		await susuri(["Proyek", "SDM", "Pengaturan"]);
		await lalu();
		// 4
		bab("Pesanan Penjualan");
		await teks("Purchase Order (PO) masuk: buat Pesanan Penjualan");
		await menu("/desk/selling/sales-order");
		await baru();
		await lalu();
		await isiLink("customer", "Empat Putra", "PT. Empat Putra Pangestu");
		// 5
		await teks("Seal Cap: harga mengikuti mesin");
		await isiSel("items", 1, "item_code", "SEAL-CAP-MHG", "SEAL-CAP-MHG-CKM");
		await isiSel("items", 1, "qty", "20000");
		await lalu();
		await pilihTanggal("items", 1, "delivery_date", kirim); // after the item: picking it resets the row's date
		await lalu();
		await isiSel("items", 1, "erp_mesin", "Mesin 04", "Mesin 04");
		await tidur(1200);
		await lalu();
		await zoom(sel("items", 1, "rate"), 1.8);
		// 6
		await teks("Mesin 14: Rp23 per buah");
		await isiSel("items", 1, "erp_mesin", "Mesin 14", "Mesin 14");
		await tidur(1200);
		await ke(sel("items", 1, "rate"));
		await lalu();
		await isiSel("items", 1, "erp_mesin", "Mesin 04", "Mesin 04");
		await tidur(1000);
		await lalu();
		await zoom(null);
		// 7
		await teks("Foto Purchase Order (PO) wajib dilampirkan");
		// Safety net: the header's delivery date follows the row's (picked on the calendar above).
		await page.evaluate(async (tanggal) => {
			for (const r of cur_frm.doc.items) if (!r.delivery_date) await frappe.model.set_value(r.doctype, r.name, "delivery_date", tanggal);
			if (!cur_frm.doc.delivery_date) await cur_frm.set_value("delivery_date", tanggal);
		}, kirim);
		await simpan();
		const so = await page.evaluate(() => cur_frm.doc.name);
		await lalu();
		const pesan = page.locator(".form-message:visible").first();
		if (await pesan.count()) {
			await zoom(pesan, 1.5);
			await tungguSuara();
			await zoom(null);
		}
		// 8
		await teks("Lampirkan foto, lalu Kirim");
		await lampirkan(dokumen["po-pelanggan"]);
		await lalu();
		await ajukan();
		await lalu();
		// 9
		await teks("Format cetak Purchase Order (PO) langsung tersedia");
		await cetak();
		await lalu();
		await tungguSuara();
		await lalu();
		const mesin = page.locator("body").getByText("Mesin 04").first();
		if (await mesin.isVisible().catch(() => false)) {
			await zoom(mesin, 1.8);
			await tungguSuara();
			await zoom(null);
		}
		// 10
		bab("Perintah Produksi");
		await teks("Buat Perintah Produksi dari pesanan");
		await page.goto(`${URL}/desk/selling/sales-order/${so}`);
		await tunggu(1500);
		await klik(page.locator(".page-actions").getByRole("button", { name: /^(Create|Buat)$/ }).first());
		await tidur(700);
		// The open menu is drawn outside the light DOM; getByText reaches it. The sidebar's link of the same name is
		// folded away (Produksi's section is closed), so the visible match is the menu's.
		await klik(page.getByText(/^(Work Order|Perintah Produksi)$/).locator("visible=true").last());
		await tidur(1500);
		const dialog = page.locator(".modal.show .btn-modal-primary").first();
		if (await dialog.isVisible().catch(() => false)) {
			const centang = page.locator(".modal.show .grid-body .grid-row-check").first();
			if (await centang.isVisible().catch(() => false)) {
				await klik(centang);
				await tidur(600);
			}
			await klik(dialog);
			await tunggu(2500);
		}
		await page.keyboard.press("Escape");
		const wo = (await api("frappe.client.get_list", { doctype: "Work Order", filters: { sales_order: so }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
		if (!wo) throw new Error(`no Work Order made from ${so}`);
		await lalu();
		await page.goto(`${URL}/desk/manufacturing/work-order/${wo}`);
		await tunggu(2000);
		await lalu();
		await zoom(kolom("erp_mesin"), 1.8);
		// 11
		await teks("Hanya mesin yang dapat membuat barang ini");
		await klik(kolom("erp_mesin").locator("input").first());
		await page.keyboard.press("ControlOrMeta+A");
		await ketik("Mesin");
		await pilihan().first().waitFor({ state: "visible", timeout: 15000 });
		await lalu();
		await ke(pilihan().last());
		await lalu();
		await klik(pilihan().filter({ hasText: "Mesin 04" }).first());
		await tunggu(1000);
		await tungguSuara();
		await zoom(null);
		// 12
		await teks("Kirim Perintah Produksi");
		if (await page.evaluate(() => cur_frm.is_dirty())) await simpan();
		await ajukan();
		await lalu();
		// 13
		bab("Lantai Produksi");
		await teks("Pantau mesin yang kosong atau bermasalah");
		await klik(sisi("production-floor"));
		await page.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 60000 });
		await page.locator(".memuat").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await lalu();
		await ke(page.locator(".perhatian .kepala").first());
		await lalu();
		await klik(page.locator(".perhatian li[data-mesin]").first());
		await tidur(1500);
		// 14
		await teks("Perintah produksi tampil pada mesinnya");
		await klik(page.locator('tr[data-mesin="Mesin 04"]'));
		await tidur(1500);
		await lalu();
		await zoom(page.locator(".panel").first(), 1.4);
		await tungguSuara();
		await zoom(null);
		await lalu();
		await klik(page.locator(".panel .tutup"));
		// 15
		bab("Bahan datang");
		await teks("Bahan datang: catat Nota Penerimaan Barang");
		await page.goto(`${URL}/desk/stock`);
		await tunggu(1500);
		await menu("/desk/stock/stock-entry");
		await baru();
		await lalu();
		await isiLink("stock_entry_type", "Penerimaan", "Nota Penerimaan Barang");
		await lalu();
		await isiLink("to_warehouse", "Bahan Baku", "Gudang Bahan Baku");
		// 16
		await teks("Masukkan bahan, pigmen, dan kemasan");
		for (const [i, [kode, qty]] of [["BB-SEAL-CAP", "100"], ["PIGMEN-CKM", "500"], ["Plastik 35x50", "100"], ["Karung", "50"]].entries()) {
			await isiSel("items", i + 1, "item_code", kode, kode);
			await isiSel("items", i + 1, "qty", qty);
		}
		await lalu();
		// 17
		await teks("Lampirkan surat jalan pemasok");
		await simpan();
		await lalu();
		await lampirkan(dokumen["surat-jalan-pemasok"]);
		await lalu();
		await ajukan();
		await lalu();
		await bukuStok();
		await lalu();
		await ke(await selLaporan("In Qty"));
		await tungguSuara();
		await ke(await selLaporan("Balance Qty"));
		await tidur(1500);
		await page.goBack();
		await tunggu(1500);
		// 18
		await teks("Bahan dari Pesanan Pembelian: gunakan Penerimaan Barang");
		await menu("/desk/buying/purchase-receipt");
		await lalu();
		const pr = page.locator(".list-row-container .list-subject a").first();
		if (await pr.isVisible().catch(() => false)) {
			await klik(pr);
			await tunggu(2000);
		}
		await lalu();
		// 19
		bab("Input Harian");
		await teks("Admin hanya melihat hasil produksi");
		await klik(sisi("daily-input"));
		await bukaInputHarian();
		await lalu();
		await ke(page.locator("section[data-wo] td").filter({ hasText: /\d/ }).nth(3));
		await lalu();
		const alatIH = page.locator(".erp-ih-alat button, .erp-ih-kepala button");
		page.once("popup", (p) => setTimeout(() => p.close().catch(() => {}), 2500));
		await klik(alatIH.filter({ hasText: /Cetak|Print/ }).first());
		await tidur(1500);
		await klik(alatIH.filter({ hasText: /Excel/ }).first());
		// 20
		bab("Surat Jalan");
		await teks("Surat Jalan: pilih gudang asal");
		await page.goto(`${URL}/desk/stock`);
		await tunggu(1500);
		await menu("/desk/stock/delivery-note");
		await baru();
		await lalu();
		await isiLink("customer", "Toko Contoh", "Toko Contoh Sejahtera");
		await isiSel("items", 1, "item_code", "CTH-EMBER-10L", "CTH-EMBER-10L");
		await isiSel("items", 1, "qty", "5");
		await lalu();
		await zoom(kolom("set_warehouse"), 1.7);
		await isiLink("set_warehouse", "Pluit", "Gudang Pluit");
		await tungguSuara();
		await zoom(null);
		// 21
		await teks("Kirim sebelum truk berangkat");
		await simpan();
		await lalu();
		await ajukan();
		const dn = await page.evaluate(() => cur_frm.doc.name);
		await bukuStok();
		await lalu();
		await ke(await selLaporan("Out Qty"));
		await tungguSuara();
		await page.goto(`${URL}/desk/stock/delivery-note/${dn}`);
		await tunggu(2000);
		await lalu();
		await cetak();
		await tungguSuara();
		// 22
		await teks("Foto surat jalan bertanda tangan menyusul");
		await page.goto(`${URL}/desk/stock/delivery-note/${dn}`);
		await tunggu(2000);
		await lalu();
		const catatan = page.locator(".form-message:visible").first();
		if (await catatan.count()) await zoom(catatan, 1.5);
		await tungguSuara();
		await zoom(null);
		// 23
		await teks("Periksa dokumen yang belum memiliki foto");
		await menu("/desk/stock/query-report/Missing Documents");
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await lalu();
		const baris = page.locator(".dt-cell a").filter({ hasText: dn }).first();
		if (await baris.count()) await klik(baris);
		await tunggu(2000);
		// 24
		bab("Biaya");
		await teks("Catat biaya pabrik");
		await page.goto(`${URL}/desk/buying`);
		await tunggu(1500);
		await menu("/desk/buying/expense-entry");
		await baru();
		await lalu();
		await isiLink("category", "Listrik", "Listrik");
		await lalu();
		await isiKolom("amount", "2500000");
		await lalu();
		await pilihSelect("repeat", "Once");
		// 25
		await teks("Sekali, tiap bulan, atau per shift mesin");
		await simpan();
		await lalu();
		await lampirkan(dokumen["nota-listrik"]);
		await lalu();
		await ajukan();
		await lalu();
		await zoom(kolom("repeat"), 1.8);
		await ke(kolom("repeat"));
		await tungguSuara();
		await zoom(null);
		// 26
		await teks("Seluruh biaya bulanan dalam satu laporan");
		await menu("/desk/buying/query-report/Monthly Expenses");
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await zoom(page.locator(".dt-scrollable").first(), 1.3);
		await lalu();
		await bacaBaris(/Gaji Operator/);
		await lalu();
		await bacaBaris(/Pigmen/);
		await lalu();
		await bacaBaris(/Total/);
		await tungguSuara();
		await zoom(null);
		// 27
		bab("Pemeriksaan data");
		await teks("Periksa data yang belum lengkap");
		await page.goto(`${URL}/desk/setup/home`);
		await tunggu(1500);
		await menu("/desk/setup/query-report/Missing Data");
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await lalu();
		await zoom(page.locator(".dt-header, .dt-row-header").first(), 1.5);
		await lalu();
		await zoom(null);
		const perbaiki = page.locator("a.erp-perbaiki").filter({ hasText: /harga|price/i }).first();
		if (await perbaiki.count()) {
			await klik(perbaiki);
			await tunggu(2500);
		}
		// 28
		await teks("Data belum lengkap membuat perhitungan tidak utuh");
		await menu("/desk/setup/query-report/Missing Data");
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await lalu();
		await bacaBaris(/Stok|stock/i);
		await lalu();
		// 29
		await teks("Setiap Senin: periksa Siap Order");
		await page.goto(`${URL}/desk/manufacturing/query-report/Order Readiness`);
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await lalu();
		await zoom(page.locator(".dt-header, .dt-row-header").first(), 1.5);
		await lalu();
		await zoom(null);
		await bacaBaris(/Telat/);
		// 30
		await teks("Status Telat: segera buat Perintah Produksi");
		await bacaBaris(/Telat/);
		await ke(page.locator(".body-sidebar").getByText("Penjualan", { exact: true }).first());
		// 31
		await teks("Pesanan, produksi, gudang, biaya, dan pemeriksaan data");
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	}, dibersihkan);
}

// docs/video/lengkap-p1-operator-mulai.md: an operator's first steps (about 4 minutes). It starts signed out, on the
// login page, in English; row 8 really changes the password, so the end puts the sample password back.
async function lengkapP1() {
	const user = "user@example.com";
	const SANDI_BARU = "PabrikDelta#2026";
	const masuk = async (sandi) => (await page.request.post(`${URL}/api/method/login`, { form: { usr: user, pwd: sandi } })).ok();
	if (!(await masuk(SANDI))) throw new Error(`login ${user}`);
	await page.goto(`${URL}/desk/manufacturing`);
	await tunggu();
	const bahasaAsli = await page.evaluate(() => frappe.boot.lang || "en");
	await api("erp_internal.bahasa.ganti", { lang: "en" });
	await ctx.clearCookies();
	const header = () => page.locator(".body-sidebar .sidebar-header").first();
	const bukaApp = async () => {
		await page.waitForURL(/\/desk/, { timeout: 30000 });
		await tunggu(1500);
		// The Apps screen on a first sign-in; a later one may land straight on the last page.
		const erp = page.getByText("ERP", { exact: true }).first();
		if (await erp.isVisible().catch(() => false)) await klik(erp);
		await page.waitForFunction(() => window.frappe?.boot && document.querySelector(".body-sidebar .sidebar-header"), null, { timeout: 30000 });
		await tunggu(1500);
	};
	const isiMasuk = async (sandi) => {
		await klik(page.locator("#login_email"));
		await ketik(user);
		await klik(page.locator("#login_password"));
		await ketik(sandi);
	};
	try {
		await page.goto(`${URL}/login`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);

		// 1-2
		await teks("Memulai penggunaan aplikasi pabrik");
		await lalu();
		await daftarIsi();
		// 3
		bab("Masuk dan versi aplikasi");
		await teks("Masuk dengan email dan sandi");
		await isiMasuk(SANDI);
		await lalu();
		await zoom(page.locator(".erp-versi:visible").first(), 2);
		await tungguSuara();
		await zoom(null);
		await lalu();
		await klik(page.locator("button[type=submit]:visible").first());
		// 4
		await teks("Tampilan awal berbahasa Inggris");
		await page.waitForURL(/\/desk/, { timeout: 30000 });
		await tunggu(1500);
		await lalu();
		await bukaApp();
		await lalu();
		await ke(header());
		// 5
		bab("Ganti bahasa");
		await teks("Ganti bahasa: klik judul menu, pilih Bahasa Indonesia");
		await klik(header());
		await tidur(800);
		await klik(page.getByText("Bahasa Indonesia", { exact: true }).locator("visible=true").first());
		await lalu();
		await page.waitForFunction(() => window.frappe?.boot?.lang === "id", null, { timeout: 30000 });
		await tunggu(2000);
		// 6
		await teks("Kembali ke bahasa Inggris: pilih English");
		await klik(header());
		await tidur(800);
		const english = page.getByText("English", { exact: true }).locator("visible=true").first();
		await zoom(english, 1.8);
		await lalu();
		await tungguSuara();
		await zoom(null);
		await page.keyboard.press("Escape");
		await tidur(500);
		// 7
		bab("Ganti sandi");
		await teks("Pengaturan akun ada di menu nama Anda");
		await klik(page.locator(".sidebar-user-button:visible").first());
		await tidur(800);
		await klik(page.getByText("Pengaturan", { exact: true }).locator("visible=true").last());
		await page.locator(".modal.show .change-password-btn").waitFor({ state: "visible", timeout: 30000 });
		await tunggu(1200);
		await lalu();
		await zoom(page.locator(".modal.show .erp-versi").first(), 2);
		await tungguSuara();
		await zoom(null);
		// 8
		await teks("Ganti sandi melalui Ubah Kata sandi");
		await klik(page.locator(".modal.show .change-password-btn").first());
		const sandiBaru = page.locator('.modal.show input[data-fieldname="new_password"]').last();
		await sandiBaru.waitFor({ state: "visible", timeout: 15000 });
		await tidur(800);
		await lalu();
		await klik(sandiBaru);
		await ketik(SANDI_BARU);
		await lalu();
		await ke(page.locator('.modal.show input[data-fieldname="logout_all_sessions"]').last());
		await tidur(800);
		await lalu();
		await klik(page.locator(".modal.show .btn-modal-primary").filter({ hasText: /Ubah Kata sandi|Change Password/ }).last());
		// 9
		await teks("Masuk kembali dengan sandi baru");
		await page.locator(".modal.show input[data-fieldname='new_password']").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
		await tidur(1500);
		await page.keyboard.press("Escape"); // the Settings window
		await tidur(700);
		await lalu();
		await klik(page.locator(".sidebar-user-button:visible").first());
		await tidur(800);
		await klik(page.getByText(/^(Keluar|Logout)$/).locator("visible=true").last());
		await tidur(900);
		await klik(page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first());
		await page.waitForURL(/\/login/, { timeout: 30000 });
		await tunggu(1500);
		await isiMasuk(SANDI_BARU);
		await klik(page.locator("button[type=submit]:visible").first());
		await bukaApp();
		// 10
		bab("Tiga menu utama");
		await teks("Terdapat 3 menu utama");
		await zoom(sisi("daily-input"), 1.6);
		await ke(sisi("production-floor"));
		await tidur(500);
		await ke(sisi("daily-input"));
		await tidur(500);
		await ke(page.locator(".body-sidebar .section-break").filter({ hasText: "Produksi" }).first());
		await tungguSuara();
		await zoom(null);
		// 11
		await teks("Lantai Produksi menampilkan status semua mesin");
		await klik(sisi("production-floor"));
		await page.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 60000 });
		await page.locator(".memuat").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await lalu();
		await ke(page.locator(".panel, .perhatian, tr[data-mesin]").first());
		// 12
		await tungguSuara();
		await klik(page.locator(".kembali").first());
		await tunggu(1500);
		await klik(sisi("daily-input"));
		await bukaInputHarian();
		await teks("Input Harian: catat hasil setiap shift");
		await lalu();
		await ke(page.locator("section[data-wo] thead").first());
		// 13
		await teks("Produksi: perintah, laporan, dan kapasitas");
		await ke(page.locator(".body-sidebar .section-break").filter({ hasText: "Produksi" }).first());
		await tidur(500);
		await klik(page.locator('.body-sidebar a[href="/desk/manufacturing"]').first());
		await tunggu(1500);
		const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();
		for (const k of [/Perintah Produksi/, /Rencana vs Aktual/, /Kapasitas Mesin/]) {
			await ke(kartu(k));
			await tidur(700);
		}
		// 14
		bab("Halaman yang hanya dilihat");
		await teks("Perintah Produksi hanya dapat dilihat");
		await klik(kartu(/Perintah Produksi/));
		await tunggu(2000);
		await klik(page.locator(".list-row-container .list-subject a:visible").first());
		await page.waitForFunction(() => window.cur_frm?.doctype === "Work Order", null, { timeout: 30000 });
		await tunggu(1500);
		// The page head's right corner is empty for Produksi: no Save, no Submit (the actions box is hidden).
		await gerak(1330, 24);
		await tidur(800);
		await lalu();
		await ke(kolom("erp_mesin"));
		await tungguSuara();
		// 15
		await teks("Kapasitas Mesin hanya dapat dilihat");
		await klik(page.locator('.body-sidebar a[href="/desk/manufacturing"]').first());
		await tunggu(1500);
		await klik(kartu(/Kapasitas Mesin/));
		await tunggu(2000);
		await klik(page.locator(".list-row-container .list-subject a:visible").first());
		await page.waitForFunction(() => window.cur_frm?.doctype === "Machine Capacity", null, { timeout: 30000 });
		await tunggu(1500);
		await lalu();
		await ke(kolom("cycle_time"));
		await tungguSuara();
		// 16
		bab("Menu yang tidak tersedia");
		await teks("Stok, penjualan, dan pembelian tidak tersedia");
		for (const l of [sisi("production-floor"), sisi("daily-input"), page.locator(".body-sidebar .section-break").filter({ hasText: "Produksi" }).first()]) {
			await ke(l);
			await tidur(600);
		}
		await gerak(110, 560);
		await tungguSuara();
		// 17
		await teks("Kebutuhan lain disampaikan ke Admin");
		await klik(page.locator('.body-sidebar a[href="/desk/manufacturing"]').first());
		await tunggu(1500);
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	} catch (e) {
		const gambar = join(tmpdir(), `rekam-demo-gagal-${NAMA}.png`);
		await page.screenshot({ path: gambar }).catch(() => {});
		console.error(`failed at ${page.url()}; screenshot ${gambar}`);
		throw e;
	} finally {
		// The sample password and the language back, whichever step the take stopped at.
		if (!(await masuk(SANDI))) {
			if (!(await masuk(SANDI_BARU))) console.error(`could not sign in as ${user} to restore the password`);
			else {
				await page.goto(`${URL}/desk/manufacturing`);
				await tunggu();
				const h = await api("frappe.core.doctype.user.user.update_password", { new_password: SANDI, old_password: SANDI_BARU });
				if (!h.ok) console.error(`could not restore ${user}'s password: ${h.e}`);
			}
		}
		if (await masuk(SANDI)) {
			await page.goto(`${URL}/desk/manufacturing`);
			await tunggu();
			await api("erp_internal.bahasa.ganti", { lang: bahasaAsli });
		}
	}
}

// The Production Floor after a click that opens it, ready for clicks (data and first frame in).
async function bukaLantai() {
	await page.waitForFunction(() => window.erp?.lantai?.aktif, null, { timeout: 60000 });
	await page.locator(".memuat").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
	await tunggu(1500);
}
// A machine clicked in the 3D scene at its screen point (the label layer lets clicks through).
async function klikMesinLantai(nama) {
	const m = await page.evaluate((n) => erp.lantai.aktif.info().mesin.find((x) => x.nama === n), nama);
	const k = await page.locator(".lantai-host").boundingBox();
	if (!m?.layar) throw new Error(`${nama}: no screen point on the Production Floor`);
	await gerak(k.x + m.layar.x, k.y + m.layar.y);
	await tidur(acak(350, 650));
	await page.mouse.down();
	await tidur(80);
	await page.mouse.up();
	await page.locator(".panel:not([hidden])").first().waitFor({ timeout: 10000 });
	await tidur(1200);
}

// docs/video/lengkap-p2-operator-kerja-harian.md: every Produksi feature (about 8 minutes). Row numbers below are
// the script's. Mesin 05 is set Idle for the take (the attention card needs an active machine), and put back.
async function lengkapP2() {
	return ambil("user@example.com", ["Mesin 02", "Mesin 05"], async ({ hari }) => {
		await api("erp_internal.production_floor.set_status", { machine: "Mesin 05", status: "Idle" });
		const kemarin = await page.evaluate(() => frappe.datetime.add_days(frappe.datetime.get_today(), -1));
		await page.goto(`${URL}/desk/manufacturing/daily-input`);
		await bukaInputHarian();
		// A block with today's Shift 1 empty and no row for yesterday (row 22 adds it), made before yesterday.
		const WO = await page.evaluate(([h, k]) => {
			for (const s of document.querySelectorAll("section[data-wo]")) {
				const inp = s.querySelector(`input[data-key="${CSS.escape(`${h}|Shift 1`)}"]`);
				if (inp && !inp.value && !s.querySelector(`[data-key^="${CSS.escape(k)}|"]`)) return s.dataset.wo;
			}
			return null;
		}, [hari, kemarin]);
		if (!WO) throw new Error("No Daily Input block with today's Shift 1 empty and no row yesterday (run contoh.buat_contoh).");
		await page.goto(`${URL}/desk/manufacturing`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);

		// 1-2
		await teks("Kerja harian operator secara lengkap");
		await daftarIsi();
		// 3
		bab("Lantai Produksi");
		await teks("Lantai Produksi menampilkan semua mesin");
		await klik(sisi("production-floor"));
		await bukaLantai();
		await lalu();
		await gerak(900, 420);
		// 4
		await teks("Live: tampilan diperbarui secara langsung");
		await zoom(page.locator(".bar").first(), 1.6);
		await ke(page.locator(".pil.live").first());
		await lalu();
		await ke(page.locator(".jam").first());
		await tungguSuara();
		await zoom(null);
		// 5
		await teks("Ringkasan pabrik dalam satu baris");
		await zoom(page.locator(".kpi").first(), 1.5);
		for (const s of await page.locator(".kpi .sel").all()) {
			await ke(s);
			await tidur(500);
		}
		await tungguSuara();
		await zoom(null);
		// 6
		await teks("Orang dan barang jatuh hanya animasi");
		await zoom(page.locator(".simulasi").first(), 1.8);
		await tidur(1200);
		await zoom(null);
		await gerak(820, 480);
		await lalu();
		await ke(page.locator(".kpi").first());
		await tungguSuara();
		// 7
		await teks("Klik baris tabel untuk menuju mesin");
		await ke(page.locator(".tabel").first());
		await lalu();
		await klik(page.locator('.tabel tr[data-mesin="Mesin 03"]').first());
		await tidur(1500);
		// 8
		await teks("Panah untuk melipat atau membuka tabel");
		await klik(page.locator(".tabel .lipat").first());
		await tidur(1200);
		await klik(page.locator(".tabel .lipat").first());
		await tidur(1200);
		// 9
		await teks("Perlu perhatian: mesin yang tidak berjalan");
		await ke(page.locator(".perhatian").first());
		await lalu();
		await klik(page.locator('.perhatian li[data-mesin="Mesin 05"]').first());
		await tidur(1500);
		// 10
		await teks("Klik mesin untuk membuka panel detail");
		await page.locator(".panel .tutup").first().click().catch(() => {});
		await page.locator(".kamera .reset").first().click();
		await tidur(1200);
		await klikMesinLantai("Mesin 02");
		await lalu();
		await ke(page.locator(".panel .wo").first());
		await tungguSuara();
		// 11
		bab("Status mesin");
		await teks("Status Produksi, Pengaturan, dan Menganggur");
		await ke(page.locator('.panel button[data-status="Production"]'));
		await lalu();
		await pilihStatus("Setup");
		await lalu();
		await pilihStatus("Idle");
		// 12
		await teks("Status Masalah, Pemeliharaan, dan Mati");
		await pilihStatus("Problem");
		await lalu();
		await pilihStatus("Maintenance");
		await lalu();
		await ke(page.locator('.panel button[data-status="Off"]'));
		await tungguSuara();
		// 13
		await teks("Kembalikan status ke Produksi");
		await pilihStatus("Production");
		await lalu();
		await ke(page.locator('.label[data-mesin="Mesin 02"]'));
		await tungguSuara();
		// 14
		await teks("Mesin tidak aktif menolak perubahan status");
		await klik(page.locator('.tabel tr[data-mesin="Mesin 01"]').first());
		await tidur(1500);
		await klik(page.locator('.panel button[data-status="Production"]'));
		const catatan = page.locator(".panel .catatan:not([hidden])").first();
		await catatan.waitFor({ timeout: 15000 });
		await zoom(catatan, 1.8);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 15
		await teks("Tautan perintah produksi dan Buka mesin");
		await klik(page.locator('.tabel tr[data-mesin="Mesin 02"]').first());
		await tidur(1500);
		await klik(page.locator(".panel .wo a").first());
		await page.waitForFunction(() => window.cur_frm?.doctype === "Work Order", null, { timeout: 30000 });
		await tunggu(1500);
		await page.goBack();
		await bukaLantai();
		await klik(page.locator('.tabel tr[data-mesin="Mesin 02"]').first());
		await tidur(1500);
		await lalu();
		await ke(page.locator(".panel .buka").first());
		await lalu();
		await klik(page.locator(".panel .tutup").first());
		// 16
		await teks("Putar, perbesar, dan tombol rumah");
		const lantai = await page.locator(".lantai-host").boundingBox();
		await gerak(lantai.x + lantai.width * 0.6, lantai.y + lantai.height * 0.55);
		await page.mouse.down();
		await gerak(lantai.x + lantai.width * 0.72, lantai.y + lantai.height * 0.5);
		await page.mouse.up();
		for (let i = 0; i < 4; i++) {
			await page.mouse.wheel(0, -120);
			await tidur(200);
		}
		await lalu();
		await klik(page.locator(".kamera .zum-masuk").first());
		await tidur(700);
		await klik(page.locator(".kamera .zum-keluar").first());
		await tidur(700);
		await klik(page.locator(".kamera .reset").first());
		await tidur(1200);
		// 17
		bab("Input Harian");
		await teks("Input Harian: lembar satu minggu");
		await klik(page.locator(".kembali").first());
		await tunggu(1500);
		await klik(sisi("daily-input"));
		await bukaInputHarian();
		await lalu();
		const blok = page.locator(`section[data-wo="${WO}"]`);
		await ke(blok.locator("thead").first());
		await tungguSuara();
		// 18
		await teks("Pindah minggu dan saring per mesin");
		const alat = page.locator(".erp-ih-alat button");
		await klik(alat.nth(0));
		await bukaInputHarian();
		await klik(alat.nth(2));
		await bukaInputHarian();
		await klik(alat.nth(1));
		await bukaInputHarian();
		await lalu();
		const saring = page.locator("select.erp-ih-mesin");
		await klik(saring);
		await saring.selectOption({ index: 1 });
		await tidur(1500);
		await saring.selectOption("");
		await tidur(1000);
		// 19
		await teks("Isi nama teknisi pagi dan malam");
		const pagi = page.locator(".erp-ih-teknisi").nth(0);
		const malam = page.locator(".erp-ih-teknisi").nth(1);
		await zoom(pagi, 1.6);
		await klik(pagi);
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.press("Backspace");
		await ketik("Yudi");
		await klik(malam);
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.press("Backspace");
		await ketik("Fadli");
		await page.keyboard.press("Tab");
		await lalu();
		await ke(page.locator(".erp-ih-info").first());
		await tungguSuara();
		await zoom(null);
		// 20
		bab("Mengisi hasil per shift");
		const shift1 = blok.locator(`input[data-key="${hari}|Shift 1"]`);
		const shift2 = blok.locator(`input[data-key="${hari}|Shift 2"]`);
		await teks("Ketik jumlah barang bagus, lalu tekan Enter atau Tab");
		await zoom(shift1, 1.8);
		await klik(shift1);
		await ketik("1.250");
		await page.keyboard.press("Enter");
		await tidur(1200);
		await klik(shift2);
		await ketik("1.180");
		await page.keyboard.press("Tab");
		await tidur(1200);
		await lalu();
		await ke(blok.locator(".erp-ih-semua"));
		await tungguSuara();
		// 21
		await teks("Catat kejadian pada kolom Keterangan");
		const ket = blok.locator("tr").filter({ has: page.locator(`input[data-key="${hari}|Shift 1"]`) }).locator("td.erp-ih-ket input");
		await klik(ket);
		await ketik("Ganti cetakan jam 10");
		await page.keyboard.press("Enter");
		await tidur(1200);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 22
		await teks("Hari sebelumnya: gunakan Tambah tanggal");
		await klik(blok.locator(".erp-ih-tambah button").first());
		const tgl = blok.locator('.erp-ih-tambah input[type="date"]').first();
		await tgl.waitFor({ state: "visible", timeout: 10000 });
		await tidur(800);
		await tgl.fill(kemarin);
		await tgl.dispatchEvent("change");
		const kemarin1 = blok.locator(`input[data-key="${kemarin}|Shift 1"]`);
		await kemarin1.waitFor({ state: "visible", timeout: 15000 });
		await tidur(800);
		await klik(kemarin1);
		await ketik("900");
		await page.keyboard.press("Tab");
		await tidur(1200);
		await lalu();
		await ke(blok.locator(".erp-ih-tambah button").first());
		await tungguSuara();
		// 23
		await teks("Ganti angka atau kosongkan kotak");
		await zoom(shift1, 1.6);
		await klik(shift1);
		await page.keyboard.press("ControlOrMeta+A");
		await ketik("1.300");
		await page.keyboard.press("Enter");
		await tidur(1500);
		await lalu();
		await klik(kemarin1);
		await page.keyboard.press("ControlOrMeta+A");
		await page.keyboard.press("Backspace");
		await page.keyboard.press("Enter");
		await tidur(1500);
		await tungguSuara();
		await zoom(null);
		// 24
		await teks("Angka bergaris bawah dibuka melalui form");
		const garis = page.locator(`section[data-wo]:not([data-wo="${WO}"]) td a`).filter({ hasText: /\d/ }).first();
		await zoom(garis, 1.8);
		await ke(garis);
		await lalu();
		await klik(garis);
		await page.waitForFunction(() => window.cur_frm?.doctype === "Production Entry" && !cur_frm.doc.__islocal, null, { timeout: 30000 });
		await tunggu(1200);
		await zoom(page.locator('[data-fieldname="rejects"]').first(), 1.4);
		await tungguSuara();
		await zoom(null);
		// 25
		bab("Cetak dan Excel");
		await teks("Cetak atau unduh rekap mingguan dalam Excel");
		await page.goBack();
		await bukaInputHarian();
		const cetakIH = page.locator(".erp-ih-alat button").filter({ hasText: /Cetak|Print/ }).first();
		const excel = page.locator(".erp-ih-alat button").filter({ hasText: /Excel/ }).first();
		await zoom(cetakIH, 1.6);
		page.once("popup", (p) => setTimeout(() => p.close().catch(() => {}), 2500));
		await klik(cetakIH);
		await tidur(2500);
		await lalu();
		await klik(excel);
		await tungguSuara();
		await zoom(null);
		// 26: the phone view, drawn as a 390 px wide frame over the page (every video frame keeps 1440x810)
		await teks("Dapat digunakan di ponsel");
		await page.evaluate((src) => {
			const latar = document.createElement("div");
			latar.id = "demo-ponsel";
			Object.assign(latar.style, { position: "fixed", inset: "0", background: "rgba(15,23,42,.72)", zIndex: 2147483000, display: "grid", placeItems: "center" });
			const f = document.createElement("iframe");
			f.src = src;
			Object.assign(f.style, { width: "390px", height: "640px", border: "10px solid #111", borderRadius: "28px", background: "#fff", marginBottom: "90px" });
			latar.appendChild(f);
			document.documentElement.appendChild(latar);
		}, `${URL}/desk/manufacturing/daily-input`);
		const ponsel = page.frameLocator("#demo-ponsel iframe");
		await ponsel.locator("section[data-wo]").first().waitFor({ timeout: 30000 });
		await tidur(2500);
		await lalu();
		await gerak(720, 380);
		await tungguSuara();
		await page.evaluate(() => document.getElementById("demo-ponsel")?.remove());
		// 27
		bab("Reject lewat form Hasil Produksi");
		await teks("Reject dicatat melalui form Hasil Produksi");
		await page.goto(`${URL}/desk/production-entry`);
		await tunggu(1500);
		await baru();
		await isiLink("work_order", WO, WO);
		await ke(kolom("workstation"));
		await ke(kolom("posting_date"));
		await pilihSelect("shift", "Shift 1");
		await lalu();
		await zoom(kolom("hours"), 1.8);
		await tungguSuara();
		await zoom(null);
		// 28
		await teks("Jumlah Bagus 0, satu baris reject untuk setiap alasan");
		await isiKolom("good_qty", "0");
		await lalu();
		await isiSel("rejects", 1, "reason", "Short", "Short Shot");
		await isiSel("rejects", 1, "qty", "35");
		await lalu();
		await ke(kolom("reject_qty"));
		await tungguSuara();
		// 29
		await teks("Simpan, lalu Kirim");
		await simpan();
		await ajukan();
		await ke(page.locator(".title-area .page-indicator-pill:visible").first());
		await lalu();
		// Produksi does not see the Stock Entry section: the Reject table's description says where rejects go.
		await zoom(kolom("rejects"), 1.6);
		await tungguSuara();
		await zoom(null);
		// 30
		await teks("Salah isi? Klik Batalkan, lalu Amendemen");
		await klik(page.locator(".page-actions button:visible").filter({ hasText: /^\s*(Batalkan|Cancel)\s*$/ }).first());
		await tidur(900);
		await klik(page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first());
		await page.waitForFunction(() => window.cur_frm?.doc?.docstatus === 2, null, { timeout: 60000 });
		await tunggu(1500);
		await lalu();
		await klik(page.locator(".page-actions .primary-action:visible").first());
		await page.waitForFunction(() => window.cur_frm?.doc?.__islocal && cur_frm.doc.amended_from, null, { timeout: 30000 });
		await tunggu(1500);
		// 31
		bab("Rencana vs Aktual");
		await teks("Rencana vs Aktual: perbandingan target dan hasil");
		await page.goto(`${URL}/desk/manufacturing`);
		await tunggu(1500);
		await klik(page.locator(".body-sidebar").getByText("Rencana vs Aktual", { exact: true }).first());
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		await zoom(page.locator(".page-form:visible").first(), 1.4);
		await lalu();
		await ke(page.locator('.page-form:visible [data-fieldname="from_date"]').first());
		await ke(page.locator('.page-form:visible [data-fieldname="to_date"]').first());
		await tungguSuara();
		await zoom(null);
		// 32
		await teks("Kelompokkan per mesin, hari, atau shift");
		const kelompok = page.locator('.page-form:visible [data-fieldname="group_by"] select').first();
		await klik(kelompok);
		await kelompok.selectOption("Shift");
		await tunggu(1500);
		await kelompok.selectOption("Item");
		await tunggu(1500);
		await lalu();
		await ke(page.locator('.page-form:visible [data-fieldname="target_dari"]').first());
		await tungguSuara();
		// 33
		await teks("Hijau tercapai, oranye hampir, merah kurang");
		const pil = page.locator(".dt-row:visible .indicator-pill").first();
		if (await pil.count()) await zoom(pil, 1.8);
		await lalu();
		await zoom(null);
		await ke(page.locator(".dt-header, .dt-row-header").first());
		await tungguSuara();
		// 34
		bab("Membaca perintah produksi");
		await teks("Membaca perintah produksi");
		await page.goto(`${URL}/desk/work-order/${WO}`);
		await page.waitForFunction(() => window.cur_frm?.doctype === "Work Order", null, { timeout: 30000 });
		await tunggu(1500);
		await ke(page.locator(".title-area .page-indicator-pill:visible").first());
		await ke(kolom("qty"));
		await ke(kolom("produced_qty"));
		await ke(kolom("erp_mesin"));
		await lalu();
		const oranye = page.locator(".form-dashboard .alert:visible, .form-headline:visible").first();
		if (await oranye.count()) await ke(oranye);
		await tungguSuara();
		// 35
		await teks("Catat Hasil membuka kotak perintah tersebut");
		await klik(page.getByRole("button", { name: /Catat Hasil|Record Output/ }).first());
		await bukaInputHarian();
		await lalu();
		await klik(page.locator(".erp-ih-alat button").filter({ hasText: /Tampilkan semua|Show all/ }).first());
		await bukaInputHarian();
		// 36
		await teks("Setiap shift: status mesin, lalu catat hasil");
		await klik(sisi("production-floor"));
		await bukaLantai();
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	});
}

// A card drawn over the page for a few seconds (a table the editor would otherwise add): rows of [title, text].
async function kartuLayar(judul, baris) {
	await page.evaluate(([judul, baris]) => {
		const latar = document.createElement("div");
		latar.id = "demo-kartu";
		Object.assign(latar.style, { position: "fixed", inset: "0", background: "rgba(15,23,42,.55)", zIndex: 2147483000, display: "grid", placeItems: "center", opacity: "0", transition: "opacity .4s" });
		const isi = baris.map(([a, b]) => `<tr><td style="padding:14px 22px;font-weight:700;white-space:nowrap">${a}</td><td style="padding:14px 22px">${b}</td></tr>`).join("");
		latar.innerHTML = `<div style="background:#fff;border-radius:20px;padding:30px 36px;margin-bottom:110px;max-width:980px;font:500 24px/1.4 Inter,system-ui,sans-serif;color:#0f172a;box-shadow:0 20px 60px #0005">
			<div style="font-size:30px;font-weight:700;margin-bottom:14px">${judul}</div><table style="border-collapse:collapse">${isi}</table></div>`;
		document.documentElement.appendChild(latar);
		requestAnimationFrame(() => (latar.style.opacity = "1"));
	}, [judul, baris]);
	await tidur(800);
}
const tutupKartu = () => page.evaluate(() => document.getElementById("demo-kartu")?.remove());

// docs/video/lengkap-a1-admin-mulai.md: an Admin's first steps (about 6 minutes). Starts signed out in English; row 5
// really changes admin@'s password and the end puts the sample one back; the user budi@ made in rows 12-17 is deleted.
async function lengkapA1() {
	const user = "admin@example.com";
	const BUDI = "budi@example.com";
	const SANDI_BARU = "PabrikDelta#2026";
	const masuk = async (sandi) => (await page.request.post(`${URL}/api/method/login`, { form: { usr: user, pwd: sandi } })).ok();
	if (!(await masuk(SANDI))) throw new Error(`login ${user}`);
	await page.goto(`${URL}/desk/home`);
	await tunggu();
	const bahasaAsli = await page.evaluate(() => frappe.boot.lang || "en");
	if ((await api("frappe.client.get_count", { doctype: "User", filters: { name: BUDI } })).x) {
		throw new Error(`${BUDI} exists: delete it before the take`);
	}
	await api("erp_internal.bahasa.ganti", { lang: "en" });
	await ctx.clearCookies();
	const header = () => page.locator(".body-sidebar .sidebar-header").first();
	const judul = (t) => page.locator(".body-sidebar .section-break").filter({ hasText: t }).first();
	const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();
	try {
		await page.goto(`${URL}/login`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);

		// 1-2
		await teks("Halaman login dan versi aplikasi");
		await lalu();
		await lalu();
		await zoom(page.locator(".erp-versi:visible").first(), 2);
		await tungguSuara();
		await zoom(null);
		await daftarIsi();
		// 3
		bab("Masuk dan versi aplikasi");
		await teks("Masuk dengan email dan sandi");
		await klik(page.locator("#login_email"));
		await ketik(user);
		await klik(page.locator("#login_password"));
		await ketik(SANDI);
		await klik(page.locator("button[type=submit]:visible").first());
		await page.waitForURL(/\/desk/, { timeout: 30000 });
		await tunggu(2500);
		// The Apps screen on a sign-in that lands on /desk: open ERP.
		const erp = page.getByText("ERP", { exact: true }).first();
		if (await erp.isVisible().catch(() => false)) await klik(erp);
		await header().waitFor({ state: "visible", timeout: 30000 });
		await tunggu(1500);
		// 4
		bab("Bahasa dan sandi");
		await teks("Ganti bahasa: klik judul menu, pilih Bahasa Indonesia");
		await ke(header());
		await lalu();
		await klik(header());
		await tidur(800);
		await klik(page.getByText("Bahasa Indonesia", { exact: true }).locator("visible=true").first());
		await page.waitForFunction(() => window.frappe?.boot?.lang === "id", null, { timeout: 30000 });
		await tunggu(2000);
		// 5
		await teks("Ganti sandi di Pengaturan");
		await lalu();
		await klik(page.locator(".sidebar-user-button:visible").first());
		await tidur(800);
		await klik(page.getByText("Pengaturan", { exact: true }).locator("visible=true").last());
		await page.locator(".modal.show .change-password-btn").waitFor({ state: "visible", timeout: 30000 });
		await tunggu(1200);
		await lalu();
		await klik(page.locator(".modal.show .change-password-btn").first());
		const sandiBaru = page.locator('.modal.show input[data-fieldname="new_password"]').last();
		await sandiBaru.waitFor({ state: "visible", timeout: 15000 });
		await tidur(800);
		await klik(sandiBaru);
		await ketik(SANDI_BARU);
		await klik(page.locator(".modal.show .btn-modal-primary").filter({ hasText: /Ubah Kata sandi|Change Password/ }).last());
		await page.locator(".modal.show input[data-fieldname='new_password']").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
		await tidur(1500);
		await page.keyboard.press("Escape");
		await tidur(700);
		// 6
		bab("Menu dan halaman depan");
		await teks("Seluruh menu Admin terdapat di sisi kiri");
		await ke(sisi("production-floor"));
		await tidur(400);
		await ke(sisi("daily-input"));
		await lalu();
		for (const t of ["Stok", "Penjualan", "Pembelian", "Produksi", "Proyek", "SDM", "Pengaturan"]) {
			const l = judul(t);
			if (await l.isVisible().catch(() => false)) {
				await ke(l);
				await tidur(350);
			}
		}
		// 7
		await teks("Klik judul untuk membuka atau menutup");
		await klik(judul("Stok"));
		await tidur(1000);
		await klik(judul("Stok"));
		await tidur(800);
		await lalu();
		await gerak(110, 600);
		await tungguSuara();
		// 8
		await teks("Setiap kartu memuat ikon, judul, angka, dan penjelasan");
		await menu("/desk/stock");
		await lalu();
		await zoom(kartu(/Barang|Item/), 2);
		await tungguSuara();
		await zoom(null);
		// 9
		await teks("Klik kartu untuk membuka halamannya");
		for (const k of [/Mutasi Stok/, /Surat Jalan/, /Gudang/, /Saldo Stok/]) {
			if (await kartu(k).isVisible().catch(() => false)) {
				await ke(kartu(k));
				await tidur(500);
			}
		}
		await lalu();
		await klik(kartu(/Saldo Stok/));
		await tunggu(2500);
		await page.goBack();
		await tunggu(1500);
		// 10
		bab("Menu Pengaturan");
		await teks("Pengaturan: pengguna, perusahaan, stok awal, reject, dan data");
		await menu("/desk/setup/home");
		for (const k of [/Pengguna/, /Perusahaan/, /Stok Awal/, /Alasan Reject/, /Data Belum Lengkap/]) {
			if (await kartu(k).isVisible().catch(() => false)) {
				await ke(kartu(k));
				await tidur(500);
			}
		}
		// 11
		await teks("Pengaturan usaha hanya untuk Super Admin");
		await gerak(800, 400);
		await lalu();
		await tungguSuara();
		// 12
		bab("Akun karyawan pabrik");
		await teks("Membuat akun untuk karyawan pabrik");
		await lalu();
		await klik(kartu(/Pengguna/));
		await tunggu(2000);
		await klik(page.locator(".page-actions .primary-action:visible").first());
		await page.locator('.modal.show [data-fieldname="email"] input').first().waitFor({ state: "visible", timeout: 30000 });
		await tunggu(1000);
		// 13: the New User dialog (quick entry)
		await teks("Isi email, nama, dan peran Produksi");
		const dlg = (f) => page.locator(`.modal.show .frappe-control[data-fieldname="${f}"]`).first();
		await klik(dlg("email").locator("input"));
		await ketik(BUDI);
		await klik(dlg("first_name").locator("input"));
		await ketik("Budi");
		await lalu();
		await klik(dlg("role_profiles").locator("input"));
		await pilihDariDaftar("Produksi", "Produksi");
		// A Table MultiSelect keeps its list open over the dialog's button: a click on the title closes it.
		await klik(page.locator(".modal.show .modal-title").first());
		await tidur(500);
		await lalu();
		await klik(page.locator(".modal.show .btn-modal-primary").first());
		// The dialog saves and stays on the list: open the new row.
		const barisBudi = page.locator(".list-row-container").filter({ hasText: BUDI }).locator(".list-subject a").first();
		await barisBudi.waitFor({ state: "visible", timeout: 30000 });
		await tunggu(1000);
		await klik(barisBudi);
		await page.waitForFunction((b) => window.cur_frm?.doc?.name === b, BUDI, { timeout: 30000 });
		await tunggu(1500);
		// 14
		await teks("Isi Profil Modul sesuai perannya");
		const tab = (i) => page.locator(".form-tabs:visible .nav-link").nth(i); // 0 User Details, 1 Roles & Permissions
		await klik(tab(1));
		await tidur(800);
		await isiLink("module_profile", "Produksi", "Produksi");
		await lalu();
		await simpan();
		// 15
		await teks("Produksi hanya mencatat hasil produksi");
		await kartuLayar("Tiga peran", [
			["Produksi", "Mencatat hasil produksi dan status mesin"],
			["Admin", "Pesanan, gudang, barang, dan pengguna"],
			["Super Admin", "Seluruhnya, termasuk pengaturan usaha"],
		]);
		await lalu();
		await tungguSuara();
		await tutupKartu();
		// 16: Super Admin added to Role Profiles and saved: the server refuses (pengguna.py), the form reloads clean
		await teks("Admin hanya memberi peran Produksi atau Admin");
		await klik(kolom("role_profiles").locator("input").first());
		await pilihDariDaftar("Super", "Super Admin");
		await klik(page.locator(".page-actions .primary-action:visible").first());
		const tolak = page.locator(".modal.show .modal-content").filter({ hasText: /peran|roles/ }).first();
		await tolak.waitFor({ state: "visible", timeout: 30000 });
		await tidur(800);
		await zoom(tolak, 1.4);
		await lalu();
		await tungguSuara();
		await zoom(null);
		await page.keyboard.press("Escape");
		await tidur(600);
		await muatUlangForm();
		await tunggu(1500);
		// 17
		await teks("Sandi terlupa atau karyawan berhenti bekerja");
		const labelSandi = await page.evaluate(() => encodeURIComponent(__("Password")));
		await klik(page.locator(`.page-actions .inner-group-button[data-label="${labelSandi}"] button`).first());
		await tidur(700);
		await ke(page.locator('[role="menuitem"]:visible').filter({ hasText: /Ubah Kata sandi|Change Password/ }).first());
		await tidur(800);
		await page.keyboard.press("Escape");
		await lalu();
		await klik(tab(0));
		await tidur(800);
		await ke(kolom("enabled"));
		await tungguSuara();
		// 18
		bab("Data perusahaan");
		await teks("Data perusahaan");
		await menu("/desk/setup/home");
		await klik(kartu(/Perusahaan/));
		await tunggu(2000);
		await lalu();
		if (!(await page.evaluate(() => window.cur_frm?.doctype === "Company"))) {
			await klik(page.locator(".list-row-container .list-subject a:visible").first());
		}
		await page.waitForFunction(() => window.cur_frm?.doctype === "Company", null, { timeout: 30000 });
		await tunggu(1500);
		// 19
		await teks("Periksa nama, singkatan, dan mata uang");
		await ke(page.locator(".title-area .es-breadcrumbs__label:visible").last());
		await ke(kolom("abbr"));
		await ke(kolom("default_currency"));
		await lalu();
		await tungguSuara();
		// 20
		bab("Data Belum Lengkap");
		await teks("Periksa data yang belum lengkap");
		await menu("/desk/setup/home");
		await klik(kartu(/Data Belum Lengkap/));
		await page.waitForSelector(".dt-row", { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		const tautan = page.locator(".dt-row:visible a.erp-perbaiki").first();
		if (await tautan.count()) await ke(tautan);
		await lalu();
		await tungguSuara();
		// 21
		await teks("Berikutnya: data barang");
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	} catch (e) {
		const gambar = join(tmpdir(), `rekam-demo-gagal-${NAMA}.png`);
		await page.screenshot({ path: gambar }).catch(() => {});
		console.error(`failed at ${page.url()}; screenshot ${gambar}`);
		throw e;
	} finally {
		if (!(await masuk(SANDI))) {
			if (!(await masuk(SANDI_BARU))) console.error(`could not sign in as ${user} to restore the password`);
			else {
				await page.goto(`${URL}/desk/home`);
				await tunggu();
				const h = await api("frappe.core.doctype.user.user.update_password", { new_password: SANDI, old_password: SANDI_BARU });
				if (!h.ok) console.error(`could not restore ${user}'s password: ${h.e}`);
			}
		}
		if (await masuk(SANDI)) {
			await page.goto(`${URL}/desk/home`);
			await tunggu();
			await api("erp_internal.bahasa.ganti", { lang: bahasaAsli });
		}
		await hapusSebagaiSuperAdmin("User", BUDI);
	}
}
// A party (Supplier, Customer) a take made, with the take's cancelled documents that still name it (ERPNext
// refuses to delete a party any document links, cancelled or not): deleted as the Super Admin.
async function hapusPihak(doctype, name, field, dokumen) {
	await hapusSebagaiSuperAdmin(doctype, "__none__"); // signs in as developer@
	for (const dt of dokumen) {
		const f = dt === "Payment Entry" ? "party" : field;
		const r = (await api("frappe.client.get_list", { doctype: dt, filters: { [f]: name, docstatus: 2 }, fields: ["name"], limit_page_length: 50 })).x || [];
		for (const { name: n } of r) {
			const h = await api("frappe.client.delete", { doctype: dt, name: n });
			if (!h.ok) console.error(`could not delete ${dt} ${n}: ${h.e}`);
		}
	}
	await hapusSebagaiSuperAdmin(doctype, name);
	// A cancelled invoice or payment keeps its ledger rows and cannot be deleted, so neither can the party: it is
	// renamed aside and disabled, which frees the name for the next take.
	if ((await api("frappe.client.get_count", { doctype, filters: { name } })).x) {
		const lama = `${name} (uji ${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")})`;
		const r = await api("frappe.client.rename_doc", { doctype, old_name: name, new_name: lama });
		if (!r.ok) return console.error(`could not rename ${doctype} ${name}: ${r.e}`);
		await api("frappe.client.set_value", { doctype, name: lama, fieldname: "disabled", value: 1 });
		console.log(`${doctype} ${name} renamed to ${lama} and disabled`);
	}
}
// An Admin may not delete a User: the sample Super Admin (developer@) deletes what a take made. Leaves the page
// signed in as developer@.
async function hapusSebagaiSuperAdmin(doctype, name) {
	const r = await page.request.post(`${URL}/api/method/login`, { form: { usr: "developer@example.com", pwd: SANDI } });
	if (!r.ok()) return console.error(`could not sign in as developer@ to delete ${doctype} ${name}`);
	await page.goto(`${URL}/desk/home`);
	await tunggu();
	if (!(await api("frappe.client.get_count", { doctype, filters: { name } })).x) return;
	const h = await api("frappe.client.delete", { doctype, name });
	if (!h.ok) console.error(`could not delete ${doctype} ${name}: ${h.e}`);
}

// A report filter set the way the filter bar would (some are multi-select boxes with a hidden input): the cursor
// points at the filter, then the value goes in and the report refreshes.
async function saringLaporan(nama, nilai) {
	const f = page.locator(`.page-form:visible .frappe-control[data-fieldname="${nama}"]`).first();
	await ke(f);
	await page.evaluate(([n, v]) => frappe.query_report.set_filter_value(n, v), [nama, nilai]);
	await tunggu(2500);
}
// A prepared (background) report such as Stock Balance: after its filters, click Generate New Report and wait for
// the rows (the bench's worker makes it).
async function hasilkanLaporan() {
	const t = page.locator(".page-actions button:visible").filter({ hasText: /Hasilkan Laporan Baru|Generate New Report/ }).first();
	if (await t.count()) await klik(t);
	await page.waitForSelector(".dt-row", { timeout: 180000 }).catch(() => {});
	await tunggu(1500);
}
// The open form read again from the server; a route change at that moment (a saved new form gets its name in the
// URL) destroys the page context, so it waits for the page and tries once more.
async function muatUlangForm() {
	await tidur(500);
	await page.evaluate(() => cur_frm.reload_doc()).catch(async () => {
		await page.waitForLoadState("domcontentloaded").catch(() => {});
		await tidur(1500);
		await page.evaluate(() => cur_frm.reload_doc());
	});
}
// A form's tab by its position (0 = the first).
const tabForm = (i) => page.locator(".form-tabs:visible .nav-link").nth(i);
// Opens a form by URL and waits until it is drawn.
async function bukaForm(path, doctype) {
	await page.goto(`${URL}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
	await page.waitForFunction((d) => window.cur_frm?.doctype === d && !cur_frm.doc.__islocal, doctype, { timeout: 30000 });
	await tunggu(1500);
}
// Opens an item of a form's button group (View, Create, ...), labels looked up translated.
async function menuGrup(grup, item) {
	const [g, i] = await page.evaluate(([g, i]) => [encodeURIComponent(__(g)), __(i)], [grup, item]);
	await klik(page.locator(`.page-actions .inner-group-button[data-label="${g}"] button`).first());
	await tidur(700);
	await klik(page.locator('[role="menuitem"]:visible').filter({ hasText: i }).first());
}
// A caption with nothing else happening: the row's sentences are read over a still screen.
async function jeda() {
	while (sisaKalimat.length) await lalu();
	await tungguSuara();
}

// docs/video/lengkap-a2-data-barang.md: item data (about 6 minutes). Row 14 makes a pigment variant for a colour
// that has none; the end disables it again (its BOMs are remade without it).
async function lengkapA2() {
	let pigmenBaru = null;
	try {
		return await ambil("admin@example.com", [], async () => {
			// A colour of a product with no pigment yet (Missing Data's pigment rows), found, not assumed.
			const warna = await page.evaluate(async () => {
				const r = await frappe.xcall("frappe.desk.query_report.run", { report_name: "Missing Data", filters: { company: frappe.defaults.get_user_default("Company") } });
				// A colour with no PIGMEN variant at all (an earlier take leaves its own disabled, not deleted).
				for (const b of (r.result || []).filter((x) => x.cek === "pigmen")) {
					const w = String(b.rincian || "").split(",")[0].trim();
					const nilai = (await frappe.xcall("frappe.client.get", { doctype: "Item Attribute", name: "Warna" })).item_attribute_values.find((v) => v.attribute_value === w);
					if (nilai && !(await frappe.xcall("frappe.client.get_count", { doctype: "Item", filters: { name: `PIGMEN-${nilai.abbr}` } }))) return w;
				}
				return null;
			});
			if (!warna) throw new Error("No colour without a pigment (Missing Data): add one to the sample first.");
			await page.goto(`${URL}/desk/home`);
			await tunggu(1500);
			await mulaiRekam();
			await tidur(600);
			const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();

			// 1-2
			await teks("Data barang: produk, bahan, dan kemasan");
			await menu("/desk/stock");
			await lalu();
			await klik(kartu(/Barang/));
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1500);
			await daftarIsi();
			// 3
			bab("Grup barang");
			await teks("4 grup: Barang Jadi, Bahan Baku, Kemasan, Pigmen");
			const grup = page.locator(".list-row-head, .list-row-container").first();
			await zoom(grup, 1.4);
			await lalu();
			for (const g of ["Barang Jadi", "Bahan Baku", "Kemasan", "Pigmen"]) {
				const c = page.locator(".list-row-container").filter({ hasText: g }).first();
				if (await c.isVisible().catch(() => false)) {
					await ke(c);
					await tidur(400);
				}
			}
			await tungguSuara();
			await zoom(null);
			// 4
			bab("Template dan varian");
			await teks("Template adalah induk, varian adalah turunannya");
			await bukaForm("/desk/stock/item/GAYUNG-LUMBA", "Item");
			await ke(kolom("has_variants"));
			await lalu();
			await klik(tabForm(5));
			await tidur(900);
			await zoom(kolom("attributes"), 1.5);
			await tungguSuara();
			await zoom(null);
			// 5
			await teks("Kode varian: kode template, jenis, dan warna");
			await menuGrup("View", "Show Variants");
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1500);
			const varian = page.locator(".list-row-container").filter({ hasText: "GAYUNG-LUMBA-" }).first();
			await ke(varian);
			await lalu();
			await tungguSuara();
			// 6
			bab("Varian Seal Cap");
			await teks("Seal Cap: atribut Merk dan Warna");
			await bukaForm("/desk/stock/item/SEAL-CAP", "Item");
			await klik(tabForm(5));
			await tidur(900);
			await zoom(kolom("attributes"), 1.5);
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 7
			await teks("Varian baru: Buat, lalu Varian tunggal");
			await menuGrup("Create", "Single Variant");
			const dialog = page.locator(".modal.show .modal-content").first();
			await dialog.waitFor({ state: "visible", timeout: 15000 });
			await tidur(1000);
			await lalu();
			await zoom(dialog, 1.3);
			await lalu();
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			await tidur(700);
			// 8
			bab("Tabel Packing dan kemasan");
			await teks("Tabel Packing: kemasan dan isinya");
			await bukaForm("/desk/stock/item/SEAL-CAP-MHG-CKM", "Item");
			await zoom(kolom("erp_kemasan"), 1.5);
			await lalu();
			await tungguSuara();
			// 9
			await teks("Tabel di template berlaku untuk semua varian");
			await ke(kolom("erp_kemasan").locator('[data-fieldname="pieces"]').first());
			await tidur(800);
			await zoom(null);
			await bukaForm("/desk/stock/item/GAYUNG-LUMBA", "Item");
			await ke(kolom("erp_kemasan"));
			await lalu();
			await tungguSuara();
			// 10
			await teks("Barang kemasan: grup Kemasan, satuan Buah");
			await bukaForm("/desk/stock/item/Karung", "Item");
			await zoom(kolom("item_group"), 1.8);
			await ke(kolom("stock_uom"));
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 11
			await teks("Terima stok kemasan sebelum mengisi tabel Packing");
			await jeda();
			// 12
			bab("Pigmen");
			await teks("Pigmen: stok dalam gram, dibeli per kilogram (Kg)");
			await bukaForm("/desk/stock/item/PIGMEN", "Item");
			await ke(kolom("item_group"));
			await ke(kolom("stock_uom"));
			await lalu();
			await klik(tabForm(6));
			await tidur(900);
			await ke(kolom("purchase_uom"));
			await tungguSuara();
			// 13
			await teks("Satu varian untuk setiap warna, beserta rasionya");
			await bukaForm("/desk/stock/item/PIGMEN-HJU", "Item");
			await lalu();
			await zoom(kolom("erp_rasio_pigmen"), 1.8);
			await tungguSuara();
			await zoom(null);
			// 14
			await teks("Pigmen baru: Buat, Varian, lalu pilih warna");
			await bukaForm("/desk/stock/item/PIGMEN", "Item");
			await menuGrup("Create", "Single Variant");
			await dialog.waitFor({ state: "visible", timeout: 15000 });
			await tidur(800);
			await lalu();
			const isian = page.locator(".modal.show .frappe-control input:visible").first();
			await klik(isian);
			await pilihDariDaftar(warna, warna);
			await klik(page.locator(".modal.show .btn-modal-primary").first());
			await page.waitForFunction(() => window.cur_frm?.doctype === "Item" && cur_frm.doc.variant_of === "PIGMEN" && cur_frm.doc.__islocal, null, { timeout: 30000 });
			await tunggu(1500);
			await lalu();
			await isiKolom("erp_rasio_pigmen", "1");
			await simpan();
			pigmenBaru = await page.evaluate(() => cur_frm.doc.name);
			// 15
			await teks("Terima stok pigmen baru terlebih dahulu");
			const catatan = page.locator(".form-message.orange:visible, .msgprint:visible, .alert-warning:visible").first();
			if (await catatan.count()) await zoom(catatan, 1.5);
			await lalu();
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			// 16
			bab("Daftar harga");
			await teks("Dua daftar harga: jual dan beli");
			await page.goto(`${URL}/desk/item-price?price_list=${encodeURIComponent("Harga Pola 2026")}`);
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1500);
			await lalu();
			await page.goto(`${URL}/desk/item-price?price_list=${encodeURIComponent("Harga Bahan Baku")}`);
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1500);
			await tungguSuara();
			// 17
			await teks("Satu harga untuk setiap barang dan satuan");
			await page.goto(`${URL}/desk/item-price?price_list=${encodeURIComponent("Harga Pola 2026")}`);
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1200);
			await klik(page.locator(".list-row-container .list-subject a:visible").first());
			await page.waitForFunction(() => window.cur_frm?.doctype === "Item Price", null, { timeout: 30000 });
			await tunggu(1200);
			for (const f of ["item_code", "price_list", "uom", "price_list_rate"]) await ke(kolom(f));
			await lalu();
			await page.goto(`${URL}/desk/item-price?price_list=${encodeURIComponent("Harga Bahan Baku")}&item_code=${encodeURIComponent("PIGMEN-HJU")}`);
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1200);
			await klik(page.locator(".list-row-container .list-subject a:visible").first());
			await page.waitForFunction(() => window.cur_frm?.doctype === "Item Price", null, { timeout: 30000 });
			await tunggu(1200);
			await ke(kolom("uom"));
			await zoom(kolom("price_list_rate"), 1.8);
			await tungguSuara();
			await zoom(null);
			// 18
			await teks("Seal Cap tidak memerlukan harga jual");
			await jeda();
			// 19
			bab("Merek Seal Cap");
			await teks("Merek: kode merek dan jumlah insert");
			await menu("/desk/stock");
			await klik(kartu(/Merek/));
			await tunggu(1500);
			await bukaForm("/desk/stock/brand/APP", "Brand");
			await ke(kolom("erp_jumlah_insert"));
			await ke(kolom("description"));
			await lalu();
			await tungguSuara();
			// 20
			bab("Catatan oranye");
			await teks("Catatan oranye: data yang belum lengkap");
			await bukaForm("/desk/stock/item/GAYUNG-LUMBA", "Item");
			const oranye = page.locator(".form-message.orange:visible").first();
			await zoom(oranye, 1.5);
			await lalu();
			await tungguSuara();
			// 21
			await teks("Klik tautan untuk langsung memperbaikinya");
			await klik(oranye.locator("a").first());
			await tunggu(1500);
			await zoom(null);
			await ke(kolom("erp_kemasan"));
			await lalu();
			await tungguSuara();
			// 22
			await teks("Berikutnya: mesin dan resep");
			await page.goto(`${URL}/desk/home`);
			await tunggu(1500);
			await lalu();
			await tungguSuara();
			await tidur(800);
			await teks("");
			await tidur(700);
			return await selesaiRekam();
		}, []);
	} finally {
		if (pigmenBaru) {
			const h = await api("frappe.client.set_value", { doctype: "Item", name: pigmenBaru, fieldname: "disabled", value: 1 });
			if (!h.ok) console.error(`could not disable ${pigmenBaru}: ${h.e}`);
			else console.log(`disabled the take's pigment ${pigmenBaru}`);
		}
	}
}

// docs/video/lengkap-a3-mesin-dan-resep.md: machines, capacity rows, BOMs, the import (about 6 minutes). Writes
// nothing: Make BOMs on an up-to-date row keeps its BOMs, the import's rows are all Unchanged, the Work Order is
// never saved.
async function lengkapA3() {
	return ambil("admin@example.com", [], async () => {
		const csv = join(FOLDER, "kapasitas-seal-cap.csv");
		writeFileSync(csv, 'Kode Barang,Mesin,Cycle Time,Cavity,Berat,Runner,Bahan\nSEAL-CAP,Mesin 04,14,20,"0,88",0,BB-SEAL-CAP\nSEAL-CAP,Mesin 14,14,20,"0,88",0,BB-SEAL-CAP\n');
		const kap = (await api("frappe.client.get_list", { doctype: "Machine Capacity", filters: { item: "SEAL-CAP", workstation: "Mesin 04" }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
		if (!kap) throw new Error("No Machine Capacity row SEAL-CAP on Mesin 04 (run master.muat).");
		const varianSeal = (await api("frappe.client.get_list", { doctype: "Item", filters: { variant_of: "SEAL-CAP", disabled: 0 }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);

		// 1-2
		await teks("Mesin dan resep produk");
		await klik(page.locator(".body-sidebar .section-break").filter({ hasText: "Produksi" }).first());
		await tidur(800);
		await lalu();
		await daftarIsi();
		// 3
		bab("Data mesin");
		await teks("14 mesin: Mesin 01 sampai 14");
		await page.goto(`${URL}/desk/workstation`);
		await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
		await tunggu(1500);
		await ke(page.locator(".list-row-container").first());
		await ke(page.locator(".list-row-container").last());
		await tungguSuara();
		// 4
		await teks("Data setiap mesin");
		await bukaForm("/desk/workstation/Mesin 04", "Workstation");
		// The Workstation form opens on Job Cards: Details (1) holds the machine data and Disabled, tab 2 the status.
		await klik(tabForm(1));
		await tidur(800);
		for (const f of ["erp_nomor", "erp_merek", "erp_model", "erp_tonase", "erp_tahun", "erp_negara"]) {
			if (await kolom(f).isVisible().catch(() => false)) await ke(kolom(f));
		}
		await tungguSuara();
		// 5
		bab("Mesin nonaktif");
		await teks("Mesin nonaktif tidak dapat digunakan");
		await bukaForm("/desk/workstation/Mesin 07", "Workstation");
		await klik(tabForm(1));
		await tidur(800);
		await zoom(kolom("disabled"), 1.8);
		await lalu();
		await zoom(null);
		await klik(tabForm(2));
		await tidur(800);
		await ke(kolom("status"));
		await tungguSuara();
		await klik(tabForm(1));
		await tidur(800);
		// 6
		await teks("Aktifkan kembali: hapus centang Dinonaktifkan");
		await ke(kolom("disabled"));
		await lalu();
		await ke(page.locator(".page-actions .primary-action:visible").first());
		await tungguSuara();
		// 7
		bab("Kapasitas Mesin");
		await teks("Kapasitas Mesin: kecepatan dan bahan per mesin");
		await menu("/desk/manufacturing/machine-capacity");
		await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
		await tunggu(1000);
		await tungguSuara();
		// 8
		await teks("Satu baris untuk satu produk di satu mesin");
		await bukaForm(`/desk/manufacturing/machine-capacity/${kap}`, "Machine Capacity");
		await zoom(kolom("item"), 1.6);
		await ke(kolom("workstation"));
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 9
		await teks("Waktu siklus dan kavitas");
		await zoom(kolom("cycle_time"), 1.8);
		await lalu();
		await ke(kolom("cavities"));
		await tungguSuara();
		await zoom(null);
		// 10
		await teks("Berat, runner, dan bahan");
		for (const f of ["part_weight", "runner_weight", "runner_reground"]) await ke(kolom(f));
		await lalu();
		for (const f of ["material", "masterbatch", "masterbatch_percent"]) await ke(kolom(f));
		await tungguSuara();
		// 11
		await teks("Jumlah pieces (pcs) per jam dihitung otomatis");
		await zoom(kolom("pcs_per_hour"), 1.8);
		await ke(kolom("material_per_pcs"));
		await tungguSuara();
		await zoom(null);
		// 12
		await teks("Digunakan untuk target dan resep");
		await jeda();
		// 13
		bab("Membuat resep");
		await teks("Resep Bill of Materials (BOM) dibuat dari baris ini");
		await klik(page.locator(".page-actions button:visible").filter({ hasText: /Buat BOM|Make BOMs/ }).first());
		const pesanBom = page.getByText(/BOM dibuat|BOMs made/).locator("visible=true").first();
		await pesanBom.waitFor({ state: "visible", timeout: 60000 });
		await tidur(800);
		await lalu();
		// The toast sits at the bottom right, behind the caption: the caption steps aside while it is read.
		const kapsi = (o) => page.evaluate((o) => { const t = document.getElementById("demo-teks"); if (t) t.style.opacity = o; }, o);
		await kapsi("0");
		await zoom(pesanBom, 1.5);
		await tungguSuara();
		await zoom(null);
		await kapsi("1");
		await page.keyboard.press("Escape");
		await tidur(500);
		// 14
		bab("Isi resep");
		await teks("Isi resep: bahan, pigmen, dan kemasan");
		await page.goto(`${URL}/desk/manufacturing/bom?item=${encodeURIComponent(varianSeal)}&is_active=1`);
		await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
		await tunggu(1200);
		await klik(page.locator(".list-row-container .list-subject a:visible").first());
		await page.waitForFunction(() => window.cur_frm?.doctype === "BOM", null, { timeout: 30000 });
		await tunggu(1500);
		await ke(kolom("erp_mesin"));
		await zoom(kolom("items"), 1.3);
		await tungguSuara();
		// 15
		await teks("Kemasan per buah: satu dibagi isi kemasan");
		const barisBom = page.locator('.frappe-control[data-fieldname="items"]:visible .grid-body .grid-row');
		await ke(barisBom.nth(0));
		await tidur(500);
		await ke(barisBom.nth(1));
		await lalu();
		await ke(barisBom.nth(2));
		await tidur(500);
		await ke(barisBom.last());
		await tungguSuara();
		await zoom(null);
		// 16
		await teks("Resep diperbarui secara otomatis");
		await jeda();
		// 17
		bab("Impor dari Excel");
		await teks("Banyak baris? Gunakan Impor dari Excel");
		await menu("/desk/manufacturing/machine-capacity");
		await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
		await tunggu(1000);
		await lalu();
		await klik(page.locator(".page-actions button:visible").filter({ hasText: /Impor dari Excel|Import from Excel/ }).first());
		await page.locator(".modal.show").first().waitFor({ state: "visible", timeout: 15000 });
		await tidur(1000);
		// 18
		await teks("Pratinjau terlebih dahulu, belum ada data ditulis");
		await klik(page.locator('.modal.show [data-fieldname="berkas"] button').first());
		const unggah = page.locator(".modal.show .btn-file-upload").filter({ hasText: /Perangkat Saya|My Device/ }).last();
		await unggah.waitFor({ state: "visible", timeout: 15000 });
		await tidur(600);
		const [pemilih] = await Promise.all([page.waitForEvent("filechooser"), klik(unggah)]);
		await pemilih.setFiles(csv);
		await tidur(1200);
		await klik(page.locator(".modal.show .btn-modal-primary").last());
		await page.waitForFunction(() => document.querySelectorAll(".modal.show").length === 1 && document.querySelector('.modal.show [data-fieldname="berkas"] a, .modal.show [data-fieldname="berkas"] .attached-file'), null, { timeout: 30000 }).catch(() => {});
		await tunggu(1000);
		await lalu();
		await klik(page.locator(".modal.show .btn-modal-primary").first());
		const hasil = page.locator('.modal.show [data-fieldname="hasil"] table').first();
		await hasil.waitFor({ state: "visible", timeout: 60000 });
		await tunggu(800);
		await lalu();
		await tungguSuara();
		// 19
		await teks("Baru, Berubah, Tidak berubah, Ditolak");
		await zoom(hasil, 1.5);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 20
		await teks("Terapkan: simpan baris dan buat resep");
		await ke(page.locator(".modal.show .modal-footer").first());
		await lalu();
		await tungguSuara();
		await page.keyboard.press("Escape");
		await tidur(600);
		// 21
		bab("Mesin pada Perintah Produksi");
		await teks("Pilihan mesin mengikuti Kapasitas Mesin");
		await menu("/desk/manufacturing/work-order");
		await baru();
		await isiLink("production_item", varianSeal, varianSeal);
		await isiKolom("qty", "1000");
		await lalu();
		await klik(kolom("erp_mesin").locator("input").first());
		await pilihan().first().waitFor({ state: "visible", timeout: 15000 });
		await zoom(kolom("erp_mesin"), 1.5);
		await tungguSuara();
		await zoom(null);
		await page.keyboard.press("Escape");
		// 22
		await teks("Mesin lain akan ditolak");
		await klik(kolom("erp_mesin").locator("input").first());
		await page.keyboard.press("ControlOrMeta+A");
		await ketik("Mesin 05");
		await page.evaluate(() => cur_frm.set_value("erp_mesin", "Mesin 05"));
		await page.keyboard.press("Escape");
		await tidur(600);
		await klik(page.locator(".page-actions .primary-action:visible").first());
		const tolak = page.locator(".modal.show .modal-content").first();
		await tolak.waitFor({ state: "visible", timeout: 30000 });
		await tidur(800);
		await zoom(tolak, 1.4);
		await lalu();
		await tungguSuara();
		await zoom(null);
		await page.keyboard.press("Escape");
		await tidur(600);
		// 23
		await teks("Resep mengikuti mesin");
		await isiLink("erp_mesin", "Mesin 04", "Mesin 04");
		await page.waitForFunction(() => cur_frm.doc.erp_mesin === "Mesin 04", null, { timeout: 15000 });
		// The BOM of the machine is picked on save (draft; deleted at the end with the take's drafts).
		await simpan();
		await zoom(kolom("bom_no"), 1.6);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 24
		await teks("Berikutnya: stok awal");
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	}, ["Work Order"]);
}

// docs/video/lengkap-a4-stok-awal.md: warehouses, opening stock, stock count (about 5 minutes). The opening stock
// it submits is cancelled at the end (`ambil`), the stock count stays a draft and is deleted.
async function lengkapA4() {
	return ambil("admin@example.com", [], async ({ hari }) => {
		const abbr = await page.evaluate(async () => (await frappe.db.get_value("Company", frappe.defaults.get_user_default("Company"), "abbr")).message.abbr);
		const gudang = (n) => `${n} - ${abbr}`;
		// A product variant with stock in Gudang Barang Jadi (row 16) and one for Gudang Pluit (row 9).
		const produk = await page.evaluate(async (g) => {
			const r = await frappe.xcall("frappe.client.get_list", { doctype: "Bin", filters: { warehouse: g, actual_qty: [">", 0] }, fields: ["item_code"], limit_page_length: 1 });
			return r[0]?.item_code;
		}, gudang("Gudang Barang Jadi"));
		if (!produk) throw new Error("No item with stock in Gudang Barang Jadi (run contoh.buat_contoh).");
		// Opening stock is refused for an item that already moved in that warehouse: a raw material and a packing
		// item with no stock yet in Gudang Bahan Baku, and a product never kept in Gudang Pluit.
		const belumAda = (grup, wh) => page.evaluate(async ([grup, wh]) => {
			// Active ledger rows only: a cancelled take leaves its Bin but no live transaction.
			const ada = new Set((await frappe.xcall("frappe.client.get_list", { doctype: "Stock Ledger Entry", filters: { warehouse: wh, is_cancelled: 0 }, fields: ["item_code"], group_by: "item_code", limit_page_length: 5000 })).map((b) => b.item_code));
			const items = await frappe.xcall("frappe.client.get_list", { doctype: "Item", filters: { item_group: grup, disabled: 0, has_variants: 0, is_stock_item: 1 }, fields: ["name"], limit_page_length: 500 });
			return items.find((i) => !ada.has(i.name))?.name;
		}, [grup, wh]);
		const bahan = await belumAda("Bahan Baku", gudang("Gudang Bahan Baku"));
		const kemasan = await belumAda("Kemasan", gudang("Gudang Bahan Baku"));
		const produkPluit = await belumAda("Barang Jadi", gudang("Gudang Pluit"));
		if (!bahan || !kemasan || !produkPluit) throw new Error(`A4 needs items with no stock yet: ${bahan} ${kemasan} ${produkPluit}`);
		const kemarin = await page.evaluate((h) => frappe.datetime.str_to_user(frappe.datetime.add_days(h, -1)), hari);
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);
		const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();
		const barisRekon = async (idx, item, wh, qty, harga) => {
			await isiSel("items", idx, "item_code", item, item);
			await isiSel("items", idx, "warehouse", wh, wh);
			await isiSel("items", idx, "qty", qty);
			if (harga) await isiSel("items", idx, "valuation_rate", harga);
		};

		// 1-2
		await teks("Stok awal diisi sekali sebelum mulai");
		await menu("/desk/stock");
		await klik(kartu(/Gudang/));
		await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
		await tunggu(1200);
		await daftarIsi();
		// 3
		bab("Lima gudang pabrik");
		await teks("Terdapat 5 gudang pabrik");
		const gd = (n) => page.locator(".list-row-container").filter({ hasText: n }).first();
		await lalu();
		await ke(gd("Gudang Bahan Baku"));
		await ke(gd("Gudang Produksi"));
		await tungguSuara();
		// 4
		await teks("Barang dijual dari Barang Jadi atau Pluit");
		for (const n of ["Gudang Barang Jadi", "Gudang Reject", "Gudang Pluit"]) await ke(gd(n));
		await tungguSuara();
		// 5
		await teks("Stok tidak boleh minus");
		await jeda();
		// 6
		bab("Mengisi stok awal");
		await teks("Stok Awal & Stok Opname di Pengaturan");
		await menu("/desk/setup/home");
		await klik(kartu(/Stok Awal/));
		await page.waitForSelector(".page-actions .primary-action:visible", { timeout: 30000 });
		await tunggu(1200);
		await lalu();
		await baru();
		// 7
		await teks("Tujuan: Persediaan pembukaan (stok awal)");
		await bukaBagian("set_posting_time");
		if (await kolom("set_posting_time").isVisible().catch(() => false)) {
			await klik(kolom("set_posting_time").locator("input").first());
			await tidur(600);
			await isiKolom("posting_date", kemarin);
		}
		await lalu();
		await pilihSelect("purpose", "Opening Stock");
		await lalu();
		// Akun Selisih is hidden on this form (filled by itself): the voice says so over the Tujuan field.
		await zoom(kolom("purpose"), 1.6);
		await tungguSuara();
		await zoom(null);
		// 8
		await teks("Barang, gudang, jumlah, dan harga pokok");
		await barisRekon(1, bahan, gudang("Gudang Bahan Baku"), "500", "13500");
		await lalu();
		await ke(sel("items", 1, "qty"));
		await tungguSuara();
		// 9
		await teks("Satu dokumen dapat memuat banyak gudang");
		await barisRekon(2, kemasan, gudang("Gudang Bahan Baku"), "200", "3500");
		await lalu();
		await barisRekon(3, produkPluit, gudang("Gudang Pluit"), "100", "5000");
		await tungguSuara();
		// 10
		await teks("Jumlah pigmen diisi dalam gram");
		await jeda();
		// 11
		await teks("Simpan, lalu Kirim");
		await simpan();
		await ajukan();
		await lalu();
		await ke(page.locator(".title-area .page-indicator-pill:visible").first());
		await tungguSuara();
		// 12
		bab("Memeriksa hasilnya");
		await teks("Periksa hasilnya di Saldo Stok");
		await menu("/desk/stock/query-report/Stock Balance");
		await page.waitForSelector(".page-form:visible", { timeout: 30000 });
		await tunggu(1500);
		await saringLaporan("warehouse", [gudang("Gudang Bahan Baku")]);
		await hasilkanLaporan();
		await lalu();
		await bacaBaris(new RegExp(bahan));
		await bacaBaris(new RegExp(kemasan));
		await tungguSuara();
		// 13
		await teks("Saldo Stok: per barang dan per gudang");
		await saringLaporan("warehouse", []);
		await saringLaporan("item_code", [produk]);
		await hasilkanLaporan();
		await tunggu(2500);
		await lalu();
		await ke(page.locator(".dt-row:visible").first().locator(".dt-cell").nth(1));
		await tungguSuara();
		await zoom(null);
		// 14
		await teks("Kartu Stok: riwayat keluar masuk");
		await menu("/desk/stock/query-report/Stock Ledger");
		await page.waitForSelector(".page-form:visible", { timeout: 30000 });
		await tunggu(1500);
		await saringLaporan("item_code", bahan);
		await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
		await tunggu(2500);
		await lalu();
		await bacaBaris(/Rekonsiliasi|Reconciliation/);
		await tungguSuara();
		// 15
		bab("Stok opname bulanan");
		await teks("Stok opname dilakukan setiap bulan");
		await menu("/desk/setup/home");
		await klik(kartu(/Stok Awal/));
		await page.waitForSelector(".page-actions .primary-action:visible", { timeout: 30000 });
		await tunggu(1200);
		await baru();
		await lalu();
		await pilihSelect("purpose", "Stock Reconciliation");
		// 16
		await teks("Isi jumlah hasil penghitungan");
		await barisRekon(1, produk, gudang("Gudang Barang Jadi"), "95");
		await lalu();
		await zoom(page.locator('.frappe-control[data-fieldname="items"]').first(), 1.3);
		await tungguSuara();
		await zoom(null);
		// 17
		await teks("Selisih besar? Laporkan terlebih dahulu");
		await ke(page.locator(".page-actions .primary-action:visible").first());
		await kartuLayar("Salah setelah dikirim?", [["Batalkan", "lalu Amendemen untuk memperbaikinya"]]);
		await lalu();
		await tungguSuara();
		await tutupKartu();
		// 18
		await teks("Berikutnya: pembelian");
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	}, ["Stock Reconciliation"]);
}

// A document's "Create" (Buat) menu item, by its English label, waiting for the new form of `doctype`.
async function buatDari(item, doctype) {
	await klik(page.locator(".page-actions").getByRole("button", { name: /^(Create|Buat)$/ }).first());
	await tidur(700);
	const label = await page.evaluate((i) => __(i), item);
	await klik(page.getByText(new RegExp(`^(${item}|${label})$`)).locator("visible=true").last());
	await page.waitForFunction((d) => window.cur_frm?.doctype === d && cur_frm.doc.__islocal, doctype, { timeout: 30000 });
	await tunggu(1500);
}
// Save, then Submit refused for lack of an attachment is not tried here: attach, then submit.
async function simpanLampirKirim(berkas) {
	if (await page.evaluate(() => cur_frm.is_new() || cur_frm.is_dirty())) await simpan();
	await lampirkan(berkas);
	await ajukan();
}

// docs/video/lengkap-a5-pembelian.md: supplier to payment (about 7 minutes). Makes a Material Request first; every
// document of the chain is cancelled at the end, newest first, and the supplier deleted.
async function lengkapA5() {
	const PEMASOK = "PT Biji Plastik Nusantara";
	const dibersihkan = ["Payment Entry", "Purchase Invoice", "Purchase Receipt", "Purchase Order", "Material Request"];
	await hapusPihak("Supplier", PEMASOK, "supplier", ["Payment Entry", "Purchase Invoice", "Purchase Receipt", "Purchase Order"]);
	try {
		return await ambil("admin@example.com", [], async ({ hari }) => {
			await siapkanDokumen();
			if ((await api("frappe.client.get_count", { doctype: "Supplier", filters: { name: PEMASOK } })).x) throw new Error(`Supplier ${PEMASOK} exists: delete it first.`);
			const abbr = await page.evaluate(async () => (await frappe.db.get_value("Company", frappe.defaults.get_user_default("Company"), "abbr")).message.abbr);
			const minggu = await page.evaluate((h) => frappe.datetime.add_days(h, 7), hari);
			const mr = await api("frappe.client.insert", { doc: { doctype: "Material Request", material_request_type: "Purchase", schedule_date: minggu, items: [{ item_code: "BB-SEAL-CAP", qty: 500, schedule_date: minggu, warehouse: `Gudang Bahan Baku - ${abbr}` }] } });
			if (!mr.ok) throw new Error(`Material Request: ${mr.e}`);
			const kirimMr = await api("frappe.client.submit", { doc: mr.x });
			if (!kirimMr.ok) throw new Error(`Material Request submit: ${kirimMr.e}`);
			await page.goto(`${URL}/desk/home`);
			await tunggu(1500);
			await mulaiRekam();
			await tidur(600);
			const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();

			// 1-2
			await teks("Pembelian: dari pesanan hingga pembayaran");
			await menu("/desk/buying");
			await lalu();
			await daftarIsi();
			// 3
			await teks("Urutan: pesanan, penerimaan, faktur, pembayaran");
			await zoom(page.locator(".widget.shortcut-widget-box").first(), 1.3);
			await zoom(null);
			await lalu();
			for (const k of [/Pemasok/, /Permintaan Barang/, /Pesanan Pembelian/, /Penerimaan Barang/, /Faktur Pembelian/]) {
				if (await kartu(k).isVisible().catch(() => false)) {
					await ke(kartu(k));
					await tidur(400);
				}
			}
			// 4
			bab("Pemasok");
			await teks("Pemasok cukup dicatat satu kali");
			await klik(kartu(/Pemasok/));
			await tunggu(1500);
			await klik(page.locator(".page-actions .primary-action:visible").first());
			await tunggu(1500);
			if (await page.locator(".modal.show").isVisible().catch(() => false)) {
				const btn = page.locator(".modal.show").getByRole("button", { name: /Sunting Formulir Lengkap|Edit Full Form/ }).first();
				if (await btn.isVisible().catch(() => false)) await btn.click(); // under the caption band
			}
			await page.waitForFunction(() => window.cur_frm?.doctype === "Supplier" && cur_frm.doc.__islocal, null, { timeout: 30000 });
			await tunggu(1000);
			await lalu();
			await isiKolom("supplier_name", PEMASOK);
			await isiLink("supplier_group", "Bahan", "Bahan Baku"); // "Raw Material", searched by its Indonesian label
			await lalu();
			await simpan();
			// 5
			bab("Permintaan Barang");
			await teks("Permintaan Barang: daftar bahan yang perlu dibeli");
			await menu("/desk/buying/material-request");
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1200);
			await lalu();
			await klik(page.locator(".list-row-container").filter({ hasText: mr.x.name }).locator(".list-subject a").first());
			await page.waitForFunction(() => window.cur_frm?.doctype === "Material Request", null, { timeout: 30000 });
			await tunggu(1500);
			// 6
			bab("Pesanan Pembelian");
			await teks("Buat pesanan dari permintaan");
			await buatDari("Purchase Order", "Purchase Order");
			await lalu();
			await ke(kolom("items"));
			await tungguSuara();
			// 7
			await teks("Isi pemasok dan tanggal kedatangan barang");
			await isiLink("supplier", "Biji Plastik", PEMASOK);
			await ke(kolom("schedule_date"));
			await tungguSuara();
			// 8
			await teks("Harga terisi dari Harga Bahan Baku");
			await ke(sel("items", 1, "qty"));
			await zoom(sel("items", 1, "rate"), 1.8);
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 9
			await teks("Pigmen dipesan dalam satuan kilogram");
			await isiSel("items", 2, "item_code", "PIGMEN-HJU", "PIGMEN-HJU");
			await isiSel("items", 2, "qty", "2");
			await tidur(1500);
			await lalu();
			await zoom(sel("items", 2, "rate"), 1.8);
			await tungguSuara();
			await zoom(null);
			// 10
			await teks("Kolom pajak dibiarkan kosong");
			await bukaBagian("taxes_and_charges");
			if (await kolom("taxes_and_charges").isVisible().catch(() => false)) await ke(kolom("taxes_and_charges"));
			await tungguSuara();
			// 11
			bab("Lampiran dan cetak");
			await teks("Tanpa foto, pengiriman ditolak");
			await page.evaluate((t) => { for (const r of cur_frm.doc.items) if (!r.schedule_date) frappe.model.set_value(r.doctype, r.name, "schedule_date", t); }, minggu);
			await simpan();
			await lalu();
			const intro = page.locator(".form-intro-area:visible, .form-message:visible").first();
			if (await intro.count()) await zoom(intro, 1.5);
			await zoom(null);
			await lalu();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			await tidur(900);
			const ya = page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first();
			if (await ya.isVisible().catch(() => false)) await klik(ya);
			const tolak = page.locator(".modal.show .modal-content").filter({ hasText: /foto|photo|Lampir|Attach/i }).first();
			await tolak.waitFor({ state: "visible", timeout: 30000 });
			await zoom(tolak, 1.4);
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			await tidur(600);
			// 12
			await teks("Lampirkan foto Purchase Order (PO), lalu kirim");
			await muatUlangForm();
			await tunggu(1500);
			await lalu();
			await lampirkan(dokumen["po-pemasok"]);
			await lalu();
			await ajukan();
			const po = await page.evaluate(() => cur_frm.doc.name);
			// 13
			await teks("Hasil cetak memakai format Purchase Order (PO)");
			await cetak();
			await lalu();
			const tgl = page.getByText(/TGL KIRIM/).first();
			if (await tgl.isVisible().catch(() => false)) await zoom(tgl, 1.8);
			await tungguSuara();
			await zoom(null);
			// 14
			await teks("Cetak atau simpan PDF, lalu kirim ke pemasok");
			await page.goto(`${URL}/desk/buying/purchase-order/${po}`);
			await page.waitForFunction(() => window.cur_frm?.doctype === "Purchase Order", null, { timeout: 30000 });
			await tunggu(1500);
			await ke(page.locator(".title-area").first());
			await lalu();
			await tungguSuara();
			// 15
			bab("Penerimaan Barang");
			await teks("Barang tiba: buat Penerimaan Barang");
			await buatDari("Purchase Receipt", "Purchase Receipt");
			await lalu();
			await tungguSuara();
			// 16
			await teks("Isi jumlah yang benar-benar diterima");
			await isiSel("items", 1, "qty", "480");
			await lalu();
			await ke((await sel("items", 1, "rejected_qty").count()) ? sel("items", 1, "rejected_qty") : kolom("items"));
			await tungguSuara();
			// 17
			await teks("Pembelian 2 kilogram (Kg) menambah stok 2.000 gram");
			await zoom(page.locator('.frappe-control[data-fieldname="items"]:visible .grid-row[data-idx="2"]').first(), 1.4);
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 18
			await teks("Lampirkan surat jalan pemasok");
			await simpan();
			await lalu();
			await lampirkan(dokumen["surat-jalan-pemasok"]);
			await lalu();
			await ajukan();
			const pr = await page.evaluate(() => cur_frm.doc.name);
			// 19
			await teks("Stok gudang langsung bertambah");
			await bukuStok();
			await lalu();
			await bacaBaris(/PIGMEN-HJU/);
			await zoom(await selLaporan("In Qty"), 1.8);
			await tungguSuara();
			await zoom(null);
			await page.goto(`${URL}/desk/buying/purchase-receipt/${pr}`);
			await page.waitForFunction(() => window.cur_frm?.doctype === "Purchase Receipt", null, { timeout: 30000 });
			await tunggu(1500);
			// 20
			bab("Faktur dan pembayaran");
			await teks("Samakan Faktur Pembelian dengan faktur pemasok");
			await buatDari("Purchase Invoice", "Purchase Invoice");
			await lalu();
			await isiKolom("bill_no", "INV-BPN-0981");
			await ke(kolom("bill_date"));
			await tungguSuara();
			// 21
			await teks("Faktur juga wajib memiliki foto");
			await simpan();
			await lalu();
			await lampirkan(dokumen["faktur-pemasok"]);
			await lalu();
			await ajukan();
			// 22
			await teks("Catat uang keluar melalui Pembayaran");
			await buatDari("Payment", "Payment Entry");
			await lalu();
			for (const f of ["posting_date", "paid_amount", "paid_from"]) if (await kolom(f).isVisible().catch(() => false)) await ke(kolom(f));
			if (await kolom("reference_no").isVisible().catch(() => false)) await isiKolom("reference_no", "TRF-0981");
			await tungguSuara();
			// 23
			await teks("Lampirkan bukti pembayaran, lalu kirim");
			await simpan();
			await lalu();
			await lampirkan(dokumen["bukti-transfer"]);
			await lalu();
			await ajukan();
			await tungguSuara();
			// 24
			bab("Dokumen Tanpa Lampiran");
			await teks("Periksa dokumen yang belum memiliki foto");
			await menu("/desk/stock/query-report/Missing Documents");
			await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
			await tunggu(1500);
			await lalu();
			const b0 = page.locator(".dt-row:visible").first();
			if (await b0.count()) await ke(b0.locator(".dt-cell").nth(1));
			await tungguSuara();
			// 25
			await teks("Terdapat kesalahan? Batalkan, lalu Amendemen");
			await menu("/desk/buying");
			await lalu();
			await tungguSuara();
			await tidur(800);
			await teks("");
			await tidur(700);
			return await selesaiRekam();
		}, dibersihkan);
	} finally {
		await hapusPihak("Supplier", PEMASOK, "supplier", ["Payment Entry", "Purchase Invoice", "Purchase Receipt", "Purchase Order"]);
	}
}

// docs/video/lengkap-a6-penjualan.md: customer to payment, Seal Cap's price by machine (about 8 minutes). Every
// document is cancelled at the end, newest first, the new Item Price deleted and the customer deleted.
async function lengkapA6() {
	const PELANGGAN = "Toko Maju Jaya";
	const dibersihkan = ["Payment Entry", "Sales Invoice", "Delivery Note", "Sales Order", "Item Price"];
	await hapusPihak("Customer", PELANGGAN, "customer", ["Payment Entry", "Sales Invoice", "Delivery Note", "Sales Order"]);
	try {
		return await ambil("admin@example.com", ["Mesin 04"], async ({ hari }) => {
			await siapkanDokumen();
			if ((await api("frappe.client.get_count", { doctype: "Customer", filters: { name: PELANGGAN } })).x) throw new Error(`Customer ${PELANGGAN} exists: delete it first.`);
			const abbr = await page.evaluate(async () => (await frappe.db.get_value("Company", frappe.defaults.get_user_default("Company"), "abbr")).message.abbr);
			const jadi = `Gudang Barang Jadi - ${abbr}`;
			// A product with a selling price and stock in Gudang Barang Jadi, and one with no selling price.
			const [laku, tanpaHarga] = await page.evaluate(async (g) => {
				const daftar = (await frappe.db.get_single_value("Selling Settings", "selling_price_list")) || "Harga Pola 2026";
				// Not a Seal Cap: its price follows the machine.
				const bin = await frappe.xcall("frappe.client.get_list", { doctype: "Bin", filters: { warehouse: g, actual_qty: [">", 60], item_code: ["not like", "SEAL-CAP%"] }, fields: ["item_code"], limit_page_length: 200 });
				const harga = await frappe.xcall("frappe.client.get_list", { doctype: "Item Price", filters: { price_list: daftar, item_code: ["in", bin.map((b) => b.item_code)] }, fields: ["item_code"], limit_page_length: 1 });
				const r = await frappe.xcall("frappe.desk.query_report.run", { report_name: "Missing Data", filters: { company: frappe.defaults.get_user_default("Company") } });
				const tanpa = (r.result || []).find((x) => x.cek === "harga" && x.doctype === "Item")?.nama;
				let laku = harga[0]?.item_code;
				// No stocked product priced on the default list (the sample ones have their own list): price one for the
				// take (an Item Price of the take, deleted at the end).
				if (!laku) {
					laku = bin.map((b) => b.item_code).find((k) => k !== tanpa);
					if (laku) await frappe.xcall("frappe.client.insert", { doc: { doctype: "Item Price", item_code: laku, price_list: daftar, price_list_rate: 15000 } });
				}
				return [laku, tanpa];
			}, jadi);
			if (!laku || !tanpaHarga) throw new Error(`Need a priced product with stock in ${jadi} (${laku}) and one without a price (${tanpaHarga}).`);
			const varianSeal = (await api("frappe.client.get_list", { doctype: "Item", filters: { variant_of: "SEAL-CAP", disabled: 0 }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
			const kirim = await page.evaluate((h) => frappe.datetime.add_days(h, 7), hari);
			const tglKirim = async () => page.evaluate(async (t) => {
				for (const r of cur_frm.doc.items) if (!r.delivery_date) await frappe.model.set_value(r.doctype, r.name, "delivery_date", t);
				if (!cur_frm.doc.delivery_date) await cur_frm.set_value("delivery_date", t);
			}, kirim);
			await page.goto(`${URL}/desk/home`);
			await tunggu(1500);
			await mulaiRekam();
			await tidur(600);
			const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();

			// 1-2
			await teks("Penjualan: dari pesanan hingga pembayaran diterima");
			await menu("/desk/selling");
			await lalu();
			await daftarIsi();
			// 3
			await teks("Urutan: pesanan, surat jalan, faktur, pembayaran");
			await lalu();
			for (const k of [/Pelanggan/, /Pesanan Penjualan/, /Faktur Penjualan/, /Pembayaran/, /Riwayat Penjualan/]) {
				if (await kartu(k).isVisible().catch(() => false)) {
					await ke(kartu(k));
					await tidur(400);
				}
			}
			// 4
			bab("Pelanggan");
			await teks("Pelanggan cukup dicatat satu kali");
			await klik(kartu(/Pelanggan/));
			await tunggu(1500);
			await lalu();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			await tunggu(1500);
			// 5
			await teks("Isi nama, lalu simpan");
			const dlg = page.locator(".modal.show").first();
			if (await dlg.isVisible().catch(() => false)) {
				await klik(page.locator('.modal.show [data-fieldname="customer_name"] input').first());
				await ketik(PELANGGAN);
				await lalu();
				await ke(page.locator('.modal.show [data-fieldname="customer_type"]').first());
				await lalu();
				await klik(page.locator(".modal.show .btn-modal-primary").first());
				await page.waitForFunction(() => !document.querySelector(".modal.show"), null, { timeout: 30000 });
			} else {
				await page.waitForFunction(() => window.cur_frm?.doctype === "Customer" && cur_frm.doc.__islocal, null, { timeout: 30000 });
				await isiKolom("customer_name", PELANGGAN);
				await lalu();
				await ke(kolom("customer_type"));
				await lalu();
				await simpan();
			}
			await tunggu(1200);
			// 6
			bab("Pesanan Penjualan");
			await teks("Pesanan Penjualan mencatat pesanan pelanggan");
			await menu("/desk/selling/sales-order");
			await lalu();
			await baru();
			// 7
			await teks("Daftar harga terisi otomatis: Harga Pola 2026");
			await isiLink("customer", "Maju Jaya", PELANGGAN);
			await ke(kolom("delivery_date"));
			await lalu();
			await bukaBagian("selling_price_list");
			await zoom(kolom("selling_price_list"), 1.8);
			await tungguSuara();
			await zoom(null);
			// 8
			await teks("Harga satuan mengikuti daftar harga");
			await isiSel("items", 1, "item_code", laku, laku);
			await isiSel("items", 1, "qty", "50");
			await tidur(1200);
			await zoom(sel("items", 1, "rate"), 1.8);
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 9
			bab("Barang tanpa harga");
			await teks("Harga nol memunculkan catatan oranye");
			await isiSel("items", 2, "item_code", tanpaHarga, tanpaHarga);
			await tidur(1500);
			await lalu();
			await ke(sel("items", 2, "rate"));
			await lalu();
			const oranye = page.locator(".form-message:visible").filter({ hasText: /harga jual|selling price/i }).first();
			await oranye.waitFor({ state: "visible", timeout: 15000 });
			await zoom(oranye, 1.5);
			await tungguSuara();
			await zoom(null);
			// 10
			await teks("Klik tautan untuk membuka form harga baru");
			// The link opens the New Item Price dialog over the order, item and price list filled.
			const satuan = (await api("frappe.client.get_value", { doctype: "Item", filters: tanpaHarga, fieldname: "stock_uom" })).x?.stock_uom;
			await klik(oranye.locator("a").first());
			const dlgHarga = (f) => page.locator(`.modal.show .frappe-control[data-fieldname="${f}"]`).first();
			await dlgHarga("price_list_rate").waitFor({ state: "visible", timeout: 30000 });
			await tunggu(1000);
			await lalu();
			await ke(dlgHarga("item_code"));
			await ke(dlgHarga("price_list"));
			await lalu();
			if (satuan) {
				await klik(dlgHarga("uom").locator("input"));
				await pilihDariDaftar(satuan, satuan);
			}
			await klik(dlgHarga("price_list_rate").locator("input"));
			await page.keyboard.press("ControlOrMeta+A");
			await ketik("12000");
			await klik(page.locator(".modal.show .btn-modal-primary").first());
			await page.waitForFunction(() => !document.querySelector(".modal.show"), null, { timeout: 30000 });
			await tunggu(1500);
			// 11
			bab("Harga Seal Cap per mesin");
			await teks("Harga Seal Cap mengikuti mesin");
			// The saved price opens its own form: back to the order, still unsaved in the browser.
			if (await page.evaluate(() => window.cur_frm?.doctype !== "Sales Order")) {
				await page.goBack();
				await page.waitForFunction(() => window.cur_frm?.doctype === "Sales Order", null, { timeout: 30000 });
				await tunggu(1500);
			}
			await isiSel("items", 2, "item_code", tanpaHarga, tanpaHarga);
			await tidur(1500);
			await ke(sel("items", 2, "rate"));
			await tglKirim();
			await simpanLampirKirim(dokumen["po-pelanggan"]);
			const so1 = await page.evaluate(() => cur_frm.doc.name);
			await lalu();
			await menu("/desk/selling/sales-order");
			await baru();
			await isiLink("customer", "Empat Putra", "PT. Empat Putra Pangestu");
			await lalu();
			// 12
			await teks("Mesin 04: 24 rupiah per buah");
			await isiSel("items", 1, "item_code", varianSeal, varianSeal);
			await isiSel("items", 1, "qty", "20000");
			await pilihTanggal("items", 1, "delivery_date", kirim);
			await lalu();
			await isiSel("items", 1, "erp_mesin", "Mesin 04", "Mesin 04");
			await tidur(1500);
			await zoom(sel("items", 1, "rate"), 1.8);
			await tungguSuara();
			// 13
			await teks("Mesin 14: 23 rupiah per buah");
			await isiSel("items", 1, "erp_mesin", "Mesin 14", "Mesin 14");
			await tidur(1500);
			await ke(sel("items", 1, "rate"));
			await tungguSuara();
			await zoom(null);
			// 14
			await teks("Tanpa mesin, pesanan tidak dapat disimpan");
			await page.evaluate(() => frappe.model.set_value(cur_frm.doc.items[0].doctype, cur_frm.doc.items[0].name, "erp_mesin", ""));
			await tidur(800);
			await tglKirim();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			const tolak = page.locator(".modal.show .modal-content").first();
			await tolak.waitFor({ state: "visible", timeout: 30000 });
			await zoom(tolak, 1.4);
			await lalu();
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			await tidur(600);
			await isiSel("items", 1, "erp_mesin", "Mesin 14", "Mesin 14");
			await tidur(1500);
			// 15
			bab("Lampiran dan kirim");
			await teks("Tanpa foto, pengiriman ditolak");
			await simpan();
			await lalu();
			const intro = page.locator(".form-intro-area:visible, .form-message:visible").first();
			if (await intro.count()) await zoom(intro, 1.5);
			await zoom(null);
			await lalu();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			await tidur(900);
			const ya = page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first();
			if (await ya.isVisible().catch(() => false)) await klik(ya);
			const tolakFoto = page.locator(".modal.show .modal-content").filter({ hasText: /foto|photo|Lampir|Attach/i }).first();
			await tolakFoto.waitFor({ state: "visible", timeout: 30000 });
			await zoom(tolakFoto, 1.4);
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			await tidur(600);
			// 16
			await teks("Lampirkan foto Purchase Order (PO), lalu kirim");
			await muatUlangForm();
			await tunggu(1500);
			await lalu();
			await lampirkan(dokumen["po-pelanggan"]);
			await lalu();
			await ajukan();
			const so2 = await page.evaluate(() => cur_frm.doc.name);
			// 17
			await teks("Setelah dikirim, harga Seal Cap terkunci");
			await klik(page.locator(".page-actions button:visible").filter({ hasText: /Perbarui Item|Update Items/ }).first());
			const dlgUbah = page.locator(".modal.show").first();
			await dlgUbah.waitFor({ state: "visible", timeout: 15000 });
			await tidur(1000);
			const selRate = page.locator('.modal.show .grid-row[data-idx="1"] .grid-static-col[data-fieldname="rate"]').first();
			await klik(selRate);
			const inRate = page.locator('.modal.show .grid-row[data-idx="1"] input[data-fieldname="rate"]').first();
			await inRate.waitFor({ state: "visible", timeout: 10000 });
			await tidur(500);
			await page.keyboard.press("ControlOrMeta+A");
			await ketik("20");
			await inRate.evaluate((e) => e.blur());
			await tidur(800);
			await lalu();
			await klik(page.locator(".modal.show .btn-modal-primary").first());
			const tolakHarga = page.locator(".modal.show .modal-content").filter({ hasText: /23/ }).last();
			await tolakHarga.waitFor({ state: "visible", timeout: 30000 });
			await zoom(tolakHarga, 1.4);
			await lalu();
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			await tidur(500);
			await page.keyboard.press("Escape");
			await tidur(500);
			await muatUlangForm();
			await tunggu(1500);
			// 18
			bab("Cetak pesanan");
			await teks("Hasil cetak memakai format Purchase Order (PO)");
			await cetak();
			await lalu();
			const total = page.getByText(/TOTAL/).last();
			if (await total.isVisible().catch(() => false)) await zoom(total, 1.8);
			await tungguSuara();
			await zoom(null);
			// 19
			await teks("Mesin Seal Cap tercetak dengan warna merah");
			const mesin = page.locator("body").getByText("Mesin 14").first();
			if (await mesin.isVisible().catch(() => false)) await zoom(mesin, 1.8);
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 20
			bab("Surat jalan, faktur, dan pembayaran");
			await teks("Barang dikirim melalui Surat Jalan");
			await page.goto(`${URL}/desk/selling/sales-order/${so1}`);
			await page.waitForFunction(() => window.cur_frm?.doctype === "Sales Order", null, { timeout: 30000 });
			await tunggu(1500);
			await buatDari("Delivery Note", "Delivery Note");
			await lalu();
			await isiLink("set_warehouse", "Barang Jadi", jadi);
			await simpan();
			await ajukan();
			// 21
			await teks("Faktur Penjualan: kolom pajak dibiarkan kosong");
			await buatDari("Sales Invoice", "Sales Invoice");
			await lalu();
			await bukaBagian("taxes_and_charges");
			if (await kolom("taxes_and_charges").isVisible().catch(() => false)) await ke(kolom("taxes_and_charges"));
			await tungguSuara();
			// 22
			await teks("Faktur juga wajib memiliki foto");
			await simpan();
			await lalu();
			await lampirkan(dokumen["faktur-penjualan"]);
			await lalu();
			await ajukan();
			// 23
			await teks("Catat uang masuk melalui Pembayaran");
			await buatDari("Payment", "Payment Entry");
			await lalu();
			for (const f of ["posting_date", "paid_amount", "paid_to"]) if (await kolom(f).isVisible().catch(() => false)) await ke(kolom(f));
			if (await kolom("reference_no").isVisible().catch(() => false)) await isiKolom("reference_no", "TRF-MJ-01");
			await tungguSuara();
			// 24
			await teks("Lampirkan bukti pembayaran, lalu kirim");
			await simpan();
			await lalu();
			await lampirkan(dokumen["bukti-transfer"]);
			await lalu();
			await ajukan();
			await tungguSuara();
			// 25
			bab("Riwayat Penjualan");
			await teks("Riwayat Penjualan: jumlah terjual per bulan");
			await menu("/desk/selling/sales-history");
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1500);
			await ke(page.locator(".list-row-container:visible").first());
			await lalu();
			await zoom(null);
			await klik(page.locator(".list-row-container .list-subject a:visible").first());
			await tunggu(2000);
			await tungguSuara();
			// 26
			await teks("Terdapat kesalahan? Batalkan, lalu Amendemen");
			await menu("/desk/selling");
			await lalu();
			await tungguSuara();
			await tidur(800);
			await teks("");
			await tidur(700);
			void so2;
			return await selesaiRekam();
		}, dibersihkan);
	} finally {
		await hapusPihak("Customer", PELANGGAN, "customer", ["Payment Entry", "Sales Invoice", "Delivery Note", "Sales Order"]);
	}
}

// docs/video/lengkap-a7-produksi.md: Work Orders from the Admin side (about 7 minutes). First makes a submitted
// Seal Cap Sales Order on Mesin 04 (with its attachment) through the API; the end cancels the take's Work Orders
// and that order.
async function lengkapA7() {
	return ambil("admin@example.com", ["Mesin 05"], async ({ hari }) => {
		const kirim = await page.evaluate((h) => frappe.datetime.add_days(h, 14), hari);
		const varianSeal = (await api("frappe.client.get_list", { doctype: "Item", filters: { variant_of: "SEAL-CAP", disabled: 0 }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
		const so = await api("frappe.client.insert", { doc: { doctype: "Sales Order", customer: "PT. Empat Putra Pangestu", delivery_date: kirim, items: [{ item_code: varianSeal, qty: 20000, delivery_date: kirim, erp_mesin: "Mesin 04" }] } });
		if (!so.ok) throw new Error(`Sales Order: ${so.e}`);
		const f = await api("frappe.client.insert", { doc: { doctype: "File", file_name: "po-pelanggan.txt", attached_to_doctype: "Sales Order", attached_to_name: so.x.name, is_private: 1, content: "PO pelanggan" } });
		if (!f.ok) throw new Error(`attachment: ${f.e}`);
		const s = await api("frappe.client.submit", { doc: (await api("frappe.client.get", { doctype: "Sales Order", name: so.x.name })).x });
		if (!s.ok) throw new Error(`Sales Order submit: ${s.e}`);
		// A sample product with capacity rows on Mesin 02 and 03, a product with no packing, a completed order.
		const cth = (await api("frappe.client.get_list", { doctype: "Machine Capacity", filters: { item: ["like", "CTH-%"], workstation: "Mesin 02", disabled: 0 }, fields: ["item"], limit_page_length: 1 })).x?.[0]?.item;
		const tanpaKemasan = await page.evaluate(async () => {
			const r = await frappe.xcall("frappe.desk.query_report.run", { report_name: "Missing Data", filters: { company: frappe.defaults.get_user_default("Company") } });
			const b = (r.result || []).find((x) => x.cek === "kemasan");
			if (!b) return null;
			const v = await frappe.xcall("frappe.client.get_list", { doctype: "Item", filters: { variant_of: b.nama, disabled: 0 }, fields: ["name"], limit_page_length: 1 });
			return v[0]?.name || b.nama;
		});
		const selesai = (await api("frappe.client.get_list", { doctype: "Work Order", filters: { status: "Completed", docstatus: 1, erp_mesin: ["is", "set"] }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
		if (!cth || !tanpaKemasan || !selesai) throw new Error(`Missing data for A7: ${cth} ${tanpaKemasan} ${selesai}`);
		await api("erp_internal.production_floor.set_status", { machine: "Mesin 05", status: "Idle" });
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);
		const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();

		// 1-2
		await teks("Produksi dari sisi Admin");
		await menu("/desk/manufacturing");
		await lalu();
		for (const k of [/Lantai Produksi/, /Input Harian/, /Rencana vs Aktual/, /Perintah Produksi/, /Kapasitas Mesin/]) {
			if (await kartu(k).isVisible().catch(() => false)) {
				await ke(kartu(k));
				await tidur(300);
			}
		}
		await daftarIsi();
		// 3
		bab("Dari Pesanan Penjualan");
		await teks("Cara pertama: dari Pesanan Penjualan");
		await bukaForm(`/desk/selling/sales-order/${so.x.name}`, "Sales Order");
		await lalu();
		await klik(page.locator(".page-actions").getByRole("button", { name: /^(Create|Buat)$/ }).first());
		await tidur(700);
		await klik(page.getByText(/^(Work Order|Perintah Produksi)$/).locator("visible=true").last());
		await tidur(1500);
		await lalu();
		const dialog = page.locator(".modal.show .btn-modal-primary").first();
		if (await dialog.isVisible().catch(() => false)) {
			const centang = page.locator(".modal.show .grid-body .grid-row-check").first();
			if (await centang.isVisible().catch(() => false)) {
				await klik(centang);
				await tidur(600);
			}
			await klik(dialog);
			await tunggu(2500);
		}
		await page.keyboard.press("Escape");
		const wo1 = (await api("frappe.client.get_list", { doctype: "Work Order", filters: { sales_order: so.x.name }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
		if (!wo1) throw new Error(`no Work Order made from ${so.x.name}`);
		// 4
		await teks("Mesin mengikuti baris pesanan");
		await bukaForm(`/desk/manufacturing/work-order/${wo1}`, "Work Order");
		await zoom(kolom("erp_mesin"), 1.8);
		await lalu();
		await ke(kolom("qty"));
		await tungguSuara();
		await zoom(null);
		// 5
		await teks("Simpan, lalu kirim");
		if (await page.evaluate(() => cur_frm.is_dirty())) await simpan();
		await ajukan();
		await lalu();
		// 6
		bab("Dibuat langsung");
		await teks("Cara kedua: buat secara langsung");
		await menu("/desk/manufacturing/work-order");
		await lalu();
		await baru();
		await isiLink("production_item", cth, cth);
		await lalu();
		await isiKolom("qty", "1000");
		// 7
		bab("Mesin dan resep");
		await teks("Pilihan mesin sesuai Kapasitas Mesin");
		await klik(kolom("erp_mesin").locator("input").first());
		await pilihan().first().waitFor({ state: "visible", timeout: 15000 });
		await zoom(kolom("erp_mesin"), 1.6);
		await lalu();
		await tungguSuara();
		// 8
		await teks("Mesin lain atau mesin nonaktif ditolak");
		await jeda();
		await zoom(null);
		// 9
		await teks("Resep Bill of Materials (BOM) dipilih sesuai mesin");
		await klik(pilihan().filter({ hasText: "Mesin 02" }).first());
		await tunggu(800);
		await simpan();
		const wo2 = await page.evaluate(() => cur_frm.doc.name);
		await zoom(kolom("bom_no"), 1.8);
		await lalu();
		await zoom(null);
		await isiLink("erp_mesin", "Mesin 03", "Mesin 03");
		await simpan();
		await zoom(kolom("bom_no"), 1.8);
		await tungguSuara();
		await zoom(null);
		// 10
		await teks("Catatan oranye: data barang belum lengkap");
		await menu("/desk/manufacturing/work-order");
		await baru();
		await isiLink("production_item", tanpaKemasan, tanpaKemasan);
		await tunggu(2000);
		const oranye = page.locator(".form-message.orange:visible").first();
		if (await oranye.isVisible().catch(() => false)) {
			await zoom(oranye, 1.5);
			await lalu();
			const t = oranye.locator("a").first();
			if (await t.count()) await ke(t);
			await tungguSuara();
			await zoom(null);
		} else await jeda();
		// 11
		bab("Memindah mesin");
		await teks("Setelah dikirim, mesin masih dapat dipindah");
		await bukaForm(`/desk/manufacturing/work-order/${wo2}`, "Work Order");
		await ajukan();
		await lalu();
		await isiLink("erp_mesin", "Mesin 02", "Mesin 02");
		await lalu();
		await klik(page.locator(".page-actions .primary-action:visible").first());
		await page.waitForFunction(() => !cur_frm.is_dirty(), null, { timeout: 30000 });
		await tunggu(1500);
		// 12
		await teks("Setelah selesai, mesin terkunci");
		await bukaForm(`/desk/manufacturing/work-order/${selesai}`, "Work Order");
		await klik(tabForm(0));
		await tidur(800);
		await zoom(kolom("erp_mesin"), 1.8);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 13
		bab("Lantai Produksi");
		await teks("Lantai Produksi menampilkan seluruh mesin");
		await klik(sisi("production-floor"));
		await bukaLantai();
		await lalu();
		await zoom(page.locator(".kpi").first(), 1.5);
		await tungguSuara();
		await zoom(null);
		// 14
		await teks("Temukan mesin kosong di Perlu perhatian");
		await ke(page.locator(".perhatian").first());
		await lalu();
		await klik(page.locator('.perhatian li[data-mesin="Mesin 05"]').first());
		await tidur(1500);
		// 15
		await teks("Mesin nonaktif tetap tampil sebagai Off");
		await ke(page.locator(".panel .status").first());
		await ke(page.locator(".panel .buka").first());
		await lalu();
		await klik(page.locator('.tabel tr[data-mesin="Mesin 01"]').first());
		await tidur(1500);
		await klik(page.locator(".panel .tutup").first());
		await tungguSuara();
		// 16
		bab("Input Harian");
		await teks("Input Harian: Admin hanya dapat melihat");
		await klik(page.locator(".kembali").first());
		await tunggu(1500);
		await klik(sisi("daily-input"));
		await bukaInputHarian();
		const blok = page.locator("section[data-wo]").first();
		await zoom(blok, 1.3);
		await lalu();
		await ke(blok.locator("td").filter({ hasText: /\d/ }).nth(3));
		await tungguSuara();
		await zoom(null);
		// 17
		await teks("Cetak atau unduh Excel per minggu");
		const alat = page.locator(".erp-ih-alat button");
		await klik(alat.nth(0));
		await bukaInputHarian();
		await klik(alat.nth(1));
		await bukaInputHarian();
		await lalu();
		await ke(alat.filter({ hasText: /Cetak|Print/ }).first());
		await ke(alat.filter({ hasText: /Excel/ }).first());
		await tungguSuara();
		// 18
		await teks("Hasil Produksi: Admin hanya dapat melihat");
		const garis = page.locator("section[data-wo] td a").filter({ hasText: /\d/ }).first();
		await klik(garis);
		await page.waitForFunction(() => window.cur_frm?.doctype === "Production Entry", null, { timeout: 30000 });
		await tunggu(1500);
		await ke(kolom("good_qty"));
		await ke(kolom("rejects"));
		await lalu();
		await bukaBagian("manufacture_entry");
		if (await kolom("manufacture_entry").isVisible().catch(() => false)) await ke(kolom("manufacture_entry"));
		await gerak(1330, 24);
		await tungguSuara();
		// 19
		bab("Rencana vs Aktual");
		await teks("Rencana vs Aktual: target dibandingkan hasil");
		await menu("/desk/manufacturing/query-report/Plan vs Actual");
		await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
		await tunggu(1500);
		await zoom(page.locator(".page-form:visible").first(), 1.4);
		await lalu();
		await ke(page.locator('.page-form:visible [data-fieldname="group_by"]').first());
		await tungguSuara();
		await zoom(null);
		// 20
		await teks("Hijau tercapai, oranye hampir, merah kurang");
		const pil = page.locator(".dt-row:visible .indicator-pill").first();
		if (await pil.count()) await zoom(pil, 1.8);
		await lalu();
		await zoom(null);
		const grafik = page.locator(".chart-container:visible, .frappe-chart:visible").first();
		if (await grafik.count()) await ke(grafik);
		await tungguSuara();
		// 21
		await teks("Target berdasarkan kapasitas mesin");
		const sumber = page.locator('.page-form:visible [data-fieldname="target_dari"] select').first();
		await klik(sumber);
		await sumber.selectOption("Capacity");
		await tunggu(2500);
		await lalu();
		await bacaBaris(/kapasitas|capacity/i);
		await tungguSuara();
		// 22
		bab("Menghentikan dan menutup");
		await teks("Berhenti: dihentikan sementara, dapat dibuka kembali");
		await bukaForm(`/desk/manufacturing/work-order/${wo2}`, "Work Order");
		await menuGrup("Status", "Stop");
		await page.waitForFunction(() => cur_frm.doc.status === "Stopped", null, { timeout: 30000 });
		await tunggu(1500);
		await lalu();
		const labelStatus = await page.evaluate(() => encodeURIComponent(__("Status")));
		await klik(page.locator(`.page-actions .inner-group-button[data-label="${labelStatus}"] button`).first());
		await tidur(700);
		const buka = page.locator('[role="menuitem"]:visible').filter({ hasText: /Re-terbuka|Re-open|Buka kembali/ }).first();
		if (await buka.count()) await ke(buka);
		await tidur(600);
		await page.keyboard.press("Escape");
		await tungguSuara();
		// 23
		await teks("Tutup: ditutup secara permanen");
		await menuGrup("Status", "Close");
		const tanya = page.locator(".modal.show .modal-content").first();
		await tanya.waitFor({ state: "visible", timeout: 15000 });
		await zoom(tanya, 1.4);
		await lalu();
		await zoom(null);
		await klik(page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first());
		await page.waitForFunction(() => cur_frm.doc.status === "Closed", null, { timeout: 30000 }).catch(() => {});
		await tunggu(1500);
		// 24
		await teks("Buat, pilih mesin, pantau, dan tutup");
		await menu("/desk/manufacturing");
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	}, ["Work Order", "Sales Order"]);
}

// docs/video/lengkap-a8-gudang-dan-kirim.md: receipts, transfers, delivery notes, stock reports (about 7 minutes).
// The take's documents are cancelled at the end, newest first; the photo row 21 attaches to a sample document is
// deleted again.
async function lengkapA8() {
	let fotoContoh = null;
	try {
		return await ambil("admin@example.com", [], async () => {
			await siapkanDokumen();
			const abbr = await page.evaluate(async () => (await frappe.db.get_value("Company", frappe.defaults.get_user_default("Company"), "abbr")).message.abbr);
			const g = (n) => `${n} - ${abbr}`;
			const cth = await page.evaluate(async (w) => (await frappe.xcall("frappe.client.get_list", { doctype: "Bin", filters: { warehouse: w, actual_qty: [">", 100], item_code: ["like", "CTH-%"] }, fields: ["item_code"], limit_page_length: 1 }))[0]?.item_code, g("Gudang Barang Jadi"));
			const pelanggan = (await api("frappe.client.get_list", { doctype: "Customer", fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
			if (!cth || !pelanggan) throw new Error(`Need a CTH- item with stock in Gudang Barang Jadi (${cth}) and a customer (${pelanggan}).`);
			await page.goto(`${URL}/desk/home`);
			await tunggu(1500);
			await mulaiRekam();
			await tidur(600);
			const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();
			const stokBaru = async () => {
				await menu("/desk/stock");
				await klik(kartu(/Mutasi Stok/));
				await tunggu(1200);
				await baru();
			};

			// 1-2
			await teks("Gudang: barang masuk, pindah, dan keluar");
			await menu("/desk/stock");
			await lalu();
			for (const k of [/Mutasi Stok/, /Surat Jalan/, /Barang/, /Gudang/, /Saldo Stok/, /Kartu Stok/, /Dokumen Tanpa Lampiran/]) {
				if (await kartu(k).isVisible().catch(() => false)) {
					await ke(kartu(k));
					await tidur(250);
				}
			}
			await daftarIsi();
			// 3
			bab("Lima gudang");
			await teks("Terdapat 5 gudang pabrik");
			await klik(kartu(/Gudang/));
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1200);
			await lalu();
			for (const n of ["Gudang Bahan Baku", "Gudang Produksi", "Gudang Barang Jadi", "Gudang Reject", "Gudang Pluit"]) {
				const r = page.locator(".list-row-container").filter({ hasText: n }).first();
				if (await r.isVisible().catch(() => false)) await ke(r);
			}
			await tungguSuara();
			// 4
			bab("Bahan masuk");
			await teks("Mutasi Stok mencatat pergerakan barang");
			await stokBaru();
			await klik(kolom("stock_entry_type").locator("input").first());
			await pilihan().first().waitFor({ state: "visible", timeout: 15000 });
			await tidur(800);
			await lalu();
			await zoom(kolom("stock_entry_type"), 1.4);
			await tungguSuara();
			await zoom(null);
			// 5
			await teks("Nota Penerimaan Barang: bahan masuk tanpa pesanan");
			await page.keyboard.press("ControlOrMeta+A");
			await pilihDariDaftar("Penerimaan", "Nota Penerimaan Barang");
			await isiLink("to_warehouse", "Bahan Baku", g("Gudang Bahan Baku"));
			await lalu();
			await isiSel("items", 1, "item_code", "BB-SEAL-CAP", "BB-SEAL-CAP");
			await isiSel("items", 1, "qty", "100");
			// 6
			await teks("Tanpa foto surat jalan, pengiriman ditolak");
			await simpan();
			await lalu();
			const intro = page.locator(".form-intro-area:visible, .form-message:visible").first();
			if (await intro.count()) await zoom(intro, 1.5);
			await zoom(null);
			await lalu();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			await tidur(900);
			const ya = page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first();
			if (await ya.isVisible().catch(() => false)) await klik(ya);
			const tolak = page.locator(".modal.show .modal-content").filter({ hasText: /foto|photo|Lampir|Attach/i }).first();
			await tolak.waitFor({ state: "visible", timeout: 30000 });
			await zoom(tolak, 1.4);
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			await tidur(600);
			// 7
			await teks("Lampirkan foto, lalu kirim");
			await muatUlangForm();
			await tunggu(1500);
			await lalu();
			await lampirkan(dokumen["surat-jalan-pemasok"]);
			await lalu();
			await ajukan();
			// 8
			await teks("Tanpa stok bahan, hasil produksi tidak tercatat");
			await ke(page.locator('.frappe-control[data-fieldname="items"]:visible .grid-row[data-idx="1"]').first());
			await jeda();
			// 9
			bab("Pindah gudang");
			await teks("Transfer Barang: perpindahan antargudang");
			await stokBaru();
			await isiLink("stock_entry_type", "Transfer", "Transfer Barang");
			await lalu();
			await isiLink("from_warehouse", "Barang Jadi", g("Gudang Barang Jadi"));
			await isiLink("to_warehouse", "Pluit", g("Gudang Pluit"));
			// 10
			await teks("Perpindahan gudang tidak memerlukan foto");
			await isiSel("items", 1, "item_code", cth, cth);
			await isiSel("items", 1, "qty", "50");
			await lalu();
			await simpan();
			await lalu();
			await ajukan();
			// 11
			bab("Surat Jalan");
			await teks("Surat Jalan: barang keluar ke pelanggan");
			await menu("/desk/stock");
			await klik(kartu(/Surat Jalan/));
			await tunggu(1200);
			await lalu();
			await baru();
			await isiLink("customer", pelanggan.slice(0, 8), pelanggan);
			// 12
			await teks("Gudang asal wajib dipilih");
			await isiSel("items", 1, "item_code", cth, cth);
			await isiSel("items", 1, "qty", "20");
			await page.evaluate(() => cur_frm.set_value("set_warehouse", ""));
			await tidur(600);
			await lalu();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			const wajib = page.locator(".modal.show .modal-content").first();
			await wajib.waitFor({ state: "visible", timeout: 30000 });
			await zoom(wajib, 1.4);
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			await tidur(600);
			// 13
			await teks("Pilih Gudang Barang Jadi atau Gudang Pluit");
			await klik(kolom("set_warehouse").locator("input").first());
			await pilihan().first().waitFor({ state: "visible", timeout: 15000 });
			await tidur(800);
			await zoom(kolom("set_warehouse"), 1.4);
			await lalu();
			await zoom(null);
			await page.keyboard.press("ControlOrMeta+A");
			await pilihDariDaftar("Pluit", g("Gudang Pluit"));
			await tidur(800);
			await ke(kolom("items"));
			await tungguSuara();
			// 14
			await teks("Kirim dokumen sebelum truk berangkat");
			await simpan();
			await lalu();
			await ajukan();
			const dn = await page.evaluate(() => cur_frm.doc.name);
			await lalu();
			await cetak();
			await tungguSuara();
			// 15
			await teks("Stok kurang? Periksa terlebih dahulu");
			await jeda();
			// 16
			bab("Foto tanda tangan pelanggan");
			await teks("Foto tanda tangan pelanggan menyusul");
			await bukaForm(`/desk/stock/delivery-note/${dn}`, "Delivery Note");
			const pengingat = page.locator(".form-intro-area:visible, .form-message:visible").first();
			if (await pengingat.count()) await zoom(pengingat, 1.5);
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 17
			await teks("Lampirkan setelah ditandatangani");
			await lampirkan(dokumen["surat-jalan-pemasok"]);
			await lalu();
			await tungguSuara();
			// 18
			bab("Saldo Stok dan Kartu Stok");
			await teks("Saldo Stok: stok terkini per gudang");
			await menu("/desk/stock/query-report/Stock Balance");
			await page.waitForSelector(".page-form:visible", { timeout: 30000 });
			await tunggu(1500);
			await saringLaporan("item_code", [cth]);
			await hasilkanLaporan();
			await lalu();
			await bacaBaris(/Barang Jadi/);
			await bacaBaris(/Pluit/);
			await tungguSuara();
			// 19
			await teks("Kartu Stok: riwayat keluar masuk barang");
			await menu("/desk/stock/query-report/Stock Ledger");
			await page.waitForSelector(".page-form:visible", { timeout: 30000 });
			await tunggu(1500);
			await saringLaporan("item_code", cth);
			await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
			await tunggu(2500);
			await lalu();
			await bacaBaris(/Pluit/);
			await bacaBaris(/Surat Jalan|Delivery Note/);
			await tungguSuara();
			// 20
			bab("Dokumen Tanpa Lampiran");
			await teks("Periksa dokumen yang belum memiliki foto");
			await menu("/desk/stock/query-report/Missing Documents");
			await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
			await tunggu(1500);
			await lalu();
			await zoom(page.locator(".dt-header, .dt-row-header").first(), 1.4);
			await tungguSuara();
			await zoom(null);
			// 21
			await teks("Lampirkan foto, dokumen hilang dari daftar");
			const tautan = page.locator('.dt-row:visible a[href^="/desk/"]').first();
			const href = await tautan.getAttribute("href");
			await klik(tautan);
			await tidur(1500);
			// The table may take the first click as a cell selection: then the link is followed directly.
			if (page.url().includes("query-report")) await page.goto(`${URL}${href}`);
			await page.waitForFunction(() => window.cur_frm && !cur_frm.doc.__islocal, null, { timeout: 30000 });
			await tunggu(1500);
			const [dt, dn2] = await page.evaluate(() => [cur_frm.doctype, cur_frm.doc.name]);
			await lalu();
			await lampirkan(dokumen["surat-jalan-pemasok"]);
			fotoContoh = (await api("frappe.client.get_list", { doctype: "File", filters: { attached_to_doctype: dt, attached_to_name: dn2 }, fields: ["name"], order_by: "creation desc", limit_page_length: 1 })).x?.[0]?.name;
			await page.goBack();
			await tunggu(2000);
			await page.reload();
			await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
			await tunggu(1500);
			await lalu();
			await tungguSuara();
			// 22
			bab("Stok opname");
			await teks("Setiap bulan: lakukan stok opname");
			await menu("/desk/setup/home");
			await klik(kartu(/Stok Awal/));
			await tunggu(1500);
			await ke(page.locator(".page-actions .primary-action:visible").first());
			await lalu();
			await tungguSuara();
			// 23
			await teks("Masuk, pindah, keluar, dan periksa");
			await menu("/desk/stock");
			await lalu();
			await tungguSuara();
			await tidur(800);
			await teks("");
			await tidur(700);
			return await selesaiRekam();
		}, ["Delivery Note", "Stock Entry"]);
	} finally {
		if (fotoContoh) {
			const h = await api("frappe.client.delete", { doctype: "File", name: fotoContoh });
			if (!h.ok) console.error(`could not delete the photo ${fotoContoh}: ${h.e}`);
		}
	}
}

// docs/video/lengkap-a9-biaya.md: expenses and Monthly Expenses (about 6 minutes). The fuel expense it submits is
// cancelled at the end; the refused wage stays a draft and is deleted.
async function lengkapA9() {
	return ambil("admin@example.com", [], async ({ hari }) => {
		await siapkanDokumen();
		const catatan = async (kategori) => (await api("frappe.client.get_list", { doctype: "Expense Entry", filters: { category: kategori, docstatus: 1 }, fields: ["name"], order_by: "posting_date desc", limit_page_length: 1 })).x?.[0]?.name;
		const tetap = await catatan("Gaji Karyawan Tetap");
		const operator = await catatan("Gaji Operator");
		if (!tetap || !operator) throw new Error("Sample expenses missing (run contoh.buat_contoh).");
		const bulanLalu = await page.evaluate((h) => frappe.datetime.str_to_user(frappe.datetime.add_months(frappe.datetime.month_start(h), -1)), hari);
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);
		const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();
		const daftarBiaya = async () => {
			await menu("/desk/buying");
			await klik(kartu(/Catatan Biaya/));
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1200);
		};

		// 1-2
		await teks("Pencatatan biaya pabrik dan laporan bulanan");
		await menu("/desk/buying");
		await lalu();
		await ke(kartu(/Catatan Biaya/));
		await ke(kartu(/Biaya Bulanan/));
		await daftarIsi();
		// 3
		bab("Mencatat biaya");
		await teks("Satu Catatan Biaya untuk satu biaya");
		await daftarBiaya();
		await lalu();
		await baru();
		// 4
		await teks("Kategori menunjukkan jenis biaya");
		await ke(kolom("posting_date"));
		await klik(kolom("category").locator("input").first());
		await pilihan().first().waitFor({ state: "visible", timeout: 15000 });
		await tidur(800);
		await lalu();
		await zoom(kolom("category"), 1.4);
		await tungguSuara();
		// 5
		await teks("Kategori baru dapat ditambahkan");
		const buatBaru = pilihan().filter({ hasText: /Buat|Create/ }).first();
		if (await buatBaru.count()) await ke(buatBaru);
		await lalu();
		await tungguSuara();
		await zoom(null);
		await page.keyboard.press("ControlOrMeta+A");
		await pilihDariDaftar("Bensin", "Bensin");
		// 6
		bab("Biaya sekali dan lampiran");
		await teks("Pilihan ulang: sekali, tiap bulan, per shift mesin");
		await isiKolom("amount", "500000");
		await lalu();
		await zoom(kolom("repeat"), 1.6);
		await pilihSelect("repeat", "Once");
		await tungguSuara();
		await zoom(null);
		// 7
		await teks("Biaya sekali wajib dilampiri foto");
		await simpan();
		const intro = page.locator(".form-intro-area:visible, .form-message:visible").first();
		if (await intro.count()) await zoom(intro, 1.5);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 8
		await teks("Lampirkan nota, lalu kirim");
		await lalu();
		await lampirkan(dokumen["nota-bensin"]);
		await lalu();
		await ajukan();
		await tungguSuara();
		// 9
		bab("Biaya tiap bulan");
		await teks("Biaya bulanan dihitung hingga diakhiri");
		await bukaForm(`/desk/buying/expense-entry/${tetap}`, "Expense Entry");
		await zoom(kolom("repeat"), 1.6);
		await lalu();
		await ke(kolom("until"));
		await tungguSuara();
		await zoom(null);
		// 10
		await teks("Kolom Sampai kosong berarti masih berjalan");
		await zoom(kolom("until"), 1.8);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 11
		bab("Gaji operator per shift mesin");
		await teks("Gaji operator 105.000 per shift mesin");
		await bukaForm(`/desk/buying/expense-entry/${operator}`, "Expense Entry");
		await zoom(kolom("amount"), 1.6);
		await ke(kolom("repeat"));
		await tungguSuara();
		await zoom(null);
		// 12
		await teks("Satu mesin dalam satu shift dihitung sekali");
		await kartuLayar("1 shift mesin", [["1 mesin, 1 tanggal, 1 shift", "= 1 shift mesin"]]);
		await jeda();
		await tutupKartu();
		// 13
		bab("Kenaikan gaji");
		await teks("Dua gaji operator tidak boleh tumpang tindih");
		await daftarBiaya();
		await baru();
		await isiLink("category", "Gaji Operator", "Gaji Operator");
		await isiKolom("amount", "110000");
		await pilihSelect("repeat", "Per machine shift");
		await lalu();
		await simpan();
		await klik(page.locator(".page-actions .primary-action:visible").first());
		await tidur(900);
		const ya = page.locator(".modal.show").getByRole("button", { name: /^(Ya|Yes)$/ }).first();
		if (await ya.isVisible().catch(() => false)) await klik(ya);
		const tolak = page.locator(".modal.show .modal-content").filter({ hasText: /Akhiri|End the earlier/ }).first();
		await tolak.waitFor({ state: "visible", timeout: 30000 });
		await lalu();
		await zoom(tolak, 1.4);
		await tungguSuara();
		await zoom(null);
		await page.keyboard.press("Escape");
		await tidur(600);
		// 14
		await teks("Kenaikan gaji: akhiri catatan lama terlebih dahulu");
		await kartuLayar("Naik gaji", [["1", "Isi Sampai di catatan lama"], ["2", "Buat catatan baru mulai besoknya"]]);
		await jeda();
		await tutupKartu();
		// 15
		bab("Laporan Biaya Bulanan");
		await teks("Biaya Bulanan menampilkan seluruh biaya sebulan");
		await menu("/desk/buying");
		await klik(kartu(/Biaya Bulanan/));
		await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
		await tunggu(1500);
		await lalu();
		await ke(page.locator('.page-form:visible [data-fieldname="company"]').first());
		await ke(page.locator('.page-form:visible [data-fieldname="bulan"]').first());
		await tungguSuara();
		// 16
		await teks("Satu baris untuk setiap kategori");
		for (const k of [/Gaji Operator/, /Gaji Karyawan Tetap/, /Listrik/, /Bensin/]) await bacaBaris(k);
		await tungguSuara();
		// 17
		await teks("Gaji operator dirinci per mesin");
		await bacaBaris(/Mesin 02/);
		await lalu();
		await bacaBaris(/Mesin 03/);
		await tungguSuara();
		// 18
		bab("Pigmen dan kemasan");
		await teks("Pigmen dan kemasan dihitung dari pemakaian");
		await bacaBaris(/Pigmen/);
		await lalu();
		await bacaBaris(/Kemasan/);
		await tungguSuara();
		// 19
		await teks("Total seluruh biaya bulan tersebut");
		await bacaBaris(/Total/);
		await tungguSuara();
		// 20
		bab("Gaji operator belum dicatat");
		await teks("Pesan muncul jika gaji operator belum dicatat");
		await klik(page.locator('.page-form:visible [data-fieldname="bulan"] input').first());
		await page.keyboard.press("ControlOrMeta+A");
		await ketik(bulanLalu);
		await page.keyboard.press("Escape");
		await page.keyboard.press("Tab");
		await tunggu(2500);
		const pesan = page.locator(".report-message:visible, .report-footer:visible, .msg-box:visible").filter({ hasText: /Gaji|wage/i }).first();
		if (await pesan.count()) await zoom(pesan, 1.6);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 21
		await teks("Catat setiap biaya, periksa setiap bulan");
		await menu("/desk/buying");
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	}, ["Expense Entry"]);
}

// docs/video/lengkap-a10-cek-data-dan-rencana.md: Missing Data, Order Readiness, forecast, MPS, MRP, lead times
// (about 7 minutes). The forecast and schedule it makes are cancelled or deleted at the end, the lead time deleted.
async function lengkapA10() {
	const dibersihkan = ["Master Production Schedule", "Sales Forecast", "Item Lead Time", "Item Price"];
	return ambil("admin@example.com", [], async ({ hari }) => {
		const company = await page.evaluate(() => frappe.defaults.get_user_default("Company"));
		const riwayat = [...new Set(((await api("frappe.client.get_list", { doctype: "Sales History", filters: { item_code: ["like", "GAYUNG-%"] }, fields: ["item_code"], limit_page_length: 100 })).x || []).map((r) => r.item_code))].slice(0, 2);
		const tanpaRiwayat = (await api("frappe.client.get_list", { doctype: "Item", filters: { variant_of: "SEAL-CAP", disabled: 0 }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
		const siap = await page.evaluate(async (c) => (await frappe.xcall("frappe.desk.query_report.run", { report_name: "Order Readiness", filters: { company: c } })).result, company);
		const tanpaLama = (siap || []).find((r) => r.status === "Set lead time" && !riwayat.includes(r.item_code))?.item_code;
		if (riwayat.length < 2 || !tanpaRiwayat || !tanpaLama) throw new Error(`A10 data: ${riwayat} ${tanpaRiwayat} ${tanpaLama}`);
		const induk = await page.evaluate(async (c) => (await frappe.xcall("frappe.client.get_list", { doctype: "Warehouse", filters: { company: c, is_group: 1, parent_warehouse: ["is", "set"] }, fields: ["name"], limit_page_length: 1 }))[0]?.name
			|| (await frappe.xcall("frappe.client.get_list", { doctype: "Warehouse", filters: { company: c, is_group: 1 }, fields: ["name"], limit_page_length: 1 }))[0]?.name, company);
		const bulanDepan = await page.evaluate((h) => frappe.datetime.str_to_user(frappe.datetime.add_months(frappe.datetime.month_start(h), 1)), hari);
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await mulaiRekam();
		await tidur(600);
		const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();
		const bukaLaporan = async (href) => {
			await menu(href);
			await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
			await tunggu(1500);
		};

		// 1-2
		await teks("Periksa data sebelum menyusun rencana");
		await bukaLaporan("/desk/setup/query-report/Missing Data");
		await lalu();
		await daftarIsi();
		// 3
		bab("Data Belum Lengkap");
		await teks("Kekurangan, akibat, dan cara memperbaikinya");
		await zoom(page.locator(".dt-header, .dt-row-header").first(), 1.4);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 4
		await teks("Kemasan dan pigmen kosong: biaya tidak terhitung");
		await bacaBaris(/Kemasan|Packing/);
		await bacaBaris(/Pigmen|pigment/i);
		await tungguSuara();
		// 5
		await teks("Harga jual dan gaji operator");
		await bacaBaris(/Harga jual|selling price/i);
		await lalu();
		await bacaBaris(/gaji|wage/i);
		await tungguSuara();
		// 6
		await teks("Kapasitas mesin dan stok bahan");
		await bacaBaris(/Kapasitas|capacity/i);
		await lalu();
		await bacaBaris(/Stok|stock/i);
		await tungguSuara();
		// 7
		await teks("Klik tautan untuk membuka form");
		const tautan = page.locator(".dt-row:visible a.erp-perbaiki").first();
		await klik(tautan);
		await tunggu(2500);
		await lalu();
		await tungguSuara();
		await page.goto(`${URL}/desk/setup/query-report/Missing Data`);
		await page.waitForSelector(".dt-row", { timeout: 60000 }).catch(() => {});
		await tunggu(1500);
		// 8
		await teks("Saring berdasarkan barang");
		await saringLaporan("item", "GAYUNG-LUMBA");
		await tunggu(2500);
		await tungguSuara();
		// 9
		await teks("Periksa laporan ini secara rutin");
		await kartuLayar("Data belum lengkap", [["Aplikasi tetap jalan", "tapi ada yang tidak dihitung"]]);
		await jeda();
		await tutupKartu();
		// 10
		bab("Siap Order");
		await teks("Periksa Siap Order setiap Senin");
		await bukaLaporan("/desk/manufacturing/query-report/Order Readiness");
		await lalu();
		await ke(page.locator('.page-form:visible [data-fieldname="gudang"]').first());
		await tungguSuara();
		// 11
		await teks("Kolom Kurang: jumlah yang masih harus dibuat");
		await zoom(page.locator(".dt-header, .dt-row-header").first(), 1.3);
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 12
		await teks("Telat: buat Perintah Produksi hari ini");
		await bacaBaris(/Telat|Late/);
		await lalu();
		await bacaBaris(/Isi lama produksi|Set lead time/);
		await tungguSuara();
		// 13
		bab("Riwayat Penjualan");
		await teks("Riwayat Penjualan: jumlah terjual per bulan");
		await menu("/desk/selling/sales-history");
		await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
		await tunggu(1500);
		await ke(page.locator(".list-row-container:visible").first());
		await lalu();
		await tungguSuara();
		await zoom(null);
		// 14
		bab("Perkiraan Penjualan");
		await teks("Perkiraan Penjualan untuk bulan depan");
		await menu("/desk/manufacturing/sales-forecast");
		await baru();
		await lalu();
		await pilihSelect("frequency", "Monthly");
		await isiKolom("from_date", bulanDepan);
		await isiKolom("demand_number", "1");
		if (induk) await isiLink("parent_warehouse", induk.split(" - ")[0], induk);
		await tungguSuara();
		// 15
		await teks("Isi dari Riwayat: rata-rata 3 bulan");
		for (const it of [...riwayat, tanpaRiwayat]) {
			await klik(kolom("selected_items").locator("input").first());
			await pilihDariDaftar(it, it);
		}
		await klik(page.locator(".title-area:visible").first()); // closes the item list
		await lalu();
		await simpan();
		await lalu();
		await klik(page.locator(".page-actions button:visible").filter({ hasText: /Isi dari Riwayat|Fill from History/ }).first());
		const pesan = page.locator(".modal.show .modal-content").first();
		await pesan.waitFor({ state: "visible", timeout: 60000 });
		await tidur(800);
		await zoom(pesan, 1.4);
		await tungguSuara();
		await zoom(null);
		await page.keyboard.press("Escape");
		await tunggu(1200);
		// 16
		await teks("Periksa angka, lalu kirim");
		const idx = await page.evaluate((k) => cur_frm.doc.items.find((r) => r.item_code === k)?.idx, tanpaRiwayat);
		if (idx) await isiSel("items", idx, "demand_qty", "20000");
		await lalu();
		await isiSel("items", idx === 1 ? 2 : 1, "demand_qty", "1500");
		await lalu();
		await simpan();
		await ajukan();
		// 17
		bab("Jadwal Produksi Induk");
		await teks("Jadwal Produksi Induk: jumlah yang akan dibuat");
		await klik(page.locator(".page-actions button:visible").filter({ hasText: /Buat MPS|Create MPS/ }).first());
		await tidur(1500);
		const ok = page.locator(".modal.show .btn-modal-primary").first();
		if (await ok.isVisible().catch(() => false)) await klik(ok);
		await page.waitForFunction(() => window.cur_frm?.doctype === "Master Production Schedule", null, { timeout: 60000 });
		await tunggu(1500);
		await lalu();
		const tabOrder = page.locator(".form-tabs:visible .nav-link").filter({ hasText: /Order Penjualan|Sales Order/ }).first();
		if (await tabOrder.count()) {
			await klik(tabOrder);
			await tidur(800);
		}
		for (const f of ["get_sales_orders", "get_actual_demand"]) if (await kolom(f).isVisible().catch(() => false)) await ke(kolom(f));
		await lalu();
		if (await page.evaluate(() => cur_frm.is_new() || cur_frm.is_dirty())) await simpan();
		const mps = await page.evaluate(() => cur_frm.doc.name);
		// 18
		bab("Kebutuhan bahan");
		await teks("Material Requirements Planning (MRP): kebutuhan bahan untuk rencana");
		await bukaLaporan("/desk/manufacturing/query-report/Material Requirements Planning Report");
		await saringLaporan("mps", mps);
		if (induk) await saringLaporan("warehouse", induk);
		await tunggu(3000);
		await lalu();
		await tungguSuara();
		// 19
		await teks("Centang, lalu buat pesanan atau perintah");
		await ke(page.locator(".dt-row:visible").first().locator(".dt-cell").nth(1));
		await lalu();
		await zoom(null);
		const tombolMrp = page.locator(".page-actions button:visible, .page-head button:visible").filter({ hasText: /Pembelian|Purchase|Work Order|Perintah/ }).first();
		if (await tombolMrp.count()) await ke(tombolMrp);
		await tungguSuara();
		// 20
		bab("Lama Produksi Barang");
		await teks("Lama Produksi Barang: waktu pembuatan produk");
		await menu("/desk/manufacturing/item-lead-time");
		await baru();
		await isiLink("item_code", tanpaLama, tanpaLama);
		await lalu();
		await tungguSuara();
		// 21
		await teks("Kapasitas harian dan hari cadangan");
		const tabMasak = page.locator(".form-tabs:visible .nav-link").filter({ hasText: /Manufactur|Produksi|Pembuatan/ }).first();
		if (!(await kolom("capacity_per_day").isVisible().catch(() => false)) && (await tabMasak.count())) {
			await klik(tabMasak);
			await tidur(800);
		}
		await isiKolom("capacity_per_day", "5000");
		await lalu();
		if (!(await kolom("buffer_time").isVisible().catch(() => false))) {
			for (let i = 0; i < 4 && !(await kolom("buffer_time").isVisible().catch(() => false)); i++) {
				await klik(tabForm(i));
				await tidur(600);
			}
		}
		await isiKolom("buffer_time", "1");
		await simpan();
		// 22
		await teks("Siap Order kini menampilkan tanggal mulai");
		await bukaLaporan("/desk/manufacturing/query-report/Order Readiness");
		await lalu();
		await bacaBaris(new RegExp(tanpaLama));
		await tungguSuara();
		// 23
		await teks("Riwayat, perkiraan, jadwal, Material Requirements Planning (MRP), perintah");
		await page.goto(`${URL}/desk/home`);
		await tunggu(1500);
		await lalu();
		await tungguSuara();
		await tidur(800);
		await teks("");
		await tidur(700);
		return await selesaiRekam();
	}, dibersihkan);
}

// docs/video/lengkap-h1-hr.md: employees, shifts, leave, check-ins, holidays (about 6 minutes). Everything the take
// makes is cancelled and deleted at the end (Fajar too), and the holiday row it adds is removed again.
async function lengkapH1() {
	const HR = "/desk/shift-and-attendance";
	let libur = null;
	const dibersihkan = ["Leave Application", "Leave Allocation", "Shift Assignment", "Employee Checkin", "Attendance"];
	try {
		return await ambil("admin@example.com", [], async ({ hari }) => {
			const tahun = hari.slice(0, 4);
			libur = (await api("frappe.client.get_list", { doctype: "Holiday List", filters: { name: ["like", `%${tahun}%`] }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
			if (!libur) throw new Error(`No Holiday List for ${tahun}`);
			const u = (iso) => page.evaluate((d) => frappe.datetime.str_to_user(d), iso);
			const kemarinPagi = await page.evaluate((h) => {
				let d = frappe.datetime.add_days(h, -1);
				while ([0, 6].includes(new Date(d).getDay())) d = frappe.datetime.add_days(d, -1);
				return frappe.datetime.str_to_user(d) + " 08:05:00";
			}, hari);
			const mingguDepan = await page.evaluate((h) => { let d = frappe.datetime.add_days(h, 7); while (new Date(d).getDay() !== 1) d = frappe.datetime.add_days(d, 1); return d; }, hari);
			const tglLibur = await page.evaluate((h) => frappe.datetime.add_days(h, 30), hari);
			await page.goto(`${URL}/desk/home`);
			await tunggu(1500);
			await mulaiRekam();
			await tidur(600);
			const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();
			const keHR = async () => {
				await menu(`${HR}/hr`);
			};

			// 1-2
			await teks("Sumber Daya Manusia (SDM): karyawan, absen, dan cuti");
			await keHR();
			await lalu();
			await daftarIsi();
			// 3
			bab("Kartu halaman SDM");
			await teks("Terdapat 8 kartu utama");
			for (const k of [/Karyawan/, /Absen/, /Kehadiran/, /Cuti Baru|Pengajuan Cuti/, /Jenis Shift/, /Jadwal Shift/, /Hari Libur/, /Jatah Cuti/]) {
				if (await kartu(k).isVisible().catch(() => false)) {
					await ke(kartu(k));
					await tidur(250);
				}
			}
			await lalu();
			await tungguSuara();
			// 4
			bab("Karyawan baru");
			await teks("Karyawan baru dicatat di sini");
			await klik(kartu(/Karyawan/));
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1200);
			await lalu();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			await tunggu(1500);
			const lengkap = page.locator(".modal.show").getByRole("button", { name: /Sunting Formulir Lengkap|Edit Full Form/ }).first();
			if (await lengkap.isVisible().catch(() => false)) await lengkap.click(); // under the caption band
			await page.waitForFunction(() => window.cur_frm?.doctype === "Employee" && cur_frm.doc.__islocal, null, { timeout: 30000 });
			await tunggu(1200);
			// 5
			await teks("Nama, jenis kelamin, tanggal lahir, tanggal masuk");
			await isiKolom("first_name", "Fajar");
			await isiLink("gender", "Laki", "Laki-laki").catch(async () => isiLink("gender", "Male", "Male"));
			await isiKolom("date_of_birth", await u(`${Number(tahun) - 25}-03-14`));
			await lalu();
			await isiKolom("date_of_joining", await u(hari));
			await ke(kolom("company"));
			await tungguSuara();
			// 6
			await teks("ID Pengguna: akun aplikasi karyawan");
			await bukaBagian("user_id");
			if (await kolom("user_id").isVisible().catch(() => false)) await zoom(kolom("user_id"), 1.6);
			await lalu();
			await tungguSuara();
			await zoom(null);
			await simpan();
			const fajar = await page.evaluate(() => cur_frm.doc.name);
			// 7
			bab("Jenis Shift dan jam kerja");
			await teks("Shift Kantor: pukul 08.00 sampai 17.00");
			await bukaForm(`${HR}/shift-type/Kantor`, "Shift Type");
			await ke(kolom("start_time"));
			await ke(kolom("end_time"));
			await lalu();
			await bukaBagian("enable_auto_attendance");
			if (await kolom("enable_auto_attendance").isVisible().catch(() => false)) await ke(kolom("enable_auto_attendance"));
			await tungguSuara();
			// 8
			await teks("Telat setelah 08.10, pulang cepat sebelum 16.50");
			await bukaBagian("late_entry_grace_period");
			for (const f of ["late_entry_grace_period", "early_exit_grace_period"]) if (await kolom(f).isVisible().catch(() => false)) await ke(kolom(f));
			await lalu();
			await tungguSuara();
			// 9
			await teks("Jam shift Kantor tidak diubah manual");
			await ke(kolom("start_time"));
			await ke(kolom("end_time"));
			await jeda();
			// 10
			bab("Jadwal Shift");
			await teks("Jadwal Shift menentukan shift karyawan");
			await menu(`${HR}/shift-assignment`);
			await baru();
			await lalu();
			await isiLink("employee", "Fajar", "Fajar");
			await isiLink("shift_type", "Kantor", "Kantor");
			await isiKolom("start_date", await u(hari));
			await lalu();
			await simpan();
			await ajukan();
			// 11
			bab("Jatah Cuti");
			await teks("Jatah Cuti Tahunan: 12 hari per tahun");
			await menu(`${HR}/leave-allocation`);
			await baru();
			await lalu();
			await isiLink("employee", "Fajar", "Fajar");
			await isiLink("leave_type", "Cuti Tahunan", "Cuti Tahunan");
			await isiKolom("from_date", await u(`${tahun}-01-01`));
			await isiKolom("to_date", await u(`${tahun}-12-31`));
			await isiKolom("new_leaves_allocated", "12");
			await lalu();
			await simpan();
			await ajukan();
			// 12
			bab("Absen dan kehadiran");
			await teks("Absen dari ponsel tercatat di sini");
			await menu(`${HR}/employee-checkin`);
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 }).catch(() => {});
			await tunggu(1200);
			await lalu();
			await tungguSuara();
			// 13
			await teks("Absen terlewat dapat ditambahkan petugas Sumber Daya Manusia (SDM)");
			// The primary button checks in the user; another employee's check-in has its own button.
			await klik(page.locator(".page-actions button:visible").filter({ hasText: /Another Employee|Karyawan Lain/ }).first());
			await tunggu(1500);
			if (await page.locator(".modal.show").isVisible().catch(() => false)) {
				const d = (f) => page.locator(`.modal.show .frappe-control[data-fieldname="${f}"]`).first();
				await klik(d("employee").locator("input"));
				await pilihDariDaftar("Fajar", "Fajar");
				if (await d("log_type").locator("select").count()) await d("log_type").locator("select").selectOption("IN");
				await lalu();
				if (await d("time").count()) {
					await klik(d("time").locator("input"));
					await page.keyboard.press("ControlOrMeta+A");
					await ketik(kemarinPagi);
					await page.keyboard.press("Escape");
				}
				await klik(page.locator(".modal.show .btn-modal-primary").first());
				await page.waitForFunction(() => !document.querySelector(".modal.show"), null, { timeout: 30000 }).catch(() => {});
				await tunggu(1500);
			} else {
				await page.waitForFunction(() => window.cur_frm?.doctype === "Employee Checkin" && cur_frm.doc.__islocal, null, { timeout: 30000 });
				await isiLink("employee", "Fajar", "Fajar");
				await pilihSelect("log_type", "IN");
				await lalu();
				await isiKolom("time", kemarinPagi);
				// HR asks for a location on every check-in: the office's, as the phone would send it.
				await page.evaluate(() => cur_frm.set_value({ latitude: -6.12, longitude: 106.79 }));
				await simpan();
			}
			// 14
			await teks("Kehadiran dibuat otomatis setiap jam");
			await menu(`${HR}/attendance`);
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 }).catch(() => {});
			await tunggu(1500);
			await lalu();
			await tungguSuara();
			// 15
			await teks("Terlambat dan pulang cepat diberi tanda");
			const telat = page.locator(".list-row-container:visible").filter({ hasText: /HR-ATT/ }).first();
			if (await telat.isVisible().catch(() => false)) {
				await klik(telat.locator(".list-subject").first());
				await page.waitForFunction(() => window.cur_frm?.doctype === "Attendance", null, { timeout: 30000 });
				await tunggu(1500);
				if (await kolom("late_entry").isVisible().catch(() => false)) await zoom(kolom("late_entry"), 1.8);
			}
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 16
			bab("Hari libur");
			await teks("Sabtu dan Minggu sudah terdaftar");
			await bukaForm(`${HR}/holiday-list/${encodeURIComponent(libur)}`, "Holiday List");
			await ke(page.locator('.frappe-control[data-fieldname="holidays"]:visible .grid-body .grid-row').first());
			await lalu();
			await tungguSuara();
			// 17
			await teks("Tambahkan libur nasional sesuai Surat Keputusan Bersama (SKB)");
			// The table holds a year of weekends over several pages: the new row is added with the table's button and
			// filled in the form's data, then shown on the last page.
			await klik(page.locator('.frappe-control[data-fieldname="holidays"]:visible .grid-add-row').first());
			await tidur(800);
			await page.evaluate(async (t) => {
				const r = cur_frm.doc.holidays.at(-1);
				await frappe.model.set_value(r.doctype, r.name, { holiday_date: t, description: "Idul Fitri" });
				const g = cur_frm.fields_dict.holidays.grid;
				g.refresh();
				g.grid_pagination?.go_to_page?.(g.grid_pagination.total_pages);
			}, tglLibur);
			await tidur(1200);
			const barisLibur = page.locator('.frappe-control[data-fieldname="holidays"]:visible .grid-row').filter({ hasText: "Idul Fitri" }).first();
			if (await barisLibur.isVisible().catch(() => false)) await ke(barisLibur);
			await lalu();
			await simpan();
			// 18
			await teks("Get Local Holidays: tetap cocokkan dengan Surat Keputusan Bersama (SKB)");
			const lokal = page.locator('.frappe-control[data-fieldname="get_local_holidays"] button, button:visible').filter({ hasText: /Get Local Holidays|Libur Lokal/ }).first();
			if (await lokal.count()) await zoom(lokal, 1.8);
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 19
			bab("Pengajuan cuti");
			await teks("Pengajuan cuti: jenis, tanggal, alasan");
			await menu(`${HR}/leave-application`);
			await baru();
			await isiLink("employee", "Citra", "Citra");
			await isiLink("leave_type", "Cuti Tahunan", "Cuti Tahunan");
			await lalu();
			await isiKolom("from_date", await u(mingguDepan));
			await isiKolom("to_date", await u(await page.evaluate((d) => frappe.datetime.add_days(d, 1), mingguDepan)));
			await isiKolom("description", "Acara keluarga");
			// 20
			await teks("Cuti Tahunan, Sakit, dan Izin");
			await zoom(kolom("leave_type"), 1.6);
			await lalu();
			await tungguSuara();
			await zoom(null);
			// 21
			await teks("Setujui, lalu kirim");
			await simpan();
			await lalu();
			await pilihSelect("status", "Approved");
			await lalu();
			await simpan();
			await ajukan();
			if (await kolom("leave_balance").isVisible().catch(() => false)) await zoom(kolom("leave_balance"), 1.8);
			await tungguSuara();
			await zoom(null);
			// 22
			await teks("Jatah tidak cukup, pengajuan ditolak");
			await page.goto(`${URL}${HR}/leave-application/new`, { waitUntil: "domcontentloaded" });
			await page.waitForFunction(() => window.cur_frm?.doctype === "Leave Application" && cur_frm.doc.__islocal, null, { timeout: 30000 });
			await tunggu(1500);
			await isiLink("employee", "Citra", "Citra");
			await isiLink("leave_type", "Cuti Tahunan", "Cuti Tahunan");
			const akhir = await page.evaluate((d) => frappe.datetime.add_days(d, 30), mingguDepan);
			await isiKolom("from_date", await u(await page.evaluate((d) => frappe.datetime.add_days(d, 14), mingguDepan)));
			await isiKolom("to_date", await u(akhir));
			await lalu();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			const tolak = page.locator(".modal.show .modal-content").first();
			await tolak.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
			if (await tolak.isVisible().catch(() => false)) await zoom(tolak, 1.4);
			await tungguSuara();
			await zoom(null);
			await page.keyboard.press("Escape");
			await tidur(600);
			// 23
			await teks("Periksa Kehadiran Hari Ini setiap pagi");
			await keHR();
			await zoom(kartu(/Kehadiran/), 1.8);
			await lalu();
			await tungguSuara();
			await zoom(null);
			await tidur(800);
			await teks("");
			await tidur(700);
			void fajar;
			return await selesaiRekam();
		}, dibersihkan);
	} finally {
		// The take's holiday row out again, and Fajar deleted (as the Super Admin: an Admin may not delete).
		if (libur) {
			const d = (await api("frappe.client.get", { doctype: "Holiday List", name: libur })).x;
			if (d?.holidays?.some((h) => h.description === "Idul Fitri")) {
				d.holidays = d.holidays.filter((h) => h.description !== "Idul Fitri");
				const h = await api("frappe.client.save", { doc: d });
				if (!h.ok) console.error(`could not remove the take's holiday: ${h.e}`);
			}
		}
		const emp = (await api("frappe.client.get_list", { doctype: "Employee", filters: { first_name: "Fajar" }, fields: ["name"], limit_page_length: 5 })).x || [];
		for (const { name } of emp) await hapusPihak("Employee", name, "employee", ["Leave Application", "Leave Allocation", "Shift Assignment", "Attendance"]);
	}
}

// docs/video/lengkap-s1-super-admin.md: the Super Admin's extras (about 5 minutes). Saves no setting; the new user
// it makes is deleted at the end.
async function lengkapS1() {
	const BARU = "operator.baru@example.com";
	try {
		return await ambil("developer@example.com", [], async () => {
			if ((await api("frappe.client.get_count", { doctype: "User", filters: { name: BARU } })).x) throw new Error(`${BARU} exists: delete it first.`);
			const wo = (await api("frappe.client.get_list", { doctype: "Work Order", filters: { docstatus: 1, status: ["in", ["Not Started", "In Process"]] }, fields: ["name"], limit_page_length: 1 })).x?.[0]?.name;
			if (!wo) throw new Error("No open Work Order (run contoh.buat_contoh).");
			await page.goto(`${URL}/desk/home`);
			await tunggu(1500);
			await mulaiRekam();
			await tidur(600);
			const kartu = (pola) => page.locator(".widget.shortcut-widget-box").filter({ hasText: pola }).first();
			const judul = (t) => page.locator(".body-sidebar .section-break").filter({ hasText: t }).first();

			// 1-2
			await teks("Super Admin: seluruh akses Admin dan fitur khusus");
			await ke(sisi("production-floor"));
			await ke(sisi("daily-input"));
			await lalu();
			for (const t of ["Stok", "Penjualan", "Pembelian", "Produksi", "Proyek", "SDM", "Pengaturan"]) {
				if (await judul(t).isVisible().catch(() => false)) {
					await ke(judul(t));
					await tidur(250);
				}
			}
			await daftarIsi();
			// 3
			bab("Tiga peran");
			await teks("Terdapat 3 peran: Produksi, Admin, Super Admin");
			await kartuLayar("Tiga peran", [
				["Produksi", "Mencatat hasil produksi dan status mesin"],
				["Admin", "Pesanan, gudang, barang, dan pengguna"],
				["Super Admin", "Seluruhnya, termasuk pengaturan usaha"],
			]);
			await lalu();
			await tungguSuara();
			await tutupKartu();
			// 4
			bab("Pengaturan usaha");
			await teks("Terdapat 7 halaman pengaturan usaha");
			await menu("/desk/setup/home");
			await lalu();
			for (const k of [/Pengaturan Stok/, /Pengaturan Penjualan/, /Pengaturan Pembelian/, /Pengaturan Manufaktur|Pengaturan Produksi/, /Pengaturan Akun/, /Pengaturan Proyek/, /Pengaturan SDM/]) {
				if (await kartu(k).isVisible().catch(() => false)) {
					await ke(kartu(k));
					await tidur(250);
				}
			}
			// 5
			await teks("Contoh: stok tidak boleh minus");
			await bukaForm("/desk/setup/stock-settings/Stock Settings", "Stock Settings");
			await bukaBagian("allow_negative_stock");
			if (await kolom("allow_negative_stock").isVisible().catch(() => false)) await zoom(kolom("allow_negative_stock"), 1.8);
			await lalu();
			await zoom(null);
			if (await kolom("valuation_method").isVisible().catch(() => false)) await ke(kolom("valuation_method"));
			await tungguSuara();
			// 6
			await teks("Pembelian wajib pesanan, produksi boleh lebih 10%");
			await bukaForm("/desk/setup/buying-settings/Buying Settings", "Buying Settings");
			await bukaBagian("po_required");
			if (await kolom("po_required").isVisible().catch(() => false)) await ke(kolom("po_required"));
			await lalu();
			await bukaForm("/desk/setup/manufacturing-settings/Manufacturing Settings", "Manufacturing Settings");
			await bukaBagian("overproduction_percentage_for_work_order");
			if (await kolom("overproduction_percentage_for_work_order").isVisible().catch(() => false)) await zoom(kolom("overproduction_percentage_for_work_order"), 1.8);
			await tungguSuara();
			await zoom(null);
			// 7
			await teks("Dipasang ulang setiap pembaruan");
			await kartuLayar("Perhatian", [["Pengaturan ini", "dipasang ulang setiap aplikasi diperbarui"]]);
			await jeda();
			await tutupKartu();
			// 8
			await teks("Ubah hanya jika benar-benar diperlukan");
			await ke(page.locator(".page-actions .primary-action:visible").first());
			await jeda();
			// 9
			bab("Tombol Selesai");
			await teks("Tombol Selesai hanya untuk Super Admin");
			await bukaForm(`/desk/manufacturing/work-order/${wo}`, "Work Order");
			const selesai = page.locator(".page-actions button:visible").filter({ hasText: /^\s*(Selesai|Finish)\s*$/ }).first();
			if (await selesai.count()) await zoom(selesai, 1.8);
			await lalu();
			await tungguSuara();
			// 10
			await teks("Hasil harian tetap dicatat di Input Harian");
			if (await selesai.count()) await ke(selesai);
			await zoom(null);
			await kartuLayar("Hasil harian", [["Catat hasil produksi", "di Input Harian"]]);
			await jeda();
			await tutupKartu();
			// 11
			bab("Kotak Sistem");
			await teks("Kotak Sistem hanya untuk Super Admin");
			await page.goto(`${URL}/desk`);
			await tunggu(2500);
			const sistem = page.getByText(/^(Sistem|System)$/).locator("visible=true").first();
			await zoom(sistem, 1.8);
			await lalu();
			await zoom(null);
			await klik(sistem);
			await tunggu(2500);
			// 12
			await teks("Build dan System Settings: alat tim Teknologi Informasi (IT)");
			await gerak(30, 200);
			await gerak(30, 420);
			await lalu();
			await bukaForm("/desk/system-settings", "System Settings");
			// 13
			await teks("Zona waktu dan format sudah diatur");
			for (const f of ["time_zone", "date_format", "number_format"]) if (await kolom(f).isVisible().catch(() => false)) await ke(kolom(f));
			await lalu();
			for (const f of ["enable_password_policy", "minimum_password_score"]) {
				await bukaBagian(f);
				if (await kolom(f).isVisible().catch(() => false)) await ke(kolom(f));
			}
			await tungguSuara();
			// 14
			bab("Modul yang dikunci");
			await teks("Modul yang tidak dipakai dikunci");
			await page.goto(`${URL}/desk/home`);
			await tunggu(2000);
			await ke(sisi("production-floor"));
			await gerak(110, 600);
			await lalu();
			await tungguSuara();
			// 15
			bab("Pengguna baru dan perannya");
			await teks("Pengguna baru: pilih peran yang tepat");
			await menu("/desk/setup/user");
			await page.waitForSelector(".list-row-container:visible", { timeout: 30000 });
			await tunggu(1000);
			await lalu();
			await klik(page.locator(".page-actions .primary-action:visible").first());
			await page.locator('.modal.show [data-fieldname="email"] input').first().waitFor({ state: "visible", timeout: 30000 });
			await tunggu(1000);
			// 16
			await teks("Petugas pabrik: peran Produksi");
			const dlg = (f) => page.locator(`.modal.show .frappe-control[data-fieldname="${f}"]`).first();
			await klik(dlg("email").locator("input"));
			await ketik(BARU);
			await klik(dlg("first_name").locator("input"));
			await ketik("Operator Baru");
			await lalu();
			await klik(dlg("role_profiles").locator("input"));
			await pilihDariDaftar("Produksi", "Produksi");
			await klik(page.locator(".modal.show .modal-title").first());
			await tidur(500);
			await lalu();
			await klik(page.locator(".modal.show .btn-modal-primary").first());
			const baris = page.locator(".list-row-container").filter({ hasText: BARU }).locator(".list-subject a").first();
			await baris.waitFor({ state: "visible", timeout: 30000 });
			await tunggu(1000);
			await klik(baris);
			await page.waitForFunction((b) => window.cur_frm?.doc?.name === b, BARU, { timeout: 30000 });
			await tunggu(1500);
			// 17
			await teks("Profil Modul sama dengan perannya");
			await klik(tabForm(1));
			await tidur(800);
			await isiLink("module_profile", "Produksi", "Produksi");
			await lalu();
			await simpan();
			await ke(kolom("roles_html").locator("input[type=checkbox]:checked").first());
			await tungguSuara();
			// 18
			await teks("Admin untuk pimpinan, Super Admin untuk Teknologi Informasi (IT)");
			await klik(kolom("role_profiles").locator("input").first());
			await pilihan().first().waitFor({ state: "visible", timeout: 15000 });
			await tidur(600);
			await ke(pilihan().filter({ hasText: /^Admin/ }).first());
			await lalu();
			await ke(pilihan().filter({ hasText: /Super Admin/ }).first());
			await tungguSuara();
			await page.keyboard.press("Escape");
			await muatUlangForm();
			await tunggu(1200);
			// 19
			await teks("Hanya Super Admin dapat memberikan Super Admin");
			await kartuLayar("Akun Admin", [["Anda tidak bisa memberi peran ini", ""], ["Hanya Super Admin yang bisa mengubah akun ini", ""]]);
			await jeda();
			await tutupKartu();
			// 20
			bab("Karyawan keluar dan sandi");
			await teks("Karyawan keluar: hapus centang Diaktifkan");
			await klik(tabForm(0));
			await tidur(800);
			await zoom(kolom("enabled"), 1.8);
			await lalu();
			await zoom(null);
			const labelSandi = await page.evaluate(() => encodeURIComponent(__("Password")));
			await ke(page.locator(`.page-actions .inner-group-button[data-label="${labelSandi}"] button`).first());
			await tungguSuara();
			// 21
			await teks("Gunakan seperlunya, beri peran sesuai tugas");
			await menu("/desk/setup/home");
			await lalu();
			await tungguSuara();
			await tidur(800);
			await teks("");
			await tidur(700);
			return await selesaiRekam();
		}, []);
	} finally {
		await hapusSebagaiSuperAdmin("User", BARU);
	}
}

const VIDEO = {
	produksi,
	contoh,
	"ringkas-operator": ringkasOperator,
	"ringkas-admin": ringkasAdmin,
	"lengkap-p1-operator-mulai": lengkapP1,
	"lengkap-p2-operator-kerja-harian": lengkapP2,
	"lengkap-a1-admin-mulai": lengkapA1,
	"lengkap-a2-data-barang": lengkapA2,
	"lengkap-a3-mesin-dan-resep": lengkapA3,
	"lengkap-a4-stok-awal": lengkapA4,
	"lengkap-a5-pembelian": lengkapA5,
	"lengkap-a6-penjualan": lengkapA6,
	"lengkap-a7-produksi": lengkapA7,
	"lengkap-a8-gudang-dan-kirim": lengkapA8,
	"lengkap-a9-biaya": lengkapA9,
	"lengkap-a10-cek-data-dan-rencana": lengkapA10,
	"lengkap-h1-hr": lengkapH1,
	"lengkap-s1-super-admin": lengkapS1,
};
if (!VIDEO[NAMA]) {
	console.error(`Unknown video ${NAMA}; known: ${Object.keys(VIDEO).join(", ")}`);
	process.exit(2);
}
siapkanNaskah(NAMA);
try {
	const h = await VIDEO[NAMA]();
	console.log(`rekam_demo: ${NAMA} ${h.detik} s, ${h.bingkai} frames → ${KELUAR}`);
	if (galat.length) console.log(`page errors: ${galat.slice(0, 3).join(" | ")}`);
	if (masalah.length) {
		console.log(`FRAMING FAILED (${masalah.length}):\n- ${masalah.join("\n- ")}`);
		process.exitCode = 1;
	} else console.log("framing: every zoomed or pointed element in frame");
} finally {
	await browser.close();
	if (process.env.ERP_SIMPAN) console.log(`kept ${FOLDER}`);
	else rmSync(FOLDER, { recursive: true, force: true });
}
