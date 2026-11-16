#!/usr/bin/env bash
#
# Smoke test for the IFM docker image: starts containers the way the README
# and docker-compose.yml do and checks the essential functions via the API.
#
# usage: tests/docker/smoke-test.sh <image> [regular|cdn] [expected version]
#
# Needs docker, curl and jq on the host; everything else (e.g. creating and
# inspecting zip archives) runs inside the image under test.

# the PHP snippets below are meant to be passed literally
# shellcheck disable=SC2016
set -euo pipefail

image=${1:?usage: $0 <image> [regular|cdn] [expected version]}
variant=${2:-regular}
version=${3:-}
case "$variant" in regular|cdn) ;; *) echo "unknown variant: $variant" >&2; exit 2;; esac

work=$(mktemp -d)
data="$work/data"
jar="$work/cookies"
container=""
failed=1

cleanup() {
	if [ "$failed" = 1 ] && [ -n "$container" ]; then
		echo "--- container log ($container):" >&2
		docker logs "$container" 2>&1 | tail -n 30 >&2 || true
	fi
	[ -z "$container" ] || docker rm -f "$container" >/dev/null 2>&1 || true
	rm -rf "$work"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok - $*"; }

# run PHP inside the image as the current user, with the data dir at /data
image_php() {
	docker run --rm --user "$(id -u):$(id -g)" -v "$data:/data" -w /data "$image" php -r "$1"
}

# start a container with the given extra arguments, wait until it serves
# requests and set $base to its URL
start() {
	container="ifm-smoke-$$-$RANDOM"
	docker run -d --name "$container" -p 127.0.0.1::80 "$@" "$image" >/dev/null
	local port
	for _ in $(seq 1 30); do
		port=$(docker port "$container" 80/tcp 2>/dev/null | head -n 1 || true)
		if [ -n "$port" ] && curl -fs -o /dev/null "http://$port/"; then
			base="http://$port/"
			return 0
		fi
		if [ "$(docker inspect -f '{{.State.Running}}' "$container")" != true ]; then
			fail "container exited during startup"
		fi
		sleep 1
	done
	fail "container did not answer within 30 seconds"
}

stop() {
	docker rm -f "$container" >/dev/null
	container=""
}

api() { curl -fsS -b "$jar" -c "$jar" "$@"; }

# --- fixtures ---------------------------------------------------------------

mkdir -p "$data/sub"
echo "hello world" > "$data/hello.txt"
echo "user:secret" > "$data/.htpasswd"
echo "ok" > "$data/sub/ok.txt"
echo "Deny from all" > "$data/sub/.htaccess"
image_php '$z = new ZipArchive; $z->open("site.zip", ZipArchive::CREATE);
	$z->addFromString("site/index.html", "<h1>hi</h1>");
	$z->addFromString("site/.htaccess", "php_value auto_prepend_file x.php");
	$z->close();'

# --- 1. default start, as in the README (no IFM_DOCKER_UID) ------------------

start -v "$data:/var/www:ro"
files=$(api "${base}?api=getFiles&dir=")
jq -e 'map(.name) | index("hello.txt")' <<<"$files" >/dev/null || fail "default start: file listing: $files"
ok "default start (no IFM_DOCKER_UID) serves the file listing"
stop

# --- 2. start with UID/GID mapping, as in docker-compose.yml ------------------

start -v "$data:/var/www" -e IFM_DOCKER_UID="$(id -u)" -e IFM_DOCKER_GID="$(id -g)"

page=$(api "$base")
grep -q "<title>IFM - improved file manager</title>" <<<"$page" || fail "UI page"
if [ "$variant" = cdn ]; then
	grep -q "cdnjs.cloudflare.com" <<<"$page" || fail "CDN variant must load its assets from CDNs"
else
	! grep -q "cdnjs.cloudflare.com" <<<"$page" || fail "regular variant must not load assets from CDNs"
fi
ok "UI page ($variant variant)"

if [ -n "$version" ]; then
	shown=$(api "${base}?api=getTemplates" | jq -r '.footer + .app' | grep -o "releases/tag/[^']*" | head -n 1)
	[ "$shown" = "releases/tag/$version" ] || fail "UI must show version $version, shows: ${shown#releases/tag/}"
	ok "version $version"
fi

[ "$(api "${base}?api=getI18N&lang=de" | jq -r .extract)" = "Entpacken" ] || fail "german translation missing"
ok "all languages included"

docker exec "$container" sh -c 'command -v zip' >/dev/null || fail "zip binary missing in the image"
ok "system zip available"

files=$(api "${base}?api=getFiles&dir=")
names=$(jq -r 'map(.name) | sort | join(",")' <<<"$files")
[ "$names" = "hello.txt,site.zip,sub" ] || fail "file listing: $names"
ok "file listing (protected files hidden)"

[ "$(api "${base}?api=download&dir=&filename=hello.txt")" = "hello world" ] || fail "download"
ok "download"

res=$(curl -sS -b "$jar" -c "$jar" -d "api=createDir&dir=&dirname=nocsrf" "$base")
[ "$(jq -r .status <<<"$res")" = ERROR ] && [ ! -e "$data/nocsrf" ] || fail "createDir without CSRF token: $res"
token=$(api "${base}?api=getConfig" | jq -r .csrf_token)
res=$(api -H "X-IFM-CSRF: $token" -d "api=createDir&dir=&dirname=created" "$base")
[ "$(jq -r .status <<<"$res")" = OK ] || fail "createDir: $res"
[ -d "$data/created" ] || fail "created directory missing on the host"
[ "$(stat -c %u "$data/created")" = "$(id -u)" ] || fail "created directory is not owned by IFM_DOCKER_UID"
ok "session + CSRF protected write, owned by IFM_DOCKER_UID"

api -o "$data/download.zip" "${base}?api=zipnload&dir=&filename=sub"
entries=$(image_php '$z = new ZipArchive; $z->open("download.zip"); for ($i = 0; $i < $z->numFiles; $i++) echo $z->getNameIndex($i), " ";')
grep -q "sub/ok.txt" <<<"$entries" || fail "zipnload: $entries"
! grep -q "htaccess" <<<"$entries" || fail "zipnload must not include protected files: $entries"
ok "zipnload (protected files excluded)"

res=$(api -H "X-IFM-CSRF: $token" -d "api=extract&dir=&filename=site.zip&targetdir=" "$base")
[ "$(jq -r .status <<<"$res")" = OK ] || fail "extract: $res"
[ -f "$data/site/index.html" ] || fail "extract: index.html missing"
[ ! -e "$data/site/.htaccess" ] || fail "extract must skip .htaccess"
jq -e '.warning | contains(".htaccess")' <<<"$res" >/dev/null || fail "extract must report the skipped entry: $res"
ok "extract (protected entries skipped and reported)"

stop
failed=0
echo "all smoke tests passed ($image, $variant)"
