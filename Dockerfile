# syntax=docker/dockerfile:1.7
# Roznamah production image: Next.js standalone server + tsup-bundled worker, with Chromium for PDFs.
# Keep PLAYWRIGHT_VERSION equal to the locked `playwright` / `@playwright/test` version in package-lock.json.
ARG PLAYWRIGHT_VERSION=1.65.1

# ---- build: install, next build, bundle worker/scripts
FROM node:22-bookworm AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# next build needs DATABASE_URL to be set at import time but never connects during build.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run build && npm run build:worker

# ---- prod-deps: production node_modules (playwright, sharp, ...) for the worker
FROM node:22-bookworm AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: Playwright image already contains Chromium and its system libraries
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads \
    FILES_DIR=/data/files

# Full production node_modules first, then the traced standalone output (its pruned copies win).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/worker/dist ./worker/dist
COPY --from=build /app/drizzle ./drizzle

# /data must exist and belong to pwuser so a fresh named volume inherits that ownership.
RUN mkdir -p /data/uploads /data/files /data/backups \
    && chown -R pwuser:pwuser /data /app
USER pwuser
EXPOSE 3000
CMD ["node", "server.js"]
