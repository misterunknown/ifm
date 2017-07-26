#!/bin/sh
set -e

################################################################################
# Adjust ifm configuration according to docker env vars.
# Defaults should match those in ifm.php. See Dockerfile for details.

# see http://stackoverflow.com/a/2705678/433558
sed_escape_lhs() {
    echo "$@" | sed 's/[]\/$*.^|[]/\\&/g'
}
sed_escape_rhs() {
    echo "$@" | sed 's/[\/&]/\\&/g'
}
set_config() {
    key=$(sed_escape_lhs "$1")
    value=$(sed_escape_rhs "$2" )
    sed -ri -e "s/\"$key\"[[:space:]]*=>.*$/\"$key\" => $value,/" /var/www/html/index.php
}

# general settings
set_config "auth"               "$IFM_AUTH"
set_config "auth_source"        "'$IFM_AUTH_SOURCE'"
set_config "root_dir"           "'$IFM_ROOT_DIR'"
set_config "tmp_dir"            "'$IFM_TMP_DIR'"
set_config "defaulttimezone"    "'$IFM_DEFAULTTIMEZONE'"
# api controls
set_config "ajaxrequest"        "$IFM_API_AJAXREQUEST"
set_config "chmod"              "$IFM_API_CHMOD"
set_config "copymove"           "$IFM_API_COPYMOVE"
set_config "createdir"          "$IFM_API_CREATEDIR"
set_config "createfile"         "$IFM_API_CREATEFILE"
set_config "edit"               "$IFM_API_EDIT"
set_config "delete"             "$IFM_API_DELETE"
set_config "download"           "$IFM_API_DOWNLOAD"
set_config "extract"            "$IFM_API_EXTRACT"
set_config "upload"             "$IFM_API_UPLOAD"
set_config "remoteupload"       "$IFM_API_REMOTEUPLOAD"
set_config "rename"             "$IFM_API_RENAME"
set_config "zipnload"           "$IFM_API_ZIPNLOAD"
# gui controls
set_config "showlastmodified"   "$IFM_GUI_SHOWLASTMODIFIED"
set_config "showfilesize"       "$IFM_GUI_SHOWFILESIZE"
set_config "showowner"          "$IFM_GUI_SHOWOWNER"
set_config "showgroup"          "$IFM_GUI_SHOWGROUP"
set_config "showpermissions"    "$IFM_GUI_SHOWPERMISSIONS"
set_config "showhtdocs"         "$IFM_GUI_SHOWHTDOCS"
set_config "showhiddenfiles"    "$IFM_GUI_SHOWHIDDENFILES"
set_config "showpath"           "$IFM_GUI_SHOWPATH"


################################################################################

# Apache gets grumpy about PID files pre-existing
rm -f /usr/local/apache2/logs/httpd.pid

# Start up apache
exec httpd -DFOREGROUND

