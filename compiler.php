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

// output files and common attrs
define( "IFM_VERSION",       "v4.1.2" );
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
$options = getopt("", ["language::", "languages::", "lang::", "cdn"]);

// build CDN version?
if (isset($options['cdn'])) {
	define("IFM_CDN", true);
} else {
	define("IFM_CDN", false);
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
$compiled = str_replace("###ASSETS_CSS###", file_get_contents("src/assets".(IFM_CDN?".cdn":"").".css"), $compiled);
$compiled = str_replace("###ASSETS_JS###", file_get_contents("src/assets".(IFM_CDN?".cdn":"").".js"), $compiled);

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

if (!is_dir(IFM_RELEASE_DIR)) {
	mkdir(IFM_RELEASE_DIR);
}

// build standalone ifm
file_put_contents(IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : '') . IFM_STANDALONE, $compiled);
file_put_contents(IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : '') . IFM_STANDALONE, '
/**
 * start IFM
 */
$ifm = new IFM();
$ifm->run();
', FILE_APPEND);

// build compressed ifm
file_put_contents(
	IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : '') . IFM_STANDALONE_GZ,
	'<?php eval(gzdecode(file_get_contents(__FILE__, false, null, 79))); exit(0); ?>'
	. gzencode(file_get_contents(IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : '') . IFM_STANDALONE, false, null, 5))
);
// build lib
file_put_contents(IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : '') . IFM_LIB, $compiled);
