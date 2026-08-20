# IFM - improved file manager

## Contents

* [about](#about)
* [features](#features)
* [requirements](#requirements)
* [installation](#installation)
* [building](#building)
* [security information](#security-information)
* [keybindings](#keybindings)
* [configuration](#configuration)
* [screenshots](#screenshots)
* [issues](#issues)

## About

The IFM is a web-based filemanager, which comes as a single file solution using HTML5, CSS3, JavaScript and PHP. You can test a [demo here](https://ifmdemo.gitea.de/).

[![IFM](https://img.youtube.com/vi/owJepSas19Y/hqdefault.jpg)](https://youtu.be/owJepSas19Y)

The IFM uses the following resources:

* [ACE Editor](https://ace.c9.io)
* [Bootstrap v4](https://getbootstrap.com)
* [Font Awesome](https://fontawesome.com/)
* [jQuery](https://jquery.com)
* [Mustache](https://mustache.github.io/)

## Features

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
  + HTML5 and CSS3 compatible browser
  + activated javascript
* Server
  + PHP >= 7.0
  + extensions
    - bz2
    - curl (for remote upload)
    - fileinfo
    - json
    - ldap (only if LDAP based authentication is used)
    - mbstring
    - openssl (for remote uploads from https sources)
    - phar
    - posix
    - zip
    - zlib
* Build (only if you build from source — see [Building](#building))
  + [Composer](https://getcomposer.org/) (for the local build)
  + `make` (for the local build)
  + Docker / Docker Compose (for the docker-based builds)

## Installation

IFM can be deployed in three ways. Each maps to one of the three flavours described in [Building](#building) — pick whichever fits your infrastructure.

### Local (from dist files)

Download the latest release from [GitHub Releases](https://github.com/misterunknown/ifm/releases/latest), or build the project yourself ([Building → Local](#local)) — the compiled files land in `./dist`.

You can choose between the CDN version (dependencies like bootstrap, jquery etc. are loaded via CDN) or the bundled version, which inlines all these dependencies. Drop the chosen `*.php` file into a directory served by your PHP-enabled web server.

The minified versions (`*.min.php`) are zipped via gzip. These versions are not recommended; if the filesize of the IFM is an issue for you, consider using the CDN versions.

### Docker

The docker image is based on the official php docker images (alpine version) and exposes port 80. After building the image ([Building → Docker](#docker-1)), start the container:

```bash
docker run --rm -d --name ifm -p 8080:80 -v /path/to/data:/var/www ifm:latest
```

#### Specify user/group

By default IFM runs as user www-data (uid/gid 33). If you need to change that, you can set the UID and GID with the following environment variables:

```bash
docker run ... -e IFM_DOCKER_UID=1000 -e IFM_DOCKER_GID=100 ifm:latest
```

#### Other configuration

The script is located at `/usr/local/share/webapps/ifm/index.php`. By default the `root_dir` is set to /var/www, so you can mount any directory at this location. If you want to bind the corresponding host directory, you can do the following:

```bash
docker run --rm -i -p "8080:80" -v "/var/www:/var/www" ifm
```

The scripts configuration can be changed by adjusting the corresponding environment variables. For example:

```bash
docker run --rm -i -p "8080:80" -v /var/www:/var/www \
  -e IFM_AUTH=1 -e IFM_AUTH \
  -e IFM_AUTH_SOURCE="inline;admin:$2y$05$LPdE7u/5da/TCE8ZhqQ1o.acuV50HqB3OrHhNwxbXYeWmmZKdQxrC" \
  ifm
```

> [!TIP]
> You can get a complete list of environment variables [here](https://github.com/misterunknown/ifm/wiki/Configuration#configuration-options).

### Docker Compose

A `docker-compose.yml` is included for convenience. After building the image ([Building → Docker Compose](#docker-compose-1)) bring the service up:

```bash
docker compose up -d
```

Stop and remove the container with:
```bash
docker compose down
```

> [!NOTE]
> Adjust `ports`, `volumes` and `environment` in `docker-compose.yml` to suit your setup — the default mounts `/tmp` into `/var/www`.

> [!CAUTION]
> The shipped `docker-compose.yml` uses inline authentication with the hard-coded credentials `admin` / `admin` for quick local testing. **Before deploying to production, you must change the authentication method** — either replace the inline credentials with a secure, secret-managed value or switch to a different `IFM_AUTH_SOURCE` (e.g. LDAP). See [Configuration → Authentication](https://github.com/misterunknown/ifm/wiki/Authentication) for the available options.

## Building

You can build IFM from source in three different ways — locally, via Docker, or via Docker Compose. All of them produce the same compiler output; they differ only in how the build environment is set up.

The compiler can produce two flavours of the final single-file PHP script:

* **Bundled** *(default)* — third-party assets (Bootstrap, jQuery, ACE editor, etc.) are inlined into the output. The resulting file is self-contained and works without internet access on the client.
* **CDN** — third-party assets are loaded from public CDNs at runtime. The output file is much smaller, but clients need network access to the CDN hosts.

### Local

Build directly on your machine with Composer and `make`.

#### Install Composer

Build-time dependencies are managed via [Composer](https://getcomposer.org/). To stay independent of your distribution's package manager, install Composer directly with PHP into the project (or somewhere on your `$PATH`):

```bash
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php
php -r "unlink('composer-setup.php');"
```

This produces a local `composer.phar` you can invoke as `php composer.phar <command>`. For an up-to-date installer and signature verification see the [official instructions](https://getcomposer.org/download/).

#### Install dependencies

From the project root:

```bash
php composer.phar install
```

This installs the build-time dependencies declared in `composer.json` into `./vendor`:

* [`matthiasmullie/minify`](https://github.com/matthiasmullie/minify) — JS/CSS minifier used by the compiler
* [`phpstan/phpstan`](https://phpstan.org/) — static analysis used by `make analyse`
* [`phpunit/phpunit`](https://phpunit.de/) & [`guzzlehttp/guzzle`](https://github.com/guzzle/guzzle) — used by the test suite (`make test`)

#### Makefile targets

The `Makefile` wraps the compiler and helper scripts. Run `make help` to see all targets:

| Target              | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `make help`         | List available targets                                     |
| `make analyse`      | Run PHPStan static analysis on `./src`                     |
| `make syntax-check` | Run `php -l` against every tracked `*.php` file            |
| `make test`         | Build dist and run the full PHPUnit suite                  |
| `make build`        | Compile the regular (bundled) dist files into `./dist`     |
| `make build-cdn`    | Compile the CDN dist files into `./dist`                   |
| `make build-all`    | Compile both bundled and CDN flavours                      |
| `make clean`        | Remove the `./dist` directory                              |

You can override the PHP binary with the `PHP` variable, e.g. `make build PHP=/usr/bin/php8.2`.

Build everything in one go:

```bash
make build-all
```

The compiled files land in `./dist`. Use `make clean` to wipe the directory before a fresh build.

### Docker

The `Dockerfile` produces a runnable image with the compiler output already baked in. The `CDN` build argument selects the flavour:

* `CDN=false` *(default)* — bundled build (assets inlined into `index.php`).
* `CDN=true` — CDN build (assets loaded from public CDNs at runtime).

```bash
# bundled (default)
docker build -t ifm .

# CDN
docker build --build-arg CDN=true -t ifm:cdn .
```

See [Installation → Docker](#docker) for how to run the resulting image.

### Docker Compose

`docker-compose.yml` exposes the `CDN` build arg via a `CDN` environment variable so you can toggle the flavour without editing files:

```bash
# bundled build (default)
docker compose build

# CDN build
CDN=true docker compose build

# build + start in one go
CDN=true docker compose up -d --build
```

See [Installation → Docker Compose](#docker-compose) for how to run the resulting service.

### Versioning and releasing

IFM follows [Semantic Versioning](https://semver.org/) with a `v` prefix:
`vMAJOR.MINOR.PATCH` (e.g. `v4.2.0`).

**Git tags are the single source of truth for the version.** The version is no
longer hard-coded; `compiler.php` resolves it at build time, in this order:

1. the `IFM_VERSION` environment variable (used by the release workflow),
2. a `VERSION` file next to `compiler.php` (for source tarballs without git),
3. `git describe --tags --always --dirty` (normal development and tagged builds),
4. `v0.0.0-dev` as a last-resort fallback.

So local/dev builds embed a descriptive version such as
`v4.1.1-9-gb86f1eb-dirty`, while a clean tagged build embeds exactly the tag.

**To cut a release**, just create and push a tag:

```bash
git tag v4.2.0
git push origin v4.2.0
```

The `Release` GitHub Actions workflow (`.github/workflows/release.yml`) then
builds the artifacts with `IFM_VERSION` pinned to the tag, verifies the embedded
version matches, and publishes a GitHub Release with auto-generated notes and
these assets attached: `ifm.php`, `ifm.min.php`, `cdn.ifm.php`,
`cdn.ifm.min.php`. No manual file edits or uploads are required.

## Security information

The IFM is usually locked to it's own directory, so you are not able to go above. You can change that by setting the `root_dir` in the scripts [configuration](https://github.com/misterunknown/ifm/wiki/Configuration).

By default, it is not allowed to show or edit the `.htaccess` file. This is because you can configure the IFM via environment variables. Thus if anyone has the ability to edit the `.htaccess` file, he could overwrite the active configuration.
> [!TIP]
> [See also configuration](https://github.com/misterunknown/ifm/wiki/Configuration).

## Keybindings

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

### Authentication

See [authentication](https://github.com/misterunknown/ifm/wiki/Authentication).

## Screenshots

<a href="https://misterunknown.de/static/ifm_screenshot_desktop_filelist.png"><img src="https://misterunknown.de/static/ifm_screenshot_desktop_filelist.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_mobile_filelist.png"><img src="https://misterunknown.de/static/ifm_screenshot_mobile_filelist.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_desktop_remote_upload.png"><img src="https://misterunknown.de/static/ifm_screenshot_desktop_remote_upload.png" height="300px"></a>
<a href="https://misterunknown.de/static/ifm_screenshot_mobile_editfile.png"><img src="https://misterunknown.de/static/ifm_screenshot_mobile_editfile.png" height="300px"></a>

## Issues

If you happen to find an error or miss a feature, you can create an issue on Github.
