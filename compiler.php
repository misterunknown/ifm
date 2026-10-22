#!/usr/bin/env php
<?php
/**
 * IFM compiler
 *
 * This script compiles all sources into one single file.
 */

chdir(realpath(dirname(__FILE__)));

require_once 'vendor/autoload.php';

function minify_file(string $path): string {
    $content = file_get_contents($path);
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $is_already_minified = strpos(basename($path), '.min.') !== false;
    if ($is_already_minified) return $content;
    if ($ext === 'css') return (new MatthiasMullie\Minify\CSS($content))->minify();
    if ($ext === 'js')  return (new MatthiasMullie\Minify\JS($content))->minify();
    return $content;
}

/**
 * Read the Vue 3 + Vite production bundle (frontend/dist/ifm-vue.js and
 * frontend/dist/ifm-vue.css, built via `make frontend-build`) and wrap it
 * for inlining into the single-file dist. The bundle is already minified
 * and fully self-contained (fonts/assets are data URIs), so unlike the
 * legacy assets it needs no further processing — and it must NOT pass
 * through the ###file:###/###vars:### scans below, which is why the caller
 * injects it after those have run.
 *
 * @return array{css: string, js: string}
 */
function ifm_vue_bundle(): array {
    $jsPath = __DIR__ . "/frontend/dist/ifm-vue.js";
    $cssPath = __DIR__ . "/frontend/dist/ifm-vue.css";
    foreach (["js" => $jsPath, "css" => $cssPath] as $kind => $path) {
        if (!is_file($path) || !is_readable($path)) {
            file_put_contents("php://stderr", "Missing Vue bundle: {$path}.\nBuild it first: make frontend-build\n");
            exit(1);
        }
    }
    return [
        "css" => "<style type=\"text/css\">\n" . file_get_contents($cssPath) . "\n</style>",
        "js" => "<script>\n" . file_get_contents($jsPath) . "\n</script>",
    ];
}

// output files and common attrs

/**
 * Resolve the IFM version without hand-editing this file.
 *
 * Order of precedence:
 *   1. IFM_VERSION environment variable (set by CI / release builds)
 *   2. a VERSION file next to this script (source tarballs without git)
 *   3. `git describe` against the working tree (dev and tagged builds)
 *   4. a hard fallback when none of the above is available
 */
function ifm_resolve_version(): string {
	$env = getenv("IFM_VERSION");
	if (is_string($env) && trim($env) !== "") {
		return trim($env);
	}

	$versionFile = __DIR__ . "/VERSION";
	if (is_file($versionFile)) {
		$v = trim((string) file_get_contents($versionFile));
		if ($v !== "") {
			return $v;
		}
	}

	// .git is a directory in a normal clone, but a file in worktrees/submodules
	if (file_exists(__DIR__ . "/.git")) {
		$out = @shell_exec(
			"git -C " . escapeshellarg(__DIR__) . " describe --tags --always --dirty 2>/dev/null"
		);
		if (is_string($out) && trim($out) !== "") {
			$v = trim($out);
			// keep the leading "v" convention even if a tag omitted it
			if (preg_match('/^[0-9]/', $v)) {
				$v = "v" . $v;
			}
			return $v;
		}
	}

	return "v0.0.0-dev";
}

define( "IFM_VERSION",       ifm_resolve_version() );
define( "IFM_RELEASE_DIR",   "dist/");
define( "IFM_STANDALONE",    "ifm.php" );
define( "IFM_STANDALONE_GZ", "ifm.min.php" );
define( "IFM_LIB",           "libifm.php" );

// php source files
$IFM_SRC_PHP = [
	0 => "src/main.php",
	1 => "src/ifmarchive.php",
	2 => "src/htpasswd.php"
];

// get options
$options = getopt("", ["language::", "languages::", "lang::", "cdn", "vue"]);

// build CDN version?
if (isset($options['cdn'])) {
	define("IFM_CDN", true);
} else {
	define("IFM_CDN", false);
}

// build Vue 3 + Vite frontend instead of the legacy jQuery frontend?
if (isset($options['vue'])) {
	define("IFM_VUE", true);
} else {
	define("IFM_VUE", false);
}

if (IFM_VUE && IFM_CDN) {
	file_put_contents("php://stderr", "--vue and --cdn are mutually exclusive: the Vue bundle is always self-contained.\n");
	exit(1);
}

// process languages
$langs = [];
foreach ($options as $key => $value) {
	if (substr($key, 0, 4) == "lang") {
		$langs = array_merge($langs, explode(",", $value));
	}
}

$langs = array_unique($langs);
if (!empty($langs)) {
	$vars['default_lang'] = ($langs[0] == "all") ? "en" : $langs[0];
} else {
	$vars['default_lang'] = "en";
}
// ensure english is available, as it gets merged with the other languages
// in case of missing keys in other languages.
if (!in_array("all", $langs) || !in_array("en", $langs)) {
	array_push($langs, "en");
}

if (in_array("all", $langs))
	$langs = array_map(
		function ($lang_file) { return pathinfo($lang_file)['filename']; },
		glob("src/i18n/*.json")
	);

// Application shell: the legacy frontend boots via `new IFM().init()`,
// while the Vue bundle mounts itself on #app. Default builds produce
// byte-identical output to previous versions.
if (IFM_VUE) {
	$vars['app_shell'] = '<div id="app"></div>';
	$vars['app_init'] = '';
} else {
	$vars['app_shell'] = '<div id="ifm"></div>';
	$vars['app_init'] = '<script>var ifm = new IFM(); ifm.init("ifm");</script>';
}

$vars['languageincludes'] = "";
foreach ($langs as $l) {
	$langPath = "src/i18n/".$l.".json";
	if (file_exists($langPath)) {
		$raw = file_get_contents($langPath);
		$decoded = json_decode($raw, true);
		if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
			print "WARNING: ".$langPath." is invalid JSON (".json_last_error_msg()."), embedding as-is.\n";
			$content = $raw;
		} else {
			$content = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
		}
		$vars['languageincludes'] .=
			'$i18n["'.$l.'"] = <<<\'f00bar\'' . "\n"
			. $content . "\n"
			. 'f00bar;' . "\n"
			. '$i18n["'.$l.'"] = json_decode( $i18n["'.$l.'"], true );' . "\n" ;
	} else {
		print "WARNING: Language file ".$langPath." not found.\n";
	}
}

// Concat PHP Files
$compiled = ["<?php"];
foreach ($IFM_SRC_PHP as $phpfile) {
	$lines = file($phpfile);
	unset($lines[0]); // remove <?php line
	$compiled = array_merge($compiled, $lines);
}
$compiled = join($compiled);

// Include assets
if (IFM_VUE) {
	// Deferred: the built Vue bundle is injected after the placeholder
	// scans below (it must not pass through them). Temporary tokens use a
	// shape none of those scans match.
	$compiled = str_replace("###ASSETS_CSS###", "###VUE_CSS###", $compiled);
	$compiled = str_replace("###ASSETS_JS###", "###VUE_JS###", $compiled);
} else {
	$compiled = str_replace("###ASSETS_CSS###", file_get_contents("src/assets".(IFM_CDN?".cdn":"").".css"), $compiled);
	$compiled = str_replace("###ASSETS_JS###", file_get_contents("src/assets".(IFM_CDN?".cdn":"").".js"), $compiled);
}

// Process file includes
$includes = NULL;
preg_match_all("/\#\#\#file:([^\#]+)\#\#\#/", $compiled, $includes, PREG_SET_ORDER);
foreach ($includes as $file) {
	$compiled = str_replace($file[0], minify_file($file[1]), $compiled);
}

// Process ace includes
$includes = null;
$vars['ace_includes'] = "";
preg_match_all("/\#\#\#acedir:([^\#]+)\#\#\#/", $compiled, $includes, PREG_SET_ORDER);
foreach ($includes as $dir) {
	$dircontent = "";
	foreach (glob($dir[1] . "/*") as $file) {
		if (is_file($file) && is_readable($file)) {
			$vars['ace_includes'] .= "|" . substr(basename($file), 0, strrpos(basename($file), "."));
			$dircontent .= file_get_contents($file)."\n\n";
		}
	}
	$compiled = str_replace($dir[0], $dircontent, $compiled);
}

// Process variable includes
$includes = NULL;
preg_match_all("/\#\#\#vars:([^\#]+)\#\#\#/", $compiled, $includes, PREG_SET_ORDER);
foreach( $includes as $var ) {
	$compiled = str_replace($var[0], $vars[$var[1]], $compiled);
}

$compiled = str_replace('IFM_VERSION', IFM_VERSION, $compiled);

if (IFM_VUE) {
	$vue = ifm_vue_bundle();
	$compiled = str_replace("###VUE_CSS###", $vue['css'], $compiled);
	$compiled = str_replace("###VUE_JS###", $vue['js'], $compiled);
	// Footer version token used by the Vue bundle (see frontend/src/store).
	$compiled = str_replace('__IFM_VERSION__', IFM_VERSION, $compiled);
}

if (!is_dir(IFM_RELEASE_DIR)) {
	mkdir(IFM_RELEASE_DIR);
}

// Output prefix: vue builds ship alongside (never clobber) the legacy dist.
$prefix = IFM_VUE ? 'vue.' : (IFM_CDN ? 'cdn.' : '');

// build standalone ifm
file_put_contents(IFM_RELEASE_DIR . $prefix . IFM_STANDALONE, $compiled);
file_put_contents(IFM_RELEASE_DIR . $prefix . IFM_STANDALONE, '
/**
 * start IFM
 */
$ifm = new IFM();
$ifm->run();
', FILE_APPEND);

// build compressed ifm
file_put_contents(
	IFM_RELEASE_DIR . $prefix . IFM_STANDALONE_GZ,
	'<?php eval(gzdecode(file_get_contents(__FILE__, false, null, 79))); exit(0); ?>'
	. gzencode(file_get_contents(IFM_RELEASE_DIR . $prefix . IFM_STANDALONE, false, null, 5))
);
// build lib
file_put_contents(IFM_RELEASE_DIR . $prefix . IFM_LIB, $compiled);
