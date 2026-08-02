# --- Stage 1: Builder ---
FROM php:8-cli-alpine AS builder

# add missing dependencies
RUN apk add --no-cache \
    bzip2-dev \
    libzip-dev \
    openldap-dev \
    composer \
    git

# add missing extensions (buildtime)
RUN docker-php-ext-install \
    bz2 \
    ldap \
    zip

WORKDIR /usr/src/ifm
COPY . .

ARG CDN=false

# install composer packages
RUN composer install --optimize-autoloader && \
    if [ "$CDN" = "true" ]; then \
        ./compiler.php --languages=all --cdn && \
        mv dist/cdn.ifm.php dist/ifm.php; \
    else \
        ./compiler.php --languages=all; \
    fi

# --- Stage 2: Runner ---
FROM php:8-cli-alpine AS runner

# add missing dependencies
RUN apk add --no-cache \
    bzip2-dev \
    libzip-dev \
    openldap-dev \
    libcap-utils \
    sudo \
    zip

# add missing extensions (runtime)
RUN docker-php-ext-install \
    bz2 \
    fileinfo \
    ldap \
    opcache \
    posix \
    zip

# only necessary environment variables
ENV IFM_ROOT_DIR="/var/www"    \
    IFM_ROOT_PUBLIC_URL="/www" \
    IFM_TMP_DIR="/tmp"

# allow php binary to bind ports <1000, even if $USER != root
# remove unnecessary users
# sudo: workaround for https://bugzilla.redhat.com/show_bug.cgi?id=1773148
RUN /usr/sbin/setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/php && \
    getent passwd www-data >/dev/null 2>&1 && deluser www-data || true && \
    echo "Set disable_coredump false" > /etc/sudo.conf

# prepare files
RUN rm -rf /var/www/html && \
    mkdir -p /usr/local/share/webapps/ifm && \
    chown -R 33:33 /var/www && \
    ln -s /var/www /usr/local/share/webapps/ifm/www

# copy artifacts from builder
COPY --from=builder /usr/src/ifm/dist/ifm.php /usr/local/share/webapps/ifm/index.php
COPY --from=builder /usr/src/ifm/docker/php.ini /usr/local/share/webapps/ifm/
COPY --from=builder /usr/src/ifm/docker/docker-startup.sh /usr/local/bin/

WORKDIR /usr/local/share/webapps/ifm
EXPOSE 80

RUN chmod +x /usr/local/bin/docker-startup.sh

CMD ["/usr/local/bin/docker-startup.sh"]