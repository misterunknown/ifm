#!/usr/bin/env php
<?php
/**
 * IFM compiler
 *
 * This script compiles all sources into one single file.
 */

chdir(realpath(dirname(__FILE__)));

// php source files
$IFM_SRC_PHP = array(
	0 => "src/main.php",
	1 => "src/ifmarchive.php",
	2 => "src/htpasswd.php"
);

// output files
define("IFM_STANDALONE",    "ifm.php");
define("IFM_STANDALONE_GZ", "build/ifm.min.php");
define("IFM_LIB",           "build/libifm.php");

// get options
$options = getopt(null, array("language::"));

// process languages
$vars['languages'] = isset($options['language']) ? explode(',', $options['language']) : array("en");
$vars['defaultlanguage'] = $vars['languages'][0];
$vars['languageincludes'] = "";
foreach($vars['languages'] as $l) {
	if(file_exists("src/i18n/".$l.".json")) 
		$vars['languageincludes'] .=
			'$i18n["'.$l.'"] = <<<\'f00bar\'' . "\n"
			. file_get_contents( "src/i18n/".$l.".json" ) . "\n"
			. 'f00bar;' . "\n"
			. '$i18n["'.$l.'"] = json_decode($i18n["'.$l.'"], true);' . "\n" ;
	else
		print "WARNING: Language file src/i18n/".$l.".json not found.\n";
}

// Concat PHP Files
$compiled = array("<?php");
foreach($IFM_SRC_PHP as $phpfile) {
	$lines = file($phpfile);
	unset( $lines[0] ); // remove <?php line
	$compiled = array_merge( $compiled, $lines );
}
$compiled = join( $compiled );

// Process multi file includes
$includes = NULL;
preg_match_all( "/\@\@\@files:([^\@]+)\@\@\@/", $compiled, $matches, PREG_SET_ORDER );
foreach($matches as $match) {
	$concat = "";
	foreach(glob($match[1]) as $file)
		$concat .= file_get_contents($file)."\n";
	$compiled = str_replace($match[0], $concat, $compiled);
}

// Process single file includes
$includes = NULL;
preg_match_all( "/\@\@\@file:([^\@]+)\@\@\@/", $compiled, $matches, PREG_SET_ORDER );
foreach( $matches as $match )
	$compiled = str_replace( $match[0], file_get_contents( $match[1] ), $compiled );

// Process ace includes
$includes = NULL;
$vars['ace_includes'] = "";
preg_match_all( "/\@\@\@acedir:([^\@]+)\@\@\@/", $compiled, $matches, PREG_SET_ORDER );
foreach($matches as $match) {
	$dircontent = "";
	foreach(glob($match[1]."/*") as $file) {
		if(is_file($file) && is_readable($file)) {
			$vars['ace_includes'] .= "|" . substr(basename($file), 0, strrpos(basename($file), "."));
			$dircontent .= file_get_contents($file)."\n\n";
		}
	}
	$compiled = str_replace($match[0], $dircontent, $compiled);
}

// Process variable includes
$includes = NULL;
preg_match_all("/\@\@\@vars:([^\@]+)\@\@\@/", $compiled, $matches, PREG_SET_ORDER);
foreach($matches as $match)
	$compiled = str_replace($match[0], $vars[$match[1]], $compiled );

// build standalone ifm
file_put_contents( IFM_STANDALONE, $compiled );
file_put_contents( IFM_STANDALONE, '
/**
 * start IFM
 */
$ifm = new IFM();
$ifm->run();
', FILE_APPEND );

/* // build compressed ifm
file_put_contents(
	IFM_STANDALONE_GZ,
	'<?php eval(gzdecode(file_get_contents(__FILE__, false, null, 85))); exit(0); ?>'
	. gzencode(file_get_contents("ifm.php", false, null, 5))
);
 */

// build lib
file_put_contents(IFM_LIB, $compiled);
