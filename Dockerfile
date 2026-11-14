# Purpose: one image for the web container. The worker (S-12) uses the same image with another command.
# Rules: standards/versions.md (Node 26 Active LTS, pnpm pinned). No secret is baked in. Values come from the runtime environment.
# Node 26 does not ship corepack, so pnpm is installed with npm at the version in package.json.
FROM node:26-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.18.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm exec prisma generate --generator client
# next build reads src/lib/env.ts. This is a throwaway build value, not a runtime secret.
ENV APP_ORIGIN=http://localhost:3000
RUN pnpm run build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS run
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/generated ./generated
COPY package.json next.config.ts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/next", "start"]
