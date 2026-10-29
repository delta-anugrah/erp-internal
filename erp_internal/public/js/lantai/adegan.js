// The scene of the Production Floor: renderer, camera, lights, the floor with its aisle lines, and one marker per
// machine slot. Later pieces (machines, labels) hang off the `Adegan` this returns.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BARIS, SLAB, posisi } from "./denah.js";

// The floor plan lives in denah.js (pure, so Node can test it); re-exported for the pieces that used to import it here.
export { BARIS, posisi };

// One WebGL context for the whole session: the renderer is created once per mount and `konteks` counts creations.
let konteks = 0;

// Thrown by `buatAdegan` when the browser gives no WebGL context; the caller shows the plain table instead.
export class TanpaWebGL extends Error {}

// Adaptive quality: a rolling mean frame time above BATAS_LAMBAT ms for LAMA_LAMBAT ms drops the pixel ratio to 1
// (and the machines stop their platens) for the rest of the session.
const BATAS_LAMBAT = 22;
const LAMA_LAMBAT = 2000;
const JENDELA = 30; // frames in the rolling mean
const MIN_FRAME = 5; // frames before the mean counts (a very slow machine must not wait for JENDELA)
const LAMA_TERBANG = 700; // ms for the camera's flight to a selected machine
const LAMA_ZUM = 260; // ms for a zoom step of the camera bar
// Floor and background per Desk theme; machines keep their own colours.
const TEMA = {
	light: { latar: 0xdfe3e8, lantai: 0xf2f4f6, penanda: 0x8a94a0 },
	dark: { latar: 0x1e232a, lantai: 0x2b313a, penanda: 0x6b7480 },
};
const JARAK_TERBANG = 12; // camera distance from the machine after the flight
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// The WebGL context, asked for on our own canvas so a missing one is a null to check, not an exception three logs.
function buatRenderer() {
	const kanvas = document.createElement("canvas");
	const atribut = { antialias: true, powerPreference: "high-performance", alpha: false, stencil: false };
	let gl = null;
	try {
		gl = kanvas.getContext("webgl2", atribut) || kanvas.getContext("webgl", atribut);
	} catch {
		gl = null;
	}
	if (!gl) throw new TanpaWebGL("no WebGL context");
	try {
		return new THREE.WebGLRenderer({ canvas: kanvas, context: gl, antialias: true });
	} catch (e) {
		throw new TanpaWebGL(String(e));
	}
}

export function buatAdegan(root) {
	const renderer = buatRenderer();
	konteks += 1;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	root.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0xdfe3e8);
	scene.fog = new THREE.Fog(0xdfe3e8, 90, 220); // the far ground fades into the background
	const kamera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
	kamera.position.set(0, 32, 36);
	const kontrol = new OrbitControls(kamera, renderer.domElement);
	kontrol.enableDamping = true;
	kontrol.target.set(0, 0, 0);
	kontrol.maxPolarAngle = Math.PI / 2 - 0.05;
	kontrol.minDistance = 6;
	kontrol.maxDistance = 70;
	kontrol.saveState(); // the reset button's default view

	// No shadow maps: a soft blob under each machine stands in for a shadow.
	scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3ad, 1.1));
	const matahari = new THREE.DirectionalLight(0xffffff, 1.4);
	matahari.position.set(10, 20, 12);
	scene.add(matahari);

	const bahanLantai = new THREE.MeshLambertMaterial({ color: TEMA.light.lantai });
	const lantai = new THREE.Mesh(new THREE.PlaneGeometry(SLAB.x1 - SLAB.x0, SLAB.z1 - SLAB.z0), bahanLantai);
	lantai.rotation.x = -Math.PI / 2;
	lantai.position.set((SLAB.x0 + SLAB.x1) / 2, 0, (SLAB.z0 + SLAB.z1) / 2);
	scene.add(lantai);

	// Yellow aisle lines: along each side of the walkway between the rows, and across the front.
	const garis = new THREE.LineBasicMaterial({ color: 0xe0b100 });
	const titik = (...p) => p.map(([x, z]) => new THREE.Vector3(x, 0.01, z));
	const sisi = 19; // the lines stop short of the zones at both ends of the hall
	for (const z of [-1.4, 1.4])
		scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(titik([-sisi, z], [sisi, z])), garis));
	scene.add(
		new THREE.Line(new THREE.BufferGeometry().setFromPoints(titik([-sisi, SLAB.z1 - 1], [sisi, SLAB.z1 - 1])), garis)
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
	const tiap = []; // per-frame updates, each called with dt (seconds)
	const saatTurun = []; // called once when adaptive quality drops
	const waktuFrame = new Float32Array(JENDELA);
	let isiFrame = 0;
	let jumlahFrame = 0;
	let akhirFrame = 0;
	let lambatSejak = 0;
	let rendah = false;
	let kotor = true;
	let jalan = false;
	let frame = 0;
	let total = 0; // frames drawn since mount, never reset: tools compare it to see whether the loop runs
	let mulaiFps = performance.now();
	let fps = 0;
	const tandaiKotor = () => {
		kotor = true;
	};
	let gerakTerakhir = 0; // performance.now() of the last camera change
	kontrol.addEventListener("change", () => {
		gerakTerakhir = performance.now();
		tandaiKotor();
	});

	// The camera's flight to a machine: position and target eased from where they were. Scratch vectors only.
	const terbang = {
		aktif: false,
		mulai: 0,
		lama: LAMA_TERBANG,
		dariPos: new THREE.Vector3(),
		dariTarget: new THREE.Vector3(),
		kePos: new THREE.Vector3(),
		keTarget: new THREE.Vector3(),
	};
	// A drag or a wheel during the flight hands the camera back to the user. A held drag counts as moving from
	// its first press, before the camera changes.
	let seret = false;
	kontrol.addEventListener("start", () => {
		terbang.aktif = false;
		seret = true;
	});
	kontrol.addEventListener("end", () => {
		seret = false;
		gerakTerakhir = performance.now();
	});
	function langkahTerbang(sekarang) {
		const t = Math.min((sekarang - terbang.mulai) / terbang.lama, 1);
		const e = easeInOutCubic(t);
		kamera.position.lerpVectors(terbang.dariPos, terbang.kePos, e);
		kontrol.target.lerpVectors(terbang.dariTarget, terbang.keTarget, e);
		if (t >= 1) terbang.aktif = false;
		gerakTerakhir = sekarang;
		tandaiKotor();
	}

	let lebarLayar = 1;
	let tinggiLayar = 1;
	const ruang = { atas: 0, kanan: 0, bawah: 0, kiri: 0 }; // px the cards take; the view fits in the rest
	const tambah = { kanan: 0, bawah: 0 }; // an open side panel: only moves the view's centre, never rescales it
	// The home camera on a spare camera, to measure where the machines and their labels fall in the default view
	// whatever the user did with the live one. Allocated once; used only when the layout changes.
	const kamHome = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
	const pt = new THREE.Vector3();
	const MARGIN_X = 82; // px a label reaches to each side of its machine
	const LONGGAR = 0.8; // the default view zooms out this much beyond the tight fit, to show the building around the machines
const MARGIN_ATAS = 90; // px a label (with a Work Order) rises above its anchor
	// Fits the default view into the free area: the camera's projection becomes a sub-view of a virtual frame scaled
	// by `s` (never above 1) and shifted so the machines and labels, as the home camera sees them, fill the free area
	// and sit centred in it. No offset at all when the cards take nothing.
	function terapkanRuang() {
		const { atas, kanan, bawah, kiri } = ruang;
		if (!atas && !kanan && !bawah && !kiri) {
			kamera.clearViewOffset();
			return;
		}
		kamHome.aspect = lebarLayar / tinggiLayar;
		kamHome.position.copy(kontrol.position0);
		kamHome.lookAt(kontrol.target0);
		kamHome.updateProjectionMatrix();
		kamHome.updateMatrixWorld(true);
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		for (const m of penanda.children)
			for (const y of [0, 2.45]) {
				pt.set(m.position.x, y, m.position.z).project(kamHome);
				const px = ((pt.x + 1) / 2) * lebarLayar;
				const py = ((1 - pt.y) / 2) * tinggiLayar;
				x0 = Math.min(x0, px);
				x1 = Math.max(x1, px);
				y0 = Math.min(y0, py);
				y1 = Math.max(y1, py);
			}
		x0 -= MARGIN_X;
		x1 += MARGIN_X;
		y0 -= MARGIN_ATAS;
		y1 += 10;
		const bebasL = lebarLayar - kiri - kanan;
		const bebasT = tinggiLayar - atas - bawah;
		// The machines and labels fit with room to spare (the building around them shows), never below 0.4.
		const s = Math.max(0.4, Math.min(1, bebasL / (x1 - x0), bebasT / (y1 - y0)) * LONGGAR);
		const dx = s * ((x0 + x1) / 2) - (kiri + (bebasL - tambah.kanan) / 2);
		const dy = s * ((y0 + y1) / 2) - (atas + (bebasT - tambah.bawah) / 2);
		kamera.setViewOffset(lebarLayar * s, tinggiLayar * s, Math.round(dx), Math.round(dy), lebarLayar, tinggiLayar);
	}
	function ukuran() {
		const l = root.clientWidth || 1;
		const t = root.clientHeight || 1;
		lebarLayar = l;
		tinggiLayar = t;
		renderer.setSize(l, t);
		kamera.aspect = l / t;
		terapkanRuang();
		kamera.updateProjectionMatrix();
		tandaiKotor();
	}
	const pengamat = new ResizeObserver(ukuran);
	pengamat.observe(root);
	ukuran();

	function turunkan() {
		rendah = true;
		renderer.setPixelRatio(1);
		ukuran();
		for (const f of saatTurun) f();
	}

	// Real time between frames into the rolling mean; slow for LAMA_LAMBAT straight → lower quality once.
	function ukurFrame(sekarang) {
		if (akhirFrame) {
			const ft = sekarang - akhirFrame;
			jumlahFrame += ft - waktuFrame[isiFrame % JENDELA];
			waktuFrame[isiFrame % JENDELA] = ft;
			isiFrame += 1;
			if (!rendah && isiFrame >= MIN_FRAME) {
				if (jumlahFrame / Math.min(isiFrame, JENDELA) <= BATAS_LAMBAT) lambatSejak = 0;
				else if (!lambatSejak) lambatSejak = sekarang;
				else if (sekarang - lambatSejak >= LAMA_LAMBAT) turunkan();
			}
		}
		akhirFrame = sekarang;
	}

	function putar() {
		const dt = Math.min(jam.getDelta(), 0.1);
		ukurFrame(performance.now());
		if (terbang.aktif) langkahTerbang(performance.now());
		kontrol.update(dt);
		for (const f of tiap) f(dt);
		if (kotor) {
			kamera.updateMatrixWorld(); // projections below must use this frame's camera
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
		// A pause is not a slow frame: start the rolling mean afresh.
		waktuFrame.fill(0);
		isiFrame = jumlahFrame = akhirFrame = lambatSejak = 0;
		renderer.setAnimationLoop(putar);
	};
	const jeda = () => {
		jalan = false;
		renderer.setAnimationLoop(null);
	};
	const saatTampil = () => (document.hidden ? jeda() : lanjut());
	document.addEventListener("visibilitychange", saatTampil);

	const v0 = new THREE.Vector3();

	return {
		scene,
		kamera,
		kanvas: renderer.domElement,
		// ms since the camera last moved (orbit, damping, flight); 0 while a drag is held.
		sejakGerak: () => (seret ? 0 : performance.now() - gerakTerakhir),
		penanda,
		penyegar,
		tiap,
		saatTurun,
		tandaiKotor,
		// Flies the camera to look at (x, y, z) from JARAK_TERBANG away, keeping the current viewing direction.
		terbangKe(x, y, z) {
			terbang.dariPos.copy(kamera.position);
			terbang.dariTarget.copy(kontrol.target);
			terbang.keTarget.set(x, y, z);
			v0.subVectors(kamera.position, kontrol.target);
			if (v0.lengthSq() < 1e-6) v0.set(0, 1, 1);
			terbang.kePos.copy(terbang.keTarget).addScaledVector(v0.normalize(), JARAK_TERBANG);
			terbang.mulai = performance.now();
			terbang.lama = LAMA_TERBANG;
			terbang.aktif = true;
			tandaiKotor();
		},
		// The camera bar's + and −: the distance to the target times `faktor`, within the orbit limits, eased.
		zum(faktor) {
			const dari = terbang.aktif ? terbang.kePos : kamera.position;
			const ke = terbang.aktif ? terbang.keTarget : kontrol.target;
			v0.subVectors(dari, ke);
			const jarak = Math.min(Math.max(v0.length() * faktor, kontrol.minDistance), kontrol.maxDistance);
			if (v0.lengthSq() < 1e-6) v0.set(0, 1, 1);
			terbang.keTarget.copy(ke);
			terbang.kePos.copy(ke).addScaledVector(v0.normalize(), jarak);
			terbang.dariPos.copy(kamera.position);
			terbang.dariTarget.copy(kontrol.target);
			terbang.mulai = performance.now();
			terbang.lama = LAMA_ZUM;
			terbang.aktif = true;
			tandaiKotor();
		},
		// Desk's light or dark theme on the floor and background.
		tema(gelap) {
			const t = gelap ? TEMA.dark : TEMA.light;
			scene.background.setHex(t.latar);
			scene.fog.color.setHex(t.latar);
			bahanLantai.color.setHex(t.lantai);
			bahanPenanda.color.setHex(t.penanda);
			tandaiKotor();
		},
		// Debug for tools/lantai.mjs: put the camera at `pos` looking at `target` (arrays), no flight.
		lihat(pos, target) {
			terbang.aktif = false;
			kamera.position.fromArray(pos);
			kontrol.target.fromArray(target);
			kontrol.update();
			tandaiKotor();
		},
		// The free area for the default view, in px the cards take on each side. The camera's home is the same
		// position and target, so the reset button returns to the view centred in the free area (the offset belongs
		// to the camera, not to the saved state: `saveState()` here would overwrite home with wherever the user is).
		// `panel` ({kanan, bawah}): what the open side panel takes; the view is centred in what is left of the free area.
		aturRuang({ atas = 0, kanan = 0, bawah = 0, kiri = 0 } = {}, { kanan: pk = 0, bawah: pb = 0 } = {}) {
			if (ruang.atas === atas && ruang.kanan === kanan && ruang.bawah === bawah && ruang.kiri === kiri && tambah.kanan === pk && tambah.bawah === pb) return;
			Object.assign(ruang, { atas, kanan, bawah, kiri });
			tambah.kanan = pk;
			tambah.bawah = pb;
			terapkanRuang();
			kamera.updateProjectionMatrix();
			tandaiKotor();
		},
		// Screen pixels of a world point into `out` ({x, y, depan, dalam}); `depan` false when it is behind the
		// camera, `dalam` the depth (smaller is nearer).
		proyeksi(x, y, z, out) {
			v0.set(x, y, z).project(kamera);
			out.x = ((v0.x + 1) / 2) * lebarLayar; // cached sizes: no layout read between label writes
			out.y = ((1 - v0.y) / 2) * tinggiLayar;
			out.depan = v0.z < 1;
			out.dalam = v0.z;
			return out;
		},
		reset() {
			terbang.aktif = false;
			// Damping keeps the last drag's spin; without damping one update applies and clears it, then reset.
			kontrol.enableDamping = false;
			kontrol.update();
			kontrol.reset();
			kontrol.enableDamping = true;
			tandaiKotor();
		},
		lanjut: () => {
			ditahan = false;
			lanjut();
		},
		jeda: () => {
			ditahan = true;
			jeda();
		},
		info() {
			kamera.updateMatrixWorld();
			const lebar = renderer.domElement.clientWidth;
			const tinggi = renderer.domElement.clientHeight;
			const v = new THREE.Vector3();
			return {
				render: { ...renderer.info.render },
				memory: { ...renderer.info.memory },
				programs: renderer.info.programs ? renderer.info.programs.length : 0, // compiled shader programs
				fps,
				frame,
				total,
				konteks,
				kualitas: { rendah, rasio: renderer.getPixelRatio() },
				kamera: kamera.position.toArray(),
				target: kontrol.target.toArray(),
				// Slot markers projected to screen pixels, for tools/lantai.mjs.
				penanda: penanda.children.map((m) => {
					v.copy(m.position).project(kamera);
					return {
						nomor: m.userData.nomor,
						x: ((v.x + 1) / 2) * lebar,
						y: ((1 - v.y) / 2) * tinggi,
						tampak: m.visible,
					};
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
