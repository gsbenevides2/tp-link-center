# ---- deps ----
FROM oven/bun:latest AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- builder ----
FROM oven/bun:latest AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=G2JJQRhnVO8lj37ZFRmB2/s+nBCVz2dp3OAJ9rQzH7M=
ENV DATABASE_URL="#"
ENV ROUTER_PASSWORD_SECRET="#"

RUN bun run build

# ---- runner ----
FROM oven/bun:latest AS runner
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/public /app/public
COPY --from=builder /app/.next/static /app/.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

LABEL org.opencontainers.image.source=https://github.com/gsbenevides2/tp-link-center
LABEL org.opencontainers.image.description="TP Link Center is Admin Dashboard to manager my tplink routers."
LABEL org.opencontainers.image.licenses=MIT

CMD ["bun", "/app/server.js"]
