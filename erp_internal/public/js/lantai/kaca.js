// The liquid glass look shared by every card over the 3D floor (info bar, KPI row, machine table, camera bar,
// side panel, and the labels without the blur: see label.js): a translucent fill blurred over the scene, a thin light edge, a large radius and a soft
// shadow. Light and dark follow Desk's theme through the host's `data-tema` (set by the bundle). Without
// backdrop-filter, or when the user asks for less transparency, the cards are solid.
//
// The tokens are our own, not Desk's, so every text keeps a contrast of at least 4.5:1 on its card in both themes
// (tools/lantai.mjs "glass" measures it).
export const GAYA_KACA = `
:host{
	--kaca-isi:rgba(255,255,255,.72);--kaca-isi-label:rgba(255,255,255,.86);--kaca-padat:#f7f8fa;--kaca-tepi:rgba(255,255,255,.85);
	--kaca-garis:rgba(15,23,42,.09);--kaca-sorot:rgba(255,255,255,.65);
	--kaca-bayang:0 10px 30px rgba(15,23,42,.12),0 1px 3px rgba(15,23,42,.08);
	--kaca-teks:#0f172a;--kaca-redup:#475569;--kaca-jalur:rgba(15,23,42,.1);
	--kaca-tombol:rgba(255,255,255,.55);--kaca-tombol-hover:rgba(255,255,255,.95);
	--kaca-tolak:#fde8e8;--kaca-tolak-teks:#a61b1b;--kaca-pilih:rgba(37,99,235,.12);--kaca-aksen:#1d4ed8;
	--kaca-radius:18px;--kaca-blur:blur(20px) saturate(180%);
	--lantai-latar:#dfe3e8;
}
:host([data-tema="dark"]){
	--kaca-isi:rgba(22,26,32,.66);--kaca-isi-label:rgba(22,26,32,.82);--kaca-padat:#1c2026;--kaca-tepi:rgba(255,255,255,.14);
	--kaca-garis:rgba(255,255,255,.08);--kaca-sorot:rgba(255,255,255,.08);
	--kaca-bayang:0 10px 30px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.3);
	--kaca-teks:#f1f5f9;--kaca-redup:#a9b4c3;--kaca-jalur:rgba(255,255,255,.14);
	--kaca-tombol:rgba(255,255,255,.07);--kaca-tombol-hover:rgba(255,255,255,.16);
	--kaca-tolak:#3b1618;--kaca-tolak-teks:#ffb4b4;--kaca-pilih:rgba(96,165,250,.18);--kaca-aksen:#93c5fd;
	--lantai-latar:#1e232a;
}
.kartu{background:var(--kaca-isi);-webkit-backdrop-filter:var(--kaca-blur);backdrop-filter:var(--kaca-blur);
	border:1px solid var(--kaca-tepi);border-radius:var(--kaca-radius);
	box-shadow:var(--kaca-bayang),inset 0 1px 0 var(--kaca-sorot);color:var(--kaca-teks)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
	.kartu{background:var(--kaca-padat)}
}
@media (prefers-reduced-transparency:reduce){
	.kartu{background:var(--kaca-padat);-webkit-backdrop-filter:none;backdrop-filter:none}
}
`;
