#!/usr/bin/env bash
# The first accounts of the local stack, asked in the terminal once by `make start-local` (the repo's Makefile):
# pick the accounts (Administrator always), then a password for Administrator and an email and password for each.
# Everyone after that gets an account from an Admin in the app, which also resets a forgotten password.
#
# ERP_COMPOSE is the stack's `docker compose ...` command (set by the Makefile). The answers go to
# erp_internal.akun inside the `tools` container in the environment variable ERP_AKUN, never on a command line.
# Passwords are typed blind, one * per character. Runs on macOS's bash 3.2 and on Linux / WSL.
set -euo pipefail

: "${ERP_COMPOSE:?run this through make start-local}"
PANJANG_MIN=8 # as erp_internal.akun.PANJANG_MIN
SIAP=.local/akun-siap # written once the accounts are made: start-local asks only once

if [ ! -t 0 ] || [ ! -t 1 ]; then
	echo "Accounts need a terminal: run make start-local in one." >&2
	exit 1
fi
trap 'stty echo 2>/dev/null || true; printf "\033[?25h"' EXIT

PROFIL=("Administrator" "Developer" "Admin" "User")
KETERANGAN=(
	"always created; the built-in super user"
	"everything, plus system settings (for the IT people)"
	"manager: Work Orders, BOMs, users, items, customers, machines"
	"daily work: production output, deliveries, raw material in"
)

# One JSON string literal.
json() {
	local s=$1
	s=${s//\\/\\\\}
	s=${s//\"/\\\"}
	printf '"%s"' "$s"
}

# A password typed blind, a * per character, Backspace works. Into the variable SANDI.
baca_sandi() {
	local c
	SANDI=""
	printf '%s' "$1"
	# Echo off for the whole answer, not only during each one-character read: keys typed (or pasted) faster than
	# the loop would otherwise show on screen in clear between two reads.
	stty -echo
	while IFS= read -rsn1 c; do
		if [ -z "$c" ]; then
			break # Enter
		elif [ "$c" = $'\177' ] || [ "$c" = $'\b' ]; then
			if [ -n "$SANDI" ]; then
				SANDI=${SANDI%?}
				printf '\b \b'
			fi
		elif [ "$c" = $'\e' ]; then
			read -rsn2 -t 1 c || true # an arrow key: ignored
		else
			SANDI+=$c
			printf '*'
		fi
	done
	stty echo
	printf '\n'
}

# A password with its confirmation, at least PANJANG_MIN characters. Into SANDI.
sandi_baru() {
	local label=$1 pertama
	while true; do
		baca_sandi "  Password for $label: "
		if [ ${#SANDI} -lt $PANJANG_MIN ]; then
			echo "  At least $PANJANG_MIN characters, try again."
			continue
		fi
		pertama=$SANDI
		baca_sandi "  Confirm password: "
		[ "$SANDI" = "$pertama" ] && return
		echo "  The two passwords differ, try again."
	done
}

email_benar() { [[ $1 =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; }

# The checklist: arrow keys (or j/k) move, Space ticks, Enter goes on. Administrator stays ticked.
pilih() {
	local i k sisa n=${#PROFIL[@]} di=1 pertama=1
	DIPILIH=(1 0 0 0)
	echo "Which accounts do you want to create?  (Up/Down move, Space tick, Enter continue)"
	printf '\033[?25l'
	stty -echo
	while true; do
		[ $pertama = 1 ] || printf '\033[%dA' "$n"
		pertama=0
		for ((i = 0; i < n; i++)); do
			local tanda="[ ]" kursor="  "
			[ "${DIPILIH[$i]}" = 1 ] && tanda="[x]"
			[ $i = $di ] && kursor="> "
			printf '\033[2K %s%s %-14s %s\n' "$kursor" "$tanda" "${PROFIL[$i]}" "${KETERANGAN[$i]}"
		done
		IFS= read -rsn1 k
		if [ "$k" = $'\e' ]; then
			read -rsn2 -t 1 sisa || true
			case "$sisa" in
				"[A") k=k ;;
				"[B") k=j ;;
			esac
		fi
		case "$k" in
			k) ((di > 0)) && di=$((di - 1)) || true ;;
			j) ((di < n - 1)) && di=$((di + 1)) || true ;;
			" ") [ $di = 0 ] || DIPILIH[di]=$((1 - DIPILIH[di])) ;;
			"") break ;;
		esac
	done
	stty echo
	printf '\033[?25h'
}

pilih
echo
echo "Administrator (sign in with the name Administrator)"
sandi_baru "Administrator"
data="{\"Administrator\": $(json "$SANDI")"
akun=""
dipakai=" "
for ((i = 1; i < ${#PROFIL[@]}; i++)); do
	[ "${DIPILIH[$i]}" = 1 ] || continue
	echo
	echo "${PROFIL[$i]}"
	while true; do
		read -rp "  Email: " email
		email=$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
		if ! email_benar "$email"; then
			echo "  That is not an email address, try again."
		elif [[ $dipakai == *" $email "* ]]; then
			echo "  Already used for another account, try again."
		else
			break
		fi
	done
	dipakai+="$email "
	sandi_baru "$email"
	akun+="${akun:+, }{\"profil\": $(json "${PROFIL[$i]}"), \"email\": $(json "$email"), \"sandi\": $(json "$SANDI")}"
done
data+=", \"akun\": [$akun]}"
echo
echo "Creating the accounts..."
# SITE is expanded inside the container (from its env_file), not here.
# shellcheck disable=SC2016
ERP_AKUN=$data $ERP_COMPOSE run --rm -T -e ERP_AKUN tools bash -c \
	'bench --site "$SITE" execute erp_internal.akun.buat'
mkdir -p .local && touch "$SIAP"
