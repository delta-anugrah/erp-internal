// Monthly Expenses: one month's expenses per category, the operator wage per machine under its category.

frappe.query_reports["Monthly Expenses"] = {
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
			fieldname: "bulan",
			label: __("Month"),
			fieldtype: "Date",
			default: frappe.datetime.month_start(),
			reqd: 1,
			description: __("Any day of the month."),
		},
	],
	formatter(value, row, column, data, default_formatter) {
		const html = default_formatter(value, row, column, data);
		if (!data) return html;
		// The report view indents rows with `indent` itself (tree view); sub-rows are muted, the rest bold.
		return data.indent ? `<span class="text-muted">${html}</span>` : `<b>${html}</b>`;
	},
};
