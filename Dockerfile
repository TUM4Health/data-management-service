FROM node:14

# Installing libvips-dev for sharp compatability
RUN apt-get update -y && apt-get install libvips-dev -y
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /opt/
COPY ./package.json ./
COPY ./yarn.lock ./
ENV PATH /opt/node_modules/.bin:$PATH
RUN npm i

WORKDIR /opt/app
COPY ./ .

RUN npm run build

EXPOSE 1337

CMD ["npm", "run", "develop"]