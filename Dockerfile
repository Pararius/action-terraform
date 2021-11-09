FROM node:16
COPY dist dist
ENTRYPOINT [ "node", "/dist/index.js" ]
