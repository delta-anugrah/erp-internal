#!/usr/bin/env bash
# `make setup` on the server (README.md "First install"): a few questions in the terminal, then every step of the
# Makefile. Each question shows what it is for and a suggested answer (Enter takes it), and is skipped when its
# answer is already there (.env, the docker login, the markers below). Safe to run again: steps skip what is done.
#
#   .wizard      the wizard answer (WIZARD, COMPANY, ABBR; no secret), so a rerun does not ask again
#   .akun-siap   the accounts were made: a rerun never touches live passwords
#   .siap        a run went through to the end
#
# No secret on a command line or in a file: the GitHub token goes to `docker login` on stdin and to curl through
# a config on stdin; the account passwords go in an environment variable to erp_internal.akun (akun.sh).
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=tanya.sh
. ./tanya.sh
# shellcheck source=akun.sh
. ./akun.sh
# shellcheck source=wizard.sh
. ./wizard.sh

REPO=delta-anugrah/erp-internal
GH_USER=""
TOKEN=""
ERP_AKUN=""

baca() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -1; }

# Question 1: sign in to GitHub's registry (the app's image is private), unless already signed in.
masuk_github() {
	if grep -q '"ghcr.io"' ~/.docker/config.json 2>/dev/null; then
		echo "GitHub: already signed in to ghcr.io."
		return
	fi
	echo
	echo "GitHub sign-in (to download the app): a token with only the read:packages permission."
	while true; do
		tanya "GitHub user name" "" "the GitHub account that can read $REPO"
		GH_USER=$JAWAB
		baca_sandi "  Token: "
		TOKEN=$SANDI
		SANDI=""
		if printf '%s' "$TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin >/dev/null 2>&1; then
			echo "  Signed in."
			return
		fi
		echo "  That token did not work (it needs read:packages), try again."
	done
}

# The newest vX.Y.Z tag of the image, or nothing (no token this run, no release yet, no network).
versi_terbaru() {
	local auth="" token
	[ -z "$TOKEN" ] || auth="user = \"$GH_USER:$TOKEN\""
	token=$(printf '%s\n' "$auth" | curl -fsS -K - "https://ghcr.io/token?scope=repository:$REPO:pull" 2>/dev/null |
		sed -n 's/.*"token":"\([^"]*\)".*/\1/p') || true
	[ -n "$token" ] || return 0
	printf 'header = "Authorization: Bearer %s"\n' "$token" |
		curl -fsS -K - "https://ghcr.io/v2/$REPO/tags/list?n=1000" 2>/dev/null |
		grep -oE '"v[0-9]+\.[0-9]+\.[0-9]+"' | tr -d '"' | sort -V | tail -1 || true
}

# Questions 2-4 and .env, once.
tulis_env() {
	local situs versi remote
	echo
	tanya "Site address" "" "the exact address people type in the browser, e.g. app.deltaanugrah.com"
	situs=$(printf '%s' "$JAWAB" | sed -E 's#^https?://##; s#/.*$##')
	echo
	tanya "App version" "$(versi_terbaru)" "the release to install (vX.Y.Z); the newest is suggested"
	versi=$JAWAB
	[[ $versi == v* ]] || versi="v$versi"
	echo
	tanya "Backup destination" "skip" "an rclone remote like r2:erp-backup/erp; skip keeps the nightly backups on this server only"
	remote=$JAWAB
	[ "$remote" != skip ] || remote=""
	make --no-print-directory env SITE="$situs" ERP_IMAGE="ghcr.io/$REPO:$versi" RCLONE_REMOTE="$remote"
}

perlu_terminal
echo "ERP Internal server setup. Every question has a suggestion in [brackets]: press Enter to take it."
masuk_github
[ -f .env ] || tulis_env

if [ -f .wizard ]; then
	# shellcheck source=/dev/null
	. ./.wizard
	export WIZARD COMPANY ABBR
else
	tanya_wizard
	printf 'WIZARD=%q\nCOMPANY=%q\nABBR=%q\n' "$WIZARD" "$COMPANY" "$ABBR" > .wizard
fi
if [ ! -f .akun-siap ]; then
	if [ "$WIZARD" = tangan ]; then tanya_akun --hanya-admin; else tanya_akun; fi
fi
TOKEN=""

echo
echo "Setting up; the first time takes 10-20 minutes."
make --no-print-directory langkah
if [ "$WIZARD" = otomatis ]; then
	make --no-print-directory wizard configure lanjut COMPANY="$COMPANY" ABBR="$ABBR"
else
	make --no-print-directory configure
fi
if [ -n "$ERP_AKUN" ]; then
	buat_akun "docker compose"
	touch .akun-siap
	# The generated password only served bench new-site; the typed one is Administrator's now.
	sed -i.lama '/^ADMIN_PASSWORD=/d' .env && rm -f .env.lama && chmod 600 .env
fi
make --no-print-directory up ping cron
touch .siap

situs=$(baca SITE)
if make --no-print-directory -s wizard-selesai; then
	echo
	echo "Ready: https://$situs (once DNS and the reverse proxy point at this server, README steps 2-3)."
	echo "Sign in as Administrator or with an account made above."
else
	petunjuk_wizard "https://$situs"
fi
echo
if [ -n "$(baca RCLONE_REMOTE)" ]; then
	echo "Next: make backup, then a restore drill (README \"Backups and restore\")."
else
	echo "Backups stay on this server only (./cadangan). To copy them off it: install rclone,"
	echo "add RCLONE_REMOTE=<remote> to .env, then make backup."
fi
