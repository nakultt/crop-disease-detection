# PlantGuard web — production image.
#
#   docker build -t plantguard-web .
#   docker run -p 3000:3000 plantguard-web     # optional: --env-file .env.production
#
# Multi-stage: dependencies and the build happen in throwaway stages; the
# final image holds only Next's self-contained server, static assets and the
# model, and runs as an unprivileged user.

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Dependencies -------------------------------------------------------------
FROM base AS deps
# .npmrc carries legacy-peer-deps, which the lockfile was resolved with.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

# --- Build --------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Runtime ------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs  && mkdir -p /app/.data && chown nextjs:nodejs /app/.data

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Holds the generated auth secret when BETTER_AUTH_SECRET is not set.
VOLUME ["/app/.data"]

USER nextjs
EXPOSE 3000

# /api/health checks the database and the model; 503 marks the container
# unhealthy so an orchestrator can restart it or hold traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
