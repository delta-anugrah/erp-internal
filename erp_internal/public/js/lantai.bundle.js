// Loaded on demand by the Production Floor page (frappe.require("lantai.bundle.js")); three.js is bundled from the
// repo's node_modules.
import { buatAdegan } from "./lantai/adegan.js";

frappe.provide("erp.lantai");

// Mounts the floor into `host`, or hands back the floor already mounted there (the page script may run again).
erp.lantai.pasang = function (host) {
	if (erp.lantai.aktif?.host === host) return erp.lantai.aktif;
	erp.lantai.aktif?.buang();

	const root = host.shadowRoot || host.attachShadow({ mode: "open" });
	root.innerHTML = `<style>:host{display:block;background:#dfe3e8}.lantai{width:100%;height:100%;position:relative;overflow:hidden}canvas{display:block}</style><div class="lantai"></div>`;
	const adegan = buatAdegan(root.querySelector(".lantai"));
	adegan.lanjut();

	const ctl = {
		host,
		perbarui(data) {
			adegan.perbarui(data);
		},
		jeda: () => adegan.jeda(),
		lanjut: () => adegan.lanjut(),
		buang() {
			adegan.buang();
			root.innerHTML = "";
			if (erp.lantai.aktif === ctl) erp.lantai.aktif = null;
		},
		info: () => adegan.info(),
	};
	erp.lantai.aktif = ctl;
	return ctl;
};
