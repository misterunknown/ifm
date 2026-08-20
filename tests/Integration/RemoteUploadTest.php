<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * remoteUpload endpoint: SSRF blocking, parameter validation, and a controlled
 * success path (SSRF check disabled, fetching from the test server itself).
 */
class RemoteUploadTest extends IfmServerTestCase
{
    public function testInvalidMethodRejected(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('remoteUpload', [
            'dir' => '.', 'method' => 'magic', 'url' => 'http://1.1.1.1/x',
        ], $token);
        $this->assertErrorStatus($res);
    }

    public function testMissingUrlRejected(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('remoteUpload', [
            'dir' => '.', 'method' => 'file', 'url' => '',
        ], $token);
        $this->assertErrorStatus($res);
    }

    /** Security: SSRF guard blocks loopback targets and writes nothing. */
    public function testSsrfBlocksLoopback(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('remoteUpload', [
            'dir'      => '.',
            'method'   => 'file',
            'url'      => 'http://127.0.0.1/secret',
            'filename' => 'leak.txt',
        ], $token);
        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->sandbox . '/leak.txt');
    }

    public function testRemoteUploadDisabledByConfig(): void
    {
        $this->startServer(['IFM_REMOTEUPLOAD' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('remoteUpload', [
            'dir' => '.', 'method' => 'file', 'url' => 'http://1.1.1.1/x',
        ], $token);
        $this->assertErrorStatus($res);
    }

    /**
     * Success path: with the SSRF check disabled, fetch a known-good URL served
     * by this very test server and store it. Proves the file-method download
     * pipeline works end to end without depending on the public internet.
     */
    public function testFileMethodDownloadsAndStores(): void
    {
        $this->startServer(['IFM_REMOTEUPLOAD_DISABLE_SSRF_CHECK' => '1']);
        $token = $this->bootstrapCsrf();
        $url = $this->baseUri . '/index.php?api=getI18N&lang=en';

        $res = $this->csrfPost('remoteUpload', [
            'dir'      => '.',
            'method'   => 'file',
            'url'      => $url,
            'filename' => 'fetched.json',
        ], $token);

        $this->assertOkStatus($res);
        $this->assertFileExists($this->sandbox . '/fetched.json');
        $this->assertJson(file_get_contents($this->sandbox . '/fetched.json'));
    }
}
