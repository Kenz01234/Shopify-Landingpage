# Quest Agent – ein Image für App, Worker und Migration (lokaler Betrieb / VM)
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Nur für den Build gesetzte Platzhalter (nicht im Image gespeichert); echte Werte kommen zur Laufzeit.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-not-a-secret-0000000000 \
    DEMO_MODE=false \
    sh -c "npx prisma generate && npx next build"

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
