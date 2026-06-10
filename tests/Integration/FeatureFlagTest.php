<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Every feature flag, when set to 0, must turn its endpoint off with a
 * permission error AND perform no side effect.
 */
class FeatureFlagTest extends IfmServerTestCase
{
    public function testDeleteDisabled(): void
    {
        $this->seedFile('keep.txt', 'x');
        $this->startServer(['IFM_DELETE' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('delete', ['dir' => '.', 'filenames' => ['keep.txt']], $token);
        $this->assertErrorStatus($res);
        $this->assertFileExists($this->sandbox . '/keep.txt');
    }

    public function testCreateDirDisabled(): void
    {
        $this->startServer(['IFM_CREATEDIR' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('createDir', ['dir' => '.', 'dirname' => 'nope'], $token);
        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->sandbox . '/nope');
    }

    public function testRenameDisabled(): void
    {
        $this->seedFile('a.txt', 'x');
        $this->startServer(['IFM_RENAME' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('rename', ['dir' => '.', 'filename' => 'a.txt', 'newname' => 'b.txt'], $token);
        $this->assertErrorStatus($res);
        $this->assertFileExists($this->sandbox . '/a.txt');
        $this->refuteFileExists($this->sandbox . '/b.txt');
    }

    public function testCreateFileDisabled(): void
    {
        $this->startServer(['IFM_CREATEFILE' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('saveFile', ['dir' => '.', 'filename' => 'new.txt', 'content' => 'x'], $token);
        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->sandbox . '/new.txt');
    }

    public function testEditDisabledForExistingFile(): void
    {
        $this->seedFile('exists.txt', 'original');
        $this->startServer(['IFM_EDIT' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('saveFile', ['dir' => '.', 'filename' => 'exists.txt', 'content' => 'changed'], $token);
        $this->assertErrorStatus($res);
        $this->assertSame('original', file_get_contents($this->sandbox . '/exists.txt'));
    }

    public function testCopyMoveDisabled(): void
    {
        $this->seedFile('c.txt', 'x');
        $this->seedDir('dest');
        $this->startServer(['IFM_COPYMOVE' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('copyMove', [
            'dir' => '.', 'action' => 'copy', 'filenames' => ['c.txt'],
            'destination' => $this->sandbox . '/dest',
        ], $token);
        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->sandbox . '/dest/c.txt');
    }

    public function testChmodDisabled(): void
    {
        $this->seedFile('p.txt', 'x');
        $this->startServer(['IFM_CHMOD' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('changePermissions', ['dir' => '.', 'filename' => 'p.txt', 'chmod' => '600'], $token);
        $this->assertErrorStatus($res);
    }

    public function testZipnloadDisabled(): void
    {
        $this->seedFile('d/x.txt', 'x');
        $this->startServer(['IFM_ZIPNLOAD' => '0']);
        $resp = $this->rawGet('zipnload', ['dir' => '.', 'filename' => 'd']);
        // returns a JSON error, not a zip
        $this->assertStringContainsString('ERROR', (string) $resp->getBody());
    }

    public function testDownloadDisabled(): void
    {
        $this->seedFile('f.txt', 'x');
        $this->startServer(['IFM_DOWNLOAD' => '0']);
        $resp = $this->rawGet('download', ['dir' => '.', 'filename' => 'f.txt']);
        $this->assertStringContainsString('ERROR', (string) $resp->getBody());
    }
}
