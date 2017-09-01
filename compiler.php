#!/usr/bin/env php
<?php
/**
 * IFM compiler
 *
 * This script compiles all sources into one single file.
 */

chdir( realpath( dirname( __FILE__ ) ) );

$IFM_SRC_PHP = array(
	0 => "src/main.php",
	1 => "src/ifmarchive.php",
	2 => "src/htpasswd.php"
);

$IFM_BUILD_STANDALONE = "ifm.php";
$IFM_BUILD_STANDALONE_COMPRESSED = "build/ifm.min.php";
$IFM_BUILD_LIB_PHP = "build/libifm.php";

$options = getopt( null, array( "language::" ) );
$vars['languages'] = isset( $options['language'] ) ? explode( ',', $options['language'] ) : array( "en" );
$vars['defaultlanguage'] = $vars['languages'][0];
$vars['languageincludes'] = "";
foreach( $vars['languages'] as $l ) {
	if( file_exists( "src/i18n/".$l.".json" ) ) 
		$vars['languageincludes'] .=
			'$i18n["'.$l.'"] = <<<\'f00bar\'' . "\n"
			. file_get_contents( "src/i18n/".$l.".json" ) . "\n"
			. 'f00bar;' . "\n"
			. '$i18n["'.$l.'"] = json_decode( $i18n["'.$l.'"], true );' . "\n" ;
	else
		print "WARNING: Language file src/i18n/".$l.".json not found.\n";
}

/**
 * Concat PHP Files
 */
$compiled = array( "<?php" );
foreach( $IFM_SRC_PHP as $phpfile ) {
	$lines = file( $phpfile );
	unset( $lines[0] ); // remove <?php line
	$compiled = array_merge( $compiled, $lines );
}
$compiled = join( $compiled );

/**
 * Process file includes
 */
$includes = NULL;
preg_match_all( "/\@\@\@file:([^\@]+)\@\@\@/", $compiled, $includes, PREG_SET_ORDER );
foreach( $includes as $file )
	$compiled = str_replace( $file[0], file_get_contents( $file[1] ), $compiled );

/**
 * Process variable includes
 */
$includes = NULL;
preg_match_all( "/\@\@\@vars:([^\@]+)\@\@\@/", $compiled, $includes, PREG_SET_ORDER );
foreach( $includes as $var )
	$compiled = str_replace( $var[0], $vars[$var[1]], $compiled );

/**
 * Build standalone script
 */
file_put_contents( $IFM_BUILD_STANDALONE, $compiled );
file_put_contents( $IFM_BUILD_STANDALONE, '
/**
 * start IFM
 */
$ifm = new IFM();
$ifm->run();
', FILE_APPEND );

/**
 * Build compressed standalone script
 * file_put_contents( $IFM_BUILD_STANDALONE_COMPRESSED, '<?php eval( gzdecode( file_get_contents( __FILE__, false, null, 85 ) ) ); exit(0); ?>' . gzencode( file_get_contents( "ifm.php", false, null, 5 ) ) );
 */

/**
 * Build library
 */
file_put_contents( $IFM_BUILD_LIB_PHP, $compiled );
