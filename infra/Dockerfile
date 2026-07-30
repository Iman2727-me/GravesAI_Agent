# syntax=docker/dockerfile:1
# Cloud Run container for Thomas API.
# Do not build/push until GCP login exists and you choose to deploy.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY services/thomas-api ./services/thomas-api
RUN npm install --workspace=@thomas/shared --workspace=@thomas/api
RUN npm run build -w @thomas/shared && npm run build -w @thomas/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV THOMAS_MODE=gcp
COPY --from=build /app /app
WORKDIR /app/services/thomas-api
EXPOSE 8080
CMD ["node", "dist/index.js"]
