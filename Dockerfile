FROM node:12-alpine as base

WORKDIR /app

COPY . .

RUN npm install --production

RUN npm install -g @zeit/ncc

RUN ncc build index.js -o dist # can be repeated later with `make compile`

RUN rm -rf node_modules # remove unnecessary files if we decide to use this in production

CMD ["node", "dist/index.js"]
