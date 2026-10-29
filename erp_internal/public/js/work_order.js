// "Record Output" on a submitted, unfinished Work Order: a new Production Entry for this order and its machine.
frappe.ui.form.on("Work Order", {
	refresh(frm) {
		if (
			frm.doc.docstatus !== 1 ||
			!["Not Started", "In Process"].includes(frm.doc.status) ||
			!frappe.model.can_create("Production Entry")
		)
			return;
		frm.add_custom_button(__("Record Output"), () =>
			frappe.new_doc("Production Entry", {
				work_order: frm.doc.name,
				company: frm.doc.company,
				item: frm.doc.production_item,
				workstation: frm.doc.erp_mesin,
			})
		);
	},
});
