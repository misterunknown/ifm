<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Minimal smoke test: the server boots, getConfig answers and strips secrets.
 */
class SmokeTest extends IfmServerTestCase
{
    public function testGetConfigAnswersAndStripsSecrets(): void
    {
        $this->startServer();
        $cfg = $this->apiGet('getConfig');

        $this->assertArrayHasKey('csrf_token', $cfg);
        // secrets must not leak to the client
        foreach (['auth_source', 'root_dir', 'tmp_dir', 'session_name'] as $secret) {
            $this->assertArrayNotHasKey($secret, $cfg, "$secret must be stripped from getConfig");
        }
    }
}
