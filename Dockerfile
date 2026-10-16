# ==============================================================================
# QuickClick / Qlipzync - Production Multi-Stage Dockerfile for Cloud Run
# Stage 1 (builder): Compiles TypeScript, Vite frontend & bundled Express server
# Stage 2 (runner): Ultra-lightweight Node.js production image (0 devDependencies)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compilation Stage
# ------------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . ./

# Build React SPA and bundled Node.js server
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

# Validate compilation artifacts
RUN test -f dist/server.cjs && test -f dist/index.html || (echo "Build error: missing artifacts in dist/" && exit 1)

# ------------------------------------------------------------------------------
# Stage 2: Production Minimal Runner Stage
# ------------------------------------------------------------------------------
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Install runtime SSL certificates & clean cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install production dependencies only (0 devDependencies)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps && \
    npm cache clean --force

# Copy pre-compiled production bundles from builder stage
COPY --from=builder /app/dist ./dist

# Security hardening: Run as non-root user
USER node

# Expose standard Cloud Run port
EXPOSE 3000

# Launch optimized bundled production server
CMD ["node", "dist/server.cjs"]
