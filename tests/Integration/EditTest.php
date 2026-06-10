<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Mutating single-file endpoints: createDir, saveFile, getContent, rename, delete.
 * All go through the POST + CSRF token path.
 */
class EditTest extends IfmServerTestCase
{
    private string $token;

    private function boot(array $env = []): void
    {
        $this->startServer($env);
        $this->token = $this->bootstrapCsrf();
    }

    public function testCreateDir(): void
    {
        $this->boot();
        $res = $this->csrfPost('createDir', ['dir' => '.', 'dirname' => 'newdir'], $this->token);
        $this->assertOkStatus($res);
        $this->assertDirectoryExists($this->sandbox . '/newdir');
    }

    public function testCreateDirInvalidNameRejected(): void
    {
        $this->boot();
        $res = $this->csrfPost('createDir', ['dir' => '.', 'dirname' => '..'], $this->token);
        $this->assertErrorStatus($res);
    }

    public function testSaveNewFile(): void
    {
        $this->boot();
        $res = $this->csrfPost('saveFile', [
            'dir' => '.', 'filename' => 'note.txt', 'content' => 'hello world',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertSame('hello world', file_get_contents($this->sandbox . '/note.txt'));
    }

    public function testEditExistingFile(): void
    {
        $this->seedFile('edit.txt', 'old');
        $this->boot();
        $res = $this->csrfPost('saveFile', [
            'dir' => '.', 'filename' => 'edit.txt', 'content' => 'new',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertSame('new', file_get_contents($this->sandbox . '/edit.txt'));
    }

    public function testGetContent(): void
    {
        $this->seedFile('read.txt', 'readable content');
        $this->boot();
        // getContent is not state-changing -> simple GET
        $res = $this->apiGet('getContent', ['dir' => '.', 'filename' => 'read.txt']);
        $this->assertOkStatus($res);
        $this->assertSame('readable content', $res['data']['content']);
    }

    public function testGetContentMissingFile(): void
    {
        $this->boot();
        $res = $this->apiGet('getContent', ['dir' => '.', 'filename' => 'ghost.txt']);
        $this->assertErrorStatus($res);
    }

    public function testRenameFile(): void
    {
        $this->seedFile('before.txt', 'x');
        $this->boot();
        $res = $this->csrfPost('rename', [
            'dir' => '.', 'filename' => 'before.txt', 'newname' => 'after.txt',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertFileDoesNotExist($this->sandbox . '/before.txt');
        $this->assertFileExists($this->sandbox . '/after.txt');
    }

    public function testDeleteFile(): void
    {
        $this->seedFile('trash.txt', 'x');
        $this->boot();
        $res = $this->csrfPost('delete', [
            'dir' => '.', 'filenames' => ['trash.txt'],
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertFileDoesNotExist($this->sandbox . '/trash.txt');
    }

    public function testDeleteDirectoryRecursively(): void
    {
        $this->seedFile('tree/a/b.txt', 'x');
        $this->boot();
        $res = $this->csrfPost('delete', [
            'dir' => '.', 'filenames' => ['tree'],
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertDirectoryDoesNotExist($this->sandbox . '/tree');
    }

    public function testChangePermissions(): void
    {
        $this->seedFile('perm.txt', 'x');
        $this->boot();
        $res = $this->csrfPost('changePermissions', [
            'dir' => '.', 'filename' => 'perm.txt', 'chmod' => '600',
        ], $this->token);
        $this->assertOkStatus($res);
        clearstatcache();
        $this->assertSame('600', substr(decoct(fileperms($this->sandbox . '/perm.txt')), -3));
    }

    public function testChangePermissionsSymbolic(): void
    {
        $this->seedFile('perm2.txt', 'x');
        $this->boot();
        $res = $this->csrfPost('changePermissions', [
            'dir' => '.', 'filename' => 'perm2.txt', 'chmod' => 'rwxr-xr-x',
        ], $this->token);
        $this->assertOkStatus($res);
        clearstatcache();
        $this->assertSame('755', substr(decoct(fileperms($this->sandbox . '/perm2.txt')), -3));
    }
}
