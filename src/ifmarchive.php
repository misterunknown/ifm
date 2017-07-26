<?php

/* =======================================================================
 * Improved File Manager
 * ---------------------
 * License: This project is provided under the terms of the MIT LICENSE
 * http://github.com/misterunknown/ifm/blob/master/LICENSE
 * =======================================================================
 * 
 * zip class
 * 
 * this was adapted from http://php.net/manual/de/class.ziparchive.php#110719
*/

class IFMArchive {
	/**
	 * Add a folder to the zip file
	 */
	private static function folderToZip($folder, &$zipFile, $exclusiveLength) {
		$handle = opendir( $folder );
		while( false !== $f = readdir( $handle ) ) {
			if( $f != '.' && $f != '..'  ) {
				$filePath = "$folder/$f";
				if( file_exists( $filePath ) && is_readable( $filePath ) ) {
					// Remove prefix from file path before add to zip.
					$localPath = substr($filePath, $exclusiveLength);
					if( is_file( $filePath ) ) {
						$zipFile->addFile( $filePath, $localPath );
					} elseif( is_dir( $filePath ) ) {
						// Add sub-directory.
						$zipFile->addEmptyDir( $localPath );
						self::folderToZip( $filePath, $zipFile, $exclusiveLength );
					}
				}
			}
		}
		closedir( $handle );
	}

	/**
	 * Create a zip file
	 */
	public static function createZip( $src, $out, $root=false )
	{
		$z = new ZipArchive();
		$z->open( $out, ZIPARCHIVE::CREATE);
		if( $root ) {
			self::folderToZip( realpath( $src ), $z, strlen( realpath( $src ) . '/' ) );
		} else {
			$z->addEmptyDir( basename( $src ) );
			self::folderToZip( realpath( $src ), $z, strlen( dirname( $src ) . '/' ) );
		}
		try {
			if( ( $res = $z->close() ) !== true ) {
				throw new Exception("Error while creating zip archive: ". $z->getStatusString());
			}
		} catch ( Exception $e ) {
			throw $e;
		}
	}

	/**
	 * Unzip a zip file
	 */
	public static function extractZip( $file, $destination="./" ) {
		$zip = new ZipArchive;
		$res = $zip->open( $file );
		if( $res === true ) {
			$zip->extractTo( $destination );
			$zip->close();
			return true;
		} else {
			return false;
		}
	}

	public static function extractTar( $file, $destination="./" ) {
		if( ! file_exists( $file ) )
			return false;
		$tar = new PharData( $file );
		try {
			$tar->extractTo( $destination, null, true );
			return true;
		} catch (Exception $e) {
			return false;
		}
	}

	public static function createTar( $src, $out, $root=false ) {
		$tar = new PharData( $out );
		$tar->buildFromDirectory( $src );
	}
}
