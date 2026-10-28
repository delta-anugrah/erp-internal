# Production Floor: the 3D view of the 14 machines

Asked by Mas Samuel on 2026-10-28, through Abel. Abel's answers are from the same day. Plan:
`docs/superpowers/plans/2026-10-28-production-floor-plan.md`.

## Why

Samuel wants to see the factory floor the way BPT Live shows a BPT: every injection moulding machine in 3D, with
its state at a glance. It is the screen he will show and look at, so it must feel smooth. Abel: "animasinya harus
smooth, jangan patah2 / laggy".

## What it shows

- **The 14 machines** from `erp_internal/data/mesin.json`. `master.muat` loads each one as a Workstation named
  "Mesin 01" to "Mesin 14", with the custom fields `erp_nomor` (1 to 14), `erp_merek`, `erp_model`, `erp_tonase`,
  `erp_tahun` and `erp_negara`.
- **Two rows, exactly as Samuel drew them.** The back row is 14 13 12 11 10 9 8 and the front row is 1 2 3 4 5 6
  7, both read left to right from the default camera. The numbering runs in a U.
- **Each machine is a simplified injection moulding machine, not a box** (Abel). It has these parts:
  - a long base;
  - the clamp unit, with two platens and four tie bars;
  - the injection unit, with a barrel, a nozzle and a hopper on top;
  - a control panel with a screen;
  - an andon stack light.

  The body is tinted by brand, so JSW, NISSEI and CHENDE look different. The machine's length grows a little with
  tonnage.
- **A floating label over each machine** shows its number, brand and tonnage (for example "03 · NISSEI 260T"), plus
  its status chip. When the machine has a running Work Order, the label also shows the product and a progress bar
  (produced / planned).
- **Status comes from Workstation `status`** (ERPNext's options):

  | Status | Andon lamp | Motion |
  |---|---|---|
  | Production | green, steady | the moving platen cycles (mould opens and closes) |
  | Setup | yellow, slow pulse | still |
  | Idle (also empty) | yellow, steady | still |
  | Problem | red, pulse about 1 Hz | still |
  | Maintenance | blue, steady | still, body dimmed |
  | Off | unlit | still, body dimmed more |

## What a user does

- Orbit, zoom and pan the camera. Damping is on, and there is a reset button back to the default view.
- Click a machine to fly the camera to it and open a side panel with:
  - its details (brand, model, tonnage, year, country);
  - its running Work Order;
  - one button per status;
  - a link to the Workstation form.
- **Change a machine's status from the 3D screen** (Abel). This is allowed for whoever may write Workstation:
  Developer, Admin and User all hold Manufacturing User. The change is saved through the document, so it lands in
  the Workstation's Version history (`track_changes` is already on). The ERP form and every open Production Floor
  screen follow it.
- **Machine for a Work Order:** a new optional field, `Work Order.erp_mesin` (Link to Workstation), says which
  machine runs it. This is my call. Samuel has not yet said which product runs on which machine; when he does, a
  default per item can fill this field.

## Smoothness (the hard requirement)

- These figures are measured in headed Chrome at 1440×900 on Abel's MacBook (Apple Silicon), after a 2-second
  warm-up, while the camera orbits and two status changes arrive:
  - at least 57 fps (frames over measured seconds);
  - dropped frames (intervals over 25 ms) at most 1 % of frames, and max frame interval ≤ 50 ms;
  - no long task (over 50 ms).

  Not p95 frame time: on a 60 Hz display the p95 of requestAnimationFrame intervals sits at about 18.6 ms even for
  an empty WebGL canvas (Chrome's frame-clock jitter), so it is printed for information only.
- **Budget:**
  - at most 60 draw calls and 150k triangles;
  - no new geometry, material or texture after load, except when a label's text changes;
  - nothing allocated per frame.
- **Adaptive quality:** if the average frame time stays above 22 ms for 2 s, drop the pixel ratio to 1 and stop the
  platen motion.
- **Desk stays smooth too:**
  - the scene renders only while the page is visible;
  - it uses one WebGL context for the whole session;
  - three.js loads only on this page.

## Non-goals

- Machine sensors, cycle times from the machines, OEE and capacity figures. Samuel hasn't sent the data, and Abel
  said sensors come later.
- More than one floor, and a floor map editor.
- Editing machines in the 3D view. The Workstation form stays the place for that.

## Anti-goals: these would be failures even if the screen works

- Stutter, jumps or a frozen Desk.
- An error dialog, or a blank screen when realtime or WebGL fails. Without WebGL the page shows a plain table of
  the machines instead.
- Record text drawn as HTML. Item names and machine names reach the screen only as text (stored XSS).

## Left to the builder

- Exact geometry and colours within the look above.
- Camera angles.
- Label styling, following Desk's tokens.
- Where the code splits into modules.

## Revision 1 (Abel, 2026-10-28 17:13, after seeing Task 3's floor)

- **English route and endpoints.** The page is `production-floor` (`/desk/production-floor`); the server module is
  `erp_internal/production_floor.py` with `get_data()` and `set_status(machine, status)`; the realtime event is
  `production_floor`. The old Page `lantai-produksi` is removed on migrate. Code identifiers inside stay
  Indonesian (the repo's rule); only names that appear in a URL, an API path or an event change.
- **An info bar, like BPT Live's** (the twin is the reference for what, not for code):
  - top left: the company's logo (`Company.company_logo` of the default company, only for a user who may read
    Company) and its name, with "Production Floor" under it;
  - top right: today's date and the time, ticking every second in the user's language, plus a live dot: "Live"
    while realtime is connected, "Updated HH:MM" when the page runs on the poll;
  - a summary strip: number of machines, running machines and utilization (Production ÷ machines), one chip per
    status with its count and its andon colour (it doubles as the legend), Work Orders running, and output
    (produced ÷ planned, summed over the Work Orders shown).
- **Liquid glass look (Apple-style), modern and clean.** The info bar, the labels, the side panel and the reset
  button are frosted glass cards over the 3D floor: translucent fill, `backdrop-filter: blur() saturate()`, a thin
  light edge, large radius, soft shadow; light and dark follow Desk's theme. Without `backdrop-filter`, or with
  `prefers-reduced-transparency`, the cards turn solid. Every figure stays readable (contrast ≥ 4.5:1).
- The smoothness budget still holds with the info bar and glass on; the clock writes text once a second, never
  per frame.
- **Not now** (needs data Samuel hasn't sent): shift and shift target, OEE, today's downtime, cycle time.
