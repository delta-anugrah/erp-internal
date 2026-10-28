# Production Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Desk page, Production Floor, that shows the 14 injection moulding machines in 3D in Samuel's two-row
order. It shows each machine's live status and running Work Order, lets a user change the status from the scene,
and runs smoothly.

**Architecture:**
- **Server:** `erp_internal/lantai.py` serves one permission-checked snapshot of the machines. It saves status
  changes through the Workstation document. It publishes a name-only realtime event that the page answers by
  refetching the snapshot.
- **Page:** the Frappe Page `lantai-produksi` keeps its own script tiny. On demand it loads `lantai.bundle.js`,
  which bundles three.js and draws everything inside a Shadow DOM.

**Tech Stack:** Frappe v16.53.0, ERPNext v16.52.1, three.js 0.160.0 (npm, bundled by `bench build`), Playwright for
the browser checks.

**Spec:** `docs/superpowers/specs/2026-10-28-production-floor-design.md`

## Global Constraints

- The constraints of `docs/superpowers/plans/2026-10-27-erp-internal-plan.md` still hold, as amended by Revisions 2
  to 4:
  - English UI source in `__()`/`_()`, with Indonesian in `erp_internal/translations/id.csv` (the coverage test
    fails on a missing row);
  - Indonesian identifiers, English comments;
  - tabs, ruff;
  - idempotent setup;
  - no edits in apps/frappe|erpnext|hrms;
  - no Claude attribution in commits.
- Nothing is copied from BPT (`.claude/rules/terpisah-dari-bpt.md`). Its patterns may be read as reference only:
  `~/Desktop/Projects/pertamina/bpt/bpt/public/js/bpt_live.bundle.js`, its page script, and its rule
  `.claude/rules/twin.md`. The lessons taken from them are below.
- Lessons from BPT Live that apply here:
  - Desk caches page scripts in localStorage until `bench clear-cache`. Keep logic in the bundle and the page
    script tiny.
  - Reset `frappe.route_options` to `{}`, never `null`.
  - Pause on page hide.
  - One WebGL context for the session.
  - Shadow DOM, so no CSS bleeds into Desk.
  - Record text never goes to `innerHTML`.
- Machines are Workstations with `erp_nomor` 1–14 (`master.muat`, `setup` custom fields `erp_nomor`, `erp_merek`,
  `erp_model`, `erp_tonase`, `erp_tahun`, `erp_negara`). Floor order:
  `BARIS = [[14, 13, 12, 11, 10, 9, 8], [1, 2, 3, 4, 5, 6, 7]]` (back row first, both left to right from the
  default camera).
- Status → look table: copy it from the spec.
- Smoothness budget (spec):
  - after a 2 s warm-up: ≥ 57 fps, intervals over 25 ms ≤ 1 % of frames, max ≤ 50 ms, 0 long tasks (p95 is printed,
    not asserted: rAF intervals on a 60 Hz display give p95 ≈ 18.6 ms even for an empty canvas);
  - ≤ 60 draw calls, ≤ 150k triangles;
  - adaptive quality above 22 ms average for 2 s.
- After `bench build` the running `bench start` serves stale asset names. Abel must restart it, and every task that
  builds says so in its report.

**Final review fix (6cb0a98) supersedes the realtime details in Tasks 1, 4 and 5:** Workstation `on_update` and Work Order
`on_change` (ERPNext sets `produced_qty` and status with `db_set`, which fires only `on_change`) call `siarkan`, which
publishes `production_floor` with an empty payload `{}` to the room `doctype:Workstation` (a Workstation without a number
sends nothing); the bundle re-emits `doctype_subscribe` on socket `connect` and in `lanjut()`. See `.claude/rules/lantai.md`.

## Review Focus

1. **Missing or duplicate machine numbers** (13 machines, two with `erp_nomor` 5, one with 0). Expected: draw what
   exists in its slot, leave a missing slot empty, and put a duplicate in the first free spot past row 2, without
   crashing. Test: Task 1 `test_data_nomor_ganjil`, Task 3 `lantai.mjs` case "13 machines".
2. **HTML in record text** (an item or machine name like `<img src=x onerror=alert(1)>`). Expected: shown as plain
   text. Test: Task 5 `lantai.mjs` case "xss".
3. **Realtime down** (socket.io can't resolve `erp.localhost` on macOS without `/etc/hosts`, or the socket drops).
   Expected: a 60 s poll keeps the view current, and there is no error. Test: Task 5 `test_siaran_hanya_nama` plus
   `lantai.mjs` case "poll".
4. **Status written without events** (ERPNext's Job Card uses `frappe.db.set_value` on Workstation status).
   Expected: the poll picks it up. Test: Task 5 `lantai.mjs` case "set_value".
5. **No WebGL or a weak GPU.** Expected: without WebGL, a plain table of the machines; with a weak GPU, adaptive
   quality kicks in. Desk never freezes. Test: Task 3 `lantai.mjs` cases "no-webgl" and "adaptive".

---

### Task 1: Server data, status change and the Work Order machine field

**Files:**
- Create: `erp_internal/lantai.py`, `erp_internal/tests/test_lantai.py`
- Modify:
  - `erp_internal/setup.py` (custom field `Work Order.erp_mesin`);
  - `erp_internal/hooks.py` (doc_events);
  - `erp_internal/translations/id.csv`.

**Interfaces:**
- Produces `@frappe.whitelist() data() -> dict`:
  - shape: `{"mesin": [{name, nomor, merek, model, tonase, tahun, negara, status, wo}], "waktu": str}`;
  - `wo` is `None` or `{name, item_code, item_name, qty, produced_qty, status}`;
  - sorted by `nomor`;
  - only Workstations with `erp_nomor > 0`, read through `frappe.get_list` (user permissions apply);
  - needs read on Workstation;
  - `wo` is the newest submitted Work Order with `erp_mesin` = the machine and status In Process (else Not Started),
    and only if the user can read Work Order.
- Produces `@frappe.whitelist(methods=["POST"]) ubah_status(mesin: str, status: str) -> dict`:
  - gets the Workstation, `check_permission("write")`, and checks the status is in the field's options;
  - saves through `doc.save()` and returns the new row in `data()`'s shape.
- Produces `siarkan(doc, method=None)`:
  - hooked on Workstation `on_update` and on Work Order `on_update`, `on_submit`, `on_cancel`,
    `on_update_after_submit`;
  - calls `frappe.publish_realtime("erp_lantai", {"mesin": <name or None>}, doctype="Workstation",
    after_commit=True)`;
  - the payload carries the name only, never figures.
- Produces the custom field `Work Order.erp_mesin`: Link Workstation, label "Machine", after `production_item`, with
  a query filter on `erp_nomor > 0` (set in `sales_forecast.js`'s sibling `work_order.js` or as `link_filters`).

- [ ] **Step 1:** Write tests in `test_lantai.py`, using the fixtures in `tests/utils.py` plus a helper that makes
  machines like `master._mesin`:
  - `test_data_urut_dan_isi`: 3 machines (nomor 2, 1, 3) come back in order 1, 2, 3 with every field; `wo` is
    None.
  - `test_data_nomor_ganjil`: two machines with nomor 5 and one with 0. The 0 is left out; both 5s come back, by
    name; no error.
  - `test_data_wo_jalan`: an In Process Work Order with `erp_mesin` shows on its machine with `qty` and
    `produced_qty`. A draft or cancelled one doesn't.
  - `test_data_tanpa_izin`: a user with no Workstation read gets `frappe.PermissionError`.
  - `test_ubah_status`: as a Manufacturing User, `ubah_status(m, "Problem")` stores Problem and adds a Version row
    on that Workstation.
  - `test_ubah_status_tolak`: status "Rusak" raises `frappe.ValidationError`; a user without write raises
    `frappe.PermissionError`; the status is unchanged.
  - `test_siaran_hanya_nama`: patch `frappe.publish_realtime`. Saving a Workstation and submitting a Work Order call
    it with event `erp_lantai`, the payload `{"mesin": name}` and `doctype="Workstation"`.
  - `test_idempoten`: `pastikan_setup()` twice leaves the Custom Field count the same.
- [ ] **Step 2:** Run `bench --site erp-test.localhost run-tests --module erp_internal.tests.test_lantai`. Expect
  failures (module missing).
- [ ] **Step 3:** Implement `lantai.py`, the custom field in setup's table, hooks and the id.csv rows.
- [ ] **Step 4:** Run the module, then the full suite. Expect all to pass.
- [ ] **Step 5:** Commit `feat(lantai): machine snapshot, status change and realtime nudge`.

### Task 2: The page, the bundle and an empty floor

**Files:**
- Create:
  - `package.json` (repo root: `{"private": true, "dependencies": {"three": "0.160.0"}}`) and `yarn.lock`;
  - `erp_internal/erp_internal/page/lantai_produksi/{__init__.py,lantai_produksi.json,lantai_produksi.js}`;
  - `erp_internal/public/js/lantai.bundle.js`;
  - `erp_internal/public/js/lantai/adegan.js`;
  - `tools/lantai.mjs`.
- Modify: `.gitignore` (`node_modules/`), `deploy/check_image.sh` (assert `lantai.bundle.js` is in
  `assets.json`).

**Interfaces:**
- Page `lantai-produksi`:
  - title `__("Production Floor")` (id "Lantai Produksi");
  - roles Manufacturing User only (Task 7 ruling: it is the role that reads Workstation; Administrator passes);
  - full-bleed under the navbar and rail;
  - `page_head` hidden.
- Page script:
  - on load: `frappe.require("lantai.bundle.js")`, then `erp.lantai.pasang(host)`;
  - on hide: `jeda()`;
  - on show: `lanjut()`;
  - resets `route_options` to `{}`.
- `erp.lantai.pasang(host) -> {perbarui(data), jeda(), lanjut(), buang(), info()}`:
  - `info()` returns `renderer.info.render`, `renderer.info.memory`, the frame stats and `konteks` (contexts
    created), for tools;
  - `erp.lantai.aktif` is the mounted instance.
- `adegan.js` exports:
  - `buatAdegan(root)`: renderer (`antialias: true`, `powerPreference: "high-performance"`, pixel ratio
    `min(devicePixelRatio, 2)`), scene, camera, OrbitControls (damping), lights (hemisphere + one directional,
    **no shadow maps**: a soft blob texture under each machine), floor with aisle lines;
  - `posisi(nomor) -> {x, z, baris}` from `BARIS`;
  - the loop: `setAnimationLoop` with `dt = min(clock.getDelta(), 0.1)`, a dirty flag for labels, a pause on
    `visibilitychange`.

- [ ] **Step 1:** Run `yarn install` in the repo. Bench sees it through the `apps/erp_internal` symlink. Then run
  `bench build --app erp_internal`. Expect `assets.json` to list `lantai.bundle.js`.
- [ ] **Step 2:** Write `tools/lantai.mjs`, built on `tools/cek_layar.mjs`'s login. It signs in as
  `user@example.com` and opens `/desk/lantai-produksi`. It asserts:
  - one canvas in the shadow root;
  - no message dialog;
  - `erp.lantai.aktif.info().konteks === 1` after leaving and coming back 5 times;
  - 14 slot markers whose projected screen x order is 1..7 (front) and 14..8 (back), with the back row above the
    front row on screen.

  Count contexts with an `addInitScript` wrapper around `HTMLCanvasElement.prototype.getContext`.
- [ ] **Step 3:** Run it (`ERP_SANDI=… node tools/lantai.mjs`). Expect a failure before the page exists, then
  build the page and the floor until it passes.
- [ ] **Step 4:** Commit `feat(lantai): Production Floor page, three.js floor in two rows`. Tell Abel to restart
  `bench start`.

### Task 3: The machines, their states and the smoothness budget

**Files:**
- Create: `erp_internal/public/js/lantai/mesin.js`
- Modify: `adegan.js`, `lantai.bundle.js`, `tools/lantai.mjs`

**Interfaces:**
- `mesin.js` exports `buatMesin(adegan) -> {tata(daftar), setel(nomor, status), tick(dt), pilihDari(raycaster)}`:
  - **Geometry is built once** from the spec's parts, merged per material with
    `BufferGeometryUtils.mergeGeometries`, then drawn as `InstancedMesh` per part for all machines (fewer than 30
    draw calls in total).
  - Brand tint and the tonnage length scale are per-instance colour and matrix.
  - The moving platen is its own InstancedMesh, so a cycle updates 14 matrices per frame.
- **Status:**
  - lamp colour and body dim ease toward their target with `x += (t − x)·(1 − e^(−dt·8))`;
  - Problem pulses with a sine;
  - the platen cycle is a 5 s eased sine, phase-shifted per machine so they don't move in lockstep.
- **Adaptive quality:** if the rolling mean frame time is above 22 ms for 2 s, set `setPixelRatio(1)` and stop the
  platen motion. It never switches back up during a session.
- **No WebGL** (`getContext` returns null): render a plain HTML table (No, Machine, Status, Work Order) inside the
  shadow root instead.

- [ ] **Step 1:** Extend `lantai.mjs` with these cases:
  - "states": set the six statuses through `ubah_status` on six machines and read back lamp colours from
    `info()`'s debug state;
  - "13 machines": rename one machine's `erp_nomor` to 0 for the run and restore it after; its slot is empty and
    there is no dialog;
  - "no-webgl": launch with `--disable-webgl` and see the table, 14 rows;
  - "perf": headed Chromium (`headless: false`). Orbit the camera by script for 10 s, fire two status changes,
    and drop the first 2 s. Assert ≥ 57 fps, intervals > 25 ms ≤ 1 %, max ≤ 50 ms, 0 `longtask` entries,
    `info().render.calls ≤ 60` and `triangles ≤ 150000`. After 20 status changes, `memory.geometries`,
    `memory.textures` and the shader program count have not grown.
  - "adaptive": throttle with CDP `Emulation.setCPUThrottlingRate` 6. Pixel ratio becomes 1 within 4 s and the
    page stays responsive (a click on the reset button resolves in under 300 ms).
- [ ] **Step 2:** Run and see these cases fail.
- [ ] **Step 3:** Build `mesin.js` until they pass. Look at a screenshot from the default camera and one close-up
  (Read tool). It should read clearly as injection moulding machines, not boxes.
- [ ] **Step 4:** Commit `feat(lantai): machines, status lights and motion within the frame budget`.

### Task 4: English route and endpoints (Revision 1)

Spec Revision 1, first bullet. A rename only: no behaviour changes, every existing test and `lantai.mjs` case
still passes under the new names.

**Files:**
- Rename: `erp_internal/lantai.py` → `erp_internal/production_floor.py`, `tests/test_lantai.py` →
  `tests/test_production_floor.py`, `page/lantai_produksi/` → `page/production_floor/` (Page name and route
  `production-floor`, JSON `name`/`page_name` and `modified` bumped).
- Modify: `hooks.py` (doc events), the page script, `lantai.bundle.js`/`lantai/*.js` where they name the method,
  the route or the event, `tools/lantai.mjs`, `deploy/check_image.sh` if it names the page, `setup.py` (remove
  the old Page `lantai-produksi` if it exists, idempotent), CLAUDE.md, `.claude/skills/run-checks`, docs that name
  the old route or methods (PROGRESS/TODO history lines may stay as history).

**Interfaces:**
- `erp_internal.production_floor.get_data()` (was `lantai.data`), same return shape.
- `erp_internal.production_floor.set_status(machine, status)` (was `ubah_status(mesin, status)`), POST only, same
  checks and return.
- Realtime event `production_floor` (was `erp_lantai`); payload `{"mesin": name}` unchanged.
- Page `production-floor`; the old Page `lantai-produksi` is deleted on migrate.

- [x] **Step 1:** Rename, then grep the repo (outside `.git`, `node_modules`, `.superpowers`) for
  `lantai-produksi`, `lantai_produksi`, `erp_internal.lantai`, `ubah_status`, `erp_lantai`: only history lines
  in PROGRESS/TODO may remain.
- [x] **Step 2:** `bench --site erp.localhost migrate`, `bench build --app erp_internal`, the full suite and
  `node tools/lantai.mjs` all pass; `/desk/lantai-produksi` no longer exists, `/desk/production-floor` does.
- [x] **Step 3:** Commit `refactor(lantai): English route and endpoints for the Production Floor`. Tell Abel to
  restart `bench start`.

### Task 5: Labels, selection, status from the scene, live updates

**Files:**
- Create: `erp_internal/public/js/lantai/label.js`, `erp_internal/public/js/lantai/panel.js`
- Modify: `lantai.bundle.js`, `erp_internal/translations/id.csv`, `tools/lantai.mjs`

**Interfaces:**
- **Labels:** one HTML element per machine in the shadow root, written with `textContent` only. They are positioned
  with `transform: translate3d()`, and only on frames where the camera or the layout changed. They hide behind the
  camera.
- **Click a machine** (raycast against the InstancedMesh, `instanceId` → nomor):
  - the camera flies to it over 700 ms with easeInOutCubic;
  - the side panel opens: details, Work Order (a link to the form), six status buttons, and "Open machine";
  - on a phone width (< 760 px) the panel is a bottom sheet.
- **A status button:**
  - POST `erp_internal.production_floor.set_status`;
  - the button shows a spinner and stays disabled until the call answers;
  - on success the scene eases to the new state;
  - on refusal an inline note appears in the panel, never a dialog.
- **Live updates:**
  - `frappe.realtime.doctype_subscribe("Workstation")` plus `frappe.realtime.on("production_floor")` trigger a refetch of
    `data()`, debounced 250 ms;
  - a poll every 60 s while visible;
  - `perbarui()` diffs and touches only the machines that changed.

- [x] **Step 1:** Extend `lantai.mjs` with these cases:
  - "label": machine 3's label reads "03 · <brand> <tonnage>T";
  - "pilih": a click on machine 3 opens its panel;
  - "status": clicking Problem changes the server status (read via `frappe.client.get_value`) and the chip; restore
    the status after;
  - "wo": submit an In Process Work Order on machine 3 and see the label show its item and progress;
  - "xss": temporarily set an item_name `<img src=x onerror=window.kena=1>` and assert `window.kena` is undefined
    and the text is visible;
  - "set_value": `frappe.db.set_value` through `bench execute` changes a status; with the poll set to 3 s by a
    `?poll=3` debug option, the view follows;
  - "poll": block `/socket.io` requests and the view still follows a change;
  - "id": switch language to id and see "Lantai Produksi" and the translated status names.
- [x] **Step 2:** Run and see these cases fail. Implement until they pass, plus the full suite and the perf case
  again.
- [x] **Step 3:** Commit `feat(lantai): labels, machine panel, status from the floor, live updates`.

### Task 6: The info bar and the liquid glass look (Revision 1)

Spec Revision 1, second to fourth bullets.

**Layout reference (Abel's BPT Live screenshot, 2026-10-28 17:30):** a full-width top bar (company logo and
name on the left; on the right a chip "N machines" and the live dot with the clock), a row of KPI cards under it
on the right (Machines, Running + utilization, Problem, Work Orders running, Output produced ÷ planned, each with a
small caption line), a collapsible machine table at the bottom left (No., Machine, Status chip, Work Order; a row
click selects the machine like a click in the scene), and a small vertical camera bar (+, −, home = reset view).
Read the layout only; nothing is copied from BPT. The per-status chips sit in the table header as the legend.

**Files:**
- Create: `erp_internal/public/js/lantai/hud.js`, `erp_internal/public/js/lantai/kaca.js` (the shared glass CSS)
- Modify: `production_floor.py` (`get_data()` adds `perusahaan`), its tests, `lantai.bundle.js`, `label.js`,
  `panel.js`, `erp_internal/translations/id.csv`, `tools/lantai.mjs`

**Interfaces:**
- `get_data()` adds `"perusahaan": {"nama": str, "logo": str | None}` from the default company; `logo` only when
  the user may read Company, else None; `nama` falls back to the app title when there is no default company.
- `hud.js` exports `buatHud(root) -> {perbarui(data), status(live: bool, waktu), buang()}`:
  - top left, top right and the summary strip as in the spec; all text by `textContent`, the logo through an
    `<img>` whose `src` is set only for a same-origin `/files/` or `/private/files/` path;
  - one `setInterval` of 1 s for the clock (`Intl.DateTimeFormat` with `frappe.boot.lang`), cleared on `jeda()`
    and `buang()`, restarted on `lanjut()`;
  - counts come from the same `data()` the scene uses, recomputed on every `perbarui()`.
- `kaca.js`: one CSS block for every card (HUD, labels, panel, reset button): translucent fill,
  `backdrop-filter: blur(20px) saturate(180%)`, 1 px light edge, radius 16–20 px, soft shadow, light and dark
  values from Desk's theme (`[data-theme]`), solid fallback under `@supports not (backdrop-filter: …)` and
  `@media (prefers-reduced-transparency: reduce)`.
- Phone width (< 760 px): the bar wraps into two compact rows and never covers the selected machine's panel.

- [x] **Step 1:** Tests: `test_data_perusahaan` (name and logo for a Manufacturing User; logo None for a user
  without Company read). `lantai.mjs` cases:
  - "hud": the company name, a clock that changes within 2 s, "14" machines, status chip counts equal to the
    server's statuses, utilization = Production ÷ machines;
  - "hud-live": block `/socket.io` and the dot reads "Updated …";
  - "hud-xss": a company name `<img src=x onerror=window.kena=1>` shows as text, `window.kena` undefined;
  - "glass": every card's computed `backdrop-filter` contains `blur`; text contrast ≥ 4.5:1 against the card in
    light and dark;
  - the "perf" case again with the bar on.
- [x] **Step 2:** See them fail, implement until they pass, plus the full suite. Look at screenshots in light,
  dark and phone width (Read tool): clean, nothing overlapping, every figure readable.
- [x] **Step 3:** Commit `feat(lantai): info bar and liquid glass look`. Tell Abel to restart `bench start`.

**Deviations:** labels are glass without backdrop blur (14 moving blurred labels broke the frame gate); label, clock and bar text is written only once the camera rests; the KPI card row and the machine table (status chips in its header) are separate cards; the host's light/dark comes from `data-tema`, set from Desk's `data-theme`.

### Task 7: Navigation, docs and the image

**Files:**
- Modify:
  - `erp_internal/tampilan.py` (Manufacturing sidebar and `PINTASAN`: Production Floor after Home);
  - `erp_internal/tests/test_tampilan.py` and `tools/cek_layar.mjs` (the new link);
  - `docs/panduan/produksi.md` (a short "Production Floor" section with a screenshot via
    `tools/panduan_gambar.mjs`);
  - README, `.claude/rules/tampilan.md`, a new `.claude/rules/lantai.md` (paths `erp_internal/production_floor.py`,
    `public/js/lantai/**`; the lessons and the budget above), CLAUDE.md, `docs/PROGRESS.md`, `docs/TODO.md`.

- [x] **Step 1:** Add the link and update the tests. Run the full suite, `cek_layar.mjs` and `lantai.mjs`; all
  pass.
- [x] **Step 2:** Build the image locally (`docker build -f deploy/Containerfile -t erp-internal:uji .`) and run
  `deploy/check_image.sh erp-internal:uji`. It passes, `lantai.bundle.js` included. If the build is too slow on the
  Mac, write "not run" and why.
- [x] **Step 3:** Run the repo's reviewer agent (security: the whitelisted methods, the realtime payload, XSS) and
  docs-sync, and fix what they find.
- [ ] **Step 4:** Commit `docs(lantai): Production Floor in the guides, rules and README`, then push to
  `feat/lokal`.

**Deviations:** Production Floor is the first link after Home, not second; the page's roles are Manufacturing User only (Task 7 review); the strip after returning to the floor is fixed with a `ResizeObserver` in the page script (`lantai.mjs strip`); Step 3 ran as the controller's security review and docs sync; push waits for Abel.

## Needed from Abel

- `/etc/hosts`: add `127.0.0.1 erp.localhost` (sudo). Without it, Node's socket.io can't resolve `*.localhost` on
  macOS and live updates fall back to the 60 s poll.
- Restart `bench start` after Tasks 2 to 6 (each one builds).
- Look at the floor once in your own Chrome: does it feel smooth on your MacBook?
