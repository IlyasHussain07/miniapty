FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/

# Install only backend deps
RUN pnpm install --filter backend

# Copy source and config
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/backend/src ./packages/backend/src

# Build
WORKDIR /app/packages/backend
RUN pnpm build

RUN mkdir -p data

EXPOSE 3000

CMD ["node", "dist/server.js"]
