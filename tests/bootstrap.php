<?php
/**
 * PHPUnit bootstrap.
 *
 * 1. Loads the composer autoloader (PHPUnit, Guzzle, test PSR-4).
 * 2. Ensures the compiled, bootstrap-free library (dist/libifm.php) exists and
 *    is newer than the sources. The whole suite deliberately tests the COMPILED
 *    artifact that actually ships, not src/ directly.
 * 3. Loads the library in-process so Unit tests can instantiate IFM /
 *    IFMArchive / Htpasswd directly (integration tests use it via php -S).
 */

require __DIR__ . '/../vendor/autoload.php';

$root = dirname(__DIR__);
$lib  = $root . '/dist/libifm.php';

$sources = [
    $root . '/src/main.php',
    $root . '/src/ifmarchive.php',
    $root . '/src/htpasswd.php',
    $root . '/compiler.php',
];

$needsBuild = !file_exists($lib);
if (!$needsBuild) {
    $libMtime = filemtime($lib);
    foreach ($sources as $s) {
        if (file_exists($s) && filemtime($s) > $libMtime) {
            $needsBuild = true;
            break;
        }
    }
}

if ($needsBuild) {
    $output = [];
    $code = 0;
    exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/compiler.php') . ' 2>&1', $output, $code);
    if ($code !== 0 || !file_exists($lib)) {
        fwrite(STDERR, "Failed to build dist/libifm.php:\n" . implode("\n", $output) . "\n");
        exit(1);
    }
}

// Minimal superglobals so the IFM constructor is happy under CLI (unit tests).
$_SERVER['REQUEST_URI']    = $_SERVER['REQUEST_URI']    ?? '/index.php';
$_SERVER['SCRIPT_NAME']    = $_SERVER['SCRIPT_NAME']    ?? '/index.php';
$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'GET';

require $lib;
