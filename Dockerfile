# =============================================================================
# Stage 1: Build — compile TypeScript to JavaScript
# =============================================================================
FROM node:20-slim AS build

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build

# Copy package files first (layer caching for deps)
COPY whatsapp-bot/package.json whatsapp-bot/pnpm-lock.yaml ./

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY whatsapp-bot/tsconfig.json ./
COPY whatsapp-bot/src/ ./src/

# Build TypeScript → JavaScript
RUN pnpm build

# =============================================================================
# Stage 2: Production — slim image with only compiled JS
# =============================================================================
FROM node:20-slim AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files and install production deps only
COPY whatsapp-bot/package.json whatsapp-bot/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy compiled JavaScript from build stage
COPY --from=build /build/dist ./dist

# Copy static files (menu, privacy policy, logo)
COPY sesamo-menu.html sesamo-menu.pdf politica-privacidad.html politica-privacidad.pdf Logo.svg ./static/

# Create data directory (will be mounted as volume)
RUN mkdir -p data

# Set environment for static file serving in Docker
ENV STATIC_ROOT="./static"
ENV NODE_ENV="production"
ENV PORT="3000"

EXPOSE 3000

CMD ["node", "dist/index.js"]
