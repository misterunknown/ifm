# IFM - improved file manager
## contents
 - [about](#about)
 - [features](#features)
 - [requirements](#requirements)
 - [installation](#installation)
 - [security information](#security-information)
 - [keybindings](#keybindings)
 - [configuration](#configuration)
 - [docker](#docker)
 - [screenshots](#screenshots)
 - [issues](#issues)

## About
The IFM is a web-based filemanager, which comes as a single file solution using
HTML5, CSS3, JavaScript and PHP. You can test a [demo
here](https://ifmdemo.gitea.de/).

<a href="https://youtu.be/owJepSas19Y"><img src="https://img.youtube.com/vi/owJepSas19Y/hqdefault.jpg"></a>

The IFM uses the following resources:
* [ACE Editor](https://ace.c9.io)
* [Bootstrap v4](https://getbootstrap.com)
* custom icon set generated with [Fontello](http://fontello.com/)
* [jQuery](https://jquery.com)
* [Mustache](https://mustache.github.io/)

## features
* create/edit files and directories
* copy/move files and directories
* download files and directories
* upload files directly, remotely via URL or per drag & drop
* extract archives (tar, tgz, tar.gz, tar.bz2, zip)
* change permissions
* image preview
* simple authentication (LDAP via `ldap_bind` possible)

## Requirements
* Client
  * HTML5 and CSS3 compatible browser
  * activated javascript
* Server
  * PHP >= 5.6
  * extensions
    * bz2
    * curl (for remote upload)
    * fileinfo
    * json
    * ldap (only if LDAP based authentication is used)
    * mbstring
    * openssl (for remote uploads from https sources)
    * phar
    * posix
    * zip
    * zlib

## Installation
Just download the latest release of the IFM. You can find it
[here](https://github.com/misterunknown/ifm/releases/latest). You can choose
between the CDN version (dependencies like bootstrap, jquery etc. are loaded
via CDN) or the "simple" version, which bundles all these dependencies.

The minified versions (`*.min.php`) are zipped via gzip. These versions are not
recommended; if the filesize of the IFM is an issue for you, consider using the
CDN versions.

## Security information
The IFM is usually locked to it's own directory, so you are not able to go
above. You can change that by setting the `root_dir` in the scripts
[configuration](https://github.com/misterunknown/ifm/wiki/Configuration).

By default, it is not allowed to show or edit the `.htaccess` file. This is
because you can configure the IFM via environment variables. Thus if anyone has
the ability to edit the `.htaccess` file, he could overwrite the active
configuration. [See
also](https://github.com/misterunknown/ifm/wiki/Configuration).

## Key bindings
* <kbd>e</kbd> - edit / extract current file
* <kbd>h</kbd><kbd>j</kbd><kbd>k</kbd><kbd>l</kbd> - vim-style navigation (alternative to arrow keys)
* <kbd>g</kbd> - focus the path input field (i.e. "goto")
* <kbd>r</kbd> - refresh file table
* <kbd>u</kbd> - upload a file
* <kbd>o</kbd> - remote upload a file
* <kbd>a</kbd> - show ajax request dialog
* <kbd>F</kbd> - new file
* <kbd>D</kbd> - new directory
* <kbd>c</kbd><kbd>m</kbd> - show copy/move dialog
* <kbd>/</kbd> - search
* <kbd>a</kbd> - ajax request
* <kbd>n</kbd> - rename file
* <kbd>Space</kbd> - select a highlighted item
* <kbd>Del</kbd> - delete selected files
* <kbd>Enter</kbd> - open a file or change to the directory
* <kbd>Ctrl</kbd>-<kbd>Shift</kbd>-<kbd>f</kbd> - toggle fullscreen ace editor

## Configuration
See [configuration](https://github.com/misterunknown/ifm/wiki/Configuration).
### authentication
See [authentication](https://github.com/misterunknown/ifm/wiki/Authentication).

## Docker
The docker image is based on the official php docker images (alpine version)
and exposes port 80.

### Quickstart
Build the image with this command in the top source dir:

`docker build -t ifm .`

Afterwards you can start the docker container as follows:

`docker run --rm -d --name ifm -p 8080:80 -v /path/to/data:/var/www ifm:latest`

### Specify user/group
By default IFM runs as user www-data (uid/gid 33). If you need to change that,
you can set the UID and GID with the following environment variables:

`docker run ... -e IFM_DOCKER_UID=1000 -e IFM_DOCKER_GID=100 ifm:latest`

### Other configuration
The script is located at `/usr/local/share/webapps/ifm/index.php`. By default
the `root_dir` is set to /var/www, so you can mount any directory at this
location. If you want to bind the corresponding host directory, you can do the
following:

`docker run --rm -i -p "8080:80" -v "/var/www:/var/www" ifm`

The scripts configuration can be changed by adjusting the corresponding
environment variables. For example:

```docker run --rm -i -p "8080:80" -v /var/www:/var/www \
	-e IFM_AUTH=1 -e IFM_AUTH \
	-e IFM_AUTH_SOURCE="admin:$2y$05$LPdE7u/5da/TCE8ZhqQ1o.acuV50HqB3OrHhNwxbXYeWmmZKdQxrC" \
	ifm
```

You can get a complete list of environment variables
[here](https://github.com/misterunknown/ifm/wiki/Configuration#configuration-options).

## screenshots
<a href="https://misterunknown.de/static/ifm_screenshot_desktop_filelist.png"><img src="https://misterunknown.de/static/ifm_screenshot_desktop_filelist.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_mobile_filelist.png"><img src="https://misterunknown.de/static/ifm_screenshot_mobile_filelist.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_desktop_remote_upload.png"><img src="https://misterunknown.de/static/ifm_screenshot_desktop_remote_upload.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_mobile_editfile.png"><img src="https://misterunknown.de/static/ifm_screenshot_mobile_editfile.png" height="300px"></a>

## issues
If you happen to find an error or miss a feature, you can create an issue on
Github.
