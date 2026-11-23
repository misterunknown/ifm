<?php

namespace IFM\Tests\Security;

use IFM\Tests\Support\IfmServerTestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * A "dir" that passes isPathValid() but is not an enterable directory (it does
 * not exist, is a file, is "0", or chdir is denied) must abort the request.
 * It must never silently leave the cwd at root_dir, where the operation would
 * then hit a same-named file in the root instead.
 *
 * Every test asserts BOTH the error response AND that root/victim.txt survived.
 */
class WorkdirFallbackTest extends IfmServerTestCase
{
    private string $token;

    private function boot(): void
    {
        $this->seedFile('victim.txt', 'precious');
        $this->startServer();
        $this->token = $this->bootstrapCsrf();
    }

    private function assertVictimIntact(): void
    {
        clearstatcache();
        $this->assertFileExists($this->sandbox . '/victim.txt', 'operation fell back to root_dir');
        $this->assertSame('precious', file_get_contents($this->sandbox . '/victim.txt'));
        $this->assertSame(0644, fileperms($this->sandbox . '/victim.txt') & 0777);
    }

    public static function badDirs(): array
    {
        return [
            'non-existent'          => ['nonexistent'],
            'non-existent absolute' => ['@sandbox@/nonexistent'],
            'nested non-existent'   => ['a/b/c'],
            'a file'                => ['victim.txt'],
            'string zero'           => ['0'],
        ];
    }

    private function dir(string $d): string
    {
        return str_replace('@sandbox@', $this->sandbox, $d);
    }

    #[DataProvider('badDirs')]
    public function testDeleteInBadDirDoesNotFallBackToRoot(string $dir): void
    {
        $this->boot();
        chmod($this->sandbox . '/victim.txt', 0644);
        $res = $this->csrfPost('delete', [
            'dir'       => $this->dir($dir),
            'filenames' => ['victim.txt'],
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->assertVictimIntact();
    }

    #[DataProvider('badDirs')]
    public function testRenameInBadDirDoesNotFallBackToRoot(string $dir): void
    {
        $this->boot();
        chmod($this->sandbox . '/victim.txt', 0644);
        $res = $this->csrfPost('rename', [
            'dir'      => $this->dir($dir),
            'filename' => 'victim.txt',
            'newname'  => 'gone.txt',
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->assertVictimIntact();
        $this->refuteFileExists($this->sandbox . '/gone.txt');
    }

    #[DataProvider('badDirs')]
    public function testSaveFileInBadDirDoesNotFallBackToRoot(string $dir): void
    {
        $this->boot();
        chmod($this->sandbox . '/victim.txt', 0644);
        $res = $this->csrfPost('saveFile', [
            'dir'      => $this->dir($dir),
            'filename' => 'victim.txt',
            'content'  => 'overwritten',
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->assertVictimIntact();
    }

    #[DataProvider('badDirs')]
    public function testChmodInBadDirDoesNotFallBackToRoot(string $dir): void
    {
        $this->boot();
        chmod($this->sandbox . '/victim.txt', 0644);
        $res = $this->csrfPost('changePermissions', [
            'dir'      => $this->dir($dir),
            'filename' => 'victim.txt',
            'chmod'    => '600',
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->assertVictimIntact();
    }

    public function testDeleteInUnenterableDirDoesNotFallBackToRoot(): void
    {
        if (function_exists('posix_geteuid') && posix_geteuid() === 0)
            $this->markTestSkipped('root ignores directory permissions');

        $locked = $this->seedDir('locked');
        $this->boot();
        chmod($this->sandbox . '/victim.txt', 0644);
        chmod($locked, 0600); // readable, but not searchable: chdir() fails
        try {
            $res = $this->csrfPost('delete', [
                'dir'       => 'locked',
                'filenames' => ['victim.txt'],
            ], $this->token);
        } finally {
            chmod($locked, 0755);
        }

        $this->assertErrorStatus($res);
        $this->assertVictimIntact();
    }

    public function testDirectoryNamedZeroIsAUsableWorkdir(): void
    {
        $this->seedFile('0/victim.txt', 'inside zero');
        $this->boot();
        $res = $this->csrfPost('delete', [
            'dir'       => '0',
            'filenames' => ['victim.txt'],
        ], $this->token);

        $this->assertOkStatus($res);
        $this->refuteFileExists($this->sandbox . '/0/victim.txt');
        $this->assertFileExists($this->sandbox . '/victim.txt');
    }

    public function testDeleteRejectsNonArrayFilenames(): void
    {
        $this->boot();
        $res = $this->csrfPost('delete', [
            'dir'       => '.',
            'filenames' => 'victim.txt',
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->assertFileExists($this->sandbox . '/victim.txt');
    }

    public function testGetFilesWithMissingDirStillListsRoot(): void
    {
        $this->boot();
        $list = $this->apiGet('getFiles', ['dir' => 'nonexistent']);
        $this->assertContains('victim.txt', array_column($list, 'name'));
    }
}
