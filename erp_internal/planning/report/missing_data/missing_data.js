// Missing Data: set-up that is not complete yet; "How to fix" opens the place where it is fixed (kelengkapan.js).

frappe.query_reports["Missing Data"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
			reqd: 1,
		},
		{
			fieldname: "item",
			label: __("Item"),
			fieldtype: "Link",
			options: "Item",
		},
	],
	formatter(value, row, column, data, default_formatter) {
		if (column.fieldname === "cara" && data && data.perbaiki) {
			return erp.kelengkapan.tautan(value, data.perbaiki);
		}
		// Record text (colour names, item names) is escaped before it is wrapped in HTML.
		const aman =
			column.fieldtype === "Data" && typeof value === "string"
				? frappe.utils.escape_html(value)
				: value;
		return default_formatter(aman, row, column, data);
	},
};
