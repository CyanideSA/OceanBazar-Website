FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_ADMIN_API_URL
ENV VITE_ADMIN_API_URL=${VITE_ADMIN_API_URL}

RUN npm run build

# Serve with a lightweight static server
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
