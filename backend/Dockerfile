# Debian-based image: Prisma engines need OpenSSL libs (Alpine musl often misses libssl.so.1.1).
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Force Linux query engines into the image. A missing native engine makes Prisma
# fall back to Data Proxy mode and throw P6001 ("URL must start with prisma://").
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x
RUN npx prisma generate \
  && test -n "$(find node_modules/.prisma/client -name 'libquery_engine*' | head -n 1)" \
  && echo "Prisma query engine present"

# Always rebuild dist inside the image (host dist timestamps can skip emit).
RUN rm -rf dist && npx tsc
RUN npm prune --omit=dev && npm cache clean --force

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:4000/api/health || exit 1

CMD ["node", "dist/app.js"]
