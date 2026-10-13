FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY backend ./backend
COPY public ./public
ENV DB_PATH=/app/data/rollrush.sqlite
EXPOSE 8080
CMD ["npm", "start"]
