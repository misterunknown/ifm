<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * HTTP conditional requests on the download/proxy endpoints: real files get
 * ETag + Last-Modified validators and revalidation answers a bodyless 304,
 * while generated zipnload archives stay uncached (nothing to revalidate).
 */
class HttpCacheTest extends IfmServerTestCase
{
    public function testProxyEmitsValidatorsAndRevalidationPolicy(): void
    {
        $this->seedFile('page.txt', 'cache-me');
        $this->startServer();
        $resp = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt']);

        $this->assertSame(200, $resp->getStatusCode());
        $this->assertMatchesRegularExpression('/^"[0-9a-f]+-[0-9a-f]+"$/', $resp->getHeaderLine('ETag'));
        $this->assertNotSame('', $resp->getHeaderLine('Last-Modified'));
        $this->assertSame('private, no-cache', $resp->getHeaderLine('Cache-Control'));
        $this->assertSame('cache-me', (string) $resp->getBody());
    }

    public function testIfNoneMatchAnswersBodyless304(): void
    {
        $this->seedFile('page.txt', 'cache-me');
        $this->startServer();
        $etag = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt'])->getHeaderLine('ETag');

        $resp = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt'], ['If-None-Match' => $etag]);
        $this->assertSame(304, $resp->getStatusCode());
        $this->assertSame('', (string) $resp->getBody());
        // validators are resent so caches can refresh their metadata
        $this->assertSame($etag, $resp->getHeaderLine('ETag'));
    }

    public function testIfModifiedSinceAnswers304(): void
    {
        $this->seedFile('page.txt', 'cache-me');
        $this->startServer();
        $lastModified = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt'])->getHeaderLine('Last-Modified');

        $resp = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt'], ['If-Modified-Since' => $lastModified]);
        $this->assertSame(304, $resp->getStatusCode());
        $this->assertSame('', (string) $resp->getBody());
    }

    public function testStaleEtagGetsFullResponse(): void
    {
        $this->seedFile('page.txt', 'cache-me');
        $this->startServer();

        $resp = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt'], ['If-None-Match' => '"dead-beef"']);
        $this->assertSame(200, $resp->getStatusCode());
        $this->assertSame('cache-me', (string) $resp->getBody());
    }

    public function testChangedFileInvalidatesEtag(): void
    {
        $path = $this->seedFile('page.txt', 'cache-me');
        $this->startServer();
        $etag = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt'])->getHeaderLine('ETag');

        // different size guarantees a different validator even within the same
        // mtime second (the ETag derives from mtime + size)
        file_put_contents($path, 'changed content, longer than before');

        $resp = $this->rawGet('proxy', ['dir' => '.', 'filename' => 'page.txt'], ['If-None-Match' => $etag]);
        $this->assertSame(200, $resp->getStatusCode());
        $this->assertSame('changed content, longer than before', (string) $resp->getBody());
        $this->assertNotSame($etag, $resp->getHeaderLine('ETag'));
    }

    public function testDownloadSupportsConditionalRequestsToo(): void
    {
        $this->seedFile('file.bin', 'attachment-bytes');
        $this->startServer();
        $first = $this->rawGet('download', ['dir' => '.', 'filename' => 'file.bin']);
        $this->assertSame(200, $first->getStatusCode());
        $this->assertStringContainsString('attachment', $first->getHeaderLine('Content-Disposition'));
        $etag = $first->getHeaderLine('ETag');
        $this->assertNotSame('', $etag);

        $resp = $this->rawGet('download', ['dir' => '.', 'filename' => 'file.bin'], ['If-None-Match' => $etag]);
        $this->assertSame(304, $resp->getStatusCode());
        $this->assertSame('', (string) $resp->getBody());
    }

    /** A zipnload archive is generated per request: no validator, always a body. */
    public function testZipnloadStaysUncached(): void
    {
        $this->seedFile('bundle/a.txt', 'a');
        $this->startServer();
        $resp = $this->rawGet('zipnload', ['dir' => '.', 'filename' => 'bundle']);

        $this->assertSame(200, $resp->getStatusCode());
        $this->assertSame('', $resp->getHeaderLine('ETag'));
        $this->assertStringStartsWith('PK', (string) $resp->getBody());

        // a conditional request must never turn a generated archive into a 304
        $resp = $this->rawGet('zipnload', ['dir' => '.', 'filename' => 'bundle'], ['If-None-Match' => '"6a6fcb49-b"']);
        $this->assertSame(200, $resp->getStatusCode());
        $this->assertStringStartsWith('PK', (string) $resp->getBody());
    }
}
