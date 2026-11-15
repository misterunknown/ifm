<?php

namespace IFM\Tests\Security;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Jail-escape attempts. Every test asserts BOTH the error response AND that no
 * file leaked outside root_dir (assertOutsideUntouched / refuteFileExists).
 */
class PathJailTest extends IfmServerTestCase
{
    private string $token;

    private function boot(): void
    {
        $this->startServer();
        $this->token = $this->bootstrapCsrf();
    }

    public function testSaveFileToDirOutsideRootIsRejected(): void
    {
        $this->boot();
        $res = $this->csrfPost('saveFile', [
            'dir'      => $this->outside,   // absolute path outside the jail
            'filename' => 'pwned.txt',
            'content'  => 'malicious',
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->outside . '/pwned.txt');
        $this->assertOutsideUntouched();
    }

    public function testSaveFileWithTraversalFilenameIsRejected(): void
    {
        $this->boot();
        $res = $this->csrfPost('saveFile', [
            'dir'      => '.',
            'filename' => '../escape.txt',
            'content'  => 'x',
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->refuteFileExists(dirname($this->sandbox) . '/escape.txt');
    }

    public function testUploadToDirOutsideRootIsRejected(): void
    {
        $this->boot();
        $res = $this->apiUpload([
            ['name' => 'dir', 'contents' => $this->outside],
            ['name' => 'csrf_token', 'contents' => $this->token],
            ['name' => 'file', 'contents' => 'evil', 'filename' => 'drop.txt'],
        ], ['X-IFM-CSRF' => $this->token]);

        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->outside . '/drop.txt');
        $this->assertOutsideUntouched();
    }

    public function testCopyMoveDestinationOutsideRootIsRejected(): void
    {
        $this->seedFile('secret.txt', 'top secret');
        $this->boot();
        $res = $this->csrfPost('copyMove', [
            'dir'         => '.',
            'action'      => 'copy',
            'filenames'   => ['secret.txt'],
            'destination' => $this->outside,   // exfiltration target outside jail
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->outside . '/secret.txt');
        $this->assertOutsideUntouched();
    }

    public function testExtractTargetDirOutsideRootIsRejected(): void
    {
        // a valid archive inside the jail, but extraction aimed outside it
        $zip = $this->sandbox . '/a.zip';
        $za = new \ZipArchive();
        $za->open($zip, \ZipArchive::CREATE);
        $za->addFromString('x.txt', 'data');
        $za->close();

        $this->boot();
        $res = $this->csrfPost('extract', [
            'dir'       => '.',
            'filename'  => 'a.zip',
            'targetdir' => $this->outside,
        ], $this->token);

        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->outside . '/x.txt');
        $this->assertOutsideUntouched();
    }

    /**
     * GHSA-89cj-29fr-h663 / GHSA-hpqm-24fw-9f89 / GHSA-544p-f57q-h55p: ".." in
     * the non-existent tail of the target dir used to pass the jail check,
     * while mkdir() resolved the raw path outside root_dir.
     */
    public function testExtractTargetDirTraversalThroughMissingDirIsRejected(): void
    {
        $this->seedDir('a');
        $zip = $this->sandbox . '/a.zip';
        $za = new \ZipArchive();
        $za->open($zip, \ZipArchive::CREATE);
        $za->addFromString('x.txt', 'data');
        $za->close();

        $this->boot();
        foreach (['a/ghost/', 'a/ghost/./', 'nothere/'] as $prefix) {
            $res = $this->csrfPost('extract', [
                'dir'       => '.',
                'filename'  => 'a.zip',
                'targetdir' => $prefix . '../../../' . basename($this->outside) . '/escaped',
            ], $this->token);
            $this->assertErrorStatus($res, "traversal via '$prefix' must be rejected");
        }
        $this->refuteFileExists($this->outside . '/escaped');
        $this->assertOutsideUntouched();
    }

    /** Legitimate new (nested) target directories keep working. */
    public function testExtractIntoNewNestedTargetDirIsAllowed(): void
    {
        $this->seedDir('a');
        $zip = $this->sandbox . '/a.zip';
        $za = new \ZipArchive();
        $za->open($zip, \ZipArchive::CREATE);
        $za->addFromString('x.txt', 'data');
        $za->close();

        $this->boot();
        $res = $this->csrfPost('extract', [
            'dir'       => '.',
            'filename'  => 'a.zip',
            'targetdir' => 'a/new/deeper',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertSame('data', file_get_contents($this->sandbox . '/a/new/deeper/x.txt'));
    }

    /**
     * GHSA-hj69-3cr4-95qg: a non-existent destination made realpath() return
     * false, which passed the jail check, while xcopy() created and used the raw
     * destination outside root_dir.
     */
    public function testCopyMoveToNonExistentDestinationOutsideRootIsRejected(): void
    {
        $this->seedFile('shell.php', '<?php echo 1;');
        $this->boot();
        foreach (['copy', 'move'] as $action) {
            foreach (['../' . basename($this->outside) . '/pwn', $this->outside . '/pwn'] as $destination) {
                $res = $this->csrfPost('copyMove', [
                    'dir'         => '.',
                    'action'      => $action,
                    'filenames'   => ['shell.php'],
                    'destination' => $destination,
                ], $this->token);
                $this->assertErrorStatus($res, "$action to $destination must be rejected");
            }
        }
        $this->assertFileExists($this->sandbox . '/shell.php');
        $this->assertOutsideUntouched();
    }

    /** GHSA-85hh-4mm7-pmq2: an invalid source must not be processed anyway. */
    public function testCopyMoveWithAbsoluteSourceOutsideRootIsRejected(): void
    {
        file_put_contents($this->outside . '/outside.txt', 'SECRET');
        $this->seedDir('target');
        $this->boot();
        foreach (['copy', 'move'] as $action) {
            $res = $this->csrfPost('copyMove', [
                'dir'         => '.',
                'action'      => $action,
                'filenames'   => [$this->outside . '/outside.txt'],
                'destination' => $this->sandbox . '/target',
            ], $this->token);
            $this->assertErrorStatus($res);
        }
        $this->refuteFileExists($this->sandbox . '/target/outside.txt');
        $this->assertFileExists($this->outside . '/outside.txt');
    }

    /**
     * changePermissions validated dir+filename but chmod()ed the raw filename,
     * so an absolute filename reached files outside root_dir.
     */
    public function testChangePermissionsWithAbsoluteFilenameIsRejected(): void
    {
        $victim = $this->outside . '/victim.txt';
        file_put_contents($victim, 'x');
        chmod($victim, 0644);

        $this->boot();
        foreach (['', '.'] as $dir) {
            $res = $this->csrfPost('changePermissions', [
                'dir'      => $dir,
                'filename' => $victim,
                'chmod'    => '777',
            ], $this->token);
            $this->assertErrorStatus($res, "absolute filename with dir='$dir' must be rejected");
        }
        clearstatcache();
        $this->assertSame('644', substr(decoct(fileperms($victim)), -3), 'permissions outside jail must be unchanged');
    }

    public function testListingDirOutsideRootIsRejected(): void
    {
        $this->boot();
        // getRealpath of an outside dir yields empty (no escape)
        $res = $this->apiGet('getRealpath', ['dir' => $this->outside]);
        $this->assertSame('', $res['realpath']);
    }

    public function testChangePermissionsOutsideRootIsRejected(): void
    {
        // seed a file outside the jail and try to chmod it
        $victim = $this->outside . '/victim.txt';
        file_put_contents($victim, 'x');
        chmod($victim, 0644);

        $this->boot();
        $res = $this->csrfPost('changePermissions', [
            'dir'      => $this->outside,
            'filename' => 'victim.txt',
            'chmod'    => '777',
        ], $this->token);

        $this->assertErrorStatus($res);
        clearstatcache();
        $this->assertSame('644', substr(decoct(fileperms($victim)), -3), 'permissions outside jail must be unchanged');
    }
}
