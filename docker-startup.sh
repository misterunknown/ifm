#!/bin/sh
set -e

################################################################################
# Adjust ifm configuration according to docker env vars.
# Defaults should match those in ifm.php. See Dockerfile for details.

################################################################################

# Apache gets grumpy about PID files pre-existing
rm -f /usr/local/apache2/logs/httpd.pid

# Start up apache
exec httpd -DFOREGROUND

