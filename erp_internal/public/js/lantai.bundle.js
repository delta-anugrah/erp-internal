// Loaded on demand by the Production Floor page (frappe.require("lantai.bundle.js")); three.js is bundled from the
// repo's node_modules. The bundle fetches its own data and owns the live updates (realtime nudge, poll), so a stale
// page script cached by Desk cannot leave the floor empty. The page script keeps a plain table of its own for when
// this bundle does not load.
import { Raycaster, Vector2 } from "three";
import { buatAdegan, TanpaWebGL } from "./lantai/adegan.js";
import { buatLabel, GAYA_LABEL } from "./lantai/label.js";
import { buatMesin } from "./lantai/mesin.js";
import { buatPanel, GAYA_PANEL } from "./lantai/panel.js";

frappe.provide("erp.lantai");

const METODE = "/api/method/erp_internal.production_floor";
const EVENT = "production_floor";
const TUNDA = 250; // ms: realtime nudges within this window cause one refetch
// Poll period in seconds while the page shows; `?poll=<s>` in the URL overrides it (a debug option for tests).
const POLL = (() => {
	const n = Number(new URLSearchParams(location.search).get("poll"));
	return n >= 1 ? n : 60;
})();

// The card tokens and the `.kartu` look shared by labels, the panel and the reset button: Task 6 restyles them here.
// Desk's CSS variables reach into the shadow root, so light and dark follow Desk's theme.
const GAYA = `<style>
:host{display:block;background:#dfe3e8;color:var(--text-color,#1f272e);font-family:var(--font-stack,inherit);
	--kartu-latar:var(--card-bg,var(--bg-color,#fff));--kartu-tepi:var(--border-color,#d1d8dd);
	--kartu-bayang:var(--shadow-sm,0 1px 3px rgba(0,0,0,.12));--kartu-radius:var(--border-radius-md,10px);
	--kartu-teks-redup:var(--text-muted,#6c7680);--kartu-jalur:var(--gray-200,#e9ecef);
	--kartu-tombol:var(--control-bg,#f4f5f6);--kartu-tombol-hover:var(--fg-hover-color,#e9ecef);
	--kartu-tolak:var(--bg-red,#fff0f0);--kartu-tolak-teks:var(--text-on-red,#b52a2a);
	--andon-merah:#e5372c;--andon-kuning:#e0a800;--andon-hijau:#1fae5b;--andon-biru:#2f7ae5;--andon-mati:#8d969f}
.lantai{width:100%;height:100%;position:relative;overflow:hidden}
canvas{display:block}
.kartu{background:var(--kartu-latar);border:1px solid var(--kartu-tepi);border-radius:var(--kartu-radius);
	box-shadow:var(--kartu-bayang);color:var(--text-color,#1f272e)}
.alat{position:absolute;top:12px;right:12px;display:flex;gap:8px}
.alat button{font:inherit;font-size:var(--text-sm,13px);padding:4px 12px;cursor:pointer}
.alat button:hover{background:var(--fg-hover-color,#f3f3f3)}
[data-status="Production"]{--warna-status:var(--andon-hijau)}
[data-status="Setup"],[data-status="Idle"]{--warna-status:var(--andon-kuning)}
[data-status="Problem"]{--warna-status:var(--andon-merah)}
[data-status="Maintenance"]{--warna-status:var(--andon-biru)}
[data-status="Off"]{--warna-status:var(--andon-mati)}
.chip{display:inline-flex;align-items:center;gap:4px;padding:0 7px;border-radius:999px;font-size:11px;
	font-weight:600;line-height:18px;white-space:nowrap;color:var(--warna-status);
	background:color-mix(in srgb,var(--warna-status) 14%,transparent)}
.chip::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--warna-status)}
${GAYA_LABEL}
${GAYA_PANEL}
</style>`;

// `get_data()` with a plain fetch, so a failed request never opens a message dialog; rejects on any failure.
function ambil() {
	return fetch(`${METODE}.get_data`, { headers: { Accept: "application/json" } })
		.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
		.then((r) => r.message);
}

// The server's own words for a refused call: `_server_messages` (a JSON list of JSON messages that may hold HTML,
// read as text through an inert document), else the exception text, else null.
function pesanServer(j) {
	const teks = (h) => new DOMParser().parseFromString(String(h ?? ""), "text/html").body.textContent.trim();
	try {
		const daftar = JSON.parse(j?._server_messages || "[]")
			.map((m) => {
				try {
					return teks(JSON.parse(m).message);
				} catch {
					return teks(m);
				}
			})
			.filter(Boolean);
		if (daftar.length) return daftar.join(" ");
	} catch {
		/* not JSON: fall through */
	}
	if (j?.exception) return teks(String(j.exception).replace(/^[\w.]+:\s*/, ""));
	return null;
}

// POST set_status with the session's CSRF token; resolves to the machine's row, rejects with the note to show.
function kirimStatus(machine, status) {
	return fetch(`${METODE}.set_status`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
			"X-Frappe-CSRF-Token": frappe.csrf_token,
		},
		body: new URLSearchParams({ machine, status }),
	}).then(
		async (r) => {
			const j = await r.json().catch(() => ({}));
			if (r.ok && j.message) return j.message;
			throw new Error(pesanServer(j) || __("The status could not be changed."));
		},
		() => {
			throw new Error(__("The server could not be reached. Try again."));
		}
	);
}

// Realtime nudge (any machine, any change: always refetch everything; the payload is not trusted for content),
// plus a poll every POLL seconds, both only while the floor is on screen. Hidden (Desk page left via `jeda()`, or
// the browser tab hidden) a nudge only marks the view stale; showing it again refetches at once when it is stale or
// older than POLL. `muat()` is the controller's refetch.
function pasangLive(ctl) {
	let tunda = null;
	let jam = null;
	let ditahan = false; // the Desk page is not shown
	let basi = false; // a nudge arrived while hidden
	const tampil = () => !ditahan && !document.hidden;
	const nudge = () => {
		clearTimeout(tunda);
		if (!tampil()) {
			basi = true;
			return;
		}
		tunda = setTimeout(() => (tampil() ? ctl.muat() : (basi = true)), TUNDA);
	};
	try {
		frappe.realtime.doctype_subscribe("Workstation");
		frappe.realtime.on(EVENT, nudge);
	} catch {
		/* no realtime: the poll still runs */
	}
	const henti = () => {
		clearInterval(jam);
		jam = null;
	};
	const mulai = () => {
		henti();
		if (!tampil()) return;
		// Back on screen: catch up now if anything was missed, then poll again.
		if (basi || Date.now() - ctl.terakhir >= POLL * 1000) {
			basi = false;
			ctl.muat();
		}
		jam = setInterval(() => tampil() && ctl.muat(), POLL * 1000);
	};
	const saatTampil = () => (document.hidden ? henti() : mulai());
	document.addEventListener("visibilitychange", saatTampil);
	jam = setInterval(() => tampil() && ctl.muat(), POLL * 1000); // the first fetch is the mount's own
	return {
		lanjut() {
			ditahan = false;
			mulai();
		},
		jeda() {
			ditahan = true;
			clearTimeout(tunda);
			henti();
		},
		buang() {
			clearTimeout(tunda);
			henti();
			document.removeEventListener("visibilitychange", saatTampil);
			try {
				frappe.realtime.off(EVENT, nudge);
				frappe.realtime.doctype_unsubscribe("Workstation");
			} catch {
				/* nothing to undo */
			}
		},
	};
}

// Fetch control shared by both controllers: only the newest answer is drawn, and a status change made on this page
// makes any fetch started before it stale.
function pengambil(terapkan, gagal) {
	const k = { urutan: 0, terakhir: 0, jumlah: 0 };
	k.muat = () => {
		const n = ++k.urutan;
		return ambil()
			.then((d) => {
				if (n !== k.urutan) return;
				k.terakhir = Date.now();
				k.jumlah += 1;
				terapkan(d);
			})
			.catch(() => {
				if (n === k.urutan) gagal?.();
			});
	};
	k.basi = () => {
		k.urutan += 1;
	};
	return k;
}

// Mounts the floor into `host`, or hands back the floor already mounted there (the page script may run again).
erp.lantai.pasang = function (host) {
	if (erp.lantai.aktif?.host === host) return erp.lantai.aktif;
	erp.lantai.aktif?.buang();

	const root = host.shadowRoot || host.attachShadow({ mode: "open" });
	root.innerHTML = `${GAYA}<div class="lantai"></div><div class="alat"><button type="button" class="reset kartu"></button></div>`;
	let adegan;
	try {
		adegan = buatAdegan(root.querySelector(".lantai"));
	} catch (e) {
		if (!(e instanceof TanpaWebGL)) throw e;
		return pasangTabel(host);
	}
	const mesin = buatMesin(adegan);
	adegan.tiap.push(mesin.tick);
	adegan.saatTurun.push(mesin.diam);
	const label = buatLabel(root.querySelector(".lantai"), adegan, mesin);
	const reset = root.querySelector(".reset");
	reset.textContent = __("Reset view");
	reset.addEventListener("click", () => adegan.reset());

	let data = { mesin: [] };
	let dipilih = null;
	const baris = (nama) => (data.mesin || []).find((m) => m.name === nama) || null;

	const panel = buatPanel(root, {
		saatStatus: (nama, status) =>
			kirimStatus(nama, status).then((row) => {
				// The answer is newer than any fetch in flight: draw it, then refetch the rest.
				ambilan.basi();
				const daftar = (data.mesin || []).map((m) => (m.name === row.name ? row : m));
				ctl.perbarui({ ...data, mesin: daftar });
				ctl.muat();
			}),
		saatTutup: () => pilih(null),
	});

	function pilih(nama) {
		const row = nama ? baris(nama) : null;
		dipilih = row ? nama : null;
		label.pilih(dipilih);
		if (!row) {
			panel.tutup();
			return;
		}
		panel.buka(row);
		const s = mesin.daftar().find((m) => m.nama === nama);
		if (s) adegan.terbangKe(s.x, 1.1, s.z);
	}

	// A click (not a drag) on the canvas selects the machine under the pointer; on empty floor it closes the panel.
	const raycaster = new Raycaster();
	const ndc = new Vector2();
	let tekan = null;
	const kanvas = adegan.kanvas;
	kanvas.addEventListener("pointerdown", (e) => {
		tekan = { x: e.clientX, y: e.clientY, t: e.timeStamp };
	});
	kanvas.addEventListener("pointerup", (e) => {
		if (!tekan || e.button !== 0) return;
		const geser = Math.hypot(e.clientX - tekan.x, e.clientY - tekan.y);
		const lama = e.timeStamp - tekan.t;
		tekan = null;
		if (geser > 6 || lama > 600) return;
		const k = kanvas.getBoundingClientRect();
		ndc.x = ((e.clientX - k.left) / k.width) * 2 - 1;
		ndc.y = -((e.clientY - k.top) / k.height) * 2 + 1;
		raycaster.setFromCamera(ndc, adegan.kamera);
		pilih(mesin.pilihDari(raycaster));
	});

	const titik = { x: 0, y: 0, depan: true };
	const ambilan = pengambil((d) => ctl.perbarui(d));
	const ctl = {
		host,
		webgl: true,
		// New data: the scene, labels and panel each touch only what changed.
		perbarui(d) {
			data = d && Array.isArray(d.mesin) ? d : { ...d, mesin: [] };
			mesin.tata(data.mesin);
			label.perbarui(data.mesin);
			if (dipilih && !baris(dipilih)) pilih(null);
			else if (dipilih) panel.perbarui(baris(dipilih));
		},
		// Refetches `get_data()` and redraws; a failed fetch keeps what is shown, with no dialog.
		muat: () => ambilan.muat(),
		get terakhir() {
			return ambilan.terakhir;
		},
		pilih,
		pilihDari: (r) => mesin.pilihDari(r),
		lihat: (pos, target) => adegan.lihat(pos, target),
		jeda() {
			adegan.jeda();
			live.jeda();
		},
		lanjut() {
			adegan.lanjut();
			live.lanjut();
		},
		buang() {
			live.buang();
			panel.buang();
			label.buang();
			mesin.buang();
			adegan.buang();
			root.innerHTML = "";
			if (erp.lantai.aktif === ctl) erp.lantai.aktif = null;
		},
		info() {
			const i = adegan.info();
			// Each machine's body centre on screen, for clicks from tools/lantai.mjs.
			const mesinInfo = mesin.info().map((m) => {
				const s = mesin.daftar().find((x) => x.nama === m.nama);
				adegan.proyeksi(s.x, 1.0, s.z, titik);
				return { ...m, layar: { x: titik.x, y: titik.y, depan: titik.depan } };
			});
			return { ...i, webgl: true, mesin: mesinInfo, label: label.info(), pilih: dipilih, poll: POLL, muat: ambilan.jumlah };
		},
	};
	const live = pasangLive(ctl);
	erp.lantai.aktif = ctl;
	adegan.lanjut();
	ctl.muat();
	return ctl;
};

// No WebGL: the plain table of the machines (the page script's), same controller shape and the same live updates.
function pasangTabel(host) {
	let daftar = [];
	const tabel = (d) => erp.lantai.tabel?.(host, d);
	const ambilan = pengambil(
		(d) => ctl.perbarui(d),
		() => !daftar.length && tabel(null)
	);
	const ctl = {
		host,
		webgl: false,
		perbarui(data) {
			daftar = data?.mesin || [];
			tabel(daftar);
		},
		muat: () => ambilan.muat(),
		get terakhir() {
			return ambilan.terakhir;
		},
		pilih() {},
		pilihDari: () => null,
		lihat() {},
		jeda() {
			live.jeda();
		},
		lanjut() {
			live.lanjut();
		},
		buang() {
			live.buang();
			if (host.shadowRoot) host.shadowRoot.innerHTML = "";
			if (erp.lantai.aktif === ctl) erp.lantai.aktif = null;
		},
		info: () => ({ webgl: false, poll: POLL, mesin: daftar.map((m) => ({ nama: m.name, nomor: m.nomor, status: m.status })) }),
	};
	const live = pasangLive(ctl);
	erp.lantai.aktif = ctl;
	tabel([]);
	ctl.muat();
	return ctl;
}
