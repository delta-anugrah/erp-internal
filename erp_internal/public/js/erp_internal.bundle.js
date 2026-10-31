// Desk-wide behaviour of erp_internal (app_include_js): full width by default, and the language switch.
//
// The language switch itself is two user-menu rows from `standard_navbar_items` in hooks.py, shown by
// `frappe.boot.lang`; their action calls `erp_internal.ganti_bahasa` below.

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
