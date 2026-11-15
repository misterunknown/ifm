<?php

namespace IFM\Tests\Security;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Archive extraction must apply the same filename rules as every other file
 * operation to the archive's entries (GHSA-hj69-3cr4-95qg): disallowed entries
 * are skipped and reported, everything else is extracted as before.
 */
class ArchiveExtractTest extends IfmServerTestCase
{
    private string $token;

    private function boot(array $env = []): void
    {
        $this->startServer($env);
        $this->token = $this->bootstrapCsrf();
    }

    /** @param array<string, string|null> $entries name => content, null = directory */
    private function makeZip(string $name, array $entries): void
    {
        $za = new \ZipArchive();
        $za->open($this->sandbox . '/' . $name, \ZipArchive::CREATE);
        foreach ($entries as $entry => $content) {
            if ($content === null) {
                $za->addEmptyDir($entry);
            } else {
                $za->addFromString($entry, $content);
            }
        }
        $za->close();
    }

    /** @param array<string, string> $entries */
    private function makeTar(string $name, array $entries): void
    {
        $tar = new \PharData($this->sandbox . '/' . $name);
        foreach ($entries as $entry => $content) {
            $tar->addFromString($entry, $content);
        }
    }

    private function extract(string $archive, string $targetdir = '.'): array
    {
        return $this->csrfPost('extract', [
            'dir'       => '.',
            'filename'  => $archive,
            'targetdir' => $targetdir,
        ], $this->token);
    }

    private function assertNoStagingLeftovers(string $dir): void
    {
        $this->assertSame([], glob($dir . '/.ifm-extract-*', GLOB_NOSORT | GLOB_MARK) ?: [], 'staging directory must be removed');
    }

    public function testServerConfigFilesInZipAreSkipped(): void
    {
        $this->makeZip('payload.zip', [
            '.htaccess'      => 'php_value auto_prepend_file poc.php',
            '.user.ini'      => 'auto_prepend_file=poc.php',
            'sub/.HTACCESS'  => 'x',
            'sub/ok.txt'     => 'sub-ok',
            'ok.txt'         => 'ok',
            'emptydir/'      => null,
        ]);
        $this->boot();

        $res = $this->extract('payload.zip');
        $this->assertOkStatus($res);
        $this->assertSame('Archive extracted.', $res['message']);
        foreach (['.htaccess', '.user.ini', 'sub/.HTACCESS'] as $skipped) {
            $this->refuteFileExists($this->sandbox . '/' . $skipped);
            $this->assertStringContainsString(htmlspecialchars($skipped), $res['warning'] ?? '', "$skipped must be reported");
        }
        $this->assertSame('ok', file_get_contents($this->sandbox . '/ok.txt'));
        $this->assertSame('sub-ok', file_get_contents($this->sandbox . '/sub/ok.txt'));
        $this->assertDirectoryExists($this->sandbox . '/emptydir');
        $this->assertNoStagingLeftovers($this->sandbox);
    }

    public function testServerConfigFilesInTarAreSkipped(): void
    {
        $this->makeTar('payload.tar', [
            '.htaccess'     => 'php_value auto_prepend_file poc.php',
            'site/.user.ini' => 'auto_prepend_file=poc.php',
            'site/index.html' => 'index',
        ]);
        $this->boot();

        $res = $this->extract('payload.tar', 'out');
        $this->assertOkStatus($res);
        $this->refuteFileExists($this->sandbox . '/out/.htaccess');
        $this->refuteFileExists($this->sandbox . '/out/site/.user.ini');
        $this->assertSame('index', file_get_contents($this->sandbox . '/out/site/index.html'));
        $this->assertNoStagingLeftovers($this->sandbox . '/out');
    }

    public function testServerConfigFilesAreExtractedWithShowHtdocs(): void
    {
        $this->makeZip('payload.zip', ['.htaccess' => 'allowed', 'ok.txt' => 'ok']);
        $this->boot(['IFM_SHOWHTDOCS' => '1']);

        $res = $this->extract('payload.zip');
        $this->assertOkStatus($res);
        $this->assertSame('Archive extracted.', $res['message']);
        $this->assertArrayNotHasKey('warning', $res, 'nothing was skipped');
        $this->assertSame('allowed', file_get_contents($this->sandbox . '/.htaccess'));
    }

    public function testHiddenEntriesSkippedWhenHiddenFilesAreOff(): void
    {
        $this->makeZip('payload.zip', [
            '.env'          => 'SECRET=1',
            '.git/config'   => 'x',
            'visible.txt'   => 'v',
        ]);
        $this->boot(['IFM_SHOWHIDDENFILES' => '0']);

        $res = $this->extract('payload.zip');
        $this->assertOkStatus($res);
        $this->refuteFileExists($this->sandbox . '/.env');
        $this->refuteFileExists($this->sandbox . '/.git');
        $this->assertFileExists($this->sandbox . '/visible.txt');
    }

    public function testExistingFilesAreOverwrittenAsBefore(): void
    {
        $this->seedFile('dest/data.txt', 'old');
        $this->makeZip('payload.zip', ['data.txt' => 'new']);
        $this->boot();

        $res = $this->extract('payload.zip', 'dest');
        $this->assertOkStatus($res);
        $this->assertSame('new', file_get_contents($this->sandbox . '/dest/data.txt'));
    }

    public function testTraversalEntriesStayInsideTheTarget(): void
    {
        $this->makeZip('payload.zip', [
            '../escape.txt'                   => 'x',
            'a/../../escape2.txt'             => 'x',
            $this->outside . '/absolute.txt'  => 'x',
        ]);
        $this->boot();

        $this->extract('payload.zip', 'target');
        $this->assertOutsideUntouched();
        $this->refuteFileExists(dirname($this->sandbox) . '/escape.txt');
        $this->refuteFileExists(dirname($this->sandbox) . '/escape2.txt');
        $this->assertNoStagingLeftovers($this->sandbox . '/target');
    }

    /** Replaces the former snapshot/restore logic for the running script. */
    public function testArchiveCannotOverwriteTheRunningScript(): void
    {
        $lib = $this->sandbox . '/libifm.php';
        copy(dirname(__DIR__, 2) . '/dist/libifm.php', $lib);
        $hash = hash_file('sha256', $lib);
        $this->makeZip('payload.zip', ['libifm.php' => '<?php /* hijacked */', 'ok.txt' => 'ok']);
        $this->boot(['IFM_LIB_PATH' => $lib]);

        $res = $this->extract('payload.zip');
        $this->assertOkStatus($res);
        $this->assertStringContainsString('libifm.php', $res['warning'] ?? '');
        $this->assertSame($hash, hash_file('sha256', $lib));
        $this->assertFileExists($this->sandbox . '/ok.txt');
    }

    public function testCorruptArchiveFailsCleanly(): void
    {
        $this->seedFile('broken.tar', 'this is not a tar archive');
        $this->seedFile('broken.zip', 'this is not a zip archive');
        $this->boot();

        foreach (['broken.tar', 'broken.zip'] as $archive) {
            $res = $this->extract($archive);
            $this->assertErrorStatus($res);
            $this->assertSame('Could not extract archive.', $res['message']);
        }
        $this->assertNoStagingLeftovers($this->sandbox);
    }
}
