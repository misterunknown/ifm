<?php

namespace IFM\Tests\Security;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Files which configure the web server or PHP for their directory
 * (.htaccess, .htpasswd, .user.ini, ...) are protected unless showhtdocs is
 * enabled: they can neither be created nor read, and they don't show up.
 */
class ProtectedFilesTest extends IfmServerTestCase
{
    private string $token;

    private function boot(array $env = []): void
    {
        $this->startServer($env);
        $this->token = $this->bootstrapCsrf();
    }

    /** GHSA-hj69-3cr4-95qg: .user.ini with auto_prepend_file => code execution. */
    public function testUserIniCannotBeCreated(): void
    {
        $this->seedFile('payload.txt', 'auto_prepend_file=poc.php');
        $this->boot();

        $res = $this->csrfPost('saveFile', [
            'dir'      => '.',
            'filename' => '.user.ini',
            'content'  => 'auto_prepend_file=poc.php',
        ], $this->token);
        $this->assertErrorStatus($res);

        $res = $this->csrfPost('rename', [
            'dir'      => '.',
            'filename' => 'payload.txt',
            'newname'  => '.user.ini',
        ], $this->token);
        $this->assertErrorStatus($res);

        $res = $this->apiUpload([
            ['name' => 'dir', 'contents' => '.'],
            ['name' => 'file', 'contents' => 'auto_prepend_file=poc.php', 'filename' => '.USER.INI'],
        ], ['X-IFM-CSRF' => $this->token]);
        $this->assertErrorStatus($res);

        $this->refuteFileExists($this->sandbox . '/.user.ini');
        $this->refuteFileExists($this->sandbox . '/.USER.INI');
    }

    public function testUserIniCanBeEditedWithShowHtdocs(): void
    {
        $this->boot(['IFM_SHOWHTDOCS' => '1']);
        $res = $this->csrfPost('saveFile', [
            'dir'      => '.',
            'filename' => '.user.ini',
            'content'  => 'upload_max_filesize=1G',
        ], $this->token);
        $this->assertOkStatus($res);
        $this->assertFileExists($this->sandbox . '/.user.ini');
    }

    public function testProtectedFilesAreNotListedOrFound(): void
    {
        foreach (['.htaccess', '.htpasswd', '.htgroups', '.user.ini', 'visible.txt'] as $name) {
            $this->seedFile($name, 'x');
        }
        $this->boot();

        $listed = array_column($this->apiGet('getFiles', ['dir' => '']), 'name');
        $this->assertContains('visible.txt', $listed);
        foreach (['.htaccess', '.htpasswd', '.htgroups', '.user.ini'] as $name) {
            $this->assertNotContains($name, $listed, "$name must not be listed");
        }

        $found = array_column($this->apiPost('searchItems', ['dir' => '', 'pattern' => '.*']), 'name');
        $this->assertSame([], array_values(array_filter($found, fn($n) => str_starts_with(basename($n), '.ht') || basename($n) === '.user.ini')), 'search must not reveal protected files');

        $res = $this->apiGet('getContent', ['dir' => '', 'filename' => '.user.ini']);
        $this->assertErrorStatus($res);
    }

    public function testFolderTreeAppliesTheVisibilityRules(): void
    {
        foreach (['visible/sub', '.hidden', '.htprotected'] as $dir) {
            $this->seedDir($dir);
        }

        $this->boot();
        $names = $this->folderTreeNames();
        $this->assertContains('visible', $names);
        $this->assertContains('sub', $names);
        $this->assertContains('.hidden', $names, 'hidden directories are shown by default');
        $this->assertNotContains('.htprotected', $names);

        $this->boot(['IFM_SHOWHIDDENFILES' => '0']);
        $names = $this->folderTreeNames();
        $this->assertContains('visible', $names);
        $this->assertNotContains('.hidden', $names);
        $this->assertNotContains('.htprotected', $names);
    }

    /** @return string[] all directory names in the getFolderTree response */
    private function folderTreeNames(): array
    {
        $names = [];
        $collect = function (array $nodes) use (&$collect, &$names): void {
            foreach ($nodes as $node) {
                $names[] = $node['text'];
                $collect($node['nodes'] ?? []);
            }
        };
        $collect($this->apiGet('getFolderTree', ['dir' => '']));
        return $names;
    }
}
