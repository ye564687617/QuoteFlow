FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable \
    && for attempt in 1 2 3 4 5; do \
        corepack install --global pnpm@11.17.0 && break; \
        if [ "$attempt" -eq 5 ]; then exit 1; fi; \
        sleep "$((attempt * 3))"; \
    done \
    && rm -f /etc/apt/apt.conf.d/docker-clean \
    && for attempt in 1 2 3 4 5; do \
        apt-get -o Acquire::Retries=5 update \
        && apt-get -o Acquire::Retries=5 install -y --no-install-recommends openssl ca-certificates \
        && break; \
        if [ "$attempt" -eq 5 ]; then exit 1; fi; \
        sleep "$((attempt * 3))"; \
    done \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV DATABASE_URL=postgresql://quoteflow:quoteflow@postgres:5432/quoteflow?schema=public
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate && pnpm build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable \
    && for attempt in 1 2 3 4 5; do \
        corepack install --global pnpm@11.17.0 && break; \
        if [ "$attempt" -eq 5 ]; then exit 1; fi; \
        sleep "$((attempt * 3))"; \
    done \
    && rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends ca-certificates curl postgresql-common \
    && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
    && for attempt in 1 2 3 4 5; do \
        apt-get -o Acquire::Retries=5 update \
        && apt-get -o Acquire::Retries=5 install -y --no-install-recommends chromium fonts-noto-cjk openssl postgresql-client-16 tar \
        && break; \
        if [ "$attempt" -eq 5 ]; then exit 1; fi; \
        sleep "$((attempt * 3))"; \
    done \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*
WORKDIR /app
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["pnpm", "start"]
