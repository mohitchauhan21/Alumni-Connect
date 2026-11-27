# Single-container build of the whole app (API + website), for hosts that run one service per app,
# such as Antideploy. deploy/start.mjs runs the API inside the container and the website on $PORT;
# the website proxies /api and /socket.io to the API. (docker-compose.yml is the multi-container setup.)
#
# Background jobs run when the host's scheduler calls POST /api/jobs/:group with CRON_SECRET (the app
# may be stopped between requests, so in-process timers are off).
#
# This image is the hosted demo: it shows the "Try a demo account" panel and runs on purpose-seeded
# demo data (HOSTED_DEMO), with email written to the outbox rather than sent and payments off.

FROM node:22-alpine AS build
WORKDIR /app
# The embedded MongoDB is only for local development; don't download its ~600 MB binary here.
ENV MONGOMS_DISABLE_POSTINSTALL=1 NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY apps/api apps/api
COPY apps/web apps/web
# Baked into the website at build time: where the proxy sends API calls, live chat on the same
# origin, and the demo sign-in panel.
ENV API_URL=http://127.0.0.1:4400 NEXT_PUBLIC_SOCKET_URL=same-origin NEXT_PUBLIC_DEMO_LOGINS=true
RUN npm run build -w apps/api && npm run build -w apps/web
RUN npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    COOKIE_SECURE=true \
    JOBS_IN_PROCESS=false \
    HOSTED_DEMO=true \
    PAYMENT_GATEWAY=off \
    REQUIRE_EMAIL_VERIFICATION=false \
    REQUIRE_STAFF_2FA=false
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web apps/web
COPY deploy/start.mjs deploy/start.mjs
RUN mkdir -p apps/api/uploads apps/api/outbox && chown -R node:node apps/api/uploads apps/api/outbox
USER node
EXPOSE 3000
CMD ["node", "deploy/start.mjs"]
