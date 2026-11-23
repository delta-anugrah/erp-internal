"""Delivery Note: every line ships from the warehouse the note names (Samuel 2026-11-23)."""


def ikut_gudang(doc, method=None) -> None:
	"""Delivery Note `validate`: each line's warehouse follows the note's `set_warehouse` once it is set."""
	if doc.set_warehouse:
		for baris in doc.items:
			baris.warehouse = doc.set_warehouse
