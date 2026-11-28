# Manual book

Two user manuals in Indonesian for staff starting from zero: `operator.md` (role Produksi) and `admin.md` (role
Admin, with Super Admin as Lampiran A). They are written from the video scripts in `docs/video/` and the guides in
`docs/panduan/`, with screen labels as the Indonesian UI shows them. Each `![...](gambar/<id>.png)` is a screenshot
placeholder; `shotlist.json` lists every one (user, desk path, what must be on screen, caption) so the pictures can
be taken on `erp.localhost`: `ERP_SANDI=<SAMPLE_PASSWORD> node tools/manual_gambar.mjs [id or prefix …]` writes
`gambar/<id>.png` (gitignored, like the PDFs; one recipe per id in `RESEP`; drafts it makes are deleted, submitted ones cancelled, machine
statuses and languages put back; never while a video is being recorded on the same bench). The PDFs are built from these Markdown files with `node tools/manual_pdf.mjs [operator|admin]` into `docs/manual/pdf/` (a missing picture prints as a grey placeholder box).
