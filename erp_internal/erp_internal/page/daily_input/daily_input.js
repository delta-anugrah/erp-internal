// Daily Input: Samuel's weekly production sheet. The logic lives in input_harian.bundle.js: Desk caches page scripts
// in the browser until `bench clear-cache`, so this file stays small. "Record Output" on a Work Order opens the page
// with `frappe.route_options.work_order` (that order's block only).
frappe.pages["daily-input"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({ parent: wrapper, title: __("Daily Input"), single_column: true });
	wrapper.siap = Promise.resolve(frappe.require("input_harian.bundle.js")).then(
		() => (wrapper.ctl = erp.input_harian.pasang(wrapper))
	);
	// No dialog: an inline line instead (textContent).
	wrapper.siap.catch(() => {
		wrapper.page.body[0].textContent = __("The daily input could not be loaded.");
	});
};

frappe.pages["daily-input"].on_page_show = function (wrapper) {
	const work_order = frappe.route_options?.work_order || null;
	frappe.route_options = {}; // not null: Frappe's sidebar reads route_options.sidebar on every route change
	wrapper.siap?.then(() => wrapper.ctl.buka(work_order)).catch(() => {});
};
