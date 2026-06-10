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
