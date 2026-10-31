// The floor plan of the Production Floor: where the machine slots, the building and the zones are, and the forklift's
// loop. Pure data and arithmetic (no imports, no three.js) so tools/denah.test.mjs can check it in Node.

// Machine numbers per row, back row first; both read left to right from the default camera.
export const BARIS = [
	[14, 13, 12, 11, 10, 9, 8],
	[1, 2, 3, 4, 5, 6, 7],
];
const JARAK_X = 4.2; // between machine centres along a row
const JARAK_Z = 7; // between the two rows
const SISA_PER_BARIS = 7;
const SISA_Z0 = 6.3; // the first spare row, in front of row 2
const SISA_DZ = 2.6;
const bulat = (n) => Math.round(n * 1000) / 1000; // -12.6, not -12.600000000000001

// Floor position of a machine number; `baris` is the row index in BARIS (0 = back). Null for a number with no slot.
export function posisi(nomor) {
	for (let b = 0; b < BARIS.length; b++) {
		const i = BARIS[b].indexOf(nomor);
		if (i >= 0)
			return { x: bulat((i - (BARIS[b].length - 1) / 2) * JARAK_X), z: bulat((b - (BARIS.length - 1) / 2) * JARAK_Z), baris: b };
	}
	return null;
}

// The i-th spare spot (0-based) for a machine whose slot is taken or whose number has none.
export function posisiSisa(i) {
	const b = Math.floor(i / SISA_PER_BARIS);
	const j = i % SISA_PER_BARIS;
	return { x: bulat((j - (SISA_PER_BARIS - 1) / 2) * JARAK_X), z: bulat(SISA_Z0 + b * SISA_DZ), baris: BARIS.length + b };
}

// The floor slab of the building (x/z, metres).
export const SLAB = { x0: -30, x1: 30, z0: -14, z1: 12 };
// Back wall at z0, side walls at x0 and x1; the front is open (cut away like a dollhouse).
export const DINDING = { tinggi: 2.4 };
// The rolling door in the right wall, to the loading dock outside x1.
export const PINTU = { x: 30, z0: -4, z1: 2 };

// Painted zones, all inside the slab and clear of the machine rows, the spare rows and the forklift's loop.
export const ZONA = {
	bahan: { x0: -29, x1: -20, z0: -12, z1: -1 }, // raw material
	cetakan: { x0: -29, x1: -20, z0: 1, z1: 6 }, // mould rack
	qc: { x0: -28, x1: -21, z0: 7.5, z1: 11 }, // glass QC / office box (off the aisle and the door's path)
	jadi: { x0: 20, x1: 29, z0: -12, z1: -5 }, // finished goods
	reject: { x0: 20, x1: 24, z0: 4, z1: 9 },
	giling: { x0: 25, x1: 29, z0: 4, z1: 9 }, // grinder (regrind)
};

// The forklift's closed loop: raw material, the aisle z = 0, finished goods, the door. `henti` is the pause in ms.
export const JALUR = [
	{ x: -20.6, z: -3, henti: 2500 }, // bahan: beside the lettering plate, not on it
	{ x: -20.6, z: 0, henti: 0 },
	{ x: 21, z: 0, henti: 0 }, // along the aisle
	{ x: 28.3, z: -7, henti: 2500 }, // jadi: beside the lettering plate, not on it
	{ x: 31.5, z: -1, henti: 3000 }, // the door, by the truck
	{ x: 21, z: 0, henti: 0 }, // back along the aisle
	{ x: -20.6, z: 0, henti: 0 },
];
