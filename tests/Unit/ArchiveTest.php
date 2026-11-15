<?php

namespace IFM\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * White-box round-trip tests for IFMArchive (create -> extract for every format).
 */
class ArchiveTest extends TestCase
{
    private string $work;

    protected function setUp(): void
    {
        $this->work = sys_get_temp_dir() . '/' . uniqid('ifm-arch-', true);
        mkdir($this->work . '/payload/sub', 0777, true);
        file_put_contents($this->work . '/payload/a.txt', 'alpha');
        file_put_contents($this->work . '/payload/sub/b.txt', 'beta');
    }

    protected function tearDown(): void
    {
        $this->rrmdir($this->work);
    }

    public function testZipRoundTrip(): void
    {
        $archive = $this->work . '/out.zip';
        $this->assertTrue(\IFMArchive::createZip($this->work . '/payload', $archive));
        $this->assertFileExists($archive);

        $dest = $this->work . '/unzipped';
        mkdir($dest);
        $this->assertTrue(\IFMArchive::extractZip($archive, $dest));
        $this->assertSame('alpha', file_get_contents($dest . '/payload/a.txt'));
        $this->assertSame('beta', file_get_contents($dest . '/payload/sub/b.txt'));
    }

    #[DataProvider('tarFormats')]
    public function testTarRoundTrip(string $format, string $ext): void
    {
        if ($format === 'tar.bz2' && !extension_loaded('bz2')) {
            $this->markTestSkipped('bz2 extension not loaded');
        }
        if ($format === 'tar.gz' && !extension_loaded('zlib')) {
            $this->markTestSkipped('zlib extension not loaded');
        }
        $base = $this->work . '/out';
        $this->assertTrue(\IFMArchive::createTar($this->work . '/payload', $base, $format));
        $archive = $base . '.' . $ext;
        $this->assertFileExists($archive);

        $dest = $this->work . '/untar-' . $ext;
        mkdir($dest);
        $this->assertTrue(\IFMArchive::extractTar($archive, $dest));
        $this->assertSame('alpha', file_get_contents($dest . '/payload/a.txt'));
        $this->assertSame('beta', file_get_contents($dest . '/payload/sub/b.txt'));
    }

    public static function tarFormats(): array
    {
        return [
            'tar'     => ['tar', 'tar'],
            'tar.gz'  => ['tar.gz', 'tar.gz'],
            'tar.bz2' => ['tar.bz2', 'tar.bz2'],
        ];
    }

    /* ---- negative cases ---- */

    public function testCreateTarRejectsUnknownFormat(): void
    {
        $this->assertFalse(\IFMArchive::createTar($this->work . '/payload', $this->work . '/x', 'rar'));
    }

    public function testExtractMissingZipReturnsFalse(): void
    {
        $this->assertFalse(\IFMArchive::extractZip($this->work . '/does-not-exist.zip', $this->work));
    }

    public function testExtractMissingTarReturnsFalse(): void
    {
        $this->assertFalse(\IFMArchive::extractTar($this->work . '/does-not-exist.tar', $this->work));
    }

    public function testCreateZipWithExcludeCallback(): void
    {
        // multiple sources always use the \ZipArchive backend; the callback
        // gets the bare names of the given files
        file_put_contents($this->work . '/keep.txt', 'keep');
        file_put_contents($this->work . '/drop.txt', 'drop');
        $archive = $this->work . '/filtered.zip';
        \IFMArchive::createZip(
            [$this->work . '/keep.txt', $this->work . '/drop.txt'],
            $archive,
            fn($f) => $f !== 'drop.txt'
        );
        $this->assertSame(['drop.txt' => false, 'keep.txt' => true], [
            'drop.txt' => in_array('drop.txt', $this->zipEntries($archive), true),
            'keep.txt' => in_array('keep.txt', $this->zipEntries($archive), true),
        ]);
    }

    /* ---- exclusion filter on every backend (GHSA-rj38-gv9f-3cmx, GHSA-8598-554p-93wj, GHSA-rm62-hvpx-c873) ---- */

    /** A tree with entries to exclude (hidden files and dirs) and odd but valid names. */
    private function seedFilterTree(): string
    {
        $tree = $this->work . '/tree';
        foreach (['sub', '.hidden', 'emptydir'] as $d) {
            mkdir("$tree/$d", 0777, true);
        }
        $files = [
            'public.txt', '.htpasswd', '.hidden/secret.txt', 'sub/.htaccess', 'sub/ok.txt',
            '[.]htpasswd', 'with space.txt', '-dash.txt', 'star*.txt', 'trailing ',
        ];
        foreach ($files as $f) {
            file_put_contents("$tree/$f", $f);
        }
        return $tree;
    }

    private const FILTERED_TREE = [
        'tree/', 'tree/-dash.txt', 'tree/[.]htpasswd', 'tree/emptydir/', 'tree/public.txt',
        'tree/star*.txt', 'tree/sub/', 'tree/sub/ok.txt', 'tree/trailing ', 'tree/with space.txt',
    ];

    private static function excludeHidden(): \Closure
    {
        return fn($f) => $f[0] !== '.';
    }

    public function testSystemZipAppliesExcludeCallback(): void
    {
        $this->requireZipBinary();
        $tree = $this->seedFilterTree();
        $archive = $this->work . '/system.zip';

        $this->assertTrue(\IFMArchive::createZipSystem($tree, $archive, [], self::excludeHidden()), 'system zip should be used');
        $this->assertSame(self::FILTERED_TREE, $this->zipEntries($archive));
        $this->assertSame('[.]htpasswd', $this->zipContent($archive, 'tree/[.]htpasswd'), 'names must be taken literally, not as wildcards');
    }

    public function testZipArchiveFallbackAppliesExcludeCallback(): void
    {
        $tree = $this->seedFilterTree();
        $archive = $this->work . '/fallback.zip';

        $this->withPath('/nonexistent', function () use ($tree, $archive) {
            $this->assertFalse(\IFMArchive::createZipSystem($tree, $this->work . '/unused.zip'), 'zip binary must not be found');
            $this->assertTrue(\IFMArchive::createZip($tree, $archive, self::excludeHidden()));
        });
        $this->assertSame(self::FILTERED_TREE, $this->zipEntries($archive));
    }

    public function testTarAppliesExcludeCallback(): void
    {
        $tree = $this->seedFilterTree();
        unlink($tree . '/star*.txt'); // PharData can't store names containing "*" at all
        $this->assertTrue(\IFMArchive::createTar($tree, $this->work . '/filtered', 'tar', self::excludeHidden()));

        $tar = new \PharData($this->work . '/filtered.tar');
        $base = 'phar://' . $this->work . '/filtered.tar/';
        $entries = [];
        foreach (new \RecursiveIteratorIterator($tar, \RecursiveIteratorIterator::SELF_FIRST) as $entry) {
            $entries[] = substr($entry->getPathname(), strlen($base)) . ($entry->isDir() ? '/' : '');
        }
        sort($entries);
        $this->assertSame(array_values(array_diff(self::FILTERED_TREE, ['tree/star*.txt'])), $entries);
        $this->assertNotContains('tree/.htpasswd', $entries);
        $this->assertNotContains('tree/.hidden/', $entries);
    }

    /** zip reads one name per line, so such names must go through \ZipArchive. */
    public function testSystemZipRefusesNamesWithLineBreaks(): void
    {
        $this->requireZipBinary();
        mkdir($this->work . '/nl');
        file_put_contents($this->work . "/nl/line\nbreak.txt", 'x');
        file_put_contents($this->work . '/nl/.htpasswd', 'secret');

        $this->assertFalse(\IFMArchive::createZipSystem($this->work . '/nl', $this->work . '/nl.zip'));
        $this->assertFileDoesNotExist($this->work . '/nl.zip');
        $this->assertSame([], glob($this->work . '/.ifm-zip-*') ?: [], 'no temporary archive must be left behind');

        // createZip falls back and still filters
        $this->assertTrue(\IFMArchive::createZip($this->work . '/nl', $this->work . '/nl.zip', self::excludeHidden()));
        $this->assertSame(['nl/', "nl/line\nbreak.txt"], $this->zipEntries($this->work . '/nl.zip'));
    }

    /** zip appends ".zip" to names without extension; the archive must be created exactly as requested. */
    public function testSystemZipKeepsTheRequestedArchiveName(): void
    {
        $this->requireZipBinary();
        $this->assertTrue(\IFMArchive::createZipSystem($this->work . '/payload', $this->work . '/bundle'));
        $this->assertFileExists($this->work . '/bundle');
        $this->assertFileDoesNotExist($this->work . '/bundle.zip');
    }

    /** An existing zip archive gets updated, not replaced (behaviour before and with #213). */
    #[DataProvider('zipBackends')]
    public function testCreateZipUpdatesAnExistingArchive(string $path): void
    {
        if ($path === '') {
            $this->requireZipBinary();
        }
        mkdir($this->work . '/second');
        file_put_contents($this->work . '/second/c.txt', 'gamma');
        $archive = $this->work . '/existing.zip';

        $this->withPath($path ?: (string) getenv('PATH'), function () use ($archive) {
            $this->assertTrue(\IFMArchive::createZip($this->work . '/payload', $archive));
            $this->assertTrue(\IFMArchive::createZip($this->work . '/second', $archive));
        });
        $entries = $this->zipEntries($archive);
        $this->assertContains('payload/a.txt', $entries);
        $this->assertContains('second/c.txt', $entries);
        $this->assertSame([], glob($this->work . '/.ifm-zip-*') ?: [], 'no temporary archive must be left behind');
    }

    /** Relative $PATH entries would resolve against the managed directory. */
    public function testZipBinaryIsNotTakenFromRelativePath(): void
    {
        mkdir($this->work . '/bin');
        $marker = $this->work . '/fake-zip-ran';
        file_put_contents($this->work . '/bin/zip', "#!/bin/sh\ntouch " . escapeshellarg($marker) . "\n");
        chmod($this->work . '/bin/zip', 0755);

        $cwd = getcwd();
        chdir($this->work);
        try {
            $this->withPath('bin', function () {
                $this->assertFalse(\IFMArchive::createZipSystem($this->work . '/payload', $this->work . '/x.zip'));
            });
        } finally {
            chdir($cwd);
        }
        $this->assertFileDoesNotExist($marker);
    }

    /** Symlink loops must not make the archive functions recurse endlessly. */
    #[DataProvider('zipBackends')]
    public function testSymlinkLoopTerminates(string $path): void
    {
        if ($path === '' ) {
            $this->requireZipBinary();
        }
        symlink($this->work . '/payload', $this->work . '/payload/sub/loop');
        $archive = $this->work . '/loop.zip';
        $this->withPath($path ?: (string) getenv('PATH'), function () use ($archive) {
            $this->assertTrue(\IFMArchive::createZip($this->work . '/payload', $archive, fn($f) => true));
        });
        $this->assertContains('payload/sub/b.txt', $this->zipEntries($archive));
    }

    public static function zipBackends(): array
    {
        return ['system zip' => [''], 'ZipArchive' => ['/nonexistent']];
    }

    private function requireZipBinary(): void
    {
        foreach (explode(PATH_SEPARATOR, (string) getenv('PATH')) as $dir) {
            if ($dir !== '' && is_executable($dir . '/zip')) {
                return;
            }
        }
        $this->markTestSkipped('zip binary not available');
    }

    private function withPath(string $path, callable $fn): void
    {
        $old = getenv('PATH');
        putenv('PATH=' . $path);
        try {
            $fn();
        } finally {
            putenv('PATH=' . $old);
        }
    }

    /** @return string[] sorted entry names */
    private function zipEntries(string $archive): array
    {
        $za = new \ZipArchive();
        $this->assertTrue($za->open($archive) === true, "cannot open $archive");
        $names = [];
        for ($i = 0; $i < $za->numFiles; $i++) {
            $names[] = $za->getNameIndex($i);
        }
        $za->close();
        sort($names);
        return $names;
    }

    private function zipContent(string $archive, string $entry): string
    {
        $za = new \ZipArchive();
        $za->open($archive);
        $content = $za->getFromName($entry);
        $za->close();
        return (string) $content;
    }

    private function rrmdir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (array_diff(scandir($dir), ['.', '..']) as $e) {
            $p = "$dir/$e";
            is_dir($p) && !is_link($p) ? $this->rrmdir($p) : @unlink($p);
        }
        @rmdir($dir);
    }
}
