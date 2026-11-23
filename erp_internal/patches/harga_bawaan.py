"""Sites loaded before 2026-11-23: Sales and Purchase Orders came at price 0, because the global price list
defaults stayed on ERPNext's standard lists. Set them again when Samuel's lists exist."""

import frappe

from erp_internal import master, penjualan


def execute():
	hasil = master.Hasil()
	daftar = master.daftar_harga(master.berkas("katalog.json"))
	if frappe.db.exists("Price List", daftar):
		master._harga_bawaan(daftar, hasil)
	if frappe.db.exists("Price List", penjualan.HARGA_BAHAN):
		master._harga_bawaan(penjualan.HARGA_BAHAN, hasil, "buying_price_list")
