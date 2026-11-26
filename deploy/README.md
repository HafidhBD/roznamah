# Roznamah production runbook / دليل النشر

Stack: `db` (Postgres 17) · `migrate` (one-shot: migrations + insert-only seed) · `app` (Next.js, behind Traefik) · `worker` (PDF/Chromium, 2 GB) · `backup` (nightly `pg_dump`). Compose project name: `roznamah`. Only `app` joins the Traefik network; `db` is internal.

المكونات: قاعدة البيانات، ترحيل (مرة واحدة)، التطبيق خلف Traefik، عامل إنشاء PDF، ونسخ احتياطي ليلي. فقط `app` يتصل بشبكة Traefik.

## 1. Prerequisites / المتطلبات

- **Domain / النطاق:** DNS `A` record for `APP_HOST` -> `186.240.150.99`. Wait until it resolves before first start (Let's Encrypt needs it).
- **Resend:** a verified sending domain; `EMAIL_FROM` on that domain (e.g. `Roznamah <no-reply@yourdomain>`), and `RESEND_API_KEY`.
- **ADMIN_EMAILS:** comma-separated, lowercase; only these can open `/admin`.
- **Secrets / الأسرار:** generate each separately:
  ```bash
  openssl rand -base64 32   # AUTH_SECRET
  openssl rand -base64 32   # RENDER_SECRET
  openssl rand -hex 24      # POSTGRES_PASSWORD (hex: safe inside the DB URL)
  ```
- **Traefik network name / اسم شبكة Traefik:** read the real value from `/docker/traefik/docker-compose.yml` on the VPS (the network the Traefik service joins, and the certresolver name and `websecure` entrypoint used by the other projects). Set `TRAEFIK_NETWORK` and `TRAEFIK_CERTRESOLVER` accordingly; do not guess.
- **Image:** pushed by GitHub Actions to `ghcr.io/<owner>/roznamah` (lowercase). If the package is private, `docker login ghcr.io` on the VPS with a read-only PAT (`read:packages`), or make the package public.
- Optional: `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`, `LEAD_NOTIFY_EMAILS`.

## 2. First deploy / النشر الأول

On the VPS, in a new directory (do not touch the other projects):

```bash
mkdir -p /docker/roznamah && cd /docker/roznamah
# copy deploy/docker-compose.prod.yml here as docker-compose.yml, then create .env (chmod 600):
cat > .env <<'EOF'
IMAGE=ghcr.io/<owner>/roznamah:latest
APP_HOST=<domain>
TRAEFIK_NETWORK=<name from /docker/traefik/docker-compose.yml>
TRAEFIK_CERTRESOLVER=<resolver name, default letsencrypt>
POSTGRES_PASSWORD=<hex>
AUTH_SECRET=<base64>
RENDER_SECRET=<base64>
ADMIN_EMAILS=<a@x.com,b@x.com>
RESEND_API_KEY=<key>
EMAIL_FROM=Roznamah <no-reply@yourdomain>
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
docker compose logs -f worker      # expects "worker ready"
docker compose logs backup         # "backup ok: ..." each night
docker compose ps
```

## Notes

- Uploads are limited to 5 MB in the app; Traefik buffering middleware `roznamah-body` caps request bodies at 6 MB.
- `worker` runs with `mem_limit: 2g`, `init: true`, `shm_size: 1gb` for Chromium.
- The `migrate` service runs `node worker/dist/migrate.js && node worker/dist/seed.js` (seed is insert-only; admin edits are never overwritten).
