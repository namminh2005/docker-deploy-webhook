FROM node:8-alpine
RUN apk update && \
     apk add docker
RUN apk add --no-cache --upgrade bash

RUN mkdir -p /usr/src/app

COPY index.js /usr/src/app
COPY conf/. /usr/src/app/conf/
COPY package.json /usr/src/app
COPY default-conf.json /usr/src/app
COPY npm-shrinkwrap.json /usr/src/app
COPY sh/. /usr/src/app/sh

WORKDIR /usr/src/app

# launcher
RUN ["chmod", "+x", "/usr/src/app/sh/launcher.sh"]
ENTRYPOINT [ "/usr/src/app/sh/launcher.sh" ]

EXPOSE 80
CMD [ "" ]