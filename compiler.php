#!/usr/bin/env php
<?php
/**
 * IFM compiler
 *
 * This script compiles all sources into one single file.
 */

chdir( realpath( dirname( __FILE__ ) ) );

$IFM_SRC_MAIN = "src/main.php";
$IFM_SRC_PHPFILES = array( "src/ifmzip.php" );
$IFM_SRC_JS = "src/ifm.js";

$IFM_BUILD_STANDALONE = "ifm.php";
$IFM_BUILD_LIB_PHP = "build/ifmlib.php";

/**
 * Prepare main script
 */
$main = file_get_contents( $IFM_SRC_MAIN );
$includes = NULL;
preg_match_all( "/\@\@\@([^\@]+)\@\@\@/", $main, $includes, PREG_SET_ORDER );
foreach( $includes as $file ) {
	$main = str_replace( $file[0], file_get_contents( $file[1] ), $main );
}

/**
 * Add PHP files
 */
$phpincludes = array();
foreach( $IFM_SRC_PHPFILES as $file ) {
	$content = file( $file );
	unset( $content[0] ); // remove <?php line
	$phpincludes = array_merge( $phpincludes, $content );
}

/**
 * Build standalone script
 */
file_put_contents( $IFM_BUILD_STANDALONE, $main );
file_put_contents( $IFM_BUILD_STANDALONE, $phpincludes, FILE_APPEND );
file_put_contents( $IFM_BUILD_STANDALONE,
'
/**
 * start IFM
 */
$ifm = new IFM();
$ifm->run();'
, FILE_APPEND );

/**
 * Build library
 */
file_put_contents( $IFM_BUILD_LIB_PHP, $main );
file_put_contents( $IFM_BUILD_LIB_PHP, $phpincludes, FILE_APPEND );
