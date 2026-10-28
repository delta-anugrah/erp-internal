"""Guards for the office's project flow.

`setup.IZIN_TAMBAHAN` lets the Employee role submit Timesheets, and stock ERPNext already gives that role create,
read and write on every Timesheet (not owner-scoped). So a plain employee may only submit a timesheet booked to
their own Employee record (security review 2026-10-28).
"""

import frappe
from frappe import _

# Roles that may submit a timesheet for someone else.
PERAN_ATASAN = {"System Manager", "Projects Manager", "Projects User", "HR Manager", "HR User"}


def cek_pemilik_timesheet(doc, method=None):
	"""Timesheet before_submit: a user without PERAN_ATASAN submits only their own timesheet."""
	if frappe.session.user == "Administrator" or PERAN_ATASAN & set(frappe.get_roles()):
		return
	sendiri = frappe.db.get_value("Employee", {"user_id": frappe.session.user, "status": "Active"}, "name")
	if not sendiri or doc.employee != sendiri:
		frappe.throw(_("You can only submit your own timesheet."), frappe.PermissionError)
