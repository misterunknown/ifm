<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * CSRF protection on state-changing endpoints.
 */
class CsrfTest extends IfmServerTestCase
{
    public function testStateChangingActionRejectsGet(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        // createDir via GET (wrong method) must be refused even with a token
        $res = $this->apiGet('createDir', ['dir' => '.', 'dirname' => 'x', 'csrf_token' => $token]);
        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->sandbox . '/x');
    }

    public function testStateChangingActionRejectsMissingToken(): void
    {
        $this->startServer();
        $this->bootstrapCsrf(); // establish session, but send no token
        $res = $this->apiPost('createDir', ['dir' => '.', 'dirname' => 'notok']);
        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->sandbox . '/notok');
    }

    public function testStateChangingActionRejectsWrongToken(): void
    {
        $this->startServer();
        $this->bootstrapCsrf();
        $res = $this->csrfPost('createDir', ['dir' => '.', 'dirname' => 'bad'], 'deadbeef-not-the-token');
        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->sandbox . '/bad');
    }

    public function testValidTokenAccepted(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('createDir', ['dir' => '.', 'dirname' => 'good'], $token);
        $this->assertOkStatus($res);
        $this->assertDirectoryExists($this->sandbox . '/good');
    }

    /** Header-authenticated (stateless) requests are CSRF-exempt. */
    public function testHeaderAuthIsCsrfExempt(): void
    {
        $hash = password_hash('secret', PASSWORD_BCRYPT);
        $this->startServer([
            'IFM_AUTH'        => '1',
            'IFM_AUTH_SOURCE' => "inline;admin:$hash",
        ]);
        // No CSRF token at all, but authenticated via header -> allowed
        $res = $this->apiPost(
            'createDir',
            ['dir' => '.', 'dirname' => 'viaheader'],
            $this->authHeader('admin', 'secret')
        );
        $this->assertOkStatus($res);
        $this->assertDirectoryExists($this->sandbox . '/viaheader');
    }
}
