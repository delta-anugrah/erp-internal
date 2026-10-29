// Plan vs Actual: the plan against what Production Entries recorded, per machine, day, item, order or shift.

// Fallbacks for the Achieved % colours; the report sends the real ones (CAPAI_HIJAU, CAPAI_KUNING in
// plan_vs_actual.py) on the column as `hijau` and `kuning`.
const CAPAI_HIJAU = 100;
const CAPAI_KUNING = 85;

frappe.query_reports["Plan vs Actual"] = {
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
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.add_days(frappe.datetime.get_today(), -7),
			reqd: 1,
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.add_days(frappe.datetime.get_today(), -1),
			reqd: 1,
		},
		{
			fieldname: "workstation",
			label: __("Machine"),
			fieldtype: "Link",
			options: "Workstation",
			get_query: () => ({ filters: { erp_nomor: [">", 0] } }),
		},
		{
			fieldname: "item",
			label: __("Item"),
			fieldtype: "Link",
			options: "Item",
			description: __("A template matches all its variants."),
		},
		{
			fieldname: "work_order",
			label: __("Work Order"),
			fieldtype: "Link",
			options: "Work Order",
			get_query: () => ({
				filters: { company: frappe.query_report.get_filter_value("company"), docstatus: 1 },
			}),
		},
		{ fieldname: "shift", label: __("Shift"), fieldtype: "Select", options: "\nShift 1\nShift 2\nShift 3" },
		{
			fieldname: "group_by",
			label: __("Group by"),
			fieldtype: "Select",
			options: ["Machine", "Machine + Day", "Day", "Item", "Work Order", "Shift"].join("\n"),
			default: "Machine + Day",
			reqd: 1,
		},
		{
			fieldname: "target_dari",
			label: __("Target from"),
			fieldtype: "Select",
			options: ["Work Order", "Capacity"].join("\n"),
			default: "Work Order",
			reqd: 1,
			description: __("Work Order: its quantity spread over its planned days. Capacity: pieces per hour × run hours."),
		},
	],
	formatter(value, row, column, data, default_formatter) {
		const html = default_formatter(value, row, column, data);
		if (column.fieldname === "capai" && data && data.capai !== null && data.capai !== undefined) {
			const hijau = column.hijau ?? CAPAI_HIJAU;
			const kuning = column.kuning ?? CAPAI_KUNING;
			const warna = data.capai >= hijau ? "green" : data.capai >= kuning ? "orange" : "red";
			return `<span class="indicator-pill ${warna}">${html}</span>`;
		}
		if (column.fieldname === "catatan" && data && data.catatan) {
			return `<span class="text-muted">${frappe.utils.escape_html(data.catatan)}</span>`;
		}
		return html;
	},
};
