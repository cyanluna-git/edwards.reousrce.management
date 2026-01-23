# Development stage
FROM node:20-alpine as development

WORKDIR /app

# Install pnpm with fixed version to ensure consistency across OS
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy package files first
COPY package.json pnpm-lock.yaml ./

# Install dependencies with explicit configuration for cross-OS compatibility
RUN pnpm config set node-linker hoisted && \
    pnpm install --no-frozen-lockfile

# Verify vite is installed
RUN test -f node_modules/.bin/vite || { echo "ERROR: vite not found in node_modules"; ls -la node_modules/ | head -20; exit 1; }

# Copy source code (excluding node_modules from .dockerignore)
COPY --chown=node:node . .

# Expose port
EXPOSE 3004

# Start development server using node directly to avoid pnpm path issues
CMD ["node", "node_modules/.bin/vite", "--host", "0.0.0.0", "--port", "3004"]

# Build stage
FROM node:20-alpine as build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm config set node-linker hoisted && \
    pnpm install --no-frozen-lockfile

COPY . .

# Verify vite is available before build
RUN test -f node_modules/.bin/vite || { echo "ERROR: vite not found"; exit 1; }

RUN pnpm build

# Production stage
FROM nginx:alpine as production

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
