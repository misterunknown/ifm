/**
 * IFM constructor
 *
 * @param object params - object with some configuration values, currently you only can set the api url
 */
function IFM( params ) {
	var self = this; // reference to ourself, because "this" does not work within callbacks

	// set the backend for the application
	params = params || {};
	self.api = params.api || window.location.pathname;

	this.editor = null; // global ace editor
	this.fileChanged = false; // flag for check if file was changed already
	this.currentDir = ""; // this is the global variable for the current directory; it is used for AJAX requests
	this.rootElement = "";

	/**
	 * Shows a bootstrap modal
	 *
	 * @param string content - content of the modal
	 * @param object options - options for the modal
	 */
	this.showModal = function( content, options ) {
		options = options || {};
		var modal = $( document.createElement( 'div' ) )
			.addClass( "modal fade" )
			.attr( 'id', 'ifmmodal' )
			.attr( 'role', 'dialog' );
		var modalDialog = $( document.createElement( 'div' ) )
			.addClass( "modal-dialog" )
			.attr( 'role', 'document' );
		if( options.large == true ) modalDialog.addClass( 'modal-lg' );
		var modalContent = $(document.createElement('div'))
			.addClass("modal-content")
			.append( content );
		modalDialog.append( modalContent );
		modal.append( modalDialog );
		$( document.body ).append( modal );
		modal.on('hide.bs.modal', function () { $(this).remove(); });
		modal.on('shown.bs.modal', function () {
			var formElements = $(this).find('input, button');
			if( formElements.length > 0 ) {
				formElements.first().focus();
			}
		});
		modal.modal('show');
	};

	/**
	 * Hides a bootstrap modal
	 */
	this.hideModal = function() {
		$('#ifmmodal').modal('hide');
	};

	/**
	 * Reloads the file table
	 */
	this.refreshFileTable = function () {
		var id = self.generateGuid();
		self.task_add( { id: id, name: "Refresh" } );
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "getFiles",
				dir: self.currentDir
			},
			dataType: "json",
			success: self.rebuildFileTable,
			error: function( response ) { self.showMessage( "General error occured: No or broken response", "e" ); },
			complete: function() { self.task_done( id ); }
		});
	};

	/**
	 * Rebuilds the file table with fetched items
	 *
	 * @param object data - object with items
	 */
	this.rebuildFileTable = function( data ) {
		data.forEach( function( item ) {
			item.guid = self.generateGuid();
			item.linkname = ( item.name == ".." ) ? "[ up ]" : item.name;
			item.download = {};
			item.download.name = ( item.name == ".." ) ? "." : item.name;
			item.download.allowed = self.config.download;
			item.download.currentDir = self.currentDir;
			if( ! self.config.chmod )
				item.readonly = "readonly";
			if( self.config.edit || self.config.rename || self.config.delete || self.config.extract || self.config.copymove ) {
				item.ftbuttons = true;
				item.button = [];
			}
			if( item.type == "dir" ) {
				item.download.action = "zipnload";
				item.download.icon = "icon icon-download-cloud";
				item.rowclasses = "isDir";
			} else {
				item.download.action = "download";
				item.download.icon = "icon icon-download";
				if( item.icon.indexOf( 'file-image' ) !== -1 && self.config.isDocroot )
					item.tooltip = 'data-toggle="tooltip" title="<img src=\'' + self.HTMLEncode( self.pathCombine( self.currentDir, item.name ) ) + '\' class=\'imgpreview\'>"';
				if( self.inArray( item.ext, ["zip","tar","tgz","tar.gz","tar.xz","tar.bz2"] ) ) {
					item.eaction = "extract";
					item.button.push({
						action: "extract",
						icon: "icon icon-archive",
						title: "extract"
					});
				} else if( self.config.edit && item.icon.indexOf( 'file-image' ) == -1) {
					item.eaction = "edit";
					item.button.push({
						action: "edit",
						icon: "icon icon-pencil",
						title: "edit"
					});
				}
			}
			if( ! self.inArray( item.name, [".", ".."] ) ) {
				if( self.config.copymove )
					item.button.push({
						action: "copymove",
						icon: "icon icon-folder-open-empty",
						title: "copy/move"
					});
				if( self.config.rename )
					item.button.push({
						action: "rename",
						icon: "icon icon-terminal",
						title: "rename"
					});
				if( self.config.delete )
					item.button.push({
						action: "delete",
						icon: "icon icon-trash",
						title: "delete"
					});
			}
		});
		var newTBody = Mustache.render( self.templates.filetable, { items: data, config: self.config } );
		$( "#filetable tbody" ).remove();
		$( "#filetable" ).append( $(newTBody) );
		$( '.clickable-row' ).click( function( event ) {
			if( event.ctrlKey ) {
				$( this ).toggleClass( 'selectedItem' );
			}
		});
		$( 'a[data-toggle="tooltip"]' ).tooltip({
			animated: 'fade',
			placement: 'right',
			html: true
		});
		$( 'a.ifmitem' ).each( function() {
			if( $(this).data( "type" ) == "dir" ) {
				$(this).on( 'click', function( e ) {
					e.stopPropagation();
					self.changeDirectory( $(this).parent().parent().data( 'filename' ) );
					return false;
				});
			} else {
				if( self.config.isDocroot )
					$(this).attr( "href", self.pathCombine( self.currentDir, $(this).parent().parent().data( 'filename' ) ) );
				else
					$(this).on( 'click', function() {
						$( '#d_' + this.id ).submit();
						return false;
					});
			}
		});
		$( 'a[name="start_download"]' ).on( 'click', function(e) {
			e.stopPropagation();
			$( '#d_' + $(this).data( 'guid' ) ).submit();
			return false;
		});
		$( 'input[name="newpermissions"]' ).on( 'keypress', function( e ) {
			if( e.key == "Enter" ) {
				e.stopPropagation();
				self.changePermissions( $( this ).data( 'filename' ), $( this ).val() );
				return false;
			}
		});
		$( 'a[name^="do-"]' ).on( 'click', function() {
			var action = this.name.substr( this.name.indexOf( '-' ) + 1 );
			switch( action ) {
				case "rename":
					self.showRenameFileDialog( $(this).data( 'name' ) );
					break;
				case "extract":
					self.showExtractFileDialog( $(this).data( 'name' ) );
					break;
				case "edit":
					self.editFile( $(this).data( 'name' ) );
					break;
				case "delete":
					self.showDeleteFileDialog( $(this).data( 'name' ) );
					break;
				case "copymove":
					self.showCopyMoveDialog( $(this).data( 'name' ) );
					break;
			}
		});

	};

	/**
	 * Changes the current directory
	 *
	 * @param string newdir - target directory
	 * @param object options - options for changing the directory
	 */
	this.changeDirectory = function( newdir, options ) {
		options = options || {};
		config = { absolute: false, pushState: true };
		jQuery.extend( config, options );
		if( ! config.absolute ) newdir = self.pathCombine( self.currentDir, newdir );
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "getRealpath",
				dir: newdir
			}),
			dataType: "json",
			success: function( data ) {
				self.currentDir = data.realpath;
				self.refreshFileTable();
				$( "#currentDir" ).val( self.currentDir );
				if( config.pushState ) history.pushState( { dir: self.currentDir }, self.currentDir, "#"+encodeURIComponent( self.currentDir ) );
			},
			error: function() { self.showMessage( "General error occured: No or broken response", "e" ); }
		});
	};

	/**
	 * Shows a file, either a new file or an existing
	 */
	this.showFileDialog = function () {
		var filename = arguments.length > 0 ? arguments[0] : "newfile.txt";
		var content = arguments.length > 1 ? arguments[1] : "";
		self.showModal( Mustache.render( self.templates.file, { filename: filename } ), { large: true } );
		var form = $('#formFile');
		form.find('input[name="filename"]').on( 'keypress', self.preventEnter );
		form.find('#buttonSave').on( 'click', function() {
			self.saveFile( form.find('input[name=filename]').val(), self.editor.getValue() );
			self.hideModal();
			return false;
		});
		form.find('#buttonSaveNotClose').on( 'click', function() {
			self.saveFile( form.find('input[name=filename]').val(), self.editor.getValue() );
			return false;
		});
		form.find('#buttonClose').on( 'click', function() {
			self.hideModal();
			return false;
		});
		form.find('#editoroptions').popover({
			html: true,
			title: function() { return $('#editoroptions-head').html(); },
			content: function() {
				var content = $('#editoroptions-content').clone()
				var aceSession = self.editor.getSession();
				content.removeClass( 'hide' );
				content.find( '#editor-wordwrap' )
					.prop( 'checked', ( aceSession.getOption( 'wrap' ) == 'off' ? false : true ) )
					.on( 'change', function() { self.editor.setOption( 'wrap', $( this ).is( ':checked' ) ); });
				content.find( '#editor-softtabs' )
					.prop( 'checked', aceSession.getOption( 'useSoftTabs' ) )
					.on( 'change', function() { self.editor.setOption( 'useSoftTabs', $( this ).is( ':checked' ) ); });
				content.find( '#editor-tabsize' )
					.val( aceSession.getOption( 'tabSize' ) )
					.on( 'keydown', function( e ) { if( e.key == 'Enter' ) { self.editor.setOption( 'tabSize', $( this ).val() ); } });
				return content;
			}
		});
		form.on( 'remove', function () { self.editor = null; self.fileChanged = false; });
		// Start ACE
		self.editor = ace.edit("content");
		self.editor.$blockScrolling = 'Infinity';
		self.editor.getSession().setValue(content);
		self.editor.focus();
		self.editor.on("change", function() { self.fileChanged = true; });
		// word wrap checkbox
		$('#aceWordWrap').on( 'change', function (event) {
			self.editor.getSession().setUseWrapMode( $(this).is(':checked') );
		});
	};

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
							self.showMessage( "File successfully edited/created.", "s" );
							self.refreshFileTable();
						} else self.showMessage( "File could not be edited/created:" + data.message, "e" );
					},
			error: function() { self.showMessage( "General error occured", "e" ); }
		});
		self.fileChanged = false;
	};

	/**
	 * Edit a file
	 *
	 * @params string name - name of the file
	 */
	this.editFile = function( name ) {
		$.ajax({
			url: self.api,
			type: "POST",
			dataType: "json",
			data: ({
				api: "getContent",
				dir: self.currentDir,
				filename: name
			}),
			success: function( data ) {
						if( data.status == "OK" && data.data.content != null ) {
							self.showFileDialog( data.data.filename, data.data.content );
						}
						else if( data.status == "OK" && data.data.content == null ) {
							self.showMessage( "The content of this file cannot be fetched.", "e" );
						}
						else self.showMessage( "Error: "+data.message, "e" );
					},
			error: function() { self.showMessage( "This file can not be displayed or edited.", "e" ); }
		});
	};

	/**
	 * Shows the create directory dialog
	 */
	this.showCreateDirDialog = function() {
		self.showModal( self.templates.createdir );
		var form = $( '#formCreateDir' );
		form.find( 'input[name=dirname]' ).on( 'keypress', self.preventEnter );
		form.find( '#buttonSave' ).on( 'click', function() {
			self.createDir( form.find( 'input[name=dirname] ').val() );
			self.hideModal();
			return false;
		});
		form.find( '#buttonCancel' ).on( 'click', function() {
			self.hideModal();
			return false;
		});
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
						self.showMessage( "Directory sucessfully created.", "s" );
						self.refreshFileTable();
					}
					else {
						self.showMessage( "Directory could not be created: "+data.message, "e" );
					}
				},
			error: function() { self.showMessage( "General error occured.", "e" ); }
		});
	};


	/**
	 * Shows the delete file dialog
	 *
	 * @param string name - name of the file
	 */
	this.showDeleteFileDialog = function( filename ) {
		self.showModal( Mustache.render( self.templates.deletefile, { filename: name } ) );
		var form = $( '#formDeleteFile' );
		form.find( '#buttonYes' ).on( 'click', function() {
			self.deleteFile( filename );
			self.hideModal();
			return false;
		});
		form.find( '#buttonNo' ).on( 'click', function() {
			self.hideModal();
			return false;
		});
	};

	/**
	 * Deletes a file
	 *
	 * @params string name - name of the file
	 */
	this.deleteFile = function( filename ) {
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "delete",
				dir: self.currentDir,
				filename: filename
			}),
			dataType: "json",
			success: function(data) {
						if(data.status == "OK") {
							self.showMessage("File successfully deleted", "s");
							self.refreshFileTable();
						} else self.showMessage("File could not be deleted", "e");
					},
			error: function() { self.showMessage("General error occured", "e"); }
		});
	};

	/**
	 * Show the rename file dialog
	 *
	 * @params string name - name of the file
	 */
	this.showRenameFileDialog = function( filename ) {
		self.showModal( Mustache.render( self.templates.renamefile, { filename: filename } ) );
		var form = $( '#formRenameFile' );
		form.find( 'input[name=newname]' ).on( 'keypress', self.preventEnter );
		form.find( '#buttonRename' ).on( 'click', function() {
			self.renameFile( filename, form.find( 'input[name=newname]' ).val() );
			self.hideModal();
			return false;
		});
		form.find( '#buttonCancel' ).on( 'click', function() {
			self.hideModal();
			return false;
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
							ifm.showMessage("File successfully renamed", "s");
							ifm.refreshFileTable();
						} else ifm.showMessage("File could not be renamed: "+data.message, "e");
					},
			error: function() { ifm.showMessage("General error occured", "e"); }
		});
	};

	/**
	 * Show the copy/move dialog
	 *
	 * @params string name - name of the file
	 */
	this.showCopyMoveDialog = function( name ) {
		self.showModal( self.templates.copymove );
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "getFolderTree",
				dir: self.currentDir
			}),
			dataType: "json",
			success: function( data ) {
				$( '#copyMoveTree' ).treeview( { data: data, levels: 0, expandIcon: "icon icon-folder-empty", collapseIcon: "icon icon-folder-open-empty" } );
			},
			error: function() { self.hideModal(); self.showMessage( "Error while fetching the folder tree.", "e" ) }
		});
		$( '#copyButton' ).on( 'click', function() {
			self.copyMove( name, $('#copyMoveTree .node-selected').data('path'), 'copy' );
			self.hideModal();
			return false;
		});
		$( '#moveButton' ).on( 'click', function() {
			self.copyMove( name, $('#copyMoveTree .node-selected').data('path'), 'move' );
			self.hideModal();
			return false;
		});
		$( '#cancelButton' ).on( 'click', function() {
			self.hideModal();
			return false;
		});
	};

	/**
	 * Copy or moves a file
	 * 
	 * @params string name - name of the file
	 */
	this.copyMove = function( source, destination, action ) {
		var id = self.generateGuid();
		self.task_add( { id: id, name: action.charAt(0).toUpperCase() + action.slice(1) + " " + source + " to " + destination } );
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				dir: self.currentDir,
				api: "copyMove",
				action: action,
				filename: source,
				destination: destination
			},
			dataType: "json",
			success: function(data) {
				if( data.status == "OK" ) {
					self.showMessage( data.message, "s" );
				} else {
					self.showMessage( data.message, "e" );
				}
				self.refreshFileTable();
			},
			error: function() {
				self.showMessage( "General error occured.", "e" );
			},
			complete: function() {
				self.task_done( id );
			}
		});
	};

	/**
	 * Shows the extract file dialog
	 *
	 * @param string name - name of the file
	 */
	this.showExtractFileDialog = function( filename ) {
		var targetDirSuggestion = '';
		if( filename.lastIndexOf( '.' ) > 1 )
			targetDirSuggestion = filename.substr( 0, filename.lastIndexOf( '.' ) );
		else targetDirSuggestion = filename;
		self.showModal( Mustache.render( self.templates.extractfile, { filename: filename, destination: targetDirSuggestion } ) );
		var form = $('#formExtractFile');
		form.find('#buttonExtract').on( 'click', function() {
			var t = form.find('input[name=extractTargetLocation]:checked').val();
			if( t == "custom" ) t = form.find('#extractCustomLocation').val();
			self.extractFile( filename, t );
			self.hideModal();
			return false;
		});
		form.find('#buttonCancel').on( 'click', function() {
			self.hideModal();
			return false;
		});
		form.find('#extractCustomLocation').on( 'click', function(e) {
			$(e.target).prev().children().first().prop( 'checked', true );
		});
	};

	/**
	 * Extracts a file
	 *
	 * @param string filename - name of the file
	 * @param string destination - name of the target directory
	 */
	this.extractFile = function( filename, destination ) {
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
							self.showMessage( "File successfully extracted", "s" );
							self.refreshFileTable();
						} else self.showMessage( "File could not be extracted. Error: " + data.message, "e" );
					},
			error: function() { self.showMessage( "General error occured", "e" ); }
		});
	};

	/**
	 * Shows the upload file dialog
	 */
	this.showUploadFileDialog = function() {
		self.showModal( self.templates.uploadfile );
		var form = $('#formUploadFile');
		form.find( 'input[name=newfilename]' ).on( 'keypress', self.preventEnter );
		form.find( 'input[name=files]' ).on( 'change', function( e ) {
			if( e.target.files.length > 1 )
				form.find( 'input[name=newfilename]' ).attr( 'readonly', true );
			else 
				form.find( 'input[name=newfilename]' ).attr( 'readonly', false );
		});
		form.find( '#buttonUpload' ).on( 'click', function( e ) {
			e.preventDefault();
			var files = form.find( 'input[name=files]' )[0].files;
			if( files.length > 1 )
				for( var i = 0; i < files.length; i++ ) {
					self.uploadFile( files[i] );
				}
			else
				self.uploadFile( files[0], form.find( 'input[name=newfilename]' ).val() );
			self.hideModal();
			return false;
		});
		form.find( '#buttonCancel' ).on( 'click', function() {
			self.hideModal();
			return false;
		});
	};

	/**
	 * Uploads a file
	 */
	this.uploadFile = function( file, newfilename ) {
		var data = new FormData();
 		data.append( 'api', 'upload' );
 		data.append( 'dir', self.currentDir );
 		data.append( 'file', file );
		if( newfilename )
			data.append( 'newfilename', newfilename );
		var id = self.generateGuid();
		$.ajax({
			url: self.api,
			type: "POST",
			data: data,
			processData: false,
			contentType: false,
			dataType: "json",
			xhr: function(){
				var xhr = $.ajaxSettings.xhr() ;
				xhr.upload.onprogress = function(evt){ self.task_update(evt.loaded/evt.total*100,id); } ;
				xhr.upload.onload = function(){ console.log('Uploading '+file.name+' done.') } ;
				return xhr ;
			},
			success: function(data) {
				if(data.status == "OK") {
					self.showMessage("File successfully uploaded", "s");
					if(data.cd == self.currentDir) self.refreshFileTable();
				} else self.showMessage("File could not be uploaded: "+data.message, "e");
			},
			error: function() { self.showMessage("General error occured", "e"); },
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
	this.changePermissions = function( filename, newperms) {
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
					self.showMessage( "Permissions successfully changed.", "s" );
					self.refreshFileTable();
				}
				else {
					self.showMessage( "Permissions could not be changed: "+data.message, "e");
				}
			},
			error: function() { self.showMessage("General error occured.", "e"); }
		});
	};

	/**
	 * Show the remote upload dialog
	 */
	this.showRemoteUploadDialog = function() {
		self.showModal( self.templates.remoteupload );
		var form = $('#formRemoteUpload');
		form.find( '#url' )
			.on( 'keypress', self.preventEnter )
			.on( 'change keyup', function() {
				$("#filename").val($(this).val().substr($(this).val().lastIndexOf("/")+1));
			});
		form.find( '#filename' )
			.on( 'keypress', self.preventEnter )
			.on( 'keyup', function() { $("#url").off( 'change keyup' ); });
		form.find( '#buttonUpload' ).on( 'click', function() {
			self.remoteUpload();
			self.hideModal();
			return false;
		});
		form.find( '#buttonCancel' ).on( 'click', function() {
			self.hideModal();
			return false;
		});
	};

	/**
	 * Remote uploads a file
	 */
	this.remoteUpload = function() {
		var filename = $("#formRemoteUpload #filename").val();
		var id = ifm.generateGuid();
		$.ajax({
			url: ifm.api,
			type: "POST",
			data: ({
				api: "remoteUpload",
				dir: ifm.currentDir,
				filename: filename,
				method: $("#formRemoteUpload input[name=method]:checked").val(),
				url: encodeURI($("#url").val())
			}),
			dataType: "json",
			success: function(data) {
						if(data.status == "OK") {
							ifm.showMessage("File successfully uploaded", "s");
							ifm.refreshFileTable();
						} else ifm.showMessage("File could not be uploaded:<br />"+data.message, "e");
					},
			error: function() { ifm.showMessage("General error occured", "e"); },
			complete: function() { ifm.task_done(id); }
		});
		ifm.task_add( { id: id, name: "Remote upload: "+filename } );
	};

	/**
	 * Shows the ajax request dialog
	 */
	this.showAjaxRequestDialog = function() {
		self.showModal( self.templates.ajaxrequest );
		var form = $('#formAjaxRequest');
		form.find( '#ajaxurl' ).on( 'keypress', self.preventEnter );
		form.find( '#buttonRequest' ).on( 'click', function() {
			self.ajaxRequest();
			return false;
		});
		form.find( '#buttonClose' ).on( 'click', function() {
			self.hideModal();
			return false;
		});
	};

	/**
	 * Performs an ajax request
	 */
	this.ajaxRequest = function() {
		$.ajax({
			url		: $("#ajaxurl").val(),
			cache	: false,
			data	: $('#ajaxdata').val().replace(/\n/g,"&"),
			type    : $('#ajaxrequest input[name=arMethod]:checked').val(),
			success	: function(response) { $("#ajaxresponse").text(response); },
			error	: function(e) { self.showMessage("Error: "+e, "e"); console.log(e); }
		});
	};

	/**
	 * Shows the delete dialog for multiple files
	 */
	this.showMultiDeleteDialog = function() {
		self.showModal( Mustache.render( self.templates.multidelete, { count: $('#filetable tr.selectedItem').length } ) );
		var form = $('#formDeleteFiles');
		form.find( '#buttonYes' ).on( 'click', function() {
			self.multiDelete();
			self.hideModal();
			return false;
		});
		form.find( '#buttonNo' ).on( 'click', function() {
			self.hideModal();
			return false;
		});
	};

	/**
	 * Deletes multiple files
	 */
	this.multiDelete = function() {
		var elements = $('#filetable tr.selectedItem');
		var filenames = [];
		for(var i=0;typeof(elements[i])!='undefined';filenames.push(elements[i++].getAttribute('data-filename')));
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "multidelete",
				dir: self.currentDir,
				filenames: filenames
			}),
			dataType: "json",
			success: function(data) {
						if(data.status == "OK") {
							if(data.errflag == 1)
								ifm.showMessage("All files successfully deleted.", "s");
							else if(data.errflag == 0)
								ifm.showMessage("Some files successfully deleted. "+data.message);
							else
								ifm.showMessage("Files could not be deleted. "+data.message, "e");
							ifm.refreshFileTable();
						} else ifm.showMessage("Files could not be deleted:<br />"+data.message, "e");
					},
			error: function() { ifm.showMessage("General error occured", "e"); }
		});
	};

	// --------------------
	// helper functions
	// --------------------

	/**
	 * Shows a notification
	 *
	 * @param string m - message text
	 * @param string t - message type (e: error, s: success)
	 */
	this.showMessage = function(m, t) {
		var msgType = (t == "e")?"danger":(t == "s")?"success":"info";
		var element = ( self.config.inline ) ? self.rootElement : "body";
		$.notify(
				{ message: m },
				{ type: msgType, delay: 5000, mouse_over: 'pause', offset: { x: 15, y: 65 }, element: element }
		);
	};

	/**
	 * Combines two path components
	 *
	 * @param string a - component 1
	 * @param string b - component 2
	 */
	this.pathCombine = function(a, b) {
		if(a == "" && b == "") return "";
		if(b[0] == "/") b = b.substring(1);
		if(a == "") return b;
		if(a[a.length-1] == "/") a = a.substring(0, a.length-1);
		if(b == "") return a;
		return a+"/"+b;
	};

	/**
	 * Prevents a user to submit a form via clicking enter
	 *
	 * @param object e - click event
	 */
	this.preventEnter = function(e) {
		if( e.keyCode == 13 ) return false;
		else return true;
	}

	/**
	 * Checks if an element is part of an array
	 *
	 * @param obj needle - search item
	 * @param array haystack - array to search
	 */
	this.inArray = function(needle, haystack) {
		for(var i = 0; i < haystack.length; i++) { if(haystack[i] == needle) return true; }	return false;
	};

	/**
	 * Adds a task to the taskbar.
	 *
	 * @param object task - description of the task: { id: "guid", name: "Task Name", type: "(info|warning|danger|success)" }
	 */
	this.task_add = function( task ) {
		if( ! task.id ) {
			console.log( "Error: No task id given.");
			return false;
		}
		if( ! document.querySelector( "footer" ) ) {
			$( document.body ).append( Mustache.render( self.templates.footer ) );
			$( 'a[name=showAll]' ).on( 'click', function( e ) {
				var f = $( 'footer' );
				if( f.css( 'maxHeight' ) == '80%' ) {
					f.css( 'maxHeight', '6em' );
					f.css( 'overflow', 'hidden' );
				} else {
					f.css( 'maxHeight', '80%' );
					f.css( 'overflow', 'scroll' );
				}
			});
			$(document.body).css( 'padding-bottom', '6em' );
		}
		task.id = "wq-"+task.id;
		task.type = task.type || "info";
		var wq = $( "#waitqueue" );
		wq.prepend( Mustache.render( self.templates.task, task ) );
		$( 'span[name=taskCount]' ).text( wq.find( '>div' ).length );
	};

	/**
	 * Removes a task from the taskbar
	 *
	 * @param string id - task identifier
	 */
	this.task_done = function( id ) {
		$( '#wq-'+id ).remove();
		if( $( '#waitqueue>div' ).length == 0) {
			$( 'footer' ).remove();
			$( document.body ).css( 'padding-bottom', '0' );
		}
		$( 'span[name=taskCount]' ).text( $('#waitqueue>div').length );
	};

	/**
	 * Updates a task
	 *
	 * @param integer progress - percentage of status
	 * @param string id - task identifier
	 */
	this.task_update = function( progress, id ) {
		$('#wq-'+id+' .progress-bar').css( 'width', progress+'%' ).attr( 'aria-valuenow', progress );
	};

	/**
	 * Highlights an item in the file table
	 *
	 * @param object param - either an element id or a jQuery object
	 */
	this.highlightItem = function( param ) {
		var highlight = function( el ) {
			el.addClass( 'highlightedItem' ).siblings().removeClass( 'highlightedItem' );
			el.find( 'a' ).first().focus();
			if( ! self.isElementInViewport( el ) ) {
				var scrollOffset =  0;
				if( param=="prev" )
					scrollOffset = el.offset().top - ( window.innerHeight || document.documentElement.clientHeight ) + el.height() + 15;
				else
					scrollOffset = el.offset().top - 55;
				$('html, body').animate( { scrollTop: scrollOffset }, 200 );
			}
		};
		if( param.jquery ) {
			highlight( param );
		} else {
			var highlightedItem = $('.highlightedItem');
			if( ! highlightedItem.length ) {
				highlight( $('#filetable tbody tr:first-child') );
			} else  {
				var newItem = ( param=="next" ? highlightedItem.next() : highlightedItem.prev() );

				if( newItem.is( 'tr' ) ) {
					highlight( newItem );
				}
			}
		}
	};

	/**
	 * Checks if an element is within the viewport
	 *
	 * @param object el - element object
	 */
	this.isElementInViewport = function (el) {
		if (typeof jQuery === "function" && el instanceof jQuery) {
			el = el[0];
		}
		var rect = el.getBoundingClientRect();
		return (
				rect.top >= 60 &&
				rect.left >= 0 &&
				rect.bottom <= ( (window.innerHeight || document.documentElement.clientHeight) ) &&
				rect.right <= (window.innerWidth || document.documentElement.clientWidth)
			   );
	}

	/**
	 * Generates a GUID
	 */
	this.generateGuid = function() {
		var result, i, j;
		result = '';
		for(j=0; j<20; j++) {
			i = Math.floor(Math.random()*16).toString(16).toUpperCase();
			result = result + i;
		}
		return result;
	};

	/**
	 * Logs a message if debug mode is on
	 *
	 * @param string m - message text
	 */
	this.log = function( m ) {
		if( self.config.debug ) {
			console.log( "IFM (debug): " + m );
		}
	};

	/**
	 * Encodes a string to use in HTML attributes
	 *
	 * @param string s - decoded string
	 */
	this.HTMLEncode = function( s ) {
		return s.replace(/'/g, '&#39;').replace(/"/g, '&#43;');
	}

	/**
	 * Handles the javascript pop states
	 *
	 * @param object event - event object
	 */
	this.historyPopstateHandler = function(event) {
		var dir = "";
		if( event.state && event.state.dir )
			dir = event.state.dir;
		self.changeDirectory( dir, { pushState: false, absolute: true } );
	};

	/**
	 * Handles keystrokes
	 *
	 * @param object e - event object
	 */
	this.handleKeystrokes = function( e ) {
		// bind 'del' key
		if( $(e.target).closest('input')[0] || $(e.target).closest('textarea')[0] )
			return;

		switch( e.key ) {
			case 'g':
				e.preventDefault();
				$('#currentDir').focus();
				return;
				break;
			case 'r':
				e.preventDefault();
				self.refreshFileTable();
				return;
				break;
			case 'u':
				if( self.config.upload ) {
					e.preventDefault();
					self.showUploadFileDialog();
				}
				return;
				break;
			case 'o':
				if( self.config.remoteupload ) {
					e.preventDefault();
					self.showRemoteUploadDialog();
				}
				return;
				break;
			case 'a':
				if( self.config.ajaxrequest ) {
					e.preventDefault();
					self.showAjaxRequestDialog();
				}
				return;
				break;
			case 'F':
				if( self.config.createfile ) {
					e.preventDefault();
					self.showFileDialog();
				}
				return;
				break;
			case 'D':
				if( self.config.createdir ) {
					e.preventDefault();
					self.showCreateDirDialog();
				}
				return;
				break;
			case 'h':
			case 'ArrowLeft':
			case 'Backspace':
				e.preventDefault();
				self.changeDirectory( '..' );
				return;
				break;
			case 'l':
			case 'ArrowRight':
				e.preventDefault();
				var item = $('.highlightedItem');
				if( item.hasClass('isDir') )
					self.changeDirectory( item.data( 'filename' ) );
				return;
				break;
			case 'j':
			case 'ArrowDown':
				e.preventDefault();
				self.highlightItem('next');
				return;
				break;
			case 'k':
			case 'ArrowUp':
				e.preventDefault();
				self.highlightItem('prev');
				return;
				break;
			case 'Escape':
				if( $(':focus').is( '.clickable-row td:first-child a:first-child' ) && $('.highlightedItem').length ) {
					e.preventDefault();
					$('.highlightedItem').removeClass( 'highlightedItem' );
				}
				return;
				break;
			case ' ': // todo: make it work only when noting other is focused
			case 'Enter':
				if( $(':focus').is( '.clickable-row td:first-child a:first-child' ) ) { 
					var trParent = $(':focus').parent().parent();
					if( e.key == 'Enter' && trParent.hasClass( 'isDir' ) ) {
						e.preventDefault();
						e.stopPropagation();
						self.changeDirectory( trParent.data( 'filename' ) );
					} else if( e.key == ' ' && ! trParent.is( ':first-child' ) ) {
						e.preventDefault();
						e.stopPropagation();
						var item = $('.highlightedItem');
						if( item.is( 'tr' ) )
							item.toggleClass( 'selectedItem' );
					}
				}
				return;
				break;
		}

		/**
		 * Some operations do not work if the highlighted item is the parent
		 * directory. In these cases the keybindings are ignored.
		 */
		if( $('.highlightedItem').data( 'filename' ) == ".." )
			return;

		switch( e.key ) {
			case 'Delete':
				if( self.config.delete ) {
					if( $('#filetable tr.selectedItem').length > 0 ) {
						e.preventDefault();
						self.showMultiDeleteDialog();
					} else {
						var item = $('.highlightedItem');
						if( item.length )
							self.showDeleteFileDialog( item.data( 'filename' ) );
					}
				}
				return;
				break;
			case 'c':
			case 'm':
				if( self.config.copymove ) {
					var item = $('.highlightedItem');
					if( item.length ) {
						e.preventDefault();
						self.showCopyMoveDialog( item.data( 'filename' ) );
					}
				}
				return;
				break;
			case 'e':
				if( self.config.edit ) {
					var item = $('.highlightedItem');
					if( item.length && ! item.hasClass( 'isDir' ) ) {
						e.preventDefault();
						var action = item.data( 'eaction' );
						switch( action ) {
							case 'extract':
								self.showExtractFileDialog( item.data( 'filename' ) );
								break;
							case 'edit':
								self.editFile( item.data( 'filename' ) );
						}
					}
				}
				return;
				break;
		}
	}

	/**
	 * Initializes the application
	 */
	this.initLoadConfig = function() {
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "getConfig"
			},
			dataType: "json",
			success: function(d) {
				self.config = d;
				self.log( "configuration loaded" );
				self.initLoadTemplates();
			},
			error: function() {
				throw new Error( "IFM: could not load configuration" );
			}
		});
	};
	
	this.initLoadTemplates = function() {
		// load the templates from the backend
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "getTemplates"
			},
			dataType: "json",
			success: function(d) {
				self.templates = d;
				self.log( "templates loaded" );
				self.initApplication();
			},
			error: function() {
				throw new Error( "IFM: could not load templates" );
			}
		});
	};
	
	this.initApplication = function() {
		self.rootElement.html(
			Mustache.render(
				self.templates.app,
				{
					showpath: "/",
					config: self.config,
					ftbuttons: function(){
						return ( self.config.edit || self.config.rename || self.config.delete || self.config.zipnload || self.config.extract );
					}
				}
			)
		);
		// bind static buttons
		$("#refresh").click(function(){
			self.refreshFileTable();
		});
		$("#createFile").click(function(){
			self.showFileDialog();
		});
		$("#createDir").click(function(){
			self.showCreateDirDialog();
		});
		$("#upload").click(function(){
			self.showUploadFileDialog();
		});
		$('#currentDir').on( 'keypress', function (event) {
			if( event.keyCode == 13 ) {
				event.preventDefault();
				self.changeDirectory( $(this).val(), { absolute: true } );
			}
		});
		$('#buttonRemoteUpload').on( 'click', function() {
			self.showRemoteUploadDialog();
			return false;
		});
		$('#buttonAjaxRequest').on( 'click', function() {
			self.showAjaxRequestDialog();
			return false;
		});
		$(document).on( 'dragover', function( e ) {
			e.preventDefault();
			e.stopPropagation();
			console.log( e );
			$('#filedropoverlay').css( 'display', 'block' );
		});
		$( '#filedropoverlay' )
			.on( 'drop', function( e ) {
				e.preventDefault();
				e.stopPropagation();
				console.log( e );
				var files = e.originalEvent.dataTransfer.files;
				for( var i = 0; i < files.length; i++ ) {
					self.uploadFile( files[i] );
				}
				$('#filedropoverlay').css( 'display', 'none' );
			})
			.on( 'dragleave', function( e ) {
				e.preventDefault();
				e.stopPropagation();
				$('#filedropoverlay').css( 'display', 'none' );
			});
		// handle keystrokes
		$(document).on( 'keydown', self.handleKeystrokes );
		// handle history manipulation
		window.onpopstate = self.historyPopstateHandler;
		// load initial file table
		if( window.location.hash ) {
			self.changeDirectory( decodeURIComponent( window.location.hash.substring( 1 ) ) );
		} else {
			this.refreshFileTable();
		}
	};

	this.init = function( id ) {
		self.rootElement = $('#'+id);
		this.initLoadConfig();
	};
}
