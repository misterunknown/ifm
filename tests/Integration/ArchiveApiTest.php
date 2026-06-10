<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * createArchive + extract endpoints (HTTP level, complementing the unit-level
 * IFMArchive round-trips).
 */
class ArchiveApiTest extends IfmServerTestCase
{
    private string $token;

    private function boot(): void
    {
        $this->startServer();
        $this->token = $this->bootstrapCsrf();
    }

    public function testCreateZipArchive(): void
    {
        $this->seedFile('docs/a.txt', 'a');
        $this->seedFile('docs/b.txt', 'b');
        $this->boot();
        $res = $this->csrfPost('createArchive', [
            'dir'         => '.',
            'archivename' => 'bundle.zip',
            'filenames'   => ['docs'],
            'format'      => 'zip',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertFileExists($this->sandbox . '/bundle.zip');
    }

    public function testCreateTarArchive(): void
    {
        $this->seedFile('stuff/x.txt', 'x');
        $this->boot();
        $res = $this->csrfPost('createArchive', [
            'dir'         => '.',
            'archivename' => 'out.tar',
            'filenames'   => ['stuff'],
            'format'      => 'tar',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertFileExists($this->sandbox . '/out.tar');
    }

    public function testCreateArchiveInvalidFormatRejected(): void
    {
        $this->seedFile('y.txt', 'y');
        $this->boot();
        $res = $this->csrfPost('createArchive', [
            'dir'         => '.',
            'archivename' => 'bad.rar',
            'filenames'   => ['y.txt'],
            'format'      => 'rar',
        ], $this->token);
        $this->assertErrorStatus($res);
    }

    public function testExtractZipRoundTrip(): void
    {
        // build a zip on disk, then extract it through the API
        $this->seedFile('payload/inner.txt', 'inner-data');
        $zip = $this->sandbox . '/archive.zip';
        $za = new \ZipArchive();
        $za->open($zip, \ZipArchive::CREATE);
        $za->addFromString('payload/inner.txt', 'inner-data');
        $za->close();

        $this->boot();
        $res = $this->csrfPost('extract', [
            'dir'       => '.',
            'filename'  => 'archive.zip',
            'targetdir' => 'extracted',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertSame('inner-data', file_get_contents($this->sandbox . '/extracted/payload/inner.txt'));
    }

    public function testExtractMissingArchiveRejected(): void
    {
        $this->boot();
        $res = $this->csrfPost('extract', [
            'dir'       => '.',
            'filename'  => 'ghost.zip',
            'targetdir' => 'out',
        ], $this->token);
        $this->assertErrorStatus($res);
    }
}
