frappe.ui.form.on("Machine Capacity", {
	onload(frm) {
		if (!frm.is_new() || frm.doc.runner_reground) return;
		frappe.call({
			method: "erp_internal.planning.kapasitas.runner_digiling",
			callback: (r) => frm.set_value("runner_reground", r.message || 0),
		});
	},
	refresh(frm) {
		if (frm.is_new() || !frappe.user.has_role("Manufacturing Manager")) return;
		frm.add_custom_button(__("Make BOMs"), () => {
			frappe.call({
				method: "erp_internal.planning.kapasitas.buat_bom_kapasitas",
				args: { nama: frm.doc.name },
				freeze: true,
				callback: (r) => {
					const h = r.message || {};
					frappe.show_alert({
						message: __("{0} BOMs made, {1} unchanged, {2} switched off.", [
							h.dibuat.length,
							h.tetap.length,
							h.nonaktif.length,
						]),
						indicator: "green",
					});
				},
			});
		});
	},
});
