FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages

# Install ALL workspace dependencies
RUN npm install

WORKDIR /app/apps/frontend

EXPOSE 3000

CMD ["npm", "run", "dev"]
