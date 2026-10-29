"""Machine capacity: the lookup of the row that says how fast a machine makes a product.

The lookup is the only way the report and the BOM step find a row (Machine Capacity, spec section 1).
"""

import frappe

# A new capacity row's `runner_reground` when the field was not given (import, API). Open question to Samuel:
# is the runner reground and reused (1) or thrown away (0)? A new form asks `runner_digiling()` for it.
RUNNER_DIGILING = 0

ATRIBUT_JENIS = "Jenis"


@frappe.whitelist()
def runner_digiling() -> int:
	"""The default of a new row's `runner_reground`, for the form (it would send 0 for an untouched Check)."""
	return RUNNER_DIGILING


def jenis_varian(item: str) -> str | None:
	"""The variant's value of the `Jenis` attribute, or None (a template, a plain item, no such attribute)."""
	return frappe.db.get_value(
		"Item Variant Attribute", {"parent": item, "attribute": ATRIBUT_JENIS}, "attribute_value"
	)


def jenis_template(template: str) -> list[str]:
	"""The `Jenis` values that the variants of `template` use."""
	return frappe.get_all(
		"Item Variant Attribute",
		filters={
			"attribute": ATRIBUT_JENIS,
			"parent": ("in", frappe.get_all("Item", {"variant_of": template}, pluck="name")),
		},
		pluck="attribute_value",
		distinct=True,
	)


def kapasitas(item: str, workstation: str) -> frappe._dict | None:
	"""The enabled capacity row of `item` on `workstation`: the variant's own row, else its template's row for
	the variant's Jenis, else its template's row with no Jenis, else None."""
	template = frappe.db.get_value("Item", item, "variant_of")
	kandidat = [(item, "")]
	if template:
		kandidat += [(template, jenis_varian(item) or ""), (template, "")]
	for kode, jenis in kandidat:
		if jenis is None:
			continue
		if row := frappe.db.get_value(
			"Machine Capacity",
			{"item": kode, "jenis": jenis or ("in", ("", None)), "workstation": workstation, "disabled": 0},
			"*",
			as_dict=True,
		):
			return row
	return None
