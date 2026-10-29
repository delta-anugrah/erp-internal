// The info bar over the 3D floor, laid out like BPT Live's screen: a top bar (company logo and name, "Production
// Floor", the machine count, the live dot and a ticking clock), a row of KPI cards on the right, and a collapsible
// machine table at the bottom left whose status chips double as the legend. A table row selects its machine
// through `saatPilih`, the same path as a click in the scene.
//
// Record text goes in through textContent only; the logo's src is set only for a same-origin /files/ or
// /private/files/ path, else the company's initials show. Figures change only on `perbarui()`; the clock writes
// its text once a second (one setInterval, stopped by `jeda()` and `buang()`).
import { isiChip, judulMesin, persen } from "./label.js";
import { STATUS } from "./panel.js";

export const GAYA_HUD = `
.hud{position:absolute;inset:0;pointer-events:none;font-size:13px;line-height:1.35}
.hud .kartu{pointer-events:auto}
.hud .redup{color:var(--kaca-redup)}
.angka{font-variant-numeric:tabular-nums}

.atas{position:absolute;top:12px;left:12px;right:12px;display:flex;flex-direction:column;align-items:flex-end;
	gap:10px;pointer-events:none}
.bar{align-self:stretch;min-height:60px;box-sizing:border-box;padding:10px 14px;
	display:flex;align-items:center;justify-content:space-between;gap:12px 20px;flex-wrap:wrap}
.identitas{display:flex;align-items:center;gap:12px;min-width:0}
.logo{width:40px;height:40px;flex:none;border-radius:12px;display:grid;place-items:center;overflow:hidden;
	background:#4338ca linear-gradient(140deg,#2563eb,#6d28d9);color:#fff;font-weight:700;font-size:15px;letter-spacing:.02em;
	box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
.logo.ada-gambar{background:#fff}
.logo img{width:100%;height:100%;object-fit:contain}
.nama-perusahaan{font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42vw}
.sub{font-size:12px;color:var(--kaca-redup)}
.bar .kanan{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.pil{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;
	background:var(--kaca-tombol);border:1px solid var(--kaca-garis);font-size:12px;font-weight:600;white-space:nowrap}
.live .titik{width:8px;height:8px;border-radius:50%;background:#8d969f}
.live[data-live="1"] .titik{background:#1fae5b;box-shadow:0 0 0 3px rgba(31,174,91,.22)}
.live[data-live="0"] .titik{background:#e0a800;box-shadow:0 0 0 3px rgba(224,168,0,.22)}
.jam{display:flex;flex-direction:column;align-items:flex-end;padding-left:4px}
.jam .tanggal{font-size:11px;color:var(--kaca-redup);white-space:nowrap}
.jam .waktu{font-size:16px;font-weight:650;letter-spacing:.01em}

.kpi{display:grid;grid-template-columns:repeat(5,minmax(104px,auto));padding:4px;max-width:100%;box-sizing:border-box}
.sel{padding:9px 14px 10px;min-width:0}
.sel + .sel{border-left:1px solid var(--kaca-garis)}
.sel .judul{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--kaca-redup);
	white-space:nowrap}
.sel .nilai{font-size:22px;font-weight:650;line-height:1.2;margin-top:2px;white-space:nowrap}
.sel .nilai small{font-size:13px;font-weight:600;color:var(--kaca-redup)}
.sel .judul .pendek{display:none}
.sel .ket{font-size:11.5px;color:var(--kaca-redup);white-space:nowrap}
.sel[data-kpi="jalan"] .nilai{color:var(--chip-hijau)}
.sel[data-kpi="masalah"][data-ada="1"] .nilai{color:var(--chip-merah)}

.tabel{position:absolute;left:12px;bottom:12px;width:min(470px,calc(100% - 370px));
	max-height:calc(100% - var(--atas,170px) - 24px);display:flex;flex-direction:column;overflow:hidden}
.tabel .kepala{padding:10px 12px 8px 14px;display:flex;flex-direction:column;gap:8px}
.lipat{display:flex;align-items:center;gap:8px;font:inherit;font-weight:650;font-size:14px;color:inherit;
	background:none;border:0;padding:0;cursor:pointer;text-align:left}
.lipat .jml{font-weight:600;color:var(--kaca-redup);font-size:12px}
.lipat svg{margin-left:auto;transition:transform .2s;color:var(--kaca-redup)}
.tabel[data-tutup] .lipat svg{transform:rotate(-90deg)}
.legenda{display:flex;flex-wrap:wrap;gap:5px}
.legenda .chip .jumlah{font-variant-numeric:tabular-nums;margin-left:2px}
.legenda .chip[data-nol]{background:transparent;box-shadow:inset 0 0 0 1px var(--kaca-garis)}
.tabel .isi{overflow:auto;border-top:1px solid var(--kaca-garis);max-height:320px}
.tabel[data-tutup] .isi{display:none}
.tabel table{border-collapse:collapse;width:100%}
.tabel th{position:sticky;top:0;z-index:1;background:var(--kaca-padat);text-align:left;font-size:11px;font-weight:600;
	letter-spacing:.04em;text-transform:uppercase;color:var(--kaca-redup);padding:6px 10px;white-space:nowrap}
.tabel td{padding:5px 10px;border-top:1px solid var(--kaca-garis);white-space:nowrap;vertical-align:middle}
.tabel td.no{width:28px;font-weight:650;font-variant-numeric:tabular-nums;color:var(--kaca-redup)}
.tabel td.mesin{max-width:150px;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.tabel td.wo{max-width:150px;overflow:hidden;text-overflow:ellipsis}
.tabel td.wo .kecil{display:block;font-size:11px;color:var(--kaca-redup);font-variant-numeric:tabular-nums}
.tabel tbody tr{cursor:pointer}
.tabel tbody tr:hover{background:var(--kaca-tombol)}
.tabel tbody tr.dipilih{background:var(--kaca-pilih)}
.tabel tbody tr.dipilih td.no{color:var(--kaca-aksen)}
.tabel tbody tr:focus-visible{outline:2px solid var(--kaca-aksen);outline-offset:-2px}

.kamera{position:absolute;right:12px;bottom:12px;display:flex;flex-direction:column;padding:4px;
	border-radius:16px}
.kamera button{width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:12px;
	background:none;color:inherit;font:inherit;font-size:20px;line-height:1;cursor:pointer}
.kamera button:hover{background:var(--kaca-tombol-hover)}
.kamera button + button{margin-top:2px}
:host([data-panel]) .kamera{right:346px}

@media (max-width:759px){
	.atas{top:8px;left:8px;right:8px;gap:6px}
	.bar{padding:8px 10px;gap:6px 10px;min-height:0}
	.identitas{gap:9px;flex:1 1 auto}
	.logo{width:32px;height:32px;border-radius:10px;font-size:13px}
	.nama-perusahaan{font-size:14px;max-width:52vw}
	.sub{font-size:11px}
	.bar .kanan{flex:1 1 100%;justify-content:space-between;gap:6px}
	.pil{height:24px;padding:0 9px;font-size:11px}
	.jam{flex-direction:row;align-items:baseline;gap:6px}
	.jam .waktu{font-size:14px}
	.kpi{align-self:stretch;grid-template-columns:repeat(5,minmax(0,1fr));padding:2px}
	.sel{padding:6px 7px 7px}
	.sel .judul{font-size:9.5px;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis}
	.sel .judul .panjang{display:none}
	.sel .judul .pendek{display:inline}
	.sel .nilai{font-size:16px}
	.sel .nilai small{font-size:11px}
	.sel .ket{display:none}
	.tabel{left:8px;right:auto;bottom:8px;width:calc(100% - 70px);max-height:calc(100% - var(--atas,150px) - 16px)}
	.kamera{right:8px;bottom:8px}
	:host([data-panel]) .kamera{right:8px}
}
`;

const IKON_LIPAT = `<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const KUNCI_TUTUP = "erp.lantai.tabelTutup"; // localStorage: "1" collapsed, "0" open
const HP = "(max-width: 759px)";

const angka = (n) => (typeof format_number === "function" ? format_number(n, null, 0) : String(n));
const el = (induk, tag, kelas) => {
	const e = induk.appendChild(document.createElement(tag));
	if (kelas) e.className = kelas;
	return e;
};
// Writes a node's text only when it changed.
const tulis = (node, nilai) => {
	if (node.textContent !== nilai) node.textContent = nilai;
};

// "PT Contoh Plastik" → "CP": the first letters of the first two words after a legal form.
export function inisial(nama) {
	const kata = String(nama ?? "")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter((k) => k && !/^(pt|cv|tbk|ud|persero)$/i.test(k));
	return (kata.slice(0, 2).map((k) => k[0]).join("") || "?").toUpperCase();
}

// The logo URL only when it is a file of this site (/files/ or /private/files/); anything else is null.
export function logoAman(nilai) {
	if (typeof nilai !== "string" || !nilai) return null;
	try {
		const u = new URL(nilai, location.origin);
		if (u.origin !== location.origin) return null;
		return /^\/(private\/)?files\/[^/]/.test(u.pathname) ? u.href : null;
	} catch {
		return null;
	}
}

// The figures of the info bar from `get_data()`'s machine rows; an empty status counts as Idle.
export function hitung(daftar) {
	const per = Object.fromEntries(STATUS.map((s) => [s, 0]));
	let jalan = 0;
	let belum = 0;
	let hasil = 0;
	let rencana = 0;
	for (const m of daftar || []) {
		const s = m?.status || "Idle";
		per[s] = (per[s] || 0) + 1;
		const wo = m?.wo;
		if (!wo) continue;
		if (wo.status === "In Process") jalan += 1;
		else belum += 1;
		hasil += Number(wo.produced_qty) || 0;
		rencana += Number(wo.qty) || 0;
	}
	const n = (daftar || []).length;
	return {
		mesin: n,
		per,
		produksi: per.Production || 0,
		utilisasi: n ? Math.round(((per.Production || 0) / n) * 100) : 0,
		woJalan: jalan,
		woBelum: belum,
		hasil,
		rencana,
		capai: rencana ? Math.round((hasil / rencana) * 100) : 0,
	};
}

// `saatPilih(nama)` selects a machine (a table row click); `saatDetik()` runs on each clock tick; `diam()` says
// whether the camera rests (the clock only writes then).
export function buatHud(root, { saatPilih, saatDetik, diam, saatKotak } = {}) {
	const hud = el(root, "div", "hud");

	// Top bar and KPI row in one column; its height (`--atas` on the host) keeps the panel and the table below it.
	const atas = el(hud, "div", "atas");
	const bar = el(atas, "header", "bar kartu");
	const identitas = el(bar, "div", "identitas");
	const logo = el(identitas, "div", "logo");
	const gambar = el(logo, "img");
	gambar.alt = "";
	gambar.hidden = true;
	const teksInisial = el(logo, "span", "inisial");
	const kotakNama = el(identitas, "div");
	kotakNama.style.minWidth = "0";
	const nama = el(kotakNama, "div", "nama-perusahaan");
	el(kotakNama, "div", "sub").textContent = __("Production Floor");
	const kanan = el(bar, "div", "kanan");
	const jumlah = el(kanan, "span", "pil jumlah angka");
	const live = el(kanan, "span", "pil live");
	live.dataset.live = "0";
	el(live, "i", "titik");
	const teksLive = el(live, "span", "teks angka");
	const jam = el(kanan, "div", "jam");
	const tanggal = el(jam, "span", "tanggal");
	const waktu = el(jam, "span", "waktu angka");

	// KPI row.
	const kpi = el(atas, "section", "kpi kartu");
	const sel = {};
	// Title, and a shorter one for phone width where it differs.
	for (const [kunci, judul, pendek] of [
		["mesin", __("Machines")],
		["jalan", __("Running")],
		["masalah", __("Problem")],
		["wo", __("Work Orders running"), __("WO")],
		["hasil", __("Output")],
	]) {
		const s = el(kpi, "div", "sel");
		s.dataset.kpi = kunci;
		const j = el(s, "div", "judul");
		el(j, "span", "panjang").textContent = judul;
		el(j, "span", "pendek").textContent = pendek || judul;
		sel[kunci] = { el: s, nilai: el(s, "div", "nilai angka"), ket: el(s, "div", "ket angka") };
	}

	// Machine table with the status legend in its header.
	const tabel = el(hud, "section", "tabel kartu");
	const kepala = el(tabel, "div", "kepala");
	const lipat = el(kepala, "button", "lipat");
	lipat.type = "button";
	el(lipat, "span").textContent = __("Machines");
	const jmlTabel = el(lipat, "span", "jml angka");
	lipat.insertAdjacentHTML("beforeend", IKON_LIPAT);
	const legenda = el(kepala, "div", "legenda");
	const chipLegenda = {};
	for (const s of STATUS) {
		const c = el(legenda, "span", "chip");
		isiChip(el(c, "span", "nama"), s);
		c.dataset.status = s;
		chipLegenda[s] = el(c, "span", "jumlah");
	}
	const isi = el(tabel, "div", "isi");
	const tbl = el(isi, "table");
	const trKepala = el(el(tbl, "thead"), "tr");
	for (const t of [__("No."), __("Machine"), __("Status"), __("Work Order")]) el(trKepala, "th").textContent = t;
	const tbody = el(tbl, "tbody");
	const baris = new Map(); // machine name → its row

	function setelTutup(tutup, simpan) {
		tabel.toggleAttribute("data-tutup", tutup);
		lipat.setAttribute("aria-expanded", String(!tutup));
		lipat.setAttribute("aria-label", tutup ? __("Show machine list") : __("Hide machine list"));
		if (simpan)
			try {
				localStorage.setItem(KUNCI_TUTUP, tutup ? "1" : "0");
			} catch {
				/* storage blocked: the choice lasts this page only */
			}
	}
	let tersimpan = null;
	try {
		tersimpan = localStorage.getItem(KUNCI_TUTUP);
	} catch {
		tersimpan = null;
	}
	setelTutup(window.matchMedia?.(HP).matches ? true : tersimpan === "1", false);
	lipat.addEventListener("click", () => setelTutup(!tabel.hasAttribute("data-tutup"), true));

	// A row click or Enter selects the machine like a click in the scene.
	const dariBaris = (e) => e.target.closest?.("tr[data-mesin]")?.dataset.mesin;
	tbody.addEventListener("click", (e) => {
		const n = dariBaris(e);
		if (n) saatPilih?.(n);
	});
	tbody.addEventListener("keydown", (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		const n = dariBaris(e);
		if (!n) return;
		e.preventDefault();
		saatPilih?.(n);
	});

	function barisBaru(namaMesin) {
		const tr = document.createElement("tr");
		tr.dataset.mesin = namaMesin;
		tr.tabIndex = 0;
		const no = el(tr, "td", "no");
		const mesin = el(tr, "td", "mesin");
		const chip = el(el(tr, "td", "status"), "span", "chip");
		const tdWo = el(tr, "td", "wo");
		const item = el(tdWo, "span");
		const kecil = el(tdWo, "span", "kecil");
		return { tr, no, mesin, chip, item, kecil };
	}

	let dipilih = null;
	function isiTabel(daftar) {
		const hidup = new Set();
		let sebelum = null;
		for (const m of daftar) {
			const n = String(m?.name ?? "");
			hidup.add(n);
			let b = baris.get(n);
			if (!b) {
				b = barisBaru(n);
				baris.set(n, b);
			}
			// Keep the server's order (floor order) without moving rows that are already in place.
			const tempat = sebelum ? sebelum.nextSibling : tbody.firstChild;
			if (tempat !== b.tr) tbody.insertBefore(b.tr, tempat);
			sebelum = b.tr;
			tulis(b.no, Number(m?.nomor) > 0 ? String(m.nomor).padStart(2, "0") : "–");
			const judul = judulMesin(m);
			tulis(b.mesin, judul.replace(/^\d+ · /, "") || String(m?.name ?? ""));
			if (b.mesin.title !== n) b.mesin.title = n;
			isiChip(b.chip, m?.status);
			const wo = m?.wo;
			tulis(b.item, wo ? String(wo.item_name || wo.item_code || wo.name || "") : "–");
			tulis(
				b.kecil,
				wo ? `${angka(Number(wo.produced_qty) || 0)} / ${angka(Number(wo.qty) || 0)} · ${persen(wo)}%` : ""
			);
			b.kecil.hidden = !wo;
			b.tr.classList.toggle("dipilih", n === dipilih);
		}
		for (const [n, b] of baris)
			if (!hidup.has(n)) {
				b.tr.remove();
				baris.delete(n);
			}
	}

	let namaKini = null;
	let logoKini;
	function isiPerusahaan(p) {
		const n = String(p?.nama ?? "");
		if (n !== namaKini) {
			namaKini = n;
			nama.textContent = n;
			nama.title = n;
			teksInisial.textContent = inisial(n);
		}
		const src = logoAman(p?.logo);
		if (src !== logoKini) {
			logoKini = src;
			if (src) gambar.src = src;
			else gambar.removeAttribute("src");
			gambar.hidden = !src;
			teksInisial.hidden = !!src;
			logo.classList.toggle("ada-gambar", !!src);
		}
	}
	// A logo that fails to load falls back to the initials.
	gambar.addEventListener("error", () => {
		gambar.hidden = true;
		teksInisial.hidden = false;
		logo.classList.remove("ada-gambar");
	});

	let angkaKini = null;
	function perbarui(data) {
		const daftar = Array.isArray(data?.mesin) ? data.mesin : [];
		isiPerusahaan(data?.perusahaan);
		const h = hitung(daftar);
		angkaKini = h;
		tulis(jumlah, __("{0} machines", [angka(h.mesin)]));
		tulis(jmlTabel, angka(h.mesin));
		tulis(sel.mesin.nilai, angka(h.mesin));
		tulis(sel.mesin.ket, __("{0} off", [angka(h.per.Off || 0)]));
		tulis(sel.jalan.nilai, angka(h.produksi));
		tulis(sel.jalan.ket, __("{0}% utilization", [angka(h.utilisasi)]));
		tulis(sel.masalah.nilai, angka(h.per.Problem || 0));
		sel.masalah.el.dataset.ada = h.per.Problem ? "1" : "0";
		tulis(sel.masalah.ket, __("{0} in maintenance", [angka(h.per.Maintenance || 0)]));
		tulis(sel.wo.nilai, angka(h.woJalan));
		tulis(sel.wo.ket, __("{0} not started", [angka(h.woBelum)]));
		// "1.240 / 3.000" with the planned part smaller.
		const teksHasil = `${angka(h.hasil)} / ${angka(h.rencana)}`;
		if (sel.hasil.nilai.dataset.teks !== teksHasil) {
			sel.hasil.nilai.dataset.teks = teksHasil;
			sel.hasil.nilai.replaceChildren(document.createTextNode(`${angka(h.hasil)} `));
			el(sel.hasil.nilai, "small").textContent = `/ ${angka(h.rencana)}`;
		}
		tulis(sel.hasil.ket, h.rencana ? __("{0}% of plan", [angka(h.capai)]) : __("No Work Orders"));
		for (const s of STATUS) {
			const n = h.per[s] || 0;
			tulis(chipLegenda[s], angka(n));
			chipLegenda[s].parentNode.toggleAttribute("data-nol", !n);
		}
		isiTabel(daftar);
	}

	// The clock, in the user's language and time zone.
	const lang = frappe.boot?.lang || document.documentElement.lang || undefined;
	const zona = frappe.boot?.time_zone?.user || frappe.boot?.time_zone?.system;
	const format = (opsi) => {
		try {
			return new Intl.DateTimeFormat(lang, { ...opsi, timeZone: zona || undefined });
		} catch {
			return new Intl.DateTimeFormat(undefined, opsi);
		}
	};
	const fmtTanggal = format({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
	const fmtWaktu = format({ hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
	const fmtJamMenit = format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
	// `panggil` false on the first tick at start: the caller may still be building what `saatDetik` uses.
	// While `diam()` is false (the camera moves) the tick writes nothing: a text repaint during a drag stalls
	// Chrome for ~100 ms (see label.js). The next tick after the camera rests catches up.
	function detik(panggil = true) {
		if (panggil && diam && !diam()) return;
		const kini = new Date();
		tulis(waktu, fmtWaktu.format(kini));
		tulis(tanggal, fmtTanggal.format(kini));
		if (panggil) saatDetik?.();
	}
	let jamDetik = null;
	const henti = () => {
		clearInterval(jamDetik);
		jamDetik = null;
	};
	const mulai = () => {
		henti();
		detik(false);
		jamDetik = setInterval(detik, 1000);
	};
	mulai();

	const host = root.host;
	let tinggiAtas = -1;
	const pengamat = new ResizeObserver(() => {
		const t = Math.ceil(atas.offsetTop + atas.offsetHeight);
		if (t === tinggiAtas || !host) return;
		tinggiAtas = t;
		host.style.setProperty("--atas", `${t}px`);
	});
	pengamat.observe(atas);

	// The rectangles of the visible fixed cards, host-relative px: labels step aside for them and the default view
	// centres in the space under the top bar and KPI row. Cached; measured only when a card resizes (fold, window,
	// a text change), when the host resizes, or on `ukurKotak()` (a card moved without resizing), never per frame.
	const kartuLain = []; // cards added by the bundle (camera bar, later the attention card)
	let kotakKini = [];
	let ruangKini = { atas: 0, kanan: 0, bawah: 0, kiri: 0 };
	function ukurKotak() {
		if (!host) return;
		const asal = host.getBoundingClientRect();
		const hasil = [];
		for (const k of [bar, kpi, tabel, ...kartuLain]) {
			if (k.hidden) continue;
			const r = k.getBoundingClientRect();
			if (r.width > 0 && r.height > 0)
				hasil.push({ x0: r.left - asal.left, y0: r.top - asal.top, x1: r.right - asal.left, y1: r.bottom - asal.top });
		}
		const a = atas.getBoundingClientRect();
		const ruang = { atas: Math.ceil(a.bottom - asal.top), kanan: 0, bawah: 0, kiri: 0 };
		const sama = (x, y) => JSON.stringify(x) === JSON.stringify(y);
		if (sama(hasil, kotakKini) && sama(ruang, ruangKini)) return;
		kotakKini = hasil;
		ruangKini = ruang;
		saatKotak?.();
	}
	const pengamatKotak = new ResizeObserver(ukurKotak);
	for (const k of [atas, bar, kpi, tabel]) pengamatKotak.observe(k);
	if (host) pengamatKotak.observe(host);

	let liveKini = null;
	return {
		kotak: () => kotakKini,
		ruang: () => ruangKini,
		ukurKotak,
		// Another fixed card (the camera bar): its rectangle joins `kotak()`.
		tambahKartu(k) {
			kartuLain.push(k);
			pengamatKotak.observe(k);
		},
		perbarui,
		// The live dot: "Live" while realtime is connected, else "Updated HH:MM" of the last good fetch.
		status(adaLive, kapan) {
			const teks = adaLive
				? __("Live")
				: kapan
					? __("Updated {0}", [fmtJamMenit.format(new Date(kapan))])
					: __("Not updated yet");
			const kunci = `${adaLive ? 1 : 0}|${teks}`;
			if (kunci === liveKini) return;
			liveKini = kunci;
			live.dataset.live = adaLive ? "1" : "0";
			teksLive.textContent = teks;
		},
		pilih(namaMesin) {
			dipilih = namaMesin;
			for (const [n, b] of baris) b.tr.classList.toggle("dipilih", n === namaMesin);
		},
		jeda: henti,
		lanjut: mulai,
		info: () => ({ angka: angkaKini, jam: jamDetik !== null, tutup: tabel.hasAttribute("data-tutup") }),
		buang() {
			henti();
			pengamat.disconnect();
			pengamatKotak.disconnect();
			hud.remove();
			baris.clear();
		},
	};
}
