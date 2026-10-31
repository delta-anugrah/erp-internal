"""Pure math for the forecast fill and Order Readiness: no database, no request state.

Forecast (design §8 item 7): per item, the average of the last `BULAN_RIWAYAT` full calendar months before
the current month, or before the forecast's start month when that is earlier. A month without sales
counts as 0, and the average is rounded up to whole units.
"""

from datetime import date, timedelta
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


# ---------------------------------------------------------------------------------------------------------
# Order Readiness (design §10): what is short this month and when production must start.

# The statuses, most urgent first; also the report's sort order. English source; the report's JS shows
# the Indonesian (id.csv, context "Order Readiness").
STATUS = ("Late", "Start this week", "Set lead time", "Scheduled", "OK")
MINGGU = 7  # "Start this week": the start date is at most this many days after today


def hitung_kurang(
	stok: float, terbuka: float, perkiraan: float, dipesan: float, produksi: float, safety: float
) -> int:
	"""Units still to make: `butuh` = open orders + the forecast not yet ordered + safety stock, less stock
	and what is in production, rounded up, never below 0."""
	butuh = terbuka + max(0.0, perkiraan - dipesan) + safety
	return max(0, ceil(round(butuh - stok - produksi, 6)))


def hitung_jadwal(
	kurang: int,
	lama: float | None,
	terbuka: float,
	terdekat: date | None,
	stok: float,
	produksi: float,
	awal: date,
	hari_ini: date,
) -> dict:
	"""`{"tanggal_butuh", "mulai", "status"}` for one product.

	Nothing short is OK; no lead time is "Set lead time", with no dates invented (Review Focus 4). Otherwise
	the need date is the earliest open delivery when open orders exceed stock plus production, else the
	month start (or today once it has begun), and production starts `ceil(lama)` days before it."""
	if not kurang:
		return {"tanggal_butuh": None, "mulai": None, "status": "OK"}
	if lama is None:
		return {"tanggal_butuh": None, "mulai": None, "status": "Set lead time"}

	if terdekat and terbuka > stok + produksi:
		butuh = getdate(terdekat)
	else:
		butuh = max(getdate(awal), getdate(hari_ini))
	mulai = butuh - timedelta(days=ceil(round(lama, 6)))
	if mulai < hari_ini:
		status = "Late"
	elif mulai <= hari_ini + timedelta(days=MINGGU):
		status = "Start this week"
	else:
		status = "Scheduled"
	return {"tanggal_butuh": butuh, "mulai": mulai, "status": status}
