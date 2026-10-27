#!/usr/bin/env bash
# Sets up the local dev bench for erp_internal. Safe to rerun: every part skips what already exists.
#
#   tools/setup_bench.sh            # all parts
#   tools/setup_bench.sh db bench   # only the named parts: db bench ports apps link sites wizard
#
# ERP_BENCH (default ~/Desktop/Projects/erp-internal-bench) must hold a mode-0600 .env with
# DB_ROOT_PASSWORD and ADMIN_PASSWORD. The values are never printed.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERP_BENCH="${ERP_BENCH:-$HOME/Desktop/Projects/erp-internal-bench}"
PYTHON="${PYTHON:-python3.14}"
DB_CONTAINER=erp-mariadb
DB_PORT=3308
WEB_PORT=8002
SOCKETIO_PORT=9002
REDIS_QUEUE_PORT=11002
REDIS_CACHE_PORT=13002
SITES=(erp.localhost erp-test.localhost)
COMPANY="PT Contoh Plastik"
COMPANY_ABBR=CPL

tag() { "$PYTHON" -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])" "$REPO/versi.json" "$1"; }
log() { printf '\n== %s\n' "$*"; }

[ -f "$ERP_BENCH/.env" ] || { echo "Missing $ERP_BENCH/.env (DB_ROOT_PASSWORD, ADMIN_PASSWORD)" >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. "$ERP_BENCH/.env"
set +a
: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD missing in .env}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD missing in .env}"

part_db() {
	log "1. MariaDB container $DB_CONTAINER on 127.0.0.1:$DB_PORT"
	if docker container inspect "$DB_CONTAINER" >/dev/null 2>&1; then
		docker start "$DB_CONTAINER" >/dev/null
	else
		MARIADB_ROOT_PASSWORD="$DB_ROOT_PASSWORD" docker run -d --name "$DB_CONTAINER" --restart unless-stopped -p "127.0.0.1:$DB_PORT:3306" \
			-e MARIADB_ROOT_PASSWORD -v erp-mariadb:/var/lib/mysql mariadb:11.8.9 \
			--character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci >/dev/null
	fi
	for _ in $(seq 60); do
		docker exec -e MYSQL_PWD="$DB_ROOT_PASSWORD" "$DB_CONTAINER" mariadb -uroot -e 'select 1' >/dev/null 2>&1 \
			&& { echo "MariaDB is up"; return; }
		sleep 2
	done
	echo "MariaDB did not come up" >&2
	exit 1
}

part_bench() {
	log "2. bench init (frappe $(tag frappe))"
	if [ -d "$ERP_BENCH/apps/frappe" ]; then echo "exists, skipped"; return; fi
	# The folder already exists (it holds .env), hence --ignore-exist.
	bench init --ignore-exist --frappe-branch "$(tag frappe)" --python "$PYTHON" "$ERP_BENCH"
}

part_ports() {
	log "3. ports"
	cd "$ERP_BENCH"
	bench set-config -g -p webserver_port "$WEB_PORT"
	bench set-config -g -p socketio_port "$SOCKETIO_PORT"
	bench set-config -g redis_cache "redis://127.0.0.1:$REDIS_CACHE_PORT"
	bench set-config -g redis_queue "redis://127.0.0.1:$REDIS_QUEUE_PORT"
	bench set-config -g redis_socketio "redis://127.0.0.1:$REDIS_CACHE_PORT"
	bench set-config -g db_host 127.0.0.1
	bench set-config -g -p db_port "$DB_PORT"
	bench setup redis
	bench setup procfile <<<y # it asks before overwriting
}

part_apps() {
	log "4. erpnext $(tag erpnext), hrms $(tag hrms)"
	cd "$ERP_BENCH"
	[ -d apps/erpnext ] || bench get-app --branch "$(tag erpnext)" erpnext
	[ -d apps/hrms ] || bench get-app --branch "$(tag hrms)" hrms
}

part_link() {
	log "5. link erp_internal -> $REPO"
	cd "$ERP_BENCH"
	if [ ! -d "$REPO/erp_internal" ]; then echo "no erp_internal package in the repo yet, skipped"; return; fi
	[ -L apps/erp_internal ] || ln -s "$REPO" apps/erp_internal
	env/bin/pip install -q -e apps/erp_internal
	grep -qx erp_internal sites/apps.txt || echo erp_internal >>sites/apps.txt
}

redis_up() {
	# new-site needs Redis. Start the bench's own instances when `bench start` isn't running.
	cd "$ERP_BENCH"
	for conf in redis_cache redis_queue; do
		local port
		port=$(awk '/^port /{print $2}' "config/$conf.conf")
		redis-cli -p "$port" ping >/dev/null 2>&1 || (cd config && redis-server "$conf.conf" --daemonize yes >/dev/null)
	done
}

part_sites() {
	log "6. sites ${SITES[*]}"
	cd "$ERP_BENCH"
	redis_up
	for site in "${SITES[@]}"; do
		if [ -d "sites/$site" ]; then echo "$site exists, skipped"; continue; fi
		bench new-site "$site" --db-host 127.0.0.1 --db-port "$DB_PORT" --db-root-username root \
			--db-root-password "$DB_ROOT_PASSWORD" --admin-password "$ADMIN_PASSWORD" \
			--mariadb-user-host-login-scope='%' \
			--install-app erpnext --install-app hrms --install-app erp_internal
	done
	bench --site erp-test.localhost set-config -p allow_tests true
}

part_wizard() {
	log "7. setup wizard on erp.localhost ($COMPANY, $COMPANY_ABBR)"
	cd "$ERP_BENCH"
	redis_up
	if [ "$(bench --site erp.localhost execute frappe.is_setup_complete 2>/dev/null | tail -1)" = "true" ]; then
		echo "already complete, skipped"
		return
	fi
	local year
	year=$(date +%Y)
	# Administrator only: no full_name/email, so the wizard creates no extra user.
	bench --site erp.localhost execute frappe.desk.page.setup_wizard.setup_wizard.setup_complete --kwargs "$(
		cat <<EOF
{"args": {"language": "English", "country": "Indonesia", "timezone": "Asia/Jakarta", "currency": "IDR",
 "company_name": "$COMPANY", "company_abbr": "$COMPANY_ABBR", "chart_of_accounts": "Standard",
 "fy_start_date": "$year-01-01", "fy_end_date": "$year-12-31", "setup_demo": 0}}
EOF
	)"
	bench --site erp.localhost clear-cache
}

PARTS=("$@")
[ ${#PARTS[@]} -gt 0 ] || PARTS=(db bench ports apps link sites wizard)
for p in "${PARTS[@]}"; do "part_$p"; done
log "done. Start with: cd $ERP_BENCH && bench start  (http://erp.localhost:$WEB_PORT)"
