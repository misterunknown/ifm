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

error_reporting( E_ALL );
ini_set( 'display_errors', 'OFF' );

class IFM {
	const VERSION = '2.3.1';

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
				<meta charset="utf-8">
				<meta http-equiv="X-UA-Compatible" content="IE=edge">
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<style type="text/css">';?> @@@src/includes/bootstrap.min.css@@@ <?php print '</style>
				<style type="text/css">';?> @@@src/includes/ekko-lightbox.min.css@@@ <?php print '</style>
				<style type="text/css">';?> @@@src/includes/fontello-embedded.css@@@ <?php print '</style>
				<style type="text/css">';?> @@@src/style.css@@@ <?php print '</style>
			</head>
			<body>
				<nav class="navbar navbar-inverse navbar-fixed-top">
					<div class="container">
						<div class="navbar-header">
							<a class="navbar-brand">IFM</a>
							<button class="navbar-toggle" type="button" data-toggle="collapse" data-target="#navbar">
								<span class="sr-only">Toggle navigation</span>
								<span class="icon-bar"></span>
								<span class="icon-bar"></span>
								<span class="icon-bar"></span>
							</button>
						</div>
						<div class="navbar-collapse collapse" id="navbar">
							<form class="navbar-form navbar-left">
								<div class="form-group">
									<div class="input-group">
										<span class="input-group-addon" id="currentDirLabel">Content of <span id="docroot">';
										print ( IFMConfig::showpath == 1 ) ? realpath( IFMConfig::root_dir ) : "/";
										print '</span></span><input class="form-control" id="currentDir" aria-describedby="currentDirLabel" type="text">
									</div>
								</div>
							</form>
							<ul class="nav navbar-nav navbar-right">
								<li><a id="refresh"><span title="refresh" class="icon icon-arrows-cw"></span> <span class="visible-xs">refresh</span></a></li>';
								if( IFMConfig::upload == 1 ) {
									print '<li><a id="upload"><span title="upload" class="icon icon-upload"></span> <span class="visible-xs">upload</span></a></li>';
								}
								if( IFMConfig::createfile == 1 ) {
									print '<li><a id="createFile"><span title="new file" class="icon icon-doc-inv"></span> <span class="visible-xs">new file</span></a></li>';
								}
								if( IFMConfig::createdir == 1 ) {
									print '<li><a id="createDir"><span title="new folder" class="icon icon-folder"></span> <span class="visible-xs">new folder</span></a></li>';
								}
								print '<li class="dropdown"><a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false"><span class="icon icon-down-open"></span></a><ul class="dropdown-menu" role="menu">';
								$options = false;
								if( IFMConfig::remoteupload == 1 ) {
									print '<li><a onclick="ifm.remoteUploadDialog();return false;"><span class="icon icon-upload-cloud"></span> remote upload</a></li>';
									$options = true;
								}
								if( IFMConfig::ajaxrequest == 1 ) {
									print '<li><a onclick="ifm.ajaxRequestDialog();return false;"><span class="icon icon-link-ext"></span> ajax request</a></li>';
									$options = true;
								}
								if( !$options ) print '<li>No options available</li>';
								print '</ul>
								</li>
							</ul>
						</div>
					</div>
				</nav>
				<div class="container">
				<table id="filetable" class="table">
					<thead>
						<tr>
							<th>Filename</th>';
							if( IFMConfig::download == 1 ) print '<th><!-- column for download link --></th>';
							if( IFMConfig::showlastmodified == 1 ) print '<th>last modified</th>';
							if( IFMConfig::showfilesize == 1 ) print '<th>size</th>';
							if( IFMConfig::showpermissions > 0 ) print '<th class="hidden-xs">permissions</th>';
							if( IFMConfig::showowner == 1 && function_exists( "posix_getpwuid" ) ) print '<th class="hidden-xs hidden-sm">owner</th>';
							if( IFMConfig::showgroup == 1 && function_exists( "posix_getgrgid" ) ) print '<th class="hidden-xs hidden-sm hidden-md">group</th>';
							if( in_array( 1, array( IFMConfig::edit, IFMConfig::rename, IFMConfig::delete, IFMConfig::zipnload, IFMConfig::extract ) ) ) print '<th class="buttons"><!-- column for buttons --></th>';
						print '</tr>
					</thead>
					<tbody>
					</tbody>
				</table>
				</div>
				<div class="container">
				<div class="panel panel-default footer"><div class="panel-body">IFM - improved file manager | ifm.php hidden | <a href="http://github.com/misterunknown/ifm">Visit the project on GitHub</a></div></div>
				</div>
				<script>';?> @@@src/includes/ace.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/jquery.min.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/bootstrap.min.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/bootstrap-notify.min.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/ekko-lightbox.min.js@@@ <?php print '</script>
				<script>';?> @@@src/ifm.js@@@ <?php print '</script>
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
				echo json_encode( array( "realpath" => $this->getValidDir( $_REQUEST["dir"] ) ) );
			else
				echo json_encode( array( "realpath" => "" ) );
		}
		elseif( $_REQUEST["api"] == "getFiles" ) {
			if( isset( $_REQUEST["dir"] ) && $this->isPathValid( $_REQUEST["dir"] ) )
				$this->getFiles( $_REQUEST["dir"] );
			else
				$this->getFiles( "" );
		} else {
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
			// go to our root_dir
			if( ! is_dir( realpath( IFMConfig::root_dir ) ) || ! is_readable( realpath( IFMConfig::root_dir ) ) )
				die( "Cannot access root_dir.");
			else
				chdir( IFMConfig::root_dir );
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
						if( $result == ".." )
							$item["icon"] = "icon icon-up-open";
						else 
							$item["icon"] = "icon icon-folder-empty";
					} else {
						$type = substr( strrchr( $result, "." ), 1 );
						$item["icon"] = $this->getTypeIcon( $type );
					}
					if( IFMConfig::showlastmodified == 1 ) { $item["lastmodified"] = date( "d.m.Y, G:i e", filemtime( $result ) ); }
					if( IFMConfig::showfilesize == 1 ) {
						$item["filesize"] = filesize( $result );
						if( $item["filesize"] > 1073741824 ) $item["filesize"] = round( ( $item["filesize"]/1073741824 ), 2 ) . " GB";
						elseif($item["filesize"]>1048576)$item["filesize"] = round( ( $item["filesize"]/1048576 ), 2 ) . " MB";
						elseif($item["filesize"]>1024)$item["filesize"] = round( ( $item["filesize"]/1024 ), 2 ) . " KB";
						else $item["filesize"] = $item["filesize"] . " Byte";
					}
					if( IFMConfig::showpermissions > 0 ) {
						if( IFMConfig::showpermissions == 1 ) $item["fileperms"] = substr( decoct( fileperms( $result ) ), -3 );
						elseif( IFMConfig::showpermissions == 2 ) $item["fileperms"] = $this->filePermsDecode( fileperms( $result ) );
						if( $item["fileperms"] == "" ) $item["fileperms"] = " ";
						$item["filepermmode"] = ( IFMConfig::showpermissions == 1 ) ? "short" : "long";
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
		elseif( ! $this->isPathValid( $this->pathCombine( $d['dir'],$d['filename'] ) ) ) { echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to change the permissions" ) ); }
		else {
			$this->chDirIfNecessary( $d['dir'] ); $chmod = $d["chmod"]; $cmi = true;
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
		if( IFMConfig::auth == 1 && ( ! isset( $_SESSION['auth'] ) || $_SESSION['auth'] !== true ) ) {
			$login_failed = false;
			if( isset( $_POST["user"] ) && isset( $_POST["pass"] ) ) {
				if( $this->checkCredentials( $_POST["user"], $_POST["pass"] ) ) {
					$_SESSION['auth'] = true;
				}
				else {
					$_SESSION['auth'] = false;
					$login_failed = true;
				}
			}

			if( isset( $_SESSION['auth'] ) && $_SESSION['auth'] === true ) {
				return true;
			} else {
				if( isset( $_POST["api"] ) ) {
					if( $login_failed === true )
						echo json_encode( array( "status"=>"ERROR", "message"=>"authentication failed" ) );
					else
						echo json_encode( array( "status"=>"ERROR", "message"=>"not authenticated" ) );
				} else {
					$this->loginForm($login_failed);
				}
				return false;
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

	private function getValidDir( $dir ) {
		if( ! $this->isPathValid( $dir ) || ! is_dir( $dir ) ) {
			return "";
		} else {
			$rpDir = realpath( $dir );
			$rpConfig = realpath( IFMConfig::root_dir );
			if( $rpConfig == "/" )
				return $rpDir;
			elseif( $rpDir == $rpConfig )
				return "";
			else
				return substr( $rpDir, strlen( $rpConfig ) + 1 );
		}
	}

	private function isPathValid( $dir ) {
		$rpDir = realpath( $dir );
		$rpConfig = realpath( IFMConfig::root_dir );
		if( ! is_string( $rpDir ) || ! is_string( $rpConfig ) ) // can happen if open_basedir is in effect
			return false;
		elseif( $rpDir == $rpConfig )
			return true;
		elseif( 0 === strpos( $rpDir, $rpConfig ) ) {
			return true;
		}
		else
			return false;
	}

	private function getScriptRoot() {
		return dirname( $_SERVER["SCRIPT_FILENAME"] );
	}

	private function chDirIfNecessary($d) {
		if( substr( getcwd(), strlen( $this->getScriptRoot() ) ) != $this->getValidDir($d) ) {
			chdir( $d );
		}
	}

	private function getTypeIcon( $type ) {
		switch( $type ) {
			case "aac":	case "aiff": case "mid": case "mp3": case "wav": return 'icon icon-file-audio'; break;
			case "ai": case "bmp": case "eps": case "tiff": case "gif": case "jpg": case "jpeg": case "png": case "psd": return 'icon icon-file-image'; break;
			case "avi": case "flv": case "mp4": case "mpg": case "mkv": case "mpeg": case "webm": case "wmv": case "mov": return 'icon icon-file-video'; break;
			case "c": case "cpp": case "css": case "dat": case "h": case "html": case "php": case "java": case "py": case "sql": case "xml": case "yml": return 'icon icon-file-code'; break;
			case "doc": case "dotx": case "odf": case "odt": case "rtf": return 'icon icon-file-word'; break;
			case "ods": case "xls": case "xlsx": return 'icon icon-file-excel'; break;
			case "odp": case "ppt": case "pptx": return 'icon icon-file-powerpoint'; break;
			case "pdf": return 'icon icon-file-pdf'; break;
			case "tgz":	case "zip": case "tar": case "7z": case "rar": return 'icon icon-file-archive';
			default: return 'icon icon-doc';
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
		if( !function_exists( "curl_init" ) ||
				!function_exists( "curl_setopt" ) ||
				!function_exists( "curl_exec" ) ||
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
