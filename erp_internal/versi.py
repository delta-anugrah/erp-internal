"""The app version people see: under the login card, and at the foot of the Settings dialog's left menu.

`erp_internal.__version__` is the release number: the image workflow refuses a tag that is not `v` + it. Desk reads
it from Frappe's own `frappe.boot.versions` (public/js/versi.js), so only the login page needs this module.
"""

import json

import erp_internal


def versi() -> str:
	"""`v0.1.3`, the way a release tag is written."""
	return f"v{erp_internal.__version__}"


def di_login(context) -> dict | None:
	"""update_website_context: on /login a small script puts the version under each login card (sign in, the
	email sign in, sign up, forgot password: one shows at a time). Frappe's login.html has no block for it."""
	if context.get("path") != "login":
		return None
	skrip = (
		"<script>document.querySelectorAll('.login-content').forEach(function (kartu) {"
		"var p = document.createElement('p');"
		"p.className = 'erp-versi text-p-sm text-ink-gray-5 text-center mb-0';"
		f"p.textContent = {json.dumps(versi())};"
		"kartu.appendChild(p);});</script>"
	)
	return {"body_include": (context.get("body_include") or "") + skrip}
