// Whole numbers without decimals (Abel 2026-11-27): with the site's 3-digit float precision a quantity of 20000
// showed "20.000,000", read as twenty million. A Float input and a report cell now show a whole value as
// "20.000"; a fraction keeps its decimals ("0,880"), and Currency fields are left as they are.

if (frappe.ui.form.ControlFloat) {
	const masukan = frappe.ui.form.ControlFloat.prototype.format_for_input;
	frappe.ui.form.ControlFloat.prototype.format_for_input = function (value) {
		if (this.df.fieldtype === "Float" && value !== null && value !== "" && flt(value) % 1 === 0) {
			return format_number(value, this.get_number_format(), 0);
		}
		return masukan.call(this, value);
	};
}

if (frappe.form?.formatters?.Float) {
	// Query and report views pass always_show_decimals to line up the decimals of a column.
	const tampil = frappe.form.formatters.Float;
	frappe.form.formatters.Float = function (value, docfield, options, doc) {
		if (options?.always_show_decimals) options = { ...options, always_show_decimals: false };
		return tampil.call(this, value, docfield, options, doc);
	};
}

// The per-column filter row under a report table's header is an empty grey box without a word; it says what it
// is for now. Column 0 (the row number) has a disabled input and stays empty.
const KATA_CARI = () => __("Search…");
let tertunda = false;
new MutationObserver(() => {
	if (tertunda) return;
	tertunda = true; // one scan per frame however many nodes changed
	requestAnimationFrame(() => {
		tertunda = false;
		for (const el of document.querySelectorAll("input.dt-filter:not([placeholder]):not([disabled])")) {
			el.placeholder = KATA_CARI();
		}
	});
}).observe(document.documentElement, { childList: true, subtree: true });
