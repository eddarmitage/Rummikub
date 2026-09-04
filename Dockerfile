# Standalone, no-auth Docker image (issue #46) — for self-hosting outside Cloudflare. Builds
# the frontend and the standalone Node harness (src/standalone/server.ts), which serves the
# same Hono app/routes the Cloudflare Worker does, backed by a local SQLite file instead of D1.
# See README "Docker (self-hosted, no-auth)".

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:standalone

FROM node:24-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist/client ./dist/client
COPY --from=build /app/dist/standalone ./dist/standalone
COPY --from=build /app/migrations ./migrations

ENV PORT=8080
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 8080

CMD ["node", "dist/standalone/server.mjs"]
