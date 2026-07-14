# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* are baked into the client bundle at BUILD time — the image is
# environment-specific. Pass them as build args from CI (GitHub repo vars).
# BACKEND_INTERNAL_URL is ALSO frozen at build time by Next's rewrites()
# (robots/sitemap proxy) — default to the compose service name.
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_MEDIA_HOSTS
ARG BACKEND_INTERNAL_URL=http://app:3000/api
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_MEDIA_HOSTS=$NEXT_PUBLIC_MEDIA_HOSTS \
    BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init && \
    addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
