"""The language switch: each user picks English (the default) or Indonesian for themselves."""

import frappe
from frappe import _

BAHASA = ("en", "id")


@frappe.whitelist()
def ganti(lang: str) -> None:
	"""Set the caller's own `User.language` to `en` or `id`, then clear that user's cache."""
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(_("Sign in to change the language."), frappe.PermissionError)
	if lang not in BAHASA:
		frappe.throw(_("Choose English or Indonesian."), frappe.ValidationError)
	if frappe.db.get_value("User", user, "language") != lang:
		frappe.db.set_value("User", user, "language", lang)
	frappe.clear_cache(user=user)
