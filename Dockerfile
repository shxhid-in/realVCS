# Use Node.js 18 LTS (more stable for Google APIs)
FROM node:18.19.0-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Verify that UI components are present
RUN ls -la src/components/ui/ || echo "UI components not found"

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN echo "Starting build process..." && \
    echo "Current directory contents:" && \
    ls -la && \
    echo "Source directory contents:" && \
    ls -la src/ && \
    echo "UI components directory:" && \
    ls -la src/components/ui/ && \
    npm run build

# Create a stage to handle public directory
FROM builder AS public-stage
RUN mkdir -p /app/public || true
RUN if [ -d "/app/public" ] && [ "$(ls -A /app/public)" ]; then \
        echo "Public directory exists and has content"; \
    else \
        echo "Creating empty public directory"; \
        mkdir -p /app/public; \
    fi

# Production image
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public directory (will always exist now)
COPY --from=public-stage --chown=nextjs:nodejs /app/public ./public

# Create necessary directories
RUN mkdir -p .next && chown nextjs:nodejs .next

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start the application
CMD ["node", "server.js"]