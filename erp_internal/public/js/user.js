// The User form without outgoing email (erp_internal/surel.py, `frappe.boot.erp_tanpa_email`): no Reset Password
// (it mails a link), no Create User Email, no Send Welcome Email. Passwords are set with Password > Change Password
// or the New User dialog's Set New Password. Loaded after Frappe's user.js (hooks doctype_js), so its buttons exist.

frappe.ui.form.on("User", {
	refresh(frm) {
		if (!frappe.boot.erp_tanpa_email) return;
		frm.remove_custom_button(__("Reset Password"), __("Password"));
		frm.remove_custom_button(__("Create User Email"));
		frm.toggle_display("send_welcome_email", false);
	},
});
