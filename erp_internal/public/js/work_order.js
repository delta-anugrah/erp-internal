// "Record Output" on a submitted, unfinished Work Order: a new Production Entry for this order and its machine.
// The machine is editable after submit only while the order runs (`kapasitas.kunci_mesin` refuses the rest).
const STATUS_GANTI_MESIN = ["Not Started", "In Process"];

frappe.ui.form.on("Work Order", {
	refresh(frm) {
		frm.set_df_property(
			"erp_mesin",
			"read_only",
			frm.doc.docstatus === 1 && !STATUS_GANTI_MESIN.includes(frm.doc.status) ? 1 : 0
		);
		if (
			frm.doc.docstatus !== 1 ||
			!STATUS_GANTI_MESIN.includes(frm.doc.status) ||
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
