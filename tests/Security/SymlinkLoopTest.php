<?php

namespace IFM\Tests\Security;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Symlink-loop resilience: recursive endpoints (searchItems, getFolderTree)
 * must terminate instead of spinning forever when a directory links to itself
 * or an ancestor. The PHPUnit timeout would catch a hang; we also assert the
 * response is well-formed.
 */
class SymlinkLoopTest extends IfmServerTestCase
{
    private function makeLoop(): void
    {
        $this->seedFile('loopdir/match.txt', 'hit');
        // loopdir/self -> loopdir   (direct self loop)
        @symlink($this->sandbox . '/loopdir', $this->sandbox . '/loopdir/self');
        // loopdir/up -> sandbox     (ancestor loop)
        @symlink($this->sandbox, $this->sandbox . '/loopdir/up');
    }

    public function testSearchTerminatesWithSymlinkLoop(): void
    {
        if (!function_exists('symlink')) {
            $this->markTestSkipped('symlink() not available');
        }
        $this->makeLoop();
        $this->startServer();

        $results = $this->apiGet('searchItems', ['dir' => '.', 'pattern' => '*.txt']);
        $this->assertIsArray($results);
        $joined = implode('|', array_column($results, 'name'));
        $this->assertStringContainsString('match.txt', $joined);
    }

    public function testFolderTreeTerminatesWithSymlinkLoop(): void
    {
        if (!function_exists('symlink')) {
            $this->markTestSkipped('symlink() not available');
        }
        $this->makeLoop();
        $this->startServer();

        $tree = $this->apiGet('getFolderTree', ['dir' => $this->sandbox]);
        $this->assertIsArray($tree);
        $this->assertSame('/ [root]', $tree[0]['text']);
    }
}
