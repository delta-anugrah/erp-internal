"""No outgoing email yet (Resend postponed, Abel 2026-11-27): what needs one is hidden until an account is set.

`ada_email()` is the one check: an enabled Default Outgoing Email Account, or the site config's `mail_server`
(Frappe sends through either). While there is none:

- `boot` (extend_bootinfo) sends `frappe.boot.erp_tanpa_email`; `public/js/surel.js` hides the form's Email menu
  item and the Activity's New Email (`frappe.model.can_email`) and the print view's Email; `public/js/user.js`
  (doctype_js User) drops Password > Reset Password and Create User Email and hides Send Welcome Email;
- `di_login` (update_website_context) swaps the login page's "Forgot password?" for a line saying to ask an Admin
  and drops "Login with Email Link";
- `user_baru` (User before_insert) turns Send Welcome Email off, so no mail waits in the queue.

Passwords are then set in the app: the New User dialog's Set New Password, and Password > Change Password (Admin
and Super Admin; `pengguna.py` keeps an Admin off Super Admin and Administrator accounts). Setting up an Email
Account brings everything back on the next page load, with no code change.
"""

import json

import frappe
from frappe import _


def ada_email() -> bool:
	"""Whether Frappe can send email: an enabled Default Outgoing Email Account, or `mail_server` in site config."""
	if frappe.conf.get("mail_server"):
		return True
	return bool(frappe.db.exists("Email Account", {"enable_outgoing": 1, "default_outgoing": 1}))


def boot(bootinfo) -> None:
	bootinfo.erp_tanpa_email = not ada_email()


def di_login(context) -> dict | None:
	"""update_website_context: on /login without email, "Forgot password?" becomes a plain line."""
	if context.get("path") != "login" or ada_email():
		return None
	pesan = json.dumps(_("Forgot password? Ask an Admin to change your password."))
	skrip = (
		"<script>document.querySelectorAll('a[href=\"#forgot\"]').forEach(function (a) {"
		"var p = document.createElement('span');"
		"p.className = 'erp-tanpa-email text-base text-ink-gray-5';"
		f"p.textContent = {pesan};"
		"a.replaceWith(p);});"
		"document.querySelectorAll('a[href=\"#login-with-email-link\"]').forEach(function (a) { a.remove(); });"
		"if (/^#(forgot|login-with-email-link)$/.test(location.hash)) location.hash = '#login';</script>"
	)
	return {"body_include": (context.get("body_include") or "") + skrip}


def user_baru(doc, method=None) -> None:
	"""User before_insert: no welcome mail while there is no email (it would only fail in the queue)."""
	if not ada_email():
		doc.send_welcome_email = 0
