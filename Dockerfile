FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production || true
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node","server.js"]
