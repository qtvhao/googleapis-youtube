FROM ghcr.io/qtvhao/node-20.12.2:main

COPY package.json yarn.lock /app/
RUN yarn

COPY src /app

CMD ["node", "/app/publisher.js"]

