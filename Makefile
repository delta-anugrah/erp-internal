# ERP Internal on your own computer: the same Docker stack as the server (deploy/server/), on http://localhost:8080,
# with Samuel's real catalog, sales and machines loaded. Needs only Docker (Docker Desktop on a Mac; on Windows,
# Docker Desktop with WSL and this repo cloned inside the WSL Ubuntu terminal). README.md "Run it on your computer".
#
#   make start-local    first setup (10-30 min), afterwards only starts the containers again (seconds)
#   make stop           stop it (the data stays)
#
# Everything local lives in .local/ (git-ignored): .env with generated passwords, the backups folder.
# The server has its own Makefile in deploy/server/.

SHELL := /bin/bash
KETAT := set -euo pipefail;

LOKAL := .local
COMPOSE := docker compose -p erp-local --project-directory $(LOKAL) -f deploy/server/docker-compose.yml
TOOLS := $(COMPOSE) run --rm -T -e COMPANY -e ABBR -e TAHUN tools bash -c
# The image: built here from this repo, unless ERP_IMAGE names a released one (ghcr.io/...:vX.Y.Z, pulled).
ERP_IMAGE ?= erp-internal:local
PORT ?= 8080
COMPANY ?= PT Delta Anugrah
ABBR ?= DAN
TAHUN ?= $(shell date +%Y)
export COMPANY ABBR TAHUN
PORT_ENV = $(or $(shell sed -n 's/^PORT=//p' $(LOKAL)/.env 2>/dev/null),$(PORT))

.DEFAULT_GOAL := help
.PHONY: help start-local setup-local stop update-local check-local env-local image-local configure-local data-local ping-local

help:
	@echo "On your computer (README.md \"Run it on your computer\"):"
	@echo "  make start-local    first setup, later just start again; ends at http://localhost:$(PORT_ENV)"
	@echo "  make stop           stop it; the data stays"
	@echo "  make update-local   after git pull: rebuild the image, then start-local"
	@echo "On the server: make -C deploy/server help"

# The full setup runs until it has succeeded once (.local/siap); after that start-local only starts the containers.
start-local: check-local env-local
	@if [ -f $(LOKAL)/siap ]; then $(COMPOSE) up -d; else $(MAKE) --no-print-directory setup-local; fi
	@$(MAKE) --no-print-directory ping-local
	@if [ ! -f $(LOKAL)/akun-siap ]; then bash -c 'set -euo pipefail; . deploy/server/tanya.sh; . deploy/server/akun.sh; \
		perlu_terminal; tanya_akun; buat_akun "$(COMPOSE)"; touch $(LOKAL)/akun-siap'; fi
	@echo
	@echo "Ready: open http://localhost:$(PORT_ENV) and sign in."

# Every step skips what is done: image, database, site, wizard; migrate and the data loads write only what changed.
setup-local: check-local env-local image-local
	@$(MAKE) --no-print-directory -f deploy/server/Makefile db site wizard COMPOSE='$(COMPOSE)'
	@$(MAKE) --no-print-directory configure-local data-local
	$(COMPOSE) up -d
	@touch $(LOKAL)/siap

stop:
	$(COMPOSE) stop

# The new code: rebuild (or pull again), migrate, reload the data.
update-local: check-local env-local
	@$(MAKE) --no-print-directory setup-local BANGUN=1
	@$(MAKE) --no-print-directory start-local

check-local:
	@$(KETAT) for t in docker openssl curl; do command -v $$t >/dev/null || { echo "missing: $$t (README.md \"Run it on your computer\")"; exit 1; }; done
	@$(KETAT) docker compose version >/dev/null 2>&1 || { echo "missing: docker compose (update Docker Desktop)"; exit 1; }
	@$(KETAT) docker info >/dev/null 2>&1 || { echo "Docker does not answer: start Docker Desktop and try again"; exit 1; }

# Written once; an existing .local/.env is never touched (its passwords belong to the database).
env-local:
	@$(KETAT) if [ -f $(LOKAL)/.env ]; then exit 0; fi; \
		mkdir -p $(LOKAL)/cadangan; umask 077; \
		printf 'ERP_IMAGE=%s\nSITE=erp.localhost\nPORT=%s\nDB_ROOT_PASSWORD=%s\nADMIN_PASSWORD=%s\n' \
			'$(ERP_IMAGE)' '$(PORT)' "$$(openssl rand -hex 24)" "$$(openssl rand -hex 12)" > $(LOKAL)/.env; \
		echo "$(LOKAL)/.env written (passwords generated, not shown)"

# A released image is pulled; the local one is built from this repo when missing (or with BANGUN=1), 10-20 min.
image-local:
	@$(KETAT) img=$$(sed -n 's/^ERP_IMAGE=//p' $(LOKAL)/.env); \
		if [[ "$$img" == */* ]]; then docker pull "$$img"; \
		elif [ -n "$(BANGUN)" ] || ! docker image inspect "$$img" >/dev/null 2>&1; then \
			echo "Building $$img from this repo (the first time takes 10-20 minutes)"; \
			docker build -f deploy/Containerfile --build-arg ERP_SHA="$$(git rev-parse --short HEAD 2>/dev/null || echo local)" -t "$$img" .; \
		fi

# Like the server's `configure`, without its https host name; erp_produksi refuses sample data (real data here).
configure-local:
	$(TOOLS) 'set -euo pipefail; \
		args=$$(python3 -c "import json, os; print(json.dumps([\"Company\", os.environ[\"COMPANY\"], \"erp_aktif\", 1]))"); \
		bench --site "$$SITE" execute frappe.db.set_value --args "$$args"; \
		bench --site "$$SITE" migrate; \
		bench --site "$$SITE" set-config host_name "http://localhost:$$PORT"; \
		bench --site "$$SITE" set-config -p erp_produksi 1; \
		bench --site "$$SITE" enable-scheduler'

# Samuel's catalog and machines, his sales Excel, the item-to-machine list (docs/impor.md); each run writes only
# what changed.
data-local:
	$(TOOLS) 'set -euo pipefail; for m in master penjualan mesin_barang; do \
		bench --site "$$SITE" execute erp_internal.$$m.muat > /dev/null; echo "$$m loaded"; done'

ping-local:
	@$(KETAT) for i in $$(seq 1 60); do \
		curl -fsS http://127.0.0.1:$(PORT_ENV)/api/method/ping 2>/dev/null | grep -q pong && exit 0; \
		sleep 2; done; echo "no answer on http://localhost:$(PORT_ENV) in 2 minutes: $(COMPOSE) logs frontend backend"; exit 1
