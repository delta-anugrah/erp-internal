"""The production chain on stock ERPNext: forecast filled from history → MPS → MRP → Work Order → stock."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_months, get_first_day, getdate, today

from erp_internal.planning.forecast import isi
from erp_internal.setup import gudang
from erp_internal.tests.utils import (
	akar_gudang,
	buat_barang,
	buat_bom,
	buat_perkiraan,
	buat_perusahaan,
	lama_produksi,
	riwayat,
	stok_awal,
	tahun_fiskal,
)

JADI, PP, KEMASAN = "_UJI-PRD-EMBER", "_UJI-PRD-BIJI-PP", "_UJI-PRD-KEMASAN"


def m(k: int):
	return getdate(get_first_day(add_months(getdate(today()), -k)))


def stok(kode: str, wh: str) -> float:
	return frappe.db.get_value("Bin", {"item_code": kode, "warehouse": wh}, "actual_qty") or 0


class TestAlurProduksi(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		for k in (3, 2, 1, 0, -1):
			tahun_fiskal(m(k))
		cls.pabrik = buat_perusahaan("_Uji Pabrik", "_UP")

	def test_bawaan_produksi(self):
		self.assertEqual(
			frappe.db.get_value(
				"Company",
				self.pabrik,
				["default_wip_warehouse", "default_fg_warehouse", "default_scrap_warehouse"],
			),
			(
				gudang(self.pabrik, "Gudang Produksi"),
				gudang(self.pabrik, "Gudang Barang Jadi"),
				gudang(self.pabrik, "Gudang Reject"),
			),
		)
		self.assertEqual(
			frappe.db.get_single_value("Manufacturing Settings", "backflush_raw_materials_based_on"), "BOM"
		)
		self.assertEqual(
			frappe.db.get_value(
				"Item Default",
				{"parent": "Kemasan", "parenttype": "Item Group", "company": self.pabrik},
				"default_warehouse",
			),
			gudang(self.pabrik, "Gudang Bahan Baku"),
		)

	def test_forecast_sampai_barang_jadi(self):
		from erpnext.manufacturing.doctype.sales_forecast.sales_forecast import create_mps
		from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry
		from erpnext.manufacturing.report.material_requirements_planning_report.material_requirements_planning_report import (
			execute,
		)

		# 1. Fixtures: the bucket, its BOM and lead time, three months of history, enough raw material.
		buat_barang(JADI, "Barang Jadi")
		buat_barang(PP, "Bahan Baku", satuan="Kg")
		buat_barang(KEMASAN, "Kemasan")
		bom = buat_bom(JADI, {PP: 0.25, KEMASAN: 1}, company=self.pabrik)
		lama_produksi(JADI, 500, cadangan=1)
		for k in (3, 2, 1):
			riwayat(self.pabrik, JADI, m(k), 3000)
		bahan_baku = gudang(self.pabrik, "Gudang Bahan Baku")
		stok_awal(self.pabrik, PP, 750, "Gudang Bahan Baku")
		stok_awal(self.pabrik, KEMASAN, 3000, "Gudang Bahan Baku")

		# 2. Next month's forecast, filled from history, then submitted.
		sf = buat_perkiraan(self.pabrik, [JADI], m(-1), 1)
		isi(sf, getdate(today()))
		self.assertEqual([r.demand_qty for r in sf.items], [3000])
		sf.save()
		sf.submit()

		# 3. Master Production Schedule from the forecast.
		mps = create_mps(sf.name)
		mps.insert()

		# 4. The MRP report with its JS defaults. v16 spreads a monthly forecast over the month's days, so
		#    the bucket's rows add up to 3000.
		_kolom, data, *_ = execute(
			frappe._dict(
				{
					"company": self.pabrik,
					"from_date": mps.from_date,
					"to_date": mps.to_date,
					"warehouse": akar_gudang(self.pabrik),
					"mps": mps.name,
					"type_of_material": "All",
					"add_safety_stock": 1,
					"show_in_bucket_view": 0,
					"bucket_view": "Delivery Date",
					"bucket_size": "Monthly",
				}
			)
		)
		baris = [r for r in data if r.get("item_code") == JADI]
		self.assertTrue(baris)
		self.assertAlmostEqual(sum(r.required_qty for r in baris), 3000, places=3)

		# 5. A Work Order with no warehouses gets the factory's, and skips the transfer (setup.BAWAAN_WO).
		wo = frappe.get_doc(
			{
				"doctype": "Work Order",
				"production_item": JADI,
				"bom_no": bom,
				"qty": 3000,
				"company": self.pabrik,
			}
		).insert()
		self.assertEqual((wo.skip_transfer, wo.fg_warehouse), (1, gudang(self.pabrik, "Gudang Barang Jadi")))
		wo.submit()

		# 6. Manufacture (as System Manager; staff go through a Production Entry): finished goods +3000, the PP
		# in Gudang Bahan Baku -750.
		jadi = gudang(self.pabrik, "Gudang Barang Jadi")
		sebelum_jadi, sebelum_pp = stok(JADI, jadi), stok(PP, bahan_baku)
		frappe.get_doc(make_stock_entry(wo.name, "Manufacture", 3000)).insert().submit()
		self.assertEqual(stok(JADI, jadi) - sebelum_jadi, 3000)
		self.assertEqual(sebelum_pp - stok(PP, bahan_baku), 750)
		self.assertEqual(frappe.db.get_value("Work Order", wo.name, "status"), "Completed")
