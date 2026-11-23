# ERP Internal on your own computer: the same Docker stack as the server (deploy/server/), on http://localhost:8080,
# with Samuel's real catalog, sales and machines loaded. Needs only Docker (Docker Desktop on a Mac; on Windows,
# Docker Desktop with WSL and this repo cloned inside the WSL Ubuntu terminal). README.md "Run it on your computer".
#
#   make setup          once, right after the clone: a few questions (wizard, accounts), then the setup (10-30 min)
#   make up             start it (seconds, no questions). `make start` and `make start-local` are the same
#                       (`start` goes once the real server is live).
#   make down           stop it (the data stays)
#   make dev            for coding: the bench (tools/setup_bench.sh), not this Docker stack
#
# Everything local lives in .local/ (git-ignored): .env with generated passwords, the wizard answer (wizard), the
# markers akun-siap, lanjut-siap and siap, the backups folder. The server has its own Makefile in deploy/server/.

SHELL := /bin/bash
KETAT := set -euo pipefail;

LOKAL := .local
# The compose project; another name (and PORT, ERP_IMAGE) runs a second stack beside the first, e.g. for a test.
PROYEK ?= erp-local
COMPOSE := docker compose -p $(PROYEK) --project-directory $(LOKAL) -f deploy/server/docker-compose.yml
TOOLS := $(COMPOSE) run --rm -T -e COMPANY -e ABBR -e TAHUN tools bash -c
# The image: built here from this repo, unless ERP_IMAGE names a released one (ghcr.io/...:vX.Y.Z, pulled).
ERP_IMAGE ?= erp-internal:local
PORT ?= 8080
COMPANY ?= PT Delta Anugrah
ABBR ?= DAN
TAHUN ?= $(shell date +%Y)
export COMPANY ABBR TAHUN
# The bench of `make dev` (tools/setup_bench.sh makes it).
BENCH ?= $(HOME)/Desktop/Projects/erp-internal-bench
SERVER := $(MAKE) --no-print-directory -f deploy/server/Makefile COMPOSE='$(COMPOSE)'
PORT_ENV = $(or $(shell sed -n 's/^PORT=//p' $(LOKAL)/.env 2>/dev/null),$(PORT))

.DEFAULT_GOAL := help
.PHONY: help setup up start start-local setup-local down update-local check-local env-local image-local configure-local \
	ping-local wizard-selesai lanjut dev

help:
	@echo "On your computer (README.md \"Run it on your computer\"):"
	@echo "  make setup          once, after the clone: a few questions, then the setup (10-30 min)"
	@echo "  make up             start it (http://localhost:$(PORT_ENV)); make start is the same for now"
	@echo "  make down           stop it; the data stays"
	@echo "  make update-local   after git pull: rebuild the image, then start; your data stays"
	@echo "  make dev            code on the bench: Python reloads, JS/CSS rebuild; a DocType change needs bench migrate"
	@echo "On the server: make -C deploy/server help"

up: start-local

# The old name of `up`, kept until the real server is live (Abel 2026-11-04).
start: start-local

# Once, after the clone: tools/setup_lokal.sh asks the questions and runs the whole setup. A setup that stopped
# halfway (no .local/siap) goes on where it stopped, without asking again; a finished one is left alone.
setup: check-local env-local
	@if [ -f $(LOKAL)/siap ]; then \
		echo "Already set up: make up starts it (after a git pull: make update-local)."; \
	else COMPOSE='$(COMPOSE)' tools/setup_lokal.sh; fi

# Only starts the containers; the last line says where to go (or what is left of a wizard filled by hand).
start-local: check-local
	@if [ ! -f $(LOKAL)/siap ]; then \
		echo "Not set up yet: run make setup first (once; it asks a few questions, then sets everything up)."; \
		exit 1; fi
	@$(COMPOSE) up -d && $(MAKE) --no-print-directory ping-local && COMPOSE='$(COMPOSE)' tools/setup_lokal.sh --pesan

# Every step skips what is done: image, database, site, wizard. WIZARD=otomatis (from setup_lokal.sh) also fills the
# wizard; setup_lokal.sh then runs `lanjut` once the wizard is done (Samuel's data, once: never on an update).
setup-local: check-local env-local image-local
	@$(SERVER) db site $(if $(filter otomatis,$(WIZARD)),wizard)
	@$(MAKE) --no-print-directory configure-local
	$(COMPOSE) up -d

# After the wizard: our setup, the wizard's account as Super Admin, Samuel's data the first time (setup_lokal.sh).
lanjut:
	@$(SERVER) lanjut

# Exit 0 when the wizard is done (setup_lokal.sh's last line).
wizard-selesai:
	@$(SERVER) -s wizard-selesai

# Stops the containers (not `docker compose down`: the stack comes back as it was, the data stays either way).
down:
	$(COMPOSE) stop

# The new code: rebuild (or pull again) and migrate. Samuel's data is never reloaded: edits made in the app stay.
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

# Like the server's `configure`, with a local host name. erp_produksi (real data here, sample data refused) is set
# by the server Makefile's `site`, erp_aktif by the wizard's hook.
configure-local:
	$(TOOLS) 'set -euo pipefail; \
		bench --site "$$SITE" migrate; \
		bench --site "$$SITE" set-config host_name "http://localhost:$$PORT"; \
		bench --site "$$SITE" enable-scheduler'

ping-local:
	@$(KETAT) for i in $$(seq 1 60); do \
		curl -fsS http://127.0.0.1:$(PORT_ENV)/api/method/ping 2>/dev/null | grep -q pong && exit 0; \
		sleep 2; done; echo "no answer on http://localhost:$(PORT_ENV) in 2 minutes: $(COMPOSE) logs frontend backend"; exit 1

# Coding on the bench (CLAUDE.md "Commands"): bench start reloads Python and rebuilds JS/CSS by itself.
dev:
	@$(KETAT) [ -d "$(BENCH)/apps/erp_internal" ] || { echo "No bench at $(BENCH): run tools/setup_bench.sh first."; exit 1; }
	@docker start erp-mariadb >/dev/null
	cd "$(BENCH)" && bench start
