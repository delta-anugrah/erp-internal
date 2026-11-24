// seal_cap.py: a Seal Cap line's price follows its machine; set when the machine, item or UOM changes (the
// server sets it again on save).
// shortcut: delayed 800 ms to land after ERPNext's own item and UOM price lookups; on a very slow server the form
// may show the list price until save, when `harga_mesin` corrects it. Upgrade: chain on ERPNext's lookup promise.
function harga_mesin(frm, cdt, cdn) {
	const r = locals[cdt][cdn];
	if (!r.item_code || !r.erp_mesin) return;
	setTimeout(() => {
		frappe
			.xcall("erp_internal.seal_cap.harga", { item_code: r.item_code, mesin: r.erp_mesin })
			.then((harga) => {
				if (harga == null) return;
				const n = harga * flt(r.conversion_factor || 1);
				frappe.model
					.set_value(cdt, cdn, "price_list_rate", n)
					.then(() => frappe.model.set_value(cdt, cdn, "rate", n));
			});
	}, 800);
}
frappe.ui.form.on("Sales Order Item", {
	erp_mesin: harga_mesin,
	item_code: harga_mesin,
	uom: harga_mesin,
	conversion_factor: harga_mesin,
});
