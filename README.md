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

## about
The IFM is a web-based filemanager, which comes as a single file solution using HTML5, CSS3, JavaScript and PHP. You can test a [demo here](https://ifmdemo.misterunknown.de/). The credentials are the default credentials: `admin` as username and password.

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

## requirements
* Client
  * HTML5 and CSS3 compatible browser
  * activated javascript
* Server
  * PHP >= 5.5
  * extensions
    * bz2
    * curl (for remote upload)
    * json
    * openssl (for remote uploads from https sources)
    * phar
    * posix
    * zip
    * zlib

## installation
Just copy the ifm.php to your webspace - thats all :)

## security information
The IFM is usually locked to it's own directory, so you are not able to go above. You can change that by setting the `root_dir` in the scripts [configuration](https://github.com/misterunknown/ifm/wiki/Configuration).

By default, it is not allowed to show or edit the `.htaccess` file. This is because you can configure the IFM via environment variables. Thus if anyone has the ability to edit the `.htaccess` file, he could overwrite the active configuration. [See also](https://github.com/misterunknown/ifm/wiki/Configuration).

## key bindings
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

## configuration
See [configuration](https://github.com/misterunknown/ifm/wiki/Configuration).
### authentication
See [authentication](https://github.com/misterunknown/ifm/wiki/Authentication).

## docker

The docker image is based on alpine 3.5 for a small image footprint, with necessary apache, php and supporting packages installed and exposes port 80

### build image
Run the following command from the top source dir:

`docker build -t ifm .`

### run image
The script is installed inside the image at `/var/www/html/index.php`. Its default configuration is unchanged, thus it will display the contents of the document root (`/var/www/html`)

Here is an example of how to start up a container with this image:

`docker run --rm -it -e IFM_AUTH=1 -p "9090:80" -v "/data:/var/www/html/data" ifm`

The script's configuration can be changed by adjusting the corresponding docker environment variables 
listed below:

| PHP config value   | Docker env var             |
| ------------------ | -------------------------- |
| `auth`             | `IFM_AUTH`                 |
| `auth_source`      | `IFM_AUTH_SOURCE`          |
| `root_dir`         | `IFM_ROOT_DIR`             |
| `tmp_dir`          | `IFM_TMP_DIR`              |
| `defaulttimezone`  | `IFM_DEFAULTTIMEZONE`      |
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
Currently there are no known issues. If you find any flaws please let me know.
