// Loaded on demand by the Production Floor page (frappe.require("lantai.bundle.js")); three.js is bundled from the
// repo's node_modules. The plain machine table (`erp.lantai.tabel`) and the data fetch (`erp.lantai.ambil`) live in
// the page script, so they still work when this bundle does not load.
import { buatAdegan, TanpaWebGL } from "./lantai/adegan.js";
import { buatMesin } from "./lantai/mesin.js";

frappe.provide("erp.lantai");

const GAYA = `<style>
:host{display:block;background:#dfe3e8}
.lantai{width:100%;height:100%;position:relative;overflow:hidden}
canvas{display:block}
.alat{position:absolute;top:12px;right:12px;display:flex;gap:8px}
.alat button{font:inherit;font-size:var(--text-sm,13px);padding:4px 12px;border-radius:var(--border-radius,8px);
	border:1px solid var(--border-color,#d1d8dd);background:var(--bg-color,#fff);color:var(--text-color,#1f272e);
	box-shadow:var(--shadow-sm,0 1px 2px rgba(0,0,0,.08));cursor:pointer}
.alat button:hover{background:var(--fg-hover-color,#f3f3f3)}
</style>`;

// Mounts the floor into `host`, or hands back the floor already mounted there (the page script may run again).
erp.lantai.pasang = function (host) {
	if (erp.lantai.aktif?.host === host) return erp.lantai.aktif;
	erp.lantai.aktif?.buang();

	const root = host.shadowRoot || host.attachShadow({ mode: "open" });
	root.innerHTML = `${GAYA}<div class="lantai"></div><div class="alat"><button type="button" class="reset"></button></div>`;
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
	const reset = root.querySelector(".reset");
	reset.textContent = __("Reset view");
	reset.addEventListener("click", () => adegan.reset());
	adegan.lanjut();

	const ctl = {
		host,
		webgl: true,
		perbarui(data) {
			mesin.tata(data?.mesin || []);
		},
		// Fetches `data()` and redraws; a failed fetch keeps what is shown, with no dialog.
		muat: () =>
			erp.lantai
				.ambil()
				.then((d) => ctl.perbarui(d))
				.catch(() => {}),
		pilihDari: (raycaster) => mesin.pilihDari(raycaster),
		jeda: () => adegan.jeda(),
		lanjut: () => adegan.lanjut(),
		buang() {
			mesin.buang();
			adegan.buang();
			root.innerHTML = "";
			if (erp.lantai.aktif === ctl) erp.lantai.aktif = null;
		},
		info: () => ({ ...adegan.info(), webgl: true, mesin: mesin.info() }),
	};
	erp.lantai.aktif = ctl;
	ctl.muat();
	return ctl;
};

// No WebGL: the plain table of the machines, same controller shape so the page script needs no special case.
function pasangTabel(host) {
	let daftar = [];
	const ctl = {
		host,
		webgl: false,
		perbarui(data) {
			daftar = data?.mesin || [];
			erp.lantai.tabel(host, daftar);
		},
		muat: () =>
			erp.lantai
				.ambil()
				.then((d) => ctl.perbarui(d))
				.catch(() => erp.lantai.tabel(host, null)),
		pilihDari: () => null,
		jeda() {},
		lanjut() {},
		buang() {
			if (host.shadowRoot) host.shadowRoot.innerHTML = "";
			if (erp.lantai.aktif === ctl) erp.lantai.aktif = null;
		},
		info: () => ({ webgl: false, mesin: daftar.map((m) => ({ nama: m.name, nomor: m.nomor, status: m.status })) }),
	};
	erp.lantai.aktif = ctl;
	erp.lantai.tabel(host, []);
	ctl.muat();
	return ctl;
}
