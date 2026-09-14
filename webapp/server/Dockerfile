# Angular client
FROM docker.io/library/node:20-bookworm-slim AS client-build
WORKDIR /repo/appcore
COPY appcore/package*.json ./
RUN npm ci
COPY appcore/ ./
COPY package.json /repo/package.json
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
