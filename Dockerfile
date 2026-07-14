FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache vips dumb-init && \
    addgroup -S app && adduser -S app -G app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER app
ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
