<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * copyMove endpoint: copy and move within the jail.
 */
class CopyMoveTest extends IfmServerTestCase
{
    private string $token;

    private function boot(): void
    {
        $this->startServer();
        $this->token = $this->bootstrapCsrf();
    }

    public function testCopyFile(): void
    {
        $this->seedFile('src.txt', 'data');
        $this->seedDir('target');
        $this->boot();
        $res = $this->csrfPost('copyMove', [
            'dir'         => '.',
            'action'      => 'copy',
            'filenames'   => ['src.txt'],
            'destination' => $this->sandbox . '/target',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertFileExists($this->sandbox . '/src.txt');           // original stays
        $this->assertFileExists($this->sandbox . '/target/src.txt');    // copy made
    }

    public function testMoveFile(): void
    {
        $this->seedFile('movable.txt', 'data');
        $this->seedDir('dst');
        $this->boot();
        $res = $this->csrfPost('copyMove', [
            'dir'         => '.',
            'action'      => 'move',
            'filenames'   => ['movable.txt'],
            'destination' => $this->sandbox . '/dst',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertFileDoesNotExist($this->sandbox . '/movable.txt'); // original gone
        $this->assertFileExists($this->sandbox . '/dst/movable.txt');
    }

    public function testCopyDirectoryRecursively(): void
    {
        $this->seedFile('folder/inner/file.txt', 'x');
        $this->seedDir('into');
        $this->boot();
        $res = $this->csrfPost('copyMove', [
            'dir'         => '.',
            'action'      => 'copy',
            'filenames'   => ['folder'],
            'destination' => $this->sandbox . '/into',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertFileExists($this->sandbox . '/into/folder/inner/file.txt');
    }

    public function testInvalidActionRejected(): void
    {
        $this->seedFile('x.txt');
        $this->seedDir('t');
        $this->boot();
        $res = $this->csrfPost('copyMove', [
            'dir'         => '.',
            'action'      => 'teleport',
            'filenames'   => ['x.txt'],
            'destination' => $this->sandbox . '/t',
        ], $this->token);
        $this->assertErrorStatus($res);
    }
}
