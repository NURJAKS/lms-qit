FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-cache
COPY . .
# Backend URL for API rewrites (used at runtime by Next.js server)
ENV BACKEND_URL=http://backend:8000
# Отключаем кеш Next.js при сборке для получения свежих изменений
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
