FROM node:20-alpine

WORKDIR /app

# Copy root files for workspaces
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages

# Install ALL workspace dependencies
RUN npm install

WORKDIR /app/apps/backend

# Prisma generate
RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "start:dev"]
