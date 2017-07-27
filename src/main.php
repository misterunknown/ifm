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
	const VERSION = '2.4.2';

	private $defaultconfig = array(
		// general config
		"auth" => 0,
		"auth_source" => 'inline;admin:$2y$10$0Bnm5L4wKFHRxJgNq.oZv.v7yXhkJZQvinJYR2p6X1zPvzyDRUVRC',
		"root_dir" => "",
		"tmp_dir" => "",
		"defaulttimezone" => "Europe/Berlin",
		"forbiddenChars" => array(),

		// api controls
		"ajaxrequest" => 1,
		"chmod" => 1,
		"copymove" => 1,
		"createdir" => 1,
		"createfile" => 1,
		"edit" => 1,
		"delete" => 1,
		"download" => 1,
		"extract" => 1,
		"upload" => 1,
		"remoteupload" => 1,
		"rename" => 1,
		"zipnload" => 1,

		// gui controls
		"showlastmodified" => 0,
		"showfilesize" => 1,
		"showowner" => 1,
		"showgroup" => 1,
		"showpermissions" => 2,
		"showhtdocs" => 0,
		"showhiddenfiles" => 1,
		"showpath" => 0,
	);

	private $config = array();
	private $templates = array();
	public $mode = "";

	public function __construct( $config=array() ) {
		if( session_status() !== PHP_SESSION_ACTIVE )
			session_start();

		// load the default config
		$this->config = $this->defaultconfig;

		// load config from environment variables
		$this->config['auth'] =  getenv('IFM_AUTH') !== false ? getenv('IFM_AUTH') : $this->config['auth'] ;
		$this->config['auth_source'] =  getenv('IFM_AUTH_SOURCE') !== false ? getenv('IFM_AUTH_SOURCE') : $this->config['auth_source'] ;
		$this->config['root_dir'] =  getenv('IFM_ROOT_DIR') !== false ? getenv('IFM_ROOT_DIR') : $this->config['root_dir'] ;
		$this->config['tmp_dir'] =  getenv('IFM_TMP_DIR') !== false ? getenv('IFM_TMP_DIR') : $this->config['tmp_dir'] ;
		$this->config['defaulttimezone'] =  getenv('IFM_DEFAULTTIMEZONE') !== false ? getenv('IFM_DEFAULTTIMEZONE') : $this->config['defaulttimezone'] ;
		$this->config['forbiddenChars'] =  getenv('IFM_FORBIDDENCHARS') !== false ? str_split( getenv('IFM_FORBIDDENCHARS') ) : $this->config['forbiddenChars'] ;
		$this->config['ajaxrequest'] =  getenv('IFM_API_AJAXREQUEST') !== false ? getenv('IFM_API_AJAXREQUEST') : $this->config['ajaxrequest'] ;
		$this->config['chmod'] =  getenv('IFM_API_CHMOD') !== false ? getenv('IFM_API_CHMOD') : $this->config['chmod'] ;
		$this->config['copymove'] =  getenv('IFM_API_COPYMOVE') !== false ? getenv('IFM_API_COPYMOVE') : $this->config['copymove'] ;
		$this->config['createdir'] =  getenv('IFM_API_CREATEDIR') !== false ? getenv('IFM_API_CREATEDIR') : $this->config['createdir'] ;
		$this->config['createfile'] =  getenv('IFM_API_CREATEFILE') !== false ? getenv('IFM_API_CREATEFILE') : $this->config['createfile'] ;
		$this->config['edit'] =  getenv('IFM_API_EDIT') !== false ? getenv('IFM_API_EDIT') : $this->config['edit'] ;
		$this->config['delete'] =  getenv('IFM_API_DELETE') !== false ? getenv('IFM_API_DELETE') : $this->config['delete'] ;
		$this->config['download'] =  getenv('IFM_API_DOWNLOAD') !== false ? getenv('IFM_API_DOWNLOAD') : $this->config['download'] ;
		$this->config['extract'] =  getenv('IFM_API_EXTRACT') !== false ? getenv('IFM_API_EXTRACT') : $this->config['extract'] ;
		$this->config['upload'] =  getenv('IFM_API_UPLOAD') !== false ? getenv('IFM_API_UPLOAD') : $this->config['upload'] ;
		$this->config['remoteupload'] =  getenv('IFM_API_REMOTEUPLOAD') !== false ? getenv('IFM_API_REMOTEUPLOAD') : $this->config['remoteupload'] ;
		$this->config['rename'] =  getenv('IFM_API_RENAME') !== false ? getenv('IFM_API_RENAME') : $this->config['rename'] ;
		$this->config['zipnload'] =  getenv('IFM_API_ZIPNLOAD') !== false ? getenv('IFM_API_ZIPNLOAD') : $this->config['zipnload'] ;
		$this->config['showlastmodified'] =  getenv('IFM_GUI_SHOWLASTMODIFIED') !== false ? getenv('IFM_GUI_SHOWLASTMODIFIED') : $this->config['showlastmodified'] ;
		$this->config['showfilesize'] =  getenv('IFM_GUI_SHOWFILESIZE') !== false ? getenv('IFM_GUI_SHOWFILESIZE') : $this->config['showfilesize'] ;
		$this->config['showowner'] =  getenv('IFM_GUI_SHOWOWNER') !== false ? getenv('IFM_GUI_SHOWOWNER') : $this->config['showowner'] ;
		$this->config['showgroup'] =  getenv('IFM_GUI_SHOWGROUP') !== false ? getenv('IFM_GUI_SHOWGROUP') : $this->config['showgroup'] ;
		$this->config['showpermissions'] =  getenv('IFM_GUI_SHOWPERMISSIONS') !== false ? getenv('IFM_GUI_SHOWPERMISSIONS') : $this->config['showpermissions'] ;
		$this->config['showhtdocs'] =  getenv('IFM_GUI_SHOWHTDOCS') !== false ? getenv('IFM_GUI_SHOWHTDOCS') : $this->config['showhtdocs'] ;
		$this->config['showhiddenfiles'] =  getenv('IFM_GUI_SHOWHIDDENFILES') !== false ? getenv('IFM_GUI_SHOWHIDDENFILES') : $this->config['showhiddenfiles'] ;
		$this->config['showpath'] =  getenv('IFM_GUI_SHOWPATH') !== false ? getenv('IFM_GUI_SHOWPATH') : $this->config['showpath'] ;

		// load config from passed array
		$this->config = array_merge( $this->config, $config );

		$templates = array();
		$templates['app'] = <<<'f00bar'
@@@src/templates/app.html@@@
f00bar;
		$templates['login'] = <<<'f00bar'
@@@src/templates/login.html@@@
f00bar;
		$templates['filetable'] = <<<'f00bar'
@@@src/templates/filetable.html@@@
f00bar;
		$templates['footer'] = <<<'f00bar'
@@@src/templates/footer.html@@@
f00bar;
		$templates['task'] = <<<'f00bar'
@@@src/templates/task.html@@@
f00bar;
		$templates['ajaxrequest'] = <<<'f00bar'
@@@src/templates/modal.ajaxrequest.html@@@
f00bar;
		$templates['copymove'] = <<<'f00bar'
@@@src/templates/modal.copymove.html@@@
f00bar;
		$templates['createdir'] = <<<'f00bar'
@@@src/templates/modal.createdir.html@@@
f00bar;
		$templates['deletefile'] = <<<'f00bar'
@@@src/templates/modal.deletefile.html@@@
f00bar;
		$templates['extractfile'] = <<<'f00bar'
@@@src/templates/modal.extractfile.html@@@
f00bar;
		$templates['file'] = <<<'f00bar'
@@@src/templates/modal.file.html@@@
f00bar;
		$templates['multidelete'] = <<<'f00bar'
@@@src/templates/modal.multidelete.html@@@
f00bar;
		$templates['remoteupload'] = <<<'f00bar'
@@@src/templates/modal.remoteupload.html@@@
f00bar;
		$templates['renamefile'] = <<<'f00bar'
@@@src/templates/modal.renamefile.html@@@
f00bar;
		$templates['uploadfile'] = <<<'f00bar'
@@@src/templates/modal.uploadfile.html@@@
f00bar;
		$this->templates = $templates;
	}

	/**
	 * This function contains the client-side application
	 */
	public function getApplication() {
		$this->getHTMLHeader();
		print '<div id="ifm"></div>';
		$this->getJS();
		print '<script>var ifm = new IFM(); ifm.init( "ifm" );</script>';
		$this->getHTMLFooter();
	}

	public function getInlineApplication() {
		$this->getCSS();
		print '<div id="ifm"></div>';
		$this->getJS();
	}

	public function getCSS() {
		print '
			<style type="text/css">';?> @@@src/includes/bootstrap.min.css@@@ <?php print '</style>
			<style type="text/css">';?> @@@src/includes/bootstrap-treeview.min.css@@@ <?php print '</style>
			<style type="text/css">';?> @@@src/includes/fontello-embedded.css@@@ <?php print '</style>
			<style type="text/css">';?> @@@src/includes/animation.css@@@ <?php print '</style>
			<style type="text/css">';?> @@@src/style.css@@@ <?php print '</style>
		';
	}

	public function getJS() {
		print '
				<script>';?> @@@src/includes/ace.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/jquery.min.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/bootstrap.min.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/bootstrap-notify.min.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/bootstrap-treeview.min.js@@@ <?php print '</script>
				<script>';?> @@@src/includes/mustache.min.js@@@ <?php print '</script>
				<script>';?> @@@src/ifm.js@@@ <?php print '</script>
		';
	}

	public function getHTMLHeader() {
		print '<!DOCTYPE HTML>
		<html>
			<head>
				<title>IFM - improved file manager</title>
				<meta charset="utf-8">
				<meta http-equiv="X-UA-Compatible" content="IE=edge">
				<meta name="viewport" content="width=device-width, initial-scale=1">';
		$this->getCSS();
		print '</head><body>';
	}

	public function getHTMLFooter() {
		print '</body></html>';
	}

	/*
	   main functions
	 */

	private function handleRequest() {
		if( $_REQUEST["api"] == "getRealpath" ) {
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
		}
		elseif( $_REQUEST["api"] == "getConfig" ) {
			$this->getConfig();
		}
		elseif( $_REQUEST["api"] == "getFolders" ) {
			$this->getFolders( $_REQUEST );
		} elseif( $_REQUEST["api"] == "getTemplates" ) {
			echo json_encode( $this->templates );
		} elseif( $_REQUEST["api"] == "logout" ) {
			unset( $_SESSION );
			session_destroy();
			header( "Location: " . strtok( $_SERVER["REQUEST_URI"], '?' ) );
			exit( 0 );
		} else {
			if( isset( $_REQUEST["dir"] ) && $this->isPathValid( $_REQUEST["dir"] ) ) {
				switch( $_REQUEST["api"] ) {
					case "createDir": $this->createDir( $_REQUEST["dir"], $_REQUEST["dirname"] ); break;
					case "saveFile": $this->saveFile( $_REQUEST ); break;
					case "getContent": $this->getContent( $_REQUEST ); break;
					case "delete": $this->deleteFile( $_REQUEST ); break;
					case "rename": $this->renameFile( $_REQUEST ); break;
					case "download": $this->downloadFile( $_REQUEST ); break;
					case "extract": $this->extractFile( $_REQUEST ); break;
					case "upload": $this->uploadFile( $_REQUEST ); break;
					case "copyMove": $this->copyMove( $_REQUEST ); break;
					case "changePermissions": $this->changePermissions( $_REQUEST ); break;
					case "zipnload": $this->zipnload( $_REQUEST); break;
					case "remoteUpload": $this->remoteUpload( $_REQUEST ); break;
					case "multidelete": $this->deleteMultipleFiles( $_REQUEST ); break;
					case "getFolderTree": $this->getFolderTree( $_REQUEST ); break;
					default:
						echo json_encode( array( "status" => "ERROR", "message" => "Invalid api action given" ) );
						break;
				}
			} else {
				print json_encode( array( "status" => "ERROR", "message" => "Invalid working directory" ) );
			}
		}
		exit( 0 );
	}

	public function run( $mode="standalone" ) {
		if ( $this->checkAuth() ) {
			// go to our root_dir
			if( ! is_dir( realpath( $this->config['root_dir'] ) ) || ! is_readable( realpath( $this->config['root_dir'] ) ) )
				die( "Cannot access root_dir.");
			else
				chdir( realpath( $this->config['root_dir'] ) );
			$this->mode = $mode;
			if( isset( $_REQUEST['api'] ) || $mode == "api" ) {
				$this->handleRequest();
			} elseif( $mode == "standalone" ) {
				$this->getApplication();
			} else {
				$this->getInlineApplication();
			}
		}
	}

	/*
	   api functions
	 */

	private function getFiles( $dir ) {
		$dir = $this->getValidDir( $dir );
		$this->chDirIfNecessary( $dir );

		unset( $files ); unset( $dirs ); $files = array(); $dirs = array();

		if( $handle = opendir( "." ) ) {
			while( false !== ( $result = readdir( $handle ) ) ) {
				if( $result == basename( $_SERVER['SCRIPT_NAME'] ) && $this->getScriptRoot() == getcwd() ) { }
				elseif( ( $result == ".htaccess" || $result==".htpasswd" ) && $this->config['showhtdocs'] != 1 ) {}
				elseif( $result == "." ) {}
				elseif( $result != ".." && substr( $result, 0, 1 ) == "." && $this->config['showhiddenfiles'] != 1 ) {}
				else {
					$item = array();
					$item["name"] = $result;
					if( is_dir( $result ) ) {
						$item["type"] = "dir";
						if( $result == ".." )
							$item["icon"] = "icon icon-up-open";
						else 
							$item["icon"] = "icon icon-folder-empty";
					} else {
						$item["type"] = "file";
						if( in_array( substr( $result, -7 ), array( ".tar.gz", ".tar.xz" ) ) )
							$type = substr( $result, -6 );
						elseif( substr( $result, -8 ) == ".tar.bz2" )
							$type = "tar.bz2";
						else
							$type = substr( strrchr( $result, "." ), 1 );
						$item["icon"] = $this->getTypeIcon( $type );
						$item["ext"] = strtolower($type);
					}
					if( $this->config['showlastmodified'] == 1 ) { $item["lastmodified"] = date( "d.m.Y, G:i e", filemtime( $result ) ); }
					if( $this->config['showfilesize'] == 1 ) {
						$item["size"] = filesize( $result );
						if( $item["size"] > 1073741824 ) $item["size"] = round( ( $item["size"]/1073741824 ), 2 ) . " GB";
						elseif($item["size"]>1048576)$item["size"] = round( ( $item["size"]/1048576 ), 2 ) . " MB";
						elseif($item["size"]>1024)$item["size"] = round( ( $item["size"]/1024 ), 2 ) . " KB";
						else $item["size"] = $item["size"] . " Byte";
					}
					if( $this->config['showpermissions'] > 0 ) {
						if( $this->config['showpermissions'] == 1 ) $item["fileperms"] = substr( decoct( fileperms( $result ) ), -3 );
						elseif( $this->config['showpermissions'] == 2 ) $item["fileperms"] = $this->filePermsDecode( fileperms( $result ) );
						if( $item["fileperms"] == "" ) $item["fileperms"] = " ";
						$item["filepermmode"] = ( $this->config['showpermissions'] == 1 ) ? "short" : "long";
					}
					if( $this->config['showowner'] == 1  ) {
						if ( function_exists( "posix_getpwuid" ) && fileowner($result) !== false ) {
							$ownerarr = posix_getpwuid( fileowner( $result ) );
							$item["owner"] = $ownerarr['name'];
						} else $item["owner"] = false;
					}
					if( $this->config['showgroup'] == 1 ) {
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

	private function getConfig() {
		$ret = $this->config;
		$ret['inline'] = ( $this->mode == "inline" ) ? true : false;
		$ret['isDocroot'] = ( $this->getRootDir() == $this->getScriptRoot() ) ? "true" : "false";
		echo json_encode( $ret );
	}

	private function getFolders( $d ) {
		if( ! isset( $d['dir'] ) )
			$d['dir'] = $this->getRootDir();
		if( ! $this->isPathValid( $d['dir'] ) )
			echo "[]";
		else {
			$ret = array();
			foreach( glob( $this->pathCombine( $d['dir'], "*" ), GLOB_ONLYDIR ) as $dir ) {
				array_push( $ret, array(
					"text" => htmlspecialchars( basename( $dir ) ),
					"lazyLoad" => true,
					"dataAttr" => array( "path" => $dir )
				));
			}
			sort( $ret );
			if( $this->getScriptRoot() == realpath( $d['dir'] ) )
				$ret = array_merge(
					array(
						0 => array(
							"text" => "/ [root]",
							"dataAttributes" => array( "path" => $this->getRootDir() )
						)
					),
					$ret
				);
			echo json_encode( $ret );
		}
	}

	private function getFolderTree( $d ) {
		echo json_encode(
			array_merge(
				array(
					0 => array(
						"text" => "/ [root]",
						"nodes" => array(),
						"dataAttributes" => array( "path" => $this->getRootDir() )
					)
				),
				$this->getFolderTreeRecursive( $d['dir']  )
			)
		);
	}

	private function getFolderTreeRecursive( $start_dir ) {
		$ret = array();
		$start_dir = realpath( $start_dir );
		if( $handle = opendir( $start_dir ) ) {
			while (false !== ( $result = readdir( $handle ) ) ) {
				if( is_dir( $this->pathCombine( $start_dir, $result ) ) && $result != "." && $result != ".." ) {
					array_push(
						$ret,
						array(
							"text" => htmlspecialchars( $result ),
							"dataAttributes" => array(
								"path" => $this->pathCombine( $start_dir, $result )
							),
							"nodes" => $this->getFolderTreeRecursive( $this->pathCombine( $start_dir, $result ) )
						)
					);
				}
			}
		}
		sort( $ret );
		return $ret;
	}

	private function copyMove( $d ) {
		if( $this->config['copymove'] != 1 ) {
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to copy or move files." ) );
			exit( 1 );
		}
		$this->chDirIfNecessary( $d['dir'] );
		if( ! isset( $d['destination'] ) || ! $this->isPathValid( realpath( $d['destination'] ) ) ) {
			echo json_encode( array( "status" => "ERROR", "message" => "Invalid destination directory given." ) );
			exit( 1 );
		}
		if( ! file_exists( $d['filename'] ) || $d['filename'] == ".." ) {
			echo json_encode( array( "status" => "ERROR", "message" => "Invalid filename given." ) );
			exit( 1 );
		}
		if( $d['action'] == "copy" ) {
			if( $this->copyr( $d['filename'], $d['destination'] ) ) {
				echo json_encode( array( "status" => "OK", "message" => "File(s) were successfully copied." ) );
				exit( 0 );
			} else {
				$err = error_get_last();
				echo json_encode( array( "status" => "ERROR", "message" => $err['message'] ) );
				exit( 1 );
			}
		} elseif( $d['action'] == "move" ) {
			if( rename( $d['filename'], $this->pathCombine( $d['destination'], basename( $d['filename'] ) ) ) ) {
				echo json_encode( array( "status" => "OK", "message" => "File(s) were successfully moved." ) );
				exit( 0 );
			} else {
				$err = error_get_last();
				echo json_encode( array( "status" => "ERROR", "message" => $err['message'] ) );
				exit( 1 );
			}
		} else {
			echo json_encode( array( "status" => "ERROR", "message" => "Invalid action given." ) );
			exit( 1 );
		}
	}

	// creates a directory
	private function createDir($w, $dn) {
		if( $this->config['createdir'] != 1 ) {
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to create directories.") );
			exit( 1 );
		}
		if( $dn == "" )
			echo json_encode( array( "status" => "ERROR", "message" => "Invalid directory name") );
		elseif( ! $this->isFilenameValid( $dn ) )
			echo json_encode( array( "status" => "ERROR", "message" => "Invalid directory name" ) );
		else {
			$this->chDirIfNecessary( $w );
			if( @mkdir( $dn ) )
				echo json_encode( array( "status" => "OK", "message" => "Directory successful created" ) );
			else
				echo json_encode( array( "status" => "ERROR", "message" => "Could not create directory" ) );
		}
	}

	// save a file
	private function saveFile( $d ) {
		if( ( file_exists( $this->pathCombine( $d['dir'], $d['filename'] ) ) && $this->config['edit'] != 1 ) || ( ! file_exists( $this->pathCombine( $d['dir'], $d['filename'] ) ) && $this->config['createfile'] != 1 ) ) {
			echo json_encode( array( "status" => "ERROR", "message" => "You are not allowed to edit/create this file." ) );
			exit( 1 );
		}
		if( isset( $d['filename'] ) && $this->isFilenameValid( $d['filename'] ) ) {
			if( isset( $d['content'] ) ) {
				$this->chDirIfNecessary( $d['dir'] );
				// work around magic quotes
				$content = get_magic_quotes_gpc() == 1 ? stripslashes( $d['content'] ) : $d['content'];
				if( @file_put_contents( $d['filename'], $content ) !== false ) {
					echo json_encode( array( "status" => "OK", "message" => "File successfully saved" ) );
				} else
					echo json_encode( array( "status" => "ERROR", "message" => "Could not write content" ) );
			} else
				echo json_encode( array( "status" => "ERROR", "message" => "Got no content" ) );
		} else
			echo json_encode( array( "status" => "ERROR", "message" => "Invalid filename given" ) );
	}

	// gets the content of a file
	// notice: if the content is not JSON encodable it returns an error
	private function getContent( array $d ) {
		if( $this->config['edit'] != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "You are not allowed to edit files." ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			if( isset( $d['filename'] ) && $this->isFilenameAllowed( $d['filename'] ) && file_exists( $d['filename'] ) && is_readable( $d['filename'] ) ) {
				$content = @file_get_contents( $d['filename'] );
				if( function_exists( "mb_check_encoding" ) && ! mb_check_encoding( $content, "UTF-8" ) )
					$content = utf8_encode( $content );
				echo json_encode( array( "status" => "OK", "data" => array( "filename" => $d['filename'], "content" => $content ) ) );
			} else echo json_encode( array( "status" => "ERROR", "message" => "File not found or not readable." ) );
		}
	}

	// deletes a file or a directory (recursive!)
	private function deleteFile( array $d ) {
		if( $this->config['delete'] != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to delete files" ) );
		elseif( ! $this->isFilenameAllowed( $d['filename'] ) )
			echo json_encode( array( "status" => "ERROR", "message" => "Invalid filename given" ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			if( is_dir( $d['filename'] ) ) {
				$res = $this->rec_rmdir( $d['filename'] );
				if( $res != 0 )
					echo json_encode( array( "status" => "ERROR", "message" => "No permission to delete files" ) );
				else
				   echo json_encode( array( "status" => "OK", "message" => "Directoy successful deleted" ) );
			} else {
				if( @unlink( $d['filename'] ) )
					echo json_encode( array( "status" => "OK", "message" => "File successful deleted" ) );
				else
					echo json_encode( array( "status"=>"ERROR", "message" => "File could not be deleted" ) );
			}
		}
	}

	// deletes a bunch of files or directories
	private function deleteMultipleFiles( array $d ) {
		if( $this->config['delete'] != 1 ) echo json_encode( array( "status" => "ERROR", "message" => "No permission to delete files" ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			$err = array(); $errFLAG = -1; // -1 -> no files deleted; 0 -> at least some files deleted; 1 -> all files deleted
			foreach( $d['filenames'] as $file ) {
				if( $this->isFilenameAllowed( $file ) ) {
					if( is_dir($file) ) {
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
				} else {
					array_push( $err, $file );
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
		if( $this->config['rename'] != 1 ) {
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to rename files" ) );
		} elseif( ! $this->isFilenameValid( $d['filename'] ) ) {
			echo json_encode( array( "status" => "ERROR", "message" => "Invalid file name given" ) );
		} else {
			$this->chDirIfNecessary( $d['dir'] );
			if( strpos( $d['newname'], '/' ) !== false )
				echo json_encode( array( "status" => "ERROR", "message" => "No slashes allowed in filenames" ) );
			elseif( $this->config['showhtdocs'] != 1 && ( substr( $d['newname'], 0, 3) == ".ht" || substr( $d['filename'], 0, 3 ) == ".ht" ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to rename this file" ) );
			elseif( $this->config['showhiddenfiles'] != 1 && ( substr( $d['newname'], 0, 1) == "." || substr( $d['filename'], 0, 1 ) == "." ) )
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
		if( $this->config['download'] != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to download files" ) );
		elseif( $this->config['showhtdocs'] != 1 && ( substr( $d['filename'], 0, 3 ) == ".ht" || substr( $d['filename'],0,3 ) == ".ht" ) )
			echo json_encode( array( "status" => "ERROR", "message"=>"Not allowed to download htdocs" ) );
		elseif( $this->config['showhiddenfiles'] != 1 && ( substr( $d['filename'], 0, 1 ) == "." || substr( $d['filename'],0,1 ) == "." ) )
			echo json_encode( array( "status" => "ERROR", "message" => "Not allowed to download hidden files" ) );
		else {
			$this->chDirIfNecessary( $d["dir"] );
			$this->fileDownload( $d['filename'] );
		}
	}

	// extracts a zip-archive
	private function extractFile( array $d ) {
		if( $this->config['extract'] != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to extract files" ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			if( ! file_exists( $d['filename'] ) ) {
				echo json_encode( array( "status" => "ERROR","message" => "No valid archive found" ) );
				exit( 1 );
			}
			if( ! isset( $d['targetdir'] ) || trim( $d['targetdir'] ) == "" )
				$d['targetdir'] = "./";
			if( ! $this->isPathValid( $d['targetdir'] ) ) {
				echo json_encode( array( "status" => "ERROR","message" => "Target directory is not valid." ) );
				exit( 1 );
			}
			if( ! is_dir( $d['targetdir'] ) && ! mkdir( $d['targetdir'], 0777, true ) ) {
				echo json_encode( array( "status" => "ERROR","message" => "Could not create target directory." ) );
				exit( 1 );
			}
			if( substr( strtolower( $d['filename'] ), -4 ) == ".zip" ) {
				if( ! IFMArchive::extractZip( $d['filename'], $d['targetdir'] ) ) {
					echo json_encode( array( "status" => "ERROR","message" => "File could not be extracted" ) );
				} else {
					echo json_encode( array( "status" => "OK","message" => "File successfully extracted." ) );
				}
			} else {
				if( ! IFMArchive::extractTar( $d['filename'], $d['targetdir'] ) ) {
					echo json_encode( array( "status" => "ERROR","message" => "File could not be extracted" ) );
				} else {
					echo json_encode( array( "status" => "OK","message" => "File successfully extracted." ) );
				}
			} 
		}
	}

	// uploads a file
	private function uploadFile( array $d ) {
		if( $this->config['upload'] != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to upload files" ) );
		elseif( !isset( $_FILES['file'] ) )
			echo json_encode( array( "file" => $_FILE,"files" => $_FILES ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			$newfilename = ( isset( $d["newfilename"] ) && $d["newfilename"]!="" ) ? $d["newfilename"] : $_FILES['file']['name'];
			if( ! $this->isFilenameValid( $newfilename ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Invalid filename given" ) );
			else {
				if( $_FILES['file']['tmp_name'] ) {
					if( is_writable( getcwd( ) ) ) {
						if( move_uploaded_file( $_FILES['file']['tmp_name'], $newfilename ) )
							echo json_encode( array( "status" => "OK", "message" => "The file ".$_FILES['file']['name']." was uploaded successfully", "cd" => $d['dir'] ) );
						else
							echo json_encode( array( "status" => "ERROR", "message" => "File could not be uploaded" ) );
					}
					else
						echo json_encode( array( "status" => "ERROR", "message" => "File could not be uploaded since it has no permissions to write in this directory" ) );
				} else
					echo json_encode( array( "status" => "ERROR", "message" => "No file found" ) );
			}
		}
	}

	// change permissions of a file
	private function changePermissions( array $d ) {
		if( $this->config['chmod'] != 1 ) echo json_encode( array( "status" => "ERROR", "message" => "No rights to change permissions" ) );
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
		if( $this->config['zipnload'] != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to download directories" ) );
		else {
			$this->chDirIfNecessary( $d['dir'] );
			if( ! file_exists( $d['filename'] ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Directory not found" ) );
			elseif ( ! $this->isFilenameValid( $d['filename'] ) )
				echo json_encode( array( "status" => "ERROR", "message" => "Filename not valid" ) );
			else {
				unset( $zip );
				$dfile = $this->pathCombine( $this->config['tmp_dir'], uniqid( "ifm-tmp-" ) . ".zip" ); // temporary filename
				try {
					IFMArchive::createZip( realpath( $d['filename'] ), $dfile, ( $d['filename'] == "." ) );
					if( $d['filename'] == "." ) {
						if( getcwd() == $this->getScriptRoot() )
							$d['filename'] = "root";
						else
							$d['filename'] = basename( getcwd() );
					}
					$this->fileDownload( $dfile, $d['filename'] . ".zip" );
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
		if( $this->config['remoteupload'] != 1 )
			echo json_encode( array( "status" => "ERROR", "message" => "No permission to remote upload files" ) );
		elseif( !isset( $d['method'] ) || !in_array( $d['method'], array( "curl", "file" ) ) )
			echo json_encode( array( "status" => "error", "message" => "Invalid method given. Valid methods: ['curl', 'file']" ) );
		elseif( $d['method']=="curl" && $this->checkCurl( ) == false )
			echo json_encode( array( "status" => "ERROR", "message" => "cURL extention not installed. Please install the cURL extention to use remote file upload." ) );
		elseif( $d['method']=="curl" && $this->checkCurl( ) == true ) {
			$filename = ( isset( $d['filename'] )&&$d['filename']!="" )?$d['filename']:"curl_".uniqid( );
			$this->chDirIfNecessary( $d['dir'] );
			$ch = curl_init( );
			if( $ch ) {
				if( $this->isFilenameValid( $filename ) == false )
					echo json_encode( array( "status" => "ERROR", "message" => "This filename is not valid." ) );
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
			if( $this->isFilenameValid( $filename ) == false )
				echo json_encode( array( "status" => "ERROR", "message" => "This filename is not valid." ) );
			else {
				$this->chDirIfNecessary( $d['dir'] );
				try {
					file_put_contents( $filename, file_get_contents( $d['url'] ) );
					echo json_encode( array( "status" => "OK", "message" => "File successfully uploaded" ) );
				} catch( Exception $e ) {
					echo json_encode( array( "status" => "ERROR", "message" => $e->getMessage() ) );
				}
			}
		}
		else
			echo json_encode( array( "status" => "error", "message" => "Corrupt parameter data" ) );
	}

	//apis

	/*
	   help functions
	 */

	public function checkAuth() {
		if( $this->config['auth'] == 1 && ( ! isset( $_SESSION['auth'] ) || $_SESSION['auth'] !== true ) ) {
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

	private function checkCredentials( $user, $pass ) {
		list( $src, $srcopt ) = explode( ";", $this->config['auth_source'], 2 );
		switch( $src ) {
			case "inline":
				list( $uname, $hash ) = explode( ":", $srcopt );
				return password_verify( $pass, trim( $hash ) ) ? ( $uname == $user ) : false;
				break;
			case "file":
				if( @file_exists( $srcopt ) && @is_readable( $srcopt ) ) {
					$htpasswd = new Htpasswd( $srcopt );
					return $htpasswd->verify( $user, $pass );
				} else {
					return false;
				}
				break;
			case "ldap":
				$authenticated = false;
				list( $ldap_server, $rootdn ) = explode( ";", $srcopt );
				$u = "uid=" . $user . "," . $rootdn;
				if( ! $ds = ldap_connect( $ldap_server ) ) {
					trigger_error( "Could not reach the ldap server.", E_USER_ERROR );
					return false;
				}
				ldap_set_option( $ds, LDAP_OPT_PROTOCOL_VERSION, 3 );
				if( $ds ) {
					$ldbind = @ldap_bind( $ds, $u, $pass );
					if( $ldbind ) {
						$authenticated = true;
					} else {
						trigger_error( ldap_error( $ds ), E_USER_ERROR );
						$authenticated = false;
					}
					ldap_unbind( $ds );
				} else {
					$authenticated = false;
				}
				return $authenticated;
				break;
		}
		return false;
	}

	private function loginForm($loginFailed=false) {
		$err = "";
		if( $loginFailed ) 
			$err = '<div class="alert alert-danger">Login failed.</div>';
		$this->getHTMLHeader();
		print str_replace( "{{error}}", $err, $this->templates['login'] );
		$this->getHTMLFooter();
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

	private function isAbsolutePath( $path ) {
		if( $path === null || $path === '' )
			return false;
		return $path[0] === DIRECTORY_SEPARATOR || preg_match('~\A[A-Z]:(?![^/\\\\])~i',$path) > 0;
	}

	private function getRootDir() {
		if( $this->config['root_dir'] == "" )
			return realpath( $this->getScriptRoot() );
		elseif( $this->isAbsolutePath( $this->config['root_dir'] ) )
			return realpath( $this->config['root_dir'] );
		else
			return realpath( $this->pathCombine( $this->getScriptRoot(), $this->config['root_dir'] ) );
	}

	private function getScriptRoot() {
		return ( defined( 'IFM_FILENAME' ) ? dirname( realpath( IFM_FILENAME ) ) : dirname( __FILE__ ) );
	}

	private function getValidDir( $dir ) {
		if( ! $this->isPathValid( $dir ) || ! is_dir( $dir ) )
			return "";
		else {
			$rpDir = realpath( $dir );
			$rpConfig = $this->getRootDir();
			if( $rpConfig == "/" )
				return $rpDir;
			elseif( $rpDir == $rpConfig )
				return "";
			else {
				$part = substr( $rpDir, strlen( $rpConfig ) );
				$part = ( in_array( substr( $part, 0, 1 ), ["/", "\\"] ) ) ? substr( $part, 1 ) : $part;
				return $part;
			}
		}
	}


	private function isPathValid( $dir ) {
		/**
		 * This function is also used to check non-existent paths, but the PHP realpath function returns false for
		 * nonexistent paths. Hence we need to check the path manually in the following lines.
		 */
		$tmp_d = $dir;
		$tmp_missing_parts = array();
		while( realpath( $tmp_d ) === false ) {
			$tmp_i = pathinfo( $tmp_d );
			array_push( $tmp_missing_parts, $tmp_i['filename'] );
			$tmp_d = dirname( $tmp_d );
			if( $tmp_d == dirname( $tmp_d ) ) break;
		}
		$rpDir = $this->pathCombine( realpath( $tmp_d ), implode( "/", array_reverse( $tmp_missing_parts ) ) );
		$rpConfig = $this->getRootDir();
		if( ! is_string( $rpDir ) || ! is_string( $rpConfig ) ) // can happen if open_basedir is in effect
			return false;
		elseif( $rpDir == $rpConfig )
			return true;
		elseif( 0 === strpos( $rpDir, $rpConfig ) )
			return true;
		else
			return false;
	}

	private function chDirIfNecessary($d) {
		if( substr( getcwd(), strlen( $this->getScriptRoot() ) ) != $this->getValidDir($d) ) {
			chdir( $d );
		}
	}

	private function getTypeIcon( $type ) {
		$type = strtolower($type);
		switch( $type ) {
			case "aac":	case "aiff": case "mid": case "mp3": case "wav": return 'icon icon-file-audio'; break;
			case "ai": case "bmp": case "eps": case "tiff": case "gif": case "jpg": case "jpeg": case "png": case "psd": return 'icon icon-file-image'; break;
			case "avi": case "flv": case "mp4": case "mpg": case "mkv": case "mpeg": case "webm": case "wmv": case "mov": return 'icon icon-file-video'; break;
			case "c": case "cpp": case "css": case "dat": case "h": case "html": case "java": case "js": case "php": case "py": case "sql": case "xml": case "yml": return 'icon icon-file-code'; break;
			case "doc": case "dotx": case "md": case "odf": case "odt": case "rtf": case "txt": return 'icon icon-file-word'; break;
			case "csv": case "ods": case "xls": case "xlsx": return 'icon icon-file-excel'; break;
			case "odp": case "ppt": case "pptx": return 'icon icon-file-powerpoint'; break;
			case "pdf": return 'icon icon-file-pdf'; break;
			case "tgz":	case "zip": case "tar": case "tgz": case "tar.gz": case "tar.xz": case "tar.bz2": case "7z": case "rar": return 'icon icon-file-archive';
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

	/**
	 * Copy a file, or recursively copy a folder and its contents
	 *
	 * @author      Aidan Lister <aidan@php.net>
	 * @version     1.0.1
	 * @link        http://aidanlister.com/2004/04/recursively-copying-directories-in-php/
	 * @param       string   $source    Source path
	 * @param       string   $dest      Destination path
	 * @return      bool     Returns TRUE on success, FALSE on failure
	 */
	private function copyr( $source, $dest )
	{
		// Check for symlinks
		if (is_link($source)) {
			return symlink(readlink($source), $dest);
		}

		// Simple copy for a file
		if (is_file($source)) {
			$dest = ( is_dir( $dest ) ) ? $this->pathCombine( $dest, basename( $source ) ) : $dest;
			return copy($source, $dest);
		} else {
			$dest = $this->pathCombine( $dest, basename( $source ) );
		}

		// Make destination directory
		if (!is_dir($dest)) {
			mkdir($dest);
		}

		// Loop through the folder
		$dir = dir($source);
		while (false !== $entry = $dir->read()) {
			// Skip pointers
			if ($entry == '.' || $entry == '..') {
				continue;
			}

			// Deep copy directories
			$this->copyr("$source/$entry", "$dest/$entry");
		}

		// Clean up
		$dir->close();
		return true;
	}

	// combines two parts to a valid path
	private function pathCombine( $a, $b ) {
		if( trim( $a ) == "" && trim( $b ) == "" )
			return "";
		elseif( trim( $a ) == "" )
			return ltrim( $b, '/' );
		else
			return rtrim( $a, '/' ) . '/' . trim( $b, '/' );
	}

	// check if filename is allowed
	private function isFilenameValid( $f ) {
		if( ! $this->isFilenameAllowed( $f ) )
			return false;
		if( strtoupper( substr( PHP_OS, 0, 3 ) ) == "WIN" ) {
			// windows-specific limitations
			foreach( array( '\\', '/', ':', '*', '?', '"', '<', '>', '|' ) as $char )
				if( strpos( $f, $char ) !== false )
					return false;
		} else {
			// *nix-specific limitations
			foreach( array( '/', '\0' ) as $char )
				if( strpos( $f, $char ) !== false )
					return false;
		}
		// custom limitations
		foreach( $this->config['forbiddenChars'] as $char )
			if( strpos( $f, $char ) !== false )
				return false;
		return true;
	}

	private function isFilenameAllowed( $f ) {
		if( $this->config['showhtdocs'] != 1 && substr( $f, 0, 3 ) == ".ht" )
			return false;
		elseif( $this->config['showhiddenfiles'] != 1 && substr( $f, 0, 1 ) == "." )
			return false;
		else
			return true;
	}

	// sorting function for file and dir arrays
	private function sortByName( $a, $b ) {
		if( strtolower( $a['name'] ) == strtolower( $b['name'] ) ) return 0;
		return ( strtolower( $a['name'] ) < strtolower( $b['name'] ) ) ? -1 : 1;
	}

	// is cURL extention avaliable?
	private function checkCurl() {
		if( !function_exists( "curl_init" ) ||
				!function_exists( "curl_setopt" ) ||
				!function_exists( "curl_exec" ) ||
				!function_exists( "curl_close" ) ) return false;
		else return true;
	}

	private function fileDownload( $file, $name="" ) {
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

}
