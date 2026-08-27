<?php

namespace IFM\Tests\Support;

use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use PHPUnit\Framework\TestCase;

/**
 * Base class for black-box HTTP integration tests.
 *
 * Each test gets:
 *   - a fresh sandbox directory used as IFM_ROOT_DIR (the jail),
 *   - the ability to boot a php -S instance with a custom IFM_* environment,
 *   - a cookie-aware HTTP client (so session + CSRF flows work),
 *   - helpers to seed fixtures and to drive the auth/CSRF handshake.
 *
 * Negative-test convention (see assertJailIntact / refuteFileExists):
 *   every negative test asserts BOTH the error response AND that the intended
 *   side effect did not happen on disk.
 */
abstract class IfmServerTestCase extends TestCase
{
    /** @var resource|null */
    private $serverProc = null;
    private array $serverPipes = [];
    protected string $baseUri = '';
    protected string $sandbox = '';
    /** Directory deliberately placed OUTSIDE the jail for escape tests. */
    protected string $outside = '';
    protected CookieJar $cookies;
    /** HTTP status of the last apiGet/apiPost/apiUpload response. */
    protected int $lastHttpCode = 0;
    private array $tmpDirs = [];

    protected function setUp(): void
    {
        $this->sandbox = $this->makeTmpDir('ifm-root-');
        $this->outside = $this->makeTmpDir('ifm-outside-');
        $this->cookies = new CookieJar();
    }

    protected function tearDown(): void
    {
        $this->stopServer();
        foreach ($this->tmpDirs as $d) {
            $this->rrmdir($d);
        }
        $this->tmpDirs = [];
    }

    /* ----------------------------------------------------------------- *
     * Server lifecycle
     * ----------------------------------------------------------------- */

    /**
     * Boot the built-in PHP server with the given IFM_* environment merged on
     * top of sane defaults. Returns once the server answers.
     */
    protected function startServer(array $env = []): void
    {
        if ($this->serverProc !== null) {
            $this->stopServer();
        }

        $defaults = [
            'IFM_ROOT_DIR'    => $this->sandbox,
            'IFM_INITIAL_WD'  => $this->sandbox,
            'IFM_LIB_PATH'    => dirname(__DIR__, 2) . '/dist/libifm.php',
            'IFM_AUTH'        => '0',
        ];
        $env = array_merge($defaults, $env);

        $port = $this->findFreePort();
        $host = '127.0.0.1';
        $docroot = dirname(__DIR__) . '/server';

        // Inherit current env (PATH etc.) and overlay our IFM_* values.
        // Allow a few concurrent workers so endpoints that legitimately make a
        // nested HTTP request (e.g. remoteUpload fetching from a test URL) do
        // not deadlock the single-threaded built-in server.
        $childEnv = array_merge($_ENV, getenv(), ['PHP_CLI_SERVER_WORKERS' => '4'], $env);

        $cmd = [
            PHP_BINARY,
            '-d', 'display_errors=0',
            '-d', 'error_reporting=' . E_ALL,
            '-S', "$host:$port",
            '-t', $docroot,
        ];

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $this->serverProc = proc_open($cmd, $descriptors, $this->serverPipes, $docroot, $childEnv);
        if (!is_resource($this->serverProc)) {
            $this->fail('Could not start php built-in server');
        }
        stream_set_blocking($this->serverPipes[1], false);
        stream_set_blocking($this->serverPipes[2], false);

        $this->baseUri = "http://$host:$port";
        $this->waitForServer($host, $port);
    }

    private function stopServer(): void
    {
        if ($this->serverProc === null) {
            return;
        }
        foreach ($this->serverPipes as $p) {
            if (is_resource($p)) {
                fclose($p);
            }
        }
        proc_terminate($this->serverProc);
        // give it a moment, then force kill if needed
        $status = proc_get_status($this->serverProc);
        $deadline = microtime(true) + 2.0;
        while ($status['running'] && microtime(true) < $deadline) {
            usleep(20000);
            $status = proc_get_status($this->serverProc);
        }
        if ($status['running']) {
            proc_terminate($this->serverProc, 9);
        }
        proc_close($this->serverProc);
        $this->serverProc = null;
        $this->serverPipes = [];
    }

    private function findFreePort(): int
    {
        $sock = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if ($sock === false) {
            $this->fail("Cannot allocate a free port: $errstr");
        }
        $name = stream_socket_get_name($sock, false);
        fclose($sock);
        return (int) substr($name, strrpos($name, ':') + 1);
    }

    private function waitForServer(string $host, int $port): void
    {
        $deadline = microtime(true) + 5.0;
        while (microtime(true) < $deadline) {
            $conn = @fsockopen($host, $port, $errno, $errstr, 0.2);
            if ($conn) {
                fclose($conn);
                return;
            }
            // bail out early if the process already died
            $status = proc_get_status($this->serverProc);
            if (!$status['running']) {
                $this->fail('php server exited prematurely: ' . $this->drainServerStderr());
            }
            usleep(30000);
        }
        $this->fail('Timed out waiting for php server. stderr: ' . $this->drainServerStderr());
    }

    private function drainServerStderr(): string
    {
        if (!isset($this->serverPipes[2]) || !is_resource($this->serverPipes[2])) {
            return '';
        }
        return (string) stream_get_contents($this->serverPipes[2]);
    }

    /* ----------------------------------------------------------------- *
     * HTTP client
     * ----------------------------------------------------------------- */

    protected function client(): Client
    {
        return new Client([
            'base_uri'    => $this->baseUri,
            'http_errors' => false,
            'cookies'     => $this->cookies,
            'timeout'     => 15,
        ]);
    }

    /** GET an api endpoint; returns the decoded JSON array. */
    protected function apiGet(string $api, array $query = [], array $headers = []): array
    {
        $resp = $this->client()->get('/index.php', [
            'query'   => array_merge(['api' => $api], $query),
            'headers' => $headers,
        ]);
        $this->lastHttpCode = $resp->getStatusCode();
        return $this->decode($resp->getBody()->getContents());
    }

    /** Raw GET (for download endpoints returning bytes, not JSON). */
    protected function rawGet(string $api, array $query = [], array $headers = [])
    {
        return $this->client()->get('/index.php', [
            'query'   => array_merge(['api' => $api], $query),
            'headers' => $headers,
        ]);
    }

    /** POST an api endpoint as form params; returns decoded JSON. */
    protected function apiPost(string $api, array $form = [], array $headers = []): array
    {
        $resp = $this->client()->post('/index.php', [
            'query'       => ['api' => $api],
            'form_params' => $form,
            'headers'     => $headers,
        ]);
        $this->lastHttpCode = $resp->getStatusCode();
        return $this->decode($resp->getBody()->getContents());
    }

    /**
     * Multipart upload helper. $multipart entries are Guzzle multipart parts;
     * the file part should use name 'file'. Returns decoded JSON.
     */
    protected function apiUpload(array $multipart, array $headers = []): array
    {
        $resp = $this->client()->post('/index.php', [
            'query'     => ['api' => 'upload'],
            'multipart' => $multipart,
            'headers'   => $headers,
        ]);
        $this->lastHttpCode = $resp->getStatusCode();
        return $this->decode($resp->getBody()->getContents());
    }

    protected function decode(string $body): array
    {
        $data = json_decode($body, true);
        if (!is_array($data)) {
            $this->fail("Expected JSON response, got: " . substr($body, 0, 400));
        }
        return $data;
    }

    /* ----------------------------------------------------------------- *
     * Auth / CSRF helpers
     * ----------------------------------------------------------------- */

    /** Basic-auth header for stateless (CSRF-exempt) API access. */
    protected function authHeader(string $user, string $pass): array
    {
        return ['X-IFM-AUTH' => 'Basic ' . base64_encode("$user:$pass")];
    }

    /**
     * Establish a cookie session and fetch the CSRF token.
     * If $login is given, performs a session login first.
     */
    protected function bootstrapCsrf(?array $login = null): string
    {
        if ($login !== null) {
            // session login via checkAuth + POST credentials
            $this->client()->post('/index.php', [
                'query'       => ['api' => 'checkAuth'],
                'form_params' => $login,
            ]);
        }
        $cfg = $this->apiGet('getConfig');
        $this->assertArrayHasKey('csrf_token', $cfg, 'getConfig must expose csrf_token');
        return $cfg['csrf_token'];
    }

    /** POST with the CSRF token attached via header. */
    protected function csrfPost(string $api, array $form, string $token, array $headers = []): array
    {
        return $this->apiPost($api, $form, array_merge(['X-IFM-CSRF' => $token], $headers));
    }

    /* ----------------------------------------------------------------- *
     * Fixture helpers
     * ----------------------------------------------------------------- */

    protected function seedFile(string $relative, string $content = 'hello'): string
    {
        $path = $this->sandbox . '/' . $relative;
        @mkdir(dirname($path), 0777, true);
        file_put_contents($path, $content);
        return $path;
    }

    protected function seedDir(string $relative): string
    {
        $path = $this->sandbox . '/' . $relative;
        @mkdir($path, 0777, true);
        return $path;
    }

    protected function makeTmpDir(string $prefix): string
    {
        $dir = sys_get_temp_dir() . '/' . uniqid($prefix, true);
        mkdir($dir, 0777, true);
        $this->tmpDirs[] = $dir;
        return realpath($dir);
    }

    /* ----------------------------------------------------------------- *
     * Negative-test assertions
     * ----------------------------------------------------------------- */

    protected function assertErrorStatus(array $resp, string $message = ''): void
    {
        $this->assertArrayHasKey('status', $resp, $message ?: 'response should have status');
        $this->assertSame('ERROR', $resp['status'], $message ?: ('expected ERROR, got: ' . json_encode($resp)));
    }

    protected function assertOkStatus(array $resp, string $message = ''): void
    {
        $this->assertArrayHasKey('status', $resp, $message ?: 'response should have status');
        $this->assertSame('OK', $resp['status'], $message ?: ('expected OK, got: ' . json_encode($resp)));
    }

    /** Assert the HTTP status code of the last apiGet/apiPost/apiUpload call. */
    protected function assertHttpCode(int $expected, string $message = ''): void
    {
        $this->assertSame($expected, $this->lastHttpCode, $message ?: "expected HTTP $expected, got $this->lastHttpCode");
    }

    /** Assert a path does NOT exist anywhere (used to prove a write was blocked). */
    protected function refuteFileExists(string $absolutePath, string $message = ''): void
    {
        clearstatcache();
        $this->assertFileDoesNotExist($absolutePath, $message ?: "side effect should have been blocked: $absolutePath");
    }

    /** Assert nothing leaked into the directory outside the jail. */
    protected function assertOutsideUntouched(): void
    {
        clearstatcache();
        $entries = array_diff(scandir($this->outside) ?: [], ['.', '..']);
        $this->assertSame([], array_values($entries), 'jail escape: files appeared outside root_dir: ' . implode(',', $entries));
    }

    private function rrmdir(string $dir): void
    {
        if (!is_dir($dir)) {
            @unlink($dir);
            return;
        }
        foreach (array_diff(scandir($dir) ?: [], ['.', '..']) as $entry) {
            $path = $dir . '/' . $entry;
            if (is_dir($path) && !is_link($path)) {
                $this->rrmdir($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
