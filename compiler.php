#!/usr/bin/env php
<?php

// This compiles the source files into one file

$IFM_CONFIG = "src/config.php";
$IFM_MAIN = "src/main.php";
$IFM_OTHER_PHPFILES = array("src/ifmzip.php");

$filename = "ifm.php";

// config
file_put_contents($filename, file_get_contents($IFM_CONFIG));

// other php classes
foreach ( $IFM_OTHER_PHPFILES as $file) {
	$content_file = file($file);
	unset($content_file[0]); // remove <?php line
	file_put_contents($filename, $content_file, FILE_APPEND);
}

// main
$content_main = file($IFM_MAIN);
unset($content_main[0]);
$content_main = implode($content_main);
$include_files = NULL;
preg_match_all( "/\@\@\@([^\@]+)\@\@\@/", $content_main, $include_files, PREG_SET_ORDER );
foreach( $include_files as $file ) {
	//echo $file[0]. " " .$file[1]."\n";
	$content_main = str_replace( $file[0], file_get_contents( $file[1] ), $content_main );
}
file_put_contents($filename, $content_main, FILE_APPEND);
