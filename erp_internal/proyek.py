"""Guards for the office's project flow.

`setup.IZIN_TAMBAHAN` lets the Employee role submit Timesheets, and stock ERPNext already gives that role create,
read and write on every Timesheet (not owner-scoped). So a User may only submit a timesheet booked to
their own Employee record (security review 2026-10-28).
"""

import frappe
from frappe import _

from erp_internal.tampilan import PERAN_ADMIN

# Roles that may submit a timesheet for someone else: the Admin and Super Admin profiles' (a Produksi user holds Projects
# User, so that role no longer counts).
PERAN_ATASAN = {"System Manager", PERAN_ADMIN, "Projects Manager", "HR Manager", "HR User"}


def cek_pemilik_timesheet(doc, method=None):
	"""Timesheet before_submit: a user without PERAN_ATASAN submits only their own timesheet."""
	if frappe.session.user == "Administrator" or PERAN_ATASAN & set(frappe.get_roles()):
		return
	sendiri = frappe.db.get_value("Employee", {"user_id": frappe.session.user, "status": "Active"}, "name")
	if not sendiri or doc.employee != sendiri:
		frappe.throw(_("You can only submit your own timesheet."), frappe.PermissionError)
