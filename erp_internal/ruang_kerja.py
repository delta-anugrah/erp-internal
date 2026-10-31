"""Workspace saves keep our Apps tiles: the same methods as Frappe's, with our boot layers on their reply.

Frappe's workspace writes (new private page, Manage Workspaces settings, delete, move, restore) answer with
`workspace_payload()`, a fresh `app_data` the desk swaps into `frappe.boot.app_data` (workspace.js
`apply_manager_changes`). That copy skips `extend_bootinfo`, so the tiles got their app names and logos back,
and hidden tiles came back, until the next reload. `hooks.override_whitelisted_methods` routes each method
here (one entry per function below): Frappe's own function runs unchanged, then `saring_aplikasi` and
`merek_aplikasi` run on the reply.
"""

import frappe
from frappe.desk.doctype.workspace import workspace as _ws
from frappe.desk.page.workspace_restore import workspace_restore as _pulih

from erp_internal.tampilan import merek_aplikasi, saring_aplikasi


def rapikan(balasan):
	"""Our tile layers on a workspace reply that carries `app_data`. Never fails the save."""
	if not isinstance(balasan, dict) or "app_data" not in balasan:
		return balasan
	try:
		from frappe.desk.doctype.dock.dock import resolve_dock

		boot = frappe._dict(
			app_data=balasan["app_data"],
			module_sidebars=balasan.get("module_sidebars") or {},
			dock=resolve_dock(),
		)
		saring_aplikasi(boot)
		merek_aplikasi(boot)
	except Exception:
		frappe.log_error("erp_internal: ruang_kerja.rapikan")
	return balasan


@frappe.whitelist()
def new_page(new_page: dict | str):
	return rapikan(_ws.new_page(new_page))


@frappe.whitelist()
def update_workspace_settings(
	name: str,
	title: str | None = None,
	icon: str | None = None,
	indicator_color: str | None = None,
	access: str | None = None,
	roles: list | str | None = None,
	module: str | None = None,
):
	return rapikan(
		_ws.update_workspace_settings(
			name,
			title=title,
			icon=icon,
			indicator_color=indicator_color,
			access=access,
			roles=roles,
			module=module,
		)
	)


@frappe.whitelist()
def delete_page(name: str):
	return rapikan(_ws.delete_page(name))


@frappe.whitelist()
def set_workspace_module(name: str, module: str):
	return rapikan(_ws.set_workspace_module(name, module))


@frappe.whitelist(methods=["POST"])
def restore_workspace_edits(workspace: str) -> dict:
	return rapikan(_pulih.restore_workspace_edits(workspace))
