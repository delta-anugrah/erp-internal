// The side panel of the selected machine: its details, its running Work Order (a link to the form), one button per
// status and "Open machine". A bottom sheet below 760 px. Record text through textContent only; a refused status
// change is an inline note here, never a dialog.
import { isiChip, judulMesin, persen } from "./label.js";

// The Workstation's status options, in the order of the spec's table.
export const STATUS = ["Production", "Setup", "Idle", "Problem", "Maintenance", "Off"];

// Panel layout. The card look itself is `.kartu`, defined once in the bundle.
export const GAYA_PANEL = `
.panel{position:absolute;top:56px;right:12px;width:320px;max-height:calc(100% - 68px);overflow:auto;
	padding:14px 16px 16px;font-size:13px;line-height:1.4;box-sizing:border-box}
.panel[hidden]{display:none}
.panel .kepala{display:flex;align-items:flex-start;gap:8px}
.panel .judul{flex:1;margin:0;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.panel .nama{color:var(--kartu-teks-redup);font-size:12px}
.panel .tutup{border:0;background:none;color:inherit;font-size:20px;line-height:1;padding:0 2px;cursor:pointer}
.panel dl{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin:12px 0}
.panel dt{color:var(--kartu-teks-redup)}
.panel dd{margin:0;overflow-wrap:anywhere}
.panel h4{margin:12px 0 6px;font-size:12px;font-weight:600;color:var(--kartu-teks-redup)}
.panel .wo a{color:var(--primary,#2490ef);font-weight:600;text-decoration:none}
.panel .wo a:hover{text-decoration:underline}
.panel .wo-item{display:block;overflow-wrap:anywhere}
.panel .wo-bar{display:block;height:6px;margin:6px 0 2px;border-radius:3px;background:var(--kartu-jalur)}
.panel .wo-bar span{display:block;height:100%;border-radius:3px;background:var(--andon-hijau)}
.panel .wo-angka,.panel .kosong{color:var(--kartu-teks-redup);font-variant-numeric:tabular-nums}
.panel .status{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.panel .status button,.panel .buka{display:flex;align-items:center;gap:7px;font:inherit;padding:6px 10px;
	border-radius:var(--border-radius,8px);border:1px solid var(--kartu-tepi);background:var(--kartu-tombol);
	color:inherit;cursor:pointer;text-align:left}
.panel .status button:hover:not(:disabled),.panel .buka:hover{background:var(--kartu-tombol-hover)}
.panel .status button:disabled{cursor:default;opacity:.6}
.panel .status button[aria-pressed="true"]{border-color:currentColor;font-weight:600;opacity:1}
.panel .status .titik{width:9px;height:9px;border-radius:50%;flex:none;background:var(--warna-status)}
.panel .status button.sibuk .titik{background:none;border:2px solid currentColor;border-right-color:transparent;
	width:7px;height:7px;animation:putar .7s linear infinite}
@keyframes putar{to{transform:rotate(360deg)}}
.panel .catatan{margin:10px 0 0;padding:7px 10px;border-radius:8px;background:var(--kartu-tolak);color:var(--kartu-tolak-teks)}
.panel .buka{width:100%;justify-content:center;margin-top:14px;font-weight:600}
@media (max-width:759px){
	.panel{top:auto;left:0;right:0;bottom:0;width:auto;max-height:60%;border-radius:16px 16px 0 0}
}
`;

const el = (induk, tag, kelas) => {
	const e = induk.appendChild(document.createElement(tag));
	if (kelas) e.className = kelas;
	return e;
};
const angka = (n) => (typeof format_number === "function" ? format_number(n, null, 0) : String(n));

// `saatStatus(nama, status)` returns a promise: it resolves when the server took the change and rejects with an
// Error whose message is the note to show. `saatTutup()` is called when the user closes the panel.
export function buatPanel(root, { saatStatus, saatTutup }) {
	const panel = el(root, "section", "panel kartu");
	panel.hidden = true;
	panel.setAttribute("aria-live", "polite");
	const kepala = el(panel, "div", "kepala");
	const judulBox = el(kepala, "div");
	judulBox.style.flex = "1";
	const judul = el(judulBox, "h3", "judul");
	const nama = el(judulBox, "div", "nama");
	const chip = el(kepala, "span", "chip");
	const tutup = el(kepala, "button", "tutup");
	tutup.type = "button";
	tutup.textContent = "×";
	tutup.setAttribute("aria-label", __("Close"));
	tutup.addEventListener("click", () => {
		sembunyikan();
		saatTutup?.();
	});

	const rincian = el(panel, "dl");
	const FIELD = [
		["merek", __("Machine Brand")],
		["model", __("Machine Model")],
		["tonase", __("Clamping Force (Ton)")],
		["tahun", __("Year Made")],
		["negara", __("Made In")],
	];
	const nilai = {};
	for (const [k, label] of FIELD) {
		el(rincian, "dt").textContent = label;
		nilai[k] = el(rincian, "dd");
	}

	el(panel, "h4").textContent = __("Work Order");
	const wo = el(panel, "div", "wo");
	const woLink = el(wo, "a");
	woLink.addEventListener("click", (e) => {
		e.preventDefault();
		if (woLink.dataset.nama) frappe.set_route("Form", "Work Order", woLink.dataset.nama);
	});
	const woItem = el(wo, "span", "wo-item");
	const woBar = el(el(wo, "span", "wo-bar"), "span");
	const woAngka = el(wo, "span", "wo-angka");
	const woKosong = el(panel, "div", "kosong");
	woKosong.textContent = __("No Work Order running on this machine.");

	el(panel, "h4").textContent = __("Status");
	const kotakStatus = el(panel, "div", "status");
	const tombol = {};
	for (const s of STATUS) {
		const b = el(kotakStatus, "button");
		b.type = "button";
		b.dataset.status = s;
		el(b, "span", "titik");
		el(b, "span").textContent = __(s);
		b.addEventListener("click", () => ubah(s));
		tombol[s] = b;
	}
	const catatan = el(panel, "p", "catatan");
	catatan.hidden = true;
	catatan.setAttribute("role", "alert");

	const buka = el(panel, "button", "buka");
	buka.type = "button";
	buka.textContent = __("Open machine");
	buka.addEventListener("click", () => {
		if (baris) frappe.set_route("Form", "Workstation", baris.name);
	});

	let baris = null; // the shown machine's row
	let sibuk = null; // the machine whose status change is in flight

	function isi(row) {
		baris = row;
		panel.dataset.mesin = row.name;
		judul.textContent = judulMesin(row);
		nama.textContent = String(row.name ?? "");
		isiChip(chip, row.status);
		for (const [k] of FIELD) {
			const v = row[k];
			nilai[k].textContent = v == null || v === "" || v === 0 ? "–" : k === "tonase" ? `${Number(v)} T` : String(v);
		}
		const w = row.wo;
		wo.hidden = !w;
		woKosong.hidden = !!w;
		if (w) {
			woLink.textContent = String(w.name ?? "");
			woLink.dataset.nama = String(w.name ?? "");
			woLink.href = `/desk/work-order/${encodeURIComponent(w.name ?? "")}`;
			woItem.textContent = String(w.item_name || w.item_code || "");
			woBar.style.width = `${persen(w)}%`;
			woAngka.textContent = `${angka(Number(w.produced_qty) || 0)} / ${angka(Number(w.qty) || 0)}`;
		}
		segarkanTombol();
	}

	function segarkanTombol() {
		const kini = baris?.status || "Idle";
		const menunggu = sibuk !== null && sibuk === baris?.name;
		for (const s of STATUS) {
			const b = tombol[s];
			b.setAttribute("aria-pressed", String(s === kini));
			b.disabled = menunggu;
			if (!menunggu) b.classList.remove("sibuk");
		}
	}

	function ubah(status) {
		if (!baris || sibuk !== null) return;
		const untuk = baris.name;
		sibuk = untuk;
		catatan.hidden = true;
		segarkanTombol();
		tombol[status].classList.add("sibuk");
		Promise.resolve()
			.then(() => saatStatus(untuk, status))
			.then(
				() => {
					sibuk = null;
					if (baris?.name === untuk) segarkanTombol();
				},
				(e) => {
					sibuk = null;
					if (baris?.name !== untuk) return;
					segarkanTombol();
					catatan.textContent = e?.message || __("The status could not be changed.");
					catatan.hidden = false;
				}
			);
	}

	function sembunyikan() {
		panel.hidden = true;
		baris = null;
		delete panel.dataset.mesin;
	}

	return {
		// Shows `row`'s machine; a different machine clears the last note.
		buka(row) {
			if (baris?.name !== row.name) catatan.hidden = true;
			isi(row);
			panel.hidden = false;
		},
		// New data for the shown machine (or null: it is gone, close).
		perbarui(row) {
			if (!baris) return;
			if (!row) sembunyikan();
			else isi(row);
		},
		tutup: sembunyikan,
		nama: () => baris?.name ?? null,
		buang() {
			panel.remove();
		},
	};
}
