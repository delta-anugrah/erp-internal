# shellcheck shell=bash
# The first accounts, asked once in the terminal by setup.sh (server) and tools/setup_lokal.sh (local). Sourced
# after tanya.sh, never run. Pick the accounts (Administrator always), then a password for Administrator and an
# email and password for each. Later, `make akun` (local and server) asks the same with nothing forced: a new
# password for any account (Administrator included, the way back in when nobody can sign in) or a new account.
# An Admin in the app can also make accounts and reset passwords.
#
# The answers go to erp_internal.akun inside the `tools` container in the environment variable ERP_AKUN, never on
# a command line or in a file.

PROFIL=("Administrator" "Super Admin" "Admin" "Produksi")
KETERANGAN=(
	"always created; the built-in super user"
	"everything, plus system settings (for the IT people)"
	"manager: Work Orders, BOMs, users, items, customers, machines"
	"production output and machine status only"
)

# The checklist: arrow keys (or j/k) move, Space ticks, Enter goes on. Into DIPILIH. Administrator stays ticked,
# except with --ubah (`make akun`): then nothing starts ticked and Enter waits for at least one tick.
pilih_akun() {
	local i k sisa n=${#PROFIL[@]} di=1 pertama=1 wajib=1
	[ "${1:-}" != --ubah ] || wajib=0
	DIPILIH=("$wajib" 0 0 0)
	if [ $wajib = 1 ]; then
		echo "Which accounts do you want to create?  (Up/Down move, Space tick, Enter continue)"
	else
		di=0
		echo "Which accounts get a new password, or are new?  (Up/Down move, Space tick, Enter continue)"
		echo "For an existing account tick its own role and type its email: it gets the new password."
	fi
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
			" ") [ $di = 0 ] && [ $wajib = 1 ] || DIPILIH[di]=$((1 - DIPILIH[di])) ;;
			"") [[ " ${DIPILIH[*]} " == *" 1 "* ]] && break ;;
		esac
	done
	stty echo
	printf '\033[?25h'
}

# tanya_akun [--hanya-admin | --ubah] → ERP_AKUN (not exported). --hanya-admin: Administrator only, for a wizard
# filled by hand (the Role Profiles of the other accounts exist only after it). --ubah: `make akun`, Administrator
# optional (erp_internal.akun leaves its password alone when the key is missing).
tanya_akun() {
	local i email akun="" dipakai=" "
	echo
	if [ "${1:-}" = --hanya-admin ]; then
		DIPILIH=(1 0 0 0)
		echo "Accounts: only Administrator now. The account you create in the wizard is the Super Admin;"
		echo "add the Admin and Produksi accounts in the app after the wizard."
	else
		pilih_akun "${1:-}"
	fi
	ERP_AKUN="{"
	if [ "${DIPILIH[0]}" = 1 ]; then
		echo
		echo "Administrator (sign in with the name Administrator)"
		sandi_baru "Administrator"
		ERP_AKUN+="\"Administrator\": $(json "$SANDI"), "
	fi
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
	ERP_AKUN+="\"akun\": [$akun]}"
	SANDI=""
}

# buat_akun COMPOSE: make the accounts of ERP_AKUN through the stack's `docker compose ...` command, then forget them.
buat_akun() {
	echo
	echo "Creating the accounts..."
	# SITE is expanded inside the container (from its env_file), not here. COMPOSE is split into words on purpose.
	# shellcheck disable=SC2016,SC2086
	ERP_AKUN=$ERP_AKUN $1 run --rm -T -e ERP_AKUN tools bash -c \
		'bench --site "$SITE" execute erp_internal.akun.buat'
	ERP_AKUN=""
}
