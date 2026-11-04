FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=3000 WORKER_PORT=3101
EXPOSE 3000 3101
CMD ["npm", "start"]
