# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared-types ./packages/shared-types

RUN npm install --prefix apps/backend

# Copy source
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend

# Prisma generate
RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "start:dev"]
