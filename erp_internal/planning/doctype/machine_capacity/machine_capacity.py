"""Machine Capacity: one row per product (or template, or template + Jenis) per machine."""

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from erp_internal.planning import kapasitas


class MachineCapacity(Document):
	def before_insert(self):
		if self.runner_reground is None:
			self.runner_reground = kapasitas.RUNNER_DIGILING

	def validate(self):
		self.jenis = (self.jenis or "").strip()
		self.cek_angka()
		self.cek_barang()
		self.cek_mesin()
		self.cek_bahan()
		self.cek_kembar()
		self.pcs_per_hour = 3600 / self.cycle_time * self.cavities
		self.material_per_pcs = flt(self.part_weight) + (
			0 if self.runner_reground else flt(self.runner_weight) / self.cavities
		)

	def cek_angka(self):
		if flt(self.cycle_time) <= 0:
			frappe.throw(_("Cycle time must be more than 0."))
		if (self.cavities or 0) < 1:
			frappe.throw(_("Cavities must be at least 1."))
		if flt(self.part_weight) <= 0:
			frappe.throw(_("Part weight must be more than 0."))
		if flt(self.runner_weight) < 0:
			frappe.throw(_("Runner weight cannot be negative."))
		if not 0 <= flt(self.masterbatch_percent) < 100:
			frappe.throw(_("Masterbatch % must be from 0 up to, but not including, 100."))

	def cek_barang(self):
		ada = frappe.db.get_value("Item", self.item, ["variant_of", "has_variants"], as_dict=True)
		if not self.jenis:
			return
		if ada.variant_of or not ada.has_variants:
			frappe.throw(_("Jenis can only be set on a template item, not on {0}.").format(self.item))
		if self.jenis not in kapasitas.jenis_template(self.item):
			frappe.throw(
				_("No variant of {0} has the Jenis {1}.").format(
					frappe.bold(self.item), frappe.bold(self.jenis)
				)
			)

	def cek_mesin(self):
		if not frappe.db.get_value("Workstation", self.workstation, "erp_nomor"):
			frappe.throw(_("{0} is not a numbered machine.").format(frappe.bold(self.workstation)))

	def cek_bahan(self):
		# BOM quantities are kilograms: a material counted in grams or pieces would be read 1000 times off.
		for kolom in ("material", "masterbatch"):
			kode = self.get(kolom)
			if not kode:
				continue
			is_stock, satuan = frappe.db.get_value("Item", kode, ["is_stock_item", "stock_uom"])
			if not is_stock or satuan != "Kg":
				frappe.throw(_("{0} must be a stock item counted in Kg.").format(frappe.bold(kode)))

	def cek_kembar(self):
		if frappe.db.exists(
			"Machine Capacity",
			{
				"item": self.item,
				"jenis": self.jenis,
				"workstation": self.workstation,
				"name": ("!=", self.name or ""),
			},
		):
			frappe.throw(
				_("{0} already has a capacity row on {1}.").format(
					frappe.bold(self.item), frappe.bold(self.workstation)
				),
				frappe.UniqueValidationError,
			)


def on_doctype_update():
	# The database refuses a duplicate even when two imports race past `validate`.
	frappe.db.add_unique(
		"Machine Capacity", ("item", "jenis", "workstation"), constraint_name="unik_kapasitas"
	)
