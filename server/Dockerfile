FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY schema.sql ./schema.sql
COPY server.mjs ./server.mjs
COPY scripts ./scripts
USER node
EXPOSE 8000
CMD ["node", "server.mjs"]
