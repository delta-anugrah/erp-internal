# The server setup of README.md "First install", one target per step. Run it as `deploy` in ~/erp, the folder
# holding this folder's files (this Makefile, docker-compose.yml, cadangan.sh, setup.sh, tanya.sh, akun.sh,
# wizard.sh) and, once written, .env:
#
#   make setup
#
# `make setup` runs setup.sh: it asks its questions in the terminal (GitHub token, site address, app version,
# backup destination, the setup wizard, the accounts), writes .env, then runs the steps below in order and stops
# at the first that fails; every step is safe to run again (it skips what is already done). The server, DNS and the
# reverse proxy with TLS stay by hand (README steps 1-3). No secret is in this file or on a command line: the
# database password is generated into .env by `env` and read inside the `tools` container from its env_file; the
# typed passwords go in an environment variable to erp_internal.akun. `make -n langkah` prints the steps' commands
# without running them; `make env SITE=... ERP_IMAGE=... [RCLONE_REMOTE=...]` writes .env without questions.

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

# SITE and RCLONE_REMOTE from .env, for the host-side commands (ping, check); no secret is read here.
SITUS = $(shell sed -n 's/^SITE=//p' .env 2>/dev/null)
REMOTE = $(shell sed -n 's/^RCLONE_REMOTE=//p' .env 2>/dev/null)
# The stack's local port (PORT in .env, for a restore drill stack; default 8080).
PORT_LOKAL = $(or $(shell sed -n 's/^PORT=//p' .env 2>/dev/null),8080)

.DEFAULT_GOAL := help
.PHONY: help setup akun langkah check env check-env pull db site wizard wizard-selesai configure lanjut up ping cron backup

help:
	@echo "make setup   asks a few questions, then every step below, in order; stops on the first error"
	@echo "make akun    a new password for any account (Administrator too) or a new account"
	@echo "make env SITE=... ERP_IMAGE=... [RCLONE_REMOTE=...]   write .env without questions (once)"
	@echo "  check     ./cadangan made as you; tools on the host: docker, compose, openssl, curl, crontab, time zone (rclone with a backup destination)"
	@echo "  check-env .env is mode 600, has its keys, ERP_IMAGE is an exact tag"
	@echo "  pull      pull the image (needs docker login ghcr.io)"
	@echo "  db        start mariadb, redis and the configurator"
	@echo "  site      bench new-site if missing, install whichever of erpnext, hrms, erp_internal is missing, erp_produksi"
	@echo "  wizard    complete the setup wizard for COMPANY/ABBR (skipped if complete; only when chosen automatic)"
	@echo "  configure migrate, host_name, scheduler on"
	@echo "  lanjut    after the wizard: our setup and, once, Samuel's data"
	@echo "  up        the whole stack"
	@echo "  ping      the stack answers on 127.0.0.1:PORT (8080) as SITE"
	@echo "  cron      the nightly backup line in deploy's crontab (added once)"
	@echo "  backup    one backup by hand (README step 9; then do a restore drill)"

setup:
	@./setup.sh

# A new password for any account (Administrator too) or a new account, asked like setup.
akun:
	@./setup.sh --akun

# The steps before the wizard; setup.sh runs them once .env is written.
langkah: check check-env pull db site

# ./cadangan first, as this user: the `tools` container mounts it, and Docker on Linux makes a missing mount
# source as root, after which cadangan.sh's chmod 700 fails ("Operation not permitted").
check:
	@$(KETAT) mkdir -p cadangan; [ -O cadangan ] || \
		{ echo "./cadangan belongs to $$(stat -c %U cadangan 2>/dev/null || echo someone else): sudo chown -R $$USER: cadangan"; exit 1; }
	@$(KETAT) for t in docker openssl curl crontab $(if $(REMOTE),rclone); do command -v $$t >/dev/null || { echo "missing: $$t"; exit 1; }; done
	@$(KETAT) $(COMPOSE) version >/dev/null || { echo "missing: the docker compose plugin"; exit 1; }
	@$(KETAT) docker info >/dev/null 2>&1 || { echo "docker does not answer: is $$USER in the docker group?"; exit 1; }
	@$(KETAT) tz=$$(timedatectl show -p Timezone --value 2>/dev/null || echo unknown); \
		[ "$$tz" = Asia/Jakarta ] || { echo "time zone is $$tz: sudo timedatectl set-timezone Asia/Jakarta"; exit 1; }
	@echo "check OK"

# Written once; an existing .env is never touched (the passwords in it are the site's).
env:
	@$(KETAT) if [ -f .env ]; then echo ".env exists, kept"; exit 0; fi; \
		[ -n "$(SITE)" ] && [ -n "$(ERP_IMAGE)" ] || \
			{ echo "give SITE=... ERP_IMAGE=... [RCLONE_REMOTE=...] (see the top of this Makefile)"; exit 1; }; \
		umask 077; \
		printf 'ERP_IMAGE=%s\nSITE=%s\nDB_ROOT_PASSWORD=%s\nADMIN_PASSWORD=%s\n' \
			'$(ERP_IMAGE)' '$(SITE)' "$$(openssl rand -hex 24)" "$$(openssl rand -hex 12)" > .env; \
		if [ -n "$(RCLONE_REMOTE)" ]; then printf 'RCLONE_REMOTE=%s\n' '$(RCLONE_REMOTE)' >> .env; fi; \
		echo ".env written (passwords generated, not shown)"

check-env:
	@$(KETAT) [ -f .env ] || { echo "no .env: make env first"; exit 1; }
	@$(KETAT) m=$$(stat -c %a .env 2>/dev/null || stat -f %Lp .env); [ "$$m" = 600 ] || { echo ".env is mode $$m, want 600: chmod 600 .env"; exit 1; }
	@$(KETAT) for k in ERP_IMAGE SITE DB_ROOT_PASSWORD; do \
		grep -Eq "^$$k=.+" .env || { echo ".env: $$k is missing or empty"; exit 1; }; done
	@$(KETAT) img=$$(sed -n 's/^ERP_IMAGE=//p' .env); \
		[[ "$$img" =~ :v[0-9]+\.[0-9]+\.[0-9]+$$ ]] || { echo "ERP_IMAGE must be an exact tag :vX.Y.Z, not $$img"; exit 1; }
	@echo "check-env OK"

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
		done; \
		bench --site "$$SITE" set-config -p erp_produksi 1'

wizard:
	$(TOOLS) 'set -euo pipefail; \
		if bench --site "$$SITE" execute frappe.is_setup_complete | grep -qi true; then echo "wizard done, skipped"; exit 0; fi; \
		kw=$$(python3 -c "import json, os; t = os.environ[\"TAHUN\"]; print(json.dumps({\"args\": { \
			\"language\": \"English\", \"country\": \"Indonesia\", \"timezone\": \"Asia/Jakarta\", \"currency\": \"IDR\", \
			\"company_name\": os.environ[\"COMPANY\"], \"company_abbr\": os.environ[\"ABBR\"], \
			\"chart_of_accounts\": \"Standard\", \"fy_start_date\": f\"{t}-01-01\", \"fy_end_date\": f\"{t}-12-31\", \
			\"setup_demo\": 0}}))"); \
		bench --site "$$SITE" execute frappe.desk.page.setup_wizard.setup_wizard.setup_complete --kwargs "$$kw"'

# Exit 0 when the wizard is done, 1 when not, nothing printed (setup.sh's final message).
wizard-selesai:
	@$(TOOLS) 'bench --site "$$SITE" execute frappe.is_setup_complete 2>/dev/null | grep -qi true'

# Every command here sets a value or rebuilds what migrate builds, so a second run changes nothing. erp_aktif is
# ticked by the wizard's hook (erp_internal.wizard), erp_produksi by `site`.
configure:
	$(TOOLS) 'set -euo pipefail; \
		bench --site "$$SITE" migrate; \
		bench --site "$$SITE" set-config host_name "https://$$SITE"; \
		bench --site "$$SITE" enable-scheduler'

# After the wizard: our setup, the company on Admin/Produksi accounts, and the first time Samuel's data (minutes).
lanjut:
	$(TOOLS) 'bench --site "$$SITE" execute erp_internal.wizard.lanjutkan'

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

backup:
	./cadangan.sh
