<?php

namespace IFM\Tests\Security;

use IFM\Tests\Support\IfmServerTestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Archives created by zipnload and createArchive must not contain files which
 * the direct download refuses (GHSA-rj38-gv9f-3cmx, GHSA-8598-554p-93wj,
 * GHSA-rm62-hvpx-c873), with and without the system zip binary.
 */
class ArchiveCreateTest extends IfmServerTestCase
{
    public static function zipBackends(): array
    {
        return [
            'system zip' => [[]],
            'ZipArchive' => [['PATH' => '/nonexistent']],
        ];
    }

    private function seedTree(): void
    {
        $files = [
            'public.txt', '.htaccess', '.htpasswd', '.user.ini', '.env',
            '.private/token.txt', 'sub/.htpasswd', 'sub/ok.txt',
        ];
        foreach ($files as $f) {
            $this->seedFile($f, "content of $f");
        }
    }

    /** @return string[] entry names relative to the archive's top directory */
    private function zipnload(string $dir, string $filename): array
    {
        $resp = $this->rawGet('zipnload', ['dir' => $dir, 'filename' => $filename]);
        $this->assertSame(200, $resp->getStatusCode());
        $file = $this->makeTmpDir('ifm-zipnload-') . '/download.zip';
        file_put_contents($file, (string) $resp->getBody());
        return $this->zipEntries($file);
    }

    /** @return string[] */
    private function zipEntries(string $file): array
    {
        $za = new \ZipArchive();
        $this->assertTrue($za->open($file) === true, 'response must be a zip archive');
        $names = [];
        for ($i = 0; $i < $za->numFiles; $i++) {
            // strip the top directory (named after the sandbox or the zipped dir)
            $names[] = preg_replace('~^[^/]+/~', '', $za->getNameIndex($i));
        }
        $za->close();
        return array_values(array_filter($names, fn($n) => $n !== ''));
    }

    #[DataProvider('zipBackends')]
    public function testZipnloadExcludesServerConfigFiles(array $env): void
    {
        $this->seedTree();
        $this->startServer($env);

        // control: the direct download refuses them
        foreach (['.htaccess', '.htpasswd', '.user.ini'] as $name) {
            $this->assertErrorStatus($this->apiGet('download', ['dir' => '', 'filename' => $name]));
        }

        $entries = $this->zipnload('', '.');
        foreach (['.htaccess', '.htpasswd', '.user.ini', 'sub/.htpasswd'] as $name) {
            $this->assertNotContains($name, $entries, "$name must not be in the archive");
        }
        // hidden files are allowed by default (showhiddenfiles=1)
        foreach (['public.txt', 'sub/ok.txt', '.env', '.private/token.txt'] as $name) {
            $this->assertContains($name, $entries, "$name must be in the archive");
        }
    }

    #[DataProvider('zipBackends')]
    public function testZipnloadExcludesHiddenFilesAndDirectories(array $env): void
    {
        $this->seedTree();
        $this->startServer($env + ['IFM_SHOWHIDDENFILES' => '0']);

        $entries = $this->zipnload('', '.');
        $this->assertSame(['public.txt', 'sub/', 'sub/ok.txt'], $this->sorted($entries));
    }

    #[DataProvider('zipBackends')]
    public function testCreateArchiveZipExcludesServerConfigFiles(array $env): void
    {
        $this->seedTree();
        $this->startServer($env);
        $token = $this->bootstrapCsrf();

        $res = $this->csrfPost('createArchive', [
            'dir'         => '.',
            'archivename' => 'bundle.zip',
            'filenames'   => ['sub', 'public.txt'],
            'format'      => 'zip',
        ], $token);
        $this->assertOkStatus($res);

        $za = new \ZipArchive();
        $za->open($this->sandbox . '/bundle.zip');
        $names = [];
        for ($i = 0; $i < $za->numFiles; $i++) {
            $names[] = $za->getNameIndex($i);
        }
        $this->assertSame(['public.txt', 'sub/', 'sub/ok.txt'], $this->sorted($names));
    }

    public function testCreateArchiveTarExcludesServerConfigFiles(): void
    {
        $this->seedTree();
        $this->startServer();
        $token = $this->bootstrapCsrf();

        $res = $this->csrfPost('createArchive', [
            'dir'         => '.',
            'archivename' => 'bundle.tar',
            'filenames'   => ['sub'],
            'format'      => 'tar',
        ], $token);
        $this->assertOkStatus($res);

        $tar = new \PharData($this->sandbox . '/bundle.tar');
        $this->assertTrue(isset($tar['sub/ok.txt']));
        $this->assertFalse(isset($tar['sub/.htpasswd']), 'sub/.htpasswd must not be in the archive');
    }

    /** @param string[] $list */
    private function sorted(array $list): array
    {
        sort($list);
        return $list;
    }
}
