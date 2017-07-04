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

	// load the configuration from the backend
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
		},
		error: function() {
			throw new Error( "IFM: could not load configuration" );
		}
	});

	this.isDocroot = <?php echo realpath( IFMConfig::root_dir ) == dirname( __FILE__ ) ? "true" : "false"; ?>;
	this.editor = null; // global ace editor
	this.fileChanged = false; // flag for check if file was changed already
	this.currentDir = ""; // this is the global variable for the current directory; it is used for AJAX requests

	this.template.filetabletow = "

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
					newRow += '<a tabindex="0" onclick="ifm.extractFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-archive" title="extract"></span></a>';
				} else if( self.config.edit == 1 && data[i].type != "dir" ) {
					newRow += '<a tabindex="0" onclick="ifm.editFile(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-pencil" title="edit"></span></a>';
				}
				if( data[i].name != ".." && data[i].name != "." ) {
					if( self.config.copymove == 1 ) {
						newRow += '<a tabindex="0" onclick="ifm.copyMoveDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-folder-open-empty" title="copy/move"></span></a>';
					}
					if( self.config.rename == 1 )
						newRow += '<a tabindex="0" onclick="ifm.renameFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-terminal" title="rename"></span></a>';
					if( self.config.delete == 1 )
						newRow += '<a tabindex="0" onclick="ifm.deleteFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-trash" title="delete"></span></a>';
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
	this.showFileForm = function () {
		var filename = arguments.length > 0 ? arguments[0] : "newfile.txt";
		var content = arguments.length > 1 ? arguments[1] : "";
		var overlay = '<form id="showFile">' +
			'<div class="modal-body"><fieldset><label>Filename:</label><input onkeypress="return ifm.preventEnter(event);" type="text" class="form-control" name="filename" value="'+filename+'" /><br>' +
			'<div id="content" name="content"></div><br>' +
			'<button type="button" class="btn btn-default" id="editoroptions">editor options</button><div class="hide" id="editoroptions-head">options</div><div class="hide" id="editoroptions-content">' +
			'<input type="checkbox" id="editor-wordwrap"> word wrap</input><br>' +
			'<input type="checkbox" id="editor-softtabs"> use soft tabs</input>' +
			'<div class="input-group"><span class="input-group-addon">tabsize</span><input class="form-control" type="text" size="2" id="editor-tabsize"title="tabsize"></div>' +
			'</div></fieldset></div>' +
			'<div class="modal-footer"><button type="button" class="btn btn-default" onclick="ifm.saveFile();ifm.hideModal();return false;">Save' +
			'</button><button type="button" onclick="ifm.saveFile();return false;" class="btn btn-default">Save without closing</button>' +
			'<button type="button" class="btn btn-default" onclick="ifm.hideModal();return false;">Close</button></div></form>';
		self.showModal( overlay, { large: true } );
		$('#editoroptions').popover({
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
		$('#ifmmodal').on( 'remove', function () { self.editor = null; self.fileChanged = false; });
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
	 * Shows the create directory dialog
	 */
	this.createDirForm = function() {
		self.showModal( '<form id="createDir">\
				<div class="modal-body">\
				<fieldset>\
				<label>Directoy name:</label>\
				<input onkeypress="return ifm.preventEnter(event);" class="form-control" type="text" name="dirname" value="" />\
				</fieldset>\
				</div>\
				<div class="modal-footer">\
				<button class="btn btn-default" type="button" onclick="ifm.createDir();ifm.hideModal();return false;">Save</button>\
				<button type="button" class="btn btn-default" onclick="ifm.hideModal();return false;">Cancel</button>\
				</div>\
				</form>' );
	};

	/**
	 * Create a directory
	 */
	this.createDir = function() {
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "createDir",
				dir: self.currentDir,
				dirname: $("#createDir input[name^=dirname]").val()
			}),
			dataType: "json",
			success: function(data){
					if(data.status == "OK") {
						self.showMessage("Directory sucessfully created.", "s");
						self.refreshFileTable();
					}
					else {
						self.showMessage("Directory could not be created: "+data.message, "e");
					}
				},
			error: function() { self.showMessage("General error occured.", "e"); }
		});
	};


	/**
	 * Saves a file
	 */
	this.saveFile = function() {
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "saveFile",
				dir: self.currentDir,
				filename: $("#showFile input[name^=filename]").val(),
				content: ifm.editor.getValue()
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
							self.showFileForm( data.data.filename, data.data.content );
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
	 * Shows the delete file dialog
	 *
	 * @param string name - name of the file
	 */
	this.deleteFileDialog = function( name ) {
		self.showModal( '<form id="deleteFile">\
				<div class="modal-body">\
				<label>Do you really want to delete the file '+name+'?\
				</div><div class="modal-footer">\
				<button type="button" class="btn btn-danger" onclick="ifm.deleteFile(\''+ifm.JSEncode(name)+'\');ifm.hideModal();return false;">Yes</button>\
				<button type="button" class="btn btn-default" onclick="ifm.hideModal();return false;">No</button>\
				</div>\
				</form>' );
	};

	/**
	 * Deletes a file
	 *
	 * @params string name - name of the file
	 */
	this.deleteFile = function( name ) {
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "deleteFile",
				dir: self.currentDir,
				filename: name
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
	this.renameFileDialog = function( name ) {
		self.showModal( '<div class="modal-body">\
			<form id="renameFile">\
			<fieldset>\
				<label>Rename '+name+' to:</label>\
				<input onkeypress="return ifm.preventEnter(event);" class="form-control" type="text" name="newname" /><br>\
				<button class="btn btn-default" onclick="ifm.renameFile(\''+ifm.JSEncode(name)+'\');ifm.hideModal();return false;">Rename</button><button class="btn btn-default" onclick="ifm.hideModal();return false;">Cancel</button>\
			</fieldset>\
			</form>\
		</div>' );
	};

	/**
	 * Renames a file
	 *
	 * @params string name - name of the file
	 */
	this.renameFile = function( name ) {
		$.ajax({
			url: ifm.api,
			type: "POST",
			data: ({
				api: "renameFile",
				dir: ifm.currentDir,
				filename: name,
				newname: $("#renameFile input[name^=newname]").val()
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
	this.copyMoveDialog = function( name ) {
		self.showModal( '<form id="copyMoveFile"><fieldset>\
			<div class="modal-body">\
				<label>Select destination:</label>\
				<div id="copyMoveTree"><span class="icon icon-spin5"></span></div>\
			</div>\
			<div class="modal-footer">\
				<button type="button" class="btn btn-default" id="copyButton">copy</button>\
				<button type="button" class="btn btn-default" id="moveButton">move</button>\
				<button type="button" class="btn btn-default" id="cancelButton">cancel</button>\
			</div>\
		</fieldset></form>');
		$.ajax({
			url: ifm.api,
			type: "POST",
			data: ({
				api: "getFolderTree",
				dir: ifm.currentDir
			}),
			dataType: "json",
			success: function(data) {
				$('#copyMoveTree').treeview({data: data, levels: 0, expandIcon: "icon icon-folder-empty", collapseIcon: "icon icon-folder-open-empty"});
			},
			error: function() { self.hideModal(); self.showMessage( "Error while fetching the folder tree.", "e" ) }
		});
		$('#copyButton').on( 'click', function(e) {
			self.copyMove( name, $('#copyMoveTree .node-selected').data('path'), 'copy' );
			self.hideModal();
			return false;
		});
		$('#moveButton').on( 'click', function(e) {
			self.copyMove( name, $('#copyMoveTree .node-selected').data('path'), 'move' );
			self.hideModal();
			return false;
		});
		$('#cancelButton').on( 'click', function(e) {
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
		var id=self.generateGuid();
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
	this.extractFileDialog = function( name ) {
		var targetDirSuggestion = "";
		if( name.lastIndexOf( "." ) > 1 )
			targetDirSuggestion = name.substr( 0, name.length - 4 );
		else targetDirSuggestion = name;
		self.showModal( '<form id="extractFile"><fieldset>\
			<div class="modal-body">\
				<label>Extract '+name+' to:</label>\
				<div class="input-group"><span class="input-group-addon"><input type="radio" name="extractTargetLocation" value="./" checked="checked"></span><span class="form-control">./</span></div>\
				<div class="input-group"><span class="input-group-addon"><input type="radio" name="extractTargetLocation" value="./'+targetDirSuggestion+'"></span><span class="form-control">./'+targetDirSuggestion+'</span></div>\
				<div class="input-group"><span class="input-group-addon"><input type="radio" name="extractTargetLocation" value="custom"></span><input id="extractCustomLocation" type="text" class="form-control" placeholder="custom location" value=""></div>\
			</div>\
			<div class="modal-footer">\
				<button type="button" class="btn btn-default" id="extractFileButton">extract</button>\
				<button type="button" class="btn btn-default" id="extractCancelButton">cancel</button>\
			</div>\
		</fieldset></form>');
		$('#extractFileButton').on( 'click', function() {
			var t = $('input[name=extractTargetLocation]:checked').val();
			if( t == "custom" ) t = $('#extractCustomLocation').val();
			self.extractFile( self.JSEncode( name ), t );
			self.hideModal();
			return false;
		});
		$('#extractCancelButton').on( 'click', function() {
			self.hideModal();
			return false;
		});
		$('#extractCustomLocation').on( 'click', function(e) {
			$(e.target).prev().children().first().prop( 'checked', true );
		});
	};

	/**
	 * Extracts a file
	 *
	 * @param string name - name of the file
	 * @param string t - name of the target directory
	 */
	this.extractFile = function( name, t ) {
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "extractFile",
				dir: self.currentDir,
				filename: name,
				targetdir: t
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
	this.uploadFileDialog = function() {
		self.showModal( '<form id="uploadFile">\
			<div class="modal-body">\
				<fieldset>\
				<label>Upload file</label><br>\
				<input class="file" type="file" name="ufile" id="ufile"><br>\
				<label>new filename</label>\
				<input onkeypress="return ifm.preventEnter(event);" class="form-control" type="text" name="newfilename"><br>\
				</fieldset>\
			</div><div class="modal-footer">\
				<button class="btn btn-default" onclick="ifm.uploadFile();ifm.hideModal();return false;">Upload</button>\
				<button class="btn btn-default" onclick="ifm.hideModal();return false;">Cancel</button>\
			</div>\
			</form>' );
	};

	/**
	 * Uploads a file
	 */
	this.uploadFile = function() {
		var ufile = document.getElementById( 'ufile' ).files[0];
		var data = new FormData();
		var newfilename = $("#uploadFile input[name^=newfilename]").val();
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
				filename: name,
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
	this.remoteUploadDialog = function() {
		self.showModal( '<form id="uploadFile">\
			<div class="modal-body">\
			<fieldset>\
				<label>Remote upload URL</label><br>\
				<input onkeypress="return ifm.preventEnter(event);" class="form-control" type="text" id="url" name="url" required><br>\
				<label>Filename (required)</label>\
				<input onkeypress="return ifm.preventEnter(event);" class="form-control" type="text" id="filename" name="filename" required><br>\
				<label>Method</label>\
				<input type="radio" name="method" value="curl" checked="checked">cURL<input type="radio" name="method" value="file">file</input><br>\
			</fieldset><div class="modal-footer">\
				<button type="button" class="btn btn-default" onclick="ifm.remoteUpload();ifm.hideModal();return false;">Upload</button>\
				<button type="button" class="btn btn-default" onclick="ifm.hideModal();return false;">Cancel</button>\
			</div>\
			</form>' );
		// guess the wanted filename, because it is required
		// e.g http:/example.com/example.txt  => filename: example.txt
		$("#url").on("change keyup", function(){
			$("#filename").val($(this).val().substr($(this).val().lastIndexOf("/")+1));
		});
		// if the filename input field was edited manually remove the event handler above
		$("#filename").on("keyup", function() { $("#url").off(); });
	};

	/**
	 * Remote uploads a file
	 */
	this.remoteUpload = function() {
		var filename = $("#filename").val();
		var id = ifm.generateGuid();
		$.ajax({
			url: ifm.api,
			type: "POST",
			data: ({
				api: "remoteUpload",
				dir: ifm.currentDir,
				filename: filename,
				method: $("input[name=method]:checked").val(),
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
	this.ajaxRequestDialog = function() {
		self.showModal( '<form id="ajaxrequest">\
				<div class="modal-body">\
				<fieldset>\
				<label>URL</label><br>\
				<input onkeypress="return ifm.preventEnter(event);" class="form-control" type="text" id="ajaxurl" required><br>\
				<label>Data</label><br>\
				<textarea class="form-control" id="ajaxdata"></textarea><br>\
				<label>Method</label><br>\
				<input type="radio" name="arMethod" value="GET">GET</input><input type="radio" name="arMethod" value="POST" checked="checked">POST</input><br>\
				<button type="button" class="btn btn-success" onclick="ifm.ajaxRequest();return false;">Request</button>\
				<button type="button" class="btn btn-default" onclick="ifm.hideModal();return false;">Close</button><br>\
				<label>Response</label><br>\
				<textarea class="form-control" id="ajaxresponse"></textarea>\
				</fieldset>\
				</form>\
				</div>');
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
	 * Shows a popup to prevent that the user closes the file editor accidentally
	 */
	this.showSaveQuestion = function() {
		var a = '<div id="savequestion"><label>Do you want to save this file?</label><br><button onclick="ifm.saveFile();ifm.closeFileForm(); return false;">Save</button><button onclick="ifm.closeFileForm();return false;">Dismiss</button>';
		$(document.body).prepend(a);
		self.bindOverlayClickEvent();
	};

	/**
	 * Hides the save question
	 */
	this.hideSaveQuestion = function() {
		$("#savequestion").remove();
	};

	/**
	 * Shows the delete dialog for multiple files
	 */
	this.multiDeleteDialog = function() {
		var form = '<form id="deleteFile"><div class="modal-body"><label>Do you really want to delete these '+$('#filetable tr.selectedItem').length+' files?</label>';
		form += '</div><div class="modal-footer"><button type="button" class="btn btn-danger" onclick="ifm.multiDelete();ifm.hideModal();return false;">Yes</button>';
		form += '<button type="button" class="btn btn-default" onclick="ifm.hideModal();return false;">No</button></div></form>';
		self.showModal( form );
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
		if( self.debug ) {
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
					if( && $('#filetable tr.selectedItem').length > 0 ) {
						e.preventDefault();
						self.multiDeleteDialog();
					} else {
						var item = $('.highlightedItem');
						if( item.length )
							self.deleteFileDialog( item.data( 'filename' ) );
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
								self.extractFileDialog( item.data( 'filename' ) );
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
					self.uploadFileDialog();
				}
				break;
			case 'o':
				if( self.config.remoteupload ) {
					e.preventDefault();
					self.remoteUploadDialog();
				}
				break;
			case 'a':
				if( self.config.ajaxrequest ) {
					e.preventDefault();
					self.ajaxRequestDialog();
				}
				break;
			case 'F':
				if( self.config.createfile ) {
					e.preventDefault();
					self.showFileForm();
				}
				break;
			case 'D':
				if( self.config.createdir ) {
					e.preventDefault();
					self.createDirForm();
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
	this.init = function() {
		// bind static buttons
		$("#refresh").click(function(){
			self.refreshFileTable();
		});
		$("#createFile").click(function(){
			self.showFileForm();
		});
		$("#createDir").click(function(){
			self.createDirForm();
		});
		$("#upload").click(function(){
			self.uploadFileDialog();
		});
		$('#currentDir').on( 'keypress', function (event) {
			if( event.keyCode == 13 ) {
				event.preventDefault();
				self.changeDirectory( $(this).val(), { absolute: true } );
			}
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
}

var ifm = new IFM({ api: "ifm.php" });
ifm.init();
