// Production Floor: the 3D floor of the injection moulding machines. The logic lives in lantai.bundle.js: Desk caches
// page scripts in the browser until `bench clear-cache`, so this file stays small. Desk keeps a page's DOM for the whole
// session: the view is paused while the page is hidden and resumed on show.
frappe.pages["lantai-produksi"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Production Floor"),
		single_column: true,
		hide_sidebar: true,
	});
	page.page_head.hide();
	const host = $('<div class="lantai-host"></div>').appendTo(page.body)[0];
	// Full-bleed under whatever Desk keeps on screen (navbar, rail): fixed from the page body's top-left corner.
	wrapper.fit = () => {
		const r = page.body[0].getBoundingClientRect();
		if (r.width) Object.assign(host.style, { top: `${Math.max(0, r.top)}px`, left: `${Math.max(0, r.left)}px` });
	};
	Object.assign(host.style, { position: "fixed", right: "0", bottom: "0" });
	wrapper.fit();
	$(window).on("resize", () => wrapper.fit());
	$(wrapper).on("hide", () => wrapper.ctl?.jeda());

	frappe.route_options = {}; // not null: Frappe's sidebar reads route_options.sidebar on every route change
	frappe.require("lantai.bundle.js").then(() => {
		wrapper.ctl = erp.lantai.pasang(host);
		wrapper.fit();
		// The user may have left before the bundle arrived: do not start drawing on a page Desk has hidden.
		// (A background browser tab is the scene's own business: it resumes on visibilitychange.)
		if (wrapper.offsetParent === null) wrapper.ctl.jeda();
	});
};

frappe.pages["lantai-produksi"].on_page_show = function (wrapper) {
	wrapper.fit?.();
	frappe.route_options = {};
	wrapper.ctl?.lanjut();
};
