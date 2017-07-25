FROM alpine:3.5

ENV PHP_INI_DIR /etc/php5

# ensure www-data user exists
RUN set -x \
    && addgroup -g 82 -S www-data \
    && adduser -u 82 -D -S -G www-data www-data
# 82 is the standard uid/gid for "www-data" in Alpine
# http://git.alpinelinux.org/cgit/aports/tree/main/apache2/apache2.pre-install?h=v3.3.2
# http://git.alpinelinux.org/cgit/aports/tree/main/lighttpd/lighttpd.pre-install?h=v3.3.2
# http://git.alpinelinux.org/cgit/aports/tree/main/nginx-initscripts/nginx-initscripts.pre-install?h=v3.3.2

RUN set -xe; \
    apk add --no-cache --virtual .image-runtime-deps \
        bash \
        sed \
        unzip \
        zip \
        curl \
        tar \
        gzip \
        bzip2 \
        xz 

RUN set -xe; \
    apk add --no-cache --virtual .wordpress-runtime-deps \
        apache2 \
        apache2-utils \
        php5-apache2 \
        php5 \
        php5-mcrypt \
        php5-gd \
        php5-intl \
        php5-json \
        php5-curl \
        php5-bz2 \
        php5-zlib \
        php5-posix \
        php5-soap \
        php5-pcntl \
        php5-xml \
        php5-zip

RUN mkdir -p /run/apache2 \
    && mv /var/www/localhost/htdocs /var/www/html \
    && chown -R www-data:www-data /var/www \
    && chmod g+ws /var/www/html \
    && rm /var/www/html/index.html \
    && rm -Rf /var/www/localhost \
    && sed -ri \
        -e 's!^(\s*CustomLog)\s+\S+!\1 /proc/self/fd/1!g' \
        -e 's!^(\s*ErrorLog)\s+\S+!\1 /proc/self/fd/2!g' \
        -e 's!^#LoadModule rewrite_module!LoadModule rewrite_module!' \
        -e 's!/var/www/localhost/htdocs!/var/www/html!g' \
        -e 's!/var/www/localhost!/var/www!g' \
        "/etc/apache2/httpd.conf" \
    && rm /etc/apache2/conf.d/info.conf \
    && rm /etc/apache2/conf.d/userdir.conf \
    && { \
        echo 'ServerTokens Prod'; \
        echo 'ServerSignature Off'; \
        echo 'DocumentRoot "/var/www/html"'; \
        echo '<Directory "/var/www/html">'; \
        echo '    Options None'; \
        echo '    AllowOverride All'; \
        echo '    Require all granted'; \
        echo '</Directory>'; \
    } > /etc/apache2/conf.d/ZZ_ifm

RUN { \
        echo 'date.timezone = "Europe/Berlin"';     \
        echo 'zlib.output_compression = On';        \
        echo 'zlib.output_compression_level = 6';   \  
        echo 'memory_limit = 256M';                 \ 
        echo 'max_execution_time = 120';             \ 
        echo 'upload_max_filesize = 512M';           \
        echo 'post_max_size = 512M';                 \
        echo 'log_errors = On';                     \
        echo 'error_log = "/var/www/php.log"';      \
    } > $PHP_INI_DIR/conf.d/ZZ_ifm.ini 
    
COPY docker/apache2-foreground /usr/local/bin/

COPY ifm.php /var/www/html/index.php

WORKDIR /var/www

EXPOSE 80
CMD ["apache2-foreground"]

