# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — Rakshak v3.0 Production Container Build
# Multi-stage, minimal attack surface, non-root user execution
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Dependency resolution and base environment
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production

# Stage 2: Dependencies installation
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts && npx prisma generate && npx prisma generate --schema prisma/schema.postgresql.prisma

# Stage 3: Application build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 4: Production runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user and group
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built artifacts and necessary public assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/services ./services
COPY --from=builder /app/eng.traineddata ./eng.traineddata

# Create cold storage and backup mount points with correct ownership
RUN mkdir -p /app/uploads/raw /app/backups && \
    chown -R nextjs:nodejs /app/uploads /app/backups

USER nextjs

EXPOSE 3000

# Health check probe against local health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
