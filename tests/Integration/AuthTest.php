<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Authentication behaviour: no-auth mode, header auth in all accepted forms
 * (stateless), session login, wrong credentials, default-credential refusal,
 * and logout.
 */
class AuthTest extends IfmServerTestCase
{
    private function authEnv(string $user = 'admin', string $pass = 'secret'): array
    {
        $hash = password_hash($pass, PASSWORD_BCRYPT);
        return [
            'IFM_AUTH'        => '1',
            'IFM_AUTH_SOURCE' => "inline;$user:$hash",
        ];
    }

    public function testAuthDisabledAllowsAccess(): void
    {
        $this->startServer(['IFM_AUTH' => '0']);
        $res = $this->apiGet('checkAuth');
        $this->assertOkStatus($res);
    }

    public function testValidBasicHeaderAuthenticates(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth', [], $this->authHeader('admin', 'secret'));
        $this->assertOkStatus($res);
    }

    /**
     * Regression: X-IFM-AUTH historically carries bare base64 credentials
     * without the Basic scheme; existing API clients rely on that form.
     */
    public function testBareBase64XIfmAuthHeaderAuthenticates(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth', [], ['X-IFM-AUTH' => base64_encode('admin:secret')]);
        $this->assertOkStatus($res);
    }

    public function testStandardAuthorizationBasicAuthenticates(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth', [], ['Authorization' => 'Basic ' . base64_encode('admin:secret')]);
        $this->assertOkStatus($res);
    }

    /**
     * The standard Authorization header can carry other schemes (Bearer, ...),
     * so bare base64 must only be accepted on the custom X-IFM-AUTH header.
     */
    public function testBareBase64AuthorizationHeaderRejected(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth', [], ['Authorization' => base64_encode('admin:secret')]);
        $this->assertErrorStatus($res);
    }

    public function testNonBase64HeaderRejected(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth', [], ['X-IFM-AUTH' => '!!!not-base64!!!']);
        $this->assertErrorStatus($res);
    }

    public function testHeaderWithoutColonRejected(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth', [], ['X-IFM-AUTH' => base64_encode('adminsecret')]);
        $this->assertErrorStatus($res);
    }

    public function testEmptyPasswordInHeaderRejected(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth', [], ['X-IFM-AUTH' => base64_encode('admin:')]);
        $this->assertErrorStatus($res);
    }

    /** Bare-base64 header auth is stateless like the Basic form: CSRF-exempt. */
    public function testBareHeaderAuthIsCsrfExempt(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiPost(
            'createDir',
            ['dir' => '.', 'dirname' => 'viabareheader'],
            ['X-IFM-AUTH' => base64_encode('admin:secret')]
        );
        $this->assertOkStatus($res);
        $this->assertDirectoryExists($this->sandbox . '/viabareheader');
    }

    public function testWrongBasicHeaderRejected(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth', [], $this->authHeader('admin', 'WRONG'));
        $this->assertErrorStatus($res);
    }

    public function testNoCredentialsRejected(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiGet('checkAuth');
        $this->assertErrorStatus($res);
    }

    public function testSessionLoginThenAuthenticated(): void
    {
        $this->startServer($this->authEnv());
        // login via POSTed credentials (sets the session cookie in the jar)
        $login = $this->apiPost('checkAuth', [
            'inputLogin'    => 'admin',
            'inputPassword' => 'secret',
        ]);
        $this->assertOkStatus($login);

        // subsequent request (cookie only, no header) must stay authenticated
        $res = $this->apiGet('checkAuth');
        $this->assertOkStatus($res);
    }

    public function testSessionLoginWrongPasswordRejected(): void
    {
        $this->startServer($this->authEnv());
        $res = $this->apiPost('checkAuth', [
            'inputLogin'    => 'admin',
            'inputPassword' => 'nope',
        ]);
        $this->assertErrorStatus($res);
    }

    /** Security: must refuse to run when auth is on but creds are the public default. */
    public function testRefusesPubliclyKnownDefaultCredentials(): void
    {
        $default = 'inline;admin:$2y$10$0Bnm5L4wKFHRxJgNq.oZv.v7yXhkJZQvinJYR2p6X1zPvzyDRUVRC';
        $this->startServer([
            'IFM_AUTH'        => '1',
            'IFM_AUTH_SOURCE' => $default,
        ]);
        $res = $this->apiGet('checkAuth', [], $this->authHeader('admin', 'admin'));
        $this->assertErrorStatus($res);
    }

    public function testLogoutClearsSession(): void
    {
        $this->startServer($this->authEnv());
        $this->apiPost('checkAuth', ['inputLogin' => 'admin', 'inputPassword' => 'secret']);
        $this->assertOkStatus($this->apiGet('checkAuth'));

        // logout endpoint redirects; just trigger it through the cookie jar
        $this->client()->get('/index.php', [
            'query'           => ['api' => 'logout'],
            'allow_redirects' => false,
        ]);

        $res = $this->apiGet('checkAuth');
        $this->assertErrorStatus($res);
    }
}
