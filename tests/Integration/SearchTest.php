<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * searchItems endpoint (recursive glob search).
 */
class SearchTest extends IfmServerTestCase
{
    public function testSearchFindsMatchingFilesRecursively(): void
    {
        $this->seedFile('top.txt', '1');
        $this->seedFile('a/middle.txt', '2');
        $this->seedFile('a/b/deep.txt', '3');
        $this->seedFile('a/note.md', '4');
        $this->startServer();

        $results = $this->apiGet('searchItems', ['dir' => '.', 'pattern' => '*.txt']);
        $names = array_column($results, 'name');
        // basenames appear among the matched paths
        $joined = implode('|', $names);
        $this->assertStringContainsString('top.txt', $joined);
        $this->assertStringContainsString('middle.txt', $joined);
        $this->assertStringContainsString('deep.txt', $joined);
        $this->assertStringNotContainsString('note.md', $joined);
    }

    public function testSearchRejectsSlashInPattern(): void
    {
        $this->startServer();
        $res = $this->apiGet('searchItems', ['dir' => '.', 'pattern' => 'a/b']);
        $this->assertErrorStatus($res);
    }

    public function testSearchDisabledByConfig(): void
    {
        $this->seedFile('x.txt');
        $this->startServer(['IFM_SEARCH' => '0']);
        $res = $this->apiGet('searchItems', ['dir' => '.', 'pattern' => '*.txt']);
        $this->assertErrorStatus($res);
    }
}
