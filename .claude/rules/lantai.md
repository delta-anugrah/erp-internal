---
paths: ["erp_internal/production_floor.py", "erp_internal/public/js/lantai.bundle.js", "erp_internal/public/js/lantai/**", "erp_internal/erp_internal/page/production_floor/**", "tools/lantai.mjs"]
---
# Production Floor (`/desk/production-floor`)

Server: `production_floor.py` (`get_data`, POST `set_status`, realtime `production_floor`). Client: the page script
(small, only the plain table and `erp.lantai.ambil`) and `lantai.bundle.js` with `lantai/{denah,adegan,mesin,pabrik,zona,hidup,bentuk,label,panel,hud,kaca}.js`.
The full description is in CLAUDE.md's "Where things are"; the design and its two revisions in
`docs/superpowers/specs/2026-10-28-production-floor-design.md`.

## Names

- Anything in a URL, an API path or an event is English (`production-floor`, `get_data`, `set_status`, `production_floor`);
  everything inside the code stays Indonesian (`lantai`, `mesin`, `adegan`, `kaca`, `ambil`). UI text is English in
  `__()` with Indonesian in `id.csv`.

## Smoothness budget (Abel: "the animation must feel smooth"; measured by `lantai.mjs perf`, headed, 1440x900 @2x)

- >= 57 fps over a 10 s scripted orbit with two status changes (first 2 s dropped).
- Frame intervals > 25 ms: at most 1 %. Longest frame <= 50 ms. 0 long tasks, counted after the 2 s warm-up like the frames. One ~65 ms native stall at the start of the first drag is known and excluded by the warm-up.
- <= 100 draw calls, <= 250k triangles (Revision 2; the scene with the building is measured 35 calls and 37,428 triangles (Task 5 run), the building's share is `info().pabrik`, the zones' `info().zona`). 20 status changes grow no geometry, texture or program.
- Not p95: Chrome's rAF clock sits at 18.6 ms even for an empty canvas, so a p95 gate only measures that noise.
- Adaptive quality (mean frame over 22 ms for 2 s: pixel ratio 1, still platens) and the home button answering within
  300 ms under 6x CPU throttle (`adaptive`).

## Lessons (each cost a day)

- **A text write during a camera drag stalls Chrome's main thread 50-100 ms.** No script, layout or paint shows in the
  trace. So label, clock and info bar text is written only once the camera rests (`label.js` 120 ms, bar at most ~1 s).
  Scene, lamps and panel update at once. Do not "fix" this by writing text in the render loop.
- **Blur is expensive per moving layer.** The 6 fixed cards (bar, KPI row, machine table, attention card, panel, camera bar) keep a 20 px
  backdrop blur; the 14 moving labels are glass without blur (even 3 px broke the dropped-frame gate). Without
  `backdrop-filter` or with `prefers-reduced-transparency` every card turns solid.
- **Labels declutter** (`label.js`): placed nearest first, the selected one before all; a label that would overlap a placed one
  shows compact (number and status dot), one under a fixed card is hidden, and it flips between the two only past an 8 px
  overlap change (hysteresis). Sizes are cached and measured only after a text change (camera at rest), so a frame reads no
  layout; only a changed class, visibility or transform is written. The cards' rectangles come from `hud.kotak()` /
  `panel.kotak()` (host-relative, cached, re-measured by a ResizeObserver or `ukurKotak()`, never per frame); the bundle joins
  them into `halangan`. `adegan.aturRuang()` fits the default view into the free area (`setViewOffset` on a scaled virtual frame, never above 1x) beside the
  KPI row and the larger free side of the left column (machine table + attention card): to its right, or below it; an open panel only moves the centre; do not call `saveState()` for it (it would overwrite home with the current view). `lantai.mjs label-rapi` checks it at three window sizes.
- One WebGL context for the whole session: leaving the page pauses, coming back resumes; never create a second canvas.
  One InstancedMesh per part (10 draw calls for 14 machines); a refresh with the same machines touches only changed rows.
- Fetch with plain `fetch`, never `frappe.call`: a failed request must not open a message dialog.
- Record text (item names, models, company) goes in by `textContent` only; a company logo only from same-origin `/files/`.
- Desk caches page scripts in the browser until `bench clear-cache`, so the page script stays small; logic is in the bundle.
- The page hides Desk's sidebar, which Desk does at its own pace after the page's show: a `ResizeObserver` on the page body and the sidebar calls `wrapper.fit()` whenever the layout moves (no timers: Desk's timing varies), or the host keeps the old sidebar's width as an empty strip (`strip` case, which delays the hide by 1.2 s).
- Manufacturing User and `ERP User` open the page (Administrator too): both read Workstation (`ERP User` through `setup.IZIN_TAMBAHAN`); another role would get an empty floor. `set_status` needs Workstation write, or `ERP User` plus read (status only, `_boleh_status`, saved with `ignore_permissions`). The nudge `production_floor` has an empty payload and is not sent for a Workstation that is no numbered machine; `set_status` answers a missing and a forbidden machine alike; the company name and logo only for a user who may read that Company.
- **Nudges (hooks.py).** Workstation `on_update`, Work Order `on_change`. ERPNext writes a Work Order's `produced_qty` and
  status with `db_set` (stock entry, `update_status`), which fires only `before_change`/`on_change`, never `on_update`; `on_change` also runs after
  save, submit, cancel and update-after-submit (`document.py` `run_post_save_methods`). Job Card writes a Workstation's status with
  `frappe.db.set_value`, which fires no event at all: the 60 s poll covers it. That gap is known; do not "fix" it with another hook.
- **The nudge goes to the room `doctype:Workstation`**, not to the site: `publish_realtime(doctype=...)` without a docname
  broadcasts to every System User and ignores the doctype. Frappe's realtime server keeps no room state, so after a socket
  reconnect (sleep, network blip, `bench start` restart) the bundle emits `doctype_subscribe` again on `socket.on("connect")` and in `lanjut()`
  (`lantai.mjs reconnect`). Socket.io gives up after 3 failed reconnects; the poll still runs then. The `lanjut()` re-emit is
  also needed because leaving a Workstation list view calls `doctype_unsubscribe("Workstation")` on the shared socket.
- An empty floor and a floor that never loaded say so in an inline glass note (`.catatan-lantai`, textContent, role status); a later failed
  refetch with machines on screen stays silent. The note clears on the next good fetch (`lantai.mjs notes`).
- The open panel writes a node only when its text changed and waits for the camera to rest like the labels; `aria-live` is on the status chip and the note only (`lantai.mjs panel-quiet`).
- A sidebar or build change needs `bench build --app erp_internal` and a restart of `bench start`.

## The info cards (`hud.js`)

- **Left column (`.kiri`)**, top left right under the top bar (under the KPI row below 1100 px): the machine table, then directly under it the
  attention card. Both are listed by `hud.kotak()`, so labels avoid them, and `ukurKotak()` feeds `adegan.aturRuang` the column's right edge (or its bottom).
  The table keeps its fold (collapsed under 760 px); the attention card has its own (`erp.lantai.perhatianTutup`, folded on a phone until opened) and is
  hidden on a phone while the bottom sheet is open.
- **Attention card** (`.perhatian`): every machine not in Production, worst first: Problem, Maintenance, Setup, Idle, Off (an empty status counts as Idle), floor order
  within a status; each row has the machine, its status chip and the Work Order item (textContent only); a click or Enter selects the machine like a table row;
  all running reads `__("All machines running")`. `hud.urutPerhatian(daftar)` is the order (pure). `lantai.mjs perhatian`, and `hud-xss` for an item name of HTML.
- **Loading screen** (`.memuat`, built by the bundle): a glass card with a spinner and `__("Loading production floor…")` over the whole floor from mount until the first answer
  (data or a failure) and the second frame tick are in and the cards are filled; then it is removed. A failed first load gives way to `.catatan-lantai`. No dialog (`lantai.mjs memuat`, `notes`).

## The floor plan and the factory (Revision 2)

- `denah.js` is pure (no imports): `BARIS`, `posisi`, `posisiSisa(i)`, `SLAB`, `DINDING`, `PINTU`, `ZONA`, `JALUR`. `adegan.js` re-exports
  `BARIS`/`posisi`. `node --test tools/denah.test.mjs` checks that the zones lie in the slab and never overlap, that every machine slot and the first
  14 spare slots keep 1.5 m from every zone and every `JALUR` segment, and that no `JALUR` segment crosses a zone other than `bahan` and `jadi`.
  Change a zone or a slot only with that test green (a spare slot inside a zone, or on the (currently unused) forklift loop, is the failure it guards).
- `pabrik.js` (`buatPabrik(adegan) -> {tema, info, buang}`): the cut-away building and the outside (ground, road, dock apron, truck, trees), all built from code. Static solids are
  merged per material (one mesh), the trees are one `InstancedMesh`. A theme change recolours the ground, road, apron and window glow and re-tints the merged solids (walls, roof cap, columns, truck: the material's colour multiplies the vertex colours; `info()` has `tema`, `dinding`, `atap`, `truk` as drawn); it creates no geometry, material or texture. The window glow is
  `MeshBasicMaterial` that `saatTurun` dims. `bentuk.js` holds the small shape helpers (`warnai`, `balok`, `tegak`, `tabungZ`, `datar`, `terbuang`) shared with `zona.js`.
- `zona.js` (`buatZona(adegan) -> {tema, info, buang}`): the six painted zones with their props (pallets of resin sacks and a dryer; pallets of crates, buckets and basins; red reject bins; a mould rack; the
  grinder; the glass QC office). Pallets, sacks, crates, buckets, basins and bins are one `InstancedMesh` each (tint by instance colour), the static parts one merged mesh, the QC glass and the paint their own
  materials. The lettering of all six zones is one canvas atlas (2 x 3 cells) drawn from `__("Raw Material")`, `__("Finished Goods")`, `__("Reject")`, `__("Mould Storage")`, `__("Grinder")`,
  `__("QC Office")` and redrawn only on a theme change; in dark the props' material is tinted darker too. `info()` is `{calls, tris, tulisan, pelat, tema, alat, kontras}` (`kontras`: each lettering's WCAG contrast against its plate over the zone paint over the floor, computed in sRGB, >= 3:1 in both themes, `lantai.mjs dekor-gelap`): `tulisan` the strings as drawn, `pelat` each plate's rectangle (`lantai.mjs zona` checks every plate lies on
  the slab at its zone). The QC plate sits inside the glass box on its own floor (y 0.1). Decor must never hide a machine, its lamp or its label: `lantai.mjs pabrik` raycasts from the camera to each andon point.
- The default camera sits higher and further back (`kamera.position` 0, 32, 36) and `adegan.terapkanRuang` fits the machines with `LONGGAR` (0.8) room
  to spare, so the building shows around them; `label-rapi` still asserts no label is hidden or overlapping.
- Status rings (`mesin.js`): one `InstancedMesh` ring per machine on the floor, colour = the lit andon segment (Off: grey), Problem blinks with its
  lamp. `mesin.info()` has `cincin` (hex) and `fase` (0..1 of the mould cycle, also in `daftar()` states, for the life layer).
- **Production reads apart from Idle** (Abel, 2026-10-29; `GAYA` in `mesin.js`): Production's ring breathes slowly on its own (`nadi` 0.4 Hz,
  brightness 45-100 %, phase per machine) while its lamp stays steady, and its control screen is lit (`layar` 1.3); Idle has a still ring, a dark
  screen (0.2) and a dimmer body (`redup` 0.78). Every status sets a screen brightness (`info().mesin[].terang`; `layar` there is the bundle's
  screen point). The breathing only rewrites the 14 ring colours, so `perf` stays at 60 fps with 0 dropped frames (`lantai.mjs states` checks it).
- **Every row faces the camera** (Abel, 2026-10-29; `bentukKeadaan` sets `putar` 0): the front row 01-07 used to turn round to the aisle and hid
  its andon lamps. **Problem blinks hard** (`GAYA.Problem.kedip`, 1.25 Hz, lit 55 % of the period, else 0.05): the lit segment snaps instead of easing (easing
  blurred the old 1 Hz pulse into a soft glow); its ring eases between 35 % and full so it stays red. `info().mesin[].kedip`; `lantai.mjs states` asserts
  the lamp is seen lit (>= 0xe6 red) and dark (<= 0x50, sRGB) within 16 samples.

## The simulated life layer (`hidup.js`)

- `buatHidup(adegan, mesin) -> {perbarui(daftar), tick, henti, info, buang}`. The bundle calls `perbarui(mesin.daftar())` after every `tata`, registers `tick` in `adegan.tiap` and `henti` in `adegan.saatTurun`.
- Operator (Production, Setup), technician with yellow helmet (Maintenance, Problem), nobody at Idle/Off; one `InstancedMesh` each for body, head and helmet, re-laid only on `perbarui`. A machine in Production drops a part when its `fase` wraps (a pool of 28, one slot per machine) into its bin; the bin fills 1/48 per part and empties at full (about 4 minutes). Time is counted from `dt`, clamped to 0.1 s, so a hidden page never makes anything jump. **No forklift for now** (Abel, 2026-10-29): it was removed from `hidup.js`; `denah.JALUR` and its test stay for when it comes back (git history has `bentukGarpu` and its drive).
- `henti()` is final: nothing moves or falls any more. 6 draw calls. `info().hidup` has `operator, teknisi, jatuh, aktif, orang[], tong[]` (figures and bins only for drawn machines).
- The HUD says `__("Operators and parts are simulated")` under the KPI row (`.simulasi`, in `hud.kotak()`). Nothing simulated may read as data.

## Accepted deviations from the design

1. Labels are glass without backdrop blur (above).
2. Label, clock and bar text lags until the camera rests (above).

## Running `tools/lantai.mjs`

```bash
ERP_SANDI=<SAMPLE_PASSWORD from the bench .env> node tools/lantai.mjs            # all cases, roughly 4-5 min
ERP_SANDI=... node tools/lantai.mjs perf hud glass                               # only some cases
```

Needs `bench start` and the sample users. `perf` and `adaptive` open a visible browser (headless frame timing is not
representative). The header of `tools/lantai.mjs` lists every case. It sets and restores machine statuses and, for a few
cases, makes and removes a Work Order: run it on `erp.localhost`, never on a real site. Also run `tools/cek_layar.mjs`
(the Manufacturing link) after a navigation change.
