# Roznamah production runbook / دليل النشر

Stack: `db` (Postgres 17) · `migrate` (one-shot: migrations + insert-only seed) · `app` (Next.js, behind Traefik) · `worker` (PDF/Chromium, 2 GB) · `backup` (nightly `pg_dump`). Compose project name: `roznamah`. `db` is internal; Traefik (host mode) reaches only `app` via the compose bridge.

المكونات: قاعدة البيانات، ترحيل (مرة واحدة)، التطبيق خلف Traefik، عامل إنشاء PDF، ونسخ احتياطي ليلي. Traefik يعمل بنمط host ويصل إلى `app` عبر شبكة compose الداخلية.

## 1. Prerequisites / المتطلبات

- **Domain / النطاق:** DNS `A` record for `APP_HOST` -> `186.240.150.99`. Wait until it resolves before first start (Let's Encrypt needs it).
- **Email (required, one of two drivers):** all mail (download links, lead notifications, admin magic links) goes through one driver. `EMAIL_FROM` is always required (`docker compose config` refuses to run without it). The app/worker log `CONFIG ERROR` at startup (variable names only) when neither driver is complete.
  - **Microsoft 365 via Microsoft Graph (recommended),** the same integration as the Waves HR system. In Entra ID (Azure AD) register an app, add the Microsoft Graph **application** permission `Mail.Send` and grant admin consent, and create a client secret. Restrict the app to the sender mailbox with an Exchange Online Application Access Policy (otherwise `Mail.Send` lets it send as any mailbox in the tenant):
    ```powershell
    New-DistributionGroup -Name "Roznamah mail senders" -Type Security -Members calendar@yourdomain
    New-ApplicationAccessPolicy -AppId <MS_CLIENT_ID> -PolicyScopeGroupId "Roznamah mail senders" -AccessRight RestrictAccess -Description "Roznamah sends only as calendar@"
    Test-ApplicationAccessPolicy -AppId <MS_CLIENT_ID> -Identity calendar@yourdomain   # AccessCheckResult: Granted
    ```
    Set `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` and `MAIL_GRAPH_SENDER` (the mailbox to send as; empty = the address in `EMAIL_FROM`). With all three `MS_*` set the driver is `graph` automatically (or set `MAIL_DRIVER=graph`); `RESEND_API_KEY` is then not needed. Graph sends **as the mailbox**: recipients see that mailbox's display name from Microsoft 365, not the display name in `EMAIL_FROM`, so name the mailbox accordingly (e.g. "Roznamah | Waves"). `MAIL_SAVE_TO_SENT=true` keeps a copy in its Sent Items (default off, so magic links do not pile up there). The client secret expires (max 24 months in Entra): rotate it before then, or mail stops with `Microsoft login failed: invalid_client` in the logs.
  - **Resend (alternative):** a verified sending domain, `EMAIL_FROM` on that domain (e.g. `Roznamah <no-reply@yourdomain>`) and `RESEND_API_KEY`. Used when the `MS_*` trio is not set (or with `MAIL_DRIVER=resend`).
- **PRIVACY_EMAIL (required):** the address shown on `/privacy` for data-deletion requests (e.g. `privacy@yourdomain`).
- **ADMIN_EMAILS:** comma-separated, lowercase; only these can open `/admin`.
- **Secrets / الأسرار:** generate each separately:
  ```bash
  openssl rand -base64 32   # AUTH_SECRET
  openssl rand -base64 32   # RENDER_SECRET
  openssl rand -hex 24      # POSTGRES_PASSWORD (hex: safe inside the DB URL)
  ```
- **Traefik:** the existing Traefik runs in `network_mode: host` (entrypoints `web`/`websecure`, certresolver `letsencrypt`, ACME http challenge, `exposedbydefault=false`). It reaches `app` over the compose bridge network `roznamah_default`; there is no external Traefik network to join. If the certresolver name differs, set `TRAEFIK_CERTRESOLVER`. Ports 80/443 must be open for the HTTP challenge.
- **Image:** pushed by GitHub Actions to `ghcr.io/<owner>/roznamah` (lowercase). If the package is private, `docker login ghcr.io` on the VPS with a read-only PAT (`read:packages`), or make the package public.
- **Turnstile (required for public launch):** create a Cloudflare Turnstile widget for `APP_HOST` and set **both** `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. The site key is read at request time and server-rendered into the download dialog (no rebuild needed). Leaving both empty turns the check off (private testing only). Setting only one is a misconfiguration: the app logs `CONFIG ERROR` at startup and every download is refused (`captcha_failed`, logged as `[turnstile] refusing download`).
- Optional: `LEAD_NOTIFY_EMAILS`.
- **Render URL:** the worker's Chromium loads `/print/...?key=<RENDER_SECRET>` from `RENDER_BASE_URL`, set to `http://app:3000` in the compose file, so the secret stays on the internal network and never passes through Traefik or its access logs. The worker waits for `app` to be healthy before starting.

## 2. First deploy / النشر الأول

On the VPS, in a new directory (do not touch the other projects):

```bash
mkdir -p /docker/roznamah && cd /docker/roznamah
# copy deploy/docker-compose.prod.yml here as docker-compose.yml, then create .env (chmod 600):
cat > .env <<'EOF'
IMAGE=ghcr.io/<owner>/roznamah:latest
APP_HOST=<domain>
TRAEFIK_CERTRESOLVER=letsencrypt
POSTGRES_PASSWORD=<hex>
AUTH_SECRET=<base64>
RENDER_SECRET=<base64>
ADMIN_EMAILS=<a@x.com,b@x.com>
EMAIL_FROM=Roznamah <calendar@yourdomain>
# Microsoft 365 (recommended); or instead RESEND_API_KEY=<key>
MS_TENANT_ID=<tenant id>
MS_CLIENT_ID=<application (client) id>
MS_CLIENT_SECRET=<client secret value>
MAIL_GRAPH_SENDER=calendar@yourdomain
PRIVACY_EMAIL=privacy@yourdomain
TURNSTILE_SITE_KEY=<site key>
TURNSTILE_SECRET_KEY=<secret key>
EOF
chmod 600 .env
docker compose config >/dev/null      # validates; fails loudly on a missing variable
docker compose up -d
docker compose ps                      # migrate: exited (0); app, worker, db, backup: running
curl -fsS https://<domain>/ -o /dev/null -w '%{http_code}\n'   # 200
```

Via the Hostinger Docker project instead: paste the compose file and set the same variables as the project's environment values. Never commit `.env` or put secrets in the repo.

Then confirm the other projects (odoo, snipe-it, traefik, waves-hr, wsc) are still running with the same container counts.

## 3. Updates / التحديث

```bash
cd /docker/roznamah
docker compose pull                    # IMAGE=...:latest, or edit IMAGE to a specific sha tag
docker compose up -d                   # migrate re-runs (idempotent), then app/worker restart
docker compose logs --tail=50 migrate app worker
```

## 4. Rollback / التراجع

Set `IMAGE=ghcr.io/<owner>/roznamah:<previous-sha>` in `.env`, then `docker compose up -d`. Migrations are forward-only: if a release added a migration that is not backward compatible, restore the DB from the last backup (below) as well.

## 5. Backups and restore / النسخ الاحتياطي والاستعادة

`backup` writes `/data/backups/roznamah-YYYYMMDD-HHMMSS.dump` (custom format) at 03:00 UTC and deletes files older than 14 days. Uploads and generated PDFs live in the same `roznamah-data` volume (`/data/uploads`, `/data/files`); copy them off-host if you need them backed up too.

```bash
# list / copy a backup out
docker compose exec backup ls -lh /data/backups
docker compose cp backup:/data/backups/<file>.dump ./

# manual backup now
docker compose exec backup sh -c 'pg_dump -Fc -f /data/backups/roznamah-manual-$(date +%Y%m%d-%H%M%S).dump'

# restore (replaces current data): stop writers first
docker compose stop app worker
docker compose exec backup sh -c 'pg_restore --clean --if-exists --no-owner -d roznamah /data/backups/<file>.dump'
docker compose start app worker
```

## 6. Logs and health / السجلات

```bash
docker compose logs -f app
docker compose logs -f worker      # expects "[worker] listening for render-download"
docker compose logs backup         # "backup ok: ..." each night
docker compose ps
```

## Notes

- Uploads are limited to 5 MB in the app; Traefik buffering middleware `roznamah-body` caps request bodies at 6 MB.
- Traefik middleware `roznamah-headers` (chained before `roznamah-body`) adds HSTS (1 year, includeSubDomains), `Content-Security-Policy: frame-ancestors 'none'` + `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Content-Type-Options: nosniff`. Check with `curl -sI https://<domain>/`.
- The worker healthcheck file `/tmp/worker-alive` is touched every 30 s only after pg-boss answers a query on the render queue; a worker that lost its database turns `unhealthy`. Look for `[worker] heartbeat:` errors in its log.
- Startup lines `[app] CONFIG ERROR: ...` / `[worker] CONFIG ERROR: ...` name any missing or half-set variable.
- Chromium runs without its sandbox (Playwright default in containers), relying on container isolation; `shm_size: 1gb` avoids shared-memory crashes.
- `worker` runs with `mem_limit: 2g`, `init: true`, `shm_size: 1gb` for Chromium.
- The `migrate` service runs `node worker/dist/migrate.js && node worker/dist/seed.js` (seed is insert-only; admin edits are never overwritten).
