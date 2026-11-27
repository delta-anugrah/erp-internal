// Records a demo video of one profile's work on erp.localhost, like a person at the keyboard: a drawn cursor that
// glides on curves and pauses before it clicks, typing one key at a time, a soft zoom onto what matters, and a
// caption bar at the bottom. The script of each video (captions and the voice-over text) is in docs/video/.
//
//   ERP_SANDI=<SAMPLE_PASSWORD> node tools/rekam_demo.mjs produksi [out.mp4]   # default ~/Desktop/demo-produksi.mp4
//
// Needs `bench start`, the sample data (contoh.py) and ffmpeg. The page is 1440x810 CSS px at 1x and encoded to
// 1920x1080 H.264. Headless Chromium's screencast sends 1440x810 frames whatever the device scale factor, so 2x only
// made the browser work harder (the Production Floor's video fell to 7-15 frames a second on a busy laptop); the zoom
// is a CSS transform, so zoomed text is still drawn sharp. The user's language is switched to Indonesian for the take
// and back to what it was after; what the take records is cancelled again at the end.
// Captions here must match docs/video/<name>.md.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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
const page = await ctx.newPage();
const galat = [];
page.on("pageerror", (e) => galat.push(String(e)));
page.on("dialog", (d) => d.dismiss().catch(() => {})); // an alert would block every later step
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
	const ok = k && k.x >= -2 && k.y >= -2 && k.x + k.width <= v.width + 2 && k.y + k.height <= v.height - BAWAH + 2;
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
	if (!existsSync(berkas)) execFileSync(EDGE_TTS, ["--voice", SUARA, `--rate=${TEMPO}`, "--text", ucapan, "--write-media", berkas]);
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
	await page.evaluate((isi) => {
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
	}, isi);
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
	page.locator(`.frappe-control[data-fieldname="${tabel}"] .grid-row[data-idx="${idx}"] .grid-static-col[data-fieldname="${nama}"]`).first();
async function isiSel(tabel, idx, nama, nilai, pilih) {
	if (!(await sel(tabel, idx, nama).count())) {
		await klik(page.locator(`.frappe-control[data-fieldname="${tabel}"] .grid-add-row`).first());
		await tidur(700);
	}
	await klik(sel(tabel, idx, nama));
	const inp = page.locator(`.frappe-control[data-fieldname="${tabel}"] .grid-row[data-idx="${idx}"] input[data-fieldname="${nama}"]`).first();
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
	const inp = page.locator(`.frappe-control[data-fieldname="${tabel}"] .grid-row[data-idx="${idx}"] input[data-fieldname="${nama}"]`).first();
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

const VIDEO = { produksi, contoh, "ringkas-operator": ringkasOperator, "ringkas-admin": ringkasAdmin };
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
