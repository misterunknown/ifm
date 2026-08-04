<?php

namespace IFM\Tests\Unit;

use IFM\Tests\Support\PrivateAccess;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * White-box tests for IFM::getMimeType(): the static extension table must win
 * over content sniffing (no read syscall), unknown extensions fall back to
 * mime_content_type() and are memoized, and extension-less files are never
 * cached (their content is the only source of truth).
 */
class MimeTypeTest extends TestCase
{
    use PrivateAccess;

    private string $root;
    private \IFM $ifm;

    protected function setUp(): void
    {
        $this->root = realpath(sys_get_temp_dir()) . '/' . uniqid('ifm-mime-', true);
        mkdir($this->root, 0777, true);
        $this->ifm = new \IFM(['root_dir' => $this->root]);
    }

    protected function tearDown(): void
    {
        @exec('rm -rf ' . escapeshellarg($this->root));
    }

    private function makeFile(string $name, string $content = 'x'): string
    {
        $path = $this->root . '/' . $name;
        file_put_contents($path, $content);
        return $path;
    }

    private function mime(string $path, ?string $ext = null): string
    {
        return $this->callPrivate($this->ifm, 'getMimeType', [$path, $ext]);
    }

    #[DataProvider('mappedExtensions')]
    public function testMappedExtensionsResolveFromTable(string $name, string $expected): void
    {
        // deliberately mismatched content: the table must be authoritative
        $path = $this->makeFile($name, 'plain text content');
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $this->assertSame($expected, $this->mime($path, $ext));
    }

    public static function mappedExtensions(): array
    {
        return [
            'png'  => ['a.png', 'image/png'],
            'jpg'  => ['a.jpg', 'image/jpeg'],
            'pdf'  => ['a.pdf', 'application/pdf'],
            'zip'  => ['a.zip', 'application/zip'],
            'txt'  => ['a.txt', 'text/plain'],
            'json' => ['a.json', 'application/json'],
            'mp4'  => ['a.mp4', 'video/mp4'],
        ];
    }

    public function testMappedExtensionNeverTouchesTheFile(): void
    {
        // file does not exist at all -- a content-sniffing implementation would
        // fail here, the table lookup must still answer
        $this->assertSame('image/png', $this->mime($this->root . '/missing.png', 'png'));
    }

    public function testExtensionIsDerivedWhenNotSupplied(): void
    {
        $path = $this->makeFile('derived.pdf');
        $this->assertSame('application/pdf', $this->mime($path));
    }

    public function testExtensionLookupIsCaseInsensitiveViaDerivation(): void
    {
        $path = $this->makeFile('SHOUTING.PNG');
        $this->assertSame('image/png', $this->mime($path));
    }

    public function testUnknownExtensionFallsBackToSniffingAndIsCached(): void
    {
        $path = $this->makeFile('a.weirdext', 'hello world');
        $this->assertStringStartsWith('text/', $this->mime($path, 'weirdext'));

        $cache = $this->getPrivate($this->ifm, 'mimeCache');
        $this->assertArrayHasKey('weirdext', $cache);
    }

    public function testExtensionLessFilesAreNotCached(): void
    {
        $text = $this->makeFile('plainfile', 'hello world');
        $png = $this->makeFile('pngfile', self::minimalPng());

        $this->assertStringStartsWith('text/', $this->mime($text, ''));
        $this->assertSame('image/png', $this->mime($png, ''));

        $this->assertSame([], $this->getPrivate($this->ifm, 'mimeCache'));
    }

    /** smallest valid 1x1 PNG, so libmagic reliably detects it */
    private static function minimalPng(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    public function testUnreadableFileYieldsOctetStream(): void
    {
        $this->assertSame(
            'application/octet-stream',
            $this->mime($this->root . '/does-not-exist', '')
        );
    }

    public function testListingUsesMimeTypeForFiles(): void
    {
        $this->makeFile('listed.png', 'not really a png');
        chdir($this->root);
        $item = $this->callPrivate($this->ifm, 'getItemInformation', ['listed.png']);

        $this->assertSame('file', $item['type']);
        $this->assertSame('image/png', $item['mime_type']);
    }
}
