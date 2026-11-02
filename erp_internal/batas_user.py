"""What the User profile may change (Samuel, 2026-11-02): only the three daily jobs, everything else read only.

- Production Entry (daily output), through PERAN_USER's rights on it;
- Delivery Note, made directly (Selling and Buying are not used for now), through Stock User;
- Stock Entry, but only a Material Receipt (raw material in, no Purchase Order): `cek_stock_entry`. The
  Manufacture and Repack entries a Production Entry makes as the same user carry `FLAG_HASIL` and pass.

Stock User may create more (Material Request, Purchase Receipt, Pick List and others in `HANYA_ADMIN`); the
`has_permission` hook `boleh_ubah` leaves those to Admin. Work Orders, BOMs, items and customers are read only
for Stock User already.
"""

import frappe
from frappe import _

from erp_internal.tampilan import PERAN_ADMIN, PERAN_USER

# The Stock Entry purposes a User makes by hand.
TUJUAN_USER = ("Material Receipt",)
# Set on a Stock Entry's flags by Production Entry: its own Manufacture or Repack entry.
FLAG_HASIL = "erp_hasil_produksi"
# DocTypes Stock User may create in v16 that a User leaves to Admin (read stays). Serial and Batch Bundle and
# Stock Reservation Entry are left out: stock entries and delivery notes write them on the way.
HANYA_ADMIN = (
	"Material Request",
	"Purchase Receipt",
	"Pick List",
	"Packing Slip",
	"Delivery Trip",
	"Stock Closing Entry",
	"Master Production Schedule",
	"Item Alternative",
	"Item Manufacturer",
	"Quality Inspection Parameter",
	"Quality Inspection Parameter Group",
	"Quality Inspection Template",
	"Subcontracting Receipt",
	"Location",
)
UBAH = ("create", "write", "submit", "cancel", "amend", "delete")


def terbatas(user: str | None = None) -> bool:
	"""Whether `user` (default the session user) is held to the User profile's three jobs."""
	peran = frappe.get_roles(user)
	return PERAN_USER in peran and PERAN_ADMIN not in peran and "System Manager" not in peran


def boleh_ubah(doc=None, ptype=None, user=None, debug=False) -> bool:
	"""`has_permission` hook of HANYA_ADMIN: a User reads them, never changes them."""
	return ptype not in UBAH or not terbatas(user)


def cek_stock_entry(doc, method=None) -> None:
	"""Stock Entry `validate` and `before_cancel`: a User makes and cancels only a Material Receipt."""
	if doc.purpose in TUJUAN_USER or doc.flags.get(FLAG_HASIL) or not terbatas():
		return
	frappe.throw(
		_("You may only record a Material Receipt. Ask an Admin for a {0}.").format(_(doc.purpose)),
		frappe.PermissionError,
	)
