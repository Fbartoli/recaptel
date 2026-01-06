FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

VOLUME /app/data

ENV TDLIB_DATA_DIR=/app/data/tdlib
ENV DB_PATH=/app/data/recaptel.db

CMD ["node", "dist/index.js", "run"]
