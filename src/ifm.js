// IFM - js app

function IFM() {
	var self = this; // reference to ourself, because "this" does not work within callbacks

	this.IFM_SCFN = "<?=basename($_SERVER['SCRIPT_NAME'])?>";
	this.config = jQuery.parseJSON('<?php echo json_encode(IFMConfig::getConstants()); ?>');	// serialize the PHP config array, so we can use it in JS too
	this.editor = null; // global ace editor
	this.fileChanged = false; // flag for check if file was changed already
	this.currentDir = ""; // this is the global variable for the current directory; it is used for AJAX requests

	// modal functions
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

	this.hideModal = function() {
		$('#ifmmodal').modal('hide');
	};

	this.refreshFileTable = function () {
		var id=self.generateGuid();
		self.task_add("Refresh", id);
		$.ajax({
			url: self.IFM_SCFN,
			type: "POST",
			data: "api=getFiles&dir=" + self.currentDir,
			dataType: "json",
			success: self.rebuildFileTable,
			error: function(response) { ifm.showMessage("General error occured: No or broken response", "e"); },
			complete: function() { self.task_done( id ); }
		});
	};

	this.rebuildFileTable = function( data ) {
		var newTBody = $(document.createElement('tbody'));
		for( var i=0; i < data.length; i++ ) {
			var newRow = '<tr class="clickable-row ' + ( ( data[i].type=='dir' ) ? "isDir" : "" ) + '" data-filename="' + data[i].name + '"';
			if( self.config.extract == 1 && data[i].name.toLowerCase().substr(-4) == ".zip" )
				newRow += ' data-eaction="extract"';
			else if( self.config.edit == 1 && data[i].name.toLowerCase().substr(-4) != ".zip" )
				newRow += ' data-eaction="edit"';
			newRow += '><td><a tabindex="0"';
			if(data[i].type=="file") {
				newRow += ' href="'+self.pathCombine(ifm.currentDir,data[i].name)+'"';
				if( data[i].icon.indexOf( 'file-image' ) !== -1 )
					newRow += ' data-toggle="tooltip" title="<img src=\''+self.pathCombine(self.currentDir,data[i].name)+'\' class=\'imgpreview\'>"';
			} else {
				newRow += ' onclick="ifm.changeDirectory(\''+data[i].name+'\')"';
			}
			newRow += '><span class="'+data[i].icon+'"></span> ' + ( data[i].name == '..' ? '[ up ]' : data[i].name ) + '</a></td>';
			if( ( data[i].type != "dir" && self.config.download == 1 ) || ( data[i].type == "dir" && self.config.zipnload == 1 ) ) {
				var guid = self.generateGuid();
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
			if( self.inArray( 1, [self.config.edit, self.config.rename, self.config.delete, self.config.extract] ) ) {
				newRow += '<td>';
				if( data[i].name.toLowerCase().substr(-4) == ".zip" && self.config.extract == 1 ) {
					newRow += '<a tabindex="0" onclick="ifm.extractFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-archive" title="extract"></span></a>';
				} else if( self.config.edit == 1 && data[i].type != "dir" ) {
					newRow += '<a tabindex="0" onclick="ifm.editFile(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-pencil" title="edit"></span></a>';
				}
				if( data[i].name != ".." && data[i].name != "." ) {
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
		if( self.config.multiselect == 1 ) {
			$('.clickable-row').click(function(event) {
				if( event.ctrlKey ) {
					$(this).toggleClass( 'selectedItem' );
				}
			});
		}
		$('a[data-toggle="tooltip"]').tooltip({
			animated: 'fade',
			placement: 'right',
			html: true
		});
	};

	this.changeDirectory = function( newdir, options={} ) {
		console.log( "changeDirectory, newdir="+newdir );
		config = { absolute: false, pushState: true };
		jQuery.extend( config, options );
		if( ! config.absolute ) newdir = self.pathCombine( self.currentDir, newdir );
		$.ajax({
			url: self.IFM_SCFN,
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

	this.saveFile = function() {
		$.ajax({
			url: self.IFM_SCFN,
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

	this.editFile = function( name ) {
		$.ajax({
			url: self.IFM_SCFN,
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
	this.deleteFile = function( name ) {
		$.ajax({
			url: self.IFM_SCFN,
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

	this.createDir = function() {
		$.ajax({
			url: self.IFM_SCFN,
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

	this.renameFileDialog = function(name) {
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

	this.renameFile = function(name) {
		$.ajax({
			url: ifm.IFM_SCFN,
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

	this.extractFileDialog = function(name) {
		var fuckWorkarounds="";
		if(fuckWorkarounds.lastIndexOf(".") > 1)
			fuckWorkarounds = name.substr(0,name.length-4);
		else fuckWorkarounds = name;
		self.showModal( '<div class="modal-body">\
			<form id="extractFile">\
			<fieldset>\
				<label>Extract '+name+' to:</label>\
				<button type="button" class="btn btn-default" onclick="ifm.extractFile(\''+ifm.JSEncode(name)+'\', 0);ifm.hideModal();return false;">here</button>\
				<button type="button" class="btn btn-default" onclick="ifm.extractFile(\''+ifm.JSEncode(name)+'\', 1);ifm.hideModal();return false;">'+fuckWorkarounds+'/</button>\
				<button type="button" class="btn btn-default" onclick="ifm.hideModal();return false;">Cancel</button>\
			</fieldset>\
			</form>\
		</div>');
	};

	this.extractFile = function(name, t) {
		var td = (t == 1)? name.substr(0,name.length-4) : "";
		$.ajax({
			url: self.IFM_SCFN,
			type: "POST",
			data: ({
				api: "extractFile",
				dir: self.currentDir,
				filename: name,
				targetdir: td
			}),
			dataType: "json",
			success: function(data) {
						if(data.status == "OK") {
							self.showMessage("File successfully extracted", "s");
							self.refreshFileTable();
						} else self.showMessage("File could not be extracted. Error: "+data.message, "e");
					},
			error: function() { self.showMessage("General error occured", "e"); }
		});
	};

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
			</form>');
	};

	this.uploadFile = function() {
		var ufile = document.getElementById('ufile').files[0];
		var data = new FormData();
		var newfilename = $("#uploadFile input[name^=newfilename]").val();
		data.append('api', 'uploadFile');
		data.append('dir', self.currentDir);
		data.append('file', ufile);
		data.append('newfilename', newfilename);
		var id = self.generateGuid();
		$.ajax({
			url: self.IFM_SCFN,
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

	this.changePermissions = function(e, name) {
		if(e.keyCode == '13')
			$.ajax({
			url: self.IFM_SCFN,
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

	this.remoteUpload = function() {
		var filename = $("#filename").val();
		var id = ifm.generateGuid();
		$.ajax({
			url: ifm.IFM_SCFN,
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

	// --------------------
	// additional functions
	// --------------------
	this.showMessage = function(m, t) {
		var msgType = (t == "e")?"danger":(t == "s")?"success":"info";
		$.notify(
				{ message: m },
				{ type: msgType, delay: 5000, mouse_over: 'pause', offset: { x: 15, y: 65 } }
		);
	};
	this.pathCombine = function(a, b) {
		if(a == "" && b == "") return "";
		if(b[0] == "/") b = b.substring(1);
		if(a == "") return b;
		if(a[a.length-1] == "/") a = a.substring(0, a.length-1);
		if(b == "") return a;
		return a+"/"+b;
	};
	this.preventEnter = function(e) {
		if( e.keyCode == 13 ) return false;
		else return true;
	}
	this.showSaveQuestion = function() {
		var a = '<div id="savequestion"><label>Do you want to save this file?</label><br><button onclick="ifm.saveFile();ifm.closeFileForm(); return false;">Save</button><button onclick="ifm.closeFileForm();return false;">Dismiss</button>';
		$(document.body).prepend(a);
		self.bindOverlayClickEvent();
	};
	this.hideSaveQuestion = function() {
		$("#savequestion").remove();
	};
	this.handleMultiselect = function() {
		var amount = $("#filetable tr.selectedItem").length;
		if(amount > 0) {
			if(document.getElementById("multiseloptions")===null) {
				$(document.body).prepend('<div id="multiseloptions">\
					<div style="font-size:0.8em;background-color:#00A3A3;padding:2px;">\
						<a style="color:#FFF" onclick="$(\'input[name=multisel]\').attr(\'checked\', false);$(\'#multiseloptions\').remove();">[close]</a>\
					</div>\
					<ul><li><a onclick="ifm.multiDelete();"><span class="icon icon-trash"></span> delete (<span class="amount"></span>)</a></li></ul></div>\
				');
				$("#multiseloptions").draggable();
				//$("#multiseloptions").resizable({ghost: true, minHeight: 50, minWidth: 100});
			}
			$("#multiseloptions .amount").text(amount);
		}
		else {
			if(document.getElementById("multiseloptions")!==null)
				$("#multiseloptions").remove();
		}
	};
	this.multiDeleteDialog = function() {
		var form = '<form id="deleteFile"><div class="modal-body"><label>Do you really want to delete these '+$('#filetable tr.selectedItem').length+' files?</label>';
		form += '</div><div class="modal-footer"><button type="button" class="btn btn-danger" onclick="ifm.multiDelete();ifm.hideModal();return false;">Yes</button>';
		form += '<button type="button" class="btn btn-default" onclick="ifm.hideModal();return false;">No</button></div></form>';
		self.showModal( form );
	};
	this.multiDelete = function() {
		var elements = $('#filetable tr.selectedItem');
		var filenames = [];
		for(var i=0;typeof(elements[i])!='undefined';filenames.push(elements[i++].getAttribute('data-filename')));
		$.ajax({
			url: self.IFM_SCFN,
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
	this.inArray = function(needle, haystack) {
		for(var i = 0; i < haystack.length; i++) { if(haystack[i] == needle) return true; }	return false;
	};
	this.task_add = function(name,id) { // uFI stands for uploadFileInformation
		if(!document.getElementById("waitqueue")) {
			$(document.body).prepend('<div id="waitqueue"></div>');
			//$("#waitqueue").on("mouseover", function() { $(this).toggleClass("left"); });
		}
		$("#waitqueue").prepend('<div id="'+id+'" class="panel panel-default"><div class="panel-body"><div class="progress"><div class="progress-bar progress-bar-info progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemax="100" style="width:100%"></div><span class="progbarlabel">'+name+'</span></div></div></div>');
	};
	this.task_done = function(id) {
		$("#"+id).remove();
		if($("#waitqueue>div").length == 0) {
			$("#waitqueue").remove();
		}
	};
	this.task_update = function(progress, id) {
		$('#'+id+' .progress-bar').css('width', progress+'%').attr('aria-valuenow', progress);    
	};
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
	this.isElementInViewport = function isElementInViewport (el) {
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
	this.generateGuid = function() {
		var result, i, j;
		result = '';
		for(j=0; j<20; j++) {
			i = Math.floor(Math.random()*16).toString(16).toUpperCase();
			result = result + i;
		}
		return result;
	};
	this.JSEncode = function(s) {
		return s.replace(/'/g, '\\x27').replace(/"/g, '\\x22');
	};
	this.historyPopstateHandler = function(event) {
		var dir = "";
		if( event.state && event.state.dir ) dir = event.state.dir;
		self.changeDirectory( dir, { pushState: false, absolute: true } );
	};
	this.handleKeystrokes = function( e ) {
		// bind 'del' key
		if( $(e.target).closest('input')[0] || $(e.target).closest('textarea')[0] ) {
			return;
		}

		switch( e.key ) {
			case 'Delete':
				if( $('#filetable tr.selectedItem').length > 0 ) {
					e.preventDefault();
					self.multiDeleteDialog();
				} else {
					var item = $('.highlightedItem');
					if( item.length )
						self.deleteFileDialog( item.data( 'filename' ) );
				}
				break;
			case 'e':
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
				e.preventDefault();
				self.uploadFileDialog();
				break;
			case 'o':
				e.preventDefault();
				self.remoteUploadDialog();
				break;
			case 'a':
				e.preventDefault();
				self.ajaxRequestDialog();
				break;
			case 'F':
				e.preventDefault();
				self.showFileForm();
				break;
			case 'D':
				e.preventDefault();
				self.createDirForm();
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

		console.log( "key: "+e.key );
	}

	// initialization
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

var ifm = new IFM();
ifm.init();
