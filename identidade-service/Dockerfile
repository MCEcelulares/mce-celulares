
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/seeders ./seeders
COPY --from=build /app/config ./config
COPY --from=build /app/.sequelizerc ./.sequelizerc
EXPOSE 3001
CMD ["node", "dist/index.js"]
