FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
# Copy package manifests for workspace install
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy full source
COPY . .

# Set NEXT_PUBLIC_API_URL at build time so it is embedded in static files
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build shared first, then web
RUN npm run build -w @importlyai/shared
RUN npm run build -w @importlyai/web

FROM base AS runner
ENV NODE_ENV=production

# Add non-root user
RUN addgroup -g 1001 -S nextjs && adduser -S nextjs -u 1001 -G nextjs

# Copy standalone output from Next.js build
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
