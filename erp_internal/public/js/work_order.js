// "Record Output" on a submitted, unfinished Work Order: a new Production Entry for this order and its machine.
// The machine is editable after submit only while the order runs (`kapasitas.kunci_mesin` refuses the rest).
// The Machine field lists only the machines Machine Capacity names for the item (`kapasitas.cari_mesin`,
// `mesin_terdaftar` refuses the rest); an item with no row yet is free, and the field says so.
// ERPNext's "Finish" (a Manufacture straight from the order) is System Manager's only: output goes through a
// Production Entry (`production_entry.cek_stock_entry` refuses the rest). ERPNext's refresh runs first.
const STATUS_GANTI_MESIN = ["Not Started", "In Process"];

function catatan_mesin(frm) {
	const item = frm.doc.production_item;
	if (!item || frm.doc.docstatus === 2) return frm.set_df_property("erp_mesin", "description", "");
	frappe.call({
		method: "erp_internal.planning.kapasitas.mesin_item",
		args: { item },
		callback: (r) => {
			if (item !== frm.doc.production_item) return;
			frm.set_df_property(
				"erp_mesin",
				"description",
				r.message && r.message.length
					? ""
					: __("No Machine Capacity row for this item yet: every machine is allowed.")
			);
		},
	});
}

frappe.ui.form.on("Work Order", {
	setup(frm) {
		frm.set_query("erp_mesin", () => ({
			query: "erp_internal.planning.kapasitas.cari_mesin",
			filters: { item: frm.doc.production_item },
		}));
	},
	production_item(frm) {
		catatan_mesin(frm);
	},
	refresh(frm) {
		if (!frappe.user.has_role("System Manager")) frm.remove_custom_button(__("Finish"));
		catatan_mesin(frm);
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
