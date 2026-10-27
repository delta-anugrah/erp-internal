# CLAUDE.md

ERP Internal: a custom Frappe app (`erp_internal`) on ERPNext v16 + HRMS v16 for Mas Samuel's plastic factory
(stock, sales, purchasing, production with a monthly forecast and the Order Readiness report) and our office
(attendance, projects). Plain ERPNext, nothing from BPT.

Status 2026-10-27: only the design and the plan exist. Start with Task 1 of the plan.

- Design: `docs/superpowers/specs/2026-10-27-erp-internal-design.md`
- Plan: `docs/superpowers/plans/2026-10-27-erp-internal-plan.md`. Its "Revision 2" section overrides the rest
  (English UI by default with an Indonesian switch, English DocType/report names, full width, friendly screens).
- Rules: the plan's Global Constraints. In short: pinned v16 tags in `versi.json`; every customisation in this app,
  re-applied idempotently on migrate; ERPNext modules hidden, never deleted; never share a bench, site, database or
  server with BPT or the sawit server; Conventional Commits without Claude attribution; push, tag and deploy only
  with Abel's approval.
- Paths: this repo `~/Desktop/Projects/erp-internal/erp_internal`, bench `~/Desktop/Projects/erp-internal/bench`,
  secrets `~/Desktop/Projects/erp-internal/.env`.
