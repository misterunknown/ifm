#!/usr/bin/env php
<?php
/**
 * IFM compiler
 *
 * This script compiles all sources into one single file.
 */

chdir(realpath(dirname(__FILE__)));

// output files and common attrs
define("IFM_CDN",           false);
define("IFM_VERSION",       "<a href='https://github.com/misterunknown/ifm/releases/tag/v2.6.1' target=_blank>v2.6.1</a>" );
define("IFM_RELEASE_DIR",   "dist/");
define("IFM_STANDALONE",    "ifm.php" );
define("IFM_STANDALONE_GZ", "ifm.min.php" );
define("IFM_LIB",           "libifm.php" );

if (IFM_CDN)
	$IFM_ASSETS = "src/assets.cdn.part";
else
	$IFM_ASSETS = "src/assets.part";

// php source files
$IFM_SRC_PHP = array(
	0 => "src/main.php",
	1 => "src/ifmarchive.php",
	2 => "src/htpasswd.php"
);

// get options
$options = getopt(null, array("language::", "languages::", "cdn::"));

// process languages
$langs = array_unique(array_merge(explode(",", join(",", [$options['language']])), explode(",", join(",", [$options['languages']]))));
print_r($langs);
if (in_array("all", $langs)) {
	$available_languages = array_map(
		function($i) { return str_replace("src/i18n/", "", str_replace(".json", "", $i)); },
		glob("src/i18n/*.json")
	);
	// default language is english, if not given
	if ($langs[0] == 'all' || !file_exists($lang[0]))
		$default_lang = "en";
	else
		$default_lang = $lang[0];

	unset($available_langs[array_search($default_lang, $available_langs)]);
	$include_langs = array_merge($default_lang, $available_langs);
}

print_r($options['language']);
print_r($include_langs);
die();


// process languages
$vars['languages'] = isset($options['language']) ? explode(',', $options['language']) : ["all"];
$vars['defaultlanguage'] = $vars['languages'][0];

$vars['languageincludes'] = "";
foreach ($vars['languages'] as $l)
	if (file_exists("src/i18n/".$l.".json")) 
		$vars['languageincludes'] .=
			'$i18n["'.$l.'"] = <<<\'f00bar\'' . "\n"
			. file_get_contents( "src/i18n/".$l.".json" ) . "\n"
			. 'f00bar;' . "\n"
			. '$i18n["'.$l.'"] = json_decode( $i18n["'.$l.'"], true );' . "\n" ;
	else
		print "WARNING: Language file src/i18n/".$l.".json not found.\n";

// Concat PHP Files
$compiled = array( "<?php" );
foreach( $IFM_SRC_PHP as $phpfile ) {
	$lines = file( $phpfile );
	unset( $lines[0] ); // remove <?php line
	$compiled = array_merge( $compiled, $lines );
}
$compiled = join( $compiled );

$compiled = str_replace( "IFM_ASSETS", file_get_contents( $IFM_ASSETS ), $compiled );

// Process file includes
$includes = NULL;
preg_match_all( "/\@\@\@file:([^\@]+)\@\@\@/", $compiled, $includes, PREG_SET_ORDER );
foreach( $includes as $file )
	$compiled = str_replace( $file[0], file_get_contents( $file[1] ), $compiled );

// Process ace includes
$includes = NULL;
$vars['ace_includes'] = "";
preg_match_all( "/\@\@\@acedir:([^\@]+)\@\@\@/", $compiled, $includes, PREG_SET_ORDER );
foreach( $includes as $dir ) {
	$dircontent = "";
	foreach( glob( $dir[1]."/*" ) as $file ) {
		if( is_file( $file ) && is_readable( $file ) ) {
			$vars['ace_includes'] .= "|" . substr( basename( $file ), 0, strrpos( basename( $file ), "." ) );
			$dircontent .= file_get_contents( $file )."\n\n";
		}
	}
	$compiled = str_replace( $dir[0], $dircontent, $compiled );
}

// Process variable includes
$includes = NULL;
preg_match_all( "/\@\@\@vars:([^\@]+)\@\@\@/", $compiled, $includes, PREG_SET_ORDER );
foreach( $includes as $var )
	$compiled = str_replace( $var[0], $vars[$var[1]], $compiled );

$compiled = str_replace( 'IFM_VERSION', IFM_VERSION, $compiled );

if (!is_dir(IFM_RELEASE_DIR)){
    mkdir(IFM_RELEASE_DIR);
}

// build standalone ifm
file_put_contents( IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : 'simple.') . IFM_STANDALONE, $compiled );
file_put_contents( IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : 'simple.') . IFM_STANDALONE, '
/**
 * start IFM
 */
$ifm = new IFM();
$ifm->run();
', FILE_APPEND );

// build compressed ifm
file_put_contents(
	IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : 'simple.') . IFM_STANDALONE_GZ,
	'<?php eval( gzdecode( file_get_contents( __FILE__, false, null, 85 ) ) ); exit(0); ?>'
	. gzencode( file_get_contents( IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : 'simple.') .IFM_STANDALONE, false, null, 5 ) )
);
// build lib
file_put_contents( IFM_RELEASE_DIR . (IFM_CDN ? 'cdn.' : 'simple.') . IFM_LIB, $compiled );
