// The injection moulding machines on the floor: geometry built once, merged per material and drawn as one
// InstancedMesh per part for every machine, so the whole fleet costs a handful of draw calls. Brand tint and dimming
// are per-instance colour, the tonnage length is per-instance scale, and the moving platen is its own InstancedMesh
// (a mould cycle rewrites one matrix per machine). Nothing here allocates per frame.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BARIS, posisi } from "./adegan.js";

// Instances reserved per part: the 14 slots plus a spare row and a half for duplicate or unknown numbers.
const MAKS = 28;
// Spare spots for a machine whose slot is taken or whose number has no slot: rows in front of row 2.
const SISA_PER_BARIS = 7;
const SISA_Z0 = 6.3;
const SISA_DZ = 2.6;

// Body tint per brand (the machine's `merek`); anything else is neutral grey.
const WARNA_MEREK = { JSW: 0x2f68b4, NISSEI: 0x3f9470, CHENDE: 0xe0802a };
const WARNA_LAIN = 0x8d969f;

// Andon segments, top to bottom.
const SEGMEN = ["merah", "kuning", "hijau", "biru"];
const WARNA_SEGMEN = [0xff3b30, 0xffc21a, 0x22d36b, 0x3d8bff];
const REDUP_SEGMEN = 0.16; // an unlit segment's share of its colour

// Status → look (the spec's table). `lampu` is the lit segment (-1 = none), `denyut` the pulse in Hz, `redup` the
// body brightness, `gerak` whether the moving platen cycles.
const GAYA = {
	Production: { lampu: 2, denyut: 0, redup: 1, gerak: true },
	Setup: { lampu: 1, denyut: 0.45, redup: 1, gerak: false },
	Idle: { lampu: 1, denyut: 0, redup: 1, gerak: false },
	Problem: { lampu: 0, denyut: 1, redup: 1, gerak: false },
	Maintenance: { lampu: 3, denyut: 0, redup: 0.6, gerak: false },
	Off: { lampu: -1, denyut: 0, redup: 0.38, gerak: false },
};
const gaya = (status) => GAYA[status] || GAYA.Idle;

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
	return { tubuh, logam: mergeGeometries(logam), pelat, layar, lampu, bayangan };
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
	};
	const mesh = {
		bayangan: instans(g.bayangan, bahan.bayangan),
		tubuh: instans(g.tubuh, bahan.tubuh),
		logam: instans(g.logam, bahan.logam),
		pelat: instans(g.pelat, bahan.logam),
		layar: instans(g.layar, bahan.layar),
		lampu: instans(g.lampu, bahan.lampu, SEGMEN.length),
	};
	mesh.bayangan.renderOrder = -1;
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

	let keadaan = []; // one per drawn machine, instance order
	const lama = new Map(); // machine name → its state, kept across `tata` so a refresh does not flash
	let waktu = 0;
	let diam = false; // adaptive quality stopped the platens

	function warnaiTubuh(i, s) {
		warna.copy(s.merek).multiplyScalar(s.redup);
		mesh.tubuh.setColorAt(i, warna);
		warna.setScalar(s.redup);
		mesh.logam.setColorAt(i, warna);
		mesh.pelat.setColorAt(i, warna);
		warna.setRGB(0.55, 0.82, 1).multiplyScalar(s.redup < 0.5 ? 0.06 : s.redup);
		mesh.layar.setColorAt(i, warna);
	}

	function tempatkan(i, s) {
		mesh.tubuh.setMatrixAt(i, s.dasar);
		mesh.logam.setMatrixAt(i, s.dasar);
		mesh.pelat.setMatrixAt(i, s.dasar);
		mesh.layar.setMatrixAt(i, s.dasar);
		mesh.bayangan.setMatrixAt(i, m4.makeScale(3.9 * s.skala, 1, 1.9).setPosition(s.x, 0.006, s.z));
		q.setFromAxisAngle(SUMBU_Y, s.putar);
		for (let k = 0; k < SEGMEN.length; k++) {
			v.set(ANDON.x, ANDON.y0 + (SEGMEN.length - 1 - k + 0.5) * ANDON.h, ANDON.z).applyMatrix4(s.dasar);
			m4.compose(v, q, satu);
			mesh.lampu.setMatrixAt(i * SEGMEN.length + k, m4);
		}
	}

	// Lays the machines out: each in its number's slot, a duplicate or an unknown number in the next spare spot.
	function tata(daftar) {
		const terpakai = new Set();
		let sisa = 0;
		const baru = [];
		for (const row of daftar || []) {
			if (baru.length >= MAKS) break; // more machines than instances: draw the first MAKS, never crash
			const nomor = Number(row?.nomor) || 0;
			let p = posisi(nomor);
			if (!p || terpakai.has(nomor)) {
				const b = Math.floor(sisa / SISA_PER_BARIS);
				const i = sisa % SISA_PER_BARIS;
				p = { x: (i - (SISA_PER_BARIS - 1) / 2) * 4.2, z: SISA_Z0 + b * SISA_DZ, baris: BARIS.length + b };
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
					amp: 0,
					fase: 0,
					status: "Idle",
				};
				const awal = gaya(row?.status);
				s.redup = awal.redup;
				for (let k = 0; k < SEGMEN.length; k++) {
					const f = k === awal.lampu ? 1 : REDUP_SEGMEN;
					s.kini.set([warnaSegmen[k].r * f, warnaSegmen[k].g * f, warnaSegmen[k].b * f], k * 3);
				}
				lama.set(nama, s);
			}
			s.nomor = nomor;
			s.status = row?.status || "Idle";
			s.x = p.x;
			s.z = p.z;
			s.baris = p.baris;
			s.slot = p.baris < BARIS.length ? nomor : null;
			// The front row and the spare rows turn round, so every control panel faces the aisle.
			s.putar = p.baris === 0 ? 0 : Math.PI;
			s.skala = panjang(row?.tonase);
			s.merek.set(WARNA_MEREK[String(row?.merek || "").toUpperCase()] ?? WARNA_LAIN);
			s.fase = ((nomor * 0.37) % 1) + (sisa ? 0.5 : 0);
			s.dasar.compose(new THREE.Vector3(p.x, 0, p.z), q.setFromAxisAngle(SUMBU_Y, s.putar), new THREE.Vector3(s.skala, 1, 1));
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

	function setel(kunci, status) {
		for (const s of keadaan) if (s.nomor === kunci || s.nama === kunci) s.status = status || "Idle";
	}

	function tick(dt) {
		waktu += dt;
		const k = 1 - Math.exp(-dt * LAJU);
		let ubahWarna = false;
		let ubahPelat = false;
		for (let i = 0; i < keadaan.length; i++) {
			const s = keadaan[i];
			const g = gaya(s.status);
			if (s.redup !== g.redup) {
				s.redup += (g.redup - s.redup) * k;
				if (Math.abs(g.redup - s.redup) < 0.002) s.redup = g.redup;
				warnaiTubuh(i, s);
				ubahWarna = true;
			}
			const nyala = g.denyut ? 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(2 * Math.PI * g.denyut * waktu)) : 1;
			for (let j = 0; j < SEGMEN.length; j++) {
				const f = j === g.lampu ? nyala : REDUP_SEGMEN;
				const c = warnaSegmen[j];
				const o = j * 3;
				const a = s.kini;
				const d = Math.abs(c.r * f - a[o]) + Math.abs(c.g * f - a[o + 1]) + Math.abs(c.b * f - a[o + 2]);
				if (d < 0.003) continue;
				a[o] += (c.r * f - a[o]) * k;
				a[o + 1] += (c.g * f - a[o + 1]) * k;
				a[o + 2] += (c.b * f - a[o + 2]) * k;
				warna.setRGB(a[o], a[o + 1], a[o + 2]);
				mesh.lampu.setColorAt(i * SEGMEN.length + j, warna);
				ubahWarna = true;
			}
			const tujuan = g.gerak && !diam ? 1 : 0;
			if (s.amp === 0 && tujuan === 0) continue;
			s.amp += (tujuan - s.amp) * k;
			if (tujuan === 0 && s.amp < 0.002) s.amp = 0;
			const buka = 0.5 - 0.5 * Math.cos(2 * Math.PI * (waktu / SIKLUS + s.fase));
			geser.makeTranslation(-LANGKAH * buka * s.amp, 0, 0);
			mesh.pelat.setMatrixAt(i, m4.multiplyMatrices(s.dasar, geser));
			ubahPelat = true;
		}
		if (ubahWarna) {
			mesh.tubuh.instanceColor.needsUpdate = true;
			mesh.logam.instanceColor.needsUpdate = true;
			mesh.pelat.instanceColor.needsUpdate = true;
			mesh.layar.instanceColor.needsUpdate = true;
			mesh.lampu.instanceColor.needsUpdate = true;
		}
		if (ubahPelat) mesh.pelat.instanceMatrix.needsUpdate = true;
	}

	// The machine number under a ray (null when it hits none), for click selection.
	function pilihDari(raycaster) {
		const kena = raycaster.intersectObjects([mesh.tubuh, mesh.logam, mesh.pelat, mesh.layar], false)[0];
		return kena && kena.instanceId != null ? keadaan[kena.instanceId]?.nomor ?? null : null;
	}

	return {
		tata,
		setel,
		tick,
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
					redup: s.redup,
					gerak: g.gerak,
					amp: s.amp,
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
