"""What runs once the setup wizard is done, however it was filled (`make setup`, local or server, fills it
automatically, or a person fills it in the browser).

`selesai` is the `setup_wizard_complete` hook. It runs inside the wizard, where an exception rolls the whole wizard
back, so it does only the quick part and never raises: tick `erp_aktif` on the wizard's company and queue
`lanjutkan` for after the wizard commits, with the wizard's own account. `lanjutkan` does the slow part: our setup
(which makes the Role Profiles), that account into the Developer profile, the company on Admin and User accounts
made before it existed, and on a real site
(`erp_produksi`) Samuel's data, once (`PENANDA_DATA`): later updates never reload it, so edits made in the app stay.
The automatic path also runs it directly (`make lanjut`), so the terminal shows it; the queued run is then a no-op.
"""

from importlib import import_module

import frappe
from frappe.utils.synchronization import filelock

from erp_internal import setup
from erp_internal.tampilan import ADMIN, DEVELOPER, USER
from erp_internal.tests import utils

PENANDA_DATA = "erp_data_samuel"  # global default, set once Samuel's data is loaded
DEVELOPER_WIZARD = "erp_wizard_developer"  # global default: the wizard's own account, for a later lanjutkan
MUAT = ("master", "penjualan", "mesin_barang")  # in this order: each needs the one before


def selesai(args) -> None:
	"""setup_wizard_complete hook. A test site has its own wizard (`tests.utils.sebelum_tes`): left alone."""
	if frappe.conf.get("allow_tests"):
		return
	_selesai(args)


def _selesai(args) -> None:
	# Each step on its own: one failing must not keep the job from being queued.
	try:
		company = args.get("company_name")
		if company and frappe.db.exists("Company", company):
			frappe.db.set_value("Company", company, "erp_aktif", 1)
	except Exception:
		frappe.log_error("erp_internal: wizard.selesai")
	email = args.get("email") or frappe.session.user
	if email in ("Administrator", "Guest"):
		email = None
	try:
		if email:
			frappe.db.set_default(DEVELOPER_WIZARD, email)
	except Exception:
		frappe.log_error("erp_internal: wizard.selesai")
	try:
		frappe.enqueue(
			"erp_internal.wizard.lanjutkan",
			queue="long",
			enqueue_after_commit=True,
			job_id="erp_lanjutkan",
			deduplicate=True,
			cetak=False,
			developer=email,
		)
	except Exception:
		frappe.log_error("erp_internal: wizard.selesai")


def lanjutkan(cetak: bool = True, developer: str | None = None) -> list[str] | None:
	"""The slow part after the wizard; nothing before it. `developer`: the wizard's own account (default: the one
	the hook kept), made a Developer once setup has made that Role Profile. A file lock on the site keeps the queued
	job and `make lanjut` apart. Prints its lines from the terminal (`bench execute`). The caller commits: bench
	execute and the background job both do."""
	with filelock("erp_lanjutkan", timeout=3600):
		hasil = _lanjutkan(developer or frappe.db.get_default(DEVELOPER_WIZARD))
	if not cetak:
		return hasil
	print("\n".join(hasil))


def _lanjutkan(developer: str | None) -> list[str]:
	hasil = []
	if frappe.is_setup_complete():
		setup.pastikan_setup()
		hasil.append("setup done")
		if developer and frappe.db.exists("User", developer):
			utils.buat_pengguna(developer, DEVELOPER, None, None)
			hasil.append(f"{developer}: Developer")
		hasil += _akun_perusahaan()
		if frappe.conf.get("erp_produksi") and not frappe.db.get_default(PENANDA_DATA):
			for nama in MUAT:
				import_module(f"erp_internal.{nama}").muat()
				hasil.append(f"{nama} loaded")
			frappe.db.set_default(PENANDA_DATA, 1)
	else:
		hasil.append("setup wizard not done yet")
	return hasil


def _akun_perusahaan() -> list[str]:
	"""Admin and User accounts without a Company permission get the company (made before the wizard)."""
	company = (setup.perusahaan() or [None])[0]
	if not company:
		return []
	hasil = []
	for profil in (ADMIN, USER):
		pengguna = frappe.get_all(
			"User Role Profile", {"role_profile": profil, "parenttype": "User"}, pluck="parent", distinct=True
		)
		for email in pengguna:
			if not frappe.db.exists("User Permission", {"user": email, "allow": "Company"}):
				utils.buat_pengguna(email, profil, profil, company)
				hasil.append(f"{email}: company {company}")
	return hasil
