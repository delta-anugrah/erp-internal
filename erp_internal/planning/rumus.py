"""Pure math for the forecast fill and Order Readiness: no database, no request state.

Forecast (design §8 item 7): per item, the average of the last `BULAN_RIWAYAT` full calendar months before
the current month, or before the forecast's start month when that is earlier. A month without sales
counts as 0, and the average is rounded up to whole units.
"""

from datetime import date
from math import ceil

from frappe.utils import add_months, get_first_day, getdate

BULAN_RIWAYAT = 3


def bulan_acuan(hari_ini: date, dari: date, jumlah: int = BULAN_RIWAYAT) -> list[date]:
	"""`jumlah` first-of-month dates, oldest first, ending with the month before the earlier of the month
	of `hari_ini` and the month of `dari`."""
	akhir = min(get_first_day(hari_ini), get_first_day(dari))
	return [getdate(add_months(akhir, -k)) for k in range(jumlah, 0, -1)]


def rata_rata(per_bulan: dict[date, float], bulan: list[date]) -> float:
	"""The mean over `bulan`; a month missing from `per_bulan` counts as 0."""
	if not bulan:
		return 0.0
	return sum(float(per_bulan.get(b) or 0) for b in bulan) / len(bulan)


def bulatkan(qty: float) -> int:
	"""Round up to whole units, never below 0. Rounding to 6 places first keeps float noise
	(233.0000000001) from adding a unit."""
	return max(0, ceil(round(qty, 6)))


def ada_riwayat(per_bulan: dict[date, float], bulan: list[date]) -> bool:
	"""Whether any month in `bulan` sold more than 0."""
	return any(float(per_bulan.get(b) or 0) > 0 for b in bulan)
