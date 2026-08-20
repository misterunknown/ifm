<?php

namespace IFM\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * White-box unit tests for the credential verification layer (Htpasswd / APR1_MD5).
 * Classes are loaded by tests/bootstrap.php from the compiled library.
 */
class HtpasswdTest extends TestCase
{
    public function testVerifyBcryptHash(): void
    {
        $hash = password_hash('secret', PASSWORD_BCRYPT);
        $h = new \Htpasswd();
        $this->assertTrue($h->verifyPassword('secret', $hash));
        $this->assertFalse($h->verifyPassword('wrong', $hash));
    }

    public function testVerifyApr1Hash(): void
    {
        $hash = \APR1_MD5::hash('secret');
        $this->assertStringStartsWith('$apr1$', $hash);
        $h = new \Htpasswd();
        $this->assertTrue($h->verifyPassword('secret', $hash));
        $this->assertFalse($h->verifyPassword('nope', $hash));
    }

    public function testVerifyShaHash(): void
    {
        $hash = '{SHA}' . base64_encode(sha1('secret', true));
        $h = new \Htpasswd();
        $this->assertTrue($h->verifyPassword('secret', $hash));
        $this->assertFalse($h->verifyPassword('wrong', $hash));
    }

    public function testVerifyCryptHash(): void
    {
        $hash = crypt('secret', '$1$abcdefgh$');
        $h = new \Htpasswd();
        $this->assertTrue($h->verifyPassword('secret', $hash));
        $this->assertFalse($h->verifyPassword('wrong', $hash));
    }

    public function testLoadAndVerifyFromFile(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'htp');
        $hash = password_hash('s3cr3t', PASSWORD_BCRYPT);
        file_put_contents($file, "alice:$hash\nbob:" . \APR1_MD5::hash('pw2') . "\n");

        $h = new \Htpasswd($file);
        $this->assertEqualsCanonicalizing(['alice', 'bob'], $h->getUsers());
        $this->assertTrue($h->userExist('alice'));
        $this->assertFalse($h->userExist('charlie'));

        $this->assertTrue($h->verify('alice', 's3cr3t'));
        $this->assertFalse($h->verify('alice', 'bad'));
        $this->assertTrue($h->verify('bob', 'pw2'));

        unlink($file);
    }

    /** Negative: unknown user must fail (and burns time against a dummy hash). */
    public function testVerifyUnknownUserReturnsFalse(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'htp');
        file_put_contents($file, 'alice:' . password_hash('x', PASSWORD_BCRYPT) . "\n");
        $h = new \Htpasswd($file);
        $this->assertFalse($h->verify('ghost', 'whatever'));
        unlink($file);
    }

    public function testLoadMissingFileReturnsFalse(): void
    {
        $h = new \Htpasswd();
        $this->assertFalse($h->load('/nonexistent/' . uniqid() . '.htpasswd'));
    }

    public function testApr1RoundTripCheck(): void
    {
        $hash = \APR1_MD5::hash('hunter2', 'abcdefgh');
        $this->assertTrue(\APR1_MD5::check('hunter2', $hash));
        $this->assertFalse(\APR1_MD5::check('hunter3', $hash));
    }
}
