FROM node:18

# Crie e defina o diretório de trabalho
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

ENV RABBIT_MQ_URL=amqp://localhost/ \
    REDIS_URL=redis://localhost/ \
    NODE_ENV=production

CMD ["npm", "start"]
