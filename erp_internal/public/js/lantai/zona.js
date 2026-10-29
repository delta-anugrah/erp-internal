// The painted zones of the factory floor with their props and translated floor lettering (decor, fixed, not data):
// raw material (pallets of resin sacks, a granule dryer), finished goods (pallets of crates, stacked buckets and
// basins), reject (red bins), mould storage (a rack of mould blocks), the grinder and the glass QC office. Built from
// code once. Each repeated prop is one InstancedMesh (pallets, sacks, crates, buckets, basins, bins), the static parts
// are merged per material, the lettering of all six zones is one canvas atlas drawn from the translated strings and
// redrawn only when the theme changes. Nothing is created after load; a theme change only redraws the atlas.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ZONA } from "./denah.js";
import { WARNA_LANTAI } from "./adegan.js";
import { balok, datar, tabungZ, tegak, terbuang, warnai } from "./bentuk.js";

const C = {
	kayu: 0xb08a5a,
	karung: [0xf1ead8, 0xdbe6f2, 0xe8dcc0],
	peti: [0x2f7fd0, 0xe0802a, 0x2fa59a, 0xd9473d],
	ember: [0x2f7fd0, 0xe0802a],
	baskom: [0x2fa59a, 0xd9473d, 0xe8c030],
	baja: 0x59636f,
	gelap: 0x363b42,
	merah: 0xc9362d,
	rangka: 0xdfe3e8,
};
// Per theme: the lettering and its plate (hex and opacity), and `padat`, the tint that multiplies the props' vertex
// colours (the light sacks and crates would glare on the dark floor).
const TEMA = {
	light: { huruf: 0x15202b, pelat: 0xffffff, alfa: 0.82, padat: 0xffffff },
	dark: { huruf: 0xf1f5f9, pelat: 0x14181e, alfa: 0.82, padat: 0x8f969f },
};
const css = (hex) => `#${hex.toString(16).padStart(6, "0")}`;
const rgba = (hex, a) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
const kanal = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const FLOOR_FILL = 0.26; // the zone fill's opacity over the floor (below)
// WCAG contrast of two sRGB triples.
const terang = (c) => {
	const [r, g, b] = c.map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const kontrasDari = (a, b) => {
	const [x, y] = [terang(a), terang(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
};
// Floor paint per zone (fill and border).
const CAT = { bahan: 0x4d7fbf, cetakan: 0x7a8794, qc: 0x3fa5a8, jadi: 0x3fae6a, reject: 0xd9473d, giling: 0xe0902a };
// The lettering, in atlas order, and its translated text. Each string is a literal __() call so the translation
// scanner finds it.
const HURUF = ["bahan", "jadi", "reject", "cetakan", "giling", "qc"];
const TEKS = {
	bahan: () => __("Raw Material"),
	jadi: () => __("Finished Goods"),
	reject: () => __("Reject"),
	cetakan: () => __("Mould Storage"),
	giling: () => __("Grinder"),
	qc: () => __("QC Office"),
};
// Each plate: its width and the z of its centre (x is the zone's centre). Every plate lies on the slab at or inside
// its zone, clear of the props: the raw material's sits between the pallets and the aisle, the QC's inside the glass
// box beside the desk (on the box's own floor, y 0.1).
const PELAT = {
	bahan: { lebar: 6, cz: -3.3 },
	jadi: { lebar: 6, cz: -6.1 },
	reject: { lebar: 3.2, cz: 8.25 },
	cetakan: { lebar: 4.8, cz: 5.25 },
	giling: { lebar: 3.2, cz: 8.25 },
	qc: { lebar: 6.2, cz: 10.125, y: 0.1 },
};
const SEL_L = 512; // the atlas: 2 columns x 3 rows of 512x128 cells (4:1)
const SEL_T = 128;
const KOLOM = 2;
const BARIS = 3;
const TINGGI_QC = 2.3;

// --- the static parts (merged, vertex colours) ---------------------------------------------------------------------
function dryer(g) {
	const z = ZONA.bahan;
	const dx = z.x1 - 1.4;
	const dz = -9;
	for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) g.push(balok(dx + a - 0.05, 0, dz + b - 0.05, dx + a + 0.05, 0.7, dz + b + 0.05, C.baja));
	g.push(tegak(0.7, 0.7, 1.5, [dx, 0.7, dz], 0xc9d1d8, 18)); // drum
	g.push(tegak(0.7, 0.18, 0.55, [dx, 0.15, dz], 0xa9b1ba, 18)); // discharge cone
	g.push(tegak(0.7, 0.05, 0.3, [dx, 2.2, dz], 0xd8dde2, 18)); // hopper
	g.push(tegak(0.07, 0.07, 1.2, [dx, 1.0, dz + 0.78], C.baja, 8)); // feed pipe
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
			g.push(balok(cx - 0.55, y + 0.06, rz - 0.4, cx + 0.55, y + 0.06 + 0.5 + (i % 2) * 0.1, rz + 0.4, i % 2 ? 0x6c7581 : 0x8a929b)); // a mould block
			g.push(balok(cx - 0.12, y + 0.06 + 0.5 + (i % 2) * 0.1, rz - 0.1, cx + 0.12, y + 0.14 + 0.5 + (i % 2) * 0.1, rz + 0.1, C.baja)); // its lifting eye
		}
	}
	// Two moulds waiting on the floor in front (clear of the lettering plate).
	g.push(balok(z.x0 + 2.2, 0, z.z1 - 2.2, z.x0 + 3.5, 0.55, z.z1 - 1.4, 0x6c7581));
	g.push(balok(z.x0 + 4.2, 0, z.z1 - 2.1, z.x0 + 5.3, 0.45, z.z1 - 1.4, 0x8a929b));
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
// The glass QC office: frame, floor, desk with a monitor and an inspection table (the glass is its own material).
function kotakQc(g) {
	const q = ZONA.qc;
	const t = TINGGI_QC;
	for (const x of [q.x0, q.x1]) for (const z of [q.z0, q.z1]) g.push(balok(x - 0.06, 0, z - 0.06, x + 0.06, t, z + 0.06, C.rangka));
	g.push(balok(q.x0 - 0.06, t - 0.04, q.z0 - 0.06, q.x1 + 0.06, t + 0.06, q.z0 + 0.06, C.rangka));
	g.push(balok(q.x0 - 0.06, t - 0.04, q.z1 - 0.06, q.x1 + 0.06, t + 0.06, q.z1 + 0.06, C.rangka));
	g.push(balok(q.x0 - 0.06, 0, q.z0 - 0.06, q.x1 + 0.06, 0.08, q.z1 + 0.06, 0xcfe6e8));
	g.push(balok(q.x0 + 0.5, 0.7, q.z0 + 0.4, q.x0 + 2.6, 0.76, q.z0 + 1.2, 0x8a6a45)); // desk
	g.push(balok(q.x0 + 0.5, 0, q.z0 + 0.4, q.x0 + 0.58, 0.7, q.z0 + 1.2, C.baja)); // its legs
	g.push(balok(q.x0 + 2.52, 0, q.z0 + 0.4, q.x0 + 2.6, 0.7, q.z0 + 1.2, C.baja));
	g.push(balok(q.x0 + 1.1, 0.76, q.z0 + 0.55, q.x0 + 1.7, 1.06, q.z0 + 0.62, C.gelap)); // monitor
	g.push(balok(q.x0 + 1.35, 0.76, q.z0 + 0.62, q.x0 + 1.45, 0.82, q.z0 + 0.7, C.gelap));
	g.push(balok(q.x1 - 2.4, 0.85, q.z0 + 0.6, q.x1 - 0.6, 0.9, q.z0 + 1.6, 0xa9b1ba)); // inspection table
	for (const [a, b] of [[-2.35, 0.65], [-0.65, 0.65], [-2.35, 1.55], [-0.65, 1.55]]) g.push(balok(q.x1 + a, 0, q.z0 + b - 0.04, q.x1 + a + 0.08, 0.85, q.z0 + b + 0.04, C.baja));
}

// --- the instanced props: one shape, a list of placements ----------------------------------------------------------------
const WARNA_PUTIH = 0xffffff;
const kayuGeo = () => {
	const g = [balok(-0.6, 0.09, -0.6, 0.6, 0.14, 0.6, C.kayu)]; // deck
	for (const x of [-0.55, 0, 0.55]) g.push(balok(x - 0.05, 0.0, -0.6, x + 0.05, 0.09, 0.6, 0x8d6a40)); // stringers
	return mergeGeometries(g.map(terbuang));
};
// A crate: a tinted body with a darker inset top (the tint multiplies the vertex colours).
const petiGeo = () => mergeGeometries([balok(-0.27, 0, -0.27, 0.27, 0.28, 0.27, WARNA_PUTIH), balok(-0.21, 0.27, -0.21, 0.21, 0.285, 0.21, 0x777777)].map(terbuang));
const karungGeo = () => mergeGeometries([balok(-0.27, 0, -0.19, 0.27, 0.15, 0.19, WARNA_PUTIH), balok(-0.27, 0.12, -0.19, 0.27, 0.17, -0.12, 0xcfcfcf)].map(terbuang));
// A bucket and a basin are tapered cylinders, wide at the top; the bucket has a darker rim.
const emberGeo = () => mergeGeometries([tegak(0.3, 0.22, 0.32, [0, 0, 0], WARNA_PUTIH, 14), tegak(0.31, 0.31, 0.04, [0, 0.3, 0], 0xdddddd, 14)].map(terbuang));
const baskomGeo = () => mergeGeometries([tegak(0.5, 0.38, 0.26, [0, 0, 0], WARNA_PUTIH, 16)].map(terbuang));
const tongGeo = () => mergeGeometries([balok(-0.5, 0, -0.5, 0.5, 0.9, 0.5, C.merah), balok(-0.4, 0.88, -0.4, 0.4, 0.92, 0.4, 0x4a1612)].map(terbuang));

// Pallets: 12 under the sacks, 6 under the crates.
const PALET_KARUNG = [-27.8, -26.1, -24.4].flatMap((x) => [-10.8, -9.1, -7.4, -5.7].map((z) => [x, z]));
const PALET_PETI = [21.8, 24.4, 27.0].flatMap((x) => [-11.2, -9.5].map((z) => [x, z]));
const EMBER = [[27.2, -7.7], [28.3, -7.7], [27.75, -8.5]];
const BASKOM = [[20.9, -7.9], [22.0, -7.9]];
const TONG = [20.0 + 1.1, 24 - 1.1].flatMap((x) => [4 + 1.1, 4 + 2.7].map((z) => [x, z]));

export function buatZona(adegan) {
	const grup = new THREE.Group();
	const geometri = [];
	const bahan = [];
	let calls = 0;
	let tris = 0;
	const urus = (geo) => (geometri.push(geo), geo);
	const mat = (m) => (bahan.push(m), m);
	const catat = (geo, jumlah = 1) => {
		calls += 1;
		tris += ((geo.index ? geo.index.count : geo.attributes.position.count) / 3) * jumlah;
	};
	const gabung = (daftar) => {
		const g = mergeGeometries(daftar.map(terbuang));
		for (const p of daftar) p.dispose();
		return urus(g);
	};
	const lambert = mat(new THREE.MeshLambertMaterial({ vertexColors: true }));
	lambert.color.setHex(TEMA.light.padat);

	// --- static solids: one merged mesh ---------------------------------------------------------------------------
	const padat = [];
	dryer(padat);
	rakCetakan(padat);
	penggiling(padat);
	kotakQc(padat);
	const padatGeo = gabung(padat);
	grup.add(new THREE.Mesh(padatGeo, lambert));
	catat(padatGeo);

	// --- the glass of the QC office ---------------------------------------------------------------------------------
	const q = ZONA.qc;
	const sisi = (x0, z0, x1, z1) =>
		new THREE.BoxGeometry(Math.max(x1 - x0, 0.03), TINGGI_QC - 0.1, Math.max(z1 - z0, 0.03)).translate((x0 + x1) / 2, TINGGI_QC / 2 + 0.04, (z0 + z1) / 2);
	const kaca = [sisi(q.x0, q.z1, q.x1, q.z1), sisi(q.x0, q.z0, q.x1, q.z0), sisi(q.x0, q.z0, q.x0, q.z1), sisi(q.x1, q.z0, q.x1, q.z1)];
	kaca.push(new THREE.BoxGeometry(q.x1 - q.x0, 0.03, q.z1 - q.z0).translate((q.x0 + q.x1) / 2, TINGGI_QC, (q.z0 + q.z1) / 2));
	const kacaGeo = gabung(kaca);
	const kacaMesh = new THREE.Mesh(kacaGeo, mat(new THREE.MeshLambertMaterial({ color: 0xa8d4e6, transparent: true, opacity: 0.22, depthWrite: false })));
	kacaMesh.renderOrder = 2;
	grup.add(kacaMesh);
	catat(kacaGeo);

	// --- instanced props ---------------------------------------------------------------------------------------------
	const m4 = new THREE.Matrix4();
	const putar = new THREE.Quaternion();
	const skala = new THREE.Vector3(1, 1, 1);
	const warna = new THREE.Color();
	// `tempat` is a list of [x, y, z, yaw, hex | null]; one InstancedMesh for the lot.
	function pasang(geo, tempat) {
		urus(geo);
		const mesh = new THREE.InstancedMesh(geo, lambert, tempat.length);
		tempat.forEach(([x, y, z, yaw, hex], i) => {
			putar.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
			mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), putar, skala));
			if (hex !== null) mesh.setColorAt(i, warna.setHex(hex));
		});
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		mesh.frustumCulled = false;
		grup.add(mesh);
		catat(geo, tempat.length);
	}
	const palet = [...PALET_KARUNG, ...PALET_PETI].map(([x, z]) => [x, 0, z, 0, null]);
	pasang(kayuGeo(), palet);
	// Sacks: 6 to a layer (2 x 3), alternate layers turned a quarter; 3 to 5 layers, a tint per pallet.
	const karung = [];
	PALET_KARUNG.forEach(([x, z], p) => {
		const lapis = 3 + (p % 3);
		const tint = C.karung[p % 3];
		for (let l = 0; l < lapis; l++) {
			const y = 0.14 + l * 0.165;
			const putarLapis = l % 2 ? Math.PI / 2 : 0;
			for (const a of [-0.27, 0.27]) for (const b of [-0.38, 0, 0.38]) {
				const dx = l % 2 ? b : a;
				const dz = l % 2 ? a : b;
				karung.push([x + dx, y, z + dz, putarLapis, tint]);
			}
		}
	});
	pasang(karungGeo(), karung);
	// Crates: 2 x 2 to a layer, 2 to 3 layers, a colour per layer.
	const peti = [];
	PALET_PETI.forEach(([x, z], p) => {
		const lapis = 2 + (p % 2);
		for (let l = 0; l < lapis; l++) for (const a of [-0.28, 0.28]) for (const b of [-0.28, 0.28]) peti.push([x + a, 0.14 + l * 0.28, z + b, 0, C.peti[(p + l) % 4]]);
	});
	pasang(petiGeo(), peti);
	// Buckets and basins, stacked three high (each nests 0.04 into the one below).
	const ember = [];
	EMBER.forEach(([x, z], s) => { for (let k = 0; k < 3; k++) ember.push([x, k * 0.27, z, 0, C.ember[s % 2]]); });
	pasang(emberGeo(), ember);
	const baskom = [];
	BASKOM.forEach(([x, z], s) => { for (let k = 0; k < 3; k++) baskom.push([x, k * 0.22, z, 0, C.baskom[s % 3]]); });
	pasang(baskomGeo(), baskom);
	pasang(tongGeo(), TONG.map(([x, z]) => [x, 0, z, 0, null]));

	// --- floor paint: zone fills and borders (flat, transparent) ------------------------------------------------------
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
	for (const [daftar, opasitas] of [[isi, FLOOR_FILL], [garis, 0.75]]) {
		const geo = gabung(daftar);
		grup.add(new THREE.Mesh(geo, mat(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: opasitas, depthWrite: false, toneMapped: false }))));
		catat(geo);
	}

	// --- floor lettering: one atlas canvas, one quad per zone ----------------------------------------------------------
	const kanvas = document.createElement("canvas");
	kanvas.width = SEL_L * KOLOM;
	kanvas.height = SEL_T * BARIS;
	const ctx = kanvas.getContext("2d");
	const tekstur = new THREE.CanvasTexture(kanvas);
	tekstur.anisotropy = 4;
	tekstur.colorSpace = THREE.SRGBColorSpace;
	let tulisan = [];
	function gambarHuruf(t) {
		ctx.clearRect(0, 0, kanvas.width, kanvas.height);
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		tulisan = HURUF.map((nama, i) => {
			const x = (i % KOLOM) * SEL_L;
			const y = Math.floor(i / KOLOM) * SEL_T;
			const teks = TEKS[nama]();
			let ukuran = 92;
			const font = () => `700 ${ukuran}px system-ui, -apple-system, "Segoe UI", sans-serif`;
			ctx.font = font();
			while (ctx.measureText(teks).width > SEL_L - 70 && ukuran > 20) {
				ukuran -= 4;
				ctx.font = font();
			}
			const lebar = ctx.measureText(teks).width + 44;
			ctx.fillStyle = rgba(t.pelat, t.alfa);
			ctx.beginPath();
			if (ctx.roundRect) ctx.roundRect(x + (SEL_L - lebar) / 2, y + 8, lebar, SEL_T - 16, 20);
			else ctx.rect(x + (SEL_L - lebar) / 2, y + 8, lebar, SEL_T - 16);
			ctx.fill();
			ctx.fillStyle = css(t.huruf);
			ctx.fillText(teks, x + SEL_L / 2, y + SEL_T / 2 + 3);
			return teks;
		});
		tekstur.needsUpdate = true;
	}
	gambarHuruf(TEMA.light);
	const pelat = {};
	const hurufGeo = HURUF.map((nama, i) => {
		const k = ZONA[nama];
		const { lebar, cz, y = 0.03 } = PELAT[nama];
		const tinggi = lebar / 4;
		const cx = (k.x0 + k.x1) / 2;
		pelat[nama] = { x0: cx - lebar / 2, x1: cx + lebar / 2, z0: cz - tinggi / 2, z1: cz + tinggi / 2 };
		const g = new THREE.PlaneGeometry(lebar, tinggi).rotateX(-Math.PI / 2).translate(cx, y, cz);
		const uv = g.attributes.uv;
		const u0 = (i % KOLOM) / KOLOM;
		const v0 = 1 - (Math.floor(i / KOLOM) + 1) / BARIS;
		for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) / KOLOM, v0 + uv.getY(j) / BARIS);
		g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
		return g;
	});
	const hurufG = urus(mergeGeometries(hurufGeo));
	for (const p of hurufGeo) p.dispose();
	const hurufMesh = new THREE.Mesh(hurufG, mat(new THREE.MeshBasicMaterial({ map: tekstur, transparent: true, depthWrite: false, toneMapped: false })));
	hurufMesh.renderOrder = 1;
	grup.add(hurufMesh);
	catat(hurufG);

	adegan.scene.add(grup);

	let t = TEMA.light;
	let namaTema = "light";
	// The lettering against its zone as drawn: the plate over the zone's fill over the floor, in sRGB (the paint is
	// unlit MeshBasicMaterial, blended in output space).
	const kontras = () =>
		Object.fromEntries(
			HURUF.map((nama) => {
				const lantai = kanal(WARNA_LANTAI[namaTema]);
				const isi = kanal(CAT[nama]).map((v, i) => v * FLOOR_FILL + lantai[i] * (1 - FLOOR_FILL));
				const diatas = kanal(t.pelat).map((v, i) => v * t.alfa + isi[i] * (1 - t.alfa));
				return [nama, kontrasDari(kanal(t.huruf), diatas)];
			})
		);
	return {
		// "light" or "dark": the floor lettering follows Desk's theme (the atlas is redrawn; nothing else changes).
		tema(nama) {
			const baru = nama === "dark" ? TEMA.dark : TEMA.light;
			if (baru === t) return;
			t = baru;
			namaTema = nama === "dark" ? "dark" : "light";
			lambert.color.setHex(t.padat);
			gambarHuruf(t);
			adegan.tandaiKotor();
		},
		// The zones' share of the draw calls and triangles, the lettering as drawn and where each plate lies.
		info: () => ({
			calls,
			tris: Math.round(tris),
			tulisan: [...tulisan],
			pelat,
			tema: namaTema,
			// A sack of resin as the screen shows it (vertex colour x theme tint), and the lettering contrast per zone.
			alat: `#${new THREE.Color(0xf1ead8).multiply(lambert.color).getHexString()}`,
			kontras: kontras(),
		}),
		buang() {
			adegan.scene.remove(grup);
			for (const g of geometri) g.dispose();
			for (const b of bahan) b.dispose();
			tekstur.dispose();
		},
	};
}
