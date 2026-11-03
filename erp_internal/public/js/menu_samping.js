// One labelled sidebar instead of the icon rail on ERP and HR pages (Abel, 2026-11-03: nobody knew what the bare
// rail icons meant). Every module of `frappe.boot.erp_menu` (tampilan.menu_samping) becomes a collapsible
// Section Break with that module's own sidebar items under it, so Frappe still draws, opens and highlights
// everything itself. Without a dock Frappe already puts search, notifications and the user menu in the sidebar
// and folds it to icons. Any failure here leaves Frappe's own dock and sidebar.

frappe.provide("erp_internal.menu_samping");

// tampilan.MODUL_TANPA_IKON: no header of their own, but a page Frappe opens there still shows the menu.
const TANPA_IKON = ["Accounts", "Leaves"];
// One open/closed state for the whole menu; Frappe keys it per module, so sections would jump between pages.
const KUNCI_STATUS = "erp_menu";

function menu() {
	return frappe.boot.erp_menu || [];
}

function pakai_menu(shell) {
	const m = menu();
	return m.some((x) => x.shell === shell) || (m.length > 0 && TANPA_IKON.includes(shell));
}

// The menu as one sidebar item list: first the `atas` links (tampilan.MENU_ATAS) as entries of their own, then per
// module a Section Break with its other links as children, each routed into the module's own shell. A module's own
// Section Breaks and spacers are dropped (Frappe nests one level only).
erp_internal.menu_samping.gabung = function (menu, sidebars, atas = []) {
	const items = [];
	for (const tujuan of atas) {
		const m = menu.find((x) => (sidebars[x.shell]?.items || []).some((i) => i.link_to === tujuan));
		const i = m && sidebars[m.shell].items.find((i) => i.link_to === tujuan);
		if (i) items.push({ ...i, child: 0, erp_shell: m.shell });
	}
	for (const m of menu) {
		const isi = (sidebars[m.shell]?.items || []).filter(
			(i) => i.type !== "Section Break" && i.type !== "Spacer" && !atas.includes(i.link_to)
		);
		if (!isi.length) continue;
		items.push({
			type: "Section Break",
			label: __(m.label),
			icon: m.icon,
			collapsible: 1,
			keep_closed: 1,
			erp_shell: m.shell,
		});
		for (const i of isi) items.push({ ...i, child: 1, erp_shell: m.shell });
	}
	return items;
};

function tambal(cls, nama, baru) {
	const asli = cls.prototype[nama];
	cls.prototype[nama] = function (...args) {
		try {
			return baru.call(this, asli, args);
		} catch (e) {
			console.error("erp_internal menu_samping", e);
			return asli.apply(this, args);
		}
	};
}

tambal(frappe.ui.Sidebar, "load_sidebar_data", function (asli, args) {
	asli.apply(this, args);
	const pakai = pakai_menu(this.current_module);
	$("body").toggleClass("erp-menu", pakai);
	if (!pakai) return;
	this.sidebar_items = erp_internal.menu_samping.gabung(
		menu(),
		frappe.boot.module_sidebars,
		frappe.boot.erp_menu_atas || []
	);
	this.nest_section_items();
});

// The page's own module opens too, not only the one holding a lit link (a page the menu does not list lights
// nothing). A shut phone drawer or a folded panel counts as the rail: Frappe opened every section for it and
// remembered each one's state to restore on unfolding, so that remembered state is set to open as well.
tambal(frappe.ui.Sidebar, "make_sidebar", function (asli, args) {
	asli.apply(this, args);
	if (!pakai_menu(this.current_module)) return;
	const bagian = this.items.find((i) => i.item?.erp_shell === this.current_module && i.open);
	if (!bagian) return;
	bagian.old_state = false;
	if (bagian.collapsed) bagian.open();
});

// No dock on our pages: the menu is the switcher.
tambal(frappe.ui.Sidebar, "dock_enabled", function (asli, args) {
	return pakai_menu(this.current_module) ? false : asli.apply(this, args);
});

// A link sits in its own module's shell, not in the shell on screen.
tambal(frappe.ui.sidebar_item.TypeLink, "get_path", function (asli, args) {
	if (!this.item.erp_shell) return asli.apply(this, args);
	return frappe.ui.sidebar_item.get_route(this.item, false, this.item.erp_shell);
});

tambal(frappe.ui.sidebar_item.TypeSectionBreak, "prepare", function (asli, args) {
	asli.apply(this, args);
	if (this.item.erp_shell) this.current_module = KUNCI_STATUS;
});

// Frappe draws no icon on a top-level Section Break; a menu header has one, and its name as a tooltip when folded.
tambal(frappe.ui.sidebar_item.TypeSectionBreak, "make", function (asli, args) {
	asli.apply(this, args);
	if (!this.item.erp_shell || !this.wrapper) return;
	this.wrapper
		.find(".section-break")
		.first()
		.attr("title", this.item.label)
		.prepend(
			`<span class="sidebar-item-icon">${frappe.utils.icon(
				this.item.icon,
				"sm",
				"",
				"",
				"current-color",
				true
			)}</span>`
		);
});
