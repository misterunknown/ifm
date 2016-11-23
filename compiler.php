<?php

// This compiles the source files into one file

$IFM_CONFIG = "src/config.php";
$IFM_INCLUDES = "src/includes.php";
$IFM_MAIN = "src/main.php";
$IFM_STYLE = "src/style.css";
$IFM_JS = "src/ifm.js";
$IFM_OTHER_PHPFILES = array("src/ifmzip.php");

$filename = "ifm.php";

// config
file_put_contents($filename, file_get_contents($IFM_CONFIG));

// includes
$content_includes = file($IFM_INCLUDES);
unset($content_includes[0]);
file_put_contents($filename, $content_includes, FILE_APPEND);

// other php classes
foreach ( $IFM_OTHER_PHPFILES as $file) {
	$content_file = file($file);
	unset($content_file[0]);
	file_put_contents($filename, $content_file, FILE_APPEND);
}

// main
$content_main = file($IFM_MAIN);
unset($content_main[0]);
$content_main = implode($content_main);
$content_main = str_replace("@@@COMPILE:style.css@@@", file_get_contents($IFM_STYLE), $content_main);
$content_main = str_replace("@@@COMPILE:ifm.js@@@", file_get_contents($IFM_JS), $content_main);
file_put_contents($filename, $content_main, FILE_APPEND);
