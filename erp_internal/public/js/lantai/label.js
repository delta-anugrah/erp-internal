// The floating label over each machine: "03 · NISSEI 260T", its status chip and, with a running Work Order, the
// product and a progress bar. One element per machine in the shadow root, record text through textContent only.
// Labels are placed with translate3d only on frames where the camera or the layout changed (the scene's
// `penyegar`), and only the ones whose pixel position moved are written.
//
// New text waits until the camera has rested for DIAM ms: in Chrome, the first repaint of a label while it moves
// under a drag stalls the main thread for 50-100 ms (measured in a headed run, no script involved), which broke the
// frame budget when a status change arrived mid-orbit. A resting label repaints for free.

// Label and chip layout. The card look (fill, light edge, radius, shadow) is `.kartu` from kaca.js, but without the
// backdrop blur and with a denser fill: fourteen labels move with the camera and each blurred backdrop is redrawn
// every frame. Measured in tools/lantai.mjs perf: blur 8 px and 3 px on the labels still dropped up to 1.5 % of
// frames during an orbit; without it 0-0.2 %. The five fixed cards keep the full blur.
export const GAYA_LABEL = `
.label-lapis{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.label{position:absolute;left:0;top:0;will-change:transform}
.label > .isi{transform:translate(-50%,-100%);padding:5px 10px 6px;font-size:12px;line-height:1.35;white-space:nowrap;
	max-width:150px;border-radius:16px;--kaca-blur:none;background:var(--kaca-isi-label)}
.label .baris{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.label .judul{font-weight:600;font-variant-numeric:tabular-nums}
.label.dipilih > .isi{outline:2px solid var(--kaca-aksen);outline-offset:1px}
.label .wo{margin-top:3px;max-width:134px}
.label .wo-item{display:block;overflow:hidden;text-overflow:ellipsis;color:var(--kartu-teks-redup)}
.label .wo-bar{display:block;height:4px;margin:3px 0 1px;border-radius:2px;background:var(--kartu-jalur)}
.label .wo-bar span{display:block;height:100%;border-radius:2px;background:var(--andon-hijau)}
.label .wo-angka{font-size:11px;color:var(--kartu-teks-redup);font-variant-numeric:tabular-nums}
`;

const DIAM = 120; // ms the camera must rest before label text changes are written

const dua = (n) => String(n).padStart(2, "0");
const angka = (n) => (typeof format_number === "function" ? format_number(n, null, 0) : String(n));

// "03 · NISSEI 260T": number, brand and tonnage, whichever exist.
export function judulMesin(row) {
	const nomor = Number(row?.nomor) > 0 ? dua(row.nomor) : "";
	const ton = Number(row?.tonase) > 0 ? `${Number(row.tonase)}T` : "";
	const sisi = [row?.merek, ton].filter(Boolean).join(" ");
	return [nomor, sisi].filter(Boolean).join(" · ") || String(row?.name ?? "");
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

export function buatLabel(root, adegan, mesin) {
	const lapis = document.createElement("div");
	lapis.className = "label-lapis";
	root.appendChild(lapis);
	const per = new Map(); // machine name → its label
	const titik = { x: 0, y: 0, depan: true }; // scratch for projections
	let tulis = 0; // transform writes since mount, for tools/lantai.mjs
	let dipilih = null;

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
		return { el, judul, chip, wo, item, isiBar, teksAngka, x: NaN, y: NaN, tampak: true, teks: {} };
	}

	// Writes a text only when it changed, so a refresh with the same data touches no node.
	function teks(l, kunci, node, nilai) {
		if (l.teks[kunci] === nilai) return;
		l.teks[kunci] = nilai;
		node.textContent = nilai;
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
			teks(l, "judul", l.judul, judulMesin(row));
			isiChip(l.chip, row?.status);
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
			if (l.wo.hidden !== !wo) l.wo.hidden = !wo;
			l.el.classList.toggle("dipilih", nama === dipilih);
		}
		for (const [nama, l] of per)
			if (!hidup.has(nama)) {
				l.el.remove();
				per.delete(nama);
			}
		adegan.tandaiKotor(); // the layout may have moved: place the labels on the next frame
	}

	// Places every label over its machine (just above the andon), hidden when the machine is behind the camera.
	function segarkan() {
		const daftar = mesin.daftar();
		for (let i = 0; i < daftar.length; i++) {
			const s = daftar[i];
			const l = per.get(s.nama);
			if (!l) continue;
			adegan.proyeksi(s.x, 2.45, s.z, titik);
			const tampak = titik.depan;
			if (tampak !== l.tampak) {
				l.tampak = tampak;
				l.el.style.visibility = tampak ? "" : "hidden";
			}
			if (!tampak) continue;
			const x = Math.round(titik.x);
			const y = Math.round(titik.y);
			if (x === l.x && y === l.y) continue;
			l.x = x;
			l.y = y;
			l.el.style.transform = `translate3d(${x}px,${y}px,0)`;
			tulis += 1;
		}
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
		},
		info: () => ({ jumlah: per.size, tulis, tertunda: !!tunda }),
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
