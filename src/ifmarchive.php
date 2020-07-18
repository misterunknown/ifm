<?php

/**
 * =======================================================================
 * Improved File Manager
 * ---------------------
 * License: This project is provided under the terms of the MIT LICENSE
 * http://github.com/misterunknown/ifm/blob/master/LICENSE
 * =======================================================================
 * 
 * archive class
 *
 * This class provides support for various archive types for the IFM. It can
 * create and extract the following formats:
 * 	* zip
 * 	* tar
 * 	* tar.gz
 * 	* tar.bz2
*/

class IFMArchive {

	/**
	 * Add a folder to an archive
	 */
	private static function addFolder(&$archive, $folder, $offset=0, $exclude_callback=null) {
		if ($offset == 0)
			$offset = strlen(dirname($folder)) + 1;
		$archive->addEmptyDir(substr($folder, $offset));
		$handle = opendir($folder);
		while (false !== $f = readdir($handle)) {
			if ($f != '.' && $f != '..') {
				$filePath = $folder . '/' . $f;
				if (file_exists($filePath) && is_readable($filePath)) {
					if (is_file($filePath)) {
						if (!is_callable($exclude_callback) || $exclude_callback($f))
							$archive->addFile( $filePath, substr( $filePath, $offset ) );
					} elseif (is_dir($filePath)) {
						if (is_callable($exclude_callback))
							self::addFolder($archive, $filePath, $offset, $exclude_callback);
						else
							self::addFolder($archive, $filePath, $offset);
					}
				}
			}
		}
		closedir($handle);
	}

	/**
	 * Create a zip file
	 */
	public static function createZip($src, $out, $exclude_callback=null) {
		$a = new ZipArchive();
		$a->open($out, ZIPARCHIVE::CREATE);

		if (!is_array($src))
			$src = array($src);

		foreach ($src as $s)
			if (is_dir($s))
				if (is_callable($exclude_callback))
					self::addFolder( $a, $s, null, $exclude_callback );
				else
					self::addFolder( $a, $s );
			elseif (is_file($s))
				if (!is_callable($exclude_callback) || $exclude_callback($s))
					$a->addFile($s, substr($s, strlen(dirname($s)) + 1));

		try {
			return $a->close();
		} catch (Exception $e) {
			return false;
		}
	}

	/**
	 * Unzip a zip file
	 */
	public static function extractZip($file, $destination="./") {
		if (!file_exists($file))
			return false;
		$zip = new ZipArchive;
		$res = $zip->open($file);
		if ($res === true) {
			$zip->extractTo($destination);
			$zip->close();
			return true;
		} else
			return false;
	}

	/**
	 * Creates a tar archive
	 */
	public static function createTar($src, $out, $t) {
		$tmpf = substr($out, 0, strlen($out) - strlen($t)) . "tar";
		$a = new PharData($tmpf);

		try { 
			if (!is_array($src))
				$src = array($src);

			foreach ($src as $s)
				if (is_dir($s))
					self::addFolder($a, $s);
				elseif (is_file($s))
					$a->addFile($s, substr($s, strlen(dirname($s)) +1)); 
			switch ($t) {
			case "tar.gz":
				$a->compress(Phar::GZ);
				@unlink($tmpf);
				break;
			case "tar.bz2":
				$a->compress(Phar::BZ2);
				@unlink($tmpf);
				break;
			}
			return true;
		} catch (Exception $e) {
			@unlink($tmpf);
			return false;
		}
	}

	/**
	 * Extracts a tar archive
	 */
	public static function extractTar($file, $destination="./") {
		if (!file_exists($file))
			return false;
		$tar = new PharData($file);
		try {
			$tar->extractTo($destination, null, true);
			return true;
		} catch (Exception $e) {
			return false;
		}
	}
}
