# The server setup of README.md "First install", one target per step. Run it as `deploy` in ~/erp, the folder
# holding this file, docker-compose.yml, cadangan.sh and .env:
#
#   make env SITE=erp.<domain> ERP_IMAGE=ghcr.io/delta-anugrah/erp-internal:vX.Y.Z RCLONE_REMOTE=<remote>:<bucket>/erp
#   make setup COMPANY="PT Delta Anugrah" ABBR=DAN
#
# `make setup` runs the steps in order and stops at the first that fails; every step is safe to run again (it
# skips what is already done). Steps 1-4 of the runbook (server, DNS, reverse proxy with TLS, `docker login ghcr.io`)
# stay by hand: `cek` and `pull` only check them. No secret is in this file or on a command line: the passwords
# are generated into .env by `env` and read inside the `tools` container from its env_file. `make -n setup` prints
# every command without running it.

SHELL := /bin/bash
# Each recipe line runs in its own shell (GNU Make 3.81 has no .ONESHELL); this makes each one strict.
KETAT := set -euo pipefail;

COMPOSE := docker compose
# A one-off bench command in the image; COMPANY, ABBR and TAHUN go in as environment, never spliced into the script.
TOOLS := $(COMPOSE) run --rm -T -e COMPANY -e ABBR -e TAHUN tools bash -c

# The wizard's company and fiscal year (README step 7; Task 8 confirms them with Samuel). Not secrets.
COMPANY ?= PT Delta Anugrah
ABBR ?= DAN
TAHUN ?= $(shell date +%Y)
export COMPANY ABBR TAHUN

# SITE from .env, for the host-side commands (ping, messages); it is the only value read from it here.
SITUS = $(shell sed -n 's/^SITE=//p' .env 2>/dev/null)
# The stack's local port (PORT in .env, for a restore drill stack; default 8080).
PORT_LOKAL = $(or $(shell sed -n 's/^PORT=//p' .env 2>/dev/null),8080)

.DEFAULT_GOAL := help
.PHONY: help setup cek env cek-env pull db site wizard aktif up ping cron cadangan

help:
	@echo "make env SITE=... ERP_IMAGE=... RCLONE_REMOTE=...   write .env with generated passwords (once)"
	@echo "make setup [COMPANY=... ABBR=... TAHUN=...]       every step below, in order, stop on the first error"
	@echo "  cek       tools on the host: docker, compose, rclone, openssl, curl, time zone"
	@echo "  cek-env   .env is mode 600, has every key, ERP_IMAGE is an exact tag"
	@echo "  pull      pull the image (needs docker login ghcr.io)"
	@echo "  db        start mariadb, redis and the configurator"
	@echo "  site      bench new-site if missing, then install whichever of erpnext, hrms, erp_internal is missing"
	@echo "  wizard    complete the setup wizard for COMPANY/ABBR (skipped if complete)"
	@echo "  aktif     tick erp_aktif, migrate, host_name, erp_produksi, scheduler on"
	@echo "  up        the whole stack"
	@echo "  ping      the stack answers on 127.0.0.1:PORT (8080) as SITE"
	@echo "  cron      the nightly backup line in deploy's crontab (added once)"
	@echo "  cadangan  one backup by hand (README step 9; then do a restore drill)"

setup: cek env cek-env pull db site wizard aktif up ping cron
	@echo "setup done: $(SITUS). Next by hand: make cadangan, a restore drill, curl https://$(SITUS)/api/method/ping"

cek:
	@$(KETAT) for t in docker rclone openssl curl crontab; do command -v $$t >/dev/null || { echo "missing: $$t"; exit 1; }; done
	@$(KETAT) $(COMPOSE) version >/dev/null || { echo "missing: the docker compose plugin"; exit 1; }
	@$(KETAT) docker info >/dev/null 2>&1 || { echo "docker does not answer: is $$USER in the docker group?"; exit 1; }
	@$(KETAT) tz=$$(timedatectl show -p Timezone --value 2>/dev/null || echo unknown); \
		[ "$$tz" = Asia/Jakarta ] || { echo "time zone is $$tz: sudo timedatectl set-timezone Asia/Jakarta"; exit 1; }
	@echo "cek OK"

# Written once; an existing .env is never touched (the passwords in it are the site's).
env:
	@$(KETAT) if [ -f .env ]; then echo ".env exists, kept"; exit 0; fi; \
		[ -n "$(SITE)" ] && [ -n "$(ERP_IMAGE)" ] && [ -n "$(RCLONE_REMOTE)" ] || \
			{ echo "give SITE=... ERP_IMAGE=... RCLONE_REMOTE=... (see the top of this Makefile)"; exit 1; }; \
		umask 077; \
		printf 'ERP_IMAGE=%s\nSITE=%s\nDB_ROOT_PASSWORD=%s\nADMIN_PASSWORD=%s\nRCLONE_REMOTE=%s\n' \
			'$(ERP_IMAGE)' '$(SITE)' "$$(openssl rand -hex 24)" "$$(openssl rand -hex 12)" '$(RCLONE_REMOTE)' > .env; \
		echo ".env written (passwords generated, not shown)"

cek-env:
	@$(KETAT) [ -f .env ] || { echo "no .env: make env first"; exit 1; }
	@$(KETAT) m=$$(stat -c %a .env 2>/dev/null || stat -f %Lp .env); [ "$$m" = 600 ] || { echo ".env is mode $$m, want 600: chmod 600 .env"; exit 1; }
	@$(KETAT) for k in ERP_IMAGE SITE DB_ROOT_PASSWORD ADMIN_PASSWORD RCLONE_REMOTE; do \
		grep -Eq "^$$k=.+" .env || { echo ".env: $$k is missing or empty"; exit 1; }; done
	@$(KETAT) img=$$(sed -n 's/^ERP_IMAGE=//p' .env); \
		[[ "$$img" =~ :v[0-9]+\.[0-9]+\.[0-9]+$$ ]] || { echo "ERP_IMAGE must be an exact tag :vX.Y.Z, not $$img"; exit 1; }
	@echo "cek-env OK"

pull:
	$(COMPOSE) pull

db:
	$(COMPOSE) up -d mariadb redis-cache redis-queue configurator

site:
	$(TOOLS) 'set -euo pipefail; \
		if [ ! -f "sites/$$SITE/site_config.json" ]; then \
			bench new-site "$$SITE" --db-root-username root --db-root-password "$$DB_ROOT_PASSWORD" \
				--admin-password "$$ADMIN_PASSWORD" --mariadb-user-host-login-scope="%"; \
		fi; \
		for app in erpnext hrms erp_internal; do \
			if bench --site "$$SITE" list-apps | grep -q "^$$app "; then echo "$$app installed, skipped"; \
			else bench --site "$$SITE" install-app "$$app"; fi; \
		done'

wizard:
	$(TOOLS) 'set -euo pipefail; \
		if bench --site "$$SITE" execute frappe.is_setup_complete | grep -q True; then echo "wizard done, skipped"; exit 0; fi; \
		kw=$$(python3 -c "import json, os; t = os.environ[\"TAHUN\"]; print(json.dumps({\"args\": { \
			\"language\": \"English\", \"country\": \"Indonesia\", \"timezone\": \"Asia/Jakarta\", \"currency\": \"IDR\", \
			\"company_name\": os.environ[\"COMPANY\"], \"company_abbr\": os.environ[\"ABBR\"], \
			\"chart_of_accounts\": \"Standard\", \"fy_start_date\": f\"{t}-01-01\", \"fy_end_date\": f\"{t}-12-31\", \
			\"setup_demo\": 0}}))"); \
		bench --site "$$SITE" execute frappe.desk.page.setup_wizard.setup_wizard.setup_complete --kwargs "$$kw"'

# Every command here sets a value or rebuilds what migrate builds, so a second run changes nothing.
aktif:
	$(TOOLS) 'set -euo pipefail; \
		args=$$(python3 -c "import json, os; print(json.dumps([\"Company\", os.environ[\"COMPANY\"], \"erp_aktif\", 1]))"); \
		bench --site "$$SITE" execute frappe.db.set_value --args "$$args"; \
		bench --site "$$SITE" migrate; \
		bench --site "$$SITE" set-config host_name "https://$$SITE"; \
		bench --site "$$SITE" set-config -p erp_produksi 1; \
		bench --site "$$SITE" enable-scheduler'

up:
	$(COMPOSE) up -d

# The stack itself, before DNS and TLS; the public check (https) is in README step 8.
ping:
	@$(KETAT) for i in $$(seq 1 30); do \
		curl -fsS -H "Host: $(SITUS)" http://127.0.0.1:$(PORT_LOKAL)/api/method/ping 2>/dev/null | grep -q pong && { echo "ping OK"; exit 0; }; \
		sleep 2; done; echo "no pong from 127.0.0.1:$(PORT_LOKAL) in 60 s: docker compose logs frontend backend"; exit 1

cron:
	@$(KETAT) baris="0 2 * * * cd $(CURDIR) && ./cadangan.sh >> cadangan.log 2>&1"; \
		lama=$$(crontab -l 2>/dev/null || true); \
		if grep -qF "./cadangan.sh" <<<"$$lama"; then echo "cron line exists, kept"; exit 0; fi; \
		printf '%s\n%s\n' "$$lama" "$$baris" | sed '/^$$/d' | crontab -; echo "cron line added"

cadangan:
	./cadangan.sh
