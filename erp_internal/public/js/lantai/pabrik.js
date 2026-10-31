// The factory around the machines (decor, fixed, not data): the building cut away like a dollhouse (slab, low back
// and side walls with a window band, steel columns, a rolling door) and the outside (ground, a road, trees, a parked
// truck at the dock). The painted zones with their props and floor lettering are zona.js. Everything is built from
// code once: static solids are merged into one mesh per material, the trees are one InstancedMesh, and nothing here
// allocates or creates a geometry, material or texture after load (a theme change only recolours materials).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DINDING, PINTU, SLAB } from "./denah.js";
import { balok, tabungZ, tegak, terbuang, warnai } from "./bentuk.js";

const NAIK = -0.25; // the ground outside lies this far below the slab's top (y = 0)
const H = DINDING.tinggi;

// Colours that do not change with the theme (the ground, road and apron do).
const C = {
	beton: 0xb9bfc6,
	tembok: 0xd6dade,
	atap: 0xf1f3f5,
	baja: 0x59636f,
	kuning: 0xe0b100,
	gelap: 0x363b42,
	jalur: 0xf4f4f0,
};
// `padat` tints the merged solids (walls, roof cap, columns, truck, lane dashes): their vertex colours stay the light
// ones and the material's colour multiplies them, so a theme change creates nothing.
const TEMA = {
	light: { tanah: 0xcdd8c4, aspal: 0x8c949c, beton: 0xc6cbd0, kaca: 0xbfe0ff, padat: 0xffffff },
	dark: { tanah: 0x232a26, aspal: 0x3a4048, beton: 0x3a4149, kaca: 0xffd98a, padat: 0x6b727b },
};
// A vertex colour as the screen shows it under a tint, "#rrggbb" (the shader multiplies the two in linear space).
const tampak = (hex, tint) => `#${new THREE.Color(hex).multiply(new THREE.Color(tint)).getHexString()}`;
function dindingDanTiang() {
	const g = [];
	const { x0, x1, z0, z1 } = SLAB;
	const T = 0.3; // wall thickness, standing just outside the slab
	// Slab edge (a concrete plinth under the floor plane) and the walls.
	g.push(balok(x0, NAIK, z0, x1, -0.03, z1, C.beton));
	g.push(balok(x0 - T, 0, z0 - T, x1 + T, H, z0, C.tembok)); // back wall
	g.push(balok(x0 - T, 0, z0, x0, H, z1, C.tembok)); // left wall
	g.push(balok(x1, 0, z0, x1 + T, H, PINTU.z0, C.tembok)); // right wall, either side of the door
	g.push(balok(x1, 0, PINTU.z1, x1 + T, H, z1, C.tembok));
	g.push(balok(x1, 2.0, PINTU.z0, x1 + T, H, PINTU.z1, C.tembok)); // lintel over the door
	// The roof edge: a light cap along the top of the walls.
	g.push(balok(x0 - T - 0.1, H, z0 - T - 0.1, x1 + T + 0.1, H + 0.12, z0 + 0.1, C.atap));
	g.push(balok(x0 - T - 0.1, H, z0, x0 + 0.1, H + 0.12, z1, C.atap));
	g.push(balok(x1 - 0.1, H, z0, x1 + T + 0.1, H + 0.12, PINTU.z0, C.atap));
	g.push(balok(x1 - 0.1, H, PINTU.z1, x1 + T + 0.1, H + 0.12, z1, C.atap));
	g.push(balok(x1 - 0.1, H, PINTU.z0, x1 + T + 0.1, H + 0.12, PINTU.z1, C.atap));
	// Steel columns inside, along the back wall every 6 m and along the side walls either side of the door.
	for (let x = x0; x <= x1 + 0.01; x += 6) g.push(balok(x - 0.2, 0, z0, x + 0.2, H, z0 + 0.4, C.baja));
	for (const z of TIANG_Z) {
		g.push(balok(x0, 0, z - 0.2, x0 + 0.4, H, z + 0.2, C.baja));
		g.push(balok(x1 - 0.4, 0, z - 0.2, x1, H, z + 0.2, C.baja));
	}
	// The rolling door: guide rails on the posts, a yellow-black kick board and the rolled-up shutter barrel.
	g.push(balok(x1 - 0.5, 0, PINTU.z0 - 0.15, x1, 2.0, PINTU.z0 + 0.15, C.kuning));
	g.push(balok(x1 - 0.5, 0, PINTU.z1 - 0.15, x1, 2.0, PINTU.z1 + 0.15, C.kuning));
	g.push(
		warnai(new THREE.CylinderGeometry(0.2, 0.2, PINTU.z1 - PINTU.z0, 16).rotateX(Math.PI / 2), [x1 - 0.3, 2.2, (PINTU.z0 + PINTU.z1) / 2], C.baja)
	);
	return g;
}
// Z of the side walls' columns: the door's posts at -4 and 2 split the wall into two bays each side.
const TIANG_Z = [-14, -9, -4, 2, 7, 12];

// The window band: thin panes on the inner face of the walls, between the columns (one emissive material).
function jendela() {
	const g = [];
	const { x0, x1, z0 } = SLAB;
	for (let x = x0 + 3; x < x1; x += 6) g.push(balok(x - 1.8, 0.95, z0 + 0.01, x + 1.8, 1.95, z0 + 0.05, 0xffffff));
	for (let i = 0; i + 1 < TIANG_Z.length; i++) {
		const a = TIANG_Z[i];
		const b = TIANG_Z[i + 1];
		const tengah = (a + b) / 2;
		const lebar = (b - a) / 2 - 0.6;
		if (a === -4 && b === 2) continue; // the door
		g.push(balok(x0 + 0.01, 0.95, tengah - lebar, x0 + 0.05, 1.95, tengah + lebar, 0xffffff));
		g.push(balok(x1 - 0.05, 0.95, tengah - lebar, x1 - 0.01, 1.95, tengah + lebar, 0xffffff));
	}
	return g;
}

// Everything outside: the dock apron and road (own materials), the truck, the road's lane dashes, the trees.
function truk(g) {
	const x = 33.6;
	const z = (PINTU.z0 + PINTU.z1) / 2;
	const y = NAIK;
	g.push(balok(x, y + 0.55, z - 1.2, x + 7.6, y + 3.2, z + 1.2, 0xe9edf1)); // trailer
	g.push(balok(x, y + 1.7, z - 1.21, x + 7.6, y + 2.1, z + 1.21, 0x2f68b4)); // its stripe
	g.push(balok(x + 7.8, y + 0.55, z - 1.15, x + 9.6, y + 2.45, z + 1.15, 0xc9362d)); // cab
	g.push(balok(x + 9.1, y + 1.4, z - 1.16, x + 9.62, y + 2.3, z + 1.16, 0x9fc6e8)); // windscreen
	g.push(balok(x, y + 0.45, z - 1.1, x + 9.6, y + 0.6, z + 1.1, C.gelap)); // chassis
	for (const dx of [1.2, 2.5, 6.2, 8.4]) for (const dz of [-1.2, 1.2]) g.push(tabungZ(0.5, 0.35, [x + dx, y + 0.5, z + dz * 1.0], 0x20242a));
}
const POHON = [
	[-27, -19],
	[-20, -21],
	[-10, -19.5],
	[0, -21],
	[11, -19],
	[19, -21.5],
	[27, -19.5],
	[-36, -8],
	[-37, 4],
	[-35, 14],
	[40, -18],
	[47, -12],
	[44, 10],
	[-24, 23],
	[-6, 24],
	[9, 23.5],
	[26, 24],
	[40, 22],
];

export function buatPabrik(adegan) {
	const grup = new THREE.Group();
	const geometri = [];
	const bahan = [];
	let calls = 0;
	let tris = 0;
	const catat = (mesh, geo, jumlah = 1) => {
		calls += 1;
		tris += ((geo.index ? geo.index.count : geo.attributes.position.count) / 3) * jumlah;
	};
	const urus = (geo) => (geometri.push(geo), geo);
	const mat = (m) => (bahan.push(m), m);

	// --- static solids: one merged mesh, vertex colours -------------------------------------------------------
	const padat = [];
	padat.push(...dindingDanTiang());
	truk(padat);
	// Lane dashes down the road's middle.
	for (let x = -90; x < 90; x += 4) padat.push(balok(x, NAIK + 0.02, 17.4, x + 2, NAIK + 0.05, 17.55, C.jalur));
	const padatGeo = urus(mergeGeometries(padat.map(terbuang)));
	for (const p of padat) p.dispose();
	const bahanPadat = mat(new THREE.MeshLambertMaterial({ vertexColors: true }));
	const padatMesh = new THREE.Mesh(padatGeo, bahanPadat);
	catat(padatMesh, padatGeo);
	grup.add(padatMesh);

	// --- windows: emissive, dimmed by adaptive quality -----------------------------------------------------------
	const jend = jendela();
	const jendGeo = urus(mergeGeometries(jend.map(terbuang)));
	for (const p of jend) p.dispose();
	const bahanKaca = mat(new THREE.MeshBasicMaterial({ color: TEMA.light.kaca, toneMapped: false }));
	const jendMesh = new THREE.Mesh(jendGeo, bahanKaca);
	catat(jendMesh, jendGeo);
	grup.add(jendMesh);

	// --- ground, road and dock apron (theme colours) -----------------------------------------------------------------
	const bahanTanah = mat(new THREE.MeshLambertMaterial({ color: TEMA.light.tanah }));
	const tanah = new THREE.Mesh(urus(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2)), bahanTanah);
	tanah.position.y = NAIK;
	catat(tanah, tanah.geometry);
	grup.add(tanah);
	const bahanAspal = mat(new THREE.MeshLambertMaterial({ color: TEMA.light.aspal }));
	const jalan = new THREE.Mesh(urus(new THREE.PlaneGeometry(400, 6).rotateX(-Math.PI / 2)), bahanAspal);
	jalan.position.set(0, NAIK + 0.015, 17.5);
	catat(jalan, jalan.geometry);
	grup.add(jalan);
	const bahanBeton = mat(new THREE.MeshLambertMaterial({ color: TEMA.light.beton }));
	const apron = new THREE.Mesh(urus(new THREE.PlaneGeometry(16, 14).rotateX(-Math.PI / 2)), bahanBeton);
	apron.position.set(SLAB.x1 + 0.3 + 8, NAIK + 0.015, -1);
	catat(apron, apron.geometry);
	grup.add(apron);

	// --- trees: one InstancedMesh -----------------------------------------------------------------------------------------
	const pohonGeo = urus(
		mergeGeometries(
			[
				tegak(0.14, 0.2, 1.2, [0, 0, 0], 0x6b4a2f, 6),
				tegak(1.2, 0.05, 2.0, [0, 1.0, 0], 0x3f8f4f, 8),
				tegak(0.85, 0.05, 1.6, [0, 2.1, 0], 0x4aa35c, 8),
			].map(terbuang)
		)
	);
	const pohonMesh = new THREE.InstancedMesh(pohonGeo, mat(new THREE.MeshLambertMaterial({ vertexColors: true })), POHON.length);
	const m4 = new THREE.Matrix4();
	const q4 = new THREE.Quaternion();
	POHON.forEach(([x, z], i) => {
		const s = 0.62 + ((i * 37) % 7) * 0.05;
		pohonMesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, NAIK, z), q4, new THREE.Vector3(s, s, s)));
	});
	pohonMesh.instanceMatrix.needsUpdate = true;
	pohonMesh.frustumCulled = false;
	catat(pohonMesh, pohonGeo, POHON.length);
	grup.add(pohonMesh);

	adegan.scene.add(grup);

	// --- theme and adaptive quality ----------------------------------------------------------------------------------------
	let t = TEMA.light;
	let namaTema = "light";
	let turun = false;
	const warnaKaca = () => bahanKaca.color.setHex(t.kaca).multiplyScalar(turun ? 0.4 : 1);
	adegan.saatTurun.push(() => {
		turun = true; // the window glow dims with the rest of the life layer
		warnaKaca();
		adegan.tandaiKotor();
	});
	return {
		// "light" or "dark": the walls, roof cap, truck, ground, road, apron and window glow follow Desk's theme.
		tema(nama) {
			const baru = nama === "dark" ? TEMA.dark : TEMA.light;
			if (baru === t) return;
			t = baru;
			namaTema = nama === "dark" ? "dark" : "light";
			bahanPadat.color.setHex(t.padat);
			bahanTanah.color.setHex(t.tanah);
			bahanAspal.color.setHex(t.aspal);
			bahanBeton.color.setHex(t.beton);
			warnaKaca();
			adegan.tandaiKotor();
		},
		// The building's own share of the draw calls and triangles (the zones report theirs).
		info: () => ({
			calls,
			tris: Math.round(tris),
			kaca: `#${bahanKaca.color.getHexString()}`,
			turun,
			tema: namaTema,
			// The wall, roof cap and trailer as the screen shows them (vertex colour x theme tint).
			dinding: tampak(C.tembok, t.padat),
			atap: tampak(C.atap, t.padat),
			truk: tampak(0xe9edf1, t.padat),
		}),
		buang() {
			adegan.scene.remove(grup);
			for (const g of geometri) g.dispose();
			for (const b of bahan) b.dispose();
			pohonMesh.dispose();
		},
	};
}
