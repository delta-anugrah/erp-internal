"""The PC backup installer, downloaded from Frappe's Download Backups page (`public/js/backups.js`).

`data/pasang-cadangan-pc.cmd` is a Windows script run once on the admin PC: it installs rclone (checksum
pinned), asks for an R2 read-only key, refuses a key that can write, and schedules a nightly pull of the server's
backups into a folder only that user can open. It holds no secret. Guide: `docs/cadangan-pc.md`.
"""

from pathlib import Path

import frappe

BERKAS = Path(__file__).parent / "data" / "pasang-cadangan-pc.cmd"


@frappe.whitelist(methods=["GET"])
def unduh() -> None:
	frappe.only_for("System Manager")
	frappe.response.filename = BERKAS.name
	# cmd.exe needs CRLF line ends; the repo keeps LF (.gitattributes).
	frappe.response.filecontent = BERKAS.read_text(encoding="ascii").replace("\n", "\r\n").encode("ascii")
	frappe.response.type = "download"
