<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Binary I/O endpoints: upload (multipart), download, proxy, zipnload.
 * These exercise raw byte/header output rather than JSON.
 */
class UploadDownloadTest extends IfmServerTestCase
{
    public function testUploadStoresFile(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->apiUpload([
            ['name' => 'dir', 'contents' => '.'],
            ['name' => 'csrf_token', 'contents' => $token],
            ['name' => 'file', 'contents' => 'uploaded-bytes', 'filename' => 'up.txt'],
        ], ['X-IFM-CSRF' => $token]);

        $this->assertOkStatus($res);
        $this->assertSame('uploaded-bytes', file_get_contents($this->sandbox . '/up.txt'));
    }

    public function testUploadWithRenamedTarget(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->apiUpload([
            ['name' => 'dir', 'contents' => '.'],
            ['name' => 'csrf_token', 'contents' => $token],
            ['name' => 'newfilename', 'contents' => 'renamed.txt'],
            ['name' => 'file', 'contents' => 'xyz', 'filename' => 'orig.txt'],
        ], ['X-IFM-CSRF' => $token]);

        $this->assertOkStatus($res);
        $this->assertFileExists($this->sandbox . '/renamed.txt');
        $this->assertFileDoesNotExist($this->sandbox . '/orig.txt');
    }

    public function testUploadInvalidFilenameRejected(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->apiUpload([
            ['name' => 'dir', 'contents' => '.'],
            ['name' => 'csrf_token', 'contents' => $token],
            ['name' => 'newfilename', 'contents' => '../escape.txt'],
            ['name' => 'file', 'contents' => 'xyz', 'filename' => 'orig.txt'],
        ], ['X-IFM-CSRF' => $token]);

        $this->assertErrorStatus($res);
        $this->refuteFileExists(dirname($this->sandbox) . '/escape.txt');
    }

    public function testDownloadReturnsBytesAndAttachmentHeader(): void
    {
        $this->seedFile('dl.txt', 'download-me');
        $this->startServer();
        $resp = $this->rawGet('download', ['dir' => '.', 'filename' => 'dl.txt']);

        $this->assertSame(200, $resp->getStatusCode());
        $this->assertSame('download-me', (string) $resp->getBody());
        $this->assertStringContainsString('attachment', $resp->getHeaderLine('Content-Disposition'));
        $this->assertStringContainsString('application/octet-stream', $resp->getHeaderLine('Content-Type'));
    }

    public function testDownloadMissingFileReturns404(): void
    {
        $this->startServer();
        $resp = $this->rawGet('download', ['dir' => '.', 'filename' => 'nope.txt']);
        $this->assertSame(404, $resp->getStatusCode());
    }

    public function testProxyServesInlineWithMimeType(): void
    {
        $this->seedFile('page.txt', 'inline-content');
        $this->startServer();
        $resp = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt']);

        $this->assertSame(200, $resp->getStatusCode());
        $this->assertSame('inline-content', (string) $resp->getBody());
        $this->assertStringNotContainsString('attachment', $resp->getHeaderLine('Content-Disposition'));
    }

    public function testZipnloadStreamsZip(): void
    {
        $this->seedFile('bundle/a.txt', 'a');
        $this->seedFile('bundle/b.txt', 'b');
        $this->startServer();
        $resp = $this->rawGet('zipnload', ['dir' => '.', 'filename' => 'bundle']);

        $this->assertSame(200, $resp->getStatusCode());
        $body = (string) $resp->getBody();
        $this->assertStringStartsWith('PK', $body, 'response should be a ZIP archive');
        $this->assertStringContainsString('application/octet-stream', $resp->getHeaderLine('Content-Type'));
    }
}
