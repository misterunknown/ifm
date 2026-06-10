<?php

namespace IFM\Tests\Security;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * Self-overwrite protection: the running script file must not be writable
 * through the API while sitting in the initial working directory, unless
 * selfoverwrite is explicitly enabled.
 *
 * In the test harness the IFM class lives in dist/libifm.php, so that basename
 * is the protected one.
 */
class SelfOverwriteTest extends IfmServerTestCase
{
    private function scriptName(): string
    {
        return basename(dirname(__DIR__, 2) . '/dist/libifm.php'); // "libifm.php"
    }

    public function testCannotOverwriteSelfByDefault(): void
    {
        $this->startServer(['IFM_SELFOVERWRITE' => '0']);
        $token = $this->bootstrapCsrf();
        $name = $this->scriptName();

        $res = $this->csrfPost('saveFile', [
            'dir' => '.', 'filename' => $name, 'content' => '<?php /* hijacked */',
        ], $token);

        $this->assertErrorStatus($res);
        $this->refuteFileExists($this->sandbox . '/' . $name);
    }

    public function testCanOverwriteSelfWhenEnabled(): void
    {
        $this->startServer(['IFM_SELFOVERWRITE' => '1']);
        $token = $this->bootstrapCsrf();
        $name = $this->scriptName();

        $res = $this->csrfPost('saveFile', [
            'dir' => '.', 'filename' => $name, 'content' => 'allowed',
        ], $token);

        $this->assertOkStatus($res);
        $this->assertSame('allowed', file_get_contents($this->sandbox . '/' . $name));
    }
}
