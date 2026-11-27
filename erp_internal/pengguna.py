"""What an Admin may do to user accounts (Samuel's three roles, 2026-10-28).

The Admin profile manages users through `setup.IZIN_TAMBAHAN` (User create, read and write, roles on permlevel 1),
but must never hand out more than it holds: no System Manager, no Super Admin, no role outside the Admin and Produksi
profiles (`tampilan.PERAN_BOLEH_ADMIN`), not even to itself. Nor may it touch an account that holds such a role
(a Super Admin, Administrator): no edit, rename, password change or disable. The apps' own syncs of such an
account (an Employee's name, an approver role) still pass. Administrator and System Manager
holders are not limited. Every path is checked on the server:

- User `before_validate` and `validate` (the form, `frappe.client.save`/`set_value`, `change_password`, bulk
  edit): `cek_user_awal`, `cek_user`;
- Has Role `before_insert`/`validate` (a role row written on its own): `cek_peran`;
- User `has_permission` for any change, which also covers rename: `boleh_ubah`.
"""

import frappe
from frappe import _
from frappe.permissions import ADMIN_ROLE, AUTOMATIC_ROLES

from erp_internal.tampilan import PERAN_BOLEH_ADMIN

# Guest, All and Desk User need no grant. Administrator is in Frappe's AUTOMATIC_ROLES too, so it is taken out.
OTOMATIS = set(AUTOMATIC_ROLES) - {ADMIN_ROLE}


def bebas(user: str | None = None) -> bool:
	"""Whether `user` (default the session user) is not limited: Administrator or a System Manager."""
	user = user or frappe.session.user
	return user == "Administrator" or "System Manager" in frappe.get_roles(user)


def terlarang(peran) -> set[str]:
	"""The roles of `peran` an Admin may not hand out."""
	return set(peran) - PERAN_BOLEH_ADMIN - OTOMATIS


def dilindungi(user: str) -> bool:
	"""Whether the stored account `user` is out of an Admin's reach: a standard user, or one holding a role
	outside the Admin and Produksi profiles."""
	if user in frappe.STANDARD_USERS:
		return True
	return bool(terlarang(frappe.get_all("Has Role", {"parenttype": "User", "parent": user}, pluck="role")))


# User fields that control access. On a protected account a limited user may change none of them; anything
# else may still be written by the apps' own syncs (ERPNext copies an Employee's name and photo to its User,
# HRMS adds Leave Approver), which save the User with ignore_permissions under the HR user's session.
FIELD_AKSES = (
	"enabled",
	"email",
	"user_type",
	"module_profile",
	"api_key",
	"api_secret",
	"restrict_ip",
	"login_after",
	"login_before",
)


def _tolak_akun() -> None:
	frappe.throw(_("Only a Super Admin can change this account."), frappe.PermissionError)


def cek_user_awal(doc, method=None) -> None:
	"""User before_validate: a new User under a protected account's name is refused before the controller's
	validate acts on it (with `enabled` 0 that would log the account out before the duplicate is refused)."""
	if doc.is_new() and not bebas() and frappe.db.exists("User", doc.name) and dilindungi(doc.name):
		_tolak_akun()


def cek_user(doc, method=None) -> None:
	"""User validate: an Admin keeps every role it adds inside PERAN_BOLEH_ADMIN and changes nothing that
	controls a protected account's access. Runs after the controller's validate, so `doc.roles` already holds
	the Role Profiles' roles."""
	if bebas():
		return
	sebelum = None if doc.is_new() else doc.get_doc_before_save()
	lama = {r.role for r in sebelum.roles} if sebelum else set()
	kini = {r.role for r in doc.roles}
	tambah = terlarang(kini - lama)
	if tambah:
		frappe.throw(
			_("You cannot give these roles: {0}").format(", ".join(sorted(tambah))), frappe.PermissionError
		)
	if sebelum and dilindungi(doc.name):
		profil = [r.role_profile for r in doc.role_profiles]
		if (
			lama - kini
			or any(doc.get(f) != sebelum.get(f) for f in FIELD_AKSES)
			or profil != [r.role_profile for r in sebelum.role_profiles]
			or getattr(doc, "_User__new_password", None)  # User.validate moves new_password here
		):
			_tolak_akun()


def cek_peran(doc, method=None) -> None:
	"""Has Role before_insert/validate: a role row added to a User on its own follows the same limits."""
	if doc.parenttype != "User" or bebas():
		return
	if terlarang([doc.role]) or (doc.parent and dilindungi(doc.parent)):
		frappe.throw(_("You cannot give these roles: {0}").format(doc.role), frappe.PermissionError)


UBAH = ("write", "create", "delete", "share", "rename")  # the rights boleh_ubah withholds


def boleh_ubah(doc, ptype=None, user=None, debug=False) -> bool:
	"""User has_permission: a limited user may not change a protected account (reading stays). Frappe's own
	hook already keeps Administrator and Guest from everyone else. Must return True to allow."""
	if ptype not in UBAH or not frappe.db.exists("User", doc.name) or bebas(user):
		return True
	return not dilindungi(doc.name)
