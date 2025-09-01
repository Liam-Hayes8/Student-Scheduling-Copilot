FROM node:18-bullseye-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# System deps for Prisma (OpenSSL 1.1 on Debian bullseye)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl libssl1.1 \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (handle peer deps in CI image)
RUN npm config set legacy-peer-deps true \
  && npm install --no-audit --no-fund

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Expose Cloud Run port
EXPOSE 8080

ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]