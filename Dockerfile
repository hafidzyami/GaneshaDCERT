# ---- Stage 1: Build ----
# Base image untuk menginstall dependensi dan build source code
FROM node:18-alpine AS builder

# Set working directory di dalam container
WORKDIR /app

# Copy package.json dan package-lock.json (atau yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy sisa source code
COPY . .

RUN npx prisma generate

# Build TypeScript menjadi JavaScript
RUN npm run build

# Hapus devDependencies untuk mengurangi ukuran
RUN npm prune --production

# ---- Stage 2: Production ----
# Base image yang lebih kecil untuk production
FROM node:18-alpine

WORKDIR /app

# Copy hanya file yang dibutuhkan dari stage 'builder'
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Expose port aplikasi
EXPOSE 3000

# Command untuk menjalankan aplikasi
CMD [ "node", "dist/index.js" ]