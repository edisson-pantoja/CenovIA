FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace package and lock files (if you use monorepo workspace)
# We assume standalone for this build stage based on instructions, but typical monorepos need root lockfile
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
