// Daily Input (page `daily-input`; spec 2026-11-23 section 4): Samuel's weekly sheet, one block per Work Order with
// a row per date and a cell per shift. Server: erp_internal/daily_input.py (get_data, save_cell, save_note).
// Plain fetch with the CSRF token, never frappe.call: a refusal shows under its cell, never in a dialog. Record text
// goes in through textContent only.
frappe.provide("erp.input_harian");

const API = "/api/method/";
const DAILY = "erp_internal.daily_input.";

// The text of a failed call: the server's message without its HTML (frappe.bold).
function pesanGalat(j, status) {
	let teks = "";
	try {
		teks = JSON.parse(j._server_messages || "[]")
			.map((m) => JSON.parse(m).message)
			.join(" ");
	} catch (e) {
		teks = "";
	}
	teks = new DOMParser().parseFromString(teks, "text/html").body.textContent.trim();
	return teks || __("Not saved (HTTP {0}).", [status]);
}

async function panggil(metode, params, tulis = false) {
	const isi = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v != null) isi.append(k, v);
	let r;
	try {
		r = tulis
			? await fetch(API + metode, {
					method: "POST",
					headers: {
						Accept: "application/json",
						"Content-Type": "application/x-www-form-urlencoded",
						"X-Frappe-CSRF-Token": frappe.csrf_token,
					},
					body: isi,
			  })
			: await fetch(`${API}${metode}?${isi}`, { headers: { Accept: "application/json" } });
	} catch (e) {
		throw new Error(__("No connection: try again."));
	}
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(pesanGalat(j, r.status));
	return j.message;
}

// 13384 → "13.384" (the locale's thousands dot); empty for no number.
const angka = (n) => (n == null ? "" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
const tgl = (iso) => frappe.datetime.str_to_user(iso);
const geser = (iso, hari) => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + hari);
	return d.toISOString().slice(0, 10);
};
const senin = (iso) => geser(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

function el(tag, kelas, teks) {
	const e = document.createElement(tag);
	if (kelas) e.className = kelas;
	if (teks != null) e.textContent = teks;
	return e;
}

erp.input_harian.pasang = function (wrapper) {
	const akar = el("div", "erp-ih");
	wrapper.page.body[0].appendChild(akar);
	const s = {
		senin: senin(frappe.datetime.get_today()),
		work_order: null,
		mesin: null, // the machine filter; null = all
		teknisi: null, // per shift, typed in the header and written on every entry the page makes
		data: null,
		nomor: 0,
		tambahan: {}, // work order → dates added with "+ Add date", shown until they hold a number
		mengganti: false,
	};
	let antri = Promise.resolve(); // one write at a time: each answer redraws its block

	async function muat() {
		const nomor = ++s.nomor;
		let data;
		try {
			data = await panggil(`${DAILY}get_data`, { dari: s.senin, work_order: s.work_order });
		} catch (e) {
			if (nomor === s.nomor) akar.replaceChildren(el("p", "erp-ih-catatan", __("The daily input could not be loaded.")));
			return;
		}
		if (nomor !== s.nomor) return;
		s.data = data;
		if (!s.teknisi) s.teknisi = Object.fromEntries(data.shift.map((x) => [x.nama, data.teknisi_terakhir[x.nama] || ""]));
		gambar();
	}

	function gambar() {
		const d = s.data;
		akar.replaceChildren(kepala(d));
		for (const b of d.blok) akar.appendChild(blokEl(b));
		if (!d.blok.length) akar.appendChild(el("p", "erp-ih-catatan", __("No open Work Orders.")));
		saring();
	}

	// Week, machine filter and the technicians (his sheet's three header rows).
	function kepala(d) {
		const k = el("div", "erp-ih-kepala");
		const alat = k.appendChild(el("div", "erp-ih-alat"));
		const tombol = (teks, label, aksi) => {
			const t = alat.appendChild(el("button", "btn btn-default btn-sm", teks));
			t.type = "button";
			if (label) t.setAttribute("aria-label", label);
			t.addEventListener("click", aksi);
			return t;
		};
		const pindah = (hari) => () => {
			s.senin = hari == null ? senin(frappe.datetime.get_today()) : geser(s.senin, hari);
			muat();
		};
		tombol("‹", __("Previous week"), pindah(-7));
		tombol(__("This week"), null, pindah(null));
		tombol("›", __("Next week"), pindah(7));
		const pilih = alat.appendChild(el("select", "form-control input-sm erp-ih-mesin"));
		pilih.setAttribute("aria-label", __("Machine"));
		pilih.appendChild(el("option", null, __("All machines"))).value = "";
		for (const m of [...new Set(d.blok.map((b) => b.mesin || ""))]) {
			pilih.appendChild(el("option", null, m || __("No machine"))).value = m || "-";
		}
		pilih.value = s.mesin ?? "";
		pilih.addEventListener("change", () => {
			s.mesin = pilih.value || null;
			saring();
		});
		if (s.work_order) {
			alat.appendChild(el("span", "erp-ih-wo", __("Work Order {0}", [s.work_order])));
			tombol(__("Show all"), null, () => {
				s.work_order = null;
				muat();
			});
		}
		// The shown week's blocks, in Samuel's layout (the server reads the same data as this page).
		tombol(__("Print"), null, () => cetak(d.dari, d.sampai));
		tombol(__("Excel"), null, () => unduh(d.dari, d.sampai));

		const info = k.appendChild(el("div", "erp-ih-info"));
		const baris = (label, isi) => {
			info.appendChild(el("span", "erp-ih-label", label));
			info.appendChild(el("span", null, ":"));
			const v = info.appendChild(el("span", "erp-ih-nilai"));
			v.append(...isi);
		};
		baris(__("Tanggal"), [`${tgl(d.dari)} - ${tgl(d.sampai)}`]);
		d.shift.forEach((x, i) => {
			const label = [__("Teknisi Pagi"), __("Teknisi Malam")][i] || __(x.nama);
			const minggu = (d.teknisi[x.nama] || []).join(", ");
			const isi = [];
			if (d.boleh_isi) {
				const inp = el("input", "form-control input-sm erp-ih-teknisi");
				inp.type = "text";
				inp.value = s.teknisi[x.nama] || "";
				inp.setAttribute("aria-label", label);
				inp.addEventListener("input", () => (s.teknisi[x.nama] = inp.value.trim()));
				isi.push(inp, el("span", "erp-ih-redup", `(${__(x.nama)})`));
				if (minggu) isi.push(el("span", "erp-ih-redup", __("This week: {0}", [minggu])));
			} else {
				isi.push(el("span", null, minggu || "–"), el("span", "erp-ih-redup", `(${__(x.nama)})`));
			}
			baris(label, isi);
		});
		return k;
	}

	const galatAlert = (e) => frappe.show_alert({ message: e.message, indicator: "red" });

	// Print: the server's page in a new window. The window opens first (inside the click) or the browser blocks
	// it as a pop-up.
	async function cetak(dari, sampai) {
		const w = window.open("", "_blank");
		if (!w) return galatAlert(new Error(__("Allow pop-ups for this site to print.")));
		try {
			const html = await panggil(`${DAILY}print_html`, { dari, sampai });
			w.document.write(html);
			w.document.close();
			w.focus();
			w.print();
		} catch (e) {
			w.close();
			galatAlert(e);
		}
	}

	// Excel: fetched as a file so a refusal shows here, not as a page of JSON.
	async function unduh(dari, sampai) {
		try {
			const r = await fetch(`${API}${DAILY}export_excel?${new URLSearchParams({ dari, sampai })}`);
			if (!r.ok) throw new Error(pesanGalat(await r.json().catch(() => ({})), r.status));
			const a = el("a");
			a.href = URL.createObjectURL(await r.blob());
			a.download = `input-harian-${dari}-${sampai}.xlsx`;
			a.click();
			URL.revokeObjectURL(a.href);
		} catch (e) {
			galatAlert(e instanceof TypeError ? new Error(__("No connection: try again.")) : e);
		}
	}

	function saring() {
		for (const b of akar.querySelectorAll("section[data-wo]"))
			b.hidden = s.mesin != null && (b.dataset.mesin || "-") !== s.mesin;
	}

	// The block's rows: the server's, plus dates added here that hold nothing yet.
	function barisBlok(b) {
		const ada = new Set(b.baris.map((r) => r.tanggal));
		const lain = [...(s.tambahan[b.work_order] || [])]
			.filter((t) => !ada.has(t))
			.map((t) => ({ tanggal: t, nilai: {}, kunci: {}, catatan: null }));
		return [...b.baris, ...lain].sort((x, y) => (x.tanggal < y.tanggal ? -1 : x.tanggal > y.tanggal ? 1 : 0));
	}

	function blokEl(b) {
		const shift = s.data.shift;
		const bisa = b.boleh_isi && !!b.mesin;
		const sek = el("section", "erp-ih-blok");
		sek.dataset.wo = b.work_order;
		sek.dataset.mesin = b.mesin || "";

		sek.appendChild(el("div", "erp-ih-po", `${__("No.Po.")} ${b.po_no}`));
		const ringkas = sek.appendChild(el("div", "erp-ih-ringkas"));
		ringkas.appendChild(el("span", null, `${__("PO")} : ${angka(b.qty)} ${b.uom}`));
		if (b.kemasan.length)
			ringkas.appendChild(
				el(
					"span",
					null,
					`${__("Packing")}: ${b.kemasan.map((k) => __("{0} of {1} {2}", [k.uom, angka(k.isi), b.uom])).join(" · ")}`
				)
			);
		const nama = [b.item_name, b.po_no !== b.work_order ? b.work_order : null].filter(Boolean).join(" · ");
		const a = ringkas.appendChild(el("a", "erp-ih-redup", nama));
		a.href = `/desk/work-order/${encodeURIComponent(b.work_order)}`;

		const kotak = sek.appendChild(el("div", "erp-ih-kotak"));
		const tabel = kotak.appendChild(el("table", "erp-ih-tabel"));
		const tr = tabel.appendChild(el("thead")).appendChild(el("tr"));
		tr.append(el("th", "erp-ih-no", __("No")), el("th", null, __("Tanggal")));
		tr.append(el("th", "erp-ih-mw", __("Merk")), el("th", "erp-ih-mw", __("Warna")));
		for (const x of shift) {
			const th = tr.appendChild(el("th", null, __(x.nama)));
			if (x.jam) th.appendChild(el("div", "erp-ih-jam", `(${x.jam})`));
		}
		tr.append(el("th", null, __("Keterangan")));
		tr.append(el("th", b.selesai ? "erp-ih-selesai" : "erp-ih-kosong", b.selesai ? __("CLOSE/DONE") : ""));

		const badan = tabel.appendChild(el("tbody"));
		const rows = barisBlok(b);
		rows.forEach((r, i) => {
			const tr = badan.appendChild(el("tr"));
			tr.append(el("td", "erp-ih-no", String(i + 1)), el("td", "erp-ih-tgl", tgl(r.tanggal)));
			tr.append(el("td", "erp-ih-mw", b.merk || ""), el("td", "erp-ih-mw", b.warna || ""));
			for (const x of shift) tr.appendChild(selEl(b, r, x.nama, bisa));
			const ket = tr.appendChild(el("td", "erp-ih-ket"));
			if (bisa) ket.appendChild(masukan(b, r.tanggal, null, r.catatan || "", __("Keterangan")));
			else ket.textContent = r.catatan || "";
			if (i === 0) {
				const m = tr.appendChild(el("td", "erp-ih-mesin-sel"));
				m.rowSpan = rows.length;
				if (b.mesin) m.textContent = b.mesin;
				else m.appendChild(el("span", "erp-ih-tanpa-mesin", __("No machine yet: Admin sets it on the Work Order.")));
			}
		});

		const kaki = tabel.appendChild(el("tfoot")).appendChild(el("tr"));
		const judul = kaki.appendChild(el("td", null, __("TOTAL")));
		judul.colSpan = 2;
		kaki.append(el("td", "erp-ih-mw"), el("td", "erp-ih-mw"));
		for (const x of shift) kaki.appendChild(el("td", "erp-ih-angka", angka(b.total[x.nama])));
		kaki.append(el("td", "erp-ih-angka erp-ih-semua", angka(b.total.semua)), el("td", "erp-ih-kosong"));

		if (rows.some((r) => Object.values(r.kunci).some(Boolean)))
			sek.appendChild(
				el(
					"p",
					"erp-ih-redup erp-ih-kecil",
					__("Underlined numbers were recorded in the Production Entry form: change them there.")
				)
			);
		if (bisa) sek.appendChild(tambahTanggal(b));
		return sek;
	}

	function selEl(b, r, shift, bisa) {
		const td = el("td", "erp-ih-angka");
		const nilai = r.nilai[shift];
		const kunci = r.kunci[shift];
		if (kunci) {
			// Not the grid's own cell (several entries, rejects, other hours): read only, changed in its form.
			// The number links to that Production Entry; the block's note says why (`blokEl`).
			const a = td.appendChild(el("a", "erp-ih-tautan", angka(nilai)));
			a.href = `/desk/production-entry/${encodeURIComponent(kunci)}`;
			a.title = __("Change it in the Production Entry form.");
		} else if (bisa) {
			td.appendChild(masukan(b, r.tanggal, shift, angka(nilai), `${tgl(r.tanggal)} ${__(shift)}`));
		} else {
			td.textContent = angka(nilai);
		}
		return td;
	}

	// One input: a shift's good pieces, or with `shift` null the row's Keterangan. Saved when focus leaves it.
	function masukan(b, tanggal, shift, nilai, label) {
		const inp = el("input", shift ? "erp-ih-sel" : "erp-ih-sel erp-ih-teks");
		inp.type = "text";
		inp.autocomplete = "off";
		if (shift) inp.inputMode = "numeric";
		inp.value = nilai;
		inp.dataset.awal = nilai;
		inp.dataset.key = `${tanggal}|${shift || ""}`;
		inp.setAttribute("aria-label", label);
		inp.addEventListener("blur", () => simpan(b.work_order, tanggal, shift, inp));
		return inp;
	}

	const cari = (wo, key) =>
		akar.querySelector(`section[data-wo="${CSS.escape(wo)}"] input[data-key="${CSS.escape(key)}"]`);

	function tandai(inp, teks) {
		if (!inp) return;
		let g = inp.parentNode.querySelector(".erp-ih-galat");
		if (teks && !g) {
			g = inp.parentNode.appendChild(el("div", "erp-ih-galat"));
			g.setAttribute("role", "alert");
		}
		if (g) g.textContent = teks || "";
		inp.setAttribute("aria-invalid", teks ? "true" : "false");
	}

	function simpan(wo, tanggal, shift, inp) {
		if (s.mengganti) return;
		const nilai = inp.value.trim();
		if (nilai === inp.dataset.awal || nilai === inp.dataset.kirim) return;
		inp.dataset.kirim = nilai;
		const key = inp.dataset.key;
		antri = antri.then(async () => {
			try {
				const blok = shift
					? await panggil(
							`${DAILY}save_cell`,
							{ work_order: wo, tanggal, shift, qty: nilai, teknisi: s.teknisi[shift] || null },
							true
					  )
					: await panggil(`${DAILY}save_note`, { work_order: wo, tanggal, catatan: nilai }, true);
				gantiBlok(blok, key, nilai);
			} catch (e) {
				// The typed number stays; the message sits under the cell.
				const kini = cari(wo, key);
				if (kini) delete kini.dataset.kirim;
				tandai(kini, e.message);
			}
		});
	}

	// Redraw one block from the server's answer. Numbers typed elsewhere in it and not saved yet stay, with their
	// message, and focus stays on the same cell.
	function gantiBlok(blok, keyDisimpan, nilaiDisimpan) {
		const i = s.data.blok.findIndex((b) => b.work_order === blok.work_order);
		const lama = akar.querySelector(`section[data-wo="${CSS.escape(blok.work_order)}"]`);
		if (i < 0 || !lama) return;
		s.data.blok[i] = blok;
		const aktif = lama.contains(document.activeElement) ? document.activeElement.dataset.key : null;
		const tetap = [...lama.querySelectorAll("input[data-key]")]
			.filter((x) => x.value.trim() !== x.dataset.awal)
			.filter((x) => !(x.dataset.key === keyDisimpan && x.value.trim() === nilaiDisimpan))
			.map((x) => ({
				key: x.dataset.key,
				nilai: x.value,
				kirim: x.dataset.kirim,
				galat: x.parentNode.querySelector(".erp-ih-galat")?.textContent,
			}));
		const baru = blokEl(blok);
		s.mengganti = true;
		try {
			lama.replaceWith(baru);
		} finally {
			s.mengganti = false;
		}
		saring();
		for (const t of tetap) {
			const x = cari(blok.work_order, t.key);
			if (!x) continue;
			x.value = t.nilai;
			if (t.kirim) x.dataset.kirim = t.kirim;
			if (t.galat) tandai(x, t.galat);
		}
		if (aktif) cari(blok.work_order, aktif)?.focus();
	}

	// "+ Add date": a past date from the order's creation to today, as an empty row.
	function tambahTanggal(b) {
		const bar = el("div", "erp-ih-tambah");
		const t = bar.appendChild(el("button", "btn btn-default btn-xs", __("+ Add date")));
		t.type = "button";
		const pilih = el("input", "form-control input-sm");
		pilih.type = "date";
		pilih.hidden = true;
		pilih.setAttribute("aria-label", __("Add date"));
		bar.appendChild(pilih);
		const galat = bar.appendChild(el("span", "erp-ih-galat"));
		galat.setAttribute("role", "alert");
		const hari_ini = frappe.datetime.get_today();
		t.addEventListener("click", () => {
			pilih.min = b.dibuat;
			pilih.max = hari_ini;
			pilih.hidden = false;
			pilih.focus();
			pilih.showPicker?.();
		});
		pilih.addEventListener("change", () => {
			const v = pilih.value;
			if (!v) return;
			if (v > hari_ini || (pilih.min && v < pilih.min)) {
				galat.textContent = __("Pick a date from {0} to {1}.", [tgl(pilih.min || v), tgl(hari_ini)]);
				return;
			}
			(s.tambahan[b.work_order] ||= new Set()).add(v);
			const blok = s.data.blok.find((x) => x.work_order === b.work_order);
			gantiBlok(blok, null, null);
			cari(b.work_order, `${v}|${s.data.shift[0].nama}`)?.focus();
		});
		return bar;
	}

	// Enter moves to the next cell like Tab (leaving the cell saves it); on the last one it just leaves.
	akar.addEventListener("keydown", (e) => {
		if (e.key !== "Enter" || !e.target.matches("input[data-key], .erp-ih-teknisi")) return;
		e.preventDefault();
		const semua = [...akar.querySelectorAll("input[data-key]")].filter((x) => x.offsetParent);
		const lanjut = semua[semua.indexOf(e.target) + 1];
		if (lanjut) {
			lanjut.focus();
			lanjut.select();
		} else e.target.blur();
	});

	return {
		buka(work_order) {
			s.work_order = work_order;
			muat();
		},
	};
};
