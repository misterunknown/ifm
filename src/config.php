<?php

/* =======================================================================
 * Improved File Manager
 * ---------------------
 * License: This project is provided under the terms of the MIT LICENSE
 * http://github.com/misterunknown/ifm/blob/master/LICENSE
 * =======================================================================
 * 
 * config
*/

class IFMConfig {

	// 0 = no/not allowed;; 1 = yes/allowed;; default: no/forbidden;

	// action controls
	const upload = 1;			// allow uploads
	const remoteupload = 1;		// allow remote uploads using cURL
	const delete = 1;			// allow deletions
	const rename = 1;			// allow renamings
	const edit = 1;				// allow editing
	const chmod = 1;			// allow to change rights
	const extract = 1;			// allow extracting zip archives
	const download = 1; 		// allow to download files and skripts (even php scripts!)
	const selfdownload = 1;		// allow to download this skript itself
	const createdir = 1;		// allow to create directorys
	const createfile = 1;		// allow to create files
	const zipnload = 1;			// allow to zip and download directorys

	// view controls
	const multiselect = 1;		// implement multiselect of files and directories
	const showlastmodified = 0;	// show the last modified date?
	const showfilesize = 1;		// show filesize?
	const showowner = 1;		// show file owner?
	const showgroup = 1;		// show file group?
	const showpath = 0; 		// show real path of directory (not only root)?
	const showrights = 2; 		// show permissions 0 -> not; 1 -> octal, 2 -> human readable
	const showhtdocs = 1;		// show .htaccess and .htpasswd
	const showhiddenfiles = 1;	// show files beginning with a dot (e.g. ".bashrc")

	// general config
	const auth = 0;
	const auth_source = 'inline;admin:$2y$10$0Bnm5L4wKFHRxJgNq.oZv.v7yXhkJZQvinJYR2p6X1zPvzyDRUVRC';
	const defaulttimezone = "Europe/Berlin"; // set default timezone

	// development tools
	const ajaxrequest = 1;		// formular to perform an ajax request

	static function getConstants() {
		$oClass = new ReflectionClass(__CLASS__);
		return $oClass->getConstants();
	}
}
