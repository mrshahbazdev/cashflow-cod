# -------- Base --------
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app

# -------- Dependencies --------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/admin/package.json apps/admin/
COPY apps/worker/package.json apps/worker/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/form-schema/package.json packages/form-schema/
COPY packages/couriers/package.json packages/couriers/
COPY packages/messaging/package.json packages/messaging/
COPY packages/pixels/package.json packages/pixels/
RUN pnpm install --frozen-lockfile

# -------- Build --------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @cashflow-cod/admin db:generate
RUN pnpm --filter @cashflow-cod/admin build

# -------- Runner --------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/admin/build ./apps/admin/build
COPY --from=build /app/apps/admin/package.json ./apps/admin/
COPY --from=build /app/apps/admin/prisma ./apps/admin/prisma
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@cashflow-cod/admin", "docker-start"]
