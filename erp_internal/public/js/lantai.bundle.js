// Loaded on demand by the Production Floor page (frappe.require("lantai.bundle.js")); three.js is bundled from the
// repo's node_modules. The bundle fetches its own data and owns the live updates (realtime nudge, poll), so a stale
// page script cached by Desk cannot leave the floor empty. The page script keeps a plain table of its own for when
// this bundle does not load.
import { Raycaster, Vector2, Vector3 } from "three";
import { buatAdegan, TanpaWebGL } from "./lantai/adegan.js";
import { buatHud, GAYA_HUD } from "./lantai/hud.js";
import { GAYA_KACA } from "./lantai/kaca.js";
import { buatLabel, GAYA_LABEL } from "./lantai/label.js";
import { buatMesin } from "./lantai/mesin.js";
import { buatPabrik } from "./lantai/pabrik.js";
import { buatZona } from "./lantai/zona.js";
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

// The glass card look (`.kartu`, kaca.js) and its tokens for labels, panel, info bar and camera bar; the host's
// `data-tema` follows Desk's light or dark theme. Status chips use the andon colours for the dot and a darker (light
// theme) or lighter (dark theme) shade of it for the text, so the text keeps its contrast.
const GAYA = `<style>
${GAYA_KACA}
:host{display:block;background:var(--lantai-latar);color:var(--kaca-teks);font-family:var(--font-stack,inherit);
	-webkit-font-smoothing:antialiased;
	--kartu-teks-redup:var(--kaca-redup);--kartu-jalur:var(--kaca-jalur);--kartu-tombol:var(--kaca-tombol);
	--kartu-tombol-hover:var(--kaca-tombol-hover);--kartu-tolak:var(--kaca-tolak);--kartu-tolak-teks:var(--kaca-tolak-teks);
	--andon-merah:#e5372c;--andon-kuning:#e0a800;--andon-hijau:#1fae5b;--andon-biru:#2f7ae5;--andon-mati:#8d969f;
	--chip-hijau:#0d6534;--chip-kuning:#6e5000;--chip-merah:#a11d17;--chip-biru:#1a4a9e;--chip-mati:#465059}
:host([data-tema="dark"]){--chip-hijau:#7ee8ab;--chip-kuning:#ffd666;--chip-merah:#ffa19b;--chip-biru:#a6c8ff;
	--chip-mati:#c8ced6}
.lantai{width:100%;height:100%;position:relative;overflow:hidden}
canvas{display:block}
[data-status="Production"]{--warna-status:var(--andon-hijau);--teks-status:var(--chip-hijau)}
[data-status="Setup"],[data-status="Idle"]{--warna-status:var(--andon-kuning);--teks-status:var(--chip-kuning)}
[data-status="Problem"]{--warna-status:var(--andon-merah);--teks-status:var(--chip-merah)}
[data-status="Maintenance"]{--warna-status:var(--andon-biru);--teks-status:var(--chip-biru)}
[data-status="Off"]{--warna-status:var(--andon-mati);--teks-status:var(--chip-mati)}
.chip{display:inline-flex;align-items:center;gap:5px;padding:0 8px;border-radius:999px;font-size:11px;
	font-weight:600;line-height:20px;white-space:nowrap;color:var(--teks-status);
	background:color-mix(in srgb,var(--warna-status) 16%,transparent)}
.chip::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--warna-status)}
${GAYA_LABEL}
${GAYA_PANEL}
${GAYA_HUD}
.catatan-lantai{position:absolute;z-index:2;left:50%;transform:translateX(-50%);top:calc(var(--atas,170px) + 12px);
	max-width:min(420px,calc(100% - 24px));box-sizing:border-box;padding:9px 14px;font-size:13px;line-height:1.4;
	text-align:center;pointer-events:none}
.catatan-lantai[hidden]{display:none}
</style>`;
const IKON_RUMAH = `<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 9.2 10 3.8l6.5 5.4M5.5 7.8V16h3.3v-4.2h2.4V16h3.3V7.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ZUM = 0.8; // distance factor of one + click (− divides by it)
// ms the camera must rest before the info bar's figures and table are rewritten: like the labels (label.js), a text
// repaint in a card while a drag moves the camera stalls Chrome's main thread for ~100 ms.
const DIAM_HUD = 120;

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
		tunda = setTimeout(() => {
			tunda = null;
			if (tampil()) ctl.muat();
			else basi = true;
		}, TUNDA);
	};
	// Frappe's realtime server keeps no room state: after a reconnect (sleep, network blip, `bench start` restart)
	// the socket must join the Workstation room again, or the floor says "Live" and hears nothing.
	const gabung = () => {
		try {
			frappe.realtime.doctype_subscribe("Workstation");
		} catch {
			/* no realtime: the poll still runs */
		}
	};
	let soket = null;
	try {
		gabung();
		frappe.realtime.on(EVENT, nudge);
		soket = frappe.realtime.socket || null;
		soket?.on("connect", gabung);
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
			gabung(); // cheap, and covers a reconnect that happened while the page was away
			mulai();
		},
		jeda() {
			ditahan = true;
			// A nudge still waiting for its debounce is missed, not dropped: catch up on return.
			if (tunda !== null) basi = true;
			clearTimeout(tunda);
			tunda = null;
			henti();
		},
		buang() {
			clearTimeout(tunda);
			henti();
			document.removeEventListener("visibilitychange", saatTampil);
			try {
				soket?.off("connect", gabung);
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
	root.innerHTML = `${GAYA}<div class="lantai"></div>`;
	let adegan;
	try {
		adegan = buatAdegan(root.querySelector(".lantai"));
	} catch (e) {
		if (!(e instanceof TanpaWebGL)) throw e;
		return pasangTabel(host);
	}
	const pabrik = buatPabrik(adegan);
	const zona = buatZona(adegan);
	const mesin = buatMesin(adegan);
	adegan.tiap.push(mesin.tick);
	adegan.saatTurun.push(mesin.diam);
	// Rectangles of every visible fixed card (HUD and side panel), host-relative px, rebuilt only when a card moved
	// or resized (never per frame): labels step aside for them and the default view centres in the free area.
	let halanganKini = [];
	let panel = null;
	function kotakBaru() {
		halanganKini = [...hud.kotak(), ...(panel ? panel.kotak() : [])];
		// An open panel (a card at the right on a desktop, a bottom sheet on a phone) only shifts the centre.
		const pk = panel?.kotak()[0];
		const lebar = host.clientWidth;
		const tinggi = host.clientHeight;
		const sisi = pk ? (pk.x1 - pk.x0 < lebar * 0.6 ? { kanan: lebar - pk.x0 + 8 } : { bawah: tinggi - pk.y0 + 8 }) : {};
		adegan.aturRuang(hud.ruang(), sisi);
		label.kotakBaru();
	}
	const label = buatLabel(root.querySelector(".lantai"), adegan, mesin, { halangan: () => halanganKini });
	const hud = buatHud(root, {
		saatKotak: kotakBaru,
		saatPilih: (nama) => pilih(nama),
		saatDetik: () => hud.status(adaLive(), ambilan.terakhir),
		diam: () => adegan.sejakGerak() >= DIAM_HUD,
	});

	// An inline note on the floor for a failed first load or an empty floor: a glass card, text only, no dialog.
	const nota = document.createElement("div");
	nota.className = "catatan-lantai kartu";
	nota.hidden = true;
	nota.setAttribute("role", "status");
	nota.setAttribute("aria-live", "polite");
	root.querySelector(".hud").appendChild(nota);
	let notaMau = null; // the note to show (null: none), written once the camera rests
	let notaAda = false; // whether `notaMau` still has to be written
	const tulisNota = () => {
		notaAda = false;
		if (notaMau === null) nota.hidden = true;
		else {
			if (nota.textContent !== notaMau) nota.textContent = notaMau;
			nota.hidden = false;
		}
	};
	const setNota = (teks) => {
		if (notaMau === teks) return;
		notaMau = teks;
		notaAda = true;
		if (adegan.sejakGerak() >= DIAM_HUD) tulisNota();
	};

	// Camera bar: zoom in, zoom out, home (the default view).
	const kameraBar = document.createElement("div");
	kameraBar.className = "kamera kartu";
	root.querySelector(".hud").appendChild(kameraBar);
	hud.tambahKartu(kameraBar);
	for (const [kelas, judul, isi, aksi] of [
		["zum-masuk", __("Zoom in"), "+", () => adegan.zum(ZUM)],
		["zum-keluar", __("Zoom out"), "−", () => adegan.zum(1 / ZUM)],
		["reset", __("Reset view"), null, () => adegan.reset()],
	]) {
		const b = kameraBar.appendChild(document.createElement("button"));
		b.type = "button";
		b.className = kelas;
		b.title = judul;
		b.setAttribute("aria-label", judul);
		if (isi) b.textContent = isi;
		else b.innerHTML = IKON_RUMAH;
		b.addEventListener("click", aksi);
	}

	// Desk's theme on the cards (host `data-tema`) and on the floor; followed when the user switches it.
	const ikutTema = () => {
		const gelap = document.documentElement.dataset.theme === "dark";
		const t = gelap ? "dark" : "light";
		if (host.dataset.tema !== t) host.dataset.tema = t;
		adegan.tema(gelap);
		pabrik.tema(t);
		zona.tema(t);
	};
	ikutTema();
	const pengamatTema = new MutationObserver(ikutTema);
	pengamatTema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

	let data = { mesin: [] };
	let dipilih = null;
	const baris = (nama) => (data.mesin || []).find((m) => m.name === nama) || null;

	panel = buatPanel(root, {
		saatKotak: kotakBaru,
		diam: () => adegan.sejakGerak() >= DIAM_HUD,
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
		hud.pilih(dipilih);
		host.toggleAttribute("data-panel", !!row);
		hud.ukurKotak(); // the camera bar moves aside for the panel
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

	let hudTunda = null; // data waiting for the camera to rest
	adegan.tiap.push(() => {
		if (adegan.sejakGerak() < DIAM_HUD) return;
		if (notaAda) tulisNota();
		panel.tick();
		if (!hudTunda) return;
		const d = hudTunda;
		hudTunda = null;
		hud.perbarui(d);
	});

	const titik = { x: 0, y: 0, depan: true };
	const adaLive = () => frappe.realtime?.socket?.connected === true;
	const ambilan = pengambil(
		(d) => {
			ctl.perbarui(d);
			if (adegan.sejakGerak() >= DIAM_HUD) hud.status(adaLive(), ambilan.terakhir); // else the next clock tick
		},
		// A failed fetch keeps what is shown; only a floor that never loaded says so.
		() => !data.mesin.length && setNota(__("The machine list could not be loaded."))
	);
	const ctl = {
		host,
		webgl: true,
		// New data: the scene, labels and panel each touch only what changed.
		perbarui(d) {
			data = d && Array.isArray(d.mesin) ? d : { ...d, mesin: [] };
			setNota(data.mesin.length ? null : __("No numbered machines yet (set Machine No. on a Workstation)."));
			mesin.tata(data.mesin);
			label.perbarui(data.mesin);
			if (adegan.sejakGerak() >= DIAM_HUD) {
				hudTunda = null;
				hud.perbarui(data);
			} else hudTunda = data;
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
		// Debug for tools/lantai.mjs: each machine's andon top on screen from the current camera and what a ray from the
		// camera to it hits first (nothing of the decor may stand in front of it).
		periksaAndon() {
			const ray = new Raycaster();
			const dari = adegan.kamera.position;
			const p = new Vector3();
			const arah = new Vector3();
			adegan.kamera.updateMatrixWorld();
			return mesin.daftar().map((s) => {
				p.set(0.2, 2.2, 0.62).applyMatrix4(s.dasar);
				adegan.proyeksi(p.x, p.y, p.z, titik);
				arah.subVectors(p, dari);
				const jarak = arah.length();
				ray.set(dari, arah.normalize());
				const kena = ray.intersectObjects(adegan.scene.children, true)[0];
				const di = kena ? kena.point : null;
				return {
					nama: s.nama,
					layar: { x: titik.x, y: titik.y, depan: titik.depan },
					jarak,
					pertama: kena ? kena.distance : null,
					mesinPertama: !!di && Math.abs(di.x - s.x) < 2.3 && Math.abs(di.z - s.z) < 1.3,
				};
			});
		},
		jeda() {
			adegan.jeda();
			live.jeda();
			hud.jeda();
		},
		lanjut() {
			adegan.lanjut();
			live.lanjut();
			hud.lanjut();
		},
		buang() {
			live.buang();
			pengamatTema.disconnect();
			hud.buang();
			nota.remove();
			panel.buang();
			label.buang();
			mesin.buang();
			zona.buang();
			pabrik.buang();
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
			return {
				...i,
				webgl: true,
				mesin: mesinInfo,
				pabrik: pabrik.info(),
				zona: zona.info(),
				label: label.info(),
				halangan: halanganKini,
				hud: hud.info(),
				pilih: dipilih,
				poll: POLL,
				muat: ambilan.jumlah,
			};
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
