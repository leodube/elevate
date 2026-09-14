# Multi-stage build: Angular client (webapp-prod config) + Express server,
# combined into one runtime image that serves both from one port.
#
# Build context must be the MONOREPO ROOT (the "elevate" checkout), not
# appcore/ or webapp/server/ individually - this Dockerfile expects both
# as subdirectories of the build context. Example:
#   podman build -t elevate-webapp -f webapp/Dockerfile .
#
# Confirmed against webapp/server's real package.json/tsconfig.json:
#   - build compiles via tsc to dist/, mirroring each file's full path
#     from tsconfig's rootDir (../.. - the repo root) - so the real entry
#     point is dist/webapp/server/src/main.js, not dist/main.js. CMD uses
#     `npm start` rather than hardcoding that path a second time.
#   - tsc needs appcore/modules/ present at ../../appcore/modules/
#     relative to webapp/server/ (see tsconfig's include/paths) - copied
#     explicitly in stage 2, since it wouldn't otherwise be in this
#     stage's build context at all.
#   - bcrypt (a native module - AuthService.verifyCredentials() uses
#     bcrypt.compare()) needs a Debian-based image, not Alpine, to use
#     its prebuilt binary rather than compiling from source against musl.

# Angular client
FROM docker.io/library/node:20-bookworm-slim AS client-build
WORKDIR /repo/appcore
COPY appcore/package*.json ./
RUN npm ci
COPY appcore/ ./
RUN npm run build -- --configuration=webapp-prod
# angular.json's outputPath ("../dist/app/") lands this at /repo/dist/app

# Express server
FROM docker.io/library/node:20-bookworm-slim AS server-build
WORKDIR /repo/webapp/server
COPY webapp/server/package*.json ./
RUN npm ci
COPY webapp/server/ ./
COPY appcore/modules/ /repo/appcore/modules/
COPY --from=client-build /repo/appcore/node_modules /repo/appcore/node_modules
RUN npm run build

# Runtime
FROM docker.io/library/node:20-bookworm-slim
WORKDIR /app

COPY --from=server-build /repo/webapp/server/package*.json ./
RUN npm ci --omit=dev

COPY --from=server-build /repo/webapp/server/dist ./dist
COPY --from=client-build /repo/dist/app ./public

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
