# Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared-types ./packages/shared-types

RUN npm install --prefix apps/frontend

COPY apps/frontend ./apps/frontend

WORKDIR /app/apps/frontend

EXPOSE 3000

CMD ["npm", "run", "dev"]
