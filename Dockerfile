FROM node:14

# Installing libvips-dev for sharp compatability
RUN apt-get update -y && apt-get install libvips-dev -y
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

ENV PATH /opt/node_modules/.bin:$PATH
COPY ./ .
RUN npm i
RUN npm run build

EXPOSE 1337

CMD ["npm", "run", "develop"]