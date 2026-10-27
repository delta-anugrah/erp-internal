// Desk-wide behaviour of erp_internal (app_include_js).
//
// The language switch itself is two user-menu rows from `standard_navbar_items` in hooks.py, shown by
// `frappe.boot.lang`; their action calls `erp_internal.ganti_bahasa` below.

frappe.provide("erp_internal");

erp_internal.ganti_bahasa = function (lang) {
	frappe
		.call({ method: "erp_internal.bahasa.ganti", args: { lang }, freeze: true })
		.then(() => window.location.reload());
};
