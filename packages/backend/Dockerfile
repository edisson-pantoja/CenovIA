# Build context = raiz do monorepo (veja fly.toml na raiz)
FROM node:22-alpine AS builder
WORKDIR /app

# Manifests de todos os workspaces (necessário para o npm ci validar o lockfile)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY apps/mobile/package.json apps/mobile/

RUN npm ci --workspace=packages/shared --workspace=packages/backend

COPY packages/shared packages/shared
COPY packages/backend packages/backend

# shared primeiro (gera .d.ts usados pelo backend), depois backend
RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY apps/mobile/package.json apps/mobile/

RUN npm ci --omit=dev --workspace=packages/shared --workspace=packages/backend

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/backend/dist packages/backend/dist

EXPOSE 3001
CMD ["node", "packages/backend/dist/index.js"]
