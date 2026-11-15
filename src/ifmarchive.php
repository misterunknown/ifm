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
	 * Recursively yields the entries below $folder as [name in the archive,
	 * path, is directory], named relative to $prefix.
	 *
	 * $exclude_callback is called with the bare name of every entry, files and
	 * directories alike; entries it rejects are skipped, directories together
	 * with their whole content. This is the single place where the filter is
	 * applied, for every archive backend. Directories which are reached a
	 * second time (symlink loops) are not descended into again.
	 */
	private static function walk($folder, $prefix, $exclude_callback = null, ?\ArrayObject $visited = null) {
		$visited = $visited ?? new \ArrayObject();
		$real = realpath($folder);
		if ($real === false || isset($visited[$real]))
			return;
		$visited[$real] = true;

		$handle = @opendir($folder);
		if ($handle === false)
			return;
		try {
			while (false !== ($f = readdir($handle))) {
				if ($f == '.' || $f == '..')
					continue;
				$path = $folder . '/' . $f;
				if (!is_readable($path))
					continue;
				if (is_callable($exclude_callback) && !$exclude_callback($f))
					continue;
				$name = $prefix . '/' . $f;
				if (is_dir($path)) {
					yield [$name, $path, true];
					yield from self::walk($path, $name, $exclude_callback, $visited);
				} elseif (is_file($path)) {
					yield [$name, $path, false];
				}
			}
		} finally {
			closedir($handle);
		}
	}

	/**
	 * Add a folder to an archive (\ZipArchive or \PharData)
	 */
	private static function addFolder($archive, $folder, $exclude_callback = null, $noCompressExtensions = []) {
		$archive->addEmptyDir(basename($folder));
		foreach (self::walk($folder, basename($folder), $exclude_callback) as [$name, $path, $isDir]) {
			if ($isDir) {
				$archive->addEmptyDir($name);
			} else {
				$archive->addFile($path, $name);
				if ($archive instanceof \ZipArchive)
					self::setZipCompression($archive, $name, $noCompressExtensions);
			}
		}
	}

	/**
	 * Set STORE compression for already compressed formats, DEFLATE otherwise
	 */
	private static function setZipCompression(\ZipArchive $archive, $name, $noCompressExtensions) {
		$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
		if (!empty($noCompressExtensions) && in_array($ext, $noCompressExtensions))
			$archive->setCompressionName($name, \ZipArchive::CM_STORE, 0);
		else
			$archive->setCompressionName($name, \ZipArchive::CM_DEFLATE, 6);
	}

	/**
	 * Find an executable in an absolute directory of $PATH
	 */
	private static function findExecutable($name) {
		$path = getenv('PATH');
		if ($path === false || $path === '')
			$path = '/usr/local/bin:/usr/bin:/bin'; // e.g. php-fpm clears the environment by default
		foreach (explode(PATH_SEPARATOR, $path) as $dir) {
			// relative entries (like ".") would resolve against the managed
			// directory, where users can upload files
			if ($dir === '' || ($dir[0] !== '/' && !preg_match('~^[A-Z]:[\\\\/]~i', $dir)))
				continue;
			$file = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . $name;
			if (@is_file($file) && @is_executable($file))
				return $file;
		}
		return null;
	}

	/**
	 * Create a zip file of a single file or directory using the system zip
	 * command (low memory usage, compression doesn't count towards PHP's
	 * time limit).
	 *
	 * zip never recurses on its own: the entry list is built by walk(), with
	 * $exclude_callback applied, and passed to zip via stdin, with wildcard
	 * processing disabled. Returns false if zip is not available or the list
	 * can't be passed safely; callers then fall back to \ZipArchive.
	 */
	public static function createZipSystem($source, $archivePath, $noCompressExtensions = [], $exclude_callback = null) {
		if (!function_exists('proc_open'))
			return false;
		$zipCmd = self::findExecutable('zip');
		if ($zipCmd === null)
			return false;

		$source = realpath($source);
		if ($source === false || (!is_dir($source) && !is_file($source)))
			return false;

		// let zip write to a temporary name and rename that when done: zip
		// appends ".zip" to archive names without extension, and an aborted
		// run must not leave a partial archive behind
		$archiveDir = realpath(dirname($archivePath));
		if ($archiveDir === false)
			return false;
		$archivePath = $archiveDir . DIRECTORY_SEPARATOR . basename($archivePath);
		$tmpArchive = $archiveDir . DIRECTORY_SEPARATOR . '.ifm-zip-' . bin2hex(random_bytes(8)) . '.zip';

		// an existing archive gets updated (entries added or replaced), like with
		// \ZipArchive: let zip work on a copy of it
		if (is_file($archivePath) && !@copy($archivePath, $tmpArchive))
			return false;

		// -nw: take names literally (no wildcards), -@: read the names from stdin
		$cmd = [$zipCmd, '-q', '-6', '-nw'];
		if (!empty($noCompressExtensions)) {
			$cmd[] = '-n';
			$cmd[] = implode(':', array_map(fn($e) => '.' . $e, $noCompressExtensions));
		}
		array_push($cmd, '-@', $tmpArchive);

		$devNull = (DIRECTORY_SEPARATOR === '\\') ? 'NUL' : '/dev/null';
		$proc = @proc_open($cmd, [0 => ['pipe', 'r'], 1 => ['file', $devNull, 'w'], 2 => ['file', $devNull, 'w']], $pipes, dirname($source));
		if (!is_resource($proc)) {
			@unlink($tmpArchive);
			return false;
		}

		$names = (function () use ($source, $exclude_callback) {
			yield basename($source);
			if (is_dir($source))
				foreach (self::walk($source, basename($source), $exclude_callback) as [$name])
					yield $name;
		})();
		$complete = true;
		foreach ($names as $name) {
			// zip reads one name per line, so names containing line breaks
			// can't be passed; leave those archives to \ZipArchive
			if (strpbrk($name, "\r\n") !== false || fwrite($pipes[0], $name . "\n") === false) {
				$complete = false;
				break;
			}
		}

		if (!$complete)
			proc_terminate($proc);
		fclose($pipes[0]);
		$exitCode = proc_close($proc);

		if (!$complete || $exitCode !== 0 || !is_file($tmpArchive) || !@rename($tmpArchive, $archivePath)) {
			@unlink($tmpArchive);
			return false;
		}
		return true;
	}

	/**
	 * Create a zip file
	 *
	 * $exclude_callback is applied to the names of all entries below the
	 * given directories and to the given files themselves.
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
		if (count($filenames) === 1 && self::createZipSystem($filenames[0], $archivename, $noCompressExtensions, $exclude_callback))
			return true;

		// Fallback to PHP \ZipArchive
		$a = new \ZipArchive();
		if ($a->open($archivename, \ZipArchive::CREATE) !== true)
			return false;

		foreach ($filenames as $f)
			if (is_dir($f)) {
				self::addFolder($a, $f, $exclude_callback, $noCompressExtensions);
			} elseif (is_file($f)) {
				$nameInArchive = basename($f);
				if (!is_callable($exclude_callback) || $exclude_callback($nameInArchive)) {
					$a->addFile($f, $nameInArchive);
					self::setZipCompression($a, $nameInArchive, $noCompressExtensions);
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
	public static function createTar($filenames, $archivename, $format, $exclude_callback = null) {
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
					self::addFolder($a, $f, $exclude_callback);
				} elseif (is_file($f) && (!is_callable($exclude_callback) || $exclude_callback(basename($f)))) {
					$a->addFile($f, basename($f));
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
		try {
			// the constructor throws as well, e.g. for corrupted archives
			$tar = new PharData($file);
			$tar->extractTo($destination, null, true);
			return true;
		} catch (Exception $e) {
			return false;
		}
	}
}
