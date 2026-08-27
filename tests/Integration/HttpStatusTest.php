<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * API errors carry real HTTP status codes alongside the unchanged JSON body:
 * 401 unauthenticated, 403 policy denials (disabled feature, CSRF), 400 bad
 * input, 404 missing target, 405 wrong method, 500 server-side failures.
 */
class HttpStatusTest extends IfmServerTestCase
{
    private function authEnv(): array
    {
        $hash = password_hash('secret', PASSWORD_BCRYPT);
        return [
            'IFM_AUTH'        => '1',
            'IFM_AUTH_SOURCE' => "inline;admin:$hash",
        ];
    }

    public function testSuccessIs200(): void
    {
        $this->seedFile('a.txt');
        $this->startServer();
        $res = $this->apiPost('getFiles', ['dir' => '.']);
        $this->assertHttpCode(200);
        $this->assertIsArray($res);
    }

    public function testUnauthenticatedIs401(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth');
        $this->assertErrorStatus($res);
        $this->assertHttpCode(401);
    }

    public function testWrongCredentialsIs401(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiPost('checkAuth', ['inputLogin' => 'admin', 'inputPassword' => 'nope']);
        $this->assertErrorStatus($res);
        $this->assertHttpCode(401);
    }

    public function testWrongHeaderCredentialsIs401(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('getFiles', ['dir' => '.'], $this->authHeader('admin', 'WRONG'));
        $this->assertErrorStatus($res);
        $this->assertHttpCode(401);
    }

    public function testDisabledFeatureIs403(): void
    {
        $this->startServer(['IFM_CREATEDIR' => '0']);
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('createDir', ['dir' => '.', 'dirname' => 'nope'], $token);
        $this->assertErrorStatus($res);
        $this->assertHttpCode(403);
        $this->refuteFileExists($this->sandbox . '/nope');
    }

    public function testMissingCsrfTokenIs403(): void
    {
        $this->startServer();
        $this->bootstrapCsrf();
        $res = $this->apiPost('createDir', ['dir' => '.', 'dirname' => 'notok']);
        $this->assertErrorStatus($res);
        $this->assertHttpCode(403);
    }

    public function testGetOnStateChangingActionIs405(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->apiGet('createDir', ['dir' => '.', 'dirname' => 'x', 'csrf_token' => $token]);
        $this->assertErrorStatus($res);
        $this->assertHttpCode(405);
    }

    public function testInvalidFilenameIs400(): void
    {
        $this->startServer();
        $token = $this->bootstrapCsrf();
        $res = $this->csrfPost('rename', ['dir' => '.', 'filename' => '../escape', 'newname' => 'x'], $token);
        $this->assertErrorStatus($res);
        $this->assertHttpCode(400);
    }

    public function testUnknownApiIs400(): void
    {
        $this->startServer();
        $res = $this->apiGet('noSuchApi');
        $this->assertErrorStatus($res);
        $this->assertHttpCode(400);
    }

    public function testMissingFileIs404(): void
    {
        $this->startServer();
        $res = $this->apiPost('getContent', ['dir' => '.', 'filename' => 'ghost.txt']);
        $this->assertErrorStatus($res);
        $this->assertHttpCode(404);
    }

    public function testHeaderAuthSuccessStays200(): void
    {
        $this->seedFile('a.txt');
        $this->startServer($this->authEnv());
        $res = $this->apiPost('getFiles', ['dir' => '.'], $this->authHeader('admin', 'secret'));
        $this->assertHttpCode(200);
        $this->assertIsArray($res);
    }
}
