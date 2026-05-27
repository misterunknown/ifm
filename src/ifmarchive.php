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
	private static function addFolder(&$archive, $folder, $offset=0, $exclude_callback=null, $noCompressExtensions = []) {
		if ($offset == 0) {
			$offset = strlen(dirname($folder)) + 1;
		}
		$archive->addEmptyDir(substr($folder, $offset));
		$handle = opendir($folder);
		while (false !== $f = readdir($handle)) {
			if ($f != '.' && $f != '..') {
				$filePath = $folder . '/' . $f;
				if (file_exists($filePath) && is_readable($filePath)) {
					if (is_file($filePath)) {
						if (!is_callable($exclude_callback) || $exclude_callback($f)) {
							$archive->addFile($filePath, substr($filePath, $offset));
							// Set STORE compression for already compressed formats (\ZipArchive only)
							if ($archive instanceof \ZipArchive) {
								$ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
								$nameInArchive = substr($filePath, $offset);
								if (!empty($noCompressExtensions) && in_array($ext, $noCompressExtensions)) {
									$archive->setCompressionName($nameInArchive, \ZipArchive::CM_STORE, 0);
								} else {
									$archive->setCompressionName($nameInArchive, \ZipArchive::CM_DEFLATE, 6);
								}
							}
						}
					} elseif (is_dir($filePath)) {
						if (is_callable($exclude_callback)) {
							self::addFolder($archive, $filePath, $offset, $exclude_callback, $noCompressExtensions);
						} else {
							self::addFolder($archive, $filePath, $offset, null, $noCompressExtensions);
						}
					}
				}
			}
		}
		closedir($handle);
	}

	/**
	 * Create a zip file using system zip command (low memory usage)
	 */
	public static function createZipSystem($source, $archivePath, $noCompressExtensions = []) {
		// Check if zip command is available
		$zipCmd = trim(shell_exec('which zip 2>/dev/null'));
		if (empty($zipCmd)) {
			return false;
		}

		$source = realpath($source);
		if (!$source) {
			return false;
		}

		// Change to source directory to avoid full paths in archive
		$sourceDir = dirname($source);
		$sourceName = basename($source);

		$currentDir = getcwd();
		chdir($sourceDir);

		$noCompressFlag = '';
		if (!empty($noCompressExtensions)) {
			$suffixes = implode(':', array_map(fn($e) => '.' . $e, $noCompressExtensions));
			$noCompressFlag = '-n ' . escapeshellarg($suffixes) . ' ';
		}

		$cmd = sprintf(
			'cd %s && %s -6 -r -q %s%s %s >/dev/null 2>&1',
			escapeshellarg($sourceDir),
			$zipCmd,
			$noCompressFlag,
			escapeshellarg($archivePath),
			escapeshellarg($sourceName)
		);

		system($cmd, $returnCode);
		chdir($currentDir);

		return $returnCode === 0 && file_exists($archivePath);
	}

	/**
	 * Create a zip file
	 */
	public static function createZip($filenames, $archivename, $exclude_callback=null, $noCompressExtensions = []) {
		// Default extensions to store without compression
		if (empty($noCompressExtensions)) {
			$noCompressExtensions = [
				'webm', 'mp4', 'avi', 'mkv', 'mov', 'ogv',
				'zip', 'gz', 'bz2', 'xz', 'rar', '7z', 'iso', 'deb', 'rpm',
				'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'ico',
				'woff', 'woff2',
				'mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a', 'opus',
				'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'pdf'
			];
		}

		if (!is_array($filenames)) {
			$filenames = array($filenames);
		}

		// Try system zip first for better memory efficiency
		if (is_array($filenames) && count($filenames) === 1) {
			$source = $filenames[0];
			if (is_dir($source) || is_file($source)) {
				$realPath = realpath($source);
				if ($realPath && self::createZipSystem($realPath, $archivename, $noCompressExtensions)) {
					return true;
				}
			}
		}
		
		// Fallback to PHP \ZipArchive
		$a = new \ZipArchive();
		$a->open($archivename, ZIPARCHIVE::CREATE);

		foreach ($filenames as $f)
			if (is_dir($f)) {
				if (is_callable($exclude_callback)) {
					self::addFolder($a, $f, null, $exclude_callback, $noCompressExtensions);
				} else {
					self::addFolder($a, $f, null, null, $noCompressExtensions);
				}
			} elseif (is_file($f)) {
				if (!is_callable($exclude_callback) || $exclude_callback($f)) {
					$nameInArchive = pathinfo($f, PATHINFO_BASENAME);
					$a->addFile($f, $nameInArchive);
					$ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
					if (!empty($noCompressExtensions) && in_array($ext, $noCompressExtensions)) {
						$a->setCompressionName($nameInArchive, \ZipArchive::CM_STORE, 0);
					} else {
						$a->setCompressionName($nameInArchive, \ZipArchive::CM_DEFLATE, 6);
					}
				}
			}

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
		if (!file_exists($file)) {
			return false;
		}
		$zip = new \ZipArchive;
		$res = $zip->open($file);
		if ($res === true) {
			$zip->extractTo($destination);
			$zip->close();
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Creates a tar archive
	 */
	public static function createTar($filenames, $archivename, $format) {
		if (!in_array($format, ["tar", "tar.gz", "tar.bz2"])) {
			return false;
		}
	
		$tmpf = tempnam(sys_get_temp_dir(), "ifmtar_");
		if ($tmpf === false) {
			return false;
		}
		@unlink($tmpf);
		$tmpf .= ".tar";

		try {
			$a = new PharData($tmpf);

			if (!is_array($filenames)) {
				$filenames = array($filenames);
			}

			foreach ($filenames as $f) {
				if (is_dir($f)) {
					self::addFolder($a, $f);
				} elseif (is_file($f)) {
					$a->addFile($f, pathinfo($f, PATHINFO_BASENAME));
				}
			}
			switch ($format) {
				case "tar.gz":
					$a->compress(Phar::GZ);
					@unlink($tmpf);
					$tmpf .= ".gz";
					break;
				case "tar.bz2":
					$a->compress(Phar::BZ2);
					@unlink($tmpf);
					$tmpf .= ".bz2";
					break;
			}

			if (!@rename($tmpf, $archivename . "." . $format)) {
				@unlink($tmpf);
				return false;
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
		if (!file_exists($file)) {
			return false;
		}
		$tar = new PharData($file);
		try {
			$tar->extractTo($destination, null, true);
			return true;
		} catch (Exception $e) {
			return false;
		}
	}
}
