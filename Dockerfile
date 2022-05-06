FROM node:14

# Installing libvips-dev for sharp compatability
RUN apt-get update -y && apt-get install libvips-dev -y
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /opt/
COPY ./package.json ./

ENV PATH /opt/node_modules/.bin:$PATH
RUN npm i

WORKDIR /opt/app
COPY ./ .

RUN npm run build

EXPOSE 1337

CMD ["npm", "run", "develop"]



# FROM node:14 AS builder

# ARG NODE_ENV=development
# ENV NODE_ENV=${NODE_ENV}
# ENV PATH /opt/node_modules/.bin:$PATH

# WORKDIR /opt/
# # Installing libvips-dev for sharp compatability
# RUN apt-get update -y && apt-get install libvips-dev -y
# COPY ./package*.json ./
# RUN npm ci

# WORKDIR /opt/app_build
# COPY ./ .
# RUN npm run build

# FROM node:14 AS executer

# WORKDIR /opt/app
# COPY --from=builder /opt/package*.json ./
# COPY --from=builder /opt/node_modules ./
# COPY --from=builder /opt/app_build/build ./
# RUN npm run build

# EXPOSE 1337

# CMD ["npm", "run", "develop"]