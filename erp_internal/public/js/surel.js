// No outgoing email yet (erp_internal/surel.py sends `frappe.boot.erp_tanpa_email`): the form's Email menu item,
// the Activity's New Email and the print view's Email are hidden. Once an Email Account is set the flag is off on
// the next page load and Frappe's own code runs untouched. The User form's buttons: public/js/user.js.

const tanpa_email = () => Boolean(frappe.boot?.erp_tanpa_email);

// The form toolbar's Email (toolbar.js add_email) and the timeline's New Email both ask this first.
const can_email = frappe.model.can_email;
frappe.model.can_email = function (...args) {
	return tanpa_email() ? false : can_email.apply(this, args);
};

// The print view is a page script that defines frappe.ui.form.PrintView when first opened: wrap it then.
function bungkus_cetak(PrintView) {
	if (!PrintView || PrintView.__erp_surel) return;
	PrintView.__erp_surel = true;
	const toolbar = PrintView.prototype.setup_toolbar;
	PrintView.prototype.setup_toolbar = function (...args) {
		if (!tanpa_email()) return toolbar.apply(this, args);
		const page = this.page;
		const { add_action_icon, add_button } = page;
		const email = __("Email");
		page.add_action_icon = function (icon, ...rest) {
			if (icon !== "mail") return add_action_icon.call(this, icon, ...rest);
		};
		page.add_button = function (label, ...rest) {
			if (label !== email) return add_button.call(this, label, ...rest);
		};
		try {
			return toolbar.apply(this, args);
		} finally {
			page.add_action_icon = add_action_icon;
			page.add_button = add_button;
		}
	};
	const email_doc = PrintView.prototype.email_doc;
	PrintView.prototype.email_doc = function (...args) {
		if (!tanpa_email()) return email_doc.apply(this, args); // also its Ctrl+Shift+E
	};
}

try {
	let kelas = frappe.ui.form.PrintView;
	bungkus_cetak(kelas);
	Object.defineProperty(frappe.ui.form, "PrintView", {
		configurable: true,
		enumerable: true,
		get: () => kelas,
		set: (baru) => {
			kelas = baru;
			bungkus_cetak(baru);
		},
	});
} catch (e) {
	// Frappe's print view stays as it is.
}
