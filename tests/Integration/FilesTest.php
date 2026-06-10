<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Read-only listing endpoints: getFiles, getFolders, getRealpath, getFolderTree.
 */
class FilesTest extends IfmServerTestCase
{
    public function testGetFilesListsSeededEntries(): void
    {
        $this->seedFile('a.txt', 'A');
        $this->seedFile('b.log', 'B');
        $this->seedDir('subdir');
        $this->startServer();

        $list = $this->apiGet('getFiles', ['dir' => '.']);
        $names = array_column($list, 'name');
        $this->assertContains('a.txt', $names);
        $this->assertContains('b.log', $names);
        $this->assertContains('subdir', $names);

        // directories sort before files
        $this->assertSame('dir', $list[0]['type']);
    }

    public function testGetFilesHidesDotfilesWhenConfigured(): void
    {
        $this->seedFile('visible.txt');
        $this->seedFile('.secret');
        $this->startServer(['IFM_SHOWHIDDENFILES' => '0']);

        $names = array_column($this->apiGet('getFiles', ['dir' => '.']), 'name');
        $this->assertContains('visible.txt', $names);
        $this->assertNotContains('.secret', $names);
    }

    public function testGetFilesShowsDotfilesByDefault(): void
    {
        $this->seedFile('.secret');
        $this->startServer(['IFM_SHOWHIDDENFILES' => '1']);
        $names = array_column($this->apiGet('getFiles', ['dir' => '.']), 'name');
        $this->assertContains('.secret', $names);
    }

    public function testGetRealpathForValidSubdir(): void
    {
        $this->seedDir('docs');
        $this->startServer();
        $res = $this->apiGet('getRealpath', ['dir' => 'docs']);
        $this->assertSame('docs', $res['realpath']);
    }

    public function testGetRealpathForEscapingDirReturnsEmpty(): void
    {
        $this->startServer();
        $res = $this->apiGet('getRealpath', ['dir' => $this->outside]);
        $this->assertSame('', $res['realpath']);
    }

    public function testGetFoldersReturnsDirectories(): void
    {
        $this->seedDir('one');
        $this->seedDir('two');
        $this->seedFile('three.txt');
        $this->startServer();
        $folders = $this->apiGet('getFolders', ['dir' => $this->sandbox]);
        $texts = array_column($folders, 'text');
        $this->assertContains('one', $texts);
        $this->assertContains('two', $texts);
        $this->assertNotContains('three.txt', $texts);
    }

    public function testGetFolderTreeIncludesRoot(): void
    {
        $this->seedDir('branch');
        $this->startServer();
        $tree = $this->apiGet('getFolderTree', ['dir' => $this->sandbox]);
        $this->assertSame('/ [root]', $tree[0]['text']);
    }
}
