// "Import from Excel" on the Machine Capacity list: attach a .xlsx or .csv, Preview every row with its result,
// then Apply. Nothing is written before Apply. Every cell goes through escape_html: it is the user's file text.
const METODE = "erp_internal.planning.impor_kapasitas.";
const WARNA = { New: "green", Changed: "blue", Unchanged: "gray", Refused: "red" };
const KOLOM = [
	["no", __("Row")],
	["hasil", __("Result")],
	["alasan", __("Reason")],
	["item", __("Item")],
	["jenis", __("Jenis")],
	["workstation", __("Machine")],
	["cycle_time", __("Cycle Time (s)")],
	["cavities", __("Cavities")],
	["part_weight", __("Part Weight (g)")],
	["runner_weight", __("Runner Weight (g)")],
	["material", __("Material")],
	["masterbatch", __("Masterbatch")],
	["masterbatch_percent", __("Masterbatch %")],
];

function tabel(h) {
	const esc = frappe.utils.escape_html;
	const jumlah = {};
	h.baris.forEach((b) => (jumlah[b.hasil] = (jumlah[b.hasil] || 0) + 1));
	const ringkas = Object.keys(WARNA)
		.map((k) => `<span class="indicator-pill ${WARNA[k]}">${esc(__(k))}: ${esc(jumlah[k] || 0)}</span>`)
		.join(" ");
	const kepala = KOLOM.map(([, label]) => `<th>${esc(label)}</th>`).join("");
	const isi = h.baris
		.map((b) => {
			const sel = KOLOM.map(([k]) => {
				const nilai = k === "hasil" ? __(b[k]) : b[k];
				return `<td>${esc(nilai === undefined || nilai === null ? "" : nilai)}</td>`;
			}).join("");
			return `<tr>${sel}</tr>`;
		})
		.join("");
	const asing = (h.kolom_asing || []).length
		? `<p class="text-muted">${esc(__("Columns ignored: {0}", [h.kolom_asing.join(", ")]))}</p>`
		: "";
	return `<p>${ringkas}</p>${asing}<div style="overflow:auto;max-height:55vh"><table class="table table-bordered table-sm"><thead><tr>${kepala}</tr></thead><tbody>${isi}</tbody></table></div>`;
}

frappe.listview_settings["Machine Capacity"] = {
	onload(listview) {
		if (!frappe.model.can_create("Machine Capacity") || !frappe.model.can_write("Machine Capacity")) return;
		listview.page.add_inner_button(__("Import from Excel"), () => bukaImpor(listview));
	},
};

function bukaImpor(listview) {
	let $terapkan;
	const d = new frappe.ui.Dialog({
		title: __("Import Machine Capacity"),
		size: "extra-large",
		fields: [
			{
				fieldname: "berkas",
				fieldtype: "Attach",
				label: __("Excel or CSV file"),
				reqd: 1,
				options: { restrictions: { allowed_file_types: [".xlsx", ".csv"] }, make_attachments_public: false },
			},
			{ fieldname: "hasil", fieldtype: "HTML" },
		],
		primary_action_label: __("Preview"),
		primary_action(v) {
			frappe.call({
				method: METODE + "pratinjau",
				args: { file_url: v.berkas },
				freeze: true,
				callback(r) {
					const h = r.message;
					d.get_field("hasil").$wrapper.html(tabel(h));
					const ada = h.baris.some((b) => b.hasil === "New" || b.hasil === "Changed");
					$terapkan.toggle(ada);
				},
			});
		},
	});
	d.add_custom_action(
		__("Apply"),
		() => {
			frappe.call({
				method: METODE + "terapkan",
				args: { file_url: d.get_value("berkas") },
				freeze: true,
				callback(r) {
					const h = r.message;
					d.get_field("hasil").$wrapper.html(tabel(h));
					$terapkan.hide();
					frappe.show_alert({
						message: __("{0} BOMs made, {1} switched off.", [h.bom.dibuat, h.bom.nonaktif]),
						indicator: "green",
					});
					listview.refresh();
				},
			});
		},
		"btn-primary-light"
	);
	$terapkan = d.custom_actions.children().last().hide();
	d.show();
}
