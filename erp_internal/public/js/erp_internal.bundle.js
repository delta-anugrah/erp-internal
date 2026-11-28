// Desk-wide behaviour of erp_internal (app_include_js): full width by default, the language switch, the menu
// (menu_samping.js), the app version in the Settings dialog (versi.js) and the "attach the real document" note
// on forms (lampiran.js), the missing data notes with their fix links (kelengkapan.js) and the module home
// cards' icon and line (pintasan.js), whole numbers without decimals and the report filter row's "Search…" (angka.js), the whole text of a cut-off "..." on hover (judul_penuh.js), and no Email buttons while there is no outgoing email (surel.js).
//
// The language switch itself is two sidebar-header-menu rows from `standard_navbar_items` in hooks.py, shown by
// `frappe.boot.lang`; their action calls `erp_internal.ganti_bahasa` below.

import "./menu_samping";
import "./versi";
import "./lampiran";
import "./kelengkapan";
import "./pintasan";
import "./angka";
import "./judul_penuh";
import "./surel"; // no outgoing email: no Email buttons (erp_internal/surel.py)

frappe.provide("erp_internal");

erp_internal.ganti_bahasa = function (lang) {
	frappe
		.call({ method: "erp_internal.bahasa.ganti", args: { lang }, freeze: true })
		.then(() => window.location.reload());
};

// Full width unless the user turned it off. Frappe's toolbar reads `localStorage.container_fullwidth`
// (Settings > Layout toggles it), so only an unset value is changed. This file runs before the desk starts,
// which applies the class itself; the call below covers a desk that started first.
try {
	if (localStorage.getItem("container_fullwidth") === null) {
		localStorage.setItem("container_fullwidth", "true");
		frappe.ui.toolbar?.set_fullwidth_if_enabled?.();
	}
} catch (e) {
	// No storage (a private window): Frappe's own default stays.
}
