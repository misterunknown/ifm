<?php

namespace IFM\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * White-box tests for checkUrlSsrf (the SSRF guard used by remoteUpload).
 * checkUrlSsrf is public, so it can be called directly.
 */
class SsrfTest extends TestCase
{
    private \IFM $ifm;

    protected function setUp(): void
    {
        $this->ifm = new \IFM(['root_dir' => sys_get_temp_dir()]);
    }

    #[DataProvider('blockedUrls')]
    public function testBlockedUrlsReturnFalse(string $url): void
    {
        $this->assertFalse($this->ifm->checkUrlSsrf($url), "should block: $url");
    }

    public static function blockedUrls(): array
    {
        return [
            'loopback v4'   => ['http://127.0.0.1/x'],
            'loopback name' => ['http://localhost/x'],
            'private 10'    => ['http://10.0.0.5/x'],
            'private 192'   => ['http://192.168.1.1/x'],
            'link-local'    => ['http://169.254.169.254/latest/meta-data'],
            'loopback v6'   => ['http://[::1]/x'],
            'bad scheme'    => ['file:///etc/passwd'],
            'gopher scheme' => ['gopher://127.0.0.1/'],
            'no host'       => ['notaurl'],
            'empty'         => [''],
        ];
    }

    public function testPublicIpIsAllowed(): void
    {
        // a literal public IP avoids depending on external DNS
        $result = $this->ifm->checkUrlSsrf('http://1.1.1.1/');
        $this->assertIsArray($result);
        $this->assertContains('1.1.1.1', $result);
    }
}
