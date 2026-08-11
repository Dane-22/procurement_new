FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=5000

RUN mkdir -p /app/uploads

EXPOSE 5000

CMD ["node", "server.js"]
