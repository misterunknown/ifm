<?php

namespace IFM\Tests\Unit;

use IFM\Tests\Support\PrivateAccess;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * White-box tests for IFM's security-critical pure helpers, reached via
 * reflection: the jail check (isPathValid), filename validation, path joining,
 * size/permission formatting.
 */
class ValidationTest extends TestCase
{
    use PrivateAccess;

    private string $root;
    private \IFM $ifm;

    protected function setUp(): void
    {
        $this->root = realpath(sys_get_temp_dir()) . '/' . uniqid('ifm-val-', true);
        mkdir($this->root . '/inside/deeper', 0777, true);
        $this->ifm = new \IFM(['root_dir' => $this->root]);
    }

    protected function tearDown(): void
    {
        @exec('rm -rf ' . escapeshellarg($this->root));
    }

    /* ---------- isPathValid (the jail) ---------- */

    public function testRootItselfIsValid(): void
    {
        $this->assertTrue($this->callPrivate($this->ifm, 'isPathValid', [$this->root]));
    }

    public function testSubdirectoryIsValid(): void
    {
        $this->assertTrue($this->callPrivate($this->ifm, 'isPathValid', [$this->root . '/inside']));
        $this->assertTrue($this->callPrivate($this->ifm, 'isPathValid', [$this->root . '/inside/deeper']));
    }

    #[DataProvider('escapingPaths')]
    public function testPathsOutsideRootAreRejected(string $path): void
    {
        $this->assertFalse(
            $this->callPrivate($this->ifm, 'isPathValid', [$path]),
            "should reject jail escape: $path"
        );
    }

    public static function escapingPaths(): array
    {
        return [
            'parent'        => ['/tmp'],
            'dotdot'        => ['/etc'],
            'absolute root' => ['/'],
            'sibling prefix bypass' => ['/var/www-evil'],
        ];
    }

    public function testTraversalViaRelativeDotDotIsRejected(): void
    {
        // a path that climbs out of the jail then back is not inside root
        $escape = $this->root . '/inside/../../' . basename(dirname($this->root));
        $this->assertFalse($this->callPrivate($this->ifm, 'isPathValid', [$escape]));
    }

    /* ---------- isFilenameValid ---------- */

    #[DataProvider('invalidNames')]
    public function testInvalidFilenamesRejected($name): void
    {
        $this->assertFalse($this->ifm->isFilenameValid($name));
    }

    public static function invalidNames(): array
    {
        return [
            'empty'      => [''],
            'dot'        => ['.'],
            'dotdot'     => ['..'],
            'slash'      => ['foo/bar'],
            'traversal'  => ['../evil'],
            'nullbyte'   => ["a\0b"],
            'non-string' => [123],
        ];
    }

    #[DataProvider('validNames')]
    public function testValidFilenamesAccepted(string $name): void
    {
        $this->assertTrue($this->ifm->isFilenameValid($name));
    }

    public static function validNames(): array
    {
        return [
            'simple'      => ['file.txt'],
            'spaces'      => ['my file.txt'],
            'unicode'     => ['rapport-éà.txt'],
            'underscored' => ['a_b-c.tar.gz'],
        ];
    }

    public function testHtaccessHiddenWhenShowHtdocsOff(): void
    {
        $ifm = new \IFM(['root_dir' => $this->root, 'showhtdocs' => 0]);
        $this->assertFalse($ifm->isFilenameValid('.htaccess'));
        $this->assertFalse($ifm->isFilenameValid('.htpasswd'));
    }

    public function testHiddenFilesRejectedWhenShowHiddenOff(): void
    {
        $ifm = new \IFM(['root_dir' => $this->root, 'showhiddenfiles' => 0]);
        $this->assertFalse($ifm->isFilenameValid('.secret'));
    }

    public function testForbiddenCharsRejected(): void
    {
        $ifm = new \IFM(['root_dir' => $this->root, 'forbiddenChars' => ['$', '@']]);
        $this->assertFalse($ifm->isFilenameValid('we$rd.txt'));
        $this->assertTrue($ifm->isFilenameValid('fine.txt'));
    }

    /* ---------- pathCombine ---------- */

    public function testPathCombine(): void
    {
        $this->assertSame('a/b/c', $this->callPrivate($this->ifm, 'pathCombine', ['a', 'b', 'c']));
        $this->assertSame('a/b', $this->callPrivate($this->ifm, 'pathCombine', ['a/', '/b/']));
        $this->assertSame('/root/x', $this->callPrivate($this->ifm, 'pathCombine', ['/root', 'x']));
        $this->assertSame('a', $this->callPrivate($this->ifm, 'pathCombine', ['a', '', '  ']));
    }

    /* ---------- isAbsolutePath ---------- */

    public function testIsAbsolutePath(): void
    {
        $this->assertTrue($this->callPrivate($this->ifm, 'isAbsolutePath', ['/etc/passwd']));
        $this->assertFalse($this->callPrivate($this->ifm, 'isAbsolutePath', ['relative/path']));
        $this->assertFalse($this->callPrivate($this->ifm, 'isAbsolutePath', ['']));
    }

    /* ---------- formatSize ---------- */

    public function testFormatSize(): void
    {
        $this->assertSame('1 Byte', $this->callPrivate($this->ifm, 'formatSize', [1]));
        $this->assertSame('0 Bytes', $this->callPrivate($this->ifm, 'formatSize', [0]));
        $this->assertSame('1 KB', $this->callPrivate($this->ifm, 'formatSize', [1024]));
        $this->assertSame('1 MB', $this->callPrivate($this->ifm, 'formatSize', [1048576]));
        $this->assertSame('1 GB', $this->callPrivate($this->ifm, 'formatSize', [1073741824]));
    }

    /* ---------- filePermsDecode ---------- */

    public function testFilePermsDecode(): void
    {
        // 0644 -> rw- r-- r--
        $this->assertSame('rw- r-- r--', $this->callPrivate($this->ifm, 'filePermsDecode', [octdec('0644')]));
        // 0755 -> rwx r-x r-x
        $this->assertSame('rwx r-x r-x', $this->callPrivate($this->ifm, 'filePermsDecode', [octdec('0755')]));
    }
}
