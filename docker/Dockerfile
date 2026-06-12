# ═══════════════════════════════════════════
# Stage 1: Build
# ═══════════════════════════════════════════
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Disable husky in CI/Docker (not needed for production builds)
ENV HUSKY=0

# Copy lockfile and package.json for dependency caching
COPY pnpm-lock.yaml package.json .npmrc ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code and build
COPY . .
RUN pnpm run build

# Prune devDependencies
RUN pnpm prune --prod --ignore-scripts --config.confirmModulesPurge=false

# ═══════════════════════════════════════════
# Stage 2: Production
# ═══════════════════════════════════════════
FROM node:22-slim AS production

# Security: non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -m nestjs

WORKDIR /app

# Copy production dependencies and build
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/public ./public

# Default environment variables
ENV NODE_ENV=production
ENV APP_PORT=3000

# Expose port
EXPOSE 3000

# Non-root user
USER nestjs

# Health check — curl is available in node:22-slim (Debian)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/v1/health || exit 1

# Start command
CMD ["node", "dist/main"]
