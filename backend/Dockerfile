FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm install --include=dev && npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]

