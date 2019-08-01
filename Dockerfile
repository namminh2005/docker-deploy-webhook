FROM node:8-alpine
 RUN apk update && \
     apk add docker && \
     apk add bash
#     apk add curl && \
#     apk add py-pip && \
#     apk add python-dev && \
#     apk add libffi-dev && \
#     apk add openssl-dev && \
#     apk add gcc && \
#     apk add libc-dev && \
#     apk add make && \
#     pip install docker-compose

RUN mkdir -p /usr/src/app
COPY index.js /usr/src/app
COPY config.json /usr/src/app
COPY package.json /usr/src/app
COPY npm-shrinkwrap.json /usr/src/app
WORKDIR /usr/src/app
RUN npm install
EXPOSE 80
CMD [ "npm", "start" ]