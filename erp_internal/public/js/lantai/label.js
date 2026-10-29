// The floating label over each machine: "03 · NISSEI 260T", its status chip and, with a running Work Order, the
// product and a progress bar. One element per machine in the shadow root, record text through textContent only.
// Labels are placed with translate3d only on frames where the camera or the layout changed (the scene's
// `penyegar`), and only the ones whose pixel position moved are written.
//
// New text waits until the camera has rested for DIAM ms: in Chrome, the first repaint of a label while it moves
// under a drag stalls the main thread for 50-100 ms (measured in a headed run, no script involved), which broke the
// frame budget when a status change arrived mid-orbit. A resting label repaints for free.
//
// Declutter: the labels are placed nearest first (the selected one before all). A label whose box would overlap one
// already placed shrinks to a compact chip (number and status dot); one that would sit under a fixed card (`halangan`,
// host-relative rectangles from hud.js and panel.js) is hidden. Every label caches its full and compact size, measured
// only after its text changed (the camera rests then), so a frame reads no layout, and only a changed class or
// visibility is written. A label flips between full and compact only when the overlap starts or ends by more
// than HISTERESIS px, so it does not flicker at a boundary.

// Label and chip layout. The card look (fill, light edge, radius, shadow) is `.kartu` from kaca.js, but without the
// backdrop blur and with a denser fill: fourteen labels move with the camera and each blurred backdrop is redrawn
// every frame. Measured in tools/lantai.mjs perf: blur 8 px and 3 px on the labels still dropped up to 1.5 % of
// frames during an orbit; without it 0-0.2 %. The five fixed cards keep the full blur.
export const GAYA_LABEL = `
.label-lapis{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.label{position:absolute;left:0;top:0;will-change:transform}
.label > .isi{transform:translate(-50%,-100%);padding:5px 10px 6px;font-size:12px;line-height:1.35;white-space:nowrap;
	max-width:150px;border-radius:16px;--kaca-blur:none;background:var(--kaca-isi-label)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
	.label > .isi{background:var(--kaca-padat)}
}
@media (prefers-reduced-transparency:reduce){
	.label > .isi{background:var(--kaca-padat)}
}
.label .baris{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.label .judul{font-weight:600;font-variant-numeric:tabular-nums}
.label.ringkas > .isi{padding:4px 8px;border-radius:12px}
.label.ringkas .baris{flex-direction:row;align-items:center;gap:5px}
.label.ringkas .sisa,.label.ringkas .wo{display:none}
.label.ringkas .chip{font-size:0;line-height:10px;padding:0;gap:0;background:none}
.label.dipilih > .isi{outline:2px solid var(--kaca-aksen);outline-offset:1px}
.label .wo{margin-top:3px;max-width:134px}
.label .wo-item{display:block;overflow:hidden;text-overflow:ellipsis;color:var(--kartu-teks-redup)}
.label .wo-bar{display:block;height:4px;margin:3px 0 1px;border-radius:2px;background:var(--kartu-jalur)}
.label .wo-bar span{display:block;height:100%;border-radius:2px;background:var(--andon-hijau)}
.label .wo-angka{font-size:11px;color:var(--kartu-teks-redup);font-variant-numeric:tabular-nums}
`;

const DIAM = 120; // ms the camera must rest before label text changes are written
const HISTERESIS = 8; // px an overlap must start or end by before a label switches between full and compact

const dua = (n) => String(n).padStart(2, "0");
const angka = (n) => (typeof format_number === "function" ? format_number(n, null, 0) : String(n));

// "03 · NISSEI 260T": number, brand and tonnage, whichever exist.
export function judulMesin(row) {
	const { nomor, sisa } = bagianJudul(row);
	return [nomor, sisa].filter(Boolean).join(" · ") || String(row?.name ?? "");
}
// The title in two parts: the number (what the compact chip keeps) and brand and tonnage.
function bagianJudul(row) {
	const nomor = Number(row?.nomor) > 0 ? dua(row.nomor) : "";
	const ton = Number(row?.tonase) > 0 ? `${Number(row.tonase)}T` : "";
	return { nomor, sisa: [row?.merek, ton].filter(Boolean).join(" ") };
}

// The status chip's text and colour key; an empty status reads as Idle. Status values are the Workstation's own
// options, translated by ERPNext.
export function isiChip(el, status) {
	const s = status || "Idle";
	if (el.dataset.status !== s) {
		el.dataset.status = s;
		el.textContent = __(s);
	}
}

// Produced / planned of a Work Order as a 0-100 share.
export const persen = (wo) => {
	const qty = Number(wo?.qty) || 0;
	return qty > 0 ? Math.max(0, Math.min(100, Math.round(((Number(wo.produced_qty) || 0) / qty) * 100))) : 0;
};

// Do two boxes overlap by more than `m` px on both axes? A negative `m` grows them (they overlap or come within |m|).
const beririsan = (a, b, m) => a.x0 < b.x1 - m && a.x1 > b.x0 + m && a.y0 < b.y1 - m && a.y1 > b.y0 + m;

export function buatLabel(root, adegan, mesin, { halangan = () => [] } = {}) {
	const lapis = document.createElement("div");
	lapis.className = "label-lapis";
	root.appendChild(lapis);
	const per = new Map(); // machine name → its label
	const titik = { x: 0, y: 0, depan: true }; // scratch for projections
	let tulis = 0; // transform writes since mount, for tools/lantai.mjs
	let dipilih = null;
	let tersembunyi = 0; // labels hidden under a card, from the last placement

	function buat(nama) {
		const el = document.createElement("div");
		el.className = "label";
		el.dataset.mesin = nama;
		const isi = el.appendChild(document.createElement("div"));
		isi.className = "isi kartu";
		const baris = isi.appendChild(document.createElement("div"));
		baris.className = "baris";
		const judul = baris.appendChild(document.createElement("span"));
		judul.className = "judul";
		const no = judul.appendChild(document.createElement("span"));
		no.className = "no";
		const sisa = judul.appendChild(document.createElement("span"));
		sisa.className = "sisa";
		const chip = baris.appendChild(document.createElement("span"));
		chip.className = "chip";
		const wo = isi.appendChild(document.createElement("div"));
		wo.className = "wo";
		wo.hidden = true;
		const item = wo.appendChild(document.createElement("span"));
		item.className = "wo-item";
		const bar = wo.appendChild(document.createElement("span"));
		bar.className = "wo-bar";
		const isiBar = bar.appendChild(document.createElement("span"));
		const teksAngka = wo.appendChild(document.createElement("span"));
		teksAngka.className = "wo-angka";
		lapis.appendChild(el);
		return {
			el, judul, no, sisa, chip, wo, item, isiBar, teksAngka, nama,
			x: NaN, y: NaN, tampak: true, teks: {},
			ringkas: null, // null until first placed: the first decision has no hysteresis
			ukur: true, // the sizes below are stale (text changed)
			lp: 0, tp: 0, lr: 0, tr: 0, // full and compact box, px
			px: 0, py: 0, dalam: 0, depan: false, // this frame's projection
			x0: 0, y0: 0, x1: 0, y1: 0, // the box placed this frame
		};
	}

	// Writes a text only when it changed, so a refresh with the same data touches no node.
	function teks(l, kunci, node, nilai) {
		if (l.teks[kunci] === nilai) return;
		l.teks[kunci] = nilai;
		node.textContent = nilai;
		l.ukur = true;
	}

	let tunda = null; // rows waiting for the camera to rest

	// New data: one label per row, by machine name; texts rewritten only where they changed. Written now when the
	// camera rests (or no label exists yet), else on the first resting frame.
	function perbarui(daftar) {
		tunda = daftar || [];
		if (!per.size || adegan.sejakGerak() >= DIAM) tulisTunda();
	}
	function tulisTunda() {
		const daftar = tunda;
		tunda = null;
		const hidup = new Set();
		for (const row of daftar || []) {
			const nama = String(row?.name ?? "");
			hidup.add(nama);
			let l = per.get(nama);
			if (!l) {
				l = buat(nama);
				per.set(nama, l);
			}
			const bagian = bagianJudul(row);
			// The number alone reads as the whole title when the row has no brand or tonnage; an unnumbered machine
			// shows its name.
			const polos = !bagian.nomor && !bagian.sisa ? String(row?.name ?? "") : "";
			teks(l, "no", l.no, bagian.nomor || polos);
			teks(l, "sisa", l.sisa, bagian.nomor && bagian.sisa ? ` · ${bagian.sisa}` : bagian.sisa);
			const sebelum = l.chip.dataset.status;
			isiChip(l.chip, row?.status);
			if (l.chip.dataset.status !== sebelum) l.ukur = true;
			const wo = row?.wo;
			if (wo) {
				teks(l, "item", l.item, String(wo.item_name || wo.item_code || wo.name || ""));
				teks(l, "angka", l.teksAngka, `${angka(Number(wo.produced_qty) || 0)} / ${angka(Number(wo.qty) || 0)}`);
				const lebar = `${persen(wo)}%`;
				if (l.teks.bar !== lebar) {
					l.teks.bar = lebar;
					l.isiBar.style.width = lebar;
				}
			}
			if (l.wo.hidden !== !wo) {
				l.wo.hidden = !wo;
				l.ukur = true;
			}
			l.el.classList.toggle("dipilih", nama === dipilih);
		}
		for (const [nama, l] of per)
			if (!hidup.has(nama)) {
				l.el.remove();
				per.delete(nama);
			}
		ukurSemua();
		adegan.tandaiKotor(); // the layout may have moved: place the labels on the next frame
	}

	// Measures the labels whose text changed, in both forms (a layout read: only called once the camera rests, with
	// the text writes). The class is put back as it was.
	function ukurSemua() {
		for (const l of per.values()) {
			if (!l.ukur) continue;
			l.ukur = false;
			const awal = l.el.classList.contains("ringkas");
			const isi = l.el.firstChild;
			l.el.classList.remove("ringkas");
			l.lp = isi.offsetWidth;
			l.tp = isi.offsetHeight;
			l.el.classList.add("ringkas");
			l.lr = isi.offsetWidth;
			l.tr = isi.offsetHeight;
			l.el.classList.toggle("ringkas", awal);
		}
	}

	const urut = []; // labels in front of the camera, placed in this order; reused every frame
	const bandingkan = (a, b) => (a.nama === dipilih ? -1 : b.nama === dipilih ? 1 : a.dalam - b.dalam);
	const kosong = [];

	// Places every label over its machine (just above the andon). Nearest first (the selected one before all): full
	// when its box clears the boxes already placed, else compact; hidden when behind the camera or under a card.
	// Only changes are written: the transform when the position moved, the class and visibility when they flip.
	function segarkan() {
		const daftar = mesin.daftar();
		const kartu = halangan() || kosong;
		urut.length = 0;
		for (let i = 0; i < daftar.length; i++) {
			const s = daftar[i];
			const l = per.get(s.nama);
			if (!l) continue;
			adegan.proyeksi(s.x, 2.45, s.z, titik);
			l.depan = titik.depan;
			l.px = Math.round(titik.x);
			l.py = Math.round(titik.y);
			l.dalam = titik.dalam;
			if (l.depan) urut.push(l);
			else tulisTampak(l, false);
		}
		urut.sort(bandingkan);
		let terpasang = 0; // urut[0..terpasang) are the placed boxes
		let sembunyi = 0;
		for (let i = 0; i < urut.length; i++) {
			const l = urut[i];
			// Full unless it hits a placed box; a label already full stays so until the hit is deeper than
			// HISTERESIS, one already compact grows back only when even a HISTERESIS wider box clears.
			l.x0 = l.px - l.lp / 2;
			l.x1 = l.px + l.lp / 2;
			l.y0 = l.py - l.tp;
			l.y1 = l.py;
			let penuh = true;
			if (l.nama !== dipilih) {
				const m = l.ringkas === null ? 0 : l.ringkas ? -HISTERESIS : HISTERESIS;
				for (let j = 0; j < terpasang; j++)
					if (beririsan(l, urut[j], m)) {
						penuh = false;
						break;
					}
			}
			if (!penuh) {
				l.x0 = l.px - l.lr / 2;
				l.x1 = l.px + l.lr / 2;
				l.y0 = l.py - l.tr;
			}
			if (l.ringkas !== !penuh) {
				l.ringkas = !penuh;
				l.el.classList.toggle("ringkas", l.ringkas);
			}
			let bawahKartu = false;
			for (let j = 0; j < kartu.length && !bawahKartu; j++) bawahKartu = beririsan(l, kartu[j], 0);
			tulisTampak(l, !bawahKartu);
			if (bawahKartu) {
				sembunyi += 1;
				continue; // a hidden label takes no room from the others
			}
			// Keep the placed boxes at the front of `urut`.
			urut[i] = urut[terpasang];
			urut[terpasang] = l;
			terpasang += 1;
			if (l.x === l.px && l.y === l.py) continue;
			l.x = l.px;
			l.y = l.py;
			l.el.style.transform = `translate3d(${l.px}px,${l.py}px,0)`;
			tulis += 1;
		}
		tersembunyi = sembunyi;
	}
	function tulisTampak(l, tampak) {
		if (tampak === l.tampak) return;
		l.tampak = tampak;
		l.el.style.visibility = tampak ? "" : "hidden";
	}
	adegan.penyegar.push(segarkan);
	const tiap = () => {
		if (tunda && adegan.sejakGerak() >= DIAM) tulisTunda();
	};
	adegan.tiap.push(tiap);

	return {
		perbarui,
		pilih(nama) {
			dipilih = nama;
			for (const [n, l] of per) l.el.classList.toggle("dipilih", n === nama);
			adegan.tandaiKotor(); // the selected label is placed first
		},
		// The cards moved: place again on the next frame.
		kotakBaru: () => adegan.tandaiKotor(),
		info() {
			const kotak = [];
			let ringkas = 0;
			for (const l of per.values()) {
				if (l.ringkas) ringkas += 1;
				if (l.tampak && l.depan)
					kotak.push({ nama: l.nama, x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1, ringkas: !!l.ringkas });
			}
			return { jumlah: per.size, tulis, tertunda: !!tunda, ringkas, tersembunyi, kotak };
		},
		buang() {
			const i = adegan.penyegar.indexOf(segarkan);
			if (i >= 0) adegan.penyegar.splice(i, 1);
			const j = adegan.tiap.indexOf(tiap);
			if (j >= 0) adegan.tiap.splice(j, 1);
			lapis.remove();
			per.clear();
		},
	};
}
