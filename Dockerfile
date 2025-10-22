# Use Node.js 20 which has better native module support
FROM node:20-bullseye AS builder

WORKDIR /app

# Install build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Force rebuild of native modules
RUN npm cache clean --force
RUN npm ci --force

# Rebuild specific problematic packages
RUN npx --yes @mapbox/node-pre-gyp rebuild -C node_modules/lightningcss

COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Production stage
FROM node:20-bullseye-slim AS runner

WORKDIR /app

RUN groupadd -g 1001 -r nodejs && \
    useradd -r -u 1001 -g nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002 || exit 1

CMD ["npm", "start"]