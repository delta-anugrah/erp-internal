#!/usr/bin/env bash
# Nightly backup of the site, copied off-site with rclone. Cron runs it at 02:00 WIB (deploy/server/README.md):
#   1. bench backup --with-files --compress inside the backend container;
#   2. the newest set (database, public files, private files) copied to ./cadangan and then to $RCLONE_REMOTE;
#   3. sets older than SIMPAN_HARI (14) days deleted, here and on the remote.
# Exits non-zero on any failure, so cron's mail or the log shows it.
#
#   ./cadangan.sh            (in the directory holding docker-compose.yml and .env)
set -euo pipefail

DIR=$(cd "$(dirname "$0")" && pwd)
cd "$DIR"

ENV_FILE=${ENV_FILE:-$DIR/.env}
# Only the two values this script needs, never the whole .env (it holds the database root password).
baca() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -1; }
SITE=${SITE:-$(baca SITE)}
RCLONE_REMOTE=${RCLONE_REMOTE:-$(baca RCLONE_REMOTE)}
: "${SITE:?SITE missing in $ENV_FILE}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE missing in $ENV_FILE}"
SIMPAN_HARI=${SIMPAN_HARI:-14}
LOKAL=${CADANGAN_LOKAL:-$DIR/cadangan}

log() { echo "$(date '+%F %T') cadangan: $*"; }
trap 'log "GAGAL (baris $LINENO)"' ERR

mkdir -p "$LOKAL"
chmod 700 "$LOKAL"

log "backup $SITE"
docker compose exec -T backend bench --site "$SITE" backup --with-files --compress >/dev/null

# The newest set: the files sharing the prefix of the newest database dump, minus the site config (it holds the
# database password; the encryption key is kept apart, README "Secrets").
CADANGAN_SITUS=/home/frappe/frappe-bench/sites/$SITE/private/backups
db=$(docker compose exec -T backend bash -c "ls -1t $CADANGAN_SITUS/*-database*.sql.gz | head -1" | tr -d '\r')
awalan=${db%-database*}
berkas=()
while IFS= read -r f; do berkas+=("$f"); done < <(
	docker compose exec -T backend bash -c "ls -1 '$awalan'-*" | tr -d '\r' | grep -v site_config
)
[ "${#berkas[@]}" -eq 3 ] || { log "expected 3 files for $awalan, found ${#berkas[@]}: ${berkas[*]}"; exit 1; }

for f in "${berkas[@]}"; do
	docker compose cp "backend:$f" "$LOKAL/"
	# docker cp keeps the container's time; stamp it now, so the age below counts from the copy.
	touch "$LOKAL/$(basename "$f")"
done
nama=$(basename "$awalan")
log "copy $nama-* to $RCLONE_REMOTE"
rclone copy "$LOKAL" "$RCLONE_REMOTE" --include "$nama-*"
# A copy that did not land is a failure, not a warning.
[ "$(rclone lsf "$RCLONE_REMOTE" --include "$nama-*" | wc -l)" -eq 3 ] || { log "remote is missing files of $nama"; exit 1; }

log "delete sets older than $SIMPAN_HARI days"
find "$LOKAL" -type f -mmin +$((SIMPAN_HARI * 1440)) -delete
rclone delete "$RCLONE_REMOTE" --min-age "${SIMPAN_HARI}d"
log "OK $nama"
