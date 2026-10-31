"""Sales History: the quantity of one item sold by one company in one month, imported from past records.

History is not imported as Sales Orders: those would show as open orders and stock demand. Exactly one row
per (company, item, month), so importing the same file twice cannot double the forecast (Review Focus 1).
"""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, get_first_day, getdate


class SalesHistory(Document):
	def validate(self):
		self.bulan = get_first_day(self.bulan)
		self.title = judul(self.item_code, self.bulan)
		if flt(self.qty) < 0:
			frappe.throw(_("Qty cannot be negative."))
		if not frappe.db.get_value("Item", self.item_code, "is_stock_item"):
			frappe.throw(_("Item {0} is not a stock item.").format(frappe.bold(self.item_code)))
		if frappe.db.exists(
			"Sales History",
			{
				"company": self.company,
				"item_code": self.item_code,
				"bulan": self.bulan,
				"name": ("!=", self.name or ""),
			},
		):
			frappe.throw(
				_("Sales history for {0} in {1} already exists.").format(
					frappe.bold(self.item_code), getdate(self.bulan).strftime("%m-%Y")
				),
				frappe.UniqueValidationError,
			)


def judul(item_code: str, bulan) -> str:
	"""The row's title, shown instead of its hash name: "CTH-KURSI · 09-2026"."""
	return f"{item_code} · {getdate(bulan).strftime('%m-%Y')}"


def on_doctype_update():
	# The database refuses a duplicate even when two imports race past `validate`.
	frappe.db.add_unique("Sales History", ("company", "item_code", "bulan"), constraint_name="unik_riwayat")
