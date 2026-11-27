# The erp-internal server

Runbook for the production stack. Hosting is decided (DigitalOcean, Samuel 2026-11-23; backups to the admin's PC
and Cloudflare R2: `docs/menunggu-samuel.md`, 2026-11-23 table, item 8). The server is being built (2026-11-27):
droplet in SGP1, address `erp-delta.usaha.ai` (Cloudflare A record, DNS only), image `v0.0.1`, abbreviation `DA`.
Nothing here is shared with BPT or the sawit server.

| File | What |
|---|---|
| `docker-compose.yml` | The stack: configurator, backend, queue, scheduler, websocket, frontend (`127.0.0.1:8080`), MariaDB 11.8.9, two Redis; `tools` (profile `setup`) for one-off bench commands. |
| `.env.example` | The shape of `.env` (chmod 600, written by `make setup` on the server, never in git): `ERP_IMAGE`, `SITE`, `DB_ROOT_PASSWORD`, `ADMIN_PASSWORD` (until the typed password replaces it), `RCLONE_REMOTE` (optional). |
| `Makefile` | The first install as `make` targets (below): one per step; `make setup` runs `setup.sh`; every step skips what is done; no secret in the file. |
| `setup.sh` | `make setup`: the questions (GitHub token, site address, app version, backup destination, setup wizard, accounts), `.env`, then the steps in order, stopping at the first error. Markers `.wizard`, `.akun-siap`, `.siap`. `make akun` (`setup.sh --akun`, after `.siap`): the account checklist again, nothing forced: new passwords (Administrator too, the way back in when nobody can sign in) or new accounts; an existing email must be typed under its own role (another role is refused). |
| `tanya.sh`, `akun.sh`, `wizard.sh` | The terminal questions, shared with `make setup` on a computer (`tools/setup_lokal.sh`): plain prompts with a suggestion, blind passwords, the account checklist, the wizard question and its by-hand instructions. |
| `pemeliharaan.html` | Full-screen maintenance page (Indonesian, one English line; glass card over a slowly moving colour background, light/dark, still and opaque under reduced motion or transparency) that nginx on the host shows on its own 502/503/504 while the stack does not answer; pings `/api/method/ping` every 20 s (the status line shows the last check time) and reloads once it answers. Copied to `/var/www/erp/` (step 3), not used from `~/erp`; a new version only needs the file copied again, no nginx reload. Indonesian on purpose: static, it cannot follow a user's language. |
| `cadangan.sh` | Nightly backup: `bench backup --with-files --compress`, the newest set to `./cadangan` and, when set, `$RCLONE_REMOTE`; sets older than 14 days deleted on both. Without `RCLONE_REMOTE` it says the set stays on the server. Exits non-zero on any failure. |

The image comes from `.github/workflows/ci.yml`: a tag `vX.Y.Z` builds `ghcr.io/delta-anugrah/erp-internal:vX.Y.Z`
from `deploy/Containerfile` (Frappe, ERPNext and HRMS at the tags in `versi.json`), checks it with
`deploy/check_image.sh`, runs every erp_internal test in it (`deploy/ci_tes.sh`) and only then pushes it. The
workflow refuses a tag that is not on `main` or not `v` + `erp_internal.__version__` (the version shown on the login
page and in Settings). Tag only with Abel's approval. `ERP_IMAGE` is always an exact tag, never
`latest`.

## First install

By hand first:

1. **Server.** Ubuntu LTS, 4 GB RAM or more, Docker Engine with the compose plugin, a non-root user `deploy` in the
   `docker` group, `make`. `rclone` only with an off-site backup destination. Time zone:
   `sudo timedatectl set-timezone Asia/Jakarta` (the cron line below is in local time).
2. **DNS.** An `A` record for the address (e.g. `erp-delta.usaha.ai`) to the server. On Cloudflare: DNS only
   (grey cloud), so certbot's HTTP check reaches nginx.
3. **Reverse proxy with TLS** on the host (nginx + certbot, or Caddy). Only 80/443 open; it proxies everything to
   `http://127.0.0.1:8080`, websockets included (`Upgrade`/`Connection` headers), passes `Host` and
   `X-Forwarded-For`, `client_max_body_size 50m`. Then `certbot --nginx -d <address> --redirect`.
   While the stack does not answer, nginx shows `pemeliharaan.html` (a maintenance page that reloads itself once
   `/api/method/ping` answers): copy it to `/var/www/erp/` and add to the `listen 443` server block
   `error_page 502 503 504 /pemeliharaan.html;` and
   `location = /pemeliharaan.html { root /var/www/erp; internal; add_header Cache-Control no-store always; }`
   (on production both lines are in `/etc/nginx/snippets/erp-pemeliharaan.conf`, included there).
   Only nginx's own 502/503/504 (stack down, starting, timed out); no `proxy_intercept_errors`, so the app's own
   errors (validation 417, 403, 500 with its traceback) still reach the user.

Then, as `deploy`, with this folder's files copied into `~/erp`:

```bash
cd ~/erp
make setup
```

`setup.sh` asks (each with a suggestion that Enter takes, each skipped when already answered):

1. GitHub user name and token (`read:packages` only) for `docker login ghcr.io`, on stdin; skipped when already
   signed in. Docker must answer first, else `Docker does not answer for <user>: install Docker and add <user> to
   the docker group (README step 1).` and it stops. A refused token is asked again; any other login error prints
   `Could not reach ghcr.io: <error>` and stops.
2. The site address, exactly as typed in the browser (`https://` and a trailing path are dropped, lower case);
   not a host name, asked again. These answers are checked before `.env` is written: a rerun never asks again.
3. The app version: the newest `vX.Y.Z` tag of the image is suggested (read with the token through `curl -K -`);
   no release yet, no suggestion; asked again unless `vX.Y.Z` (a `v` is added).
4. The backup destination (an rclone remote `name:bucket/path`, a folder starting with `/`) or `skip`; anything
   else is asked again.
5. The setup wizard: automatic (default) or by hand in the browser, the company name and abbreviation (kept in
   `.wizard`, never asked again).
6. The accounts: Administrator's password and, with the automatic wizard, optional Super Admin / Admin / Produksi
   accounts (`akun.sh`, the same checklist as `make setup` on a computer); asked once (`.akun-siap`); later new passwords or accounts: `make akun`.

Then `make env` (from the answers, passwords from `openssl rand`), `langkah` (`check check-env pull db site`),
`wizard configure` (automatic) or `configure` (by hand), the accounts (the generated `ADMIN_PASSWORD` then
leaves `.env`), `lanjut` once the wizard is done (`.lanjut-siap`), `up ping cron`, and the last line: `Ready: https://<address>`, or the by-hand wizard's steps
(Administrator signs in, fills the wizard with the printed values, makes the account that becomes the Super Admin;
then `make setup` again, which makes that account the Super Admin and loads Samuel's data; the background job does it
too, but only after the wizard's own jobs, which can take many minutes). A run that stops halfway goes on where it stopped when run again.
Afterwards: `make backup` and a restore drill (below).

`make help` lists the targets, `make -n langkah` prints the steps' commands. Without questions (a script):
`make env SITE=... ERP_IMAGE=... [RCLONE_REMOTE=...]`, then the targets by name.

What the steps do to the site: `site` makes it with erpnext, hrms and erp_internal and sets `erp_produksi` (real
data; `erp_internal.contoh` refuses sample data). The wizard, however filled, runs `erp_internal.wizard.selesai`
(the `setup_wizard_complete` hook): it ticks the company's `erp_aktif`, keeps the wizard's own account (global
default `erp_wizard_developer`) and queues `lanjutkan`, which runs our setup (warehouses, groups, UOMs, the order
flow, holiday lists, PPN templates, the Role Profiles), makes that account a Super Admin, gives Admin/Produksi accounts
the company, and loads Samuel's catalog, sales and machines once (marker `erp_data_samuel`: a new version never
reloads them; a file lock keeps two runs apart). `setup.sh` also runs `make lanjut` itself once the wizard is done
(`.lanjut-siap`), so a background job that failed after a by-hand wizard is repaired by the next `make setup`.

History: dry run 2026-10-29 with a fake `docker`/`bench`/`crontab`; real run 2026-10-31 on the Mac (image
`erp-internal:v0.0.1`, a fresh site in 8 m 40 s, every step a no-op on a second run), which found two faults, both
fixed: `tools` started before the configurator wrote the Redis config (now `depends_on` it), and a `site` step cut
off halfway left a site without its apps (now each missing app is installed). `bench execute
erp_internal.contoh.buat_contoh` on such a site prints `name 'erp_internal' is not defined`: bench hides the real
refusal ("Sample data is not allowed on a production site"), which a direct call shows.

## New version

1. Abel approves; set `__version__ = "X.Y.Z"` in `erp_internal/__init__.py` (merged to `main`), tag `vX.Y.Z` on
   `main`; wait for the CI run of the tag ("Tes") to pass: only then is the image in GHCR.
2. `make backup` first.
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

`./cadangan` must belong to `deploy`. The `tools` container mounts it, and Docker on Linux makes a missing mount
source as root; `cadangan.sh` then stopped at `chmod 700` ("Operation not permitted", line 29). Since 2026-11-27
`make check` (the first step of `make setup`) makes it first, as `deploy`, and refuses a `./cadangan` owned by
someone else. A server set up before that (v0.0.1) fixes it once:

```bash
cd ~/erp && sudo chown -R deploy: cadangan && ./cadangan.sh
```

A set is three files sharing one prefix: `…-database.sql.gz`, `…-files.tgz`, `…-private-files.tgz`. The site
config (it holds the database password) stays on the server; the encryption key is kept with the secrets (below).

**Monthly restore drill**, on a scratch stack (another folder, another compose project, its own `.env` with
`SITE=erp-pulih.localhost` and `PORT=8081`, which `docker-compose.yml` and `make ping` read), never on production:

```bash
rclone copy "$RCLONE_REMOTE" ./cadangan   # without a remote: copy the set from production's ./cadangan --include '<prefix>-*'
docker compose -p erp-pulih up -d mariadb redis-cache redis-queue configurator
docker compose -p erp-pulih run --rm tools bash -c 'bench new-site "$SITE" --db-root-username root \
  --db-root-password "$DB_ROOT_PASSWORD" --admin-password "$(openssl rand -hex 12)" --mariadb-user-host-login-scope="%" \
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
| `DB_ROOT_PASSWORD` | `~/erp/.env` on the server (chmod 600) | generated there; Abel reads it on the server when needed |
| Administrator's password | typed in `make setup` (a new one: `make akun`), never stored in a file | Abel |
| Site `encryption_key` | `sites/<site>/site_config.json` in the `sites` volume; a copy in Abel's password manager | Abel |
| rclone remote credentials | `~deploy/.config/rclone/rclone.conf` (chmod 600) | Abel |
| GHCR read token | `~deploy/.docker/config.json` | Abel |
| Server SSH | `deploy`'s `authorized_keys` | Abel; Samuel gets his own key if he asks |
| Users' passwords | handed over in person (Task 8) | each user |

## Restore drills

| Date | Source counts (Item / Customer / SLE) | Restored counts | By |
|---|---|---|---|
| 2026-10-31 | local rehearsal, image `erp-internal:v0.0.1`, Samuel's catalog and sales loaded: Item 127, Item Price 164, Sales History 513, Workstation 14 (no customers or stock yet) | the same | Claude (Abel's Mac, not production) |
