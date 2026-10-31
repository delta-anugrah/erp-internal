// The injection moulding machines on the floor: geometry built once, merged per material and drawn as one
// InstancedMesh per part for every machine, so the whole fleet costs a handful of draw calls. Brand tint and dimming
// are per-instance colour, the tonnage length is per-instance scale, and the moving platen is its own InstancedMesh
// (a mould cycle rewrites one matrix per machine). Nothing here allocates per frame.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BARIS, posisi, posisiSisa } from "./denah.js";

// Instances reserved per part: the 14 slots plus a spare row and a half for duplicate or unknown numbers.
const MAKS = 28;

// Body tint per brand (the machine's `merek`); anything else is neutral grey.
const WARNA_MEREK = { JSW: 0x2f68b4, NISSEI: 0x3f9470, CHENDE: 0xe0802a };
const WARNA_LAIN = 0x8d969f;

// Andon segments, top to bottom.
const SEGMEN = ["merah", "kuning", "hijau", "biru"];
const WARNA_SEGMEN = [0xff3b30, 0xffc21a, 0x22d36b, 0x3d8bff];
const REDUP_SEGMEN = 0.16; // an unlit segment's share of its colour

// Status → look (the spec's table). `lampu` is the lit segment (-1 = none), `denyut` the pulse in Hz (lamp and
// ring), `kedip` a hard on/off blink at that rate instead of a soft pulse (the lamp snaps, the ring eases), `nadi` a slow breath of the floor ring alone in Hz, `redup` the body brightness, `layar` the control
// screen's brightness, `gerak` whether the moving platen cycles. Production (lit screen, breathing green ring) and
// Idle (dim body, dark screen, still yellow ring) must read apart at a glance (Abel, 2026-10-29).
const GAYA = {
	Production: { lampu: 2, denyut: 0, nadi: 0.4, redup: 1, layar: 1.3, gerak: true },
	Setup: { lampu: 1, denyut: 0.45, nadi: 0, redup: 1, layar: 0.7, gerak: false },
	Idle: { lampu: 1, denyut: 0, nadi: 0, redup: 0.78, layar: 0.2, gerak: false },
	Problem: { lampu: 0, denyut: 1.25, kedip: true, nadi: 0, redup: 1, layar: 0.7, gerak: false },
	Maintenance: { lampu: 3, denyut: 0, nadi: 0, redup: 0.6, layar: 0.3, gerak: false },
	Off: { lampu: -1, denyut: 0, nadi: 0, redup: 0.38, layar: 0.06, gerak: false },
};
// The breathing ring's brightness swings between this share and full.
const NADI_BAWAH = 0.45;
// A blinking lamp: lit this share of each period, else at KEDIP_MATI; its ring never drops below CINCIN_KEDIP.
const KEDIP_NYALA = 0.55;
const KEDIP_MATI = 0.05;
const CINCIN_KEDIP = 0.35;
const gaya = (status) => GAYA[status] || GAYA.Idle;
// The floor ring's colour when no segment is lit (Off): a dim grey.
const CINCIN_MATI = [0.3, 0.32, 0.35];

const SIKLUS = 5; // seconds per mould open/close
const LANGKAH = 0.38; // platen stroke, machine units
const LAJU = 8; // easing rate: x += (t − x)·(1 − e^(−dt·LAJU))

// Tonnage → length scale along the machine: 120 T is the shortest, 360 T the longest.
const panjang = (ton) => {
	const t = Number(ton) > 0 ? Math.min(Math.max((Number(ton) - 120) / 240, 0), 1) : 0.5;
	return 0.86 + 0.26 * t;
};

// A part in machine space (length along x, operator side +z), coloured per vertex so parts of one material can
// still differ (base darker than the guards, mould darker than the platen).
function bagian(geo, [x, y, z], warna) {
	geo.translate(x, y, z);
	const c = new THREE.Color(warna);
	const n = geo.attributes.position.count;
	const isi = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) isi.set([c.r, c.g, c.b], i * 3);
	geo.setAttribute("color", new THREE.BufferAttribute(isi, 3));
	return geo;
}
const kotak = (l, t, d) => new THREE.BoxGeometry(l, t, d);
// A cylinder lying along x; `rAtas` ends at −x.
const tabungX = (rAtas, rBawah, p, seg = 14) => new THREE.CylinderGeometry(rAtas, rBawah, p, seg).rotateZ(Math.PI / 2);
const tegak = (rAtas, rBawah, p, seg = 12) => new THREE.CylinderGeometry(rAtas, rBawah, p, seg);

const BAJA = 0xa9b1ba;
const KROM = 0xd8dde2;
const GELAP = 0x363b42;
const CETAKAN = 0x6c7581;

// Andon: pole on the control cabinet, four segments above it.
const ANDON = { x: 0.2, z: 0.62, y0: 1.925, h: 0.08 };

function bentuk() {
	// Brand-tinted body: the long base, the clamp's rear housing, the injection carriage and drive, the cabinet.
	const tubuh = mergeGeometries([
		bagian(kotak(3.2, 0.72, 1.1), [0, 0.44, 0], 0xbdbdbd),
		bagian(kotak(0.5, 0.82, 0.92), [-1.33, 1.21, 0], 0xffffff),
		bagian(kotak(1.25, 0.32, 0.56), [0.82, 0.96, 0], 0xd0d0d0),
		bagian(kotak(0.52, 0.68, 0.66), [1.33, 1.24, 0], 0xffffff),
		bagian(kotak(0.42, 0.95, 0.14), [ANDON.x, 1.27, 0.62], 0xf2f2f2),
	]);
	// Steel and dark parts: fixed platen and mould half, four tie bars, barrel with heater bands, nozzle, hopper,
	// the kick strip at the floor, the andon pole and cap.
	const logam = [
		bagian(kotak(3.24, 0.08, 1.14), [0, 0.04, 0], GELAP),
		bagian(kotak(0.14, 0.92, 0.92), [-0.15, 1.25, 0], BAJA),
		bagian(kotak(0.12, 0.5, 0.56), [-0.27, 1.25, 0], CETAKAN),
		bagian(tabungX(0.075, 0.075, 1.01), [0.545, 1.2, 0], 0xc3c9cf),
		bagian(tabungX(0.03, 0.075, 0.12), [-0.02, 1.2, 0], KROM),
		bagian(tegak(0.045, 0.045, 0.14, 10), [0.9, 1.33, 0], BAJA),
		bagian(tegak(0.23, 0.07, 0.36, 4).rotateY(Math.PI / 4), [0.9, 1.58, 0], 0xc7ccd2),
		bagian(tegak(0.235, 0.235, 0.035, 4).rotateY(Math.PI / 4), [0.9, 1.775, 0], 0x8a929b),
		bagian(tegak(0.02, 0.02, 0.18, 8), [ANDON.x, 1.835, ANDON.z], GELAP),
		bagian(tegak(0.05, 0.06, 0.03), [ANDON.x, ANDON.y0 + 4 * ANDON.h + 0.015, ANDON.z], GELAP),
	];
	for (const y of [1.25 - 0.34, 1.25 + 0.34])
		for (const z of [-0.34, 0.34]) logam.push(bagian(tabungX(0.034, 0.034, 1.0, 10), [-0.58, y, z], KROM));
	for (const x of [0.16, 0.34, 0.52, 0.7]) logam.push(bagian(tabungX(0.09, 0.09, 0.07), [x, 1.2, 0], GELAP));
	// Moving platen with its mould half, drawn at the closed position.
	const pelat = mergeGeometries([
		bagian(kotak(0.14, 0.86, 0.86), [-0.52, 1.25, 0], BAJA),
		bagian(kotak(0.12, 0.5, 0.56), [-0.39, 1.25, 0], 0x7e8794),
	]);
	const layar = bagian(new THREE.PlaneGeometry(0.3, 0.2), [ANDON.x, 1.46, 0.692], 0xffffff);
	const lampu = new THREE.CylinderGeometry(0.058, 0.058, ANDON.h - 0.004, 16);
	const bayangan = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	// The status ring on the floor, an ellipse of unit size around the machine's footprint (scaled per machine).
	const cincin = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
	return { tubuh, logam: mergeGeometries(logam), pelat, layar, lampu, bayangan, cincin };
}

// A soft dark blob under each machine instead of shadow maps.
function teksturBayangan() {
	const k = document.createElement("canvas");
	k.width = k.height = 64;
	const c = k.getContext("2d");
	const g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
	g.addColorStop(0, "rgba(0,0,0,0.42)");
	g.addColorStop(1, "rgba(0,0,0,0)");
	c.fillStyle = g;
	c.fillRect(0, 0, 64, 64);
	return new THREE.CanvasTexture(k);
}

function instans(geo, bahan, kali = 1) {
	const m = new THREE.InstancedMesh(geo, bahan, MAKS * kali);
	m.count = 0;
	m.frustumCulled = false; // the fleet fills the view; skipping the sphere test also keeps a moving platen safe
	m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	// Created up front so the shader is compiled once with instance colours, before the first frame.
	m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAKS * kali * 3), 3);
	m.instanceColor.setUsage(THREE.DynamicDrawUsage);
	return m;
}

export function buatMesin(adegan) {
	const g = bentuk();
	const tekstur = teksturBayangan();
	const bahan = {
		tubuh: new THREE.MeshLambertMaterial({ vertexColors: true }),
		logam: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x555555 }),
		layar: new THREE.MeshBasicMaterial({ toneMapped: false }),
		lampu: new THREE.MeshBasicMaterial({ toneMapped: false }),
		bayangan: new THREE.MeshBasicMaterial({ map: tekstur, transparent: true, depthWrite: false }),
		cincin: new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false }),
	};
	const mesh = {
		bayangan: instans(g.bayangan, bahan.bayangan),
		cincin: instans(g.cincin, bahan.cincin),
		tubuh: instans(g.tubuh, bahan.tubuh),
		logam: instans(g.logam, bahan.logam),
		pelat: instans(g.pelat, bahan.logam),
		layar: instans(g.layar, bahan.layar),
		lampu: instans(g.lampu, bahan.lampu, SEGMEN.length),
	};
	mesh.bayangan.renderOrder = -1;
	mesh.cincin.renderOrder = 1; // after the blob and the decor's floor paint
	const grup = new THREE.Group();
	for (const m of Object.values(mesh)) grup.add(m);
	adegan.scene.add(grup);

	const warnaSegmen = WARNA_SEGMEN.map((h) => new THREE.Color(h));
	// Scratch objects, reused every frame.
	const m4 = new THREE.Matrix4();
	const geser = new THREE.Matrix4();
	const warna = new THREE.Color();
	const v = new THREE.Vector3();
	const q = new THREE.Quaternion();
	const satu = new THREE.Vector3(1, 1, 1);
	const SUMBU_Y = new THREE.Vector3(0, 1, 0);

	const skala = new THREE.Vector3();
	let keadaan = []; // one per drawn machine, instance order
	let susunanLama = null; // names and numbers of the last layout, to tell a status refresh from a new layout
	const lama = new Map(); // machine name → its state, kept across `tata` so a refresh does not flash
	let waktu = 0;
	let diam = false; // adaptive quality stopped the platens

	function warnaiTubuh(i, s) {
		warna.copy(s.merek).multiplyScalar(s.redup);
		mesh.tubuh.setColorAt(i, warna);
		warna.setScalar(s.redup);
		mesh.logam.setColorAt(i, warna);
		mesh.pelat.setColorAt(i, warna);
		warna.setRGB(0.55, 0.82, 1).multiplyScalar(s.layar);
		mesh.layar.setColorAt(i, warna);
	}

	function tempatkan(i, s) {
		mesh.tubuh.setMatrixAt(i, s.dasar);
		mesh.logam.setMatrixAt(i, s.dasar);
		mesh.pelat.setMatrixAt(i, s.dasar);
		mesh.layar.setMatrixAt(i, s.dasar);
		mesh.bayangan.setMatrixAt(i, m4.makeScale(3.9 * s.skala, 1, 1.9).setPosition(s.x, 0.006, s.z));
		mesh.cincin.setMatrixAt(i, m4.makeScale(1.85 * s.skala, 1, 1.25).setPosition(s.x, 0.03, s.z));
		q.setFromAxisAngle(SUMBU_Y, s.putar);
		for (let k = 0; k < SEGMEN.length; k++) {
			v.set(ANDON.x, ANDON.y0 + (SEGMEN.length - 1 - k + 0.5) * ANDON.h, ANDON.z).applyMatrix4(s.dasar);
			m4.compose(v, q, satu);
			mesh.lampu.setMatrixAt(i * SEGMEN.length + k, m4);
		}
	}

	// A machine's place, length and brand tint into its state, from its row and the slot `p` it got.
	function bentukKeadaan(s, row, p) {
		s.x = p.x;
		s.z = p.z;
		s.baris = p.baris;
		s.slot = p.baris < BARIS.length ? s.nomor : null;
		// Every row faces the default camera (+z), so each andon lamp and control screen is in view (Abel, 2026-10-29:
		// the front row used to turn round to the aisle and hid its lamps).
		s.putar = 0;
		s.skala = panjang(row?.tonase);
		s.merek.set(WARNA_MEREK[String(row?.merek || "").toUpperCase()] ?? WARNA_LAIN);
		// The platen's phase belongs to the machine: its number, and half a cycle more when it stands in the spare row.
		s.fase0 = ((s.nomor * 0.37) % 1) + (s.slot === null ? 0.5 : 0);
		v.set(p.x, 0, p.z);
		skala.set(s.skala, 1, 1);
		s.dasar.compose(v, q.setFromAxisAngle(SUMBU_Y, s.putar), skala);
		s.tanda = `${row?.tonase}|${row?.merek}`;
	}

	// Lays the machines out: each in its number's slot, a duplicate or an unknown number in the next spare spot.
	// When the machines and their numbers are the same as last time, only the rows that changed are touched.
	function tata(daftar) {
		const rows = (daftar || []).slice(0, MAKS); // more machines than instances: draw the first MAKS, never crash
		const susunan = rows.map((r) => `${r?.name}\u0000${Number(r?.nomor) || 0}`).join("\u0001");
		if (susunan === susunanLama) {
			let ubahBentuk = false;
			rows.forEach((row, i) => {
				const s = keadaan[i];
				const status = row?.status || "Idle";
				const tanda = `${row?.tonase}|${row?.merek}`;
				if (s.status === status && s.tanda === tanda) return;
				s.sentuh += 1;
				s.status = status; // tick() eases the lamp, body and platen to it
				if (s.tanda !== tanda) {
					bentukKeadaan(s, row, s);
					tempatkan(i, s);
					warnaiTubuh(i, s);
					ubahBentuk = true;
				}
			});
			if (ubahBentuk) {
				for (const m of Object.values(mesh)) {
					m.instanceMatrix.needsUpdate = true;
					m.instanceColor.needsUpdate = true;
					m.boundingSphere = null;
				}
				adegan.tandaiKotor();
			}
			return;
		}
		susunanLama = susunan;
		const terpakai = new Set();
		let sisa = 0;
		const baru = [];
		for (const row of rows) {
			const nomor = Number(row?.nomor) || 0;
			let p = posisi(nomor);
			if (!p || terpakai.has(nomor)) {
				p = posisiSisa(sisa);
				sisa += 1;
			} else terpakai.add(nomor);
			const nama = String(row?.name ?? "");
			let s = lama.get(nama);
			if (!s) {
				s = {
					nama,
					dasar: new THREE.Matrix4(),
					merek: new THREE.Color(),
					kini: new Float32Array(SEGMEN.length * 3),
					redup: 1,
					layar: 1,
					amp: 0,
					fase0: 0,
					fase: 0, // where the mould is in its cycle, 0..1 (the platen's, whether or not it moves)
					cin: new Float32Array(3), // the floor ring's current colour
					status: "Idle",
					sentuh: 0,
				};
				const awal = gaya(row?.status);
				s.redup = awal.redup;
				s.layar = awal.layar;
				for (let k = 0; k < SEGMEN.length; k++) {
					const f = k === awal.lampu ? 1 : REDUP_SEGMEN;
					s.kini.set([warnaSegmen[k].r * f, warnaSegmen[k].g * f, warnaSegmen[k].b * f], k * 3);
				}
				const mati = awal.lampu < 0;
				s.cin.set(mati ? CINCIN_MATI : [warnaSegmen[awal.lampu].r, warnaSegmen[awal.lampu].g, warnaSegmen[awal.lampu].b]);
				lama.set(nama, s);
			}
			s.sentuh += 1;
			s.nomor = nomor;
			s.status = row?.status || "Idle";
			bentukKeadaan(s, row, p);
			baru.push(s);
		}
		keadaan = baru;
		const hidup = new Set(baru.map((s) => s.nama));
		for (const k of [...lama.keys()]) if (!hidup.has(k)) lama.delete(k);
		keadaan.forEach((s, i) => {
			tempatkan(i, s);
			warnaiTubuh(i, s);
			for (let k = 0; k < SEGMEN.length; k++) {
				warna.fromArray(s.kini, k * 3);
				mesh.lampu.setColorAt(i * SEGMEN.length + k, warna);
			}
			mesh.cincin.setColorAt(i, warna.fromArray(s.cin));
		});
		for (const [nama, m] of Object.entries(mesh)) {
			m.count = keadaan.length * (nama === "lampu" ? SEGMEN.length : 1);
			m.instanceMatrix.needsUpdate = true;
			m.instanceColor.needsUpdate = true;
			m.boundingSphere = null; // raycasts recompute it for the new layout
		}
		// A slot marker shows only where no machine stands.
		for (const p of adegan.penanda.children) p.visible = !terpakai.has(p.userData.nomor);
		adegan.tandaiKotor();
	}

	function tick(dt) {
		waktu += dt;
		const k = 1 - Math.exp(-dt * LAJU);
		let ubahTubuh = false; // body colours (dimming), four buffers
		let ubahLampu = false; // andon colours only: a pulsing lamp uploads just this buffer
		let ubahPelat = false;
		let ubahCincin = false;
		const putaran = waktu / SIKLUS;
		for (let i = 0; i < keadaan.length; i++) {
			const s = keadaan[i];
			const g = gaya(s.status);
			if (s.redup !== g.redup || s.layar !== g.layar) {
				s.redup += (g.redup - s.redup) * k;
				if (Math.abs(g.redup - s.redup) < 0.002) s.redup = g.redup;
				s.layar += (g.layar - s.layar) * k;
				if (Math.abs(g.layar - s.layar) < 0.002) s.layar = g.layar;
				warnaiTubuh(i, s);
				ubahTubuh = true;
			}
			let nyala = 1;
			if (g.kedip) nyala = (g.denyut * waktu) % 1 < KEDIP_NYALA ? 1 : KEDIP_MATI;
			else if (g.denyut) nyala = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(2 * Math.PI * g.denyut * waktu));
			for (let j = 0; j < SEGMEN.length; j++) {
				const f = j === g.lampu ? nyala : REDUP_SEGMEN;
				const kj = g.kedip && j === g.lampu ? 1 : k; // a blink snaps; easing would blur it into a pulse
				const c = warnaSegmen[j];
				const o = j * 3;
				const a = s.kini;
				const d = Math.abs(c.r * f - a[o]) + Math.abs(c.g * f - a[o + 1]) + Math.abs(c.b * f - a[o + 2]);
				if (d < 0.003) continue;
				a[o] += (c.r * f - a[o]) * kj;
				a[o + 1] += (c.g * f - a[o + 1]) * kj;
				a[o + 2] += (c.b * f - a[o + 2]) * kj;
				warna.setRGB(a[o], a[o + 1], a[o + 2]);
				mesh.lampu.setColorAt(i * SEGMEN.length + j, warna);
				ubahLampu = true;
			}
			// The floor ring follows the lit lamp segment, pulsing with it or breathing on its own (Off: dim grey).
			const w = g.lampu >= 0 ? warnaSegmen[g.lampu] : null;
			const napas = g.nadi
				? NADI_BAWAH + (1 - NADI_BAWAH) * (0.5 + 0.5 * Math.sin(2 * Math.PI * g.nadi * waktu + s.fase0 * 6.283))
				: 1;
			const nyalaCincin = g.kedip ? Math.max(nyala, CINCIN_KEDIP) : nyala;
			const tr = w ? w.r * nyalaCincin * napas : CINCIN_MATI[0];
			const tg = w ? w.g * nyalaCincin * napas : CINCIN_MATI[1];
			const tb = w ? w.b * nyalaCincin * napas : CINCIN_MATI[2];
			const c = s.cin;
			if (Math.abs(tr - c[0]) + Math.abs(tg - c[1]) + Math.abs(tb - c[2]) >= 0.003) {
				c[0] += (tr - c[0]) * k;
				c[1] += (tg - c[1]) * k;
				c[2] += (tb - c[2]) * k;
				mesh.cincin.setColorAt(i, warna.fromArray(c));
				ubahCincin = true;
			}
			s.fase = (((putaran + s.fase0) % 1) + 1) % 1;
			const tujuan = g.gerak && !diam ? 1 : 0;
			if (s.amp === 0 && tujuan === 0) continue;
			s.amp += (tujuan - s.amp) * k;
			if (tujuan === 0 && s.amp < 0.002) s.amp = 0;
			const buka = 0.5 - 0.5 * Math.cos(2 * Math.PI * (putaran + s.fase0));
			geser.makeTranslation(-LANGKAH * buka * s.amp, 0, 0);
			mesh.pelat.setMatrixAt(i, m4.multiplyMatrices(s.dasar, geser));
			ubahPelat = true;
		}
		if (ubahTubuh) {
			mesh.tubuh.instanceColor.needsUpdate = true;
			mesh.logam.instanceColor.needsUpdate = true;
			mesh.pelat.instanceColor.needsUpdate = true;
			mesh.layar.instanceColor.needsUpdate = true;
		}
		if (ubahLampu) mesh.lampu.instanceColor.needsUpdate = true;
		if (ubahPelat) mesh.pelat.instanceMatrix.needsUpdate = true;
		if (ubahCincin) mesh.cincin.instanceColor.needsUpdate = true;
	}

	// The name of the machine under a ray (null when it hits none), for click selection. Names are unique,
	// numbers may not be.
	function pilihDari(raycaster) {
		const kena = raycaster.intersectObjects([mesh.tubuh, mesh.logam, mesh.pelat, mesh.layar], false)[0];
		return kena && kena.instanceId != null ? keadaan[kena.instanceId]?.nama ?? null : null;
	}

	return {
		tata,
		tick,
		// The drawn machines' states, instance order (read only: x, z, nama, nomor, status), for labels and flights.
		daftar: () => keadaan,
		pilihDari,
		// Adaptive quality: platens come to rest and stay there.
		diam() {
			diam = true;
		},
		// Debug state for tools/lantai.mjs.
		info() {
			return keadaan.map((s) => {
				const g = gaya(s.status);
				const j = g.lampu;
				return {
					nama: s.nama,
					nomor: s.nomor,
					status: s.status,
					slot: s.slot,
					x: s.x,
					z: s.z,
					lampu: j >= 0 ? SEGMEN[j] : null,
					warna: j >= 0 ? `#${warna.setRGB(s.kini[j * 3], s.kini[j * 3 + 1], s.kini[j * 3 + 2]).getHexString()}` : null,
					denyut: g.denyut,
					kedip: !!g.kedip,
					nadi: g.nadi,
					redup: s.redup,
					terang: s.layar, // the control screen's brightness (`layar` is the bundle's screen point)
					gerak: g.gerak,
					amp: s.amp,
					fase: s.fase,
					cincin: `#${warna.setRGB(s.cin[0], s.cin[1], s.cin[2]).getHexString()}`,
					sentuh: s.sentuh,
				};
			});
		},
		buang() {
			adegan.scene.remove(grup);
			for (const m of Object.values(mesh)) m.dispose();
			for (const x of Object.values(g)) x.dispose();
			for (const b of Object.values(bahan)) b.dispose();
			tekstur.dispose();
		},
	};
}
