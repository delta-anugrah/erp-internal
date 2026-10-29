"""Fill Sales History.title for the rows saved before it existed (2026-10-29)."""

import frappe


def execute():
	# Same text as `sales_history.judul`, in SQL: a site may hold thousands of rows.
	frappe.db.sql(
		"""update `tabSales History`
		set title = concat(item_code, ' · ', date_format(bulan, '%m-%Y'))
		where ifnull(title, '') = ''"""
	)
