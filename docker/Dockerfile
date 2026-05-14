# ═══════════════════════════════════════════
# Stage 1: Build
# ═══════════════════════════════════════════
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Disable husky in CI/Docker (not needed for production builds)
ENV HUSKY=0

# Copy lockfile and package.json for dependency caching
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code and build
COPY . .
RUN pnpm run build

# Prune devDependencies
RUN pnpm prune --prod --ignore-scripts

# ═══════════════════════════════════════════
# Stage 2: Production
# ═══════════════════════════════════════════
FROM node:22-alpine AS production

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy production dependencies and build
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Default environment variables
ENV NODE_ENV=production
ENV APP_PORT=3000

# Expose port
EXPOSE 3000

# Non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/v1/health || exit 1

# Start command
CMD ["node", "dist/main"]
