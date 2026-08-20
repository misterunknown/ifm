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
        // Use a multi-file array so the PHP ZipArchive path (which honours the
        // exclude callback) is exercised rather than the single-dir system-zip
        // shortcut.
        file_put_contents($this->work . '/keep.txt', 'keep');
        file_put_contents($this->work . '/drop.txt', 'drop');
        $archive = $this->work . '/filtered.zip';
        \IFMArchive::createZip(
            [$this->work . '/keep.txt', $this->work . '/drop.txt'],
            $archive,
            fn($f) => basename($f) !== 'drop.txt'
        );
        $dest = $this->work . '/filtered';
        mkdir($dest);
        \IFMArchive::extractZip($archive, $dest);
        $this->assertFileExists($dest . '/keep.txt');
        $this->assertFileDoesNotExist($dest . '/drop.txt');
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
