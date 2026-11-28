// Screenshots for the manual books (docs/manual/shotlist.json → docs/manual/gambar/<id>.png). Needs `bench start`
// and the sample data of `erp_internal.contoh.buat_contoh` with its users and their password. Dev sites only.
//
//   ERP_SANDI=<password> node tools/manual_gambar.mjs              # every picture; ERP_URL defaults to erp.localhost:8002
//   ERP_SANDI=<password> node tools/manual_gambar.mjs op-10 adm-26  # only the named ones (a prefix works too: op-)
//
// One fresh browser per picture, 1440x900, logged in as the shot list's user (operator@/superadmin@ when the old
// user@/developer@ no longer log in), Indonesian UI unless the recipe says English. A recipe (RESEP) prepares the
// screen and may crop to an element (shot at 2x so the crop stays sharp). Drafts a recipe makes are deleted, things
// it submits cancelled, machine statuses and each user's language put back. A picture that fails is reported and
// left out (the PDF prints a grey box); exit code 1 when any failed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const URL = (process.env.ERP_URL || "http://erp.localhost:8002").replace(/\/$/, "");
const SANDI = process.env.ERP_SANDI;
const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "manual");
const GAMBAR = join(AKAR, "gambar");
const SHOTS = JSON.parse(readFileSync(join(AKAR, "shotlist.json"), "utf8"));
const NAMA_BARU = { "user@example.com": "operator@example.com", "developer@example.com": "superadmin@example.com" };

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
// A local date (the site runs on Asia/Jakarta, like this laptop): toISOString would give yesterday before 07:00.
const lokal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const iso = (hari = 0) => lokal(new Date(Date.now() + hari * 864e5));
const senin = (minggu) => {
	const d = new Date();
	d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + 7 * (minggu - 1));
	return lokal(d);
};

// --- helpers on one page --------------------------------------------------------------------------------------------
function alat(page, jejak) {
	const api = (method, args = {}) =>
		page.evaluate(
			([m, a]) =>
				frappe
					.xcall(m, a)
					.then((x) => ({ ok: true, x }))
					.catch((e) => ({ ok: false, e: String(e?.message || e) })),
			[method, args]
		);
	const daftar = async (doctype, filters = {}, extra = {}) => {
		const r = await api("frappe.client.get_list", {
			doctype,
			filters,
			fields: ["name"],
			limit_page_length: 1,
			order_by: "creation desc",
			...extra,
		});
		return r.ok ? r.x : [];
	};
	const satu = async (doctype, filters, extra) => (await daftar(doctype, filters, extra))[0]?.name;
	const tenang = async (ms = 900) => {
		await page.waitForLoadState("networkidle").catch(() => {});
		await page.waitForFunction(() => !document.querySelector(".freeze-message-container, #freeze.in"), null, { timeout: 15000 }).catch(() => {});
		await tidur(ms);
	};
	const ke = async (path) => {
		await page.goto(`${URL}${path}`);
		await tenang(1200);
		// Desk may redirect a module path once more after load: wait until the address stays put.
		for (let i = 0, lama = ""; i < 10 && page.url() !== lama; i++) {
			lama = page.url();
			await tidur(700);
		}
		await page.waitForFunction(() => window.frappe?.boot && window.cur_page !== undefined, null, { timeout: 30000 }).catch(() => {});
		await tenang(600);
	};
	const form = async (doctype, nama) => {
		await page.evaluate(([d, n]) => frappe.set_route("Form", d, n), [doctype, nama]);
		if (!nama) throw new Error(`no ${doctype} found`);
		await page.waitForFunction(([d, n]) => cur_frm?.doctype === d && cur_frm.docname === n, [doctype, nama], { timeout: 30000 });
		await tenang(1500);
	};
	// A field by fieldname, or by its English label when no field has that name.
	const nilai = (kepala) =>
		page.evaluate(async (kepala) => {
			const t = (ms) => new Promise((r) => setTimeout(r, ms));
			for (const [k, v] of Object.entries(kepala)) {
				const f = cur_frm.fields_dict[k] ? k : cur_frm.meta.fields.find((x) => x.label === k)?.fieldname;
				if (!f) throw new Error(`no field ${k} on ${cur_frm.doctype}`);
				await cur_frm.set_value(f, v);
				await t(500);
			}
		}, kepala);
	const baris = (tabel, rows) =>
		page.evaluate(
			async ([tabel, rows]) => {
				const t = (ms) => new Promise((r) => setTimeout(r, ms));
				// The empty first row a new form starts with is used before adding rows.
				const kosong = (cur_frm.doc[tabel] || []).find((r) => !r.item_code && !r.reason);
				for (const [i, isi] of rows.entries()) {
					const row = (i === 0 && kosong) || cur_frm.add_child(tabel);
					for (const [f, v] of Object.entries(isi)) {
						await frappe.model.set_value(row.doctype, row.name, f, v);
						await t(800);
					}
				}
				cur_frm.refresh_field(tabel);
			},
			[tabel, rows]
		);
	// A new, unsaved form: header fields, then rows of `tabel`.
	const baru = async (doctype, kepala = {}, tabel, rows = []) => {
		await page.evaluate((d) => frappe.new_doc(d), doctype);
		await page.waitForFunction((d) => cur_frm?.doctype === d && cur_frm.is_new(), doctype, { timeout: 30000 });
		await tidur(800);
		// A Quick Entry dialog would hide the form: open the full form instead.
		const dialog = page.locator(".modal.show button").filter({ hasText: /Edit Full Form|Sunting Formulir Lengkap|Ubah Formulir Lengkap/i }).first();
		await dialog.waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
		if (await dialog.isVisible()) {
			await dialog.click();
			await page.waitForFunction(() => !document.querySelector(".modal.show"), null, { timeout: 10000 }).catch(() => {});
			await tidur(1200);
		}
		await nilai(kepala);
		if (tabel) await baris(tabel, rows);
		await tenang(1200);
	};
	const simpan = async () => {
		await page.evaluate(() => cur_frm.save());
		await tenang(1500);
		const nama = await page.evaluate(() => (cur_frm.is_new() ? null : [cur_frm.doctype, cur_frm.docname]));
		if (nama) jejak.push(nama);
		return nama;
	};
	const klikTeks = async (sel, teks) => {
		await page.locator(sel).filter({ hasText: teks }).first().click();
		await tenang(900);
	};
	const laporan = async (nama, filter = {}) => {
		await page.evaluate(([n, f]) => {
			frappe.route_options = f;
			frappe.set_route("query-report", n);
		}, [nama, filter]);
		await page.waitForFunction(() => document.querySelector(".dt-row:not(.dt-row-header), .no-result, .report-wrapper .msg-box"), null, { timeout: 60000 }).catch(() => {});
		await tenang(1800);
	};
	// The rows of a Script Report as data.
	const dataLaporan = async (nama, filters) => {
		const r = await api("frappe.desk.query_report.run", { report_name: nama, filters });
		return r.ok ? r.x.result || [] : [];
	};
	const tutupPesan = async () => {
		await page.evaluate(() => {
			for (const d of [...(frappe.ui.open_dialogs || [])]) d.hide();
			document.querySelectorAll(".modal.show").forEach((m) => $(m).modal("hide"));
		});
		await tidur(500);
	};
	return { page, api, daftar, satu, tenang, ke, form, nilai, baris, baru, simpan, klikTeks, laporan, dataLaporan, tutupPesan, jejak };
}

const lantai = async (h) => {
	await h.page.waitForFunction(
		() => {
			const r = document.querySelector(".lantai-host")?.shadowRoot;
			return r?.querySelector("canvas") && !r.querySelector(".memuat") && r.querySelector("tr[data-mesin]");
		},
		null,
		{ timeout: 90000 }
	);
	await tidur(3500);
};
const pilihMesin = async (h, mesin) => {
	await h.page.locator(`.lantai-host tr[data-mesin="${mesin}"]`).first().click();
	await tidur(2500);
};
const inputHarian = async (h) => {
	await h.page.waitForSelector("section[data-wo]", { timeout: 60000 });
	await tidur(1500);
};
// Today's Shift 1 cell of the first block that has an input there.
const selHariIni = (h, shift = "Shift 1") => h.page.locator(`section[data-wo] input[data-key="${iso()}|${shift}"]`).first();
const garis = (h, sel) => h.page.locator(sel).first().evaluate((e) => { e.style.outline = "3px solid #e11d48"; e.style.outlineOffset = "3px"; });

// Statuses the floor recipes change, put back after the picture.
async function statusMesin(h, mesin, status, aksi) {
	const lama = await h.page.evaluate((m) => frappe.db.get_value("Workstation", m, "status").then((r) => r.message?.status), mesin);
	const r = await h.api("erp_internal.production_floor.set_status", { machine: mesin, status });
	if (!r.ok) throw new Error(`set_status ${mesin}: ${r.e}`);
	try {
		await tidur(2500);
		await aksi();
	} finally {
		await h.api("erp_internal.production_floor.set_status", { machine: mesin, status: lama || "Idle" });
	}
}

// Production Entries a recipe made through Daily Input: cancelled after the picture.
async function batalkanHasilBaru(h, sejak) {
	const nama = await h.daftar("Production Entry", { docstatus: 1, creation: [">=", sejak] }, { limit_page_length: 20 });
	for (const { name } of nama) await h.api("frappe.client.cancel", { doctype: "Production Entry", name });
}

const kartuPengaturan = async (h) => {
	await h.page.locator('[data-fieldname="password"] .section-head, .section-head').filter({ hasText: /Kata Sandi|Password/ }).first().click().catch(() => {});
	await tidur(800);
};

// Settings dialog from the user menu at the sidebar's foot.
async function pengaturan(h) {
	await h.page.locator(".sidebar-user-button:visible").first().click();
	await tidur(800);
	await h.page.getByText(/^(Pengaturan|Settings)$/).locator("visible=true").last().click();
	await h.page.locator(".modal.show .change-password-btn").waitFor({ state: "visible", timeout: 30000 });
	await tidur(1200);
}

// The small Change Password dialog, a new password typed in, never submitted.
async function ubahSandi(h) {
	await pengaturan(h);
	await h.page.locator(".modal.show .change-password-btn").first().click();
	const kotak = h.page.locator('.modal.show input[data-fieldname="new_password"]').last();
	await kotak.waitFor({ state: "visible", timeout: 15000 });
	await kotak.fill("rahasia-baru-123");
	await h.page.locator('.modal.show input[data-fieldname="logout_all_sessions"]').last().check().catch(() => {});
	await tidur(800);
}

async function menuJudul(h) {
	await h.page.locator(".body-sidebar .sidebar-header").first().click();
	await tidur(900);
}

// A product the Missing Data report lists under `cek` (a row object with doctype/nama).
async function kurang(h, cek) {
	const company = await h.page.evaluate(() => frappe.defaults.get_default("company"));
	const rows = await h.dataLaporan("Missing Data", { company });
	return rows.find((r) => r.cek === cek);
}

async function cetak(h, doctype, nama, format) {
	await h.page.route("**/api/method/erpnext.controllers.accounts_controller.get_missing_company_details*", (r) =>
		r.fulfill({ contentType: "application/json", body: '{"message": null}' })
	);
	await h.ke(`/desk/print/${encodeURIComponent(doctype)}/${encodeURIComponent(nama)}?format=${encodeURIComponent(format)}`);
	await h.page.waitForSelector(".print-format, iframe", { timeout: 30000 }).catch(() => {});
	await tidur(2500);
}

// --- recipes --------------------------------------------------------------------------------------------------------
// id → { ke(h), crop: CSS selector, bahasa: "en", lebar: px, keluar: true (logged out) }
const WO_JALAN = (h) => h.satu("Work Order", { status: "In Process", docstatus: 1, production_item: ["like", "CTH-%"] });
// A submitted, open Sales Order with a Seal Cap line (a child-table filter on the parent's list).
const SO_SEAL = (h) =>
	h.satu("Sales Order", [
		["Sales Order", "docstatus", "=", 1],
		["Sales Order", "status", "not in", ["Closed", "Completed"]],
		["Sales Order Item", "item_code", "like", "SEAL-CAP-%"],
	]);

const RESEP = {
	"op-01-login": { keluar: true, bahasa: "en", crop: ".page-card, .login-content, form.form-signin" },
	"op-02-login-versi": { keluar: true, crop: ".erp-versi" },
	"op-03-layar-aplikasi": {},
	"op-04-ganti-bahasa": { bahasa: "en", ke: menuJudul, area: { x: 0, y: 0, width: 520, height: 420 } },
	"op-05-pengaturan-profil": { ke: pengaturan, crop: ".modal.show .modal-dialog" },
	"op-06-ubah-sandi": { ke: ubahSandi, crop: ".modal.show .modal-dialog >> nth=-1" },
	"op-07-menu-kiri": { area: { x: 0, y: 0, width: 224, height: 480 } },
	"op-08-beranda-produksi": {},
	"op-09-kapasitas-lihat": { ke: async (h) => h.form("Machine Capacity", await h.satu("Machine Capacity", { item: "SEAL-CAP", workstation: "Mesin 04" })) },
	"op-10-lantai-produksi": { ke: lantai },
	"op-11-bar-atas": { ke: lantai, crop: ".lantai-host .bar" },
	"op-12-kartu-angka": { ke: lantai, crop: ".lantai-host .atas" },
	"op-13-tabel-mesin": { ke: lantai, crop: ".lantai-host .tabel" },
	"op-14-perlu-perhatian": { ke: lantai, crop: ".lantai-host .perhatian" },
	"op-15-warna-lampu": {
		ke: async (h) => {
			await lantai(h);
			h.statusLama = ["Mesin 05", "Problem"];
		},
	},
	"op-16-panel-status": { ke: async (h) => { await lantai(h); await pilihMesin(h, "Mesin 02"); }, crop: ".lantai-host .panel" },
	"op-17-status-masalah": {
		ke: async (h) => {
			await lantai(h);
			h.statusLama = ["Mesin 05", "Problem"];
			h.setelahStatus = () => pilihMesin(h, "Mesin 05");
		},
	},
	"op-18-mesin-tidak-aktif": {
		ke: async (h) => {
			await lantai(h);
			await pilihMesin(h, "Mesin 01");
			await h.page.locator('.lantai-host .panel button[data-status="Production"]').click();
			await tidur(2500);
		},
		crop: ".lantai-host .panel",
	},
	"op-19-tombol-kamera": { ke: lantai, crop: ".lantai-host .kamera" },
	"op-20-input-harian": { ke: inputHarian },
	"op-21-kepala-kotak": { ke: inputHarian, crop: "section[data-wo]" },
	"op-22-minggu-filter": { ke: inputHarian, crop: ".erp-ih-alat, .erp-ih-kepala" },
	"op-23-teknisi": { ke: inputHarian, crop: ".erp-ih-info" },
	"op-24-ketik-angka": {
		ke: async (h) => {
			await inputHarian(h);
			const sel = selHariIni(h);
			await sel.click();
			await sel.fill("1.250");
			h.kembalikan = () => sel.evaluate((e) => { e.value = e.dataset.awal; }).catch(() => {});
		},
		crop: "section[data-wo]:has(input:focus)",
	},
	"op-25-total-naik": {
		ke: async (h) => {
			h.sejak = await h.page.evaluate(() => frappe.datetime.now_datetime());
			await inputHarian(h);
			const sel = selHariIni(h);
			await sel.click();
			await sel.fill("1.250");
			await h.page.keyboard.press("Tab");
			await tidur(4000);
			h.bersih = () => batalkanHasilBaru(h, h.sejak);
		},
		crop: "section[data-wo]:has(input:focus)",
	},
	"op-26-keterangan": {
		ke: async (h) => {
			await inputHarian(h);
			const ket = h.page.locator("section[data-wo] input.erp-ih-teks").first();
			await ket.click();
			await ket.fill("Ganti cetakan jam 10");
			h.kembalikan = () => ket.evaluate((e) => { e.value = e.dataset.awal; }).catch(() => {});
		},
		crop: "section[data-wo]:has(input:focus)",
	},
	"op-27-tambah-tanggal": {
		ke: async (h) => {
			await inputHarian(h);
			await h.page.locator(".erp-ih-tambah button").first().click();
			await tidur(800);
			await h.page.locator(".erp-ih-tambah input").first().click().catch(() => {});
			await tidur(800);
		},
	},
	"op-28-ganti-angka": {
		ke: async (h) => {
			await inputHarian(h);
			const sel = h.page.locator("section[data-wo] input.erp-ih-sel:not(.erp-ih-teks)");
			const n = await sel.count();
			let pakai = null;
			for (let i = 0; i < n && !pakai; i++) if ((await sel.nth(i).inputValue()).trim() && (await sel.nth(i).inputValue()).trim() !== "0") pakai = sel.nth(i);
			if (!pakai) throw new Error("no filled cell");
			await pakai.click();
			await pakai.fill("1.300");
			h.kembalikan = () => pakai.evaluate((e) => { e.value = e.dataset.awal; }).catch(() => {});
		},
		crop: "section[data-wo]:has(input:focus)",
	},
	"op-29-angka-garis-bawah": {
		ke: async (h) => {
			await inputHarian(h);
			let ada = await h.page.locator("a.erp-ih-tautan").count();
			if (!ada) {
				await h.page.getByRole("button", { name: /Minggu lalu|Previous week/ }).click().catch(() => h.page.locator(".erp-ih-alat button").first().click());
				await tidur(3000);
			}
			await h.page.locator("a.erp-ih-tautan").first().scrollIntoViewIfNeeded();
		},
		crop: "section[data-wo]:has(a.erp-ih-tautan)",
	},
	"op-30-pesan-tolak": {
		ke: async (h) => {
			await inputHarian(h);
			const sel = selHariIni(h);
			await sel.click();
			await sel.fill("12,5");
			await h.page.keyboard.press("Tab");
			await h.page.waitForSelector(".erp-ih-galat:not(:empty)", { timeout: 15000 });
			await sel.focus();
			await tidur(800);
			h.kembalikan = () => sel.evaluate((e) => { e.value = e.dataset.awal; }).catch(() => {});
		},
		crop: "section[data-wo]:has(.erp-ih-galat:not(:empty))",
	},
	"op-31-hasil-produksi-daftar": {},
	"op-32-form-hasil-atas": {
		ke: async (h) => {
			const wo = await WO_JALAN(h);
			await h.baru("Production Entry", { work_order: wo, shift: "Shift 1" });
			await h.nilai({ hours: 12 });
		},
	},
	"op-33-tabel-reject": {
		ke: async (h) => {
			const wo = await WO_JALAN(h);
			await h.baru("Production Entry", { work_order: wo, shift: "Shift 1", good_qty: 1200 }, "rejects", [{ reason: "Short Shot", qty: 35 }]);
			await h.page.locator('[data-fieldname="rejects"] .grid-row').first().scrollIntoViewIfNeeded();
			const kotak = h.page.locator('[data-fieldname="rejects"] .grid-body .grid-row').nth(1).locator('[data-fieldname="reason"]');
			await h.page.evaluate(() => cur_frm.add_child("rejects") && cur_frm.refresh_field("rejects"));
			await tidur(600);
			await kotak.click().catch(() => {});
			await tidur(600);
			await h.page.locator('[data-fieldname="rejects"] .grid-row').nth(2).locator('input[data-fieldname="reason"]').click().catch(() => {});
			await tidur(1500);
		},
		crop: '.form-section:has([data-fieldname="rejects"])',
	},
	"op-34-hasil-terkirim": {
		ke: async (h) => h.form("Production Entry", await h.satu("Production Entry", { docstatus: 1, reject_qty: [">", 0] })),
	},
	"op-35-batalkan": {
		ke: async (h) => {
			await h.form("Production Entry", await h.satu("Production Entry", { docstatus: 1, reject_qty: [">", 0] }));
			await garis(h, ".page-actions .primary-action:visible, .page-actions button:visible >> text=/Batalkan|Cancel/");
		},
	},
	"op-36-amendemen": {
		ke: async (h) => {
			const nama = await h.satu("Production Entry", { docstatus: 2 });
			if (!nama) throw new Error("no cancelled Production Entry");
			await h.form("Production Entry", nama);
		},
	},
	"op-37-cetak-excel": { ke: inputHarian, crop: ".erp-ih-alat" },
	"op-38-halaman-cetak": {
		ke: async (h) => {
			await inputHarian(h);
			const [jendela] = await Promise.all([
				h.page.context().waitForEvent("page", { timeout: 30000 }),
				h.page.locator("button").filter({ hasText: /^\s*(Cetak|Print)\s*$/ }).first().click(),
			]);
			await jendela.evaluate(() => { window.print = () => {}; }).catch(() => {});
			await jendela.waitForLoadState("load").catch(() => {});
			await tidur(2500);
			h.halaman = jendela;
		},
	},
	"op-39-rva-filter": { ke: (h) => h.laporan("Plan vs Actual"), crop: ".page-form" },
	"op-40-rva-warna": { ke: (h) => h.laporan("Plan vs Actual"), crop: ".report-wrapper, .datatable" },
	"op-41-perintah-produksi": { ke: async (h) => h.form("Work Order", await WO_JALAN(h)) },
	"op-42-catat-hasil": {
		ke: async (h) => {
			await h.form("Work Order", await WO_JALAN(h));
			await garis(h, ".page-actions button:visible >> text=/Catat Hasil|Record Output/");
		},
		crop: ".page-head:visible",
	},
	"op-43-ponsel-input": { lebar: 390, ke: inputHarian },

	"adm-01-login": { keluar: true, crop: ".page-card, .login-content, form.form-signin" },
	"adm-02-ganti-bahasa": { bahasa: "en", ke: menuJudul, area: { x: 0, y: 0, width: 520, height: 420 } },
	"adm-03-ubah-sandi": { ke: ubahSandi },
	"adm-04-menu-kiri": { area: { x: 0, y: 0, width: 224, height: 740 } },
	"adm-05-beranda-stok": {},
	"adm-06-beranda-pengaturan": {},
	"adm-07-pengguna-baru": {
		ke: async (h) => {
			await h.baru("User", { email: "budi@example.com", first_name: "Budi", role_profile_name: "Produksi" });
			await h.nilai({ new_password: "sandi-budi-123" }).catch(() => {});
		},
	},
	"adm-08-profil-modul": {
		ke: async (h) => {
			await h.form("User", h.akun["user@example.com"]);
			await h.page.locator('[data-fieldname="module_profile"]').first().scrollIntoViewIfNeeded().catch(() => {});
			await tidur(800);
		},
	},
	"adm-09-sandi-diaktifkan": {
		ke: async (h) => {
			await h.form("User", h.akun["user@example.com"]);
			await kartuPengaturan(h);
		},
	},
	"adm-10-tolak-peran": {
		ke: async (h) => {
			await h.form("User", h.akun["user@example.com"]);
			await h.page.evaluate(async () => {
				if (cur_frm.fields_dict.role_profiles) {
					cur_frm.add_child("role_profiles", { role_profile: "Super Admin" });
					cur_frm.refresh_field("role_profiles");
				} else await cur_frm.set_value("role_profile_name", "Super Admin");
				cur_frm.save().catch(() => {});
			});
			await h.page.waitForSelector(".modal.show .msgprint, .msgprint-dialog.show", { timeout: 15000 });
			await tidur(1200);
			h.bersih = () => h.page.evaluate(() => cur_frm.reload_doc()).catch(() => {});
		},
	},
	"adm-11-perusahaan": {},
	"adm-12-daftar-barang": {},
	"adm-13-template": { ke: async (h) => { await h.page.locator('[data-fieldname="attributes"]').first().scrollIntoViewIfNeeded().catch(() => {}); await tidur(800); } },
	"adm-14-varian": {},
	"adm-15-varian-seal-cap": {
		ke: async (h) => {
			await h.page.evaluate(() => erpnext.item.show_single_variant_dialog(cur_frm));
			await h.page.locator(".modal.show").first().waitFor({ timeout: 15000 });
			await tidur(1500);
		},
	},
	"adm-16-tabel-packing": {
		ke: async (h) => {
			const nama = (await h.satu("Item", { name: "SEAL-CAP-MHG-CKM" })) || (await h.satu("Item", { variant_of: "SEAL-CAP" }));
			await h.form("Item", nama);
			await h.page.locator('[data-fieldname="erp_kemasan"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
			await tidur(1000);
		},
	},
	"adm-17-barang-kemasan": {},
	"adm-18-pigmen-template": {},
	"adm-19-pigmen-baru": {
		ke: async (h) => {
			const r = await kurang(h, "pigmen");
			await h.page.evaluate(() => erpnext.item.show_single_variant_dialog(cur_frm));
			await h.page.locator(".modal.show").first().waitFor({ timeout: 15000 });
			await tidur(1000);
			if (r?.nama) await h.page.locator('.modal.show input[data-fieldname="Warna"], .modal.show [data-fieldname="Warna"] input').first().fill(String(r.nama)).catch(() => {});
			await tidur(1200);
		},
	},
	"adm-20-pigmen-catatan": {
		ke: async (h) => {
			const r = await kurang(h, "stok");
			const nama = r?.nama || (await h.satu("Item", { variant_of: "PIGMEN", disabled: 0 }));
			await h.form("Item", nama);
			await h.page.evaluate(() => { cur_frm.dirty(); return cur_frm.save(); });
			await tidur(3000);
		},
	},
	"adm-21-harga-barang": {
		ke: async (h) => {
			const daftar = await h.page.evaluate(() => frappe.db.get_single_value("Selling Settings", "selling_price_list"));
			await h.page.evaluate((d) => frappe.set_route("List", "Item Price", { price_list: d }), daftar);
			await h.tenang(2000);
		},
	},
	"adm-22-merek": {},
	"adm-23-catatan-barang": {
		ke: async (h) => {
			const r = (await kurang(h, "kemasan")) || (await kurang(h, "harga"));
			if (!r) throw new Error("Missing Data lists no product");
			await h.form("Item", r.nama);
			await tidur(1500);
		},
	},
	"adm-24-mesin": { ke: (h) => h.klikTeks(".form-tabs .nav-link", /^\s*(Rincian|Details)\s*$/) },
	"adm-25-mesin-nonaktif": { ke: (h) => h.klikTeks(".form-tabs .nav-link", /^\s*(Rincian|Details)\s*$/) },
	"adm-26-kapasitas": { ke: async (h) => h.form("Machine Capacity", await h.satu("Machine Capacity", { item: "SEAL-CAP", workstation: "Mesin 04" })) },
	"adm-27-hasil-hitungan": {
		ke: async (h) => {
			await h.form("Machine Capacity", await h.satu("Machine Capacity", { item: "SEAL-CAP", workstation: "Mesin 04" }));
			// The computed fields sit in a section further down (collapsed when the form opens).
			const kepala = h.page.locator(".section-head").filter({ hasText: /Hasil hitungan|Computed|Results/i }).first();
			if (await kepala.count()) {
				if (await kepala.evaluate((e) => e.classList.contains("collapsed"))) await kepala.click();
				await kepala.evaluate((e) => e.scrollIntoView({ block: "start" }));
			} else await h.page.locator('[data-fieldname="pcs_per_hour"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
			await tidur(1000);
		},
	},
	"adm-28-buat-bom": {
		ke: async (h) => {
			await h.form("Machine Capacity", await h.satu("Machine Capacity", { item: "SEAL-CAP", workstation: "Mesin 04" }));
			// The answer is a toast (show_alert) that leaves after a few seconds: shoot as soon as it shows.
			const [jawab] = await Promise.all([
				h.page.waitForResponse((r) => r.url().includes("buat_bom_kapasitas"), { timeout: 180000 }),
				h.page.locator(".page-actions button:visible").filter({ hasText: /Buat BOM|Make BOMs/ }).first().click(),
			]);
			if (!jawab.ok()) throw new Error(`Make BOMs answered ${jawab.status()}`);
			await tidur(700);
		},
	},
	"adm-29-isi-bom": {
		ke: async (h) => {
			const bom = await h.satu("BOM", { item: ["like", "SEAL-CAP-%"], is_default: 1, is_active: 1, docstatus: 1 });
			await h.form("BOM", bom);
			await h.page.locator('[data-fieldname="items"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
			await tidur(800);
		},
	},
	"adm-30-impor-kapasitas": {
		ke: async (h) => {
			const csv = join(tmpdir(), "kapasitas-seal-cap.csv");
			writeFileSync(csv, 'Kode Barang,Mesin,Cycle Time,Cavity,Berat,Runner,Bahan\nSEAL-CAP,Mesin 04,14,20,"0,88",0,BB-SEAL-CAP\nSEAL-CAP,Mesin 14,14,20,"0,88",0,BB-SEAL-CAP\n');
			const p = h.page;
			await p.waitForSelector(".list-row-container", { timeout: 30000 }).catch(() => {});
			await p.locator(".page-actions button:visible").filter({ hasText: /Impor dari Excel|Import from Excel/ }).first().click();
			await p.locator(".modal.show").first().waitFor({ state: "visible", timeout: 15000 });
			await tidur(800);
			await p.locator('.modal.show [data-fieldname="berkas"] button').first().click();
			const unggah = p.locator(".modal.show .btn-file-upload").filter({ hasText: /Perangkat Saya|My Device/ }).last();
			await unggah.waitFor({ state: "visible", timeout: 15000 });
			const [pemilih] = await Promise.all([p.waitForEvent("filechooser"), unggah.click()]);
			await pemilih.setFiles(csv);
			await tidur(1200);
			await p.locator(".modal.show .btn-modal-primary").last().click();
			await p.waitForFunction(() => document.querySelectorAll(".modal.show").length === 1, null, { timeout: 30000 }).catch(() => {});
			await tidur(1000);
			await p.locator(".modal.show .btn-modal-primary").first().click();
			await p.locator('.modal.show [data-fieldname="hasil"] table').first().waitFor({ state: "visible", timeout: 60000 });
			await tidur(1000);
		},
		crop: ".modal.show .modal-dialog",
	},
	"adm-31-alasan-reject": {},
	"adm-32-gudang": {},
	"adm-33-stok-awal-kepala": {
		ke: async (h) => {
			await h.baru("Stock Reconciliation", { posting_date: iso(), purpose: "Opening Stock" });
		},
	},
	"adm-34-stok-awal-item": {
		ke: async (h) => {
			const gudang = await h.satu("Warehouse", { warehouse_name: "Gudang Bahan Baku" });
			await h.baru("Stock Reconciliation", { purpose: "Opening Stock" }, "items", [
				{ item_code: "BB-SEAL-CAP", warehouse: gudang, qty: 500, valuation_rate: 13500 },
				{ item_code: "Karung", warehouse: gudang, qty: 200, valuation_rate: 3500 },
			]);
			await h.page.locator('[data-fieldname="items"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
			await tidur(800);
		},
	},
	"adm-35-saldo-stok": {
		ke: async (h) => h.laporan("Stock Balance", { warehouse: await h.satu("Warehouse", { warehouse_name: "Gudang Bahan Baku" }) }),
	},
	"adm-36-kartu-stok": { ke: (h) => h.laporan("Stock Ledger", { item_code: "BB-SEAL-CAP", from_date: iso(-60), to_date: iso() }) },
	"adm-37-stok-opname": {
		ke: async (h) => {
			const gudang = await h.satu("Warehouse", { warehouse_name: "Gudang Barang Jadi" });
			const item = (await h.page.evaluate((g) => frappe.db.get_list("Bin", { filters: { warehouse: g, actual_qty: [">", 0] }, fields: ["item_code", "actual_qty"], limit: 1 }), gudang))[0];
			await h.baru("Stock Reconciliation", { purpose: "Stock Reconciliation" }, "items", [
				{ item_code: item?.item_code || "CTH-GAYUNG", warehouse: gudang, qty: Math.max(0, (item?.actual_qty || 100) - 5) },
			]);
			await h.page.locator('[data-fieldname="items"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
			await tidur(800);
		},
	},
	"adm-38-beranda-pembelian": {},
	"adm-39-pemasok": { ke: (h) => h.baru("Supplier", { supplier_name: "PT Biji Plastik Nusantara", supplier_group: "Raw Material" }) },
	"adm-40-po-isi": {
		ke: async (h) => {
			const sup = await h.satu("Supplier", { disabled: 0, supplier_name: ["like", "PT Contoh%"] });
			const pig = await h.satu("Item", { variant_of: "PIGMEN", disabled: 0 });
			await h.baru("Purchase Order", { supplier: sup, schedule_date: iso(7) }, "items", [
				{ item_code: "BB-SEAL-CAP", qty: 500, rate: 13500 },
				{ item_code: pig, qty: 2, uom: "Kg", rate: 350000 },
			]);
		},
	},
	"adm-41-catatan-lampiran": {
		ke: async (h) => {
			const sup = await h.satu("Supplier", { disabled: 0, supplier_name: ["like", "PT Contoh%"] });
			await h.baru("Purchase Order", { supplier: sup, schedule_date: iso(7) }, "items", [{ item_code: "BB-SEAL-CAP", qty: 500, rate: 13500 }]);
			await h.simpan();
			await tidur(1500);
		},
	},
	"adm-42-lampirkan": {
		ke: async (h) => {
			const sup = await h.satu("Supplier", { disabled: 0, supplier_name: ["like", "PT Contoh%"] });
			await h.baru("Purchase Order", { supplier: sup, schedule_date: iso(7) }, "items", [{ item_code: "BB-SEAL-CAP", qty: 500, rate: 13500 }]);
			await h.simpan();
			await h.page.locator(".form-attachments .add-attachment-btn, .attachments-actions .add-attachment-btn, .add-attachment-btn").first().click();
			await h.page.locator(".modal.show").first().waitFor({ timeout: 15000 });
			await tidur(1500);
		},
	},
	"adm-43-cetak-po-beli": { ke: async (h) => cetak(h, "Purchase Order", await h.satu("Purchase Order", { docstatus: 1 }), "PO Samuel Beli") },
	"adm-44-penerimaan": {
		ke: async (h) => {
			await h.form("Purchase Receipt", await h.satu("Purchase Receipt", { docstatus: 1 }));
			await h.page.locator('[data-fieldname="items"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
			await tidur(800);
		},
	},
	"adm-45-faktur-beli": {
		ke: async (h) => {
			await h.form("Purchase Receipt", await h.satu("Purchase Receipt", { docstatus: 1 }));
			await h.page.evaluate(() => frappe.model.open_mapped_doc({ method: "erpnext.stock.doctype.purchase_receipt.purchase_receipt.make_purchase_invoice", frm: cur_frm }));
			await h.page.waitForFunction(() => cur_frm?.doctype === "Purchase Invoice", null, { timeout: 30000 });
			await tidur(1200);
			await h.nilai({ bill_no: "INV/BPN/2611/0042", bill_date: iso() });
			await h.page.locator('[data-fieldname="bill_no"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
			await tidur(800);
		},
	},
	"adm-46-pembayaran-beli": {
		ke: async (h) => {
			const sup = await h.satu("Supplier", { disabled: 0, supplier_name: ["like", "PT Contoh%"] });
			await h.baru("Payment Entry", { payment_type: "Pay", party_type: "Supplier", party: sup });
			await h.nilai({ paid_amount: 6750000 });
		},
	},
	"adm-47-beranda-penjualan": {},
	"adm-48-so-baru": {
		ke: async (h) => {
			await h.baru("Sales Order", { customer: "Toko Contoh Sejahtera", delivery_date: iso(14) }, "items", [{ item_code: "CTH-GAYUNG", qty: 500 }]);
		},
	},
	"adm-49-so-harga-nol": {
		ke: async (h) => {
			const r = await kurang(h, "harga");
			if (!r) throw new Error("no unpriced product");
			await h.baru("Sales Order", { customer: "Toko Contoh Sejahtera", delivery_date: iso(14) }, "items", [
				{ item_code: "CTH-GAYUNG", qty: 500 },
				{ item_code: r.nama, qty: 100 },
			]);
			await tidur(2000);
		},
	},
	"adm-50-so-seal-cap": {
		ke: async (h) => {
			const item = (await h.satu("Item", { name: "SEAL-CAP-MHG-CKM", disabled: 0 })) || (await h.satu("Item", { variant_of: "SEAL-CAP", disabled: 0 }));
			await h.baru("Sales Order", { customer: "PT. Empat Putra Pangestu", delivery_date: iso(14) }, "items", [{ item_code: item, qty: 20000, erp_mesin: "Mesin 04" }]);
			await tidur(2500);
			await h.page.locator('[data-fieldname="items"]').first().evaluate((e) => e.scrollIntoView({ block: "center" }));
			await tidur(800);
		},
		crop: '.frappe-control[data-fieldname="items"]',
	},
	"adm-51-perbarui-item": {
		ke: async (h) => {
			const so = await SO_SEAL(h);
			if (!so) throw new Error("no submitted Seal Cap Sales Order");
			await h.form("Sales Order", so);
			await h.klikTeks(".page-actions button:visible, .form-inner-toolbar button:visible", /Perbarui Item|Update Items/);
			await h.page.locator(".modal.show").first().waitFor({ timeout: 15000 });
			await tidur(1200);
			await h.page.evaluate(() => {
				const d = cur_dialog;
				const f = d.fields_dict.trans_items;
				f.df.data[0].rate = 20;
				f.grid.refresh();
			});
			await tidur(800);
			await h.page.locator(".modal.show .btn-modal-primary").last().click();
			await h.page.waitForSelector(".msgprint-dialog.show, .modal.show .msgprint", { timeout: 15000 });
			await tidur(1200);
		},
	},
	"adm-52-cetak-so": { ke: async (h) => cetak(h, "Sales Order", await SO_SEAL(h), "PO Samuel") },
	"adm-53-faktur-jual": { ke: async (h) => h.form("Sales Invoice", await h.satu("Sales Invoice", { docstatus: 1 })) },
	"adm-54-riwayat-penjualan": {},
	"adm-55-wo-dari-so": {
		ke: async (h) => {
			await h.form("Sales Order", await SO_SEAL(h));
			await h.page.evaluate(() => cur_frm.cscript.make_work_order());
			await h.page.locator(".modal.show").first().waitFor({ timeout: 20000 });
			await tidur(1500);
		},
	},
	"adm-56-wo-mesin": { ke: async (h) => h.form("Work Order", await h.satu("Work Order", { production_item: ["like", "SEAL-CAP-%"], docstatus: 1, erp_mesin: "Mesin 04" })) },
	"adm-57-wo-pilih-mesin": {
		ke: async (h) => {
			await h.baru("Work Order", { production_item: "CTH-GAYUNG" });
			await tidur(1500);
			await h.page.locator('input[data-fieldname="erp_mesin"]').first().click();
			await tidur(2000);
		},
	},
	"adm-58-wo-catatan": {
		ke: async (h) => {
			const r = await kurang(h, "kemasan");
			if (!r) throw new Error("no product without packing");
			let item = r.nama;
			const varian = await h.satu("Item", { variant_of: r.nama, disabled: 0 });
			if (varian) item = varian;
			await h.baru("Work Order", { production_item: item });
			await tidur(2500);
		},
	},
	"adm-59-lantai-produksi": {
		ke: async (h) => {
			await lantai(h);
			await h.page.locator(".lantai-host .perhatian li[data-mesin]").first().click();
			await tidur(2500);
		},
	},
	"adm-60-input-harian-admin": { ke: inputHarian },
	"adm-61-rencana-aktual": { ke: (h) => h.laporan("Plan vs Actual") },
	"adm-62-wo-status": {
		ke: async (h) => {
			await h.form("Work Order", await WO_JALAN(h));
			await h.page.locator(".page-actions .btn-group button, .inner-group-button button").filter({ hasText: /^\s*Status\s*$/ }).first().click();
			await tidur(1000);
		},
	},
	"adm-63-beranda-gudang": {},
	"adm-64-nota-penerimaan": {
		ke: async (h) => {
			const gudang = await h.satu("Warehouse", { warehouse_name: "Gudang Bahan Baku" });
			const pig = await h.satu("Item", { variant_of: "PIGMEN", disabled: 0 });
			await h.baru("Stock Entry", { stock_entry_type: "Material Receipt", to_warehouse: gudang }, "items", [
				{ item_code: "BB-SEAL-CAP", qty: 100 },
				{ item_code: pig, qty: 500 },
				{ item_code: "Plastik 35x50", qty: 100 },
				{ item_code: "Karung", qty: 50 },
			]);
		},
	},
	"adm-65-kartu-stok-masuk": {
		ke: async (h) => {
			const se = await h.satu("Stock Entry", { docstatus: 1, purpose: "Material Receipt" });
			await h.laporan("Stock Ledger", { voucher_no: se, from_date: iso(-90), to_date: iso() });
		},
	},
	"adm-66-transfer-barang": {
		ke: async (h) => {
			const dari = await h.satu("Warehouse", { warehouse_name: "Gudang Barang Jadi" });
			const ke = await h.satu("Warehouse", { warehouse_name: "Gudang Pluit" });
			await h.baru("Stock Entry", { stock_entry_type: "Material Transfer", from_warehouse: dari, to_warehouse: ke }, "items", [{ item_code: "CTH-GAYUNG", qty: 50 }]);
		},
	},
	"adm-67-surat-jalan": {
		ke: async (h) => {
			const pluit = await h.satu("Warehouse", { warehouse_name: "Gudang Pluit" });
			await h.baru("Delivery Note", { customer: "Toko Contoh Sejahtera", set_warehouse: pluit }, "items", [{ item_code: "CTH-EMBER-10L", qty: 5 }]);
		},
	},
	"adm-68-surat-jalan-ttd": {
		ke: async (h) => {
			const dn = await h.page.evaluate(async () => {
				const r = await frappe.db.get_list("Delivery Note", { filters: { docstatus: 1 }, fields: ["name"], order_by: "creation desc", limit: 20 });
				for (const { name } of r) {
					const n = await frappe.db.count("File", { filters: { attached_to_doctype: "Delivery Note", attached_to_name: name } });
					if (!n) return name;
				}
				return null;
			});
			if (!dn) throw new Error("every submitted Delivery Note has an attachment");
			await h.form("Delivery Note", dn);
		},
	},
	"adm-69-dokumen-tanpa-lampiran": { ke: (h) => h.laporan("Missing Documents") },
	"adm-70-catatan-biaya": {
		ke: async (h) => {
			await h.baru("Expense Entry", { posting_date: iso(), category: "Listrik", amount: 2500000, repeat: "Once" });
			await h.page.locator('select[data-fieldname="repeat"]').first().evaluate((e) => { e.size = e.options.length; e.style.height = "auto"; e.style.position = "relative"; e.style.zIndex = 5; }).catch(() => {});
			await tidur(800);
		},
	},
	"adm-71-gaji-operator": { ke: async (h) => h.form("Expense Entry", await h.satu("Expense Entry", { docstatus: 1, category: "Gaji Operator" })) },
	"adm-72-biaya-bulanan": { ke: (h) => h.laporan("Monthly Expenses") },
	"adm-73-data-belum-lengkap": { ke: (h) => h.laporan("Missing Data") },
	"adm-74-tautan-perbaiki": {
		ke: async (h) => {
			await h.laporan("Missing Data");
			await h.page.locator("a.erp-perbaiki").filter({ hasText: /Tambah harga jual|Add a selling price/ }).first().click();
			await h.page.waitForFunction(() => cur_frm?.doctype === "Item Price", null, { timeout: 20000 });
			await tidur(2000);
		},
	},
	"adm-75-siap-order": { ke: (h) => h.laporan("Order Readiness") },
	"adm-76-perkiraan": {
		ke: async (h) => {
			const bulan = new Date();
			bulan.setMonth(bulan.getMonth() + 1, 1);
			// A draft monthly forecast (deleted after the picture), then our "Fill from History" button.
			await h.baru("Sales Forecast", {
				from_date: lokal(bulan),
				frequency: "Monthly",
				demand_number: 1,
				parent_warehouse: await h.satu("Warehouse", { is_group: 1 }),
			});
			await h.page.evaluate(async () => {
				for (const item of ["CTH-GAYUNG", "CTH-EMBER-10L", "CTH-BASKOM-40"]) cur_frm.add_child("selected_items", { item_code: item });
				cur_frm.refresh_field("selected_items");
			});
			if (!(await h.simpan())) throw new Error("the Sales Forecast did not save");
			await h.klikTeks(".page-actions button:visible", /Isi dari Riwayat|Fill from History/);
			await h.page.locator(".modal.show .msgprint").first().waitFor({ timeout: 60000 });
			await tidur(1200);
		},
	},
	"adm-77-jadwal-induk": {
		ke: async (h) => {
			const mps = await h.satu("Master Production Schedule", {});
			if (mps) await h.form("Master Production Schedule", mps);
			else await h.baru("Master Production Schedule", {});
			await h.klikTeks(".form-tabs .nav-link", /Order Penjualan|Sales Order/).catch(() => {});
		},
	},
	"adm-78-mrp": {
		ke: async (h) => {
			const mps = await h.satu("Master Production Schedule", { docstatus: 1 });
			const gudang = await h.satu("Warehouse", { warehouse_name: "Gudang Barang Jadi" });
			await h.laporan("Material Requirements Planning Report", mps ? { mps, warehouse: gudang } : {});
		},
	},
	"adm-79-lama-produksi": {
		ke: async (h) => {
			await h.baru("Item Lead Time", { item_code: "CTH-GAYUNG" });
			await h.nilai({ "Capacity per Day": 5000 }).catch(() => {});
			await h.nilai({ "Buffer Time": 1 }).catch(() => {});
		},
	},
	"adm-80-beranda-sdm": {},
	"adm-81-karyawan-baru": {
		ke: async (h) => {
			await h.baru("Employee", { first_name: "Fajar", gender: "Male", date_of_birth: "1998-04-12", date_of_joining: iso() });
		},
	},
	"adm-82-kehadiran": {},
	"adm-83-hari-libur": {
		ke: async (h) => {
			const nama = (await h.satu("Holiday List", { name: ["like", `%${new Date().getFullYear()}%`] })) || (await h.satu("Holiday List", {}));
			await h.form("Holiday List", nama);
			await h.page.locator('[data-fieldname="holidays"]').first().evaluate((e) => e.scrollIntoView({ block: "start" })).catch(() => {});
			await tidur(800);
		},
	},
	"adm-84-pengajuan-cuti": {
		ke: async (h) => {
			const emp = await h.satu("Employee", { first_name: "Citra" });
			const jenis = (await h.satu("Leave Type", { name: ["like", "%Tahunan%"] })) || (await h.satu("Leave Type", {}));
			await h.baru("Leave Application", { employee: emp, leave_type: jenis, from_date: senin(1) });
			await h.page.evaluate(async (d) => {
				const t = new Date(d);
				t.setDate(t.getDate() + 1);
				await cur_frm.set_value("to_date", t.toISOString().slice(0, 10));
				await cur_frm.set_value("description", "Acara keluarga");
				await cur_frm.set_value("status", "Approved");
			}, senin(1));
			await tidur(2000);
		},
	},
	"adm-85-batalkan-amendemen": { ke: async (h) => h.form("Expense Entry", await h.satu("Expense Entry", { docstatus: 2 })) },
	"adm-86-sa-pengaturan": {},
	"adm-87-sa-pengaturan-stok": {},
	"adm-88-sa-selesai": {
		ke: async (h) => {
			await h.form("Work Order", await WO_JALAN(h));
			await garis(h, ".page-actions button:visible >> text=/^\\s*(Selesai|Finish)\\s*$/").catch(() => {});
		},
	},
	"adm-89-sa-sistem": {},
	"adm-90-sa-profil-peran": {
		ke: async (h) => {
			// The New User dialog (setup.TATA_FORM puts Role Profile in it), never saved.
			await h.page.evaluate(() => frappe.new_doc("User"));
			await h.page.locator(".modal.show").first().waitFor({ timeout: 15000 });
			await tidur(800);
			await h.page.locator('.modal.show input[data-fieldname="email"]').fill("contoh.baru@example.com").catch(() => {});
			await h.page.locator('.modal.show input[data-fieldname="first_name"]').fill("Contoh").catch(() => {});
			await h.page.locator('.modal.show [data-fieldname="role_profiles"] input, .modal.show input[data-fieldname="role_profile_name"]').first().click();
			await tidur(2000);
		},
	},
};

// --- run ------------------------------------------------------------------------------------------------------------
if (!SANDI) {
	console.error("Set ERP_SANDI to the sample users' password (SAMPLE_PASSWORD in the bench's .env).");
	process.exit(2);
}
mkdirSync(GAMBAR, { recursive: true });
const PILIH = process.argv.slice(2);
const pilihan = SHOTS.filter((s) => !PILIH.length || PILIH.some((p) => s.id === p || s.id.startsWith(p)));

const browser = await chromium.launch();
const gagal = [];
const bahasaAsli = {}; // user → language before the run
const akun = {}; // shot-list user → the account that logs in

async function masuk(context, user) {
	for (const u of [akun[user], user, NAMA_BARU[user]].filter(Boolean)) {
		const r = await context.request.post(`${URL}/api/method/login`, { form: { usr: u, pwd: SANDI } });
		if (r.ok()) {
			akun[user] = u;
			return u;
		}
	}
	throw new Error(`login as ${user} failed`);
}

for (const shot of pilihan) {
	const r = RESEP[shot.id] || {};
	const crop = Boolean(r.crop || r.area);
	const context = await browser.newContext({
		viewport: { width: r.lebar || 1440, height: r.lebar && r.lebar < 500 ? 844 : 900 },
		deviceScaleFactor: crop || (r.lebar && r.lebar < 500) ? 2 : 1,
	});
	const page = await context.newPage();
	page.on("dialog", (d) => (d.type() === "beforeunload" ? d.accept() : d.dismiss()).catch(() => {}));
	const jejak = [];
	const h = alat(page, jejak);
	h.akun = new Proxy({}, { get: (_, k) => akun[k] || k });
	try {
		const user = await masuk(context, shot.user);
		await page.goto(`${URL}/desk`);
		await h.tenang(800);
		if (!(user in bahasaAsli)) bahasaAsli[user] = await page.evaluate(() => frappe.boot.lang || "en");
		const mau = r.bahasa || "id";
		if ((await page.evaluate(() => frappe.boot.lang)) !== mau) {
			const g = await h.api("erp_internal.bahasa.ganti", { lang: mau });
			if (!g.ok) throw new Error(`language: ${g.e}`);
		}
		if (r.keluar) {
			await h.api("logout");
			await context.clearCookies();
		}
		await h.ke(shot.url);
		if (r.ke) await r.ke(h);
		const potret = async () => {
			const p = h.halaman || page;
			if (r.area) await p.screenshot({ path: join(GAMBAR, `${shot.id}.png`), clip: r.area });
			else if (crop && !h.halaman) {
				const loc = p.locator(r.crop).first();
				await loc.waitFor({ state: "visible", timeout: 15000 });
				const k = await loc.boundingBox();
				const v = p.viewportSize();
				const pad = 12;
				const x = Math.max(0, k.x - pad);
				const y = Math.max(0, k.y - pad);
				await p.screenshot({ path: join(GAMBAR, `${shot.id}.png`), clip: { x, y, width: Math.min(v.width - x, k.width + 2 * pad), height: Math.min(v.height - y, k.height + 2 * pad) } });
			} else await p.screenshot({ path: join(GAMBAR, `${shot.id}.png`) });
		};
		if (h.statusLama)
			await statusMesin(h, h.statusLama[0], h.statusLama[1], async () => {
				if (h.setelahStatus) await h.setelahStatus();
				await potret();
			});
		else await potret();
		console.log(`ok   ${shot.id}`);
	} catch (e) {
		// What the screen showed when it failed, for the next fix (outside the repo).
		await (h.halaman || page).screenshot({ path: join(tmpdir(), `manual-gagal-${shot.id}.png`) }).catch(() => {});
		gagal.push(`${shot.id}: ${String(e.message || e).split("\n")[0]}`);
		console.log(`fail ${shot.id}: ${String(e.message || e).split("\n")[0]}`);
	} finally {
		if (h.kembalikan) await h.kembalikan().catch(() => {});
		if (h.bersih) await h.bersih().catch(() => {});
		for (const [dt, nama] of jejak.reverse()) {
			const d = await h.api("frappe.client.delete", { doctype: dt, name: nama });
			if (!d.ok) gagal.push(`${shot.id}: could not delete ${dt} ${nama}: ${d.e}`);
		}
		await context.close();
	}
}

// Each user's language back as it was.
for (const [user, lang] of Object.entries(bahasaAsli)) {
	const context = await browser.newContext();
	const page = await context.newPage();
	try {
		await context.request.post(`${URL}/api/method/login`, { form: { usr: user, pwd: SANDI } });
		await page.goto(`${URL}/desk`);
		await page.waitForLoadState("networkidle");
		await page.evaluate((l) => frappe.xcall("erp_internal.bahasa.ganti", { lang: l }), lang);
	} catch (e) {
		gagal.push(`language of ${user} not restored: ${e.message}`);
	}
	await context.close();
}

await browser.close();
console.log(`manual_gambar: ${pilihan.length - gagal.filter((g) => !g.includes("delete") && !g.startsWith("language")).length}/${pilihan.length} pictures in ${GAMBAR}`);
if (gagal.length) {
	console.error(gagal.join("\n"));
	process.exit(1);
}
