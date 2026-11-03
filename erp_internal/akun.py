"""The first accounts of a site, asked once by `make start` (local) or `make setup` (server).

The terminal asks for the accounts and passwords (`deploy/server/akun.sh`) and hands them over in the environment variable
`ERP_AKUN` (JSON), never on a command line, so no password shows in a process list or the shell history:

	{"Administrator": "<password>", "akun": [{"profil": "Admin", "email": "...", "sandi": "..."}]}

`buat()` sets Administrator's password and makes (or updates) one System User per entry with that Role Profile,
its Module Profile and, for Admin and User, a default permission on the company, like the sample users of
`contoh.py`. It prints what it did, never a password (from the terminal it prints and returns nothing, else bench
prints the result again). Later accounts and password resets are made by an Admin in the app.
`bench execute` commits afterwards; a refusal read from `ERP_AKUN` is printed and exits 1 (bench
would otherwise hide the message behind its own eval fallback).
"""

import json
import os
import sys
from contextlib import contextmanager

import frappe
from frappe import _
from frappe.utils import validate_email_address
from frappe.utils.password import update_password

from erp_internal import setup
from erp_internal.tampilan import DEVELOPER, MODUL_BOLEH, PROFIL_PERAN
from erp_internal.tests import utils

PANJANG_MIN = 8  # the shortest password accepted, also checked in deploy/server/tanya.sh


@contextmanager
def _dari_terminal():
	"""For a call from the terminal: a refusal becomes its message on stderr and exit code 1."""
	try:
		yield
	except frappe.ValidationError as e:
		print(f"ERROR: {frappe.utils.strip_html(str(e))}", file=sys.stderr)
		raise SystemExit(1) from None


def _masukan() -> dict:
	"""The JSON in `ERP_AKUN`."""
	isi = os.environ.get("ERP_AKUN")
	if not isi:
		frappe.throw(_("ERP_AKUN is not set: run make start (or make setup on the server)."))
	return json.loads(isi)


def _cek_sandi(sandi) -> str:
	if not isinstance(sandi, str) or len(sandi) < PANJANG_MIN:
		frappe.throw(_("A password needs at least {0} characters.").format(PANJANG_MIN))
	return sandi


def buat(data: dict | None = None) -> list[str] | None:
	"""Administrator's password and one account per entry of `data` (default: `ERP_AKUN`). Every entry is checked
	before anything is written. Returns the lines, or prints them when called from the terminal."""
	if data is not None:
		return _buat(data)
	with _dari_terminal():
		print("\n".join(_buat(_masukan())))


def _buat(data: dict) -> list[str]:
	sandi_admin = data.get("Administrator")
	akun = data.get("akun") or []
	if sandi_admin is not None:
		_cek_sandi(sandi_admin)
	if akun and not frappe.is_setup_complete():
		# The Role Profiles are made by setup after the wizard
		frappe.throw(
			_(
				"Create the Developer, Admin and User accounts after the setup wizard; for now only Administrator."
			)
		)
	dipakai = set()
	for a in akun:
		if a.get("profil") not in PROFIL_PERAN:
			frappe.throw(_("Unknown role {0}.").format(a.get("profil")))
		email = (a.get("email") or "").strip().lower()
		if not validate_email_address(email):
			frappe.throw(_("{0} is not a valid email address.").format(email or "''"))
		if email in dipakai:
			frappe.throw(_("{0} is given twice.").format(email))
		dipakai.add(email)
		a["email"] = email
		_cek_sandi(a.get("sandi"))

	hasil = []
	if sandi_admin is not None:
		update_password("Administrator", sandi_admin)
		hasil.append("Administrator: password set")
	company = (setup.perusahaan() or [None])[0]
	for a in akun:
		profil, email = a["profil"], a["email"]
		ada = frappe.db.exists("User", email)
		modul = profil if profil in MODUL_BOLEH else None
		utils.buat_pengguna(email, profil, modul, None if profil == DEVELOPER else company)
		update_password(email, a["sandi"])
		hasil.append(f"{profil}: {email} {'updated' if ada else 'created'}")
	return hasil
