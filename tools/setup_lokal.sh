#!/usr/bin/env bash
# `make setup`, once after the clone, on your own computer (README.md "Run it on your computer"):
# the setup wizard question and the accounts, then the whole Docker setup. The same questions as the server's
# `make setup` (deploy/server/setup.sh), without its site address, version and backup: locally the site is
# erp.localhost on http://localhost:8080 and the image is built from this repo.
#
#   .local/wizard     the wizard answer (no secret), so a rerun does not ask again
#   .local/akun-siap  the accounts were made: a rerun never touches live passwords
#   .local/lanjut-siap  `lanjut` ran after the wizard (our setup, the wizard's account as Super Admin, Samuel's data);
#                     until then every start tries it, so a job that failed after a by-hand wizard is repaired
#   .local/siap       a run went through to the end; `make up` starts only after it, `make setup` stops at it
#
#   tools/setup_lokal.sh --pesan   only the last line: where to go, or what is left of a wizard filled by hand
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=deploy/server/tanya.sh
. deploy/server/tanya.sh
# shellcheck source=deploy/server/akun.sh
. deploy/server/akun.sh
# shellcheck source=deploy/server/wizard.sh
. deploy/server/wizard.sh

: "${COMPOSE:?run this through make setup}"
LOKAL=.local
PORT=$(sed -n 's/^PORT=//p' $LOKAL/.env 2>/dev/null)
PORT=${PORT:-8080}
ERP_AKUN=""

# After the wizard, once: `lanjut` (idempotent; Samuel's data is loaded only the first time).
lanjut() {
	if [ ! -f $LOKAL/lanjut-siap ]; then
		make --no-print-directory lanjut
		touch $LOKAL/lanjut-siap
	fi
}

pesan() {
	if [ -f $LOKAL/wizard ]; then
		# shellcheck source=/dev/null
		. $LOKAL/wizard
	fi
	if make --no-print-directory -s wizard-selesai >/dev/null 2>&1; then
		lanjut
		echo
		echo "Ready: open http://localhost:$PORT and sign in as Administrator or with an account made here."
	else
		petunjuk_wizard "http://localhost:$PORT" "make up"
	fi
}

if [ "${1:-}" = --pesan ]; then
	pesan
	exit 0
fi

perlu_terminal
echo "ERP Internal on this computer. Every question has a suggestion in [brackets]: press Enter to take it."
if [ -f $LOKAL/wizard ]; then
	# shellcheck source=/dev/null
	. $LOKAL/wizard
	export WIZARD COMPANY ABBR
else
	tanya_wizard
	printf 'WIZARD=%q\nCOMPANY=%q\nABBR=%q\n' "$WIZARD" "$COMPANY" "$ABBR" > $LOKAL/wizard
fi
if [ ! -f $LOKAL/akun-siap ]; then
	if [ "$WIZARD" = tangan ]; then tanya_akun --hanya-admin; else tanya_akun; fi
fi

echo
echo "Setting up; the first time takes 10-30 minutes (building the image is most of it)."
make --no-print-directory setup-local WIZARD="$WIZARD" COMPANY="$COMPANY" ABBR="$ABBR"
make --no-print-directory ping-local
if [ -n "$ERP_AKUN" ]; then
	buat_akun "$COMPOSE"
	touch $LOKAL/akun-siap
	# The generated password only served bench new-site; the typed one is Administrator's now.
	sed -i.lama '/^ADMIN_PASSWORD=/d' $LOKAL/.env && rm -f $LOKAL/.env.lama && chmod 600 $LOKAL/.env
fi
touch $LOKAL/siap
pesan
