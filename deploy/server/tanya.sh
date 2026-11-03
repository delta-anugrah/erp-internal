# Terminal questions shared by setup.sh (server), tools/setup_lokal.sh (local), akun.sh and wizard.sh. Sourced,
# never run. Every question is one plain line saying what it is for, with a suggested answer that Enter accepts;
# options and values one per line. Passwords are typed blind, one * per character. macOS bash 3.2 and Linux / WSL.

PANJANG_MIN=8 # the shortest password, as erp_internal.akun.PANJANG_MIN

# Stop unless both ends are a terminal; restore the echo and the cursor whatever happens.
perlu_terminal() {
	if [ ! -t 0 ] || [ ! -t 1 ]; then
		echo "This asks a few questions: run it in a terminal." >&2
		exit 1
	fi
	trap 'stty echo 2>/dev/null || true; printf "\033[?25h"' EXIT
}

# tanya LABEL SARAN [KETERANGAN] → JAWAB. Enter keeps SARAN; without SARAN an answer is required.
tanya() {
	local label=$1 saran=$2 keterangan=${3:-}
	[ -z "$keterangan" ] || echo "  $label: $keterangan"
	while true; do
		if [ -n "$saran" ]; then
			read -rp "  $label [$saran]: " JAWAB
			JAWAB=${JAWAB:-$saran}
		else
			read -rp "  $label: " JAWAB
		fi
		# Spaces around the answer are never meant
		JAWAB=$(printf '%s' "$JAWAB" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
		[ -n "$JAWAB" ] && return
		echo "  An answer is needed here."
	done
}

# pilih_satu JUDUL OPSI... → PILIHAN (1-based). The first option is the suggestion: Enter takes it.
pilih_satu() {
	local judul=$1 i=1 n
	shift
	n=$#
	echo "$judul"
	for opsi in "$@"; do
		if [ $i = 1 ]; then
			echo "  $i) $opsi (suggested: press Enter)"
		else
			echo "  $i) $opsi"
		fi
		i=$((i + 1))
	done
	while true; do
		read -rp "  Your choice [1]: " PILIHAN
		PILIHAN=${PILIHAN:-1}
		if [[ $PILIHAN =~ ^[0-9]+$ ]] && [ "$PILIHAN" -ge 1 ] && [ "$PILIHAN" -le "$n" ]; then
			return
		fi
		echo "  Type a number from 1 to $n."
	done
}

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
