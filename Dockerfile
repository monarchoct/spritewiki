FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache fontconfig ttf-dejavu
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . ./

ENV PORT=4173
EXPOSE 4173

CMD ["node", "server.js"]
