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

# Install iproute2 for routing configuration
RUN apt-get update && apt-get install -y iproute2 && rm -rf /var/lib/apt/lists/*

# Create entrypoint script to configure routes for external network access
RUN printf '#!/bin/sh\n# Add route for external network (192.168.0.0/24) if running in Docker network\n# Detect gateway from default route\nGATEWAY=$(ip route | grep "^default" | awk '"'{print $3}'"')\nINTERFACE=$(ip route | grep "^default" | awk '"'{print $5}'"')\nif [ -n "$GATEWAY" ] && [ -n "$INTERFACE" ]; then\n  ip route add 192.168.0.0/24 via $GATEWAY dev $INTERFACE 2>/dev/null || true\nfi\n# Execute the main application\nexec "$@"' > /entrypoint.sh && chmod +x /entrypoint.sh

COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/public /app/public
COPY --from=builder /app/.next/static /app/.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

LABEL org.opencontainers.image.source=https://github.com/gsbenevides2/tp-link-center
LABEL org.opencontainers.image.description="TP Link Center is Admin Dashboard to manager my tplink routers."
LABEL org.opencontainers.image.licenses=MIT

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bun", "/app/server.js"]
