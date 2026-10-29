// The factory around the machines (decor, fixed, not data): the building cut away like a dollhouse (slab, low back
// and side walls with a window band, steel columns, a rolling door), the outside (ground, a road, trees, a parked
// truck at the dock) and the painted zones with their floor lettering and props. Everything is built from code once:
// static solids are merged into one mesh per material, the trees are one InstancedMesh, and nothing here allocates or
// creates a geometry, material or texture after load (a theme change only recolours and redraws the lettering canvas).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DINDING, PINTU, SLAB, ZONA } from "./denah.js";

const NAIK = -0.25; // the ground outside lies this far below the slab's top (y = 0)
const H = DINDING.tinggi;

// Colours that do not change with the theme (the ground, road and lettering do).
const C = {
	beton: 0xb9bfc6,
	tembok: 0xd6dade,
	atap: 0xf1f3f5,
	baja: 0x59636f,
	kuning: 0xe0b100,
	kayu: 0xb08a5a,
	karung: [0xf1ead8, 0xdbe6f2, 0xe8dcc0],
	peti: [0x2f7fd0, 0xe0802a, 0x2fa59a, 0xd9473d],
	gelap: 0x363b42,
	merah: 0xc9362d,
	jalur: 0xf4f4f0,
};
const TEMA = {
	light: { tanah: 0xcdd8c4, aspal: 0x8c949c, beton: 0xc6cbd0, kaca: 0xbfe0ff, huruf: "#15202b", pelat: "rgba(255,255,255,0.82)" },
	dark: { tanah: 0x232a26, aspal: 0x3a4048, beton: 0x3a4149, kaca: 0xffd98a, huruf: "#f1f5f9", pelat: "rgba(20,24,30,0.82)" },
};
// Floor paint per zone (fill and border) and the key of its lettering.
const CAT = {
	bahan: 0x4d7fbf,
	cetakan: 0x7a8794,
	qc: 0x3fa5a8,
	jadi: 0x3fae6a,
	reject: 0xd9473d,
	giling: 0xe0902a,
};
const HURUF = ["bahan", "cetakan", "qc", "jadi", "reject", "giling"];
const TEKS_HURUF = {
	bahan: () => __("Raw Material"),
	cetakan: () => __("Mould Storage"),
	qc: () => __("QC / Office"),
	jadi: () => __("Finished Goods"),
	reject: () => __("Reject"),
	giling: () => __("Grinder"),
};
const SEL_L = 512; // the lettering atlas: 2 columns of 8 cells, each 512x128 (4:1)
const SEL_T = 128;

// A part with a flat vertex colour, positioned by its centre.
function warnai(geo, [x, y, z], warna) {
	geo.translate(x, y, z);
	const c = new THREE.Color(warna);
	const n = geo.attributes.position.count;
	const isi = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) isi.set([c.r, c.g, c.b], i * 3);
	geo.setAttribute("color", new THREE.BufferAttribute(isi, 3));
	return geo;
}
// A box from its two corners.
const balok = (x0, y0, z0, x1, y1, z1, warna) =>
	warnai(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], warna);
const tegak = (rAtas, rBawah, tinggi, [x, y, z], warna, seg = 14) =>
	warnai(new THREE.CylinderGeometry(rAtas, rBawah, tinggi, seg), [x, y + tinggi / 2, z], warna);
// A cylinder lying along z (a wheel, a roller).
const tabungZ = (r, p, [x, y, z], warna) => warnai(new THREE.CylinderGeometry(r, r, p, 14).rotateX(Math.PI / 2), [x, y, z], warna);
// A horizontal plane lying at y (for floor paint), from its two corners.
function datar(x0, z0, x1, z1, y, warna) {
	const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
	return warnai(g, [(x0 + x1) / 2, y, (z0 + z1) / 2], warna);
}
const terbuang = (g) => {
	g.deleteAttribute("uv"); // merged meshes with and without a texture must carry the same attributes
	return g;
};

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

function paletKarung(g, x, z, lapis = 3) {
	g.push(balok(x - 0.6, 0, z - 0.6, x + 0.6, 0.14, z + 0.6, C.kayu));
	for (let l = 0; l < lapis; l++) g.push(balok(x - 0.52, 0.14 + l * 0.3, z - 0.52, x + 0.52, 0.14 + (l + 1) * 0.3 - 0.02, z + 0.52, C.karung[Math.abs(l + Math.round(x + z)) % 3]));
}
function paletPeti(g, x, z, lapis, ragam) {
	g.push(balok(x - 0.6, 0, z - 0.6, x + 0.6, 0.14, z + 0.6, C.kayu));
	for (let l = 0; l < lapis; l++) {
		const w = C.peti[(ragam + l) % C.peti.length];
		g.push(balok(x - 0.54, 0.14 + l * 0.42, z - 0.54, x + 0.54, 0.14 + (l + 1) * 0.42 - 0.03, z + 0.54, w));
	}
}

function bahanBaku(g) {
	const z = ZONA.bahan;
	for (const x of [-27.8, -26.1, -24.4]) for (const zz of [-10.8, -9.1, -7.4, -5.7]) paletKarung(g, x, zz, 2 + ((Math.round(x * 3 + zz * 5) % 2) + 2) % 2);
	// Granule dryer: a drum on legs with a hopper cone and a feed pipe.
	const dx = z.x1 - 1.4;
	const dz = -9;
	for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) g.push(balok(dx + a - 0.05, 0, dz + b - 0.05, dx + a + 0.05, 0.7, dz + b + 0.05, C.baja));
	g.push(tegak(0.7, 0.7, 1.5, [dx, 0.7, dz], 0xc9d1d8, 18));
	g.push(tegak(0.7, 0.18, 0.55, [dx, 0.15, dz], 0xa9b1ba, 18));
	g.push(tegak(0.7, 0.05, 0.3, [dx, 2.2, dz], 0xd8dde2, 18));
	g.push(tegak(0.07, 0.07, 1.2, [dx, 1.0, dz + 0.78], C.baja, 8));
}
function rakCetakan(g) {
	const z = ZONA.cetakan;
	const x0 = z.x0 + 1;
	const x1 = z.x1 - 1;
	const rz = z.z0 + 1.3;
	for (const x of [x0, (x0 + x1) / 2, x1]) for (const zz of [rz - 0.55, rz + 0.55]) g.push(balok(x - 0.05, 0, zz - 0.05, x + 0.05, 2.0, zz + 0.05, 0x2f68b4));
	for (const y of [0.12, 0.85, 1.58]) {
		g.push(balok(x0 - 0.05, y, rz - 0.6, x1 + 0.05, y + 0.06, rz + 0.6, 0xe0802a));
		for (let i = 0; i < 5; i++) {
			const cx = x0 + 0.8 + i * ((x1 - x0 - 1.6) / 4);
			g.push(balok(cx - 0.55, y + 0.06, rz - 0.4, cx + 0.55, y + 0.06 + 0.5 + (i % 2) * 0.1, rz + 0.4, i % 2 ? 0x6c7581 : 0x8a929b));
		}
	}
	// Two moulds waiting on the floor in front.
	g.push(balok(z.x0 + 2.2, 0, z.z1 - 2.2, z.x0 + 3.5, 0.55, z.z1 - 1.4, 0x6c7581));
	g.push(balok(z.x0 + 4.2, 0, z.z1 - 2.1, z.x0 + 5.3, 0.45, z.z1 - 1.4, 0x8a929b));
}
function barangJadi(g) {
	const j = ZONA.jadi;
	let r = 0;
	for (const x of [21.8, 24.4, 27.0]) for (const zz of [-11.2, -9.5]) paletPeti(g, x, zz, 2 + (r % 2), r++);
	// Stacked buckets and basins.
	// (behind the lettering at the zone's front edge, and clear of the forklift's stop at 24, -7)
	for (const x of [27.2, 28.3]) g.push(tegak(0.34, 0.24, 0.95, [x, 0, -7.7], x > 27.5 ? 0x2f7fd0 : 0xe0802a, 14));
	for (const x of [20.9, 22.0]) for (let k = 0; k < 3; k++) g.push(tegak(0.52, 0.4, 0.3, [x, k * 0.3, -7.9], x > 21.5 ? 0x2fa59a : 0xd9473d, 16));
}
function tempatReject(g) {
	const r = ZONA.reject;
	for (const x of [r.x0 + 1.1, r.x1 - 1.1]) for (const z of [r.z0 + 1.1, r.z0 + 2.7]) {
		g.push(balok(x - 0.5, 0, z - 0.5, x + 0.5, 0.9, z + 0.5, C.merah));
		g.push(balok(x - 0.4, 0.88, z - 0.4, x + 0.4, 0.92, z + 0.4, 0x4a1612));
	}
}
function penggiling(g) {
	const k = ZONA.giling;
	const cx = (k.x0 + k.x1) / 2;
	const cz = k.z0 + 2;
	g.push(balok(cx - 1.0, 0, cz - 0.8, cx + 1.0, 1.1, cz + 0.8, 0x4a5561)); // body
	g.push(warnai(new THREE.CylinderGeometry(0.85, 0.45, 0.7, 4).rotateY(Math.PI / 4), [cx, 1.45, cz], 0xe0902a)); // hopper
	g.push(tabungZ(0.3, 1.0, [cx + 1.25, 0.6, cz], C.baja)); // motor
	g.push(balok(cx - 0.45, 0, cz + 0.8, cx + 0.45, 0.55, cz + 1.7, 0xa9b1ba)); // collection bin
	g.push(balok(cx - 0.35, 0.5, cz + 0.8, cx + 0.35, 0.58, cz + 1.6, 0x3a2f2a)); // regrind in it
}
// The glass QC / office box: a frame and a desk with a monitor (the glass itself is its own material).
function kotakQc(g) {
	const q = ZONA.qc;
	const t = 2.3;
	for (const x of [q.x0, q.x1]) for (const z of [q.z0, q.z1]) g.push(balok(x - 0.06, 0, z - 0.06, x + 0.06, t, z + 0.06, 0xdfe3e8));
	g.push(balok(q.x0 - 0.06, t - 0.04, q.z0 - 0.06, q.x1 + 0.06, t + 0.06, q.z0 + 0.06, 0xdfe3e8));
	g.push(balok(q.x0 - 0.06, t - 0.04, q.z1 - 0.06, q.x1 + 0.06, t + 0.06, q.z1 + 0.06, 0xdfe3e8));
	g.push(balok(q.x0 - 0.06, 0, q.z0 - 0.06, q.x1 + 0.06, 0.08, q.z1 + 0.06, 0xdfe3e8));
	// desk, monitor, inspection table
	g.push(balok(q.x0 + 0.5, 0.7, q.z0 + 0.4, q.x0 + 2.6, 0.76, q.z0 + 1.2, 0x8a6a45));
	g.push(balok(q.x0 + 1.1, 0.76, q.z0 + 0.55, q.x0 + 1.7, 1.06, q.z0 + 0.62, C.gelap));
	g.push(balok(q.x1 - 2.4, 0.85, q.z0 + 0.6, q.x1 - 0.6, 0.9, q.z0 + 1.6, 0xa9b1ba));
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
	bahanBaku(padat);
	rakCetakan(padat);
	barangJadi(padat);
	tempatReject(padat);
	penggiling(padat);
	kotakQc(padat);
	truk(padat);
	// Lane dashes down the road's middle.
	for (let x = -90; x < 90; x += 4) padat.push(balok(x, NAIK + 0.02, 17.4, x + 2, NAIK + 0.05, 17.55, C.jalur));
	const padatGeo = urus(mergeGeometries(padat.map(terbuang)));
	for (const p of padat) p.dispose();
	const padatMesh = new THREE.Mesh(padatGeo, mat(new THREE.MeshLambertMaterial({ vertexColors: true })));
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

	// --- glass of the QC box ---------------------------------------------------------------------------------------
	const q = ZONA.qc;
	const kacaQc = [];
	const tp = 2.3;
	const sisiKaca = (x0, z0, x1, z1) => new THREE.BoxGeometry(Math.max(x1 - x0, 0.03), tp - 0.1, Math.max(z1 - z0, 0.03)).translate((x0 + x1) / 2, tp / 2 + 0.04, (z0 + z1) / 2);
	kacaQc.push(sisiKaca(q.x0, q.z1, q.x1, q.z1), sisiKaca(q.x0, q.z0, q.x1, q.z0), sisiKaca(q.x0, q.z0, q.x0, q.z1), sisiKaca(q.x1, q.z0, q.x1, q.z1));
	kacaQc.push(new THREE.BoxGeometry(q.x1 - q.x0, 0.03, q.z1 - q.z0).translate((q.x0 + q.x1) / 2, tp, (q.z0 + q.z1) / 2));
	const kacaGeo = urus(mergeGeometries(kacaQc.map(terbuang)));
	for (const p of kacaQc) p.dispose();
	const kacaMesh = new THREE.Mesh(
		kacaGeo,
		mat(new THREE.MeshLambertMaterial({ color: 0xa8d4e6, transparent: true, opacity: 0.22, depthWrite: false }))
	);
	kacaMesh.renderOrder = 2;
	catat(kacaMesh, kacaGeo);
	grup.add(kacaMesh);

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

	// --- floor paint: zone fills and borders --------------------------------------------------------------------------
	const isi = [];
	const garis = [];
	for (const [nama, k] of Object.entries(ZONA)) {
		isi.push(datar(k.x0, k.z0, k.x1, k.z1, 0.012, CAT[nama]));
		const t = 0.12;
		garis.push(
			datar(k.x0, k.z0, k.x1, k.z0 + t, 0.014, CAT[nama]),
			datar(k.x0, k.z1 - t, k.x1, k.z1, 0.014, CAT[nama]),
			datar(k.x0, k.z0 + t, k.x0 + t, k.z1 - t, 0.014, CAT[nama]),
			datar(k.x1 - t, k.z0 + t, k.x1, k.z1 - t, 0.014, CAT[nama])
		);
	}
	for (const [daftar, opasitas] of [
		[isi, 0.26],
		[garis, 0.75],
	]) {
		const geo = urus(mergeGeometries(daftar.map(terbuang)));
		for (const p of daftar) p.dispose();
		const m = new THREE.Mesh(geo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: opasitas, depthWrite: false, toneMapped: false })));
		catat(m, geo);
		grup.add(m);
	}

	// --- floor lettering: one atlas canvas, one quad per zone ----------------------------------------------------------
	const kanvas = document.createElement("canvas");
	kanvas.width = SEL_L * 2;
	kanvas.height = SEL_T * 8;
	const ctx = kanvas.getContext("2d");
	const tekstur = new THREE.CanvasTexture(kanvas);
	tekstur.anisotropy = 4;
	tekstur.colorSpace = THREE.SRGBColorSpace;
	function gambarHuruf(t) {
		ctx.clearRect(0, 0, kanvas.width, kanvas.height);
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		HURUF.forEach((nama, i) => {
			const x = (i % 2) * SEL_L;
			const y = Math.floor(i / 2) * SEL_T;
			const teks = TEKS_HURUF[nama]();
			let ukuran = 92;
			ctx.font = `700 ${ukuran}px system-ui, -apple-system, "Segoe UI", sans-serif`;
			while (ctx.measureText(teks).width > SEL_L - 70 && ukuran > 20) {
				ukuran -= 4;
				ctx.font = `700 ${ukuran}px system-ui, -apple-system, "Segoe UI", sans-serif`;
			}
			const lebar = ctx.measureText(teks).width + 44;
			ctx.fillStyle = t.pelat;
			ctx.beginPath();
			ctx.roundRect(x + (SEL_L - lebar) / 2, y + 8, lebar, SEL_T - 16, 20);
			ctx.fill();
			ctx.fillStyle = t.huruf;
			ctx.fillText(teks, x + SEL_L / 2, y + SEL_T / 2 + 3);
		});
		tekstur.needsUpdate = true;
	}
	gambarHuruf(TEMA.light);
	const hurufGeo = [];
	HURUF.forEach((nama, i) => {
		const k = ZONA[nama];
		const lebar = Math.min(k.x1 - k.x0 - 0.8, 6);
		const tinggi = lebar / 4;
		// at the front edge, outside the QC box; the raw material's sits clear of the mould rack's shadow on it
		const cz = nama === "qc" ? k.z1 + 0.75 : nama === "bahan" ? -3.3 : k.z1 - tinggi / 2 - 0.35;
		const g = new THREE.PlaneGeometry(lebar, tinggi).rotateX(-Math.PI / 2).translate((k.x0 + k.x1) / 2, 0.03, cz);
		const uv = g.attributes.uv;
		const u0 = (i % 2) / 2;
		const v0 = 1 - (Math.floor(i / 2) + 1) / 8;
		for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) * 0.5, v0 + uv.getY(j) / 8);
		const n = g.attributes.position.count;
		g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
		hurufGeo.push(g);
	});
	const hurufG = urus(mergeGeometries(hurufGeo));
	for (const p of hurufGeo) p.dispose();
	const hurufMesh = new THREE.Mesh(hurufG, mat(new THREE.MeshBasicMaterial({ map: tekstur, transparent: true, depthWrite: false, toneMapped: false })));
	hurufMesh.renderOrder = 1;
	catat(hurufMesh, hurufG);
	grup.add(hurufMesh);

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
	let turun = false;
	const warnaKaca = () => bahanKaca.color.setHex(t.kaca).multiplyScalar(turun ? 0.4 : 1);
	adegan.saatTurun.push(() => {
		turun = true; // the window glow dims with the rest of the life layer
		warnaKaca();
		adegan.tandaiKotor();
	});
	return {
		// "light" or "dark": the ground, road, apron, window glow and floor lettering follow Desk's theme.
		tema(nama) {
			const baru = nama === "dark" ? TEMA.dark : TEMA.light;
			if (baru === t) return;
			t = baru;
			bahanTanah.color.setHex(t.tanah);
			bahanAspal.color.setHex(t.aspal);
			bahanBeton.color.setHex(t.beton);
			warnaKaca();
			gambarHuruf(t);
			adegan.tandaiKotor();
		},
		// The decor's own share of the draw calls and triangles.
		info: () => ({ calls, tris: Math.round(tris), kaca: `#${bahanKaca.color.getHexString()}`, turun }),
		buang() {
			adegan.scene.remove(grup);
			for (const g of geometri) g.dispose();
			for (const b of bahan) b.dispose();
			pohonMesh.dispose();
			tekstur.dispose();
		},
	};
}
