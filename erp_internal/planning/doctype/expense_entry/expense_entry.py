"""Expense Entry: one factory expense, paid once, every month, or per machine shift (spec section 5).

A repeating entry runs from its date to Until (empty: still running); Until may be set after submit, so a raise
ends the old entry and a new one starts, and past months keep their rate. Two Per machine shift entries of one
category may not overlap: the report would pay each shift twice. The Monthly Expenses report adds them up.
"""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate

PER_SHIFT = "Per machine shift"


class ExpenseEntry(Document):
	def validate(self):
		self.cek_sampai()

	def before_submit(self):
		self.cek_tumpang_tindih()

	def before_update_after_submit(self):
		self.cek_sampai()
		self.cek_tumpang_tindih()

	def cek_sampai(self):
		if self.repeat == "Once":
			self.until = None
		elif self.until and getdate(self.until) < getdate(self.posting_date):
			frappe.throw(_("Until cannot be before the date."))

	def cek_tumpang_tindih(self):
		"""Refuse when another submitted Per machine shift entry of the category runs in the same days."""
		if self.repeat != PER_SHIFT:
			return
		lain = frappe.get_all(
			"Expense Entry",
			filters={
				"docstatus": 1,
				"repeat": PER_SHIFT,
				"category": self.category,
				"company": self.company,
				"name": ("!=", self.name),
			},
			fields=["name", "posting_date", "until"],
		)
		mulai, sampai = getdate(self.posting_date), self.until and getdate(self.until)
		for e in lain:
			if (not e.until or mulai <= getdate(e.until)) and (
				not sampai or getdate(e.posting_date) <= sampai
			):
				frappe.throw(_("End the earlier one first: {0}.").format(frappe.bold(e.name)))
