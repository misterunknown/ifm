/**
 * IFM constructor
 */
function IFM( params ) {
	var self = this; // reference to ourself, because "this" does not work within callbacks

	// set the backend for the application
	if( ! params.api ) {
		throw new Error( "IFM: no backend configured" );
	} else {
		self.api = params.api;
	}



	this.isDocroot = <?php echo realpath( IFMConfig::root_dir ) == dirname( __FILE__ ) ? "true" : "false"; ?>;
	this.editor = null; // global ace editor
	this.fileChanged = false; // flag for check if file was changed already
	this.currentDir = ""; // this is the global variable for the current directory; it is used for AJAX requests
	this.rootElement = undefined;

	/**
	 * Shows a bootstrap modal
	 *
	 * @param string content - content of the modal
	 * @param object options - options for the modal
	 */
	this.showModal = function( content, options = {} ) {
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
		self.task_add( "Refresh", id );
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
		var newTBody = $(document.createElement('tbody'));
		for( var i=0; i < data.length; i++ ) {
			var newRow = '<tr class="clickable-row ' + ( ( data[i].type=='dir' ) ? "isDir" : "" ) + '" data-filename="' + data[i].name + '"';
			if( self.config.extract == 1 && data[i].name.toLowerCase().substr(-4) == ".zip" )
				newRow += ' data-eaction="extract"';
			else if( self.config.edit == 1 && data[i].name.toLowerCase().substr(-4) != ".zip" )
				newRow += ' data-eaction="edit"';
			newRow += '><td><a tabindex="0"';
			var guid = self.generateGuid();
			if(data[i].type=="file") {
				if( self.isDocroot ) {
					newRow += ' href="'+self.pathCombine(ifm.currentDir,data[i].name)+'"';
					if( data[i].icon.indexOf( 'file-image' ) !== -1 )
						newRow += ' data-toggle="tooltip" title="<img src=\''+self.pathCombine(self.currentDir,data[i].name)+'\' class=\'imgpreview\'>"';
				} else {
					newRow += ' onclick="$(\'#d_'+guid+'\').submit();"';
				}
			} else {
				newRow += ' onclick="ifm.changeDirectory(\''+data[i].name+'\')"';
			}
			newRow += '><span class="'+data[i].icon+'"></span> ' + ( data[i].name == '..' ? '[ up ]' : data[i].name ) + '</a></td>';
			if( ( data[i].type != "dir" && self.config.download == 1 ) || ( data[i].type == "dir" && self.config.zipnload == 1 ) ) {
				newRow += '<td><form id="d_' + guid + '">';
				newRow += '<input type="hidden" name="dir" value="' + self.currentDir + '">';
				newRow += '<input type="hidden" name="filename" value="' + ( data[i].name == '..' ? '.' : data[i].name ) + '">';
				newRow += '<input type="hidden" name="api" value="' + ( data[i].type == 'file'?'downloadFile':'zipnload' ) + '">';
				newRow += '</form><a tabindex="0" onclick="$(\'#d_'+guid+'\').submit();"><span class="icon icon-download' + ( data[i].type == 'dir'?'-cloud':'' ) + '" title="download"></span></a></td>';
			} else {
				newRow += '<td></td>';
			}
			// last-modified
			if( self.config.showlastmodified > 0 )
				newRow += '<td>' + data[i].lastmodified + '</td>';
			// size
			if( self.config.showfilesize > 0 )
				newRow += '<td>' + data[i].filesize + '</td>';
			// permissions
			if( self.config.showpermissions > 0 )
				newRow += '<td class="hidden-xs"><input type="text" name="newperms" class="form-control" value="'+data[i].fileperms+'"' +
						(self.config.chmod==1?' onkeypress="ifm.changePermissions(event, \''+data[i].name+'\');"' : 'readonly' ) +
						( data[i].filepermmode.trim() != "" ? ' class="' + data[i].filepermmode + '"' : '' ) +
						'></td>';
			// owner
			if( self.config.showowner > 0 )
			   	newRow += '<td class="hidden-xs hidden-sm">'+data[i].owner+'</td>';
			// group
			if( self.config.showgroup > 0 )
				newRow += '<td class="hidden-xs hidden-sm hidden-md">' + data[i].group + '</td>';
			// actions
			if( self.inArray( 1, [self.config.edit, self.config.rename, self.config.delete, self.config.extract, self.config.copymove] ) ) {
				newRow += '<td>';
				if( data[i].name.toLowerCase().substr(-4) == ".zip" && self.config.extract == 1 ) {
					newRow += '<a tabindex="0" onclick="ifm.showExtractFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-archive" title="extract"></span></a>';
				} else if( self.config.edit == 1 && data[i].type != "dir" ) {
					newRow += '<a tabindex="0" onclick="ifm.editFile(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-pencil" title="edit"></span></a>';
				}
				if( data[i].name != ".." && data[i].name != "." ) {
					if( self.config.copymove == 1 ) {
						newRow += '<a tabindex="0" onclick="ifm.showCopyMoveDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-folder-open-empty" title="copy/move"></span></a>';
					}
					if( self.config.rename == 1 )
						newRow += '<a tabindex="0" onclick="ifm.renameFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-terminal" title="rename"></span></a>';
					if( self.config.delete == 1 )
						newRow += '<a tabindex="0" onclick="ifm.showDeleteFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-trash" title="delete"></span></a>';
				}
				newRow += '</td></tr>';
			} else {
				newRow += '<td></td>';
			}
			newTBody.append( newRow );
		}
		$("#filetable tbody").remove();
		$("#filetable").append( newTBody );
		$('.clickable-row').click(function(event) {
			if( event.ctrlKey ) {
				$(this).toggleClass( 'selectedItem' );
			}
		});
		$('a[data-toggle="tooltip"]').tooltip({
			animated: 'fade',
			placement: 'right',
			html: true
		});
	};

	/**
	 * Changes the current directory
	 *
	 * @param string newdir - target directory
	 * @param object options - options for changing the directory
	 */
	this.changeDirectory = function( newdir, options={} ) {
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
				if( config.pushState ) history.pushState( { dir: self.currentDir }, self.currentDir, "#"+self.currentDir );
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
			self.deleteFile( self.JSEncode( filename ) );
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
				api: "deleteFile",
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
				api: "renameFile",
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
	this.showCopyMoveDialog = function( filename ) {
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
		self.task_add( action.charAt(0).toUpperCase() + action.slice(1) + " " + source + " to " + destination, id );
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
		var targetDirSuggestion = "";
		if( filename.lastIndexOf( "." ) > 1 )
			targetDirSuggestion = filename.substr( 0, name.length - 4 );
		else targetDirSuggestion = filename;
		self.showModal( Mustache.render( self.templates.extractfile, { filename: filename, targetDirSuggestion: targetDirSuggestion } ) );
		var form = $('#formExtractFile');
		form.find('#buttonExtract').on( 'click', function() {
			var t = form.find('input[name=extractTargetLocation]:checked').val();
			if( t == "custom" ) t = form.find('#extractCustomLocation').val();
			self.extractFile( self.JSEncode( filename ), t );
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
				api: "extractFile",
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
		form.find( '#buttonUpload' ).on( 'click', function() {
			self.uploadFile();
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
	this.uploadFile = function() {
		var ufile = document.getElementById( 'ufile' ).files[0];
		var data = new FormData();
		var newfilename = $("#formUploadFile input[name^=newfilename]").val();
		data.append('api', 'uploadFile');
		data.append('dir', self.currentDir);
		data.append('file', ufile);
		data.append('newfilename', newfilename);
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
				xhr.upload.onload = function(){ console.log('Uploading '+newfilename+' done.') } ;
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
		self.task_add("Upload "+ufile.name, id);
	};

	/**
	 * Change the permissions of a file
	 *
	 * @params object e - event object
	 * @params string name - name of the file
	 */
	this.changePermissions = function(e, name) {
		if(e.keyCode == '13')
			$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "changePermissions",
				dir: self.currentDir,
				filename: filename,
				chmod: e.target.value
			}),
			dataType: "json",
			success: function(data){
					if(data.status == "OK") {
						self.showMessage("Permissions successfully changed.", "s");
						self.refreshFileTable();
					}
					else {
						self.showMessage("Permissions could not be changed: "+data.message, "e");
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
		ifm.task_add("Remote upload: "+filename, id);
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
				api: "deleteMultipleFiles",
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
		$.notify(
				{ message: m },
				{ type: msgType, delay: 5000, mouse_over: 'pause', offset: { x: 15, y: 65 } }
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
	 * @param string name - description of the task
	 * @param string id - identifier for the task
	 */
	this.task_add = function( name, id ) {
		if( ! document.getElementById( "waitqueue" ) ) {
			$( document.body ).prepend( '<div id="waitqueue"></div>' );
		}
		$( "#waitqueue" ).prepend('\
			<div id="'+id+'" class="panel panel-default">\
				<div class="panel-body">\
					<div class="progress">\
						<div class="progress-bar progress-bar-info progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemax="100" style="width:100%"></div>\
						<span class="progbarlabel">'+name+'</span>\
					</div>\
				</div>\
			</div>\
		');
	};

	/**
	 * Removes a task from the taskbar
	 *
	 * @param string id - task identifier
	 */
	this.task_done = function(id) {
		$("#"+id).remove();
		if($("#waitqueue>div").length == 0) {
			$("#waitqueue").remove();
		}
	};

	/**
	 * Updates a task
	 *
	 * @param integer progress - percentage of status
	 * @param string id - task identifier
	 */
	this.task_update = function(progress, id) {
		$('#'+id+' .progress-bar').css('width', progress+'%').attr('aria-valuenow', progress);    
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
				$('html, body').animate( { scrollTop: scrollOffset }, 500 );
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
	 * Encodes a string for use within javascript
	 *
	 * @param string s - encoding string
	 */
	this.JSEncode = function(s) {
		return s.replace(/'/g, '\\x27').replace(/"/g, '\\x22');
	};

	/**
	 * Handles the javascript pop states
	 *
	 * @param object event - event object
	 */
	this.historyPopstateHandler = function(event) {
		var dir = "";
		if( event.state && event.state.dir ) dir = event.state.dir;
		self.changeDirectory( dir, { pushState: false, absolute: true } );
	};

	/**
	 * Handles keystrokes
	 *
	 * @param object e - event object
	 */
	this.handleKeystrokes = function( e ) {
		// bind 'del' key
		if( $(e.target).closest('input')[0] || $(e.target).closest('textarea')[0] ) {
			return;
		}

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
				break;
			case 'g':
				e.preventDefault();
				$('#currentDir').focus();
				break;
			case 'r':
				e.preventDefault();
				self.refreshFileTable();
				break;
			case 'u':
				if( self.config.upload ) {
					e.preventDefault();
					self.showUploadFileDialog();
				}
				break;
			case 'o':
				if( self.config.remoteupload ) {
					e.preventDefault();
					self.showRemoteUploadDialog();
				}
				break;
			case 'a':
				if( self.config.ajaxrequest ) {
					e.preventDefault();
					self.showAjaxRequestDialog();
				}
				break;
			case 'F':
				if( self.config.createfile ) {
					e.preventDefault();
					self.showFileDialog();
				}
				break;
			case 'D':
				if( self.config.createdir ) {
					e.preventDefault();
					self.showCreateDirDialog();
				}
				break;
			case 'h':
			case 'ArrowLeft':
				e.preventDefault();
				self.changeDirectory( '..' );
				break;
			case 'l':
			case 'ArrowRight':
				e.preventDefault();
				var item = $('.highlightedItem');
				if( item.hasClass('isDir') )
					self.changeDirectory( item.data( 'filename' ) );
				break;
			case 'j':
			case 'ArrowDown':
				e.preventDefault();
				self.highlightItem('next');
				break;
			case 'k':
			case 'ArrowUp':
				e.preventDefault();
				self.highlightItem('prev');
				break;
			case 'Escape':
				if( $(':focus').is( '.clickable-row td:first-child a:first-child' ) && $('.highlightedItem').length ) {
					e.preventDefault();
					$('.highlightedItem').removeClass( 'highlightedItem' );
				}
				break;
			case ' ': // todo: make it work only when noting other is focused
				if( $(':focus').is( '.clickable-row td:first-child a:first-child' ) ) {
					e.preventDefault();
					var item = $('.highlightedItem');
					if( item.is( 'tr' ) )
						item.toggleClass( 'selectedItem' );
				}
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
		// handle keystrokes
		$(document).on( 'keydown', self.handleKeystrokes );
		// handle history manipulation
		window.onpopstate = self.historyPopstateHandler;
		// load initial file table
		if( window.location.hash ) {
			self.changeDirectory( window.location.hash.substring( 1 ) );
		} else {
			this.refreshFileTable();
		}
	};

	this.init = function( id ) {
		self.rootElement = $('#'+id);
		this.initLoadConfig();
	};
}

var ifm = new IFM({ api: "ifm.php" });
ifm.init( "ifm" );
