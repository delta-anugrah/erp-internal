#!/usr/bin/env bash
# Runs erp_internal's tests inside a built image, the very image a tag later releases: its own MariaDB and Redis on a
# throwaway Docker network, a fresh site with allow_tests, then `run-tests --app erp_internal`. Used by
# .github/workflows/ci.yml and runnable on the dev machine (only Docker needed); everything is removed at exit.
#
#   deploy/ci_tes.sh erp-internal:uji
set -euo pipefail

IMAGE="${1:?usage: $0 <image>}"
NAMA="erp-ci-$$"
SANDI="ci-$$-root"

bersih() { docker rm -f "$NAMA-db" "$NAMA-redis" >/dev/null 2>&1 || true; docker network rm "$NAMA" >/dev/null 2>&1 || true; }
trap bersih EXIT

docker network create "$NAMA" >/dev/null
# The same MariaDB and settings as deploy/server/docker-compose.yml.
docker run -d --name "$NAMA-db" --network "$NAMA" --network-alias mariadb -e MARIADB_ROOT_PASSWORD="$SANDI" \
	--health-cmd "healthcheck.sh --connect --innodb_initialized" --health-interval 3s --health-retries 40 \
	mariadb:11.8.9 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci \
	--character-set-client-handshake=FALSE --skip-name-resolve >/dev/null
docker run -d --name "$NAMA-redis" --network "$NAMA" --network-alias redis redis:6.2-alpine >/dev/null

for _ in $(seq 60); do
	[ "$(docker inspect -f '{{.State.Health.Status}}' "$NAMA-db")" = healthy ] && break
	sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$NAMA-db")" = healthy ] || { echo "MariaDB did not start"; exit 1; }

docker run --rm --network "$NAMA" -e SANDI="$SANDI" "$IMAGE" bash -c '
	set -euo pipefail
	ls -1 apps > sites/apps.txt
	bench set-config -g db_host mariadb
	bench set-config -gp db_port 3306
	for r in redis_cache redis_queue redis_socketio; do bench set-config -g "$r" redis://redis:6379; done
	bench new-site ci.localhost --db-root-username root --db-root-password "$SANDI" --admin-password admin \
		--mariadb-user-host-login-scope="%" --install-app erpnext --install-app hrms --install-app erp_internal
	bench --site ci.localhost set-config -p allow_tests True
	bench --site ci.localhost run-tests --app erp_internal
'
