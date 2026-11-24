"""The Seal Cap line for PT. Empat Putra Pangestu (spec A6, Samuel 2026-11-24).

`muat` (called by `master.muat`) loads `data/seal_cap.json`: template `SEAL-CAP` with one variant per row (Merk x
Warna), the brands, the packing items and each variant's two Packing rows, a pigment per colour that needs one with
its buying price, the customer, and the Machine Capacity rows once the file has the weight per piece and the
material (`_kapasitas`). What exists is left as it is: Admin keeps it current after the first load.

The price per piece follows the machine (`HARGA_MESIN`): a Sales Order line of such an item names its machine
(`harga_mesin`), and a Work Order made from that line takes it (`mesin_dari_so`)."""

import frappe
from erpnext.controllers.item_variant import create_variant, get_variant
from frappe import _
from frappe.utils import flt

from erp_internal import master, penjualan, setup
from erp_internal.planning.kapasitas import ATRIBUT_WARNA, GRUP_KEMASAN, TEMPLATE_PIGMEN, buat_bom_kapasitas
from erp_internal.setup import SATUAN_KEMASAN

TEMPLATE = "SEAL-CAP"
ATRIBUT_MERK = "Merk"
# Template -> machine -> price per piece (stock UOM). "Nomor 4 210 ton = 24, Nomor 14 160 ton = 23".
HARGA_MESIN = {TEMPLATE: {"Mesin 04": 24, "Mesin 14": 23}}
RASIO_PIGMEN = 1  # g per kg (Samuel 2026-11-23)


def muat(hasil: master.Hasil) -> None:
	from erp_internal.kelengkapan import WARNA_TANPA_PIGMEN

	data = master.berkas("seal_cap.json")
	baris = data["baris"]
	nilai = [{ATRIBUT_MERK: b["merk"], ATRIBUT_WARNA: b["warna"]} for b in baris]
	master._atribut([{"varian": [{"nilai": n} for n in nilai]}], hasil)
	hasil.simpan(
		"Item",
		TEMPLATE,
		{},
		{
			"item_code": TEMPLATE,
			"item_name": "Seal Cap",
			"item_group": master.GRUP,
			"description": f"Seal Cap. {data['pelanggan']}.",
			"stock_uom": "Pcs",
			"is_stock_item": 1,
			"has_variants": 1,
			"variant_based_on": "Item Attribute",
			"attributes": [{"attribute": ATRIBUT_MERK}, {"attribute": ATRIBUT_WARNA}],
		},
	)
	for kemasan in sorted({b["plastik"] for b in baris} | {data["karung"]}):
		hasil.simpan(
			"Item",
			kemasan,
			{},
			{
				"item_code": kemasan,
				"item_group": GRUP_KEMASAN,
				"stock_uom": SATUAN_KEMASAN,
				"is_stock_item": 1,
			},
		)
	for b, n in zip(baris, nilai, strict=True):
		hasil.simpan("Brand", b["merk"], {"brand": b["merk"]})
		if get_variant(TEMPLATE, n):
			continue
		doc = create_variant(TEMPLATE, n)
		doc.item_name = master.nama_varian("Seal Cap", n)
		doc.brand = b["merk"]
		doc.set(
			"erp_kemasan",
			[
				{"packing_item": b["plastik"], "pieces": b["isi_plastik"]},
				{"packing_item": data["karung"], "pieces": b["per_karung"]},
			],
		)
		doc.insert(ignore_permissions=True)
		hasil.ditulis += 1

	penjualan.daftar_beli(hasil)
	penjualan._pigmen(hasil)
	for warna in sorted({b["warna"] for b in baris} - set(WARNA_TANPA_PIGMEN)):
		if not get_variant(TEMPLATE_PIGMEN, {ATRIBUT_WARNA: warna}):
			doc = create_variant(TEMPLATE_PIGMEN, {ATRIBUT_WARNA: warna})
			doc.erp_rasio_pigmen = RASIO_PIGMEN
			doc.insert(ignore_permissions=True)
			hasil.ditulis += 1
	# Every pigment's price per Kg, only where none is set: a price Admin changed stays.
	for pg in frappe.get_all("Item", {"variant_of": TEMPLATE_PIGMEN}, pluck="name"):
		if not frappe.db.exists("Item Price", {"item_code": pg, "price_list": penjualan.HARGA_BAHAN}):
			frappe.get_doc(
				{
					"doctype": "Item Price",
					"item_code": pg,
					"price_list": penjualan.HARGA_BAHAN,
					"uom": "Kg",
					"price_list_rate": data["harga_pigmen_kg"],
				}
			).insert(ignore_permissions=True)
			hasil.ditulis += 1

	if not frappe.db.exists("Customer", data["pelanggan"]):
		frappe.get_doc(
			{"doctype": "Customer", "customer_name": data["pelanggan"], "customer_type": "Company"}
		).insert(ignore_permissions=True)
		hasil.ditulis += 1
	_kapasitas(data["kapasitas"], hasil)


def _kapasitas(k: dict, hasil: master.Hasil) -> None:
	"""One Machine Capacity row per machine (and its BOMs), only once the weight per piece and the material are
	in the file; an existing row is left as Admin keeps it."""
	kurang = [f for f in ("part_weight", "material") if not k.get(f)]
	if kurang:
		hasil.catat(f"{TEMPLATE}: no Machine Capacity yet ({', '.join(kurang)} missing in seal_cap.json)")
		return
	perusahaan = setup.perusahaan()
	for mesin in k["machines"]:
		kunci = {"item": TEMPLATE, "jenis": "", "workstation": mesin}
		if frappe.db.exists("Machine Capacity", kunci):
			continue
		nama = hasil.simpan(
			"Machine Capacity",
			kunci,
			{f: k[f] for f in ("cycle_time", "cavities", "part_weight", "runner_weight", "material")},
			kunci,
		)
		if perusahaan:
			bom = buat_bom_kapasitas(nama, perusahaan[0])
			hasil.ditulis += len(bom["dibuat"])


def _tabel(item_code: str) -> dict | None:
	return HARGA_MESIN.get(frappe.db.get_value("Item", item_code, "variant_of") or item_code)


@frappe.whitelist()
def harga(item_code: str, mesin: str) -> float | None:
	"""The price per piece of `item_code` on `mesin`, or None (the Sales Order form sets it on the line)."""
	return (_tabel(item_code) or {}).get(mesin)


def harga_mesin(doc, method=None) -> None:
	"""Sales Order `before_validate`: a line of a `HARGA_MESIN` template names its machine and takes its price
	(ERPNext's totals follow in validate)."""
	for d in doc.items:
		tabel = _tabel(d.item_code)
		if not tabel:
			continue
		barang = d.item_name or d.item_code
		if not d.erp_mesin:
			frappe.throw(_("{0}: pick the machine, the price follows it.").format(barang))
		if d.erp_mesin not in tabel:
			frappe.throw(
				_("{0} has no price on {1}. Machines: {2}").format(barang, d.erp_mesin, ", ".join(tabel))
			)
		d.rate = d.price_list_rate = tabel[d.erp_mesin] * flt(d.conversion_factor or 1)
		d.discount_percentage = d.discount_amount = 0


def mesin_dari_so(doc, method=None) -> None:
	"""Work Order `before_validate` (before `kapasitas.pilih_bom`): a draft made from a Sales Order line takes
	that line's machine when it has none."""
	if doc.docstatus == 0 and not doc.erp_mesin and doc.sales_order_item:
		doc.erp_mesin = frappe.db.get_value("Sales Order Item", doc.sales_order_item, "erp_mesin")
