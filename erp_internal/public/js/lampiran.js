// The orange note on a form whose real document is not attached yet (spec section 7). The table comes from
// `lampiran.boot` (`frappe.boot.erp_lampiran`): `wajib` is DocType -> null or [field, [values]] (the note shows
// on a draft), `nanti` the DocTypes whose signed copy is attached after submit (the note shows once submitted).
// The server refuses the submit itself; this is only the reminder.

function catatan(frm) {
	const tabel = frappe.boot.erp_lampiran;
	if (!tabel) {
		return null;
	}
	if (frm.doc.docstatus === 0 && frm.doctype in tabel.wajib) {
		const syarat = tabel.wajib[frm.doctype];
		if (!syarat || syarat[1].includes(frm.doc[syarat[0]])) {
			return __("Attach a photo or scan of the real document before you submit.");
		}
	}
	if (frm.doc.docstatus === 1 && tabel.nanti.includes(frm.doctype)) {
		return __("Attach the signed delivery note.");
	}
	return null;
}

function tampilkan(frm) {
	try {
		const teks = catatan(frm);
		if (teks && !(frm.get_docinfo().attachments || []).length) {
			frm.set_intro(teks, "orange");
			frm.__catatan_lampiran = frm.$intro_message;
		} else if (frm.__catatan_lampiran && frm.__catatan_lampiran === frm.$intro_message) {
			frm.set_intro(""); // only our own note, never another one set since
			frm.__catatan_lampiran = null;
		}
	} catch (e) {
		// The note is a courtesy: never break a form for it.
	}
}

// A DocType whose rule depends on a field (Stock Entry: purpose) redraws when that field changes.
const terdaftar = new Set();

// One listener on every form's refresh; each form also redraws when its attachments change.
$(document).on("form-refresh", (e, frm) => {
	const syarat = (frappe.boot.erp_lampiran?.wajib || {})[frm.doctype];
	if (syarat && !terdaftar.has(frm.doctype)) {
		terdaftar.add(frm.doctype);
		frappe.ui.form.on(frm.doctype, syarat[0], tampilkan);
	}
	tampilkan(frm);
	$(frm.wrapper)
		.off("attachments_change.erp_lampiran")
		.on("attachments_change.erp_lampiran", () => tampilkan(frm));
});
