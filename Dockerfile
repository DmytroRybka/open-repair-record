# syntax=docker/dockerfile:1
# Open Repair Record, self-hosted: the static site (editor, guide, examples, format) served by an unprivileged nginx.
#   docker build -t open-repair-record-editor .
#   docker run -d -p 8080:8080 --read-only --tmpfs /tmp open-repair-record-editor

# The static files are the same for every platform, so they are built once, natively; only nginx is per platform.
FROM --platform=$BUILDPLATFORM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
RUN node scripts/build-onprem.mjs

FROM nginxinc/nginx-unprivileged:1.27-alpine
LABEL org.opencontainers.image.title="Open Repair Record Editor" \
      org.opencontainers.image.description="Self-hosted Open Repair Record: report editor, guide and format. Static files, no outside requests." \
      org.opencontainers.image.source="https://github.com/DmytroRybka/open-repair-record" \
      org.opencontainers.image.licenses="MIT"
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
