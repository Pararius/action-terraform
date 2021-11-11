FROM node:12-alpine as base

WORKDIR /app

COPY . .

RUN npm install
RUN npm install -g @zeit/ncc

# PRODUCTION-READY STAGE (for dev debugging + if we decide to switch from node12 to docker approach)
FROM node:12-alpine

# re-use changes made in base stage
COPY --from=base /app /app

# working directory
WORKDIR /app

# for development this can be done with `make compile`
RUN npx ncc build index.js -o dist

# remove dependencies after compilation to reduce image size
RUN rm -rf node_modules

# emulate the command executed by GitHub
CMD ["node", "dist/index.js"]
