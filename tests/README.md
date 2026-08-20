# IFM API test suite

Comprehensive tests for the IFM HTTP/JSON API (the frontend is intentionally
out of scope). The suite tests the **compiled artifact** (`dist/libifm.php`) that
actually ships, not `src/` directly — the bootstrap rebuilds it automatically
when sources are newer.

## Running

```bash
composer install
make test                 # build dist + run everything
# or directly:
./vendor/bin/phpunit                      # all suites
./vendor/bin/phpunit --testsuite unit
./vendor/bin/phpunit --testsuite integration
./vendor/bin/phpunit --testsuite security
```

Requirements: PHP CLI with `zip`, `phar`, `posix`, `fileinfo`, `curl`, `mbstring`
(and optionally `bz2` — the one tar.bz2 round-trip skips itself if absent).

## Layout

```
tests/
  bootstrap.php              # autoload, (re)build dist/libifm.php, load classes
  server/index.php           # configurable front controller booted by php -S
  Support/
    IfmServerTestCase.php    # boots php -S, sandbox jail, cookie-aware client
    PrivateAccess.php        # reflection helper for white-box unit tests
  Unit/                      # fast, in-process white-box tests
    HtpasswdTest, ArchiveTest, ValidationTest, SsrfTest
  Integration/               # black-box HTTP tests against a real php -S
    SmokeTest, AuthTest, CsrfTest, FilesTest, EditTest, CopyMoveTest,
    UploadDownloadTest, ArchiveApiTest, SearchTest, RemoteUploadTest,
    FeatureFlagTest
  Security/                  # jail-escape / abuse cases (two-part assertions)
    PathJailTest, SelfOverwriteTest, SymlinkLoopTest
```

## Design

**Two layers.**

1. **Integration (primary)** — each test boots PHP's built-in server via
   `proc_open` against `tests/server/index.php`, configured entirely through
   `IFM_*` environment variables (auth on/off, feature flags, a per-test
   sandbox `root_dir`). A Guzzle client with a shared cookie jar reproduces the
   real session + CSRF + Basic-auth flows. This exercises dispatch, auth, CSRF,
   the path jail, and raw byte/stream endpoints (download, zipnload, upload,
   remoteUpload) exactly as in production. `PHP_CLI_SERVER_WORKERS=4` is set so
   endpoints that make a nested HTTP request don't deadlock the dev server.

2. **Unit (complementary)** — loads `dist/libifm.php` in-process and tests pure,
   security-critical logic directly (credential hashing, archive round-trips,
   filename/path validation, SSRF guard), using reflection for private helpers.

## Negative-test convention

Every negative/security test asserts **both**:

1. the API returns `status == ERROR` (or the correct HTTP status), **and**
2. the intended side effect did **not** happen on disk — verified with
   `refuteFileExists()`, `assertOutsideUntouched()`, or by checking that
   protected content/permissions are unchanged.

This guarantees a rejection actually prevented the action rather than merely
returning an error string. The `Security/` suite groups the jail-escape,
traversal, self-overwrite and symlink-loop cases so they can be run in
isolation.
```
