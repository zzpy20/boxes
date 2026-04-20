FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json ./
RUN npm install --omit=dev

# Copy application files
COPY server.js ./
COPY box.js ./
COPY index.html ./
COPY boxes.json ./
COPY api-config.js ./
COPY box/ ./box/

# Data directory (overridden by a named volume at runtime)
RUN mkdir -p /data/files
VOLUME ["/data"]

EXPOSE 3000

ENV PORT=3000
ENV AUTH_TOKEN=changeme
ENV DATA_DIR=/data

CMD ["node", "server.js"]
