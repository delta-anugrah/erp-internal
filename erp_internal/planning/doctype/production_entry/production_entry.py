"""Production Entry: what one machine made in one shift for one Work Order, good and rejected.

Submit moves the stock through two Stock Entries, made by the system (Produksi holds no stock role) and marked
`FLAG_HASIL`; `cek_stock_entry` refuses any other Manufacture and any other way of cancelling them:
- good pieces: ERPNext's own Manufacture entry for the order (`make_stock_entry`), so the order's produced qty
  and status stay ERPNext's; the material for them is backflushed by the BOM;
- rejects: a Repack entry that takes the BOM's material for the rejected pieces from the order's source
  warehouse (Gudang Bahan Baku), never from work in progress, and puts the pieces, as the same item, into the
  company's Default Scrap Warehouse (Gudang Reject). Rejects are material used on top of what was transferred
  for the good pieces, so the transferred material stays whole for them. The entry is not linked to the order,
  so rejects never count toward it. Process loss is not used: ERPNext counts it toward the order's completed qty.
Cancel cancels both. Submit is all or nothing: a failing Repack undoes the Manufacture (savepoint).
"""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate, nowtime, today

from erp_internal.setup import jam_shift

STATUS_TERBUKA = ("Not Started", "In Process")  # Work Order statuses that take output
# Set on a Stock Entry's flags by Production Entry: its own Manufacture or Repack entry.
FLAG_HASIL = "erp_hasil_produksi"


class ProductionEntry(Document):
	def before_validate(self):
		order = frappe.db.get_value(
			"Work Order", self.work_order, ["company", "erp_mesin", "production_item"], as_dict=True
		)
		if order:
			self.company = self.company or order.company
			self.workstation = self.workstation or order.erp_mesin
			self.item = order.production_item
		self.reject_qty = sum(flt(r.qty) for r in self.rejects)
		if not flt(self.hours) and self.shift:
			self.hours = jam_shift(self.shift)

	def validate(self):
		if not self.work_order:
			return  # Frappe's mandatory check refuses it next
		self.cek_order()
		self.cek_mesin()
		self.cek_jumlah()
		if getdate(self.posting_date) > getdate(today()):
			frappe.throw(_("The date cannot be in the future."))
		if not 0 < flt(self.hours) <= 24:
			frappe.throw(_("Run hours must be more than 0 and at most 24."))

	def cek_order(self):
		order = frappe.db.get_value(
			"Work Order", self.work_order, ["docstatus", "status", "company"], as_dict=True
		)
		if not order:
			frappe.throw(_("Work Order {0} does not exist.").format(frappe.bold(self.work_order)))
		if order.docstatus != 1:
			frappe.throw(_("Submit Work Order {0} first.").format(frappe.bold(self.work_order)))
		if order.status not in STATUS_TERBUKA:
			frappe.throw(
				_("Work Order {0} takes no output: it is {1}.").format(
					frappe.bold(self.work_order), _(order.status)
				)
			)
		if order.company != self.company:
			frappe.throw(
				_("Work Order {0} belongs to {1}, not {2}.").format(
					frappe.bold(self.work_order), order.company, self.company
				)
			)

	def cek_mesin(self):
		if not frappe.db.get_value("Workstation", self.workstation, "erp_nomor"):
			frappe.throw(_("{0} is not a numbered machine.").format(frappe.bold(self.workstation)))
		mesin_order = frappe.db.get_value("Work Order", self.work_order, "erp_mesin")
		if mesin_order and mesin_order != self.workstation:
			frappe.throw(
				_("Work Order {0} runs on {1}. Change the Work Order's machine first.").format(
					frappe.bold(self.work_order), frappe.bold(mesin_order)
				)
			)

	def cek_jumlah(self):
		if flt(self.good_qty) < 0:
			frappe.throw(_("Good qty cannot be negative."))
		for r in self.rejects:
			if flt(r.qty) <= 0:
				frappe.throw(_("Row {0}: the reject qty must be more than 0.").format(r.idx))
			if frappe.db.get_value("Reject Reason", r.reason, "disabled"):
				frappe.throw(_("Row {0}: the reason {1} is disabled.").format(r.idx, frappe.bold(r.reason)))
		if flt(self.good_qty) + flt(self.reject_qty) <= 0:
			frappe.throw(_("Enter the good qty or at least one reject."))

	def on_submit(self):
		from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry

		# All or nothing even outside a web request (bench execute, a test): undo the Manufacture if the
		# Repack fails.
		frappe.db.savepoint("hasil_produksi_submit")
		# Only this method fills the two entry links (read only, not changeable after submit): one sent by the
		# client, even with a straight submit, is dropped first, or cancel would cancel someone else's Stock
		# Entry with permissions ignored.
		self.db_set({"manufacture_entry": None, "reject_entry": None})
		try:
			if flt(self.good_qty) > 0:
				se = frappe.get_doc(make_stock_entry(self.work_order, "Manufacture", flt(self.good_qty)))
				self.db_set("manufacture_entry", self._ajukan(se).name)
			if flt(self.reject_qty) > 0:
				self.db_set("reject_entry", self._ajukan(self._entri_reject()).name)
		except Exception:
			frappe.db.rollback(save_point="hasil_produksi_submit")
			raise

	def before_cancel(self):
		# ERPNext refuses any stock entry against a stopped order ("Transaction not allowed against stopped
		# Work Order"); say what to do instead.
		if frappe.db.get_value("Work Order", self.work_order, "status") == "Stopped":
			frappe.throw(_("Re-open Work Order {0} first.").format(frappe.bold(self.work_order)))

	def on_cancel(self):
		for nama in (self.reject_entry, self.manufacture_entry):
			if nama and frappe.db.get_value("Stock Entry", nama, "docstatus") == 1:
				se = frappe.get_doc("Stock Entry", nama)
				se.flags[FLAG_HASIL] = True  # cek_stock_entry: cancelled through this entry
				se.flags.ignore_permissions = True  # Produksi holds no stock role
				se.cancel()

	def _ajukan(self, se):
		"""Date the Stock Entry on this entry's date, then insert and submit it."""
		se.set_posting_time = 1
		se.posting_date = self.posting_date
		se.posting_time = nowtime()
		se.remarks = _("Production Entry {0}").format(self.name)
		se.flags[FLAG_HASIL] = True  # cek_stock_entry: output only through a Production Entry
		se.flags.ignore_permissions = True  # Produksi holds no stock role
		se.insert()
		se.submit()
		return se

	def _entri_reject(self):
		"""The Repack entry of the rejects: the BOM's material for `reject_qty` pieces out of the order's source
		warehouse, and the pieces into the Default Scrap Warehouse."""
		from erpnext.manufacturing.doctype.bom.bom import get_bom_items_as_dict

		wo = frappe.get_doc("Work Order", self.work_order)
		gudang_reject = frappe.get_cached_value("Company", self.company, "default_scrap_warehouse")
		if not gudang_reject:
			frappe.throw(_("Set the Default Scrap Warehouse of {0} first.").format(frappe.bold(self.company)))

		# Where a skip_transfer Manufacture takes material (StockEntry.get_bom_raw_materials): the order's row per
		# material, else the order's source warehouse, else the item default. Never the work-in-progress
		# warehouse, even when the order transfers: ERPNext counts that material as transferred for the good
		# pieces and caps transfers at the order qty, so taking rejects from it would leave the order short.
		sumber_order = {r.item_code: r.source_warehouse for r in wo.required_items}
		bahan = get_bom_items_as_dict(
			wo.bom_no, wo.company, qty=flt(self.reject_qty), fetch_exploded=wo.use_multi_level_bom
		)
		se = frappe.new_doc("Stock Entry")
		se.purpose = "Repack"
		se.company = self.company
		se.set_stock_entry_type()
		for b in bahan.values():
			se.append(
				"items",
				{
					"item_code": b.item_code,
					"qty": b.qty,
					"uom": b.stock_uom,
					"conversion_factor": 1,
					"s_warehouse": (
						sumber_order.get(b.item_code)
						or wo.source_warehouse
						or b.source_warehouse
						or b.default_warehouse
					),
				},
			)
		se.append(
			"items",
			{
				"item_code": wo.production_item,
				"qty": flt(self.reject_qty),
				"uom": wo.stock_uom,
				"conversion_factor": 1,
				"t_warehouse": gudang_reject,
				"is_finished_item": 1,
			},
		)
		return se


@frappe.whitelist()
def jam(shift: str) -> float:
	"""The default run hours of `shift`, for the form."""
	return jam_shift(shift)


def cek_stock_entry(doc, method=None) -> None:
	"""Stock Entry `validate` and `before_cancel`: output only through a Production Entry. A Manufacture that no
	Production Entry made is refused (the Work Order's Finish) unless the user has System Manager; a Production
	Entry's own entry is cancelled only by cancelling that entry."""
	if doc.flags.get(FLAG_HASIL):
		return
	if doc.docstatus == 2:  # before_cancel: Frappe sets docstatus before the event
		pe = frappe.get_all(
			"Production Entry",
			filters={"docstatus": 1},
			or_filters={"manufacture_entry": doc.name, "reject_entry": doc.name},
			pluck="name",
			limit=1,
		)
		if pe:
			frappe.throw(_("Cancel Production Entry {0} instead.").format(pe[0]))
	elif doc.purpose == "Manufacture" and "System Manager" not in frappe.get_roles():
		frappe.throw(_("Record output in Daily Input."))
