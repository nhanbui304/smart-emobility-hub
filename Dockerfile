# Multi-stage Dockerfile for Smart E-Mobility Hub (Node 24)
FROM node:24-slim AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=./data/prod.db

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --ignore-scripts --include=dev
COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist

WORKDIR /app/server
RUN mkdir -p data
EXPOSE 3000

CMD ["sh", "-c", "npm run db:push && exec npm run start"]
