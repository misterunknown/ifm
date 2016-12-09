<?php

/* =======================================================================
 * Improved File Manager
 * ---------------------
 * License: This project is provided under the terms of the MIT LICENSE
 * http://github.com/misterunknown/ifm/blob/master/LICENSE
 * =======================================================================
 *
 * main
*/

class IFM {
	const VERSION = '2.1';

	public function __construct() {
		session_start();
	}

	/*
	   this function contains the client-side application
	 */

	public function getApplication() {
		print '<!DOCTYPE HTML>
		<html>
			<head>
				<title>IFM - improved file manager</title>
				<meta charset="utf-8"><script>'.IFMIncludes::getJquery().'</script>
				<script>'.IFMIncludes::getJqueryUI().'</script>
				<script>'.IFMIncludes::getAce().'</script>
				<script>'.IFMIncludes::getJqueryFancybox().'</script>
    			<style type="text/css">
				'; ?>
				@@@COMPILE:style.css@@@
				<?php
				print ''.IFMIncludes::getJqueryUICSS()."\n".IFMIncludes::getJqueryFancyboxCSS().'
				</style>
				<script type="text/javascript">
				'; ?>
				@@@COMPILE:ifm.js@@@
				<?php print '
				</script>
			</head>
			<body>
				<table id="tooltab">
					<tbody>
						<tr>
							<td class="cell_content">
								Content of <span id="docroot">';
								if(IFMConfig::showpath == 1) print $this->getScriptRoot().'/'; else print '/';
								print '</span><input id="currentDir" type="text">
							</td>
							<td class="cell_buttons">
								<div>';
									// refresh button - always shows
									print '<button id="refresh">';
									echo ('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABZ0RVh0Q3JlYXRpb24gVGltZQAwOC8xOC8wOaw6EPwAAAAcdEVYdFNvZnR3YXJlAEFkb2JlIEZpcmV3b3JrcyBDUzQGstOgAAACdUlEQVRYhcWXMXraQBCFf/tLDzkBugHKCVA7FdwgpEkbpU1jfAPdILqBSTWtfIIoJwjcwHTpSLEjWJaVjAT+/Bqh1czs29m3M8vdfr/nPXE/xElEUhFZvRsBYAnkIjK+lsCHgX4LYATkwApcVoAUSMymBmpV3XQFuuurAZvot73ugB/AV2Da4vIMFKq6vhWBAvjWy+lIZKGqL/7gEA0sBvgAzIAq1M2rBEQk8X6nwKTDfIdb6Z+W71PgZCs6CdhRy7yhZYf5g6qOVTVT1RT4CDxG7GYicojTSkBESiBR1dIb7kr/SSxVfVHVFfAJlxkfi6iTTTwWkcqMcm886Zgc3zYgUnNOfN5KAChxgsl9xarqRlUT3Iq+A78Cv5Gf2oBEhdPGGU4KkR2xObANUu8Hq3FFpjCfBU4nGa4oRf1w4pu1EhCRjOP5XrUEiRFaW3BEJBGRcXjWDXXM389A6QUtzywvI7O50PSwHfcAtneT8OON4RegQy1oROirtHojAqk9d3jZbgjMQ+s3QLPIwtdIrB1He7zVgQpY9dWI+U6BLXZ6GsTqQBYL4gnsp4hsRGTV40KytOdF3XBqRzKGRjwT4AFoiCRtMxvJHPhiNeQEDYGwe62t84WogveREfkrImVLRnKgbNu2hkARjI9wvTus75tYEENro1LVaJ8A70YkIjXxa9WWYxXLjFwMj9b9esE/BUtcisMJJnRfQsCd7TCLF+EgQhNIhltxXxQt9f9yAh6JFHeTCS8RPv55vwevHjpuxabojGMJBSfCCtctP9vYoL1/lUAX7A7whFt9MjT9MPyvWWXPwXt/FQGb9Jkr9r7BoC24Jf4DVBHtitmrnbcAAAAASUVORK5CYII=" title="refresh" />');
									print '</button>';
									// upload button
									if(IFMConfig::upload == 1) {
										print '<button id="upload">';
										print '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAK8AAACvABQqw0mAAAABZ0RVh0Q3JlYXRpb24gVGltZQAwOC8xOC8wOaw6EPwAAAAcdEVYdFNvZnR3YXJlAEFkb2JlIEZpcmV3b3JrcyBDUzQGstOgAAABNUlEQVRYhe1W4c6DIAw8lD1cn/ge7lPZj4lhVaDIFrLku8RERdqjPU5cCAEjMQ3N/k/gJwiIyNu9iHgRCSIyX33zUQIiApJpEg/gbx9eRGQCAJK3SWQJVJJHrL0kLgkYk3+EhCsZkSF5ipnkFufFBdwm0Jj8RMKKkghdY3Lg1Y6mCb4yvgFISzSr8VU9N/9YihpIsa8s/TiQ7DYyF0KwKtfhVZGDADqdlOTRAl3aHAGNKfPeijUSWG5MdjhroDmGFmEtYE2EVhxxUgILyUduRkaEtV2Ui7Nhb53XgwUHO/W6JN5oyxfx3uI0r0ChJMLVYsc92yiKcLm6rI74rROR2RGHH8laNaD/DTmYK3AiUOhdIGlxzCOORQeaQNFaew6fCbLb0KPfWpsxXITm88C3MLwCwwk8Af8Lgc7C878GAAAAAElFTkSuQmCC" title="Upload" />';
										print '</button>';
									}
									// create file button
									if(IFMConfig::createfile == 1) {
										print '<button id="createFile">';
										print '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAK8AAACvABQqw0mAAAABZ0RVh0Q3JlYXRpb24gVGltZQAwOC8xOC8wOaw6EPwAAAAcdEVYdFNvZnR3YXJlAEFkb2JlIEZpcmV3b3JrcyBDUzQGstOgAAABDUlEQVRYhe2VsRGCQBBFn475WYIlUAIhm9mBlkIp0oHZppZACZQgFWjgoSdzCo4sJPejm+UP+2//8lkVRXFjJqjqql9bz9X8EzbdIaZuKojIxykvPoEkIAlIApKATaz4LbnG4JdUjQqYIpZFZAeUwD6oXYEzUKpqA0YWiEgG1MABcMEj52u159hYALRh426iwXsdcBGRbHILROTE45ZDcEBpYcF+mPLiWlkQnWJY8z2chQU/iY8K+BMt4EIhkSV8cs0sGImzhQU7HhngBqgtFl+BT7jcN+hE3XpTbYFcVRuTJFTVGsiAKhTizxWQeY7JEnYiGuAIr51S1W2ft/jvOAlYXMBzCWcMnzcsPoE7bQ1jbIj6ZSQAAAAASUVORK5CYII=" title="create file" />';
										print '</button>';
									}
									// create directory button
									if(IFMConfig::createdir == 1) {
										print '<button id="createDir">';
										print '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAK8AAACvABQqw0mAAAABZ0RVh0Q3JlYXRpb24gVGltZQAwOC8xOC8wOaw6EPwAAAAcdEVYdFNvZnR3YXJlAEFkb2JlIEZpcmV3b3JrcyBDUzQGstOgAAABP0lEQVRYhe2WsVWEQBCGP3zmZweeHdiBGBhMJLHRdSAlUMJZgS1ANCl2gBV4diAV7AUc7+3dAwGZPQzuD4dd/n9nZv/ZyDnHkrhalP0i4CIAuAYQkTVQAauR+2pgrao/cwW0GcgnkHNYm80lB4icc4hIaDN4VNWy68P/6IEOfKhqvJSAGqgClaVQ1cQPdJUgB14DkAPcnAbO3QPlGAGz7/Yv2A0JKIDkdJEhng6m1yugAm4DCngBvkRk0yfgXHgXkRSOnfCTpkbPlkyqGgF9bnvnZyC3Jh+BzBcQsvv7kLRO+A3cW/21TXtfzCvHyh/HsZWAKfBngdn18xtuoAmbW2BEuqPjEAMCCksfyP6wZ2uWAQARKYGHkcvfVDW1dsKEZp6MIgfDHvAhIjGQcmxsNc043vrvwyACpmDxR+niAvY9F2dckINLRQAAAABJRU5ErkJggg==" title="create directory" />';
										print '</button>';
									}
									// create options button
									print '	<div id="options"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABZ0RVh0Q3JlYXRpb24gVGltZQAwOC8xOC8wOaw6EPwAAAAcdEVYdFNvZnR3YXJlAEFkb2JlIEZpcmV3b3JrcyBDUzQGstOgAAACh0lEQVRYhcWWzXHbMBCFP2VSgEqQKzBdgZXjnuwORFdguYOkAitpwHIH8ukdzVRgugKrg6gD5YClAoIgTf9k9GY0GiyweMv9xWS/33NMfDkqO/D1vYpmVgBPkehMUv1fDDCzOVACS0k7F58mx06B2s9PgRWwllQN3f1qCMzsDngEFv7foEiOxuvDeTNbf8iAlMQN6jXA9+O986ELx4RgQ3B/g9LMdsA8OTd38jKRb4Yun4wpQzP7A0xfPZhHIem5b7PjAf+KOfAT2Eja0vXCWGwlPXvFlMAFUEm6ag60PODZ/phcUgNb4DKR76K9GSHuqZe2/j9L5N+a6kg9kEuYgnZSbYGrXHn5B9xFhClxgwVQQVIFkn4Q6rcPa0LD6ZC7fgWc+bk+VMCyWWST0MwWmUtqgut2HYWu/pQQyrRU13H8oacPSLqnm3Q3Y8hdfwfcJOJVSg6RBzxT41+cD1tJJ2PIY5jZC+08+E3wZA3Ukuo4CePBkuLhreSR3nW0Pqf9YZOxrXiU69+jd/T3wMEASRNC7EtCKcazPW1CY5HqVX536Vz9syAzWE68LY+Cmc2Al0jUKUHIhMDMpj1TbahB5ZCeL6NRfkA6C/oaSIN7SalhHfgjZNGz3Wpo6Sy4HSAHWLiRy1w43O0rwtTrQ+E8VzkD1rRdvyOM4hn/HiAXwIWZPdBO1CJDXBMm5CzDA2SS0MxuXWkj6cFlTwx7pg+1pDMzOyV82CVD74EcMtn8VgxWz5hGlIvndUZWkx/DQ/kwyoBlsi4l/cIfFBEa16ZGlB81ICZa+aiGdgIe1m5EvFcxgFcN8AvnwHdJ8YzPGuCYEzxRJDodjHqW5+CZfSD1WfJmvNuAz8Jf0AgKZKIIqsQAAAAASUVORK5CYII=" title="options" /><ul>';
									$options = false;
									if(IFMConfig::remoteupload == 1) {
										print '<li><a onclick="ifm.remoteUploadDialog()">Remote upload</a></li>';
										$options = true;
									}
									if(IFMConfig::ajaxrequest == 1) {
										print '<li><a onclick="ifm.ajaxRequestDialog()">AJAX Request</a></li>';
										$options = true;
									}
									if(!$options) print '<li>No options available</li>';
									print '</ul></div>';
									print '<span id="version">ver '.IFM::VERSION.'</span>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
				<table id="filetable">
					<thead>
						<tr>
							<th>Filename</th>';
							if(IFMConfig::download == 1) print '<th><!-- column for download link --></th>';
							if(IFMConfig::showlastmodified == 1) print '<th>last modified</th>';
							if(IFMConfig::showfilesize == 1) print '<th>Filesize</th>';
							if(IFMConfig::showrights > 0)print '<th>Permissions</th>';
							if(IFMConfig::showowner == 1 && function_exists( "posix_getpwuid" ) ) print '<th>Owner</th>';
							if(IFMConfig::showgroup == 1 && function_exists( "posix_getgrgid" ) ) print '<th>Group</th>';
							if(in_array(1,array(IFMConfig::edit,IFMConfig::rename,IFMConfig::delete,IFMConfig::zipnload,IFMConfig::extract))) print '<th><!-- column for buttons --></th>';
						print '</tr>
					</thead>
					<tbody>
					</tbody>
				</table>
				<footer>IFM - improved file manager | ifm.php hidden | <a href="http://github.com/misterunknown/ifm">Visit the project on GitHub</a></footer>
			</body>
			</html>
		';
	}

	/*
	   main functions
	 */

	private function handleRequest() {
		if($_REQUEST["api"] == "getRealpath") {
			if( isset( $_REQUEST["dir"] ) && $_REQUEST["dir"] != "" )
				$this->getRealpath( $_REQUEST["dir"] );
			else
				echo json_encode(array("realpath"=>""));
		}
		elseif( $_REQUEST["api"] == "getFiles" ) {
			if( isset( $_REQUEST["dir"] ) && $this->isPathValid( $_REQUEST["dir"] ) )
				$this->getFiles( $_REQUEST["dir"] );
			else
				$this->getFiles( "" );
		}
		else {
			if( isset( $_REQUEST["dir"] ) && $this->isPathValid( $_REQUEST["dir"] ) ) {
				switch( $_REQUEST["api"] ) {
					case "createDir": $this->createDir( $_REQUEST["dir"], $_REQUEST["dirname"] ); break;
					case "saveFile": $this->saveFile( $_REQUEST ); break;
					case "getContent": $this->getContent( $_REQUEST ); break;
					case "deleteFile": $this->deleteFile( $_REQUEST ); break;
					case "renameFile": $this->renameFile( $_REQUEST ); break;
					case "downloadFile": $this->downloadFile( $_REQUEST ); break;
					case "extractFile": $this->extractFile( $_REQUEST ); break;
					case "uploadFile": $this->uploadFile( $_REQUEST ); break;
					case "changePermissions": $this->changePermissions( $_REQUEST ); break;
					case "zipnload": $this->zipnload( $_REQUEST); break;
					case "remoteUpload": $this->remoteUpload( $_REQUEST ); break;
					case "deleteMultipleFiles": $this->deleteMultipleFiles( $_REQUEST ); break;
					default: echo json_encode(array("status"=>"ERROR", "message"=>"No valid api action given")); break;
				}
			} else {
				print json_encode(array("status"=>"ERROR", "message"=>"No valid working directory"));
			}
		}
	}

	public function run() {
		if ( $this->checkAuth() ) {
			if ( ! isset($_REQUEST['api']) ) {
					$this->getApplication();
			} else {
				$this->handleRequest();
			}
		}
	}

	/*
	   api functions
	 */

	private function getFiles($dir) {
		// SECURITY FUNCTION (check that we don't operate on a higher level that the script itself)
		$dir=$this->getValidDir($dir);
		// now we change in our target directory
		$this->chDirIfNecessary($dir);
		// unset our file and directory arrays
		unset($files); unset($dirs); $files = array(); $dirs = array();
		// so lets loop over our directory
		if ($handle = opendir(".")) {
			while (false !== ($result = readdir($handle))) { // this awesome statement is the correct way to loop over a directory :)
				if( $result == basename( $_SERVER['SCRIPT_NAME'] ) && $this->getScriptRoot() == getcwd() ) { } // we don't want to see the script itself
				elseif( ( $result == ".htaccess" || $result==".htpasswd" ) && IFMConfig::showhtdocs != 1 ) {} // check if we are granted to see .ht-docs
				elseif( $result == "." ) {} // the folder itself will also be invisible
				elseif( $result != ".." && substr( $result, 0, 1 ) == "." && IFMConfig::showhiddenfiles != 1 ) {} // eventually hide hidden files, if we should not see them
				elseif( ! @is_readable( $result ) ) {}
				else { // thats are the files we should see
					$item = array();
					$i = 0;
					$item["name"] = $result;
					$i++;
					if( is_dir($result) ) {
						$item["type"] = "dir";
					} else {
						$item["type"] = "file";
					}
					if( is_dir( $result ) ) {
						$item["picture"] = "folder.png";
					} else {
						$type = substr( strrchr( $result, "." ), 1 );
						$item["picture"] = $this->getTypePicture( $type );
					}
					if( IFMConfig::showlastmodified == 1 ) { $item["lastmodified"] = date( "d.m.Y, G:i e", filemtime( $result ) ); }
					if( IFMConfig::showfilesize == 1 ) {
						$item["filesize"] = filesize( $result );
						if( $item["filesize"] > 1073741824 ) $item["filesize"] = round( ( $item["filesize"]/1073741824 ), 2 ) . " GB";
						elseif($item["filesize"]>1048576)$item["filesize"] = round( ( $item["filesize"]/1048576 ), 2 ) . " MB";
						elseif($item["filesize"]>1024)$item["filesize"] = round( ( $item["filesize"]/1024 ), 2 ) . " KB";
						else $item["filesize"] = $item["filesize"] . " Byte";
					}
					if( IFMConfig::showrights > 0 ) {
						if( IFMConfig::showrights == 1 ) $item["fileperms"] = substr( decoct( fileperms( $result ) ), -3 );
						elseif( IFMConfig::showrights == 2 ) $item["fileperms"] = $this->filePermsDecode( fileperms( $result ) );
						if( $item["fileperms"] == "" ) $item["fileperms"] = " ";
						$item["filepermmode"] = ( IFMConfig::showrights == 1 ) ? "short" : "long";
					}
					if( IFMConfig::showowner == 1  ) {
						if ( function_exists( "posix_getpwuid" ) && fileowner($result) !== false ) {
							$ownerarr = posix_getpwuid( fileowner( $result ) );
							$item["owner"] = $ownerarr['name'];
						} else $item["owner"] = false;
					}
					if( IFMConfig::showgroup == 1 ) {
						if( function_exists( "posix_getgrgid" ) && filegroup( $result ) !== false ) {
							$grouparr = posix_getgrgid( filegroup( $result ) );
							$item["group"] = $grouparr['name'];
						} else $item["group"] = false;
					}
					if( is_dir( $result ) ) $dirs[] = $item;
					else $files[] = $item;
				}
			}
			closedir( $handle );
		}
		usort( $dirs, array( $this, "sortByName" ) );
		usort( $files, array( $this, "sortByName" ) );
		echo json_encode( array_merge( $dirs, $files ) );
	}

	// creates a directory
	private function createDir($w, $dn) {
		if( $dn == "" ) {
			echo json_encode( array( "status" => "ERROR", "message" => "No valid directory name") );
		} elseif( strpos( $dn, '/' ) !== false ) echo json_encode( array( "status" => "ERROR", "message" => "No slashes allowed in directory names" ) );
		else {
			$this->chDirIfNecessary( $w );
			if( @mkdir( $dn ) ) {
				echo json_encode( array( "status" => "OK", "message" => "Directory successful created" ) );
			} else {
				echo json_encode( array( "status" => "ERROR", "message" => "Could not create directory" ) );
			}
		}
	}

	// save a file
	private function saveFile(array $d) {
		if( isset( $d['filename'] ) && $d['filename'] != "" ) {
			// if you are not allowed to see .ht-docs you can't save one
			if( IFMConfig::showhtdocs != 1 && substr( $d['filename'], 0, 3 ) == ".ht" ) {
				echo json_encode( array( "status" => "ERROR", "message" => "You are not allowed to edit or create htdocs" ) );
			}
			// same with hidden files
			elseif( IFMConfig::showhiddenfiles != 1 && substr( $d['filename'], 0, 1 ) == "." ) {
				echo json_encode( array( "status" => "ERROR", "message" => "You are not allowed to edit or create hidden files" ) );
			}
			elseif(strpos($d['filename'],'/')!==false) {
				echo json_encode( array( "status" => "ERROR", "message" => "Filenames cannot contain slashes." ) );
			} else {
				if( isset( $d['content'] ) ) {
					$this->chDirIfNecessary( $d['dir'] );
					// work around magic quotes
					$content = get_magic_quotes_gpc() == 1 ? stripslashes( $d['content'] ) : $d['content'];
					if( @file_put_contents( $d['filename'], $content ) !== false ) {
						echo json_encode( array( "status" => "OK", "message" => "File successfully saved" ) );
					} else {
						echo json_encode( array( "status" => "ERROR", "message" => "Could not write content" ) );
					}
				} else {
					echo json_encode( array( "status" => "ERROR", "message" => "Got no content" ) );
				}
			}
		} else {
			echo json_encode( array( "status" => "ERROR", "message" => "No filename specified" ) );
		}
	}

	// gets the content of a file
	// notice: if the content is not JSON encodable it returns an error
	private function getContent( array $d ) {
		if( IFMConfig::edit != 1 ) echo json_encode( array( "status" => "ERROR", "message" => "No permission to edit files" ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			if( file_exists( $d['filename'] ) ) {
				$content = @file_get_contents( $d['filename'] );
				$utf8content = mb_convert_encoding( $content, 'UTF-8', mb_detect_encoding( $content, 'UTF-8, ISO-8859-1', true ) );
				echo json_encode( array( "status" => "OK", "data" => array( "filename" => $d['filename'], "content" => $utf8content ) ) );
			} else echo json_encode( array( "status" => "ERROR", "message" => "File not found" ) );
		}
	}

	// deletes a file or a directory (recursive!)
	private function deleteFile( array $d ) {
		if( IFMConfig::delete != 1 ) {
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to delete files" ) );
		}
		else {
			$this->chDirIfNecessary( $d['dir'] );
			if( is_dir( $d['filename'] ) ) {
				$res = $this->rec_rmdir( $d['filename'] );
				if( $res != 0 ) {
					echo json_encode( array( "status" => "ERROR", "message" => "No permission to delete files" ) );
				} else {
				   echo json_encode( array( "status" => "OK", "message" => "Directoy successful deleted" ) );
				}
			}
			else{
				if( @unlink( $d['filename'] ) ) {
					echo json_encode( array( "status" => "OK", "message" => "File successful deleted" ) );
				} else {
					echo json_encode( array( "status"=>"ERROR", "message" => "File could not be deleted" ) );
				}
			}
		}
	}

	// deletes a bunch of files or directories
	private function deleteMultipleFiles( array $d ) {
		if( IFMConfig::delete != 1 || IFMConfig::multiselect != 1 ) echo json_encode( array( "status" => "ERROR", "message" => "No permission to delete multiple files" ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			$err = array(); $errFLAG = -1; // -1 -> no files deleted; 0 -> at least some files deleted; 1 -> all files deleted
			foreach( $d['filenames'] as $file ) {
				if( is_dir($file) ){
					$res = $this->rec_rmdir( $file );
					if( $res != 0 )
					   array_push( $err, $file );
					else
						$errFLAG = 0;
				} else {
					if( @unlink($file) )
						$errFLAG = 0;
					else
						array_push($err, $file);
				}
			}
			if( empty( $err ) ) {
				echo json_encode( array( "status" => "OK", "message" => "Files deleted successfully", "errflag" => "1" ) );
			}
			else {
				$errmsg = "The following files could not be deleted:<ul>";
				foreach($err as $item)
					$errmsg .= "<li>".$item."</li>";
				$errmsg .= "</ul>";
				echo json_encode( array( "status" => "OK", "message" => $errmsg, "flag" => $errFLAG ) );
			}
		}
	}

	// renames a file
	private function renameFile( array $d ) {
		if( IFMConfig::rename != 1 ) {
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to rename files" ) );
		} else {
			$this->chDirIfNecessary( $d['dir'] );
			if( strpos( $d['newname'], '/' ) !== false )
				echo json_encode( array( "status" => "ERROR", "message" => "No slashes allowed in filenames" ) );
			elseif( IFMConfig::showhtdocs != 1 && ( substr( $d['newname'], 0, 3) == ".ht" || substr( $d['filename'], 0, 3 ) == ".ht" ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to rename this file" ) );
			elseif( IFMConfig::showhiddenfiles != 1 && ( substr( $d['newname'], 0, 1) == "." || substr( $d['filename'], 0, 1 ) == "." ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to rename file" ) );
			else {
				if( @rename( $d['filename'], $d['newname'] ) )
					echo json_encode( array( "status" => "OK", "message" => "File successful renamed" ) );
				else
					echo json_encode( array( "status" => "ERROR", "message" => "File could not be renamed" ) );
			}
		}
	}

	// provides a file for downloading
	private function downloadFile( array $d ) {
		if( IFMConfig::download != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to download files" ) );
		elseif( IFMConfig::showhtdocs != 1 && ( substr( $d['filename'], 0, 3 ) == ".ht" || substr( $d['filename'],0,3 ) == ".ht" ) )
			echo json_encode( array( "status" => "ERROR", "message"=>"Not allowed to download htdocs" ) );
		elseif( IFMConfig::showhiddenfiles != 1 && ( substr( $d['filename'], 0, 1 ) == "." || substr( $d['filename'],0,1 ) == "." ) )
			echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to download hidden files" ) );
		else {
			$this->chDirIfNecessary( $d["dir"] );
			$this->file_download( $d['filename'] );
		}
	}

	// extracts a zip-archive
	private function extractFile( array $d ) {
		if( IFMConfig::extract != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to extract files" ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			if( ! file_exists( $d['filename'] ) || substr( $d['filename'],-4 ) != ".zip" )
				echo json_encode( array( "status" => "ERROR","message" => "No valid zip file found" ) );
			else {
				if( ! isset( $d['targetdir'] ) )
					$d['targetdir'] = "";
				if( strpos( $d['targetdir'], "/" ) !== false )
					echo json_encode( array( "status" => "ERROR","message" => "Target directory must not contain slashes" ) );
				else {
					switch( $d['targetdir'] ){
						case "":
							if( $this->unzip( $_POST["filename"] ) )
								echo json_encode( array( "status" => "OK","message" => "File successfully extracted." ) );
							else
								echo json_encode( array( "status" => "ERROR","message" => "File could not be extracted" ) );
							break;
						default:
							if( ! mkdir( $d['targetdir'] ) )
								echo json_encode( array( "status" => "ERROR","message" => "Could not create target directory" ) );
							else {
								chdir( $d['targetdir'] );
								if( ! $this->unzip( "../" . $d["filename"] ) ) {
									chdir( ".." );
									rmdir( $d['targetdir'] );
									echo json_encode( array( "status" => "ERROR","message" => "Could not extract file" ) );
								}
								else {
									chdir( ".." );
									echo json_encode( array( "status" => "OK","message" => "File successfully extracted" ) );
								}
							}
						break;
					}
				}
			}
		}
	}

	// uploads a file
	private function uploadFile( array $d ) {
		if( IFMConfig::upload != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to upload files" ) );
		elseif( !isset( $_FILES['file'] ) )
			echo json_encode( array( "file" => $_FILE,"files" => $_FILES ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			$newfilename = ( isset( $d["newfilename"] ) && $d["newfilename"]!="" ) ? $d["newfilename"] : $_FILES['file']['name'];
			if( IFMConfig::showhtdocs != 1 && ( substr( $newfilename, 0, 3 ) == ".ht" || substr( $newfilename,0,3 ) == ".ht" ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to upload htdoc file" ) );
			elseif( IFMConfig::showhiddenfiles != 1 && ( substr( $newfilename, 0, 1 ) == "." || substr( $newfilename,0,1 ) == "." ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to upload hidden file" ) );
			else {
				if( $_FILES['file']['tmp_name'] ) {
					if( is_writable( getcwd( ) ) ) {
						if( move_uploaded_file( $_FILES['file']['tmp_name'], $newfilename ) )
							echo json_encode( array( "status" => "OK", "message" => "The file ".$_FILES['file']['name']." was uploaded successfully", "cd" => $d['dir'] ) );
						else
							echo json_encode( array( "status" => "ERROR", "message" => "File could not be uploaded" ) );
					}
					else {
						echo json_encode( array( "status" => "ERROR", "message" => "File could not be uploaded since it has no permissions to write in this directory" ) );
					}
				} else {
					echo json_encode( array( "status" => "ERROR", "message" => "No file found" ) );
				}
			}
		}
	}

	// change permissions of a file
	private function changePermissions( array $d ) {
		if( IFMConfig::chmod != 1 ) echo json_encode( array( "status" => "ERROR", "message" => "No rights to change permissions" ) );
		elseif( ! isset( $d["chmod"] )||$d['chmod']=="" ) echo json_encode( array( "status" => "ERROR", "message" => "Could not identify new permissions" ) );
		elseif( ! isPathValid( pathCombine( $d['dir'],$d['filename'] ) ) ) { echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to change the permissions" ) ); }
		else {
			chDirIfNecessary( $d['dir'] ); $chmod = $d["chmod"]; $cmi = true;
			if( ! is_numeric( $chmod ) ) {
				$cmi = false;
				$chmod = str_replace( " ","",$chmod );
				if( strlen( $chmod )==9 ) {
					$cmi = true;
					$arr = array( substr( $chmod,0,3 ),substr( $chmod,3,3 ),substr( $chmod,6,3 ) );
					$chtmp = "0";
					foreach( $arr as $right ) {
						$rtmp = 0;
						if( substr( $right,0,1 )=="r" ) $rtmp = $rtmp + 4; elseif( substr( $right,0,1 )<>"-" ) $cmi = false;
						if( substr( $right,1,1 )=="w" ) $rtmp = $rtmp + 2; elseif( substr( $right,1,1 )<>"-" ) $cmi = false;
						if( substr( $right,2,1 )=="x" ) $rtmp = $rtmp + 1; elseif( substr( $right,2,1 )<>"-" ) $cmi = false;
						$chtmp = $chtmp . $rtmp;
					}
					$chmod = intval( $chtmp );
				}
			}
			else $chmod = "0" . $chmod;

			if( $cmi ) {
				try {
					chmod( $d["filename"], (int)octdec( $chmod ) );
					echo json_encode( array( "status" => "OK", "message" => "Permissions changed successfully" ) );
				} catch ( Exception $e ) {
					echo json_encode( array( "status" => "ERROR", "message" => "Error while changing permissions" ) );
				}
			}
			else echo json_encode( array( "status" => "ERROR", "message" => "Could not determine permission format" ) );
		}
	}

	// zips a directory and provides it for downloading
	// it creates a temporary zip file in the current directory, so it has to be as much space free as the file size is
	private function zipnload( array $d ) {
		if( IFMConfig::zipnload != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to download directories" ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			if( ! file_exists( $d['filename'] ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Directory not found" ) );
			elseif ( ! $this->allowedFileName( $d['filename'] ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Filename not allowed" ) );
			else {
				unset( $zip );
				$dfile = uniqid( "ifm-tmp-" ) . ".zip"; // temporary filename
				try {
					IFMZip::create_zip( realpath( $d['filename'] ), $dfile, ( $d['filename'] == "." ) );
					if( $d['filename'] == "." ) {
						if( getcwd() == $this->getScriptRoot() )
							$d['filename'] = "root";
						else
							$d['filename'] = basename( getcwd() );
					}
					$this->file_download( $dfile, $d['filename'] . ".zip" );
				} catch ( Exception $e ) {
					echo "An error occured: " . $e->getMessage();
				} finally {
					if( file_exists( $dfile ) ) @unlink( $dfile );
				}
			}
		}
	}

	// uploads a file from an other server using the curl extention
	private function remoteUpload( array $d ) {
		if( IFMConfig::remoteupload != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to remote upload files" ) );
		elseif( !isset( $d['method'] ) || !in_array( $d['method'], array( "curl", "file" ) ) )
			echo json_encode( array( "status" => "error", "message" => "No valid method given. Valid methods: ['curl', 'file']" ) );
		elseif( $d['method']=="curl" && $this->checkCurl( ) == false )
			echo json_encode( array( "status" => "ERROR", "message" => "cURL extention not installed. Please install the cURL extention to use remote file upload." ) );
		elseif( $d['method']=="curl" && $this->checkCurl( ) == true ) {
			$filename = ( isset( $d['filename'] )&&$d['filename']!="" )?$d['filename']:"curl_".uniqid( );
			$this->chDirIfNecessary( $d['dir'] );
			$ch = curl_init( );
			if( $ch ) {
				if( $this->allowedFileName( $filename ) == false )
					echo json_encode( array( "status" => "ERROR", "message" => "This filename is not allowed due to the config." ) );
				elseif( filter_var( $d['url'], FILTER_VALIDATE_URL ) === false )
					echo json_encode( array( "status" => "ERROR", "message" => "The passed URL is not valid" ) );
				else {
					$fp = fopen( $filename, "w" );
					if( $fp ) {
						if( !curl_setopt( $ch, CURLOPT_URL, $d['url'] ) || !curl_setopt( $ch, CURLOPT_FILE, $fp ) || !curl_setopt( $ch, CURLOPT_HEADER, 0 ) || !curl_exec( $ch ) )
							echo json_encode( array( "status" => "ERROR", "message" => "Failed to set options and execute cURL" ) );
						else {
							echo json_encode( array( "status" => "OK", "message" => "File sucessfully uploaded" ) );
						}
						curl_close( $ch );
						fclose( $fp );
					} else {
						echo json_encode( array( "status" => "ERROR", "message" => "Failed to open file" ) );
					}
				}
			} else {
				echo json_encode( array( "status" => "ERROR", "message" => "Failed to init cURL." ) );
			}
		}
		elseif( $d['method']=='file' ) {
			$filename = ( isset( $d['filename'] ) && $d['filename']!="" ) ? $d['filename'] : "curl_".uniqid( );
			$this->chDirIfNecessary( $d['dir'] );
			try {
				file_put_contents( $filename, file_get_contents( $d['url'] ) );
				echo json_encode( array( "status" => "OK", "message" => "File successfully uploaded" ) );
			} catch( Exception $e ) {
				echo json_encode( array( "status" => "ERROR", "message" => $e->getMessage() ) );
			}
		}
		else echo json_encode( array( "status" => "error", "message" => "Corrupt parameter data" ) );
	}

	//apis

	/*
	   help functions
	 */

	public function checkAuth() {
		if(IFMConfig::auth == 1 && $_SESSION['auth'] !== true) {
			$login_failed = false;
			if(isset($_POST["user"]) && isset($_POST["pass"])) {
				if($this->checkCredentials($_POST["user"], $_POST["pass"])) {
					$_SESSION['auth'] = true;
				}
				else {
					$_SESSION['auth'] = false;
					$login_failed = true;
				}
			}

			if($_SESSION['auth'] !== true) {
				if(isset($_POST["api"]) && $login_failed === true)
					echo json_encode(array("status"=>"ERROR", "message"=>"authentication failed"));
				elseif(isset($_POST["api"]) && $login_failed !== true)
					echo json_encode(array("status"=>"ERROR", "message"=>"not authenticated"));
				else
					$this->loginForm($login_failed);
				return false;
			} else {
				return true;
			}
		} else {
			return true;
		}
	}

	private function checkCredentials($user, $pass) {
		list($src, $srcopt) = explode(";", IFMConfig::auth_source, 2);
		switch($src) {
			case "inline":
				list($uname, $hash) = explode(":", $srcopt);
				break;
			case "file":
				if(@file_exists($srcopt) && @is_readable($srcopt)) {
					list($uname, $hash) = explode(":", fgets(fopen($srcopt, 'r')));
				} else {
					return false;
				}
				break;
		}
		return password_verify($pass, trim($hash))?($uname == $user):false;
	}

	private function loginForm($loginFailed=false) {
		print '<!DOCTYPE HTML>
			<html>
			<head>
				<title>IFM - improved file manager</title>
				<meta charset="utf-8">
				<style type="text/css">
					* { box-sizing: border-box; font-family: Monospace, Arial, sans-serif; }
					html { text-align: center; }
					body { margin:auto; width: auto; display: inline-block; }
					form { padding: 1em; border: 1px dotted #CCC; }
					button { margin: 3px; margin-top: 10px; padding: 9px 12px; border: 1px solid #444; border-radius: 2px; font-size: 0.9em; font-weight: bold; text-transform: uppercase; cursor: pointer; background: #444; color: #fff; }
					div.err { color: red; font-weight: bold; margin-bottom: 1em; }
				</style>
				</head>
				<body>
				<h1>IFM - Login</h1>
				<form method="post">';
		if($loginFailed){ print '<div class="err">Login attempt failed. Please try again.</div>'; }
		print '<label>username:</label> <input type="text" name="user" size="12"><br>
			<label>password:</label> <input type="password" name="pass" size="12"><br>
			<button type="submit">login</button>
			</form>
			</body>
			</html>';
	}

	private function getValidDir($dir) {
		if( $this->getScriptRoot() != substr( realpath( $dir ), 0, strlen( $this->getScriptRoot() ) ) ) {
			return "";
		} else {
			return ( file_exists( realpath( $dir ) ) ) ? substr( realpath( $dir ), strlen( $this->getScriptRoot() ) + 1 ) : "";
		}
	}

	private function filePermsDecode( $perms ) {
		$oct = str_split( strrev( decoct( $perms ) ), 1 );
		$masks = array( '---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx' );
		return(
			sprintf(
				'%s %s %s',
				array_key_exists( $oct[ 2 ], $masks ) ? $masks[ $oct[ 2 ] ] : '###',
				array_key_exists( $oct[ 1 ], $masks ) ? $masks[ $oct[ 1 ] ] : '###',
				array_key_exists( $oct[ 0 ], $masks ) ? $masks[ $oct[ 0 ] ] : '###')
		);
	}

	private function isPathValid($p) {
		if( $p == "" ) {
			return true;
		} elseif( str_replace( "\\", "/", $this->getScriptRoot() ) == str_replace( "\\", "/", substr( realpath( dirname( $p ) ), 0, strlen( $this->getScriptRoot() ) ) ) ) {
		   return true;
		}
		return false;
	}

	private function getScriptRoot() {
		//return realpath( substr( $_SERVER["SCRIPT_FILENAME"], 0, strrpos( $_SERVER["SCRIPT_FILENAME"], "/" ) ) );
		return dirname( $_SERVER["SCRIPT_FILENAME"] );
	}

	private function chDirIfNecessary($d) {
		if( substr( getcwd(), strlen( $this->getScriptRoot() ) ) != $this->getValidDir($d) ) {
			chdir( $d );
		}
	}

	private function getTypePicture( $type ) {
		switch( $type ) {
			case "aac": return "aac.png"; break;case "ai": return "ai.png"; break;case "aiff": return "aiff.png"; break;
			case "avi": return "avi.png"; break;case "bmp": return "bmp.png"; break;case "c": return "c.png"; break;
			case "cpp": return "cpp.png"; break;case "css": return "css.png"; break;case "dat": return "dat.png"; break;
			case "dmg": return "dmg.png"; break;case "doc": return "doc.png"; break;case "dotx": return "dotx.png"; break;
			case "dwg": return "dwg.png"; break;case "dxf": return "dxf.png"; break;case "eps": return "eps.png"; break;
			case "exe": return "exe.png"; break;case "flv": return "flv.png"; break;case "gif": return "gif.png"; break;
			case "h": return "h.png"; break;case "hpp": return "hpp.png"; break;case "html": return "html.png"; break;
			case "ics": return "ics.png"; break;case "iso": return "iso.png"; break;case "java": return "java.png"; break;
			case "jpg": return "jpg.png"; break;case "key": return "key.png"; break;case "mid": return "mid.png"; break;
			case "mp3": return "mp3.png"; break;case "mp4": return "mp4.png"; break;case "mpg": return "mpg.png"; break;
			case "odf": return "odf.png"; break;case "ods": return "ods.png"; break;case "odt": return "odt.png"; break;
			case "otp": return "otp.png"; break;case "ots": return "ots.png"; break;case "ott": return "ott.png"; break;
			case "pdf": return "pdf.png"; break;case "php": return "php.png"; break;case "png": return "png.png"; break;
			case "ppt": return "ppt.png"; break;case "psd": return "psd.png"; break;case "py": return "py.png"; break;
			case "qt": return "qt.png"; break;case "rb": return "rb.png"; break;case "rtf": return "rtf.png"; break;
			case "sql": return "sql.png"; break;case "tga": return "tga.png"; break;case "tgz": return "tgz.png"; break;
			case "tiff": return "tiff.png"; break;case "txt": return "txt.png"; break;case "wav": return "wav.png"; break;
			case "xls": return "xls.png"; break;case "xlsx": return "xlsx.png"; break;case "xml": return "xml.png"; break;
			case "yml": return "yml.png"; break;case "zip": return "zip.png"; break;
			default: return "_blank.png"; break;
		}
	}

	private function getRealpath($dir) {
		if( $this->getScriptRoot() != substr( realpath( $_POST["dir"] ), 0, strlen( $this->getScriptRoot() ) ) )  {
			echo json_encode( array( "realpath" => "" ) );
		} else {
			$rp = substr( realpath( $_POST["dir"] ), strlen( $this->getScriptRoot() ) + 1 );
			if( $rp == false ) $rp = "";
			echo json_encode( array( "realpath" => $rp ) );
		}
	}
	private function rec_rmdir( $path ) {
		if( !is_dir( $path ) ) {
			return -1;
		}
		$dir = @opendir( $path );
		if( !$dir ) {
			return -2;
		}
		while( ( $entry = @readdir( $dir ) ) !== false ) {
			if( $entry == '.' || $entry == '..' ) continue;
			if( is_dir( $path . '/' . $entry ) ) {
				$res = $this->rec_rmdir( $path . '/' . $entry );
				if( $res == -1 ) { @closedir( $dir ); return -2; }
				else if( $res == -2 ) { @closedir(  $dir ); return -2; }
				else if( $res == -3 ) { @closedir( $dir ); return -3; }
				else if( $res != 0 ) { @closedir( $dir ); return -2; }
			} else if( is_file( $path . '/' . $entry ) || is_link( $path . '/' . $entry ) ) {
				$res = @unlink( $path . '/' . $entry );
				if( !$res ) { @closedir( $dir ); return -2; }
			} else { @closedir( $dir ); return -3; }
		}
		@closedir( $dir );
		$res = @rmdir( $path );
		if( !$res ) { return -2; }
		return 0;
	}

	// combines two parts to a valid path
	private function pathCombine( $a, $b ) {
		if( $a=="" && $b=="" )
			return "";
		else
			return ltrim( rtrim( $a, '/' ) . '/' . ltrim( $b, '/' ), '/' );
	}

	// check if filename is allowed
	private function allowedFileName( $f ) {
		if( IFMConfig::showhtdocs != 1 && substr( $f, 0, 3 ) == ".ht" )
			return false;
		elseif( IFMConfig::showhiddenfiles != 1 && substr( $f, 0, 1 ) == "." )
			return false;
		elseif( ! $this->isPathValid( $f ) )
			return false;
		return true;
	}

	// sorting function for file and dir arrays
	private function sortByName( $a, $b ) {
		if( strtolower( $a['name'] ) == strtolower( $b['name'] ) ) return 0;
		return ( strtolower( $a['name'] ) < strtolower( $b['name'] ) ) ? -1 : 1;
	}

	// unzip an archive
	private function unzip( $file ) {
		$zip = new ZipArchive;
		$res = $zip->open( $file );
		if( $res === true ) {
			$zip->extractTo( './' );
			$zip->close();
			return true;
		} else {
			return false;
		}
	}

	// is cURL extention avaliable?
	private function checkCurl() {
		if( ! function_exists( "curl_init" ) &&
				!function_exists( "curl_setopt" ) &&
				!function_exists( "curl_exec" ) &&
				!function_exists( "curl_close" ) ) return false;
		else return true;
	}

	private function file_download( $file, $name="" ) {
		header( 'Content-Description: File Transfer' );
		header( 'Content-Type: application/octet-stream' );
		header( 'Content-Disposition: attachment; filename="' . ( trim( $name ) == "" ? basename( $file ) : $name ) . '"' );
		header( 'Expires: 0' );
		header( 'Cache-Control: must-revalidate' );
		header( 'Pragma: public' );
		header( 'Content-Length: ' . filesize( $file ) );

		$file_stream = fopen( $file, 'rb' );
		$stdout_stream = fopen('php://output', 'wb');

		stream_copy_to_stream($file_stream, $stdout_stream);

		fclose($file_stream);
		fclose($stdout_stream);
	}

	///helper
}

/*
   start program
 */

$ifm = new IFM();
$ifm->run();
