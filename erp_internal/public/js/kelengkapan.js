// Missing data notices (kelengkapan.py): orange notes on the Item, Sales Order and Work Order forms, and the link
// in every notice that opens the place where it is fixed. A fix is a plain object from the server:
//   {doctype, name, field}        that form, scrolled to the field
//   {doctype, name, varian}       the template's Create Variant dialog, filled (the pigment of a colour)
//   {doctype, baru, baris}        a new document prefilled with `baru`, rows `baris` added on its form
//   {laporan, filters}            a report
// Notes never block a save; any error leaves the form as it is.

frappe.provide("erp.kelengkapan");

let tunggu = null; // a fix to finish once its form has loaded

function boleh(fix) {
	if (fix.laporan) return true;
	if (fix.baru || fix.varian) return frappe.model.can_create(fix.doctype);
	return frappe.model.can_write(fix.doctype);
}

// An HTML link, or the plain text when this user cannot open the fix. Text and fix are escaped.
erp.kelengkapan.tautan = function (teks, fix) {
	const aman = frappe.utils.escape_html(teks || "");
	if (!fix || !boleh(fix)) return aman;
	const data = frappe.utils.escape_html(JSON.stringify(fix));
	return `<a href="#" class="erp-perbaiki" data-perbaiki="${data}">${aman}</a>`;
};

function selesaikan(frm, fix) {
	if (fix.field) {
		frm.scroll_to_field(fix.field);
	}
	if (fix.varian && window.erpnext?.item?.show_single_variant_dialog) {
		window.erpnext.item.show_single_variant_dialog(frm);
		// ERPNext keeps the dialog to itself; it becomes cur_dialog once shown.
		const isi = (sisa) => {
			const d = window.cur_dialog;
			if (d && Object.keys(fix.varian).every((k) => d.fields_dict[k])) {
				Object.entries(fix.varian).forEach(([k, v]) => d.set_value(k, v));
			} else if (sisa > 0) {
				setTimeout(() => isi(sisa - 1), 100);
			}
		};
		isi(30);
	}
	Object.entries(fix.baris || {}).forEach(([tabel, rows]) => {
		frm.clear_table(tabel);
		rows.forEach((nilai) => {
			const row = frm.add_child(tabel);
			// set_value runs the row's triggers (item details, rate, UOM).
			frappe.model.set_value(row.doctype, row.name, nilai);
		});
		frm.refresh_field(tabel);
	});
}

erp.kelengkapan.buka = function (fix) {
	if (fix.laporan) {
		frappe.set_route("query-report", fix.laporan, fix.filters || {});
		return;
	}
	if (fix.baru) {
		tunggu = fix.baris ? { ...fix, baru_doctype: fix.doctype } : null;
		frappe.new_doc(fix.doctype, { ...fix.baru });
		return;
	}
	if (cur_frm && cur_frm.doctype === fix.doctype && cur_frm.docname === fix.name) {
		selesaikan(cur_frm, fix);
		return;
	}
	tunggu = fix;
	frappe.set_route("Form", fix.doctype, fix.name);
};

$(document).on("click", "a.erp-perbaiki", function (e) {
	e.preventDefault();
	try {
		erp.kelengkapan.buka(JSON.parse($(this).attr("data-perbaiki")));
	} catch (err) {
		console.error(err);
	}
});

// One orange block of our own per form, removed and redrawn on each refresh (never another note's).
function tampilkan(frm, baris) {
	frm.__erp_kelengkapan?.remove();
	frm.__erp_kelengkapan = null;
	if (!baris.length) return;
	const html = baris.map((b) => `<div>${b}</div>`).join("");
	frm.__erp_kelengkapan = frm.dashboard.set_headline_alert(html, "orange");
}

function baris_server(pesan) {
	return pesan.map(
		(p) =>
			`${frappe.utils.escape_html(p.pesan)} ${erp.kelengkapan.tautan(p.cara, p.perbaiki)}`
	);
}

const MUAT = {
	Item(frm) {
		if (frm.is_new()) return tampilkan(frm, []);
		// The form object is reused for the next Item: draw only if it still shows this one.
		const nama = frm.doc.name;
		frappe
			.xcall("erp_internal.kelengkapan.untuk_item", { item: nama })
			.then((pesan) => frm.doc.name === nama && tampilkan(frm, baris_server(pesan)));
	},
	"Work Order"(frm) {
		const buka = frm.doc.docstatus === 0 || ["Not Started", "In Process"].includes(frm.doc.status);
		if (!buka || !frm.doc.production_item) return tampilkan(frm, []);
		const nama = frm.doc.name;
		const item = frm.doc.production_item;
		frappe
			.xcall("erp_internal.kelengkapan.untuk_produksi", { work_order: nama, item })
			.then(
				(pesan) =>
					frm.doc.name === nama &&
					frm.doc.production_item === item &&
					tampilkan(frm, baris_server(pesan))
			);
	},
	"Sales Order"(frm) {
		if (frm.doc.docstatus !== 0) return tampilkan(frm, []);
		// No list on the order yet: the default one (master._harga_bawaan keeps the global default set).
		const daftar = frm.doc.selling_price_list || frappe.defaults.get_default("selling_price_list");
		const baris = (frm.doc.items || [])
			.filter((r) => r.item_code && !flt(r.rate))
			.map((r) => {
				const fix = {
					doctype: "Item Price",
					baru: { item_code: r.item_code, price_list: daftar },
				};
				const teks = __("Line {0}: {1} has no selling price.", [
					r.idx,
					frappe.utils.escape_html(r.item_code),
				]);
				return `${teks} ${erp.kelengkapan.tautan(__("Add a selling price"), fix)}`;
			});
		tampilkan(frm, baris);
	},
};

function muat(frm) {
	try {
		MUAT[frm.doctype]?.(frm);
	} catch (e) {
		// A courtesy note: never break a form for it.
	}
}

frappe.ui.form.on("Work Order", "production_item", muat);
frappe.ui.form.on("Sales Order Item", { item_code: muat, rate: muat, items_remove: muat });

$(document).on("form-refresh", (e, frm) => {
	muat(frm);
	if (!tunggu) return;
	const fix = tunggu;
	const cocok = fix.baru_doctype
		? frm.doctype === fix.baru_doctype && frm.is_new()
		: frm.doctype === fix.doctype && frm.docname === fix.name;
	if (cocok) {
		tunggu = null;
		setTimeout(() => {
			try {
				selesaikan(frm, fix);
			} catch (err) {
				console.error(err);
			}
		}, 300);
	}
});
