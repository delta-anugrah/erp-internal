// Pure checks of the floor plan (erp_internal/public/js/lantai/denah.js): `node --test tools/denah.test.mjs`.
import assert from "node:assert/strict";
import test from "node:test";
import { BARIS, DINDING, JALUR, PINTU, SLAB, ZONA, posisi, posisiSisa } from "../erp_internal/public/js/lantai/denah.js";

const zona = Object.entries(ZONA);
const MARGIN = 1.5;

// Distance from point (x, z) to the rectangle z (0 inside).
function jarakKotak(x, zz, k) {
	const dx = Math.max(k.x0 - x, 0, x - k.x1);
	const dz = Math.max(k.z0 - zz, 0, zz - k.z1);
	return Math.hypot(dx, dz);
}
// Distance from point p to segment a-b.
function jarakRuas(p, a, b) {
	const vx = b.x - a.x;
	const vz = b.z - a.z;
	const l2 = vx * vx + vz * vz;
	const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / l2)) : 0;
	return Math.hypot(p.x - (a.x + t * vx), p.z - (a.z + t * vz));
}
// Does segment a-b cross the rectangle k (Liang-Barsky)?
function memotong(a, b, k) {
	let t0 = 0;
	let t1 = 1;
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	for (const [p, q] of [
		[-dx, a.x - k.x0],
		[dx, k.x1 - a.x],
		[-dz, a.z - k.z0],
		[dz, k.z1 - a.z],
	]) {
		if (p === 0) {
			if (q < 0) return false;
		} else {
			const r = q / p;
			if (p < 0) {
				if (r > t1) return false;
				t0 = Math.max(t0, r);
			} else {
				if (r < t0) return false;
				t1 = Math.min(t1, r);
			}
		}
	}
	return t0 <= t1;
}
const ruas = () => JALUR.map((a, i) => [a, JALUR[(i + 1) % JALUR.length]]);

test("zones lie inside the slab", () => {
	for (const [nama, k] of zona) {
		assert.ok(k.x0 < k.x1 && k.z0 < k.z1, `${nama} is not a proper rectangle`);
		assert.ok(k.x0 >= SLAB.x0 && k.x1 <= SLAB.x1 && k.z0 >= SLAB.z0 && k.z1 <= SLAB.z1, `${nama} leaves the slab`);
	}
	assert.equal(DINDING.tinggi, 2.4);
});

test("no two zones overlap", () => {
	for (let i = 0; i < zona.length; i++)
		for (let j = i + 1; j < zona.length; j++) {
			const [na, a] = zona[i];
			const [nb, b] = zona[j];
			assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0, `${na} overlaps ${nb}`);
		}
});

test("every machine slot and the first 14 spare slots keep 1.5 from every zone and every JALUR segment", () => {
	const slot = [];
	for (const b of BARIS) for (const n of b) slot.push([`slot ${n}`, posisi(n)]);
	for (let i = 0; i < 14; i++) slot.push([`spare ${i}`, posisiSisa(i)]);
	assert.equal(slot.length, 28);
	for (const [nama, p] of slot) {
		for (const [nz, k] of zona) assert.ok(jarakKotak(p.x, p.z, k) >= MARGIN, `${nama} is too near ${nz}`);
		for (const [a, b] of ruas()) assert.ok(jarakRuas(p, a, b) >= MARGIN, `${nama} is too near the forklift loop`);
		assert.ok(p.x >= SLAB.x0 && p.x <= SLAB.x1 && p.z >= SLAB.z0 && p.z <= SLAB.z1, `${nama} is off the slab`);
	}
});

test("posisi matches the old layout", () => {
	assert.deepEqual(posisi(1), { x: -12.6, z: 3.5, baris: 1 });
	assert.deepEqual(posisi(14), { x: -12.6, z: -3.5, baris: 0 });
	assert.equal(posisi(15), null);
	assert.equal(posisi(0), null);
	assert.deepEqual(posisiSisa(0), { x: -12.6, z: 6.3, baris: 2 });
	assert.equal(posisiSisa(8).z, 8.9);
	assert.equal(posisiSisa(8).baris, 3);
});

test("JALUR is closed and every stop lies in bahan, jadi or by PINTU", () => {
	assert.ok(JALUR.length >= 4);
	// JALUR is an open list that the forklift loops: the segment from the last point back to the first must be a real,
	// short hop (the last point is on the aisle z = 0 right by bahan, the first is the stop inside bahan).
	const awal = JALUR[0];
	const akhir = JALUR[JALUR.length - 1];
	assert.ok(awal.x >= ZONA.bahan.x0 && awal.x <= ZONA.bahan.x1 && awal.z >= ZONA.bahan.z0 && awal.z <= ZONA.bahan.z1, "the loop starts in bahan");
	assert.equal(akhir.z, 0, "the loop ends on the aisle z = 0");
	assert.ok(Math.hypot(akhir.x - awal.x, akhir.z - awal.z) <= 4, "the wrap segment from the last point to the first is short");
	const dalam = (p, k) => p.x >= k.x0 && p.x <= k.x1 && p.z >= k.z0 && p.z <= k.z1;
	const dekatPintu = (p) => jarakKotak(p.x, p.z, { x0: PINTU.x, x1: PINTU.x, z0: PINTU.z0, z1: PINTU.z1 }) <= 3;
	const henti = JALUR.filter((p) => p.henti > 0);
	assert.ok(henti.length >= 3, "the forklift pauses at bahan, jadi and the door");
	for (const p of henti) assert.ok(dalam(p, ZONA.bahan) || dalam(p, ZONA.jadi) || dekatPintu(p), `stop ${p.x},${p.z} is nowhere useful`);
	assert.ok(henti.some((p) => dalam(p, ZONA.bahan)) && henti.some((p) => dalam(p, ZONA.jadi)) && henti.some(dekatPintu));
	// The aisle z = 0 is part of the loop.
	assert.ok(ruas().some(([a, b]) => a.z === 0 && b.z === 0 && Math.abs(a.x - b.x) > 20), "the aisle z = 0 is on the loop");
	for (const p of JALUR) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && p.henti >= 0);
});

test("no JALUR segment crosses a zone other than bahan and jadi", () => {
	for (const [a, b] of ruas())
		for (const [nama, k] of zona) {
			if (nama === "bahan" || nama === "jadi") continue;
			assert.ok(!memotong(a, b, k), `segment ${a.x},${a.z} to ${b.x},${b.z} crosses ${nama}`);
		}
});
