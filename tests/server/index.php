<?php
/**
 * Test front controller for IFM integration tests.
 *
 * It loads the compiled, bootstrap-free library (dist/libifm.php) and starts
 * IFM with a configuration assembled entirely from IFM_* environment variables
 * (which the IFM constructor reads natively). Each test scenario boots the
 * built-in PHP server with its own environment, giving full control over auth,
 * feature flags and the root_dir jail.
 *
 * The current working directory is set to IFM_INITIAL_WD (defaulting to
 * root_dir) so that "initial working directory" semantics are deterministic.
 */

$lib = getenv('IFM_LIB_PATH');
if ($lib === false || $lib === '') {
    $lib = __DIR__ . '/../../dist/libifm.php';
}
require $lib;

// Allow tests to control the process CWD (used for "initialWD" semantics such
// as self-overwrite protection and the isDocroot flag).
$initialWd = getenv('IFM_INITIAL_WD');
if ($initialWd !== false && $initialWd !== '' && is_dir($initialWd)) {
    chdir($initialWd);
}

$ifm = new IFM();
$ifm->run();
