frappe.ui.form.on("Production Entry", {
	setup(frm) {
		frm.set_query("work_order", () => ({
			filters: {
				docstatus: 1,
				status: ["in", ["Not Started", "In Process"]],
				...(frm.doc.company ? { company: frm.doc.company } : {}),
			},
		}));
		frm.set_query("reason", "rejects", () => ({ filters: { disabled: 0 } }));
	},
	onload(frm) {
		if (!frm.is_new()) return;
		if (!frm.doc.company) frm.set_value("company", frappe.defaults.get_user_default("Company"));
		if (frm.doc.shift && !frm.doc.hours) frm.trigger("shift");
	},
	work_order(frm) {
		if (!frm.doc.work_order) return;
		frappe.db
			.get_value("Work Order", frm.doc.work_order, ["company", "erp_mesin"])
			.then(({ message: wo }) => {
				if (!wo) return;
				if (wo.company) frm.set_value("company", wo.company);
				if (wo.erp_mesin) frm.set_value("workstation", wo.erp_mesin);
			});
	},
	shift(frm) {
		if (!frm.doc.shift) return;
		frappe.call({
			method: "erp_internal.planning.doctype.production_entry.production_entry.jam",
			args: { shift: frm.doc.shift },
			callback: (r) => r.message && frm.set_value("hours", r.message),
		});
	},
});

frappe.ui.form.on("Production Entry Reject", {
	qty(frm) {
		hitung_reject(frm);
	},
	rejects_remove(frm) {
		hitung_reject(frm);
	},
});

function hitung_reject(frm) {
	frm.set_value(
		"reject_qty",
		(frm.doc.rejects || []).reduce((n, r) => n + flt(r.qty), 0)
	);
}
