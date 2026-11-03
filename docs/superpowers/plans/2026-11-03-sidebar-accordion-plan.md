# Desk Sidebar Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unlabelled icon rail with one labelled sidebar: a collapsible header per module (Stock … Settings, HR included) with that module's links under it, the same on every ERP and HR page, per role.

**Architecture:** The server adds one boot key, `erp_menu` (the user's modules in rail order with label and icon), through a third `extend_bootinfo` hook in `tampilan.py`. A small client module in our bundle patches Frappe's `Sidebar` so that, on a shell named in `erp_menu`, its item list becomes every menu module as a collapsible `Section Break` with that module's own resolved items (`frappe.boot.module_sidebars[shell].items`) as `child` rows, each link routed into its own shell. Frappe then draws, opens and highlights the sections itself (`nest_section_items`, `expand_parent_section`, `find_active_item`). On those shells the dock is hidden by a body class and plain CSS.

**Tech Stack:** Frappe v16.53.0 desk (jQuery, `frappe.ui.Sidebar`, `frappe.ui.sidebar_item`), esbuild bundle `erp_internal.bundle.js`, plain CSS `public/css/erp_internal.css`, Python `frappe.tests.IntegrationTestCase`, Playwright `tools/cek_layar.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-03-sidebar-accordion-design.md`

## Global Constraints

- Everything in `erp_internal`; no edit to Frappe, ERPNext or HRMS files or rows (`.claude/rules/tampilan.md`).
- One place to change a menu: the tables in `erp_internal/tampilan.py` (`IKON`, `LABEL`, `SIDEBAR`, `NAMA_LINK`, `IKON_LINK`, plus the new `IKON_MODUL`).
- Boot hooks never fail boot: any exception is logged with `frappe.log_error` and boot goes on.
- A client failure leaves Frappe's own dock and module sidebar (catch, log to console, return the original items).
- Frappe's System app (Build, System Settings; shells not in `erp_menu`) keeps Frappe's rail and sidebar untouched.
- Module header icons (Lucide, sprite `/assets/frappe/icons/lucide/icons.svg`, ids `icon-<name>`): Stock `warehouse`, Selling `receipt`, Buying `shopping-cart`, Manufacturing `factory`, Projects `folder-kanban`, Shift & Attendance (HR) `users`, Setup (Settings) `settings`.
- Link icons to fix: Stock Entry `arrow-left-right`, Delivery Note `truck`, Warehouse `warehouse` → pick a non-header icon (see Task 2), Home `house`.
- Several sections may be open at once; the current page's module opens on arrival.
- Folded sidebar: icons only, label as tooltip, fold state stays in localStorage `desk-sidebar-collapsed`; the fold arrow stays >= 32 px.
- Production Floor page stays full screen without sidebar (it hides the sidebar itself; don't change that).
- UI text English in `__()`/`_()`, Indonesian in `erp_internal/translations/id.csv`. Python identifiers Indonesian, comments English. ruff: tabs, double quotes, 110 columns.
- Conventional Commits, no Claude attribution, branch `feat/lokal`.

## Review Focus

1. An Admin opens a Sales Invoice (module Accounts, no header) from Selling: the accordion shows, no blank sidebar (Task 3 step "Accounts page", Task 4 check).
2. Delivery Note sits under both Stock and Selling: on `/desk/selling/delivery-note` only the Selling one is highlighted and only Selling opens by itself (Task 4 check).
3. A User (Stock + Manufacturing only) never sees a header for a module they can't open, even though the site layer is shared (Task 2 test `test_menu_samping_per_profil`).
4. Phone width (390 px): the drawer shows the same accordion and closes on a link click (Task 4 check).
5. The bundle throws (e.g. a Frappe update renames a method): Frappe's dock and sidebar still show (Task 3 step "fallback", checked by hand once).

---

### Task 1: Spike (throwaway): prove the client patch and pick dock/fold handling

Timebox 1 hour. Nothing from this task is committed except the notes appended to this plan under "Spike notes".

**Files:** scratch only (paste into the browser console on `http://erp.localhost:8002` as `admin@example.com`).

- [x] **Step 1:** In the console, patch `frappe.ui.Sidebar.prototype.load_sidebar_data` as Task 3 describes (merged list for the shells Stock, Selling, Buying, Manufacturing, Projects, Shift & Attendance, Setup), patch `frappe.ui.sidebar_item.TypeLink.prototype.get_path` to use `this.item.erp_shell || this.current_module`, then `frappe.app.sidebar.setup(frappe.app.sidebar.current_module)`.
- [x] **Step 2:** Answer and write down: (a) do sections render collapsible and open the current module (`expand_parent_section`)? (b) do hrefs of another module's links carry that module's shell, and does clicking one land with that module open and the link highlighted? (c) does section open/closed state (`section_breaks_state`, localStorage) behave per shell or need one shared key? (d) is `app_include_js` loaded before the desk's first `Sidebar.setup` (reload with the patch in the bundle via a temporary local edit, not committed)?
- [x] **Step 3:** Dock and fold. Hide `#desk-dock` with CSS and check what disappears with it: search, notifications (Frappe already draws both in the sidebar's `.standard-items-band`?), the user avatar menu (`.dock-user-button`), the app logo (`.dock-logo`). Then fold the sidebar: with the dock hidden, does `hides_when_collapsed()` (true while the dock is pinned) slide it shut, and what makes it fold to icons instead (setting `frappe.app.sidebar.dock.is_pinned = false`, or overriding `hides_when_collapsed` on our shells)? Pick the smallest way to keep: avatar menu reachable at the bottom left, ERP logo on top, fold to icons.
- [x] **Step 4:** Append "Spike notes" at the end of this plan: the answers, the chosen dock/fold method, and any change to Tasks 3-4 they force. Commit only the plan: `git commit -m "docs(plan): sidebar accordion spike notes"`.

### Task 2: Server: the menu in boot, header icons, fixed link icons

**Files:**
- Modify: `erp_internal/tampilan.py` (new `IKON_MODUL`, `menu_samping`; `IKON_LINK`; `_baris_sidebar` Home icon)
- Modify: `erp_internal/hooks.py:182` (`extend_bootinfo` gets `"erp_internal.tampilan.menu_samping"` last)
- Modify: `erp_internal/translations/id.csv` (only if a label is new; module labels already are)
- Test: `erp_internal/tests/test_tampilan.py`

**Interfaces:**
- Produces: `IKON_MODUL: dict[str, str]` (dock/sidebar name → Lucide name, keys exactly `IKON`'s); `IKON_RUMAH = "house"`; `menu_samping(bootinfo) -> None` sets `bootinfo.erp_menu = [{"shell": str, "label": str, "icon": str}, ...]`: `IKON` order, only shells present in `bootinfo.module_sidebars` with at least one item of type Link besides the home Workspace, `label` = `LABEL.get(shell, shell)` (untranslated; the client calls `__()`), `icon` = `IKON_MODUL[shell]`.

- [x] **Step 1: Write the failing tests**

```python
def test_menu_samping_per_profil(self):
	# One menu for ERP and HR (Abel 2026-11-03): IKON order, only the profile's modules.
	from frappe.boot import get_bootinfo
	from erp_internal.tampilan import IKON_MODUL, menu_samping
	harap = {
		DEVELOPER: ["Stock", "Selling", "Buying", "Manufacturing", "Projects", "Shift & Attendance", "Setup"],
		ADMIN: ["Stock", "Selling", "Buying", "Manufacturing", "Projects", "Shift & Attendance", "Setup"],
		USER: ["Stock", "Manufacturing"],
	}
	for profil, shells in harap.items():
		frappe.set_user(pengguna_profil(profil, "menu"))
		try:
			boot = get_bootinfo()
			menu_samping(boot)
		finally:
			frappe.set_user("Administrator")
		self.assertEqual([m["shell"] for m in boot.erp_menu], shells, profil)
		m = {m["shell"]: m for m in boot.erp_menu}
		self.assertEqual(m["Stock"], {"shell": "Stock", "label": "Stock", "icon": "warehouse"})
	self.assertEqual(set(IKON_MODUL), set(IKON))

def test_menu_samping_tak_pernah_gagal(self):
	from erp_internal.tampilan import menu_samping
	menu_samping(frappe._dict(module_sidebars=None))  # logged, boot goes on

def test_ikon_ada(self):
	# Every icon we name exists in Frappe's Lucide sprite.
	from erp_internal.tampilan import IKON_MODUL, IKON_RUMAH
	sprite = open(frappe.get_app_path("frappe", "public", "icons", "lucide", "icons.svg")).read()
	for ikon in {*IKON_MODUL.values(), *IKON_LINK.values(), IKON_RUMAH}:
		self.assertIn(f'id="icon-{ikon}"', sprite, ikon)
```

Extend `test_ikon_sidebar`: the first Link of each `SIDEBAR` shell (the home Workspace) has icon `IKON_RUMAH`; no shown link's icon equals its own module's `IKON_MODUL` icon.

- [x] **Step 2:** Run `cd ~/Desktop/Projects/erp-internal-bench && bench --site erp-test.localhost run-tests --module erp_internal.tests.test_tampilan`. Expected: the new tests fail (ImportError on `IKON_MODUL`/`menu_samping`).
- [x] **Step 3: Implement.** `IKON_MODUL` with the Global Constraints icons. `IKON_LINK`: add Stock Entry `arrow-left-right`, Delivery Note `truck`; Warehouse must not repeat Stock's `warehouse`: use `building-2` (check it exists, the sprite test will); Settings links must not repeat `settings`: use `sliders-horizontal` for all `* Settings` rows. `_baris_sidebar`: the home row (the base `beranda` and the `RUMAH_SENDIRI` row) gets `IKON_RUMAH`, under the same "only where it differs from the base" rule. `menu_samping` wrapped in `try/except Exception: frappe.log_error("erp_internal: menu_samping")`. Comment above `IKON_MODUL` says why (Abel 2026-11-03, labelled one menu). Add the hook.
- [x] **Step 4:** Run the module again, then `bench --site erp.localhost migrate` twice and confirm `test_idempoten` passes (a second `terapkan` writes nothing). Expected: all `test_tampilan` tests pass.
- [x] **Step 5:** Commit `feat(tampilan): erp_menu in boot and module icons for the accordion sidebar`.

### Task 3: Client: the accordion

**Files:**
- Create: `erp_internal/public/js/menu_samping.js`
- Modify: `erp_internal/public/js/erp_internal.bundle.js` (import it)
- Modify: `erp_internal/public/css/erp_internal.css` (dock hidden on our shells, header look, fold arrow position)

**Interfaces:**
- Consumes: `frappe.boot.erp_menu` (Task 2), `frappe.boot.module_sidebars[shell].items`, the Spike notes' dock/fold method.
- Produces: `erp_internal.menu_samping.gabung(menu, sidebars) -> Array<item>` (pure, exported on `erp_internal.menu_samping` for the console and cek_layar): for each menu entry a `{type: "Section Break", label: __(m.label), icon: m.icon, collapsible: 1, erp_shell: m.shell}` followed by copies of that shell's items with `child: 1` and `erp_shell: m.shell`; a shell's own Section Breaks are dropped (one level of nesting only), its children kept flat under the module. Body class `erp-menu` while the sidebar shows our menu.

- [x] **Step 1: Implement `gabung` and the patches.** Patch `frappe.ui.Sidebar.prototype.load_sidebar_data`: call the original; if `erp_menu` names `this.current_module`, or the current module is `Accounts`/`Leaves` (`MODUL_TANPA_IKON`: show the menu with no section forced open), set `this.sidebar_items = gabung(...)` and run `this.nest_section_items()`; toggle `body.erp-menu`. Patch `frappe.ui.sidebar_item.TypeLink.prototype.get_path` to pass `this.item.erp_shell || this.current_module`. Draw the header icon on our Section Breaks (Frappe's template draws none for a non-indented one): after `make_sidebar`, prepend `frappe.utils.icon(icon, "sm")` to each `.section-item[data-id=<label>] .section-break`. Section state: as the spike found (one shared key if per-shell state makes sections jump). Keep the file's comments to the why, like `erp_internal.bundle.js`.
- [x] **Step 2: Fallback.** Wrap each patched body in `try { … } catch (e) { console.error("erp_internal menu_samping", e); return original result; }` so Frappe's own list shows.
- [x] **Step 3: Header and CSS.** Under `body.erp-menu` the sidebar header (`sidebar_header.js`, today the module name with its switcher) shows the ERP tile's icon and title (`app_logo_url`/`app_title` of the `erpnext` entry in `frappe.boot.app_data`, set by `merek_aplikasi`) linking to `/desk`, on HR pages too. Then: hide the dock per the spike's method; section headers read as menu rows (normal weight 600, 13 px, same padding as links, chevron right/down), not small grey captions; folded sidebar shows header icons only with `title` tooltips; move the fold arrow rule that parks it in the dock (`.sidebar-hidden … left: -45px`) so it applies only when the dock shows (`body:not(.erp-menu)`), and place it at the sidebar's bottom edge otherwise, still >= 32 px.
- [x] **Step 4: Check by hand** on `erp.localhost` after `bench build --app erp_internal` and a hard reload, as admin@: Stock Entry page shows seven headers with Stock open; a click on Selling ▸ Sales Order lands on `/desk/selling/sales-order` with Selling open and the link highlighted; Accounts page: open a Sales Invoice from Selling, the accordion shows; fold, reload, unfold; System app (developer@, Build tile) shows Frappe's rail. Temporarily throw inside `gabung` and confirm the old dock + sidebar show, then remove the throw.
- [x] **Step 5:** Commit `feat(desk): one labelled accordion sidebar on ERP and HR pages`.

### Task 4: cek_layar per role

**Files:**
- Modify: `tools/cek_layar.mjs`

**Interfaces:**
- Consumes: `erp_internal.menu_samping.gabung`, `body.erp-menu`, `.section-item`, the menu labels.

- [x] **Step 1: Replace the rail checks** (the per-app rail module list and the folded-arrow-in-dock check, around lines 100-170) with, per profile (`PROFIL[p].modul`, same order as `IKON`): `#desk-dock` not visible on an ERP page; the section headers' text equals the profile's labels (`LABEL` names: HR, Settings) in order; each header has an icon; clicking a closed header shows its links; the module of the page opened is open on arrival; fold → icons only and the arrow >= 32 px with nothing over its centre, reload keeps it folded, unfold.
- [x] **Step 2: Cross-module and edge checks:** from Stock click Selling ▸ Delivery Note: URL `/desk/selling/delivery-note`, exactly one `.active-sidebar` (or Frappe's active class, as found in the spike) and it sits under Selling; Admin: open `/desk/selling/sales-invoice/new`, the accordion shows; Developer: Build tile shows `#desk-dock` (Frappe's rail kept); at 390x844 the drawer opens with the same headers and closes after a link click. Screenshot `<profile>-menu.png` and `<profile>-menu-lipat.png` in `tools/hasil/`.
- [x] **Step 3:** Run `ERP_SANDI=<SAMPLE_PASSWORD> node tools/cek_layar.mjs` (bench running, after `bench build --app erp_internal`). Expected: exit 0, all three users OK.
- [x] **Step 4:** Commit `test(cek_layar): the accordion sidebar per role`.

### Task 5: Docs, guide screenshots, full run

**Files:**
- Modify: `.claude/rules/tampilan.md` (rail → accordion: `erp_menu`, `menu_samping.js`, dock hidden on our shells, fold arrow, System app untouched)
- Modify: `CLAUDE.md` (Rules/Where things are where the rail is named), `README.md` if it describes the rail
- Modify: `docs/panduan/*.md` wording about the icon rail; retake every `docs/panduan/gambar/*.png` that shows the sidebar
- Modify: `docs/TODO.md`, `docs/PROGRESS.md`

- [x] **Step 1:** `grep -rn -i "rail\|dock\|icon" CLAUDE.md README.md docs/panduan .claude/rules` and fix every line the change made wrong. Retake the guide screenshots the way they were made (see `docs/panduan/` and PROGRESS for the script used last time).
- [x] **Step 2:** Run `bench --site erp-test.localhost run-tests --app erp_internal`, `node --test tools/denah.test.mjs`, `ERP_SANDI=… node tools/lantai.mjs` (Production Floor still full screen). Expected: all pass.
- [x] **Step 3:** Run the `docs-sync` agent with the changed files; fix what it finds.
- [x] **Step 4:** Commit `docs: the accordion sidebar in the rules, guides and screenshots`.

## Execution notes (2026-11-03)

- Task 1 (spike) was folded into Task 3: Frappe's dock-less mode already gives search, notifications, the user menu
  and fold-to-icons, so the only point to prove was the patch itself, done directly in the browser.
- The dock is not hidden by CSS: `menu_samping.js` makes `Sidebar.dock_enabled` return false on our shells, and the
  header is Frappe's own dock-less header (the app's icon and the module, with its switcher), not "ERP" everywhere.
- Section state: one shared key `erp_menu` (patch on `TypeSectionBreak.prepare`); headers are `keep_closed`, and a
  `make_sidebar` patch opens the page's own module even when no link is lit (a module home, a phone's shut drawer).
- Icons beyond the plan: Purchase Order `clipboard-list`, Work Order `wrench`, Project `folder-open`, since their base
  icons equal their module's header icon. `_baris_sidebar` keys base icons by `item_key` (a home Workspace shares its
  `link_to` with other rows, which broke idempotence).
- `cek_layar` checks the lit and open module on `/desk/stock/stock-entry` (Admin's new User form is a dialog that
  lights nothing) and writes `<profile>-menu.png` and `<profile>-menu-hp.png`; the folded view stays in
  `<profile>-sidebar.png`'s fold steps, no separate `-menu-lipat.png`.
