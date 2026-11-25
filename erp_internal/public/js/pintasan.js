// Module home cards (Abel 2026-11-25): each shortcut gets its icon and one line under its title, from
// `frappe.boot.erp_pintasan` (tampilan.menu_samping: the link's sidebar icon and tampilan.KETERANGAN). Frappe's
// shortcut widget class is wrapped in place; anything that goes wrong leaves Frappe's plain card.

function kartu(w) {
	if (w.in_customize_mode || !w.widget) return;
	// Settings pages kept for Super Admin (tampilan.KHUSUS_SUPER_ADMIN): the card leaves the page.
	// Its editor block goes too, or the grid keeps an empty cell; after the widget is in the page.
	if ((frappe.boot.erp_sembunyi || []).includes(w.link_to)) {
		w.widget.hide();
		setTimeout(() => {
			const blok = w.widget.closest(".ce-block");
			(blok.length ? blok : w.widget).remove();
		});
		return;
	}
	const data = frappe.boot.erp_pintasan?.[w.link_to];
	if (!data) return;
	w.widget.addClass("erp-kartu");
	if (data.icon && !w.head.find(".erp-kartu-ikon").length) {
		$('<span class="erp-kartu-ikon"></span>')
			.html(frappe.utils.icon(data.icon, "md", "", "", "current-color", true))
			.prependTo(w.head);
	}
	if (data.ket) w.subtitle_field.text(__(data.ket));
}

function pasang() {
	const pabrik = frappe.widget?.widget_factory;
	if (!pabrik?.shortcut) return false;
	if (pabrik.shortcut.erp_kartu) return true;
	const Asli = pabrik.shortcut;
	class Kartu extends Asli {
		set_actions() {
			super.set_actions();
			try {
				kartu(this);
			} catch (e) {
				console.error("erp_internal: home card", e);
			}
		}
	}
	Kartu.erp_kartu = true;
	pabrik.shortcut = Kartu;
	return true;
}

// The desk bundle defines the widgets before app_include_js runs; retry briefly in case it did not yet.
if (!pasang()) {
	let coba = 0;
	const t = setInterval(() => (pasang() || ++coba > 50) && clearInterval(t), 100);
}
