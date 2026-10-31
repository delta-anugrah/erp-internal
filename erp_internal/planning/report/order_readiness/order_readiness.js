// Order Readiness (Siap Order): what is short this month and when production must start.

const WARNA_STATUS = {
	Late: "red",
	"Start this week": "orange",
	"Set lead time": "gray",
	Scheduled: "blue",
	OK: "green",
};

// The statuses arrive in English (the sort key); each is shown in the user's language. Context keeps "OK"
// and "Late" from changing those words elsewhere in the desk.
function label_status(status) {
	return (
		{
			Late: __("Late", null, "Order Readiness"),
			"Start this week": __("Start this week", null, "Order Readiness"),
			"Set lead time": __("Set lead time", null, "Order Readiness"),
			Scheduled: __("Scheduled", null, "Order Readiness"),
			OK: __("OK", null, "Order Readiness"),
		}[status] || status
	);
}

frappe.query_reports["Order Readiness"] = {
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
		},
		{
			fieldname: "gudang",
			label: __("Warehouse"),
			fieldtype: "Link",
			options: "Warehouse",
			description: __("Empty: the company's Gudang Barang Jadi."),
			get_query: () => ({
				filters: { company: frappe.query_report.get_filter_value("company"), is_group: 0 },
			}),
		},
		{
			fieldname: "item_group",
			label: __("Item Group"),
			fieldtype: "Link",
			options: "Item Group",
			default: "Barang Jadi",
		},
	],
	formatter(value, row, column, data, default_formatter) {
		if (column.fieldname === "status" && data && data.status) {
			const warna = WARNA_STATUS[data.status] || "gray";
			return `<span class="indicator-pill ${warna}">${frappe.utils.escape_html(label_status(data.status))}</span>`;
		}
		return default_formatter(value, row, column, data);
	},
};
