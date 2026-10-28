// The scene of the Production Floor: renderer, camera, lights, the floor with its aisle lines, and one marker per
// machine slot. Later pieces (machines, labels) hang off the `Adegan` this returns.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Machine numbers per row, back row first; both read left to right from the default camera.
export const BARIS = [
	[14, 13, 12, 11, 10, 9, 8],
	[1, 2, 3, 4, 5, 6, 7],
];
const JARAK_X = 4.2; // between machine centres along a row
const JARAK_Z = 7; // between the two rows
const LEBAR = JARAK_X * 7 + 4;
const DALAM = JARAK_Z + 10;

// Floor position of a machine number; `baris` is the row index in BARIS (0 = back).
export function posisi(nomor) {
	for (let b = 0; b < BARIS.length; b++) {
		const i = BARIS[b].indexOf(nomor);
		if (i >= 0)
			return { x: (i - (BARIS[b].length - 1) / 2) * JARAK_X, z: (b - (BARIS.length - 1) / 2) * JARAK_Z, baris: b };
	}
	return null;
}

// One WebGL context for the whole session: the renderer is created once per mount and `konteks` counts creations.
let konteks = 0;

export function buatAdegan(root) {
	const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
	konteks += 1;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	root.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0xdfe3e8);
	const kamera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
	kamera.position.set(0, 22, 32);
	const kontrol = new OrbitControls(kamera, renderer.domElement);
	kontrol.enableDamping = true;
	kontrol.target.set(0, 0, 0);
	kontrol.maxPolarAngle = Math.PI / 2 - 0.05;
	kontrol.minDistance = 8;
	kontrol.maxDistance = 70;

	// No shadow maps: a soft blob under each machine stands in for a shadow.
	scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3ad, 1.1));
	const matahari = new THREE.DirectionalLight(0xffffff, 1.4);
	matahari.position.set(10, 20, 12);
	scene.add(matahari);

	const lantai = new THREE.Mesh(
		new THREE.PlaneGeometry(LEBAR, DALAM),
		new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.95 })
	);
	lantai.rotation.x = -Math.PI / 2;
	scene.add(lantai);

	// Yellow aisle lines: along each side of the walkway between the rows, and across the front.
	const garis = new THREE.LineBasicMaterial({ color: 0xe0b100 });
	const titik = (...p) => p.map(([x, z]) => new THREE.Vector3(x, 0.01, z));
	const sisi = LEBAR / 2 - 1;
	for (const z of [-1.4, 1.4])
		scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(titik([-sisi, z], [sisi, z])), garis));
	scene.add(
		new THREE.Line(
			new THREE.BufferGeometry().setFromPoints(titik([-sisi, DALAM / 2 - 1], [sisi, DALAM / 2 - 1])),
			garis
		)
	);

	// A slot marker per machine number, so the floor shows where each one stands.
	const penanda = new THREE.Group();
	const bahanPenanda = new THREE.MeshBasicMaterial({ color: 0x8a94a0, transparent: true, opacity: 0.55 });
	const bentukPenanda = new THREE.RingGeometry(0.9, 1.1, 32);
	for (const baris of BARIS)
		for (const nomor of baris) {
			const p = posisi(nomor);
			const m = new THREE.Mesh(bentukPenanda, bahanPenanda);
			m.rotation.x = -Math.PI / 2;
			m.position.set(p.x, 0.02, p.z);
			m.userData.nomor = nomor;
			penanda.add(m);
		}
	scene.add(penanda);

	const jam = new THREE.Clock();
	const penyegar = []; // label refreshers, run when the camera moved or `tandaiKotor()` was called
	let kotor = true;
	let jalan = false;
	let frame = 0;
	let total = 0; // frames drawn since mount, never reset: tools compare it to see whether the loop runs
	let mulaiFps = performance.now();
	let fps = 0;
	const tandaiKotor = () => {
		kotor = true;
	};
	kontrol.addEventListener("change", tandaiKotor);

	function ukuran() {
		const l = root.clientWidth || 1;
		const t = root.clientHeight || 1;
		renderer.setSize(l, t);
		kamera.aspect = l / t;
		kamera.updateProjectionMatrix();
		tandaiKotor();
	}
	const pengamat = new ResizeObserver(ukuran);
	pengamat.observe(root);
	ukuran();

	function putar() {
		const dt = Math.min(jam.getDelta(), 0.1);
		kontrol.update(dt);
		if (kotor) {
			for (const s of penyegar) s();
			kotor = false;
		}
		renderer.render(scene, kamera);
		frame += 1;
		total += 1;
		const sekarang = performance.now();
		if (sekarang - mulaiFps >= 1000) {
			fps = (frame * 1000) / (sekarang - mulaiFps);
			frame = 0;
			mulaiFps = sekarang;
		}
	}

	// Hidden tab: stop drawing. `jeda`/`lanjut` are also called by the page when Desk hides or shows it.
	let ditahan = false;
	const lanjut = () => {
		if (jalan || document.hidden || ditahan) return;
		jalan = true;
		jam.getDelta();
		renderer.setAnimationLoop(putar);
	};
	const jeda = () => {
		jalan = false;
		renderer.setAnimationLoop(null);
	};
	const saatTampil = () => (document.hidden ? jeda() : lanjut());
	document.addEventListener("visibilitychange", saatTampil);

	return {
		scene,
		kamera,
		penanda,
		penyegar,
		tandaiKotor,
		lanjut: () => {
			ditahan = false;
			lanjut();
		},
		jeda: () => {
			ditahan = true;
			jeda();
		},
		perbarui() {
			// Machines arrive in a later task; the empty floor has nothing to update.
			tandaiKotor();
		},
		info() {
			kamera.updateMatrixWorld();
			const lebar = renderer.domElement.clientWidth;
			const tinggi = renderer.domElement.clientHeight;
			const v = new THREE.Vector3();
			return {
				render: { ...renderer.info.render },
				memory: { ...renderer.info.memory },
				fps,
				frame,
				total,
				konteks,
				// Slot markers projected to screen pixels, for tools/lantai.mjs.
				penanda: penanda.children.map((m) => {
					v.copy(m.position).project(kamera);
					return { nomor: m.userData.nomor, x: ((v.x + 1) / 2) * lebar, y: ((1 - v.y) / 2) * tinggi };
				}),
			};
		},
		buang() {
			jeda();
			document.removeEventListener("visibilitychange", saatTampil);
			pengamat.disconnect();
			kontrol.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
		},
	};
}
