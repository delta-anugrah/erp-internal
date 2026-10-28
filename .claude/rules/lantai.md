---
paths: ["erp_internal/production_floor.py", "erp_internal/public/js/lantai.bundle.js", "erp_internal/public/js/lantai/**", "erp_internal/erp_internal/page/production_floor/**", "tools/lantai.mjs"]
---
# Production Floor (`/desk/production-floor`)

Server: `production_floor.py` (`get_data`, POST `set_status`, realtime `production_floor`). Client: the page script
(small, only the plain table and `erp.lantai.ambil`) and `lantai.bundle.js` with `lantai/{adegan,mesin,label,panel,hud,kaca}.js`.
The full description is in CLAUDE.md's "Where things are"; the design and its two revisions in
`docs/superpowers/specs/2026-10-28-production-floor-design.md`.

## Names

- Anything in a URL, an API path or an event is English (`production-floor`, `get_data`, `set_status`, `production_floor`);
  everything inside the code stays Indonesian (`lantai`, `mesin`, `adegan`, `kaca`, `ambil`). UI text is English in
  `__()` with Indonesian in `id.csv`.

## Smoothness budget (Abel: "the animation must feel smooth"; measured by `lantai.mjs perf`, headed, 1440x900 @2x)

- >= 57 fps over a 10 s scripted orbit with two status changes (first 2 s dropped).
- Frame intervals > 25 ms: at most 1 %. Longest frame <= 50 ms. 0 long tasks.
- <= 60 draw calls, <= 150k triangles (now 10 and 14,394). 20 status changes grow no geometry, texture or program.
- Not p95: Chrome's rAF clock sits at 18.6 ms even for an empty canvas, so a p95 gate only measures that noise.
- Adaptive quality (mean frame over 22 ms for 2 s: pixel ratio 1, still platens) and the home button answering within
  300 ms under 6x CPU throttle (`adaptive`).

## Lessons (each cost a day)

- **A text write during a camera drag stalls Chrome's main thread 50-100 ms.** No script, layout or paint shows in the
  trace. So label, clock and info bar text is written only once the camera rests (`label.js` 120 ms, bar at most ~1 s).
  Scene, lamps and panel update at once. Do not "fix" this by writing text in the render loop.
- **Blur is expensive per moving layer.** The 5 fixed cards (bar, KPI row, table, panel, camera bar) keep a 20 px
  backdrop blur; the 14 moving labels are glass without blur (even 3 px broke the dropped-frame gate). Without
  `backdrop-filter` or with `prefers-reduced-transparency` every card turns solid.
- One WebGL context for the whole session: leaving the page pauses, coming back resumes; never create a second canvas.
  One InstancedMesh per part (10 draw calls for 14 machines); a refresh with the same machines touches only changed rows.
- Fetch with plain `fetch`, never `frappe.call`: a failed request must not open a message dialog.
- Record text (item names, models, company) goes in by `textContent` only; a company logo only from same-origin `/files/`.
- Desk caches page scripts in the browser until `bench clear-cache`, so the page script stays small; logic is in the bundle.
- The page hides Desk's sidebar, which Desk does at its own pace after the page's show: a `ResizeObserver` on the page body and the sidebar calls `wrapper.fit()` whenever the layout moves (no timers: Desk's timing varies), or the host keeps the old sidebar's width as an empty strip (`strip` case, which delays the hide by 1.2 s).
- Only Manufacturing User opens the page (Administrator too): it is the role that reads Workstation, so another role would get an empty floor. The nudge `production_floor` has an empty payload and is not sent for a Workstation that is no numbered machine; `set_status` answers a missing and a forbidden machine alike; the company name and logo only for a user who may read that Company.
- A sidebar or build change needs `bench build --app erp_internal` and a restart of `bench start`.

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
