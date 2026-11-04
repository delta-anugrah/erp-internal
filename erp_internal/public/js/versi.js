// The app version (`v0.1.3`) at the foot of the Settings dialog's left menu. The login page gets it from
// erp_internal/versi.py; here it is Frappe's own `frappe.boot.versions.erp_internal` (erp_internal.__version__).
//
// Frappe builds that menu in SettingsDialog.render_sidebar, which other dialogs (DocType and Kanban settings, the
// workspace manager) share: only the user's Settings, the one with the Profile tab, gets the line.

const render_sidebar = frappe.ui.SettingsDialog?.prototype.render_sidebar;

if (render_sidebar) {
	frappe.ui.SettingsDialog.prototype.render_sidebar = function () {
		render_sidebar.call(this);
		const versi = frappe.boot?.versions?.erp_internal;
		const profil = (this.tabs || []).some((g) => (g.items || []).some((i) => i.id === "profile"));
		if (versi && profil) {
			$('<div class="erp-versi"></div>').text(`v${versi}`).appendTo(this.$sidebar);
		}
	};
}
