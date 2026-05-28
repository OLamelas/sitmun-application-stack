FROM postgis/postgis:18-3.6
USER root
ENV TZ=Europe/Madrid
ENV LANG=es_ES.UTF-8
ENV LC_ALL=es_ES.UTF-8
RUN apt-get update  \
    && apt install -y postgresql-18-tds-fdw postgresql-18-oracle-fdw \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y locales locales-all
RUN sed -i -e 's/# es_ES.UTF-8 UTF-8/es_ES.UTF-8 UTF-8/' /etc/locale.gen \
    && dpkg-reconfigure --frontend=noninteractive locales \
    && update-locale LANG=${LANG} \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
USER postgres
