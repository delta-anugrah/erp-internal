// Production Floor: the 3D floor of the injection moulding machines. The logic lives in lantai.bundle.js: Desk caches
// page scripts in the browser until `bench clear-cache`, so this file stays small. Desk keeps a page's DOM for the whole
// session: the view is paused while the page is hidden and resumed on show.
frappe.provide("erp.lantai");

// `data()` without frappe.call, so a failed request never opens a message dialog; rejects on any failure.
erp.lantai.ambil = function () {
	return fetch("/api/method/erp_internal.lantai.data", { headers: { Accept: "application/json" } })
		.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
		.then((r) => r.message);
};

// The plain machine table, for a browser without WebGL or when the 3D bundle does not load. `daftar` null means the
// list could not be loaded. Record text goes in through textContent only.
erp.lantai.tabel = function (host, daftar) {
	const root = host.shadowRoot || host.attachShadow({ mode: "open" });
	if (!root.querySelector(".tabel-mesin"))
		root.innerHTML = `<style>
:host{display:block;overflow:auto;background:var(--bg-color,#fff);color:var(--text-color,#1f272e)}
.tabel-mesin{padding:16px 24px;font-size:var(--text-base,14px)}
table{border-collapse:collapse;width:100%;max-width:960px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--border-color,#e2e6e9)}
th{color:var(--text-muted,#6c7680);font-weight:600}
p{color:var(--text-muted,#6c7680)}
</style><div class="tabel-mesin"><p></p><table><thead><tr></tr></thead><tbody></tbody></table></div>`;
	const kepala = root.querySelector("thead tr");
	if (!kepala.children.length)
		for (const t of [__("No."), __("Machine"), __("Status"), __("Work Order")])
			kepala.appendChild(document.createElement("th")).textContent = t;
	root.querySelector("p").textContent = daftar ? "" : __("The machine list could not be loaded.");
	const kosong = "Idle"; // an empty Workstation status reads as Idle
	const isi = root.querySelector("tbody");
	isi.replaceChildren();
	for (const m of daftar || []) {
		const tr = isi.appendChild(document.createElement("tr"));
		const wo = m.wo ? [m.wo.name, m.wo.item_name].filter(Boolean).join(" · ") : "–";
		const mesin = [m.name, [m.merek, m.tonase ? `${m.tonase}T` : ""].filter(Boolean).join(" ")]
			.filter(Boolean)
			.join(" · ");
		const status = m.status || kosong; // ERPNext's own option, translated by ERPNext
		for (const t of [String(m.nomor ?? ""), mesin, __(status), wo])
			tr.appendChild(document.createElement("td")).textContent = t;
	}
};

frappe.pages["lantai-produksi"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Production Floor"),
		single_column: true,
		hide_sidebar: true,
	});
	page.page_head.hide();
	const host = $('<div class="lantai-host"></div>').appendTo(page.body)[0];
	// Full-bleed under whatever Desk keeps on screen (navbar, rail): fixed from the page body's top-left corner.
	wrapper.fit = () => {
		const r = page.body[0].getBoundingClientRect();
		if (r.width) Object.assign(host.style, { top: `${Math.max(0, r.top)}px`, left: `${Math.max(0, r.left)}px` });
	};
	Object.assign(host.style, { position: "fixed", right: "0", bottom: "0" });
	wrapper.fit();
	$(window).on("resize", () => wrapper.fit());
	$(wrapper).on("hide", () => wrapper.ctl?.jeda());

	frappe.route_options = {}; // not null: Frappe's sidebar reads route_options.sidebar on every route change
	Promise.resolve(frappe.require("lantai.bundle.js"))
		.then(() => {
			wrapper.ctl = erp.lantai.pasang(host);
			wrapper.fit();
			// The user may have left before the bundle arrived: do not start drawing on a page Desk has hidden.
			// (A background browser tab is the scene's own business: it resumes on visibilitychange.)
			if (wrapper.offsetParent === null) wrapper.ctl.jeda();
		})
		.catch(() => {
			// The 3D view did not load: the plain table instead, never a dialog or a blank page.
			erp.lantai.tabel(host, []);
			erp.lantai
				.ambil()
				.then((d) => erp.lantai.tabel(host, d?.mesin || []))
				.catch(() => erp.lantai.tabel(host, null));
		});
};

frappe.pages["lantai-produksi"].on_page_show = function (wrapper) {
	wrapper.fit?.();
	frappe.route_options = {};
	wrapper.ctl?.lanjut();
};
