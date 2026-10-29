// Small shape helpers shared by pabrik.js and zona.js: parts with a flat vertex colour, built from code, to be merged.
import * as THREE from "three";

// A part with a flat vertex colour, positioned by its centre.
export function warnai(geo, [x, y, z], warna) {
	geo.translate(x, y, z);
	const c = new THREE.Color(warna);
	const n = geo.attributes.position.count;
	const isi = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) isi.set([c.r, c.g, c.b], i * 3);
	geo.setAttribute("color", new THREE.BufferAttribute(isi, 3));
	return geo;
}
// A box from its two corners.
export const balok = (x0, y0, z0, x1, y1, z1, warna) =>
	warnai(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], warna);
export const tegak = (rAtas, rBawah, tinggi, [x, y, z], warna, seg = 14) =>
	warnai(new THREE.CylinderGeometry(rAtas, rBawah, tinggi, seg), [x, y + tinggi / 2, z], warna);
// A cylinder lying along z (a wheel, a roller).
export const tabungZ = (r, p, [x, y, z], warna) => warnai(new THREE.CylinderGeometry(r, r, p, 14).rotateX(Math.PI / 2), [x, y, z], warna);
// A horizontal plane lying at y (for floor paint), from its two corners.
export function datar(x0, z0, x1, z1, y, warna) {
	const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
	return warnai(g, [(x0 + x1) / 2, y, (z0 + z1) / 2], warna);
}
export const terbuang = (g) => {
	g.deleteAttribute("uv"); // merged meshes with and without a texture must carry the same attributes
	return g;
};
