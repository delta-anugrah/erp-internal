frappe.ui.form.on("Machine Capacity", {
	onload(frm) {
		if (!frm.is_new() || frm.doc.runner_reground) return;
		frappe.call({
			method: "erp_internal.planning.kapasitas.runner_digiling",
			callback: (r) => frm.set_value("runner_reground", r.message || 0),
		});
	},
});
