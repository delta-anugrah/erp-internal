# Desk sidebar as an accordion: design

Abel, 2026-11-03. Status: approved for planning once Abel reads it.

## Why

The Desk's left edge today is Frappe's dock: a narrow rail of module icons with no text (Stock, Selling, Buying,
Manufacturing, Projects, HR, Settings for an Admin; Stock and Manufacturing for a User). Next to it, the module
sidebar lists the links of the one module that is open. People don't know which icon is which menu, so they
guess and click around (Abel: "kita gatau nama menunya apa"). The icons themselves don't match their names
well either.

## What it becomes

One sidebar, always labelled, a menu with submenus (mockup option A, chosen by Abel):

- Top: the app logo slot the rail has today (the ERP tile icon), then the search and notifications that sit on
  the rail now.
- Then one header per module the user may open, in today's `IKON` order, each an icon + label: Stock, Selling,
  Buying, Manufacturing, Projects, HR, Settings (labels from `LABEL`).
- Clicking a header opens or closes its submenu. The submenu is exactly that module's sidebar today: Home,
  then the `SIDEBAR` links in order, with their icons.
- The module of the current page is open on arrival and its current link is highlighted, as today.
- More than one submenu may be open at a time (our call).
- The narrow icon rail (the dock) is no longer shown.
- The fold arrow stays (`desk-sidebar-collapsed` in localStorage, the 32 px button `cek_layar` checks). Folded,
  the sidebar shows the module icons only, with the label as a tooltip (our call). Clicking a folded icon goes to
  that module's Home.
- The profile avatar stays at the bottom left.
- Production Floor stays full screen with no sidebar, as today.
- Indonesian: headers and links translate as they do now (`translations/id.csv`).

## Per role

Unchanged rules, only the shape changes. A header shows only for a module on the user's rail today (`IKON`,
`MODUL_BOLEH`, `block_modules`); inside it, only the links the user may open (Frappe already drops a link the
user cannot read). So:

- User: Stock and Manufacturing.
- Admin: Stock, Selling, Buying, Manufacturing, Projects, HR, Settings.
- Developer: Admin's set.

One menu across two apps (Abel, 2026-11-03). Today HR (`Shift & Attendance`) sits on the hrms rail and the other
six on the erpnext rail, so inside ERP an Admin sees six icons and inside HR only HR. The accordion merges them:
whether the user came in through the ERP tile or the HR tile, the sidebar is the same seven headers. Clicking
Stock from an HR page simply goes to Stock. The logo slot on top shows the ERP icon everywhere (our call). The
ERP and HR tiles stay on the Apps screen and both land on this one menu.

Frappe's own System app (Build, System Settings, Users and the like; Developer only) keeps Frappe's normal rail
and sidebar, untouched (our call). So the rail is hidden only on erpnext and hrms pages, never page-wide. A Frappe
page reached from one of our links (Data Import, Report Builder, a User form from Settings) shows whatever Frappe
shows it in today's shell; if that is our shell, it shows the accordion.

Accounts and Leaves keep no header (`MODUL_TANPA_IKON`). A page Frappe opens in those modules (an invoice list
reached from Selling, say) must still show the accordion, with the header of the module the user came through
open, or none open if that can't be known. It must never show an empty or broken sidebar.

## Icons

Module headers (Lucide names, all present in `/assets/frappe/icons/lucide/icons.svg`):

| Module | Icon |
|---|---|
| Stock | `warehouse` |
| Selling | `receipt` |
| Buying | `shopping-cart` |
| Manufacturing | `factory` |
| Projects | `folder-kanban` |
| HR | `users` |
| Settings | `settings` |

Links: `IKON_LINK` stays the source. Add or fix where the icon doesn't match the name, at least
Stock Entry `arrow-left-right`, Delivery Note `truck`, Warehouse `warehouse`, and Home `house`. The builder goes
through every shown link once and fixes any other mismatch; every shown link keeps an icon (`test_ikon_sidebar`).
Link icons should not repeat their module's header icon where a better one exists.

## Constraints

- Everything lives in `erp_internal` and is re-applied idempotently on migrate (`tampilan.terapkan`). No edit to
  Frappe, ERPNext or HRMS files or rows; site layers and our own assets only (`.claude/rules/tampilan.md`).
- The data comes from the existing tables in `erp_internal/tampilan.py` (`IKON`, `LABEL`, `SIDEBAR`,
  `NAMA_LINK`, `IKON_LINK`, `RUMAH_SENDIRI`). One place to change a menu, not two.
- Module homes (`PINTASAN`, shortcuts equal to the sidebar links) stay as they are.
- Don't use the retiring surfaces (`Workspace Sidebar`, `Desktop Icon`).
- A failure in our sidebar code must leave a usable desk (fall back to Frappe's own dock + sidebar), never a blank
  left side. Boot hooks must never fail boot (`saring_aplikasi` rule).
- Plain CSS in `public/css/erp_internal.css` where possible; JS through `app_include_js` if needed.
- Phone width (< 768 px): Frappe's drawer shows the same accordion.

## Left to the builder

How it is drawn. Two routes look possible in Frappe v16.53; pick one after a short spike:

1. Native: every kept module's sidebar layer (`_sidebar`) holds all of the user's modules as collapsible
   `Section Break`s (`collapsible: 1`) with their links as `child` rows, and the dock is hidden. Frappe already
   draws, opens and highlights nested sections (`sidebar.js` `nest_section_items`, `expand_parent_section`).
   Open points: whether a link in another module's section routes into its own shell, and per-role headers
   (the layer is site-wide; Frappe drops a section whose links the user can't open?).
2. Client: a small script builds the accordion from `frappe.boot.module_sidebars` (already in boot, per user)
   in the dock's order, and hides the dock.

Prefer the route with less of our own code and fewer moving parts across a Frappe update.

## Done when

- `tools/cek_layar.mjs` per role (Developer, Admin, User): no rail, the expected headers in order, each header
  opens its links, the current module open on arrival, fold/unfold still works and survives a reload, a link in
  another module's submenu opens the right page with that module open, screenshots for the guide.
- Python tests for whatever `tampilan.py` writes (idempotent: a second migrate writes nothing), icons per link.
- Full test run passes; guide screenshots in `docs/panduan/` retaken where the sidebar shows; `.claude/rules/
  tampilan.md`, CLAUDE.md and the guides updated.

## Non-goals

- No change to who may see or do what.
- No new menus or links, no renames beyond icons.
- No change to the Apps screen tiles or to module homes.
- No change to the Production Floor page.
