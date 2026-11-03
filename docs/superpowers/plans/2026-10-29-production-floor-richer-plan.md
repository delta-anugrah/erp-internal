# Production Floor, Revision 2: a Fuller, Livelier Floor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Labels that never overlap or hide under a card, a factory building with zones and props around the 14
machines, a simulated life layer (operators, parts, a forklift), and an attention card: all inside the smoothness
gate.

**Architecture:**
- A new pure module `public/js/lantai/denah.js` holds the floor plan: machine slots (moved from `adegan.js` and
  `mesin.js`), the building, the zones and the forklift loop. It imports nothing, so Node can test it.
- Decor is built once:
  - `pabrik.js`: building, outside;
  - `zona.js`: zones and props.
  Static parts are merged per material and repeated parts are instanced.
- `hidup.js` animates the simulated layer from `adegan.tiap`.
- `label.js` gains screen-space declutter and card avoidance, fed by rects that `hud.js` and `panel.js` report.

**Tech Stack:** three.js 0.160.0 (bundled), `BufferGeometryUtils.mergeGeometries`, Canvas 2D for floor lettering,
Playwright (`tools/lantai.mjs`), `node --test` for `denah.js`.

**Spec:** `docs/superpowers/specs/2026-10-28-production-floor-design.md`, **Revision 2** (and everything before it
still holds). Earlier plan: `docs/superpowers/plans/2026-10-28-production-floor-plan.md`; rules:
`.claude/rules/lantai.md`.

## Global Constraints

- Everything in the earlier plan's Global Constraints and `.claude/rules/lantai.md` still holds:
  - English UI source in `__()` with an Indonesian row in `erp_internal/translations/id.csv`;
  - Indonesian identifiers, English comments; tabs, ruff;
  - no dialogs, record text only via `textContent`;
  - one WebGL context, Shadow DOM, pause on hide;
  - text writes wait for the camera to rest;
  - nothing copied from BPT (`.claude/rules/terpisah-dari-bpt.md`);
  - no Claude attribution;
  - `git add` explicit paths only (`feat/lokal` is shared with another live session).
- Smoothness gate, unchanged: after a 2 s warm-up ≥ 57 fps, intervals over 25 ms ≤ 1 % of frames, max ≤ 50 ms,
  0 long tasks.
- Scene budget (amended by Revision 2): ≤ 100 draw calls, ≤ 250k triangles, no geometry, material or texture created
  after load, nothing allocated per frame.
- No downloaded asset: geometry and textures are built in code.
- Label hysteresis: a label switches between full and compact only when the overlap starts or ends by more than
  8 px.
- Life-layer note, exact copy: `__("Forklift, operators and parts are simulated")`.
- Attention order: Problem, Maintenance, Setup, Idle, Off. Empty list text: `__("All machines running")`.
- After every `bench build --app erp_internal`, the report says Abel must restart `bench start`.

## Review Focus

1. **Small windows** (1280×720, a 390 px phone): cards take more of the screen. Expected: no full label overlaps
   another or sits under a card, and decor never covers a machine. Test: Task 1 `label-rapi` at 1440×900, 1280×720
   and 390×844.
2. **Dark theme:** decor and floor lettering stay readable. Test: Task 5 `dekor-gelap` (lettering contrast ≥ 3:1
   against its zone, both themes).
3. **Weak GPU:** adaptive quality must also stop the life layer. Test: Task 4 extends `adaptive`: the forklift
   stands still and no part falls after the drop.
4. **Not 14 machines** (13, a duplicate number in the spare row): figures and bins follow the drawn machines only,
   and no spare slot sits inside a zone or on the forklift loop. Tests: Task 2 `denah.test.mjs` (spare slots
   included); Task 4 extends `13-machines`.
5. **Hidden page or tab:** the simulated layer must not run while hidden and must not jump on return. Test: Task 4
   extends `hidden`: the forklift position is unchanged while hidden, and after return it moves at most one
   frame's step on the first frame.

---

### Task 1: Labels that never collide or hide under a card

**Files:**
- Modify:
  - `erp_internal/public/js/lantai/label.js` (declutter, compact chip, card avoidance);
  - `adegan.js` (`aturRuang`);
  - `hud.js` and `panel.js` (`kotak()`);
  - `lantai.bundle.js` (wiring);
  - `id.csv` if new text;
  - `tools/lantai.mjs`.

**Interfaces:**
- Produces `hud.kotak() -> Array<{x0, y0, x1, y1}>`, and the same shape from `panel.kotak()`:
  - host-relative px of every visible fixed card;
  - cached, recomputed only by a `ResizeObserver` or on fold/open, never per frame.
- Produces `buatLabel(root, adegan, mesin, { halangan })`, where `halangan()` returns those rects concatenated.
- Each label caches its own size; it is re-measured only after its text changes.
- Produces `label.info()`, which adds:
  - `ringkas` (count of compact labels);
  - `tersembunyi` (count hidden under a card);
  - `kotak: Array<{nama, x0, y0, x1, y1, ringkas}>` for visible labels.
- Produces `adegan.aturRuang({ atas, kanan, bawah, kiri })`, in px:
  - `camera.setViewOffset` so the default view centres in the free area;
  - `kontrol.saveState()` again, so home returns there.
  The bundle calls it whenever the HUD's rects change.

- [ ] **Step 1:** Add case `label-rapi` to `tools/lantai.mjs`. At 1440×900, 1280×720 and 390×844, from the default
  camera, read `info().label.kotak` and the HUD and panel rects, then assert:
  - no two full (non-compact) visible labels intersect;
  - no visible label intersects a card;
  - the selected label (select Mesin 05 through the table) is full;
  - after a 2 s rest, `info().label` shows no switch between full and compact (hysteresis);
  - zoomed in twice with `+`, no visible label intersects the KPI row.
- [ ] **Step 2:** Run `node tools/lantai.mjs label-rapi`. Expected: FAIL (overlaps at the default camera, labels
  under the KPI row when zoomed).
- [ ] **Step 3:** Implement. Order the labels near to far by the camera depth that `proyeksi` already gives.
  - Place each label in turn: full if its box clears the boxes placed before it, else compact.
  - A label over a card gets `visibility: hidden`.
  - Only class and visibility changes are written, and only when the state changes.
- [ ] **Step 4:** Run `node tools/lantai.mjs label label-rapi hud pilih perf`. Expected: all OK, perf within the
  gate.
- [ ] **Step 5:** Commit `feat(lantai): labels declutter, step aside for cards, default view in the free area`.

**Deviations:** `aturRuang` runs without saveState; the fit scale is 0.4 to 1; the panel shifts with the fit. 2026-11-03: labels within `SERI` (0.25 m) of depth keep a fixed order (full last frame first, then floor order), and `proyeksi`'s `dalam` is view depth in metres, not NDC z; the pure depth order let float noise flip the front row (`label-rapi` jiggle).

### Task 2: The floor plan module, the building and the outside

**Files:**
- Create:
  - `erp_internal/public/js/lantai/denah.js` (pure, no imports);
  - `erp_internal/public/js/lantai/pabrik.js`;
  - `tools/denah.test.mjs`.
- Modify:
  - `adegan.js`: `BARIS`, `posisi` and the floor size move to `denah.js`; `adegan.js` re-exports them;
  - `mesin.js`: the spare slots move to `denah.posisiSisa`; the status ring is added;
  - `lantai.bundle.js`;
  - `tools/lantai.mjs` (perf limits become ≤ 100 draw calls and ≤ 250k triangles).

**Interfaces:**
- Produces from `denah.js`:
  - `BARIS`, `posisi(nomor) -> {x, z, baris} | null`, `posisiSisa(i) -> {x, z, baris}` (the values used today:
    row spacing 4.2, rows 7 apart, spare rows from z 6.3 every 2.6);
  - `SLAB = {x0: -30, x1: 30, z0: -14, z1: 12}`;
  - `DINDING = { tinggi: 2.4 }`: back wall at `z0` and side walls at `x0` and `x1`; the front is open;
  - `PINTU = { x: 30, z0: -4, z1: 2 }`, the rolling door to the dock outside `x1`;
  - `ZONA`, each entry `{x0, x1, z0, z1}` (the extents are our call; the builder may refine them within `SLAB`):
    - `bahan` (raw material) −29..−20 × −12..−1;
    - `cetakan` (mould rack) −29..−20 × 1..6;
    - `jadi` (finished goods) 20..29 × −12..−5;
    - `reject` 20..24 × 4..9;
    - `giling` (grinder) 25..29 × 4..9;
    - `qc` 20..29 × −3..2, kept clear of the door's path;
  - `JALUR`: an array of `{x, z, henti: ms}`, a closed loop through `bahan`, the aisle `z = 0`, `jadi` and the door.
- Produces `buatPabrik(adegan) -> { tema(nama), info(), buang() }`:
  - `info()` returns `{ calls, tris }`, the decor's own share;
  - static meshes are merged per material;
  - trees are one `InstancedMesh`;
  - window glow is an emissive material that `saatTurun` dims.
- Produces `mesin.daftar()`, whose states also carry `fase` (0..1 of the mould cycle) for Task 4.
- Produces the status ring: one `InstancedMesh` ring per machine, coloured by status (Problem pulses with its lamp).
  `mesin.info()` adds `cincin` (hex colour).

- [ ] **Step 1:** Write `tools/denah.test.mjs` (`node --test`):
  - `test("zones lie inside the slab")`;
  - `test("no two zones overlap")`;
  - `test("every machine slot and the first 14 spare slots keep 1.5 from every zone and every JALUR segment")`;
  - `test("posisi matches the old layout")`: `posisi(1)` is `{x: -12.6, z: 3.5, baris: 1}` and `posisi(14)` is
    `{x: -12.6, z: -3.5, baris: 0}`;
  - `test("JALUR is closed and every stop lies in bahan, jadi or by PINTU")`.
- [ ] **Step 2:** Run `node --test tools/denah.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3:** Create `denah.js` and move the slot code. Run the test until it passes, then run
  `node tools/lantai.mjs states 13-machines label`. Expected: OK, so the move changed nothing.
- [ ] **Step 4:** Add case `pabrik` to `tools/lantai.mjs`:
  - `info().pabrik.calls` > 0;
  - every machine's andon point still projects inside the canvas from the default camera, and a raycast from the
    camera to it hits that machine first (no wall in front);
  - ring colours follow statuses: set Mesin 01 to Problem, its `cincin` is red and pulses; restore it after.
- [ ] **Step 5:** Build `pabrik.js` and the ring. Reframe the default camera so the building fills the free area.
  Look at screenshots from the default camera, both themes and close up (Read tool).
- [ ] **Step 6:** Run `node --test tools/denah.test.mjs` and `node tools/lantai.mjs`, then the full suite once.
  Expected: all OK; perf within the gate at ≤ 100 calls and ≤ 250k triangles.
- [ ] **Step 7:** Commit `feat(lantai): floor plan module, the factory building, outside and status rings`.

**Deviations:** the QC zone moved to x -28..-21, z 7.5..11 (the zone decor was built early, in this task); Work Order QTY fix; the camera got a LONGGAR margin.

### Task 3: Zones and their props

**Files:**
- Create: `erp_internal/public/js/lantai/zona.js`.
- Modify: `lantai.bundle.js`, `erp_internal/translations/id.csv`, `tools/lantai.mjs`.

**Interfaces:**
- Consumes `denah.ZONA` and `adegan` (`scene`, `saatTurun`).
- Produces `buatZona(adegan) -> { tema(nama), info(), buang() }`. `info()` returns `{ calls, tris, tulisan:
  Array<string> }`, the floor lettering as drawn.
- Props per zone:
  - `bahan`: pallets of resin sacks and a granule dryer;
  - `jadi`: pallets of crates, and stacked buckets and basins in a few product colours;
  - `reject`: red bins;
  - `cetakan`: a rack of mould blocks;
  - `giling`: a grinder;
  - `qc`: a glass office box with a desk.
- Pallets, sacks, crates, buckets and bins are each one `InstancedMesh`.
- Floor lettering is one canvas texture atlas, drawn once from the translated strings:
  - `__("Raw Material")`;
  - `__("Finished Goods")`;
  - `__("Reject")`;
  - `__("Mould Storage")`;
  - `__("Grinder")`;
  - `__("QC Office")`.

- [ ] **Step 1:** Add case `zona` to `tools/lantai.mjs`:
  - `info().zona.tulisan` equals the six strings in English;
  - in Indonesian (switch the user's language as the `id` case does) it equals their id.csv values;
  - the total stays ≤ 100 calls and ≤ 250k triangles;
  - 20 status changes grow no geometry or texture.
- [ ] **Step 2:** Run the case. Expected: FAIL.
- [ ] **Step 3:** Build `zona.js`. Add the id.csv rows. Check the shapes in screenshots: a person should read the
  zones as a plastics factory's.
- [ ] **Step 4:** Run `node tools/lantai.mjs zona perf id` and `run-tests --app erp_internal`. Expected: OK
  (`test_bahasa` passes with the new rows).
- [ ] **Step 5:** Commit `feat(lantai): raw material, finished goods, reject, mould and QC zones`.

**Deviations:** shared shape helpers moved into `bentuk.js`; the office is called "QC Office".

### Task 4: The simulated life layer

**Files:**
- Create: `erp_internal/public/js/lantai/hidup.js`.
- Modify: `lantai.bundle.js`, `hud.js` (the simulated note), `id.csv`, `tools/lantai.mjs`.

**Interfaces:**
- Consumes `mesin.daftar()` (with `status` and `fase`), `denah.JALUR`, `adegan.tiap` and `adegan.saatTurun`.
- Produces `buatHidup(adegan, mesin) -> { perbarui(daftar), henti(), info(), buang() }`.
  `info()` returns `{ operator, teknisi, jatuh, forklift: {x, z, henti}, aktif }`.
- Figures:
  - an operator per machine in Production or Setup;
  - a technician (yellow helmet) per machine in Maintenance or Problem;
  - none at Idle or Off.
  Figures are instanced and re-laid only on `perbarui`.
- Parts:
  - a machine in Production drops one part when its `fase` wraps;
  - parts come from a fixed pool (no allocation);
  - each machine's bin fill rises and empties about every 4 minutes.
- Forklift: follows `JALUR` at a walking pace and waits `henti` ms at each stop.
- `saatTurun` → `henti()`: figures stand still, no part falls, the forklift stops.
- The HUD shows the simulated note (exact copy in Global Constraints) in small muted text under the KPI row.

- [ ] **Step 1:** Add case `hidup` to `tools/lantai.mjs`:
  - with Mesin 01 in Production, 02 in Problem and 03 in Off (restored after): `operator` ≥ 1, `teknisi` ≥ 1, no
    figure at 03;
  - `jatuh` rises within 2 cycles;
  - the forklift position changes within 3 s;
  - the note text is present.
  Extend existing cases:
  - `adaptive`: after the drop, `aktif` is false and the forklift position stays still for 2 s;
  - `hidden`: the forklift position is unchanged while hidden, and on return the first frame moves it by at most
    one step (dt ≤ 0.1 s);
  - `13-machines`: figures and bins count only drawn machines.
- [ ] **Step 2:** Run the cases. Expected: FAIL.
- [ ] **Step 3:** Build `hidup.js` and the note.
- [ ] **Step 4:** Run the full `node tools/lantai.mjs`. Expected: all OK, perf within the gate with the life layer
  on.
- [ ] **Step 5:** Commit `feat(lantai): operators, parts and a forklift (simulated)`.

**Deviations:** the figures are static (they do not animate); the perf gate counts long tasks after the 2 s warm-up (one ~65 ms native stall at the first drag is known and excluded).

### Task 5: The attention card, dark decor, docs and image

**Files:**
- Modify: `hud.js` (attention card), `pabrik.js` and `zona.js` (`tema`), `id.csv`, `tools/lantai.mjs`.
- Docs:
  - `.claude/rules/lantai.md` (budget, the new modules, the simulated layer);
  - `CLAUDE.md`, `README.md`;
  - `docs/panduan/produksi.md` and its screenshot (`node tools/panduan_gambar.mjs produksi-1`);
  - `docs/PROGRESS.md`, `docs/TODO.md` (tick the three "next round" items);
  - this plan (deviations under each task).

**Interfaces:**
- Consumes `hud.perbarui(data)` rows and `saatPilih`.
- Produces the attention card:
  - left, under the top bar;
  - rows as in Global Constraints, each with its status chip and, when present, its Work Order item;
  - a row click selects the machine like a table row;
  - it is listed by `hud.kotak()`, so labels avoid it.

- [ ] **Step 1:** Add `lantai.mjs` cases:
  - `perhatian`: with 02 in Problem, 03 in Idle and 04 in Maintenance, the rows read 02, 04, 03 in that order; a
    click selects 04; all in Production shows `All machines running`; statuses restored after;
  - `dekor-gelap`: in dark theme `pabrik` and `zona` report the dark palette, and the lettering contrast is ≥ 3:1
    in both themes (read from `info().zona`).
  Extend `hud-xss`: an item name of `<img onerror>` shows as text in the attention card.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Take screenshots in light, dark, 1280×720 and 390×844, and look at them.
- [ ] **Step 4:** Run everything:
  - `node --test tools/denah.test.mjs`;
  - the full `node tools/lantai.mjs`;
  - `node tools/cek_layar.mjs`;
  - `bench --site erp-test.localhost run-tests --app erp_internal`;
  - `docker build -f deploy/Containerfile -t erp-internal:uji .` and then `deploy/check_image.sh erp-internal:uji`
    (write "not run" and why if Docker is unavailable).
  Expected: all OK.
- [ ] **Step 5:** Update the docs listed above, with test lines only from real runs.
- [ ] **Step 6:** Commit `feat(lantai): attention card, dark decor, docs for the fuller floor`. Do not push: the
  push waits for Abel's ok.

**Deviations:** the table sits top left with the attention card under it (a left column); a loading screen was added; the logo is a note only (the dev site shows initials).
