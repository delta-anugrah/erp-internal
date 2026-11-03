# The erp-internal server

Runbook for the production stack. The server, domain and off-site bucket wait on Samuel (question 6 in
`docs/menunggu-samuel.md`); until then the stack is only built and tested locally (plan, Task 7). Nothing here is
shared with BPT or the sawit server.

| File | What |
|---|---|
| `docker-compose.yml` | The stack: configurator, backend, queue, scheduler, websocket, frontend (`127.0.0.1:8080`), MariaDB 11.8.9, two Redis; `tools` (profile `setup`) for one-off bench commands. |
| `.env.example` | The shape of `.env` (chmod 600, made on the server, never in git): `ERP_IMAGE`, `SITE`, `DB_ROOT_PASSWORD`, `ADMIN_PASSWORD`, `RCLONE_REMOTE`. |
| `Makefile` | The first install as `make` targets (below): one per step, `make setup` runs them in order and stops on the first error; every step skips what is done; no secret in the file. |
| `cadangan.sh` | Nightly backup: `bench backup --with-files --compress`, the newest set to `./cadangan` and `$RCLONE_REMOTE`, sets older than 14 days deleted on both. Exits non-zero on any failure. |

The image comes from `.github/workflows/image.yml`: a tag `vX.Y.Z` builds `ghcr.io/delta-anugrah/erp-internal:vX.Y.Z`
from `deploy/Containerfile` (Frappe, ERPNext and HRMS at the tags in `versi.json`), checks it with
`deploy/check_image.sh` and pushes it. Tag only with Abel's approval. `ERP_IMAGE` is always an exact tag, never
`latest`.

## First install

**With make** (same steps, from step 5 on; steps 1-4 stay by hand, `check` and `pull` check them). As `deploy` in
`~/erp` with this folder's files copied in:

```bash
make env SITE=erp.<domain> ERP_IMAGE=ghcr.io/delta-anugrah/erp-internal:vX.Y.Z RCLONE_REMOTE=<remote>:<bucket>/erp
make setup COMPANY="PT Delta Anugrah" ABBR=DAN     # check env check-env pull db site wizard configure up ping cron
make backup                                       # then a restore drill (below)
```

`make help` lists the targets; `make -n setup` prints every command without running it. `env` writes `.env` once
(passwords from `openssl rand`, never shown) and never touches an existing one; `site` and `wizard` skip a site
that exists or a finished wizard; `cron` adds its line once. `ping` checks the stack on `127.0.0.1:8080`; the public
`https://` check needs the proxy of step 3. Dry run 2026-10-29 on a Mac with a fake `docker`/`bench`/`crontab`:
every step ran, a second run skipped, a `:latest` image and a mode-644 `.env` were refused, `make setup` stopped at
the first failing step. Real run 2026-10-31 on the Mac (Docker, image `erp-internal:v0.0.1`, steps `env` to `ping` and
`cadangan` (now `backup`); `cek` (now `check`), `pull` and `cron` left out: macOS time zone, a local image, Abel's own crontab): a fresh site in
8 m 40 s, every step a no-op on a second run. It found two faults, both fixed: `tools` started before the
configurator wrote the Redis config (now `depends_on` it), and a `site` step cut off halfway left a site that the
next run skipped without its apps (now each missing app is installed). `bench execute erp_internal.contoh.buat_contoh`
on such a site prints `name 'erp_internal' is not defined`: bench hides the real refusal ("Sample data is not
allowed on a production site"), which a direct call shows.

By hand:

1. **Server.** Ubuntu LTS, 4 GB RAM or more, Docker Engine with the compose plugin, `rclone`, a non-root user
   `deploy` in the `docker` group. Time zone: `sudo timedatectl set-timezone Asia/Jakarta` (the cron line below is
   in local time).
2. **DNS.** An `A` record `erp.<domain>` to the server.
3. **Reverse proxy with TLS** on the host (nginx + certbot, or Caddy). Only 80/443 open; it proxies everything to
   `http://127.0.0.1:8080`, websockets included (`Upgrade`/`Connection` headers), passes `Host` and
   `X-Forwarded-For`, `client_max_body_size 50m`. Then `certbot --nginx -d erp.<domain> --redirect`.
4. **GHCR login** for the private image: `docker login ghcr.io` with an account that reads
   `delta-anugrah/erp-internal` (a token with `read:packages` only).
5. **`.env`**, as `deploy` in `~/erp`, with this folder's files copied in:

   ```bash
   umask 077
   printf 'ERP_IMAGE=ghcr.io/delta-anugrah/erp-internal:v0.1.0\nSITE=erp.<domain>\nDB_ROOT_PASSWORD=%s\nADMIN_PASSWORD=%s\nRCLONE_REMOTE=<remote>:<bucket>/erp\n' \
     "$(openssl rand -hex 24)" "$(openssl rand -hex 12)" > .env
   ```

   The passwords are generated here and never typed, printed or pasted.
6. **Up, then the site.**

   ```bash
   docker compose pull
   docker compose up -d mariadb redis-cache redis-queue configurator
   docker compose run --rm tools bash -c 'bench new-site "$SITE" --db-root-username root \
     --db-root-password "$DB_ROOT_PASSWORD" --admin-password "$ADMIN_PASSWORD" \
     --mariadb-user-host-login-scope="%" --install-app erpnext --install-app hrms --install-app erp_internal'
   ```

   `--mariadb-user-host-login-scope="%"`: otherwise the site's database user is bound to the container's IP, which
   changes on restart.
7. **Wizard**, in the same `tools` container (the values Task 8 confirms with Samuel; dev uses PT Delta Anugrah,
   CPL): English, Indonesia, Asia/Jakarta, IDR, chart "Standard", fiscal year January to December, Administrator
   only.

   ```bash
   docker compose run --rm tools bash -c 'bench --site "$SITE" execute \
     frappe.desk.page.setup_wizard.setup_wizard.setup_complete --kwargs "{\"args\": {\"language\": \"English\",
     \"country\": \"Indonesia\", \"timezone\": \"Asia/Jakarta\", \"currency\": \"IDR\", \"company_name\": \"<name>\",
     \"company_abbr\": \"<ABC>\", \"chart_of_accounts\": \"Standard\", \"fy_start_date\": \"2026-01-01\",
     \"fy_end_date\": \"2026-12-31\", \"setup_demo\": 0}}"'
   ```

8. **Mark the company, then migrate.** One company (PT Delta Anugrah, `DAN`) runs the factory and the office; with
   `erp_aktif` ticked, `migrate` builds its warehouses, groups, UOMs, the order flow, holiday lists and the PPN
   templates, never the default (`erp_internal/setup.py`). `erp_produksi` makes `erp_internal.contoh` refuse to
   put sample data on this site:

   ```bash
   docker compose run --rm tools bash -c 'bench --site "$SITE" execute frappe.db.set_value \
       --args "[\"Company\", \"<name>\", \"erp_aktif\", 1]" \
     && bench --site "$SITE" migrate \
     && bench --site "$SITE" set-config host_name "https://$SITE" \
     && bench --site "$SITE" set-config -p erp_produksi 1 \
     && bench --site "$SITE" enable-scheduler'
   docker compose up -d
   curl -fsS https://erp.<domain>/api/method/ping   # {"message":"pong"}
   ```

9. **Backups**: the cron line below, then one run by hand and a restore drill.

## New version

1. Abel approves; tag `vX.Y.Z` on `main`; wait for the image workflow to pass.
2. `cadangan.sh` by hand first.
3. Set `ERP_IMAGE` in `.env` to the new tag, then:

   ```bash
   docker compose pull && docker compose up -d
   docker compose run --rm tools bash -c 'bench --site "$SITE" migrate'
   ```

4. Rolling back: the previous tag in `ERP_IMAGE`, `up -d`, and restore the backup from step 2 if migrate changed the
   schema.

## Backup and restore

Cron, as `deploy` (`crontab -e`), daily at 02:00 WIB:

```cron
0 2 * * * cd /home/deploy/erp && ./cadangan.sh >> cadangan.log 2>&1
```

A set is three files sharing one prefix: `…-database.sql.gz`, `…-files.tgz`, `…-private-files.tgz`. The site
config (it holds the database password) stays on the server; the encryption key is kept with the secrets (below).

**Monthly restore drill**, on a scratch stack (another folder, another compose project, its own `.env` with
`SITE=erp-pulih.localhost` and `PORT=8081`, which `docker-compose.yml` and `make ping` read), never on production:

```bash
rclone copy "$RCLONE_REMOTE" ./cadangan --include '<prefix>-*'
docker compose -p erp-pulih up -d mariadb redis-cache redis-queue configurator
docker compose -p erp-pulih run --rm tools bash -c 'bench new-site "$SITE" --db-root-username root \
  --db-root-password "$DB_ROOT_PASSWORD" --admin-password "$ADMIN_PASSWORD" --mariadb-user-host-login-scope="%" \
  && bench --site "$SITE" restore /home/frappe/cadangan/<prefix>-database.sql.gz \
     --with-public-files /home/frappe/cadangan/<prefix>-files.tgz \
     --with-private-files /home/frappe/cadangan/<prefix>-private-files.tgz \
     --db-root-username root --db-root-password "$DB_ROOT_PASSWORD" \
  && bench --site "$SITE" set-config encryption_key "<from the secrets store>" \
  && bench --site "$SITE" migrate'
docker compose -p erp-pulih up -d
make ping   # or: curl -fsS -H "Host: erp-pulih.localhost" http://127.0.0.1:8081/api/method/ping
```

Pass when `ping` answers and `frappe.db.count("Item")` (and Customer, Stock Ledger Entry) equal the source's. Write
the date and the counts at the end of this file. Then `docker compose -p erp-pulih down -v`.

## Secrets: who holds what

| Secret | Where | Who |
|---|---|---|
| `DB_ROOT_PASSWORD`, `ADMIN_PASSWORD` | `~/erp/.env` on the server (chmod 600) | generated there; Abel reads them on the server when needed |
| Site `encryption_key` | `sites/<site>/site_config.json` in the `sites` volume; a copy in Abel's password manager | Abel |
| rclone remote credentials | `~deploy/.config/rclone/rclone.conf` (chmod 600) | Abel |
| GHCR read token | `~deploy/.docker/config.json` | Abel |
| Server SSH | `deploy`'s `authorized_keys` | Abel; Samuel gets his own key if he asks |
| Users' passwords | handed over in person (Task 8) | each user |

## Restore drills

| Date | Source counts (Item / Customer / SLE) | Restored counts | By |
|---|---|---|---|
| 2026-10-31 | local rehearsal, image `erp-internal:v0.0.1`, Samuel's catalog and sales loaded: Item 127, Item Price 164, Sales History 513, Workstation 14 (no customers or stock yet) | the same | Claude (Abel's Mac, not production) |
