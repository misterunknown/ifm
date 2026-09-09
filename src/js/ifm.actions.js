/**
 * The operations themselves: everything that calls the backend API to change
 * something on disk.
 *
 * Part of the IFM object; see ifm.core.js for how the parts are applied.
 */
IFM.parts.push( function( self ) {

	/**
	 * Saves a file
	 */
	this.saveFile = function( filename, content ) {
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "saveFile",
				dir: self.currentDir,
				filename: filename,
				content: content
			}),
			dataType: "json",
			success: function( data ) {
						if( data.status == "OK" ) {
							self.showMessage( self.i18n.file_save_success, "s" );
							self.refreshFileTable();
						} else self.showMessage( data.message, "e" );
					},
			error: function() { self.showMessage( self.i18n.general_error, "e" ); }
		});
		self.fileChanged = false;
	};

	/**
	 * Create a directory
	 */
	this.createDir = function( dirname ) {
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "createDir",
				dir: self.currentDir,
				dirname: dirname
			}),
			dataType: "json",
			success: function( data ){
					if( data.status == "OK" ) {
						self.showMessage( self.i18n.folder_create_success, "s" );
						self.refreshFileTable();
					}
					else {
						self.showMessage( data.message, "e" );
					}
				},
			error: function() { self.showMessage( self.i18n.general_error, "e" ); }
		});
	};

	/**
	 * Deletes files
	 *
	 * @params {array} items - array with objects from the fileCache
	 */
	this.deleteFiles = function( items ) {
		if( ! Array.isArray( items ) )
			items = [items];
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "delete",
				dir: self.currentDir,
				filenames: items.map( function( e ){ return e.name; } )
			}),
			dataType: "json",
			success: function( data ) {
						if( data.status == "OK" ) {
							self.showMessage( self.i18n.file_delete_success, "s" );
							self.refreshFileTable();
						} else self.showMessage( self.i18n.file_delete_error, "e" );
					},
			error: function() { self.showMessage( self.i18n.general_error, "e" ); }
		});
	};

	/**
	 * Renames a file
	 *
	 * @params string name - name of the file
	 */
	this.renameFile = function( filename, newname ) {
		$.ajax({
			url: ifm.api,
			type: "POST",
			data: ({
				api: "rename",
				dir: ifm.currentDir,
				filename: filename,
				newname: newname
			}),
			dataType: "json",
			success: function(data) {
						if(data.status == "OK") {
							ifm.showMessage( self.i18n.file_rename_success, "s");
							ifm.refreshFileTable();
						} else ifm.showMessage( data.message, "e");
					},
			error: function() { ifm.showMessage( self.i18n.general_error, "e"); }
		});
	};

	/**
	 * Copy or moves a file
	 * 
	 * @params {string} sources - array of fileCache items
	 * @params {string} destination - target directory
	 * @params {string} action - action (copy|move)
	 */
	this.copyMove = function( sources, destination, action ) {
		if( ! Array.isArray( sources ) )
			sources = [sources];
		let id = self.generateGuid();
		self.task_add( { id: id, name: self.i18n[action] + " " + ( sources.length > 1 ? sources.length : sources[0].name ) + " " + self.i18n.file_copy_to + " " + destination } );
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				dir: self.currentDir,
				api: "copyMove",
				action: action,
				filenames: sources.map( function( e ) { return e.name } ),
				destination: destination
			},
			dataType: "json",
			success: function( data ) {
				if( data.status == "OK" ) {
					self.showMessage( data.message, "s" );
				} else {
					self.showMessage( data.message, "e" );
				}
				self.refreshFileTable();
			},
			error: function() {
				self.showMessage( self.i18n.general_error, "e" );
			},
			complete: function() {
				self.task_done( id );
			}
		});
	};

	/**
	 * Extracts a file
	 *
	 * @param string filename - name of the file
	 * @param string destination - name of the target directory
	 */
	this.extractFile = function( filename, destination ) {
		let id = self.generateGuid();
		self.task_add( { id: id, name: "extract "+filename } );
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "extract",
				dir: self.currentDir,
				filename: filename,
				targetdir: destination
			},
			dataType: "json",
			success: function( data ) {
						if( data.status == "OK" ) {
							self.showMessage( data.message, "s" );
							self.refreshFileTable();
						} else self.showMessage( data.message, "e" );
					},
			error: function() { self.showMessage( self.i18n.general_error, "e" ); },
			complete: function() { self.task_done( id ); }
		});
	};

	/**
	 * Uploads a file
	 */
	this.uploadFile = function( file, newfilename ) {
		let data = new FormData();
 		data.append( 'api', 'upload' );
 		data.append( 'dir', self.currentDir );
 		data.append( 'file', file );
		if( newfilename )
			data.append( 'newfilename', newfilename );
		let id = self.generateGuid();
		$.ajax({
			url: self.api,
			type: "POST",
			data: data,
			processData: false,
			contentType: false,
			dataType: "json",
			xhr: function(){
				let xhr = $.ajaxSettings.xhr() ;
				xhr.upload.onprogress = function(evt){ self.task_update(evt.loaded/evt.total*100,id); } ;
				xhr.upload.onload = function(){ self.log('Uploading '+file.name+' done.') } ;
				return xhr ;
			},
			success: function(data) {
				if(data.status == "OK") {
					self.showMessage( self.i18n.file_upload_success, "s");
					if(data.cd == self.currentDir) self.refreshFileTable();
				} else self.showMessage( data.message, "e");
			},
			error: function() { self.showMessage( self.i18n.general_error, "e"); },
			complete: function() { self.task_done(id); }
		});
		self.task_add( { id: id, name: "Upload " + file.name } );
	};

	/**
	 * Change the permissions of a file
	 *
	 * @params object e - event object
	 * @params string name - name of the file
	 */
	this.changePermissions = function( filename, newperms ) {
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "changePermissions",
				dir: self.currentDir,
				filename: filename,
				chmod: newperms
			}),
			dataType: "json",
			success: function( data ){
				if( data.status == "OK" ) {
					self.showMessage( self.i18n.permission_change_success, "s" );
					self.refreshFileTable();
				}
				else {
					self.showMessage( data.message, "e");
				}
			},
			error: function() { self.showMessage( self.i18n.general_error, "e"); }
		});
	};

	/**
	 * Remote uploads a file
	 */
	this.remoteUpload = function( url, filename, method ) {
		let id = ifm.generateGuid();
		$.ajax({
			url: ifm.api,
			type: "POST",
			data: ({
				api: "remoteUpload",
				dir: ifm.currentDir,
				filename: filename,
				method: method,
				url: url
			}),
			dataType: "json",
			success: function(data) {
				if(data.status == "OK") {
					self.showMessage( self.i18n.file_upload_success, "s" );
					self.refreshFileTable();
				} else
					self.showMessage( data.message, "e" );
			},
			error: function() { self.showMessage( self.i18n.general_error, "e"); },
			complete: function() { self.task_done(id); }
		});
		self.task_add( { id: id, name: self.i18n.upload_remote+" "+filename } );
	};

	/**
	 * Performs an ajax request
	 */
	this.ajaxRequest = function( url, data, method ) {
		$.ajax({
			url	: url,
			cache	: false,
			data	: data,
			type    : method,
			success	: function( response, textStatus, jqXHR ) {
				document.getElementById( 'ajaxresponse' ).innerText = response;
				let statusEl = document.getElementById( 'ajaxStatusCode' );
				statusEl.textContent = jqXHR.status;
				statusEl.className = 'badge text-bg-success';
				statusEl.hidden = false;
			},
			error	: function( jqXHR ) {
				document.getElementById( 'ajaxresponse' ).innerText = jqXHR.responseText || '';
				let statusEl = document.getElementById( 'ajaxStatusCode' );
				statusEl.textContent = jqXHR.status;
				statusEl.className = 'badge text-bg-danger';
				statusEl.hidden = false;
				self.log( jqXHR );
			}
		});
	};

	this.createArchive = function( items, archivename ) {
		const formats = ['.tar.bz2', '.tar.gz', '.zip', '.tar'];

		const type = formats.find(ext => archivename.toLowerCase().endsWith(ext));
		if (!type) {
			self.showMessage( self.i18n.invalid_archive_format, "e" );
			return;
		}

		let id = self.generateGuid();
		self.task_add( { id: id, name: self.i18n.create_archive+" "+archivename } );

		if( ! Array.isArray( items ) )
			items = [items];

		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "createArchive",
				dir: self.currentDir,
				archivename: archivename,
				filenames: items.map( function( e ) { return e.name; } ),
				format: type.slice(1)
			},
			dataType: "json",
			success: function( data ) {
				self.log( data );
				if( data.status == "OK" ) {
					self.showMessage( data.message, "s" );
					self.refreshFileTable();
				} else
					self.showMessage( data.message, "e" );
			},
			error: function() { self.showMessage( self.i18n.general_error, "e" ); },
			complete: function() { self.task_done( id ); }
		});
	};

});
