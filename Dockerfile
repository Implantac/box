# syntax=docker/dockerfile:1
# Nenhuma credencial entra no build ou na imagem. Rebuild é necessário ao mudar modo.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_APP_MODE=portfolio
ENV NEXT_PUBLIC_APP_MODE=${NEXT_PUBLIC_APP_MODE}
ENV APP_MODE=${NEXT_PUBLIC_APP_MODE}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 APP_MODE=portfolio
RUN groupadd --system --gid 1001 box && useradd --system --uid 1001 --gid box box
COPY --from=builder --chown=box:box /app/.next/standalone ./
COPY --from=builder --chown=box:box /app/.next/static ./.next/static
COPY --from=builder --chown=box:box /app/public ./public
USER box
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.js"]
