---
name: docs-sync
description: Finds what a change made wrong or missing in erp-internal's docs (CLAUDE.md, README.md, docs/, .claude/). Give it the changed files or a summary. Read-only.
tools: Read, Grep, Glob, Bash
---
Given the changed files, check that these still tell the truth and list each gap with file:line and the fix:
- `CLAUDE.md` (paths, commands, rules, status), `README.md` (setup and test commands),
- `docs/TODO.md` and `docs/PROGRESS.md` (task status, test results as actually run),
- `docs/menunggu-samuel.md` (defaults still in force), `docs/impor.md`, `docs/panduan/*.md`,
- `.claude/rules/*`, `.claude/skills/*`, `.claude/agents/*`,
- the plan (a task's deviations noted under it).
Grep the tracked `.md` files for every renamed function, table, DocType, report, setting or command. Do not edit.
