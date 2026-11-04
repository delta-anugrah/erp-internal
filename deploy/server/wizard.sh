# shellcheck shell=bash
# The setup wizard question, asked once by setup.sh (server) and tools/setup_lokal.sh (local). Sourced after
# tanya.sh, never run. Automatic: the Makefile's `wizard` step fills it with the values below. By hand: the person
# fills it in the browser with the same values, printed by petunjuk_wizard. The values match deploy/server/Makefile
# `wizard` (company and abbreviation can be changed here; the rest are fixed).

# The fixed values, one per line: label, value, what it is for.
nilai_tetap() {
	baris "Fiscal year" "${TAHUN:-$(date +%Y)}" "the bookkeeping year, 1 January to 31 December"
	baris "Country" "Indonesia" "tax and address formats"
	baris "Time zone" "Asia/Jakarta" "the clock of every document"
	baris "Currency" "IDR" "the money every price and report is in"
	baris "Language" "English" "each user can switch to Indonesian later"
	baris "Chart of accounts" "Standard" "the list of bookkeeping accounts"
}

baris() { printf '  %-18s %-20s (%s)\n' "$1:" "$2" "$3"; }

# All values, for the by-hand path.
cetak_nilai() {
	baris "Company name" "$COMPANY" "on invoices, reports and every document"
	baris "Abbreviation" "$ABBR" "short code added to account and warehouse names"
	nilai_tetap
}

# tanya_wizard → WIZARD (otomatis | tangan), COMPANY, ABBR, TAHUN, all exported.
tanya_wizard() {
	COMPANY=${COMPANY:-PT Delta Anugrah}
	ABBR=${ABBR:-DAN}
	TAHUN=${TAHUN:-$(date +%Y)}
	echo
	pilih_satu "Setup wizard (the company's first settings): fill it in automatically, or by hand in the browser?" \
		"Automatically" "By hand in the browser"
	if [ "$PILIHAN" = 1 ]; then
		WIZARD=otomatis
		echo
		echo "Automatic values. The first two are filled in: Enter keeps them, Backspace changes them."
	else
		WIZARD=tangan
		echo
		echo "Values to type in the wizard later. The first two are filled in: Enter keeps them, Backspace changes them."
	fi
	tanya_isi "Company name" "$COMPANY" "on invoices, reports and every document"
	COMPANY=$JAWAB
	tanya_isi "Abbreviation" "$ABBR" "short code added to account and warehouse names"
	ABBR=$JAWAB
	nilai_tetap
	export WIZARD COMPANY ABBR TAHUN
}

# petunjuk_wizard URL: the ending of the by-hand path.
petunjuk_wizard() {
	echo
	echo "One step left: the setup wizard, by hand."
	echo "  1. Open $1"
	echo "  2. Sign in as Administrator with the password you typed for it."
	echo "  3. Fill in the wizard with these values:"
	cetak_nilai | sed "s/^/   /"
	echo "     The wizard suggests \"Indonesia - Chart of Accounts\": pick Standard. \"A little about you\": any answer."
	echo "  4. In \"Create your account\", make your own account: it becomes the Developer."
	echo "  5. Wait a minute after the wizard: Samuel's data loads by itself."
}
