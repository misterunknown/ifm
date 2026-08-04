<?php

/**
 * =======================================================================
 * Improved File Manager
 * ---------------------
 * License: This project is provided under the terms of the MIT LICENSE
 * http://github.com/misterunknown/ifm/blob/master/LICENSE
 * =======================================================================
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

class IFMException extends Exception {
	public $forUser = true;
	public function __construct($message, $forUser = true, $code = 0, ?Exception $previous = null) {
		$this->forUser = $forUser;
		parent::__construct($message, $code, $previous);
	}
}

class IFM {
	private $defaultconfig = [
		// general config
		"auth" => 0,
		"auth_source" => 'inline;admin:$2y$10$0Bnm5L4wKFHRxJgNq.oZv.v7yXhkJZQvinJYR2p6X1zPvzyDRUVRC',
		"auth_ignore_basic" => 0,
		"root_dir" => "",
		"root_public_url" => "",
		"tmp_dir" => "",
		"timezone" => "",
		"forbiddenChars" => [],
		"language" => "###vars:default_lang###",
		"selfoverwrite" => 0,
		"session_name" => false,

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
		"remoteupload_disable_ssrf_check" => 0,     // security default
		"remoteupload_enable_follow_location" => 0, // security default
		"rename" => 1,
		"zipnload" => 1,
		"createarchive" => 1,
		"search" => 1,
		"paging" => 0,
		"pageLength" => 50,

		// gui controls
		"showlastmodified" => 0,
		"showfilesize" => 1,
		"showowner" => 1,
		"showgroup" => 1,
		"showpermissions" => 2,
		"showhtdocs" => 0,
		"showhiddenfiles" => 1,
		"showpath" => 0,
		"contextmenu" => 1,
		"disable_mime_detection" => 0,
		"showrefresh" => 1,
		"forceproxy" => 0,
		"confirmoverwrite" => 1,
		"customDateFormat" => false
	];

	private $config = [];
	private $i18n = [];
	public $mode = "standalone";
	private $initialWD;
	private $rootDirCache = null;
	private $currentLang = null;
	private $uidCache = [];
	private $gidCache = [];
	// per-request memoization for mime_content_type() results of extensions that
	// are not covered by self::MIME_MAP; reset with every new request
	private $mimeCache = [];

	// well-known extension => MIME type mappings; resolving from this table avoids
	// the read() syscall mime_content_type() performs for every single file
	private const MIME_MAP = [
		// images
		"avif" => "image/avif", "bmp" => "image/bmp", "gif" => "image/gif",
		"ico" => "image/vnd.microsoft.icon", "jpeg" => "image/jpeg", "jpg" => "image/jpeg",
		"png" => "image/png", "svg" => "image/svg+xml", "tif" => "image/tiff",
		"tiff" => "image/tiff", "webp" => "image/webp",
		// audio / video
		"aac" => "audio/aac", "flac" => "audio/flac", "m4a" => "audio/mp4",
		"mid" => "audio/midi", "mp3" => "audio/mpeg", "oga" => "audio/ogg",
		"ogg" => "audio/ogg", "wav" => "audio/x-wav",
		"avi" => "video/x-msvideo", "m4v" => "video/mp4", "mkv" => "video/x-matroska",
		"mov" => "video/quicktime", "mp4" => "video/mp4", "mpeg" => "video/mpeg",
		"mpg" => "video/mpeg", "ogv" => "video/ogg", "webm" => "video/webm",
		"wmv" => "video/x-ms-wmv",
		// documents
		"doc" => "application/msword",
		"docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"odp" => "application/vnd.oasis.opendocument.presentation",
		"ods" => "application/vnd.oasis.opendocument.spreadsheet",
		"odt" => "application/vnd.oasis.opendocument.text",
		"pdf" => "application/pdf", "ppt" => "application/vnd.ms-powerpoint",
		"pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"rtf" => "application/rtf", "xls" => "application/vnd.ms-excel",
		"xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		// archives
		"7z" => "application/x-7z-compressed", "bz2" => "application/x-bzip2",
		"gz" => "application/gzip", "iso" => "application/x-iso9660-image",
		"rar" => "application/vnd.rar", "tar" => "application/x-tar",
		"tar.bz2" => "application/x-bzip2", "tar.gz" => "application/gzip",
		"tar.xz" => "application/x-xz", "tgz" => "application/gzip",
		"xz" => "application/x-xz", "zip" => "application/zip",
		// text / code -- these keep the frontend's "editable" detection working
		"c" => "text/x-c", "conf" => "text/plain", "cpp" => "text/x-c++",
		"css" => "text/css", "csv" => "text/csv", "h" => "text/x-c",
		"htm" => "text/html", "html" => "text/html", "ini" => "text/plain",
		"java" => "text/x-java", "js" => "text/javascript", "json" => "application/json",
		"less" => "text/plain", "log" => "text/plain", "md" => "text/markdown",
		"mjs" => "text/javascript", "php" => "text/x-php", "py" => "text/x-python",
		"sass" => "text/plain", "scss" => "text/plain", "sh" => "text/x-shellscript",
		"sql" => "text/plain", "ts" => "text/plain", "tsv" => "text/tab-separated-values",
		"txt" => "text/plain", "xml" => "text/xml", "yaml" => "text/yaml",
		"yml" => "text/yaml",
	];
	// set to true when the request was authenticated via the X-IFM-AUTH /
	// Authorization header (stateless API access) rather than a cookie session
	private $authViaHeader = false;

	public function __construct($config=[]) {
		// store initial working directory
		$this->initialWD = getcwd();

		// load the default config
		$this->config = $this->defaultconfig;

		// load config from environment variables
		foreach (array_keys($this->config) as $key) {
			if (($value = getenv('IFM_' . strtoupper($key))) !== false) {
				// remove matching surrounding quotes from env vars
				if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'") && substr($value, -1) === $value[0])
					$value = substr($value, 1, -1);
				if (preg_match('/^-?\d+$/', $value))
					$value = intval($value);
				$this->config[$key] = $value;
			}
		}

		// load config from passed array
		$this->config = array_merge($this->config, $config);

		$i18n = [];
		###vars:languageincludes###
		$this->i18n = $i18n;

		if ($this->config['timezone'])
			date_default_timezone_set($this->config['timezone']);

		if ($this->config['session_name'])
			session_name($this->config['session_name']);

		// set cookie_path for SESSION to REQUEST_URI without QUERY_STRING
		$cookie_path = substr($_SERVER['REQUEST_URI'], 0, strpos($_SERVER['REQUEST_URI'], '?') ?: strlen($_SERVER['REQUEST_URI']));
		session_set_cookie_params([
			'lifetime' => 0,
			'path' => $cookie_path,
			'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
			'httponly' => true,
			'samesite' => 'Lax'
		]);
	}

	/**
	 * This function contains the client-side application
	 */
	public function getApplication() {
		$this->getHTMLHeader();
		print '<div id="ifm"></div>';
		$this->getJS();
		print '<script>var ifm = new IFM(); ifm.init("ifm");</script>';
		$this->getHTMLFooter();
	}

	public function getInlineApplication() {
		$this->getCSS();
		print '<div id="ifm"></div>';
		$this->getJS();
	}

	public function getCSS() {
		echo <<<'f00bar'
			###ASSETS_CSS###
f00bar;
	}

	public function getJS() {
		echo <<<'f00bar'
			###ASSETS_JS###
f00bar;
	}

	public function getHTMLHeader() {
		$lang = htmlspecialchars($this->getCurrentLang(), ENT_QUOTES);
		print '<!DOCTYPE HTML>
		<html lang="'.$lang.'">
			<head>
				<title>IFM - improved file manager</title>
				<meta charset="utf-8">
				<meta http-equiv="X-UA-Compatible" content="IE=edge">
				<meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1.0, shrink-to-fit=no">';
		$this->getCSS();
		print '</head><body>';
	}

	public function getHTMLFooter() {
		print '</body></html>';
	}

	/**
	 * main functions
	 */

	public function run($mode="standalone") {
		try {
			if (!is_dir(realpath($this->config['root_dir'])) || !is_readable(realpath($this->config['root_dir'])))
				throw new IFMException("Cannot access root_dir.", false);

			chdir(realpath($this->config['root_dir']));

			$this->mode = $mode;
			if (isset($_REQUEST['api']) || $mode == "api")
				$this->jsonResponse($this->dispatch());
			elseif ($mode == "standalone")
				$this->getApplication();
			else
				$this->getInlineApplication();
		} catch (IFMException $e) {
			$this->jsonResponse(["status" => "ERROR", "message" => ($e->forUser ? $e->getMessage() : "An internal error occurred.")]);
		} catch (Exception $e) {
			// don't leak internal exception details (paths etc.) to the client
			$this->jsonResponse(["status" => "ERROR", "message" => "An internal error occurred."]);
		}
	}

	private function dispatch() {
		$api = $_REQUEST['api'] ?? null;

		// APIs which do not need authentication
		switch ($api) {
			case "checkAuth":
				if ($this->checkAuth())
					return ["status" => "OK", "message" => "Authenticated"];
				else
					return ["status" => "ERROR", "message" => "Not authenticated"];
			case "getConfig":
				return $this->getConfig();
			case "getTemplates":
				return $this->getTemplates();
			case "getI18N":
				return $this->getI18N($_REQUEST['lang'] ?? $this->getCurrentLang());
			case "logout":
				if (session_status() !== PHP_SESSION_ACTIVE)
					session_start();
				session_unset();
				session_destroy();
				$cp = session_get_cookie_params();
				setcookie(session_name(), '', time() - 3600, $cp['path'], $cp['domain'], $cp['secure'], $cp['httponly']);
				header("Location: " . strtok($_SERVER["REQUEST_URI"], '?'));
				exit;
		}

		// check authentication
		if (!$this->checkAuth())
			throw new IFMException("Not authenticated");

		// state-changing APIs require POST and a valid CSRF token.
		// Requests authenticated via the X-IFM-AUTH / Authorization header are
		// stateless API calls (no ambient cookie credentials), so CSRF does not
		// apply to them and they are exempt from the token check.
		if (!$this->authViaHeader && in_array($api, ["createDir", "saveFile", "delete", "rename", "extract", "upload", "copyMove", "changePermissions", "remoteUpload", "createArchive"], true)) {
			if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST')
				throw new IFMException("Invalid request method");
			$token = $_SERVER['HTTP_X_IFM_CSRF'] ?? ($_POST['csrf_token'] ?? '');
			if (!is_string($token) || !hash_equals($this->getCsrfToken(), $token))
				throw new IFMException("Invalid CSRF token");
		}

		// api requests which work without a valid working directory
		switch ($api) {
			case "getRealpath":
				if (isset($_REQUEST["dir"]) && $_REQUEST["dir"] != "")
					return ["realpath" => $this->getValidDir($_REQUEST["dir"])];
				else
					return ["realpath" => ""];
			case "getFiles":
				if (isset($_REQUEST["dir"]) && $this->isPathValid($_REQUEST["dir"]))
					return $this->getFiles($_REQUEST["dir"]);
				else
					return $this->getFiles("");
			case "getFolders":
				return $this->getFolders($_REQUEST);
		}

		// checking working directory
		if (!isset($_REQUEST["dir"]) || !$this->isPathValid($_REQUEST["dir"]))
			throw new IFMException($this->l("invalid_dir"));

		$this->chDirIfNecessary($_REQUEST['dir']);
		switch ($api) {
			case "createDir":	return $this->createDir($_REQUEST);
			case "saveFile":	return $this->saveFile($_REQUEST);
			case "getContent":	return $this->getContent($_REQUEST);
			case "delete":		return $this->deleteFiles($_REQUEST);
			case "rename":		return $this->renameFile($_REQUEST);
			case "download":	return $this->downloadFile($_REQUEST);
			case "extract":		return $this->extractFile($_REQUEST);
			case "upload":		return $this->uploadFile($_REQUEST);
			case "copyMove":	return $this->copyMove($_REQUEST);
			case "changePermissions": return $this->changePermissions($_REQUEST);
			case "zipnload":	return $this->zipnload($_REQUEST);
			case "remoteUpload":	return $this->remoteUpload($_REQUEST);
			case "searchItems":	return $this->searchItems($_REQUEST);
			case "getFolderTree":	return $this->getFolderTree($_REQUEST);
			case "createArchive":	return $this->createArchive($_REQUEST);
			case "proxy":		return $this->downloadFile($_REQUEST, false);
			default:
				throw new IFMException($this->l("invalid_action"));
		}
	}

	/**
	 * api functions
	 */

	private function getI18N($lang="en") {
		if (in_array($lang, array_keys($this->i18n)))
			return array_merge($this->i18n['en'], $this->i18n[$lang]);
		else
			return $this->i18n['en'];
	}

	private function getTemplates() {
		// templates
		$templates = [];
		$templates['app'] = <<<'f00bar'
###file:src/templates/app.html###
f00bar;
		$templates['login'] = <<<'f00bar'
###file:src/templates/login.html###
f00bar;
		$templates['filetable'] = <<<'f00bar'
###file:src/templates/filetable.html###
f00bar;
		$templates['footer'] = <<<'f00bar'
###file:src/templates/footer.html###
f00bar;
		$templates['task'] = <<<'f00bar'
###file:src/templates/task.html###
f00bar;
		$templates['ajaxrequest'] = <<<'f00bar'
###file:src/templates/modal.ajaxrequest.html###
f00bar;
		$templates['copymove'] = <<<'f00bar'
###file:src/templates/modal.copymove.html###
f00bar;
		$templates['createdir'] = <<<'f00bar'
###file:src/templates/modal.createdir.html###
f00bar;
		$templates['createarchive'] = <<<'f00bar'
###file:src/templates/modal.createarchive.html###
f00bar;
		$templates['deletefile'] = <<<'f00bar'
###file:src/templates/modal.deletefile.html###
f00bar;
		$templates['extractfile'] = <<<'f00bar'
###file:src/templates/modal.extractfile.html###
f00bar;
		$templates['file'] = <<<'f00bar'
###file:src/templates/modal.file.html###
f00bar;
		$templates['file_editoroptions'] = <<<'f00bar'
###file:src/templates/modal.file_editoroptions.html###
f00bar;
		$templates['remoteupload'] = <<<'f00bar'
###file:src/templates/modal.remoteupload.html###
f00bar;
		$templates['renamefile'] = <<<'f00bar'
###file:src/templates/modal.renamefile.html###
f00bar;
		$templates['search'] = <<<'f00bar'
###file:src/templates/modal.search.html###
f00bar;
		$templates['searchresults'] = <<<'f00bar'
###file:src/templates/modal.searchresults.html###
f00bar;
		$templates['uploadfile'] = <<<'f00bar'
###file:src/templates/modal.uploadfile.html###
f00bar;
		$templates['uploadconfirmoverwrite'] = <<<'f00bar'
###file:src/templates/modal.uploadconfirmoverwrite.html###
f00bar;
		return $templates;
	}

	private function getFiles($dir) {
		$this->chDirIfNecessary($dir);

		$files = []; $dirs = [];
		$scriptName = basename($_SERVER['SCRIPT_NAME']);
		$isInitialWD = (getcwd() == $this->initialWD);
		$showHtdocs = ($this->config['showhtdocs'] == 1);
		$showHidden = ($this->config['showhiddenfiles'] == 1);

		if ($handle = opendir(".")) {
			$isRootDir = (getcwd() == $this->getRootDir());
			while (false !== ($result = readdir($handle))) {
				if ($result == "." )
					continue;
				if ($result == ".." && $isRootDir)
					continue;
				if ($result == $scriptName && $isInitialWD)
					continue;
				if (!$showHtdocs && ($result == ".htaccess" || $result == ".htpasswd"))
					continue;
				if (!$showHidden && $result != ".." && $result[0] == ".")
					continue;
				$item = $this->getItemInformation($result);
				if ($item['type'] == "dir")
					$dirs[] = $item;
				else
					$files[] = $item;
			}
			closedir($handle);
		}
		$cmp = function($a, $b) { return strnatcasecmp($a['name'], $b['name']); };
		usort($dirs, $cmp);
		usort($files, $cmp);

		return array_merge($dirs, $files);
	}

	private function getItemInformation($name) {
		$item = [];
		$item["name"] = $name;
		if (is_dir($name)) {
			$item["type"] = "dir";
			if ($name == "..")
				$item["icon"] = "icon fa fa-angle-up";
			else
				$item["icon"] = "icon fa fa-folder-o";
		} else {
			$item["type"] = "file";
			$type = "unknown";
			$complex_extensions = [".tar.bz2", ".tar.gz", ".tar.xz"];

			foreach ($complex_extensions as $ext) {
				if (substr($name, -strlen($ext)) === $ext) {
					$type = ltrim($ext, '.');
					break;
				}
			}

			if ($type === "unknown") {
				$type = pathinfo($name, PATHINFO_EXTENSION);
			}

			$item["icon"] = $this->getTypeIcon($type);
			$item["ext"] = strtolower($type);
			if (!$this->config['disable_mime_detection'])
				$item["mime_type"] = $this->getMimeType($name, $item["ext"]);
		}
		if ($this->config['showlastmodified'] == 1)
			$item["lastmodified"] = filemtime($name);
		if ($this->config['showfilesize'] == 1) {
			if ($item['type'] == "dir") {
				$item['size_raw'] = 0;
				$item['size'] = "";
			} else {
				$item["size_raw"] = filesize($name);
				$item["size"] = $this->formatSize($item["size_raw"]);
			}
		}
		if ($this->config['showpermissions'] > 0) {
			if ($this->config['showpermissions'] == 1)
				$item["fileperms"] = substr(decoct(fileperms($name)), -3);
			elseif ($this->config['showpermissions'] == 2)
				$item["fileperms"] = $this->filePermsDecode(fileperms($name));
			if ($item["fileperms"] == "")
				$item["fileperms"] = " ";
			$item["filepermmode"] = ($this->config['showpermissions'] == 1) ? "short" : "long";
		}
		if ($this->config['showowner'] == 1) {
			$uid = fileowner($name);
			if (function_exists("posix_getpwuid") && $uid !== false) {
				if (!array_key_exists($uid, $this->uidCache)) {
					$ownerarr = posix_getpwuid($uid);
					$this->uidCache[$uid] = $ownerarr ? $ownerarr['name'] : false;
				}
				$item["owner"] = $this->uidCache[$uid];
			} else $item["owner"] = false;
		}
		if ($this->config['showgroup'] == 1) {
			$gid = filegroup($name);
			if (function_exists("posix_getgrgid") && $gid !== false) {
				if (!array_key_exists($gid, $this->gidCache)) {
					$grouparr = posix_getgrgid($gid);
					$this->gidCache[$gid] = $grouparr ? $grouparr['name'] : false;
				}
				$item["group"] = $this->gidCache[$gid];
			} else $item["group"] = false;
		}
		return $item;
	}

	private function getConfig() {
		$ret = $this->config;
		$ret['inline'] = ($this->mode == "inline") ? true : false;
		$ret['isDocroot'] = ($this->getRootDir() == $this->initialWD);

		foreach (["auth_source", "root_dir", "tmp_dir", "session_name", "auth_ignore_basic", "remoteupload_disable_ssrf_check", "forbiddenChars"] as $field)
			unset($ret[$field]);

		$ret['csrf_token'] = $this->getCsrfToken();

		return $ret;
	}

	private function getFolders($d) {
		if (!isset($d['dir']))
			$d['dir'] = $this->getRootDir();

		if (!$this->isPathValid($d['dir']))
			return [];
		else {
			$ret = [];
			foreach (glob($this->pathCombine($d['dir'], "*"), GLOB_ONLYDIR) as $dir) {
				array_push($ret, [
					"text" => htmlspecialchars(basename($dir)),
					"lazyLoad" => true,
					"dataAttr" => ["path" => $dir]
				]);
			}
			usort($ret, function($a, $b) { return strnatcasecmp($a['text'], $b['text']); });
			if (realpath($d['dir']) == $this->initialWD)
				$ret = array_merge(
					[
						0 => [
							"text" => "/ [root]",
							"dataAttr" => ["path" => $this->getRootDir()]
						]
					],
					$ret
				);
			return $ret;
		}
	}

	private function searchItems($d) {
		if ($this->config['search'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (strpos($d['pattern'], '/') !== false)
			throw new IFMException($this->l('pattern_error_slashes'));

		$results = $this->searchItemsRecursive($d['pattern']);
		return $results;
	}

	private function searchItemsRecursive($pattern, $dir="", array &$visited=[]) {
		$items = [];
		if ($dir === "") $dir = '.';

		// protect against symlink loops
		$rp = realpath($dir);
		if ($rp === false || isset($visited[$rp]))
			return $items;
		$visited[$rp] = true;

		foreach (glob($this->pathCombine($dir, $pattern)) as $result)
			$items[] = $this->getItemInformation($result);

		foreach (glob($this->pathCombine($dir, '*'), GLOB_ONLYDIR) as $subdir)
			foreach ($this->searchItemsRecursive($pattern, $subdir, $visited) as $it)
				$items[] = $it;

		return $items;
	}

	private function getFolderTree($d) {
		return array_merge(
			[
				0 => [
					"text" => "/ [root]",
					"nodes" => [],
					"dataAttributes" => ["path" => $this->getRootDir()]
				]
			],
			$this->getFolderTreeRecursive($d['dir'])
		);
	}

	private function getFolderTreeRecursive($start_dir, array &$visited=[]) {
		$ret = [];
		$start_dir = realpath($start_dir);
		// protect against symlink loops
		if ($start_dir === false || isset($visited[$start_dir]))
			return $ret;
		$visited[$start_dir] = true;
		if ($handle = opendir($start_dir)) {
			while (false !== ($result = readdir($handle))) {
				$path = $this->pathCombine($start_dir, $result);
				if (is_dir($path) && $result != "." && $result != ".." ) {
					array_push($ret, [
						"text" => htmlspecialchars($result),
						"dataAttributes" => ["path" => $path],
						"nodes" => $this->getFolderTreeRecursive($path, $visited)
					]);
				}
			}
			closedir($handle);
		}
		usort($ret, function($a, $b) { return strnatcasecmp($a['text'], $b['text']); });
		return $ret;
	}

	private function copyMove($d) {
		if ($this->config['copymove'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (!isset($d['destination']) || !$this->isPathValid(realpath($d['destination'])))
			throw new IFMException($this->l('invalid_dir'));

		if (!is_array($d['filenames']))
			throw new IFMException($this->l('invalid_params'));

		if (!in_array($d['action'], ['copy', 'move']))
			throw new IFMException($this->l('invalid_action'));

		$err = [];
		foreach ($d['filenames'] as $file) {
			if (!file_exists($file) || !$this->isFilenameValid($file)) {
				array_push($err, $file);
				continue;
			}
			if ($d['action'] == "copy") {
				$this->xcopy($file, $d['destination']) or array_push($err, $file);
			} elseif ($d['action'] == "move") {
				rename($file, $this->pathCombine($d['destination'], basename($file))) or array_push($err, $file);
			}
		}
		if (empty($err)) {
			return [
				"status" => "OK",
				"message" => ($d['action'] == "copy" ? $this->l('copy_success') : $this->l('move_success'))
			];
		} else
			throw new IFMException($this->buildErrorList(($d['action'] == "copy" ? $this->l('copy_error') : $this->l('move_error')), $err));
	}

	// creates a directory
	private function createDir($d) {
		if ($this->config['createdir'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if ($d['dirname'] == "" || !$this->isFilenameValid($d['dirname']))
			throw new IFMException($this->l('invalid_dir'));

		if (@mkdir($d['dirname']))
			return ["status" => "OK", "message" => $this->l('folder_create_success')];
		else
			throw new IFMException($this->l('folder_create_error').". ".error_get_last()['message']);
	}

	// save a file
	private function saveFile($d) {
		if (!isset($d['filename']) || !$this->isFilenameValid($d['filename']))
			throw new IFMException($this->l('invalid_filename'));

		if (!isset($d['content']))
			throw new IFMException($this->l('file_save_error'));

		// cwd is already $d['dir'] at this point (see chDirIfNecessary in dispatch)
		$exists = file_exists($d['filename']);
		if (($exists && $this->config['edit'] != 1) || (!$exists && $this->config['createfile'] != 1))
			throw new IFMException($this->l('nopermissions'));

		if (@file_put_contents($d['filename'], $d['content']) !== false)
			return ["status" => "OK", "message" => $this->l('file_save_success')];
		else
			throw new IFMException($this->l('file_save_error'));
	}

	// gets the content of a file
	// notice: if the content is not JSON encodable it returns an error
	private function getContent($d) {
		if ($this->config['edit'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (isset($d['filename']) && $this->isFilenameValid($d['filename']) && is_file($d['filename']) && is_readable($d['filename'])) {
			$content = @file_get_contents($d['filename']);
			$this->convertToUTF8($content);
			return ["status" => "OK", "data" => ["filename" => $d['filename'], "content" => $content]];
		} else
			throw new IFMException($this->l('file_not_found'));
	}

	// deletes a bunch of files or directories
	private function deleteFiles($d) {
		if ($this->config['delete'] != 1)
			throw new IFMException($this->l('nopermissions'));

		$err = [];
		foreach ($d['filenames'] as $file) {
			if ($this->isFilenameValid($file)) {
				if (is_dir($file) && !is_link($file)) {
					if (!$this->rec_rmdir($file))
						array_push($err, $file);
				} else {
					@unlink($file) or array_push($err, $file);
				}
			} else {
				array_push($err, $file);
			}
		}
		if (empty($err))
			return ["status" => "OK", "message" => $this->l('file_delete_success')];
		else
			throw new IFMException($this->buildErrorList($this->l('file_delete_error'), $err));
	}

	// renames a file
	private function renameFile(array $d) {
		if ($this->config['rename'] != 1)
			throw new IFMException($this->l('nopermissions'));
		elseif (!$this->isFilenameValid($d['filename']) || !$this->isFilenameValid($d['newname']))
			throw new IFMException($this->l('invalid_filename'));

		if (@rename($d['filename'], $d['newname']))
			return ["status" => "OK", "message" => $this->l('file_rename_success')];
		else
			throw new IFMException($this->l('file_rename_error'));
	}

	// provides a file for downloading
	private function downloadFile(array $d, $forceDL=true) {
		if ($this->config['download'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (!$this->isFilenameValid($d['filename']))
			throw new IFMException($this->l('invalid_filename'));

		if (!is_file($d['filename']))
			http_response_code(404);
		else
			$this->fileDownload(["file" => $d['filename'], "forceDL" => $forceDL]);
	}

	// extracts a zip-archive
	private function extractFile(array $d) {
		if ($this->config['extract'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (!isset($d['filename']) || !$this->isFilenameValid($d['filename']) || !is_file($d['filename']))
			throw new IFMException($this->l('invalid_filename'));

		if (!isset($d['targetdir']) || trim($d['targetdir']) == "")
			$d['targetdir'] = "./";

		if (!$this->isPathValid($d['targetdir']))
			throw new IFMException($this->l('invalid_dir'));

		if (!is_dir($d['targetdir']) && !mkdir($d['targetdir'], 0755, true))
			throw new IFMException($this->l('folder_create_error'));

		// if the archive is extracted into a directory containing this script,
		// snapshot it so it can be restored if the archive overwrites it
		$tmpSelfContent = null;
		$tmpSelfChecksum = null;
		if (realpath($d['targetdir']) == substr($this->initialWD, 0, strlen(realpath($d['targetdir'])))) {
			$tmpSelfContent = tmpfile();
			fwrite($tmpSelfContent, file_get_contents(__FILE__));
			$tmpSelfChecksum = hash_file("sha256", __FILE__);
		}

		try {
			if (strtolower(pathinfo($d['filename'], PATHINFO_EXTENSION)) == "zip")
				$success = IFMArchive::extractZip($d['filename'], $d['targetdir']);
			elseif (
				(strtolower(pathinfo($d['filename'], PATHINFO_EXTENSION)) == "tar")
				|| (strtolower(pathinfo(pathinfo($d['filename'], PATHINFO_FILENAME), PATHINFO_EXTENSION)) == "tar")
			)
				$success = IFMArchive::extractTar($d['filename'], $d['targetdir']);
			else
				throw new IFMException($this->l('archive_invalid_format'));
		} finally {
			if ($tmpSelfContent !== null) {
				if ($tmpSelfChecksum != hash_file("sha256", __FILE__)) {
					rewind($tmpSelfContent);
					$fh = fopen(__FILE__, "w");
					while (!feof($tmpSelfContent))
						fwrite($fh, fread($tmpSelfContent, 8192));
					fclose($fh);
				}
				fclose($tmpSelfContent);
			}
		}

		if (!$success)
			throw new IFMException($this->l('extract_error'));
		return ["status" => "OK", "message" => $this->l('extract_success')];
	}

	// uploads a file
	private function uploadFile(array $d) {
		if($this->config['upload'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (!isset($_FILES['file']))
			throw new IFMException($this->l('file_upload_error'));

		if (($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK)
			throw new IFMException($this->l('file_upload_error') . " (upload error code " . intval($_FILES['file']['error']) . ")");

		$newfilename = (isset($d["newfilename"]) && $d["newfilename"]!="") ? $d["newfilename"] : $_FILES['file']['name'];
		if (!$this->isFilenameValid($newfilename))
			throw new IFMException($this->l('invalid_filename'));

		if ($_FILES['file']['tmp_name']) {
			if (is_writable(getcwd())) {
				if (move_uploaded_file($_FILES['file']['tmp_name'], $newfilename))
					return ["status" => "OK", "message" => $this->l('file_upload_success'), "cd" => $d['dir']];
				else
					throw new IFMException($this->l('file_upload_error'));
			} else
				throw new IFMException($this->l('file_upload_error'));
		} else
			throw new IFMException($this->l('file_not_found'));
	}

	// change permissions of a file
	private function changePermissions(array $d) {
		if ($this->config['chmod'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (!isset($d["chmod"]) || $d['chmod'] == "" )
			throw new IFMException($this->l('permission_parse_error'));

		if (!$this->isPathValid($this->pathCombine($d['dir'], $d['filename'])))
			throw new IFMException($this->l('nopermissions'));

		$chmod = $d["chmod"]; $cmi = true;
		if (!is_numeric($chmod)) {
			$cmi = false;
			$chmod = str_replace(" ", "", $chmod);

			if (strlen($chmod) == 9) {
				$cmi = true;
				$arr = [substr($chmod, 0, 3), substr($chmod, 3, 3), substr($chmod, 6, 3)];
				$chtmp = "0";
				foreach ($arr as $right) {
					$rtmp = 0;
					if (substr($right, 0, 1) == "r") $rtmp = $rtmp + 4; elseif (substr($right, 0, 1) <> "-") $cmi = false;
					if (substr($right, 1, 1) == "w") $rtmp = $rtmp + 2; elseif (substr($right, 1, 1) <> "-") $cmi = false;
					if (substr($right, 2, 1) == "x") $rtmp = $rtmp + 1; elseif (substr($right, 2, 1) <> "-") $cmi = false;
					$chtmp = $chtmp . $rtmp;
				}
				$chmod = intval($chtmp);
			}
		} elseif (preg_match('/^[0-7]{3,4}$/', (string)$chmod))
			$chmod = "0" . $chmod;
		else
			$cmi = false;

		if ($cmi) {
			if (@chmod($d["filename"], (int)octdec($chmod)))
				return ["status" => "OK", "message" => $this->l('permission_change_success')];
			else
				throw new IFMException($this->l('permission_change_error'));
		} else
			throw new IFMException($this->l('permission_parse_error'));
	}

	// zips a directory and provides it for downloading
	// it creates a temporary zip file in the current directory, so it has to be as much space free as the file size is
	private function zipnload(array $d) {
		if ($this->config['zipnload'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (!file_exists($d['filename']))
			throw new IFMException($this->l('folder_not_found'));

		if (!$this->isPathValid($d['filename']))
			throw new IFMException($this->l('invalid_dir'));

		if ($d['filename'] != "." && !$this->isFilenameValid($d['filename']))
			throw new IFMException($this->l('invalid_filename'));

		if ($this->isAbsolutePath($this->config['tmp_dir']))
			$dfile = $this->pathCombine($this->config['tmp_dir'], uniqid("ifm-tmp-") . ".zip"); // temporary filename
		else
			$dfile = $this->pathCombine($this->initialWD, $this->config['tmp_dir'], uniqid("ifm-tmp-") . ".zip"); // temporary filename

		try {
			IFMArchive::createZip(realpath($d['filename']), $dfile, [$this, 'isFilenameValid']);
			if ($d['filename'] == ".") {
				if (getcwd() == $this->getRootDir())
					$d['filename'] = "root";
				else
					$d['filename'] = basename(getcwd());
			}
			$this->fileDownload(["file" => $dfile, "name" => $d['filename'] . ".zip", "forceDL" => true]);
		} catch (Exception $e) {
			throw new IFMException($this->l('error') . " " . $e->getMessage());
		} finally {
			if (file_exists($dfile))
				@unlink($dfile);
		}
	}

	// uploads a file from an other server using the curl extension
	private function remoteUpload(array $d) {
		if ($this->config['remoteupload'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (!isset($d['method']) || !in_array($d['method'], ["curl", "file"], true))
			throw new IFMException($this->l('invalid_params'));

		if (!isset($d['url']) || !is_string($d['url']) || $d['url'] == "")
			throw new IFMException($this->l('invalid_params'));

		$url = $d['url'];

		// validate the URL and pin the resolved IP to prevent DNS-rebinding TOCTOU
		$pinnedIP = null;
		if ($this->config['remoteupload_disable_ssrf_check'] != 1) {
			$safeIPs = $this->checkUrlSsrf($url);
			if ($safeIPs === false || empty($safeIPs))
				throw new IFMException($this->l('url_not_allowed'));
			$pinnedIP = $safeIPs[0];
		}

		$filename = (isset($d['filename']) && $d['filename'] != "") ? $d['filename'] : "remote_" . uniqid();
		if (!$this->isFilenameValid($filename))
			throw new IFMException($this->l('invalid_filename'));

		if ($d['method'] == "curl") {
			if (!$this->checkCurl())
				throw new IFMException($this->l('error') . " cURL extension not installed.");

			$ch = curl_init();
			if (!$ch)
				throw new IFMException($this->l('error') . " curl init");

			$fp = @fopen($filename, "w");
			if (!$fp) {
				curl_close($ch);
				throw new IFMException($this->l('file_open_error'));
			}

			try {
				$opts = [
					CURLOPT_URL => $url,
					CURLOPT_FILE => $fp,
					CURLOPT_HEADER => 0,
					CURLOPT_FOLLOWLOCATION => (bool)$this->config['remoteupload_enable_follow_location'],
					CURLOPT_MAXREDIRS => 5,
					CURLOPT_CONNECTTIMEOUT => 10,
					CURLOPT_TIMEOUT => 300,
					CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS | CURLPROTO_FTP,
					CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
				];
				if ($pinnedIP !== null) {
					$parts = parse_url($url);
					$scheme = strtolower($parts['scheme'] ?? 'http');
					$port = $parts['port'] ?? ($scheme == 'https' ? 443 : ($scheme == 'ftp' ? 21 : 80));
					$opts[CURLOPT_RESOLVE] = [$parts['host'] . ":" . $port . ":" . $pinnedIP];
				}
				if (!curl_setopt_array($ch, $opts) || !curl_exec($ch))
					throw new IFMException($this->l('error') . " " . curl_error($ch));
				return ["status" => "OK", "message" => $this->l('file_upload_success')];
			} finally {
				curl_close($ch);
				fclose($fp);
			}
		} else { // method "file"
			$contextOptions = [
				'http' => [
					'follow_location' => $this->config['remoteupload_enable_follow_location'] ? 1 : 0,
					'timeout' => 300
				]
			];
			$fetchUrl = $url;
			if ($pinnedIP !== null) {
				// connect to the validated IP while keeping Host header / SNI intact
				$parts = parse_url($url);
				$fetchUrl = $this->buildPinnedUrl($parts, $pinnedIP);
				$contextOptions['http']['header'] = "Host: " . $parts['host'] . "\r\n";
				$contextOptions['ssl'] = ['peer_name' => $parts['host'], 'SNI_enabled' => true];
			}
			$content = @file_get_contents($fetchUrl, false, stream_context_create($contextOptions));
			if ($content === false)
				throw new IFMException($this->l('error') . " " . (error_get_last()['message'] ?? 'download failed'));
			if (@file_put_contents($filename, $content) === false)
				throw new IFMException($this->l('file_save_error'));
			return ["status" => "OK", "message" => $this->l('file_upload_success')];
		}
	}

	// rebuild a URL with its host replaced by a validated IP address
	private function buildPinnedUrl(array $parts, $ip) {
		$ipHost = (strpos($ip, ':') !== false) ? "[" . $ip . "]" : $ip;
		$url = ($parts['scheme'] ?? 'http') . "://";
		if (isset($parts['user']))
			$url .= $parts['user'] . (isset($parts['pass']) ? ":" . $parts['pass'] : "") . "@";
		$url .= $ipHost;
		if (isset($parts['port']))
			$url .= ":" . $parts['port'];
		$url .= $parts['path'] ?? "/";
		if (isset($parts['query']))
			$url .= "?" . $parts['query'];
		return $url;
	}

	private function createArchive($d) {
		if ($this->config['createarchive'] != 1)
			throw new IFMException($this->l('nopermissions'));

		if (!$this->isFilenameValid($d['archivename']))
			throw new IFMException($this->l('invalid_filename'));

		$filenames = [];
		foreach ($d['filenames'] as $file)
			if (!$this->isFilenameValid($file))
				throw new IFMException($this->l('invalid_filename'));
			else
				array_push($filenames, realpath($file));

		switch ($d['format']) {
			case "zip":
				if (IFMArchive::createZip($filenames, $d['archivename']))
					return ["status" => "OK", "message" => $this->l('archive_create_success')];
				else
					throw new IFMException($this->l('archive_create_error'));
				break;
			case "tar":
				$d['archivename'] = pathinfo($d['archivename'], PATHINFO_FILENAME);
				if (IFMArchive::createTar($filenames, $d['archivename'], $d['format']))
					return ["status" => "OK", "message" => $this->l('archive_create_success')];
				else
					throw new IFMException($this->l('archive_create_error'));
				break;
			case "tar.gz":
			case "tar.bz2":
				$d['archivename'] = pathinfo(pathinfo($d['archivename'], PATHINFO_FILENAME), PATHINFO_FILENAME);
				if (IFMArchive::createTar($filenames, $d['archivename'], $d['format']))
					return ["status" => "OK", "message" => $this->l('archive_create_success')];
				else
					throw new IFMException($this->l('archive_create_error'));
				break;
			default:
				throw new IFMException($this->l('archive_invalid_format'));
				break;
		}
	}

	/**
	 * help functions
	 */

	private function getCurrentLang() {
		if ($this->currentLang !== null)
			return $this->currentLang;
		if (isset($_REQUEST['lang']) && isset($this->i18n[$_REQUEST['lang']]))
			$this->currentLang = $_REQUEST['lang'];
		elseif (isset($this->i18n[$this->config['language']]))
			$this->currentLang = $this->config['language'];
		else
			$this->currentLang = 'en';
		return $this->currentLang;
	}

	private function l($str) {
		$lang = $this->getCurrentLang();
		if (isset($this->i18n[$lang][$str]))
			return $this->i18n[$lang][$str];
		return isset($this->i18n['en'][$str]) ? $this->i18n['en'][$str] : $str;
	}

	private function log($d) {
		file_put_contents($this->pathCombine($this->getRootDir(), "debug.ifm.log"), (is_array($d) ? print_r($d, true)."\n" : $d."\n"), FILE_APPEND);
	}

	private function jsonResponse($array) {
		$this->convertToUTF8($array);
		$json = json_encode($array);
		if ($json === false) {
			throw new IFMException($this->l('json_encode_error') . " - " . json_last_error_msg());
		} else {
			header("Content-Type: application/json");
			echo $json;
		}
	}

	private function convertToUTF8(&$item) {
		if (is_array($item)) {
			array_walk($item, [$this, 'convertToUTF8']);
		} else {
			if (function_exists("mb_check_encoding") && !mb_check_encoding($item, "UTF-8")) {
				$item = mb_convert_encoding($item, "UTF-8", mb_detect_encoding($item));
			}
		}
	}

	private function checkAuth() {
		if ($this->config['auth'] == 0)
			return true;

		// refuse to operate with the publicly known default credentials
		if ($this->config['auth_source'] === $this->defaultconfig['auth_source'])
			throw new IFMException("Authentication is enabled, but auth_source still contains the publicly known default credentials. Please configure your own credentials.");

		$credentials_header = $_SERVER['HTTP_X_IFM_AUTH'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? false;
		if ($credentials_header && !$this->config['auth_ignore_basic'] && preg_match('/^Basic (.+)$/', $credentials_header, $m)) {
			$cred = explode(":", base64_decode($m[1]), 2);
			if (count($cred) == 2 && $this->checkCredentials($cred[0], $cred[1])) {
				// stateless header auth is not subject to CSRF (no ambient credentials)
				$this->authViaHeader = true;
				return true;
			}
		}

		if (session_status() !== PHP_SESSION_ACTIVE) {
			session_start();
		}

		if (isset($_SESSION['ifmauth']) && $_SESSION['ifmauth'] === true)
			return true;

		$login_failed = false;
		if (isset($_POST["inputLogin"], $_POST["inputPassword"]) && is_string($_POST["inputLogin"]) && is_string($_POST["inputPassword"])) {
			if ($this->checkCredentials($_POST["inputLogin"], $_POST["inputPassword"])) {
				session_regenerate_id(true); // prevent session fixation
				$_SESSION['ifmauth'] = true;
				return true;
			} else {
				$_SESSION['ifmauth'] = false;
				$login_failed = true;
			}
		}

		if ($login_failed === true)
			throw new IFMException("Authentication failed: Wrong credentials");
		else
			throw new IFMException("Not authenticated");
	}

	private function getCsrfToken() {
		if (session_status() !== PHP_SESSION_ACTIVE)
			session_start();
		if (empty($_SESSION['ifm_csrf_token']))
			$_SESSION['ifm_csrf_token'] = bin2hex(random_bytes(32));
		return $_SESSION['ifm_csrf_token'];
	}

	private function checkCredentials($user, $pass) {
		list($src, $srcopt) = explode(";", $this->config['auth_source'], 2);
		switch ($src) {
			case "inline":
				list($uname, $hash) = explode(":", $srcopt);
				$htpasswd = new Htpasswd();
				return $htpasswd->verifyPassword($pass, $hash) && hash_equals($uname, $user);
			case "file":
				if (@file_exists($srcopt) && @is_readable($srcopt)) {
					$htpasswd = new Htpasswd($srcopt);
					return $htpasswd->verify($user, $pass);
				} else {
					trigger_error("IFM: Fatal: Credential file does not exist or is not readable");
					return false;
				}
				break;
			case "ldap":
				$authenticated = false;
				// Reject empty username/password before binding: most LDAP
				// servers treat a bind with an empty password as an
				// anonymous/unauthenticated bind that SUCCEEDS, which would
				// otherwise bypass authentication entirely.
				if (!is_string($user) || $user === '' || !is_string($pass) || $pass === '')
					return false;
				$ldapopts = explode(";", $srcopt);
				if (count($ldapopts) === 4) {
					list($ldap_server, $basedn, $uuid, $ufilter) = explode(";", $srcopt);
				} else {
					list($ldap_server, $basedn) = explode(";", $srcopt);
					$ufilter = false;
					$uuid = "uid";
				}
				$u = $uuid . "=" . (function_exists('ldap_escape') ? ldap_escape($user, '', LDAP_ESCAPE_DN) : $user) . "," . $basedn;
				if (!$ds = ldap_connect($ldap_server)) {
					throw new IFMException("Could not reach the ldap server.", true);
					//trigger_error("Could not reach the ldap server.", E_USER_ERROR);
					return false;
				}
				ldap_set_option($ds, LDAP_OPT_PROTOCOL_VERSION, 3);
				if ($ds) {
					$ldbind = @ldap_bind($ds, $u, $pass);
					if ($ldbind) {
						if ($ufilter) {
							if (ldap_count_entries($ds, ldap_search($ds, $u, $ufilter)) == 1) {
								$authenticated = true;
							} else {
								throw new IFMException("User not allowed.", true);
								//trigger_error("User not allowed.", E_USER_ERROR);
								$authenticated = false;
							}
						} else
							$authenticated = true;
					} else {
						throw new IFMException(ldap_error($ds), true);
						//trigger_error(ldap_error($ds), E_USER_ERROR);
						$authenticated = false;
					}
					ldap_unbind($ds);
				} else
					$authenticated = false;
				return $authenticated;
				break;
		}
		return false;
	}

	private function filePermsDecode($perms) {
		$oct = str_split(strrev(decoct($perms)), 1);
		$masks = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
		return(
			sprintf(
				'%s %s %s',
				array_key_exists($oct[2], $masks) ? $masks[$oct[2]] : '###',
				array_key_exists($oct[1], $masks) ? $masks[$oct[1]] : '###',
				array_key_exists($oct[0], $masks) ? $masks[$oct[0]] : '###')
		);
	}

	private function isAbsolutePath($path) {
		if ($path === null || $path === '')
			return false;
		return $path[0] === DIRECTORY_SEPARATOR || preg_match('~^[A-Z]:(?![^/\\\\])~i', $path) > 0;
	}

	private function getRootDir() {
		if ($this->rootDirCache !== null)
			return $this->rootDirCache;
		if ($this->config['root_dir'] == "")
			$this->rootDirCache = $this->initialWD;
		elseif ($this->isAbsolutePath($this->config['root_dir']))
			$this->rootDirCache = realpath($this->config['root_dir']);
		else
			$this->rootDirCache = realpath($this->pathCombine($this->initialWD, $this->config['root_dir']));
		return $this->rootDirCache;
	}

	private function getValidDir($dir) {
		if (!$this->isPathValid($dir) || !is_dir($dir))
			return "";
		else {
			$rpDir = realpath($dir);
			$rpConfig = $this->getRootDir();
			if ($rpConfig == "/")
				return $rpDir;
			elseif ($rpDir == $rpConfig)
				return "";
			else {
				$part = substr($rpDir, strlen($rpConfig));
				$part = (in_array(substr($part, 0, 1), ["/", "\\"])) ? substr($part, 1) : $part;
				return $part;
			}
		}
	}


	private function isPathValid($dir) {
		/**
		 * This function is also used to check non-existent paths, but the PHP realpath function returns false for
		 * nonexistent paths. Hence we need to check the path manually in the following lines.
		 */
		$tmp_d = $dir;
		$tmp_missing_parts = [];
		while (realpath($tmp_d) === false) {
			$tmp_i = pathinfo($tmp_d, PATHINFO_FILENAME);
			array_push($tmp_missing_parts, $tmp_i);
			$tmp_d = dirname($tmp_d);
			if ($tmp_d == dirname($tmp_d))
				break;
		}
		$rpDir = $this->pathCombine(realpath($tmp_d), implode("/", array_reverse($tmp_missing_parts)));
		$rpConfig = $this->getRootDir();
		if (!is_string($rpDir) || !is_string($rpConfig)) // can happen if open_basedir is in effect
			return false;
		elseif ($rpDir == $rpConfig)
			return true;
		elseif (0 === strpos($rpDir, rtrim($rpConfig, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR))
			// the trailing separator prevents prefix bypasses like /var/www-evil for root /var/www
			return true;
		else
			return false;
	}

	private function chDirIfNecessary($d) {
		if (empty($d))
			return;
		$target = $this->pathCombine($this->getRootDir(), $this->getValidDir($d));
		if ($target !== "" && getcwd() !== $target)
			chdir($target);
	}

	// returns the MIME type of a file; well-known extensions are resolved from
	// self::MIME_MAP without touching the file, everything else falls back to
	// content sniffing (memoized per extension for the duration of the request)
	private function getMimeType($name, $ext = null) {
		if ($ext === null)
			$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

		if (isset(self::MIME_MAP[$ext]))
			return self::MIME_MAP[$ext];

		// no extension => no meaningful cache key, always sniff
		if ($ext === "") {
			$mime = @mime_content_type($name);
			return ($mime === false) ? "application/octet-stream" : $mime;
		}

		if (!array_key_exists($ext, $this->mimeCache)) {
			$mime = @mime_content_type($name);
			$this->mimeCache[$ext] = ($mime === false) ? "application/octet-stream" : $mime;
		}

		return $this->mimeCache[$ext];
	}

	private function getTypeIcon($type) {
		$type = strtolower($type);
		switch ($type) {
			case "aac": case "aiff": case "flac": case "m4a": case "mid": case "mp3": case "ogg": case "wav":
				return 'icon fa fa-file-audio-o'; break;
			case "ai": case "avif": case "bmp": case "eps": case "gif": case "ico": case "jpeg": case "jpg": case "png": case "psd": case "svg": case "tiff": case "webp":
				return 'icon fa fa-file-image-o'; break;
			case "avi": case "flv": case "m4v": case "mkv": case "mov": case "mp4": case "mpeg": case "mpg": case "ogv": case "webm": case "wmv":
				return 'icon fa fa-file-video-o'; break;
			case "c": case "cpp": case "css": case "dat": case "h": case "html": case "java": case "js": case "json": case "less": case "mjs": case "php": case "py": case "sass": case "scss": case "sh": case "sql": case "ts": case "xml": case "yaml": case "yml":
				return 'icon fa fa-file-code-o'; break;
			case "doc": case "docx": case "odf": case "odt": case "rtf":
				return 'icon fa fa-file-word-o'; break;
			case "conf": case "csv": case "ini": case "log": case "md": case "tsv": case "txt":
				return 'icon fa fa-file-text-o'; break;
			case "ods": case "xls": case "xlsx":
				return 'icon fa fa-file-excel-o'; break;
			case "odp": case "ppt": case "pptx":
				return 'icon fa fa-file-powerpoint-o'; break;
			case "pdf":
				return 'icon fa fa-file-pdf-o'; break;
			case "7z": case "br": case "bz2": case "gz": case "iso": case "rar": case "tar": case "tar.bz2": case "tar.gz": case "tar.xz": case "tgz": case "xz": case "zip":
				return 'icon fa fa-file-archive-o';
			default: return 'icon fa fa-file-o';
		}
	}

	// recursively removes a directory; returns true on success
	private function rec_rmdir($path) {
		if (!is_dir($path) || is_link($path))
			return false;

		$entries = @scandir($path);
		if ($entries === false)
			return false;

		$ok = true;
		foreach (array_diff($entries, ['.', '..']) as $entry) {
			$full = $path . DIRECTORY_SEPARATOR . $entry;
			if (is_dir($full) && !is_link($full))
				$ok = $this->rec_rmdir($full) && $ok;
			else
				$ok = @unlink($full) && $ok;
		}
		return @rmdir($path) && $ok;
	}

	private function xcopy($source, $dest) {
		if (is_file($source)) {
			if (!is_dir($dest) && !mkdir($dest, 0755, true))
				return false;
			return copy($source, $this->pathCombine($dest, basename($source)));
		}
		if (!is_dir($source))
			return false;

		$dest = $this->pathCombine($dest, basename($source));
		if (!is_dir($dest) && !mkdir($dest, 0755, true))
			return false;

		$handle = opendir($source);
		if ($handle === false)
			return false;
		$ok = true;
		while (false !== ($entry = readdir($handle))) {
			if ($entry == '.' || $entry == '..')
				continue;
			$ok = $this->xcopy($this->pathCombine($source, $entry), $dest) && $ok;
		}
		closedir($handle);
		return $ok;
	}

	// combines two parts to a valid path
	private function pathCombine(...$parts) {
		$ret = "";
		foreach ($parts as $part)
			if (trim($part) != "")
				$ret .= (empty($ret) ? rtrim($part, "/") : trim($part, '/'))."/";
		return rtrim($ret, "/");
	}

	// check if filename is allowed
	public function isFilenameValid($f) {
		// reject non-strings and the dot segments; neither contains a path
		// separator, so the checks below would let them through
		if (!is_string($f) || $f === "" || $f === "." || $f === "..")
			return false;

		if (!$this->isFilenameAllowed($f))
			return false;

		if (strtoupper(substr(PHP_OS, 0, 3)) == "WIN") {
			// windows-specific limitations
			foreach (['\\', '/', ':', '*', '?', '"', '<', '>', '|'] as $char)
				if (strpos($f, $char) !== false)
					return false;
		} else {
			// *nix-specific limitations
			foreach (["/", "\0"] as $char)
				if (strpos($f, $char) !== false)
					return false;
		}

		// custom limitations
		foreach ($this->config['forbiddenChars'] as $char)
			if (strpos($f, $char) !== false)
				return false;
		return true;
	}

	private function isFilenameAllowed($f) {
		if ($this->config['showhtdocs'] != 1 && substr($f, 0, 3) == ".ht")
			return false;
		elseif ($this->config['showhiddenfiles'] != 1 && substr($f, 0, 1) == ".")
			return false;
		elseif ($this->config['selfoverwrite'] != 1 && getcwd() == $this->initialWD && $f == basename(__FILE__))
			return false;
		else
			return true;
	}

	// is the cURL extension available?
	private function checkCurl() {
		return function_exists("curl_init");
	}

	private function formatSize($bytes) {
		foreach ([["GB", 1073741824], ["MB", 1048576], ["KB", 1024]] as list($unit, $factor))
			if ($bytes >= $factor)
				return round($bytes / $factor, 2) . " " . $unit;
		return $bytes . " " . ($bytes == 1 ? "Byte" : "Bytes");
	}

	// builds an HTML error list with escaped file names
	private function buildErrorList($message, array $items) {
		$errmsg = $message . "<ul>";
		foreach ($items as $item)
			$errmsg .= "<li>" . htmlspecialchars($item, ENT_QUOTES) . "</li>";
		return $errmsg . "</ul>";
	}

	/**
	 * This function checks the URL for potential SSRF attacks. Allowed is only
	 * http/ftp and only global IP addresses. You can disable the SSRF check in
	 * the configuration.
	 * Returns the array of validated IP addresses on success (so callers can
	 * pin the connection to them), or false if the URL is not allowed.
	 */
	public function checkUrlSsrf($url) {
		if (!filter_var($url, FILTER_VALIDATE_URL))
			return false;

		$parts = parse_url($url);

		if (!$parts)
			return false;

		// no host is not acceptable
		if (!isset($parts['host']))
			return false;

		// other protocols than http(s) or ftp are not allowed (curl assumes http per default)
		if (isset($parts['scheme']) && !in_array(strtolower($parts['scheme']), ['http', 'https', 'ftp']))
			return false;

		// if the host is no IP, resolve the hostname
		$ips = [];
		if (filter_var($parts['host'], FILTER_VALIDATE_IP))
			array_push($ips, $parts['host']);
		else {
			foreach ((@dns_get_record($parts['host'], DNS_A | DNS_AAAA) ?: []) as $record) {
				if (isset($record['ip']))
					$ips[] = $record['ip'];
				elseif (isset($record['ipv6']))
					$ips[] = $record['ipv6'];
			}
		}

		if (empty($ips))
			return false;

		// check if any of the IPs is not global, if so then fail
		foreach ($ips as $ip) {
			if (version_compare(PHP_VERSION, '8.2.0') >= 0) {
				if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE)) {
					return false;
				}
			} else {
				if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
					return false;
				}
			}
		}

		return $ips;
	}

	private function fileDownload(array $options) {
		if (!isset($options['name']) || trim($options['name']) == "")
			$options['name'] = basename($options['file']);

		if (isset($options['forceDL']) && $options['forceDL']) {
			$content_type = "application/octet-stream";
			// sanitize the filename for the header: strip CR/LF, escape quotes, provide RFC 5987 fallback
			$name = str_replace(["\r", "\n"], "", $options['name']);
			$fallback = preg_replace('/[^\x20-\x7e]/', '_', str_replace(['"', '\\'], '_', $name));
			header('Content-Disposition: attachment; filename="' . $fallback . '"; filename*=UTF-8\'\'' . rawurlencode($name));
		} else
			$content_type = $this->getMimeType($options['file']);

		header('Content-Type: '.$content_type);
		header('Expires: 0');
		header('Cache-Control: must-revalidate');
		header('Pragma: public');
		header('Content-Length: '.filesize($options['file']));

		while (ob_get_level() > 0)
			ob_end_clean();
		readfile($options['file']);
	}
}
