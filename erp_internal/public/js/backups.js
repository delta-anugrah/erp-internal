// Frappe's Download Backups page (/desk/backups, System Manager = Super Admin), through hooks `page_js`.
// "Download Files Backup" goes: it mails a link, and the site may have no outgoing email (surel.py). The button
// "PC Backup Installer" downloads the Windows installer that makes the admin PC pull a copy of every nightly
// backup from R2 (erp_internal.cadangan_pc.unduh, docs/cadangan-pc.md).
const buka_asli = frappe.pages["backups"].on_page_load;
frappe.pages["backups"].on_page_load = function (wrapper) {
	buka_asli(wrapper);
	const page = wrapper.page;
	page.remove_inner_button(__("Download Files Backup"));
	page.add_inner_button(__("PC Backup Installer"), () => {
		window.location.href = "/api/method/erp_internal.cadangan_pc.unduh";
	});
};
