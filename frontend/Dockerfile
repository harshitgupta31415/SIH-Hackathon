# ── Stage 1: Build frontend ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts
COPY frontend/ .
RUN npm run build

# ── Stage 2: Serve with nginx ──────────────────────────────────────
FROM nginx:1.27-alpine AS production

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built frontend assets
COPY --from=builder /build/dist /usr/share/nginx/html

# Security: remove nginx default server tokens
RUN sed -i 's/server_tokens on;/server_tokens off;/g' /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/api/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
