// The simulated life on the floor: an operator at each machine in Production or Setup, a technician (yellow helmet) at
// each one in Maintenance or Problem, a part dropped into the machine's bin once per mould cycle, and one forklift on
// the loop `JALUR`. None of it is data (the HUD says so); only the machine statuses decide who stands where.
// Figures, bins and parts are InstancedMeshes built once at load; a fixed pool of parts, one slot per machine; nothing
// is allocated per frame. Adaptive quality calls `henti()`: everything stands still for good.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { JALUR } from "./denah.js";
import { warnai } from "./bentuk.js";

const MAKS = 28; // as mesin.js: instances per part
const LAJU = 1.6; // forklift speed, m/s (a walking pace)
const BELOK = 5; // heading easing rate
const SIKLUS_TONG = 48; // parts per bin before it empties: 48 cycles of 5 s, about 4 minutes
const LAMA_JATUH = 0.8; // s a part takes to fall
const TINGGI_TONG = 0.44; // fill height at 100 %

// Places in a machine's own space (operator side +z, length along x).
const DI_MESIN = {
	orang: [0.9, 0, 1.3],
	tong: [-1.0, 0, 1.05],
	asal: [-0.3, 0.95, 0.5], // where a part leaves the mould
};
const TONG_ATAS = 0.42; // y where a falling part lands

const WARNA = {
	operator: { badan: 0x2f9e8f, helm: 0xf2f4f6 },
	teknisi: { badan: 0xe8742a, helm: 0xffd21a },
};

function bentukOrang() {
	const kaki = warnai(new THREE.CylinderGeometry(0.17, 0.17, 0.8, 10), [0, 0.4, 0], 0x2b2f36);
	const badan = warnai(new THREE.CylinderGeometry(0.2, 0.22, 0.6, 12), [0, 1.1, 0], 0xffffff);
	const kepala = warnai(new THREE.SphereGeometry(0.12, 10, 8), [0, 1.52, 0], 0xe0b393);
	const helm = warnai(new THREE.SphereGeometry(0.155, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), [0, 1.55, 0], 0xffffff);
	return { badan: mergeGeometries([kaki, badan]), kepala, helm };
}

function bentukGarpu() {
	const bagian = [
		warnai(new THREE.BoxGeometry(1.1, 0.7, 1.6), [0, 0.65, -0.2], 0xf0a020), // body
		warnai(new THREE.BoxGeometry(1.0, 0.5, 0.5), [0, 0.6, -1.15], 0x4a4f57), // counterweight
		warnai(new THREE.BoxGeometry(0.8, 0.12, 0.7), [0, 1.1, -0.2], 0x2b2f36), // seat
	];
	for (const x of [-0.5, 0.5]) {
		bagian.push(warnai(new THREE.BoxGeometry(0.06, 1.1, 0.06), [x, 1.65, -0.5], 0x4a4f57)); // rear posts
		bagian.push(warnai(new THREE.BoxGeometry(0.06, 1.3, 0.06), [x, 1.75, 0.25], 0x4a4f57)); // front posts
		bagian.push(warnai(new THREE.BoxGeometry(0.1, 1.5, 0.1), [x * 0.6, 1.15, 0.95], 0x2b2f36)); // mast
		bagian.push(warnai(new THREE.BoxGeometry(0.16, 0.05, 1.0), [x * 0.6, 0.12, 1.45], 0xb8bec6)); // fork
		for (const z of [-0.65, 0.35])
			bagian.push(warnai(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 14).rotateZ(Math.PI / 2), [x * 1.1, 0.28, z], 0x1c1f24)); // wheel
	}
	bagian.push(warnai(new THREE.BoxGeometry(1.2, 0.06, 0.95), [0, 2.4, -0.12], 0x4a4f57)); // roof
	bagian.push(warnai(new THREE.BoxGeometry(0.12, 0.12, 0.12), [0, 2.5, -0.12], 0xffc21a)); // beacon
	return mergeGeometries(bagian);
}

function instans(geo, bahan) {
	const m = new THREE.InstancedMesh(geo, bahan, MAKS);
	m.count = 0;
	m.frustumCulled = false;
	m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	// Created up front so the shader is compiled once with instance colours, before the first frame.
	m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAKS * 3), 3);
	m.instanceColor.setUsage(THREE.DynamicDrawUsage);
	return m;
}

const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

export function buatHidup(adegan, mesin) {
	const orang = bentukOrang();
	const geo = {
		...orang,
		garpu: bentukGarpu(),
		tong: new THREE.CylinderGeometry(0.3, 0.25, 0.5, 14, 1, true).translate(0, 0.25, 0),
		isi: new THREE.CylinderGeometry(0.235, 0.235, 1, 14).translate(0, 0.5, 0),
		bagian: new THREE.BoxGeometry(1, 1, 1),
	};
	const bahan = {
		lambert: new THREE.MeshLambertMaterial({ vertexColors: true }),
		polos: new THREE.MeshLambertMaterial({ vertexColors: false }),
		tong: new THREE.MeshLambertMaterial({ color: 0x5a7a99, side: THREE.DoubleSide }),
	};
	const mesh = {
		badan: instans(geo.badan, bahan.lambert),
		kepala: instans(geo.kepala, bahan.lambert),
		helm: instans(geo.helm, bahan.lambert),
		tong: instans(geo.tong, bahan.tong),
		isi: instans(geo.isi, bahan.polos),
		bagian: instans(geo.bagian, bahan.polos),
	};
	const garpu = new THREE.Mesh(geo.garpu, bahan.lambert);
	garpu.frustumCulled = false;
	const grup = new THREE.Group();
	for (const m of Object.values(mesh)) grup.add(m);
	grup.add(garpu);
	adegan.scene.add(grup);

	const m4 = new THREE.Matrix4();
	const v = new THREE.Vector3();
	const v2 = new THREE.Vector3();
	const q = new THREE.Quaternion();
	const k3 = new THREE.Vector3();
	const warna = new THREE.Color();
	const SUMBU_Y = new THREE.Vector3(0, 1, 0);
	const NOL = new THREE.Matrix4().makeScale(0, 0, 0);

	let daftar = [];
	let nama = []; // names of the last layout
	let isi = new Float32Array(MAKS); // each bin's fill, 0..1
	let faseLalu = new Float32Array(MAKS);
	const umur = new Float32Array(MAKS).fill(-1); // a part's age in s; < 0 = in the pool
	const asal = new Float32Array(MAKS * 3);
	const tujuan = new Float32Array(MAKS * 3);
	let orangKini = [];
	let jatuh = 0;
	let diam = false;
	let kotor = false; // a bin fill changed
	let bagianAktif = false;

	// The forklift: the target point's index, position, heading, and the wait left at a stop (s).
	let sasaran = 2;
	const gk = { x: JALUR[1].x, z: JALUR[1].z, arah: Math.PI / 2, tunggu: 0 };
	const pasangGarpu = () => {
		garpu.position.set(gk.x, 0, gk.z);
		garpu.rotation.y = gk.arah;
	};
	pasangGarpu();

	// World position of a place in a machine's space.
	const dunia = (s, [x, y, z], ke) => ke.set(x, y, z).applyMatrix4(s.dasar);
	const putar = (s) => (Math.cos(s.putar) >= 0 ? 0 : Math.PI);

	function isiMatriks(i, s) {
		const h = Math.max(isi[i], 0.001) * TINGGI_TONG;
		dunia(s, DI_MESIN.tong, v);
		q.setFromAxisAngle(SUMBU_Y, putar(s));
		mesh.isi.setMatrixAt(i, m4.compose(v.setY(0.05), q, k3.set(1, h, 1)));
	}

	// Re-lays figures, bins and the pool for the machines drawn now. Called with `mesin.daftar()` after every `tata`.
	function perbarui(d) {
		daftar = (d || []).slice(0, MAKS);
		const lama = new Map(nama.map((n, i) => [n, [isi[i], faseLalu[i]]]));
		nama = daftar.map((s) => s.nama);
		isi = new Float32Array(MAKS);
		faseLalu = new Float32Array(MAKS);
		umur.fill(-1);
		orangKini = [];
		let o = 0;
		daftar.forEach((s, i) => {
			const prev = lama.get(s.nama);
			isi[i] = prev ? prev[0] : 0;
			faseLalu[i] = prev ? prev[1] : s.fase;
			// The bin and its fill, tinted like the machine.
			dunia(s, DI_MESIN.tong, v);
			q.setFromAxisAngle(SUMBU_Y, putar(s));
			mesh.tong.setMatrixAt(i, m4.compose(v.setY(0), q, k3.set(1, 1, 1)));
			mesh.tong.setColorAt(i, warna.setScalar(1));
			isiMatriks(i, s);
			mesh.isi.setColorAt(i, s.merek);
			mesh.bagian.setMatrixAt(i, NOL);
			mesh.bagian.setColorAt(i, s.merek);
			// A person: an operator in Production or Setup, a technician in Maintenance or Problem, else nobody.
			const jenis = s.status === "Production" || s.status === "Setup" ? "operator" : s.status === "Maintenance" || s.status === "Problem" ? "teknisi" : null;
			if (!jenis) return;
			dunia(s, DI_MESIN.orang, v);
			m4.compose(v, q, k3.set(1, 1, 1));
			for (const k of ["badan", "kepala", "helm"]) mesh[k].setMatrixAt(o, m4);
			mesh.badan.setColorAt(o, warna.set(WARNA[jenis].badan));
			mesh.kepala.setColorAt(o, warna.setScalar(1));
			mesh.helm.setColorAt(o, warna.set(WARNA[jenis].helm));
			orangKini.push({ nama: s.nama, jenis, x: v.x, z: v.z });
			o += 1;
		});
		for (const [k, m] of Object.entries(mesh)) {
			m.count = k === "badan" || k === "kepala" || k === "helm" ? o : daftar.length;
			m.instanceMatrix.needsUpdate = true;
			m.instanceColor.needsUpdate = true;
			m.boundingSphere = null;
		}
		bagianAktif = false;
	}

	function jatuhkan(i, s) {
		dunia(s, DI_MESIN.asal, v);
		asal[i * 3] = v.x;
		asal[i * 3 + 1] = v.y;
		asal[i * 3 + 2] = v.z;
		dunia(s, [DI_MESIN.tong[0], TONG_ATAS, DI_MESIN.tong[2]], v);
		tujuan[i * 3] = v.x;
		tujuan[i * 3 + 1] = v.y;
		tujuan[i * 3 + 2] = v.z;
		umur[i] = 0;
		jatuh += 1;
	}

	function tick(dt) {
		if (diam) return;
		// Parts: a machine in Production drops one when its mould cycle wraps.
		let bagianUbah = false;
		for (let i = 0; i < daftar.length; i++) {
			const s = daftar[i];
			if (s.status === "Production" && s.fase < faseLalu[i] - 0.5) jatuhkan(i, s);
			faseLalu[i] = s.fase;
			if (umur[i] < 0) continue;
			umur[i] += dt;
			const p = umur[i] / LAMA_JATUH;
			if (p >= 1) {
				umur[i] = -1;
				isi[i] += 1 / SIKLUS_TONG;
				if (isi[i] >= 1) isi[i] = 0; // emptied
				isiMatriks(i, s);
				kotor = true;
				mesh.bagian.setMatrixAt(i, NOL);
			} else {
				const a = i * 3;
				v.set(asal[a] + (tujuan[a] - asal[a]) * p, asal[a + 1] + (tujuan[a + 1] - asal[a + 1]) * p * p, asal[a + 2] + (tujuan[a + 2] - asal[a + 2]) * p);
				mesh.bagian.setMatrixAt(i, m4.compose(v, q.identity(), k3.set(0.14, 0.1, 0.14)));
			}
			bagianUbah = true;
		}
		if (bagianUbah || bagianAktif) mesh.bagian.instanceMatrix.needsUpdate = true;
		bagianAktif = bagianUbah;
		if (kotor) {
			mesh.isi.instanceMatrix.needsUpdate = true;
			kotor = false;
		}
		// The forklift: drive to the target point, wait there `henti` ms, take the next.
		if (gk.tunggu > 0) gk.tunggu -= dt;
		else {
			const t = JALUR[sasaran];
			const dx = t.x - gk.x;
			const dz = t.z - gk.z;
			const jarak = Math.hypot(dx, dz);
			const langkah = LAJU * dt;
			if (jarak <= langkah) {
				gk.x = t.x;
				gk.z = t.z;
				gk.tunggu = t.henti / 1000;
				sasaran = (sasaran + 1) % JALUR.length;
			} else {
				gk.x += (dx / jarak) * langkah;
				gk.z += (dz / jarak) * langkah;
			}
			if (jarak > 0.01) {
				let d = Math.atan2(dx, dz) - gk.arah;
				d = Math.atan2(Math.sin(d), Math.cos(d));
				gk.arah += d * (1 - Math.exp(-dt * BELOK));
			}
			pasangGarpu();
		}
	}

	function info() {
		const hitung = (j) => orangKini.filter((o) => o.jenis === j).length;
		const banyak = orangKini.length;
		const bagianTris = tris(geo.badan) * banyak + tris(geo.kepala) * banyak + tris(geo.helm) * banyak + (tris(geo.tong) + tris(geo.isi) + tris(geo.bagian)) * daftar.length + tris(geo.garpu);
		return {
			operator: hitung("operator"),
			teknisi: hitung("teknisi"),
			jatuh,
			forklift: { x: gk.x, z: gk.z, henti: gk.tunggu > 0, laju: LAJU },
			aktif: !diam,
			orang: orangKini.map((o) => ({ ...o })),
			tong: daftar.map((s, i) => ({ nama: s.nama, isi: isi[i] })),
			calls: 7,
			tris: Math.round(bagianTris),
		};
	}

	return {
		perbarui,
		tick,
		// Adaptive quality: everything stands still for good.
		henti() {
			diam = true;
		},
		info,
		buang() {
			adegan.scene.remove(grup);
			for (const m of Object.values(mesh)) m.dispose();
			for (const g of Object.values(geo)) g.dispose();
			for (const b of Object.values(bahan)) b.dispose();
		},
	};
}
