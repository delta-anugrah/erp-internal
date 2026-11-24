// seal_cap.py: picking a Seal Cap line's machine sets its price (the server sets it again on save).
frappe.ui.form.on("Sales Order Item", {
	erp_mesin(frm, cdt, cdn) {
		const r = locals[cdt][cdn];
		if (!r.item_code || !r.erp_mesin) return;
		frappe
			.xcall("erp_internal.seal_cap.harga", { item_code: r.item_code, mesin: r.erp_mesin })
			.then((harga) => {
				if (harga == null) return;
				const n = harga * flt(r.conversion_factor || 1);
				frappe.model
					.set_value(cdt, cdn, "price_list_rate", n)
					.then(() => frappe.model.set_value(cdt, cdn, "rate", n));
			});
	},
});
