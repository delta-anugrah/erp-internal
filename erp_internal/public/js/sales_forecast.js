// Sales Forecast: the "Fill from History" button (erp_internal.planning.forecast.isi_dari_riwayat).
// Each item gets the average of the last full months of Sales History and submitted orders; people check and
// edit the numbers before submitting.

frappe.ui.form.on("Sales Forecast", {
	refresh(frm) {
		if (frm.doc.docstatus !== 0 || frm.is_new()) {
			return;
		}
		frm.add_custom_button(__("Fill from History"), () => {
			frappe
				.call({
					method: "erp_internal.planning.forecast.isi_dari_riwayat",
					args: { sales_forecast: frm.doc.name },
					freeze: true,
				})
				.then((r) => {
					const hasil = r.message || {};
					frm.reload_doc();
					let pesan = __("Filled from the average of {0}.", [(hasil.bulan || []).join(", ")]);
					const tanpa = hasil.tanpa_riwayat || [];
					if (tanpa.length) {
						pesan +=
							" " +
							__("No history yet: {0}. Enter their numbers by hand.", [
								tanpa.map((k) => frappe.utils.escape_html(k)).join(", "),
							]);
					}
					frappe.msgprint(pesan);
				});
		});
	},
});
