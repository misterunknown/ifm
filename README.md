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
* [Bootstrap v3](https://getbootstrap.com)
* custom icon set generated with [Fontello](http://fontello.com/)
* [jQuery](https://jquery.com)
* [Mustache](https://mustache.github.io/)

## features
* create/edit files and directories
* copy/move files and directories
* download files and directories
* upload files directly, via URL or per drag & drop
* extract archives (tar, tgz, tar.gz, tar.bz2, zip)
* change permissions
* image preview

## Requirements
* Client
  * HTML5 and CSS3 compatible browser
  * activated javascript
* Server
  * PHP >= 5.5
  * extensions
    * bz2
    * curl (for remote upload)
    * fileinfo
    * json
    * openssl (for remote uploads from https sources)
    * phar
    * posix
    * zip
    * zlib

## Installation
Just copy the ifm.php to your webspace - thats all :)

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

The scripts configuration can be changed by adjusting the corresponding docker
environment variables listed below:

| PHP config value   | Docker env var             |
| ------------------ | -------------------------- |
| `auth`             | `IFM_AUTH`                 |
| `auth_source`      | `IFM_AUTH_SOURCE`          |
| `root_dir`         | `IFM_ROOT_DIR`             |
| `root_public_url`  | `IFM_ROOT_PUBLIC_URL`      |
| `tmp_dir`          | `IFM_TMP_DIR`              |
| `timezone`         | `IFM_TIMEZONE`             |
| `forbiddenchars`   | `IFM_FORBIDDENCHARS`       |
| `language`         | `IFM_LANGUAGE`             |
| `ajaxrequest`      | `IFM_API_AJAXREQUEST`      |
| `chmod`            | `IFM_API_CHMOD`            |
| `copymove`         | `IFM_API_COPYMOVE`         |
| `createdir`        | `IFM_API_CREATEDIR`        |
| `createfile`       | `IFM_API_CREATEFILE`       |
| `edit`             | `IFM_API_EDIT`             |
| `delete`           | `IFM_API_DELETE`           |
| `download`         | `IFM_API_DOWNLOAD`         |
| `extract`          | `IFM_API_EXTRACT`          |
| `upload`           | `IFM_API_UPLOAD`           |
| `remoteupload`     | `IFM_API_REMOTEUPLOAD`     |
| `rename`           | `IFM_API_RENAME`           |
| `zipnload`         | `IFM_API_ZIPNLOAD`         |
| `showlastmodified` | `IFM_GUI_SHOWLASTMODIFIED` |
| `showfilesize`     | `IFM_GUI_SHOWFILESIZE`     |
| `showowner`        | `IFM_GUI_SHOWOWNER`        |
| `showgroup`        | `IFM_GUI_SHOWGROUP`        |
| `showpermissions`  | `IFM_GUI_SHOWPERMISSIONS`  |
| `showhtdocs`       | `IFM_GUI_SHOWHTDOCS`       |
| `showhiddenfiles`  | `IFM_GUI_SHOWHIDDENFILES`  |
| `showpath`         | `IFM_GUI_SHOWPATH`         |
| `contextmenu`      | `IFM_GUI_CONTEXTMENU`      |

## screenshots
<a href="https://misterunknown.de/static/ifm_screenshot_desktop_filelist.png"><img src="https://misterunknown.de/static/ifm_screenshot_desktop_filelist.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_mobile_filelist.png"><img src="https://misterunknown.de/static/ifm_screenshot_mobile_filelist.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_desktop_remote_upload.png"><img src="https://misterunknown.de/static/ifm_screenshot_desktop_remote_upload.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_mobile_editfile.png"><img src="https://misterunknown.de/static/ifm_screenshot_mobile_editfile.png" height="300px"></a>

## issues
If you happen to find an error or miss a feature, you can create an issue on
Github.
