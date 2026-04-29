FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock* .npmrc ./
RUN bun install --production

COPY . .

EXPOSE 3000

CMD ["bun", "run", "server.js"]
