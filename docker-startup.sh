#!/bin/sh
set -e

if [ ! -z $IFM_DOCKER_UID ]; then
	if [ -z $IFM_DOCKER_GID ]; then
		export IFM_DOCKER_GID=$IFM_DOCKER_UID
	fi
	if getent passwd $IFM_DOCKER_UID >/dev/null 2>&1; then
		deluser $(getent passwd $IFM_DOCKER_UID | sed "s/:.*//")
	fi
	if ! getent group $IFM_DOCKER_GID >/dev/null 2>&1; then
		addgroup -g $IFM_DOCKER_GID -S ifm
		REAL_GROUP=ifm
	else
		REAL_GROUP=$(getent group $IFM_DOCKER_GID | sed "s/:.*//")
	fi
	adduser -u $IFM_DOCKER_UID -HDG $REAL_GROUP ifm
	sudo -E -u ifm -c "php -S 0:80 -t /usr/local/share/webapps/ifm"
else
	deluser xfs
	deluser www-data
	addgroup -g 33 -S www-data
	adduser -SHD -u 33 -G www-data www-data
	sudo -E -u www-data php -S 0:80 -t /usr/local/share/webapps/ifm
fi

