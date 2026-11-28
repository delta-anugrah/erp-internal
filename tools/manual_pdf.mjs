// Builds the user manuals of docs/manual/ into PDFs (A4, cover, contents, header/footer).
//   node tools/manual_pdf.mjs [operator|admin ...]   -> docs/manual/pdf/<name>.pdf
// Needs Playwright's Chromium (cd tools && npm install && npx playwright install chromium).
// No Markdown library is installed, so md() below handles only what the manuals use:
// front matter, #-###, paragraphs, **bold**, `code`, [links](#x), ![images](gambar/x.png),
// - / 1. lists (one nested level, lazy continuation lines), tables, > callouts, ---.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANUAL = join(REPO, "docs", "manual");
const KELUAR = join(MANUAL, "pdf");
const SEMUA = ["operator", "admin"];
const PERUSAHAAN = "PT Delta Anugrah";
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif`;

const versi = () => {
	const m = readFileSync(join(REPO, "erp_internal", "__init__.py"), "utf8").match(/__version__\s*=\s*"([^"]+)"/);
	return m ? `v${m[1]}` : "";
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// GitHub-style heading ids, so the manuals' own "Daftar isi" links resolve.
export const slug = (s) =>
	s.toLowerCase().replace(/[*`]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s/g, "-");

const inline = (s) => {
	const kode = [];
	let h = esc(s).replace(/`([^`]+)`/g, (_, k) => `\u0000${kode.push(k) - 1}\u0000`);
	h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);
	h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
	return h.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${kode[i]}</code>`);
};

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

const gambar = (alt, src) => {
	const file = join(MANUAL, src);
	const id = src.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
	const ext = src.split(".").pop().toLowerCase();
	const isi = existsSync(file)
		? `<img src="data:${MIME[ext] || "image/png"};base64,${readFileSync(file).toString("base64")}" alt="${esc(alt)}">`
		: `<div class="kosong"><span>Gambar belum tersedia</span><code>${esc(id)}</code></div>`;
	return `<figure>${isi}<figcaption>${inline(alt)}</figcaption></figure>`;
};

const sel = (baris) => baris.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

const tabel = (baris) => {
	const kepala = sel(baris[0]);
	const isi = baris.slice(2).map((b) => `<tr>${sel(b).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`);
	const thead = kepala.some(Boolean) ? `<thead><tr>${kepala.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : "";
	return `<table${thead ? "" : ' class="info"'}>${thead}<tbody>${isi.join("")}</tbody></table>`;
};

const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

const daftar = (baris) => {
	// Items keyed by indent: indent >= 2 belongs to the previous top-level item as a nested list.
	const atas = [];
	for (const b of baris) {
		const m = b.match(LIST);
		if (m && m[1].length < 2) atas.push({ teks: m[3], anak: [], urut: /\d/.test(m[2]), mulai: parseInt(m[2]) });
		else if (m) atas.at(-1).anak.push(b.replace(/^\s+/, ""));
		else {
			const ujung = atas.at(-1);
			if (ujung.anak.length) ujung.anak[ujung.anak.length - 1] += " " + b.trim();
			else ujung.teks += " " + b.trim();
		}
	}
	const tag = atas[0].urut ? "ol" : "ul";
	const mulai = atas[0].urut && atas[0].mulai !== 1 ? ` start="${atas[0].mulai}"` : "";
	const li = atas.map((i) => `<li>${inline(i.teks)}${i.anak.length ? daftar(i.anak) : ""}</li>`);
	return `<${tag}${mulai}>${li.join("")}</${tag}>`;
};

const JENIS_CATATAN = [
	[/^penting/i, "penting"],
	[/^peringatan/i, "peringatan"],
	[/^tips/i, "tips"],
];

// Returns [{jenis, html}] so the caller can move the intro's table to the cover.
export const md = (teks) => {
	const baris = teks.split("\n");
	const blok = [];
	let i = 0;
	const sampai = (uji) => {
		const ambil = [];
		while (i < baris.length && baris[i].trim() && uji(baris[i])) ambil.push(baris[i++]);
		return ambil;
	};
	while (i < baris.length) {
		const b = baris[i];
		let m;
		if (!b.trim()) i++;
		else if (/^-{3,}\s*$/.test(b)) {
			blok.push({ jenis: "hr", html: "<hr>" });
			i++;
		} else if ((m = b.match(/^(#{1,3})\s+(.*)$/))) {
			const n = m[1].length;
			blok.push({ jenis: `h${n}`, html: `<h${n} id="${slug(m[2])}">${inline(m[2])}</h${n}>` });
			i++;
		} else if ((m = b.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/))) {
			blok.push({ jenis: "img", html: gambar(m[1], m[2]) });
			i++;
		} else if (b.startsWith("|") && /^\|?[\s:|-]+\|?$/.test(baris[i + 1] || "")) {
			blok.push({ jenis: "table", html: tabel(sampai((x) => x.trim().startsWith("|"))) });
		} else if (b.startsWith(">")) {
			const dalam = sampai((x) => x.startsWith(">")).map((x) => x.replace(/^>\s?/, "")).join("\n");
			const jenis = JENIS_CATATAN.find(([re]) => re.test(dalam.replace(/^\*\*/, "")))?.[1] || "catatan";
			blok.push({ jenis: "quote", html: `<aside class="${jenis}">${md(dalam).map((x) => x.html).join("")}</aside>` });
		} else if (LIST.test(b) && !/^\s/.test(b)) {
			blok.push({ jenis: "list", html: daftar(sampai((x) => !/^(#|>|\||!\[)/.test(x) && !/^-{3,}\s*$/.test(x))) });
		} else {
			const p = sampai((x) => !/^(#{1,3}\s|>|\||!\[)/.test(x) && !LIST.test(x) && !/^-{3,}\s*$/.test(x));
			if (!p.length) p.push(baris[i++]);
			blok.push({ jenis: "p", html: `<p>${inline(p.join(" "))}</p>` });
		}
	}
	return blok;
};

const depan = (teks) => {
	const m = teks.match(/^---\n([\s\S]*?)\n---\n/);
	if (!m) return [{}, teks];
	const meta = Object.fromEntries(m[1].split("\n").map((b) => b.split(/:\s*(.*)/s).slice(0, 2)));
	return [meta, teks.slice(m[0].length)];
};

// Header and footer are CSS page margin boxes (Chromium 131+), not Playwright's templates, because
// only CSS can leave them off the cover (@page :first).
const css = (judul, v) => `
@page { size: A4; margin: 22mm 18mm 20mm 18mm;
	@top-left { content: "${judul}"; font: 7.5pt ${FONT}; color: #6b7682; vertical-align: bottom; padding-bottom: 4mm; }
	@top-right { content: "${PERUSAHAAN}"; font: 7.5pt ${FONT}; color: #6b7682; vertical-align: bottom; padding-bottom: 4mm; }
	@bottom-left { content: "ERP Internal ${v}"; font: 7.5pt ${FONT}; color: #6b7682; vertical-align: top; padding-top: 4mm; }
	@bottom-right { content: "Halaman " counter(page) " dari " counter(pages); font: 7.5pt ${FONT}; color: #6b7682;
		vertical-align: top; padding-top: 4mm; }
}
@page :first { margin: 0; @top-left { content: none; } @top-right { content: none; }
	@bottom-left { content: none; } @bottom-right { content: none; } }
:root { --biru: #1f4e79; --garis: #c9d3de; --abu: #f3f5f8; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${FONT}; font-size: 10.5pt; line-height: 1.5; color: #1d232b; }
.sampul { height: 297mm; padding: 38mm 24mm 24mm; display: flex; flex-direction: column; break-after: page;
	border-left: 14mm solid var(--biru); }
.sampul .perusahaan { font-size: 12pt; letter-spacing: .12em; text-transform: uppercase; color: var(--biru); font-weight: 600; }
.sampul h1 { font-size: 32pt; line-height: 1.15; margin: 18mm 0 4mm; color: #10263d; }
.sampul .sub { font-size: 15pt; color: #4a5866; margin: 0 0 2mm; }
.sampul .apl { font-size: 12pt; color: #4a5866; margin: 0; }
.sampul .garis { width: 40mm; height: 2px; background: var(--biru); margin: 10mm 0; }
.sampul table.info { width: auto; margin: 0; }
.sampul .bawah { margin-top: auto; font-size: 9.5pt; color: #4a5866; border-top: 1px solid var(--garis); padding-top: 4mm;
	display: flex; justify-content: space-between; }
h1, h2, h3 { color: #10263d; line-height: 1.25; break-after: avoid; }
h2 { font-size: 17pt; margin: 0 0 5mm; padding-bottom: 2mm; border-bottom: 2px solid var(--biru); break-before: page; }
h2.pertama { break-before: auto; }
h3 { font-size: 12.5pt; margin: 7mm 0 2mm; color: var(--biru); }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 3mm; padding-left: 7mm; }
li { margin: 0 0 1mm; }
li > ul, li > ol { margin: 1mm 0 0; }
hr { display: none; }
a { color: var(--biru); text-decoration: none; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .9em; background: var(--abu);
	border: 1px solid #e1e6ec; border-radius: 3px; padding: 0 1.2mm; }
table { width: 100%; border-collapse: collapse; margin: 1mm 0 4mm; font-size: 9.5pt; }
th { background: var(--biru); color: #fff; text-align: left; font-weight: 600; }
th, td { padding: 1.6mm 2.4mm; border: 1px solid var(--garis); vertical-align: top; }
tbody tr:nth-child(even) td { background: var(--abu); }
tr { break-inside: avoid; }
thead { display: table-header-group; }
table.info td { border: none; border-bottom: 1px solid var(--garis); background: none !important; }
table.info td:first-child { color: #4a5866; padding-right: 8mm; white-space: nowrap; }
aside { margin: 2mm 0 4mm; padding: 3mm 4mm; border-left: 4px solid #8a96a3; background: #f4f6f8; border-radius: 0 3px 3px 0;
	break-inside: avoid; }
aside p:last-child { margin-bottom: 0; }
aside.penting { border-color: #2563a8; background: #eaf2fb; }
aside.penting strong:first-child { color: #1d4f88; }
aside.peringatan { border-color: #d9822b; background: #fdf1e4; }
aside.peringatan strong:first-child { color: #a85a12; }
aside.tips { border-color: #3b8a5a; background: #edf6f0; }
figure { margin: 3mm 0 5mm; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 120mm; border: 1px solid var(--garis); }
figcaption { font-size: 8.5pt; color: #5b6774; margin-top: 1.5mm; font-style: italic; }
.kosong { height: 34mm; border: 1.5px dashed #aab4bf; background: #eef1f4; border-radius: 3px; display: flex;
	flex-direction: column; align-items: center; justify-content: center; gap: 1.5mm; color: #6b7682; padding: 0 10mm; }
.kosong span { font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; }
.kosong b { font-weight: 600; color: #47525e; font-size: 10pt; }
.kosong code { background: #fff; }
.isi-daftar ol { padding-left: 9mm; }
.isi-daftar li { padding: 1.4mm 0; border-bottom: 1px dotted var(--garis); margin: 0; }
.isi-daftar li::marker { color: var(--biru); font-weight: 600; }
`;

const tanggal = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const halaman = (nama) => {
	const [meta, badan] = depan(readFileSync(join(MANUAL, `${nama}.md`), "utf8"));
	const blok = md(badan);
	const judul = (meta.judul || blok.find((b) => b.jenis === "h1")?.html.replace(/<[^>]+>/g, "") || nama).trim();
	// Intro = everything before the first ---: its table goes on the cover; H1 and the bold app line are on the cover.
	const potong = blok.findIndex((b) => b.jenis === "hr");
	const intro = blok.slice(0, potong < 0 ? 0 : potong);
	const sisa = blok.slice(potong < 0 ? 0 : potong);
	const info = intro.filter((b) => b.jenis === "table").map((b) => b.html).join("");
	const atas = intro.filter((b) => b.jenis === "quote").map((b) => b.html).join("");
	let pertama = true;
	let diDaftar = false;
	const isi = sisa
		.map((b) => {
			if (b.jenis !== "h2") return diDaftar && b.jenis === "list" ? `<div class="isi-daftar">${b.html}</div>` : b.html;
			diDaftar = /Daftar isi/i.test(b.html);
			const h = pertama ? b.html.replace("<h2", '<h2 class="pertama"') : b.html;
			pertama = false;
			return h;
		})
		.join("\n");
	const v = versi();
	const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title><style>${css(judul.replace(/["\\]/g, ""), v)}</style></head>
<body>
<section class="sampul">
	<div class="perusahaan">${PERUSAHAAN}</div>
	<h1>${esc(judul)}</h1>
	<p class="sub">Panduan Pengguna${meta.peran ? ` · Peran ${esc(meta.peran)}` : ""}</p>
	<p class="apl">${esc(meta.aplikasi || "ERP Internal")}</p>
	<div class="garis"></div>
	${info}
	<div class="bawah"><span>Versi aplikasi ${esc(v)}</span><span>${esc(meta.edisi || "")}</span><span>Dicetak ${tanggal()}</span></div>
</section>
${atas}
${isi}
</body></html>`;
	return { html, judul, v };
};

const buat = async (browser, nama) => {
	const { html } = halaman(nama);
	const page = await browser.newPage();
	await page.setContent(html, { waitUntil: "load" });
	const keluar = join(KELUAR, `${nama}.pdf`);
	await page.pdf({
		path: keluar,
		format: "A4",
		printBackground: true,
		preferCSSPageSize: true,
		outline: true,
		tagged: true,
	});
	await page.close();
	return keluar;
};

const main = async () => {
	const minta = process.argv.slice(2);
	const nama = minta.length ? minta : SEMUA;
	const salah = nama.filter((n) => !SEMUA.includes(n));
	if (salah.length) {
		console.error(`Unknown manual: ${salah.join(", ")}. Choose from: ${SEMUA.join(", ")}`);
		process.exit(2);
	}
	// Self-check of the converter on the constructs the manuals rely on.
	console.assert(slug("12. Kalau ... maka ... (tanya jawab)") === "12-kalau--maka--tanya-jawab", "slug");
	console.assert(md("> **Peringatan.** x")[0].html.includes('class="peringatan"'), "callout");
	console.assert(md("1. a\n   - b\n2. c")[0].html === "<ol><li>a<ul><li>b</li></ul></li><li>c</li></ol>", "list");
	mkdirSync(KELUAR, { recursive: true });
	const browser = await chromium.launch();
	try {
		for (const n of nama) console.log(`wrote ${await buat(browser, n)}`);
	} finally {
		await browser.close();
	}
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
