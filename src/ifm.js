// declare ifm object
if(!ifm) {
	var ifm = {
		IFM_SCFN: "<?=basename($_SERVER['SCRIPT_NAME'])?>", 				// IFM_SCFM = ifm script file name; used for querying via AJAX
		config: jQuery.parseJSON('<?php echo json_encode(IFMConfig::getConstants()); ?>'),	// serialize the PHP config array, so we can use it in JS too
		editor: null, // global ace editor
		fileChanged: false, // was our file edited?
		currentDir: "", // this is the global variable for the current directory; it is used for AJAX requests
		// --------------
		// main functions
		// --------------
		refreshFileTable: function () {
			if(document.getElementById("multiseloptions"))$("#multiseloptions").remove();
			var id=ifm.generateGuid();
			ifm.task_add("Refresh", id);
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: "api=getFiles&dir="+ifm.currentDir,
				dataType: "json",
				success:
					function(data) {
						$("#filetable tbody tr").remove();
						for(i=0;i<data.length;i++) {
							var newrow = "<tr>";
							var multisel = '';
							if(ifm.config.multiselect == 1) {
								multisel = '<input type="checkbox" ';
								multisel += (!ifm.inArray(data[i].name, ["..", "."]))?'id="'+data[i].name+'" name="multisel"':'style="visibility:hidden"';
								multisel += '>';
							}
							if(data[i].type=="file")
								newrow += '<td>'+multisel+'<a href="'+ifm.pathCombine(ifm.currentDir,data[i].name)+'"><span class="'+data[i].icon+'"></span> '+data[i].name+'</a></td>';
							else
								newrow += '<td>'+multisel+'<a onclick="ifm.changeDirectory(\''+data[i].name+'\')"><span class="'+data[i].icon+'"></span> '+data[i].name+'</a></td>'
							if(ifm.config.download == 1) {
								if( data[i].type != "dir" )
									newrow += '<td class="download-link">\
										<form style="display:none;" id="fdownload'+i+'" method="post">\
										<fieldset>\
										<input type="hidden" name="dir" value="'+ifm.currentDir+'">\
										<input type="hidden" name="filename" value="'+data[i].name+'">\
										<input type="hidden" name="api" value="downloadFile">\
										</fieldset>\
										</form>\
										<a onclick="$(\'#fdownload'+i+'\').submit();"><span class="icon icon-download" title="download"></span></a>\
										</td>';
								else
									newrow += '<td></td>'; // empty cell for download link
							}
							if(data[i].lastmodified) newrow += '<td>'+data[i].lastmodified+'</td>';
							if(data[i].filesize) newrow += '<td>'+data[i].filesize+'</td>';
							if(data[i].fileperms) {
								newrow += '<td><input type="text" name="newperms" value="'+data[i].fileperms+'"';
								if(ifm.config.chmod == 1)
									newrow += ' onkeypress="ifm.changePermissions(event, \''+data[i].name+'\');"';
								else
									newrow += " readonly";
								newrow += ( data[i].filepermmode.trim() != "" ) ? ' class="' + data[i].filepermmode + '"' : '';
								newrow += '></td>';
							}
							if(data[i].owner) newrow += '<td>'+data[i].owner+'</td>';
							if(data[i].group) newrow += '<td>'+data[i].group+'</td>';
							if(ifm.inArray(1,[ifm.config.edit, ifm.config.rename, ifm.config.delete, ifm.config.zipnload, ifm.config.extract])) {
								newrow += '<td>';
								if(data[i].type == "dir") {
									if( data[i].name == ".." ) data[i].name = ".";
									if(ifm.config.zipnload == 1) {
										newrow += '<form method="post" style="display:inline-block;padding:0;margin:0;border:0;">\
												  <fieldset style="display:inline-block;padding:0;margin:0;border:0;">\
												  <input type="hidden" name="dir" value="'+ifm.currentDir+'">\
												  <input type="hidden" name="filename" value="'+data[i].name+'">\
												  <input type="hidden" name="api" value="zipnload">';
										newrow += '<a type="submit">\
												  <span class="icon icon-download-cloud" title="zip &amp; download current directory">\
												  </a>\
												  </fieldset>\
												  </form>';
									}
								}
								else if(data[i].name.toLowerCase().substr(-4) == ".zip") {
									if(ifm.config.extract == 1) newrow += '<a href="" onclick="ifm.extractFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-archive" title="extract"></span></a>';
								}
								else {
									if(ifm.config.edit == 1) newrow += '<a onclick="ifm.showLoading();ifm.editFile(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-pencil" title="edit"></span></a>';
								}
								if(data[i].name != ".." && data[i].name != ".") {
									if(ifm.config.rename == 1) newrow += '<a onclick="ifm.renameFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-terminal" title="rename"></span></a>';
									if(ifm.config.delete == 1) newrow += '<a onclick="ifm.deleteFileDialog(\''+ifm.JSEncode(data[i].name)+'\');return false;"><span class="icon icon-trash" title="delete"></span></a>';
								}
								newrow += '</td></tr>';
							}
							$("#filetable tbody").append(newrow);
						}
						// bind multiselect handler
						if(ifm.config.multiselect == 1) {
							$("input[name=multisel]").on("change", function(){ ifm.handleMultiSelect(); });
						}
						// bind Fancybox
						//var piclinks = $('a[href$=".bmp"],a[href$=".gif"],a[href$=".jpg"],a[href$=".jpeg"],a[href$=".png"],a[href$=".BMP"],a[href$=".GIF"],a[href$=".JPG"],a[href$=".JPEG"],a[href$=".PNG"]');
						//piclinks.attr('rel', 'fancybox').fancybox();
						//var xOffset = 10;
						//var yOffset = 30;
						//piclinks.hover(function(e){this.t = this.title;this.title = "";var c = (this.t != "") ? "<br/>" + this.t : "";$("body").append("<p id='mdPicPreview'><img src='"+ this.href +"' alt='Image preview' />"+ c +"</p>");$("#mdPicPreview").css("top",(e.pageY - xOffset) + "px").css("left",(e.pageX + yOffset) + "px").fadeIn("fast");},function(){this.title = this.t;$("#mdPicPreview").remove();});
						//piclinks.mousemove(function(e){$("#mdPicPreview").css("top",(e.pageY - xOffset) + "px").css("left",(e.pageX + yOffset) + "px");});
					},
				error: function(response) { ifm.showMessage("General error occured: No or broken response", "e"); },
				complete: function() { ifm.task_done(id); }
			});
		},
		changeDirectory: function(newdir) {
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: ({
					api: "getRealpath",
					dir: ifm.pathCombine(ifm.currentDir, newdir)
				}),
				dataType: "json",
				success: function(data){
						ifm.currentDir = data.realpath;
						ifm.refreshFileTable();
						$("#currentDir").val(ifm.currentDir);
					},
				error: function() { ifm.showMessage("General error occured: No or broken response", "e"); }
			});
		},
		showFileForm: function () {
			var filename = arguments.length > 0 ? arguments[0] : "newfile.txt";
			var content = arguments.length > 1 ? arguments[1] : "";
			var overlay = '<div class="modal fade" id="overlay" role="dialog" aria-labelledby="fileformLabel"><div class="modal-dialog" role="document"><div class="modal-content">';
			overlay += '<form id="showFile"><div class="modal-header"><h4>' + ((arguments.length > 0)?'edit':'add') + ' file</h4></div>';
			overlay += '<div class="modal-body"><fieldset><label>Filename:</label><input type="text" class="form-control" name="filename" value="'+filename+'" />';
			overlay += '<div id="content" name="content">'+content+'</div></fieldset></div><div class="modal-footer"><button class="btn btn-success" onclick="ifm.saveFile();ifm.closeFileForm();return false;">Save';
			overlay += '</button><button onclick="ifm.saveFile();return false;" class="btn btn-default">Save without closing</button>';
			overlay += '<button class="btn btn-danger" onclick="$(\'#overlay\').modal(\'hide\');return false;">Close</button></div></form></div></div></div>';
			$(document.body).prepend(overlay);
			if(filename=="")$("#showFile input[name=filename]").focus();
			else $("#showFile #content").focus();
			$('#overlay').modal();
			$("#overlay").on('hide.bs.modal', function () {
				$(this).remove();
			});
			$('#overlay').on('remove', function () { ifm.editor = null; ifm.fileChanged = false; });
			// Start ACE
			//ifm.editor = ace.edit("content");
			//ifm.editor.getSession().setValue(content);
			//ifm.editor.focus();
			//ifm.editor.on("change", function() { ifm.fileChanged = true; });
		},
		closeFileForm: function() {
			ifm.fileChanged = false;
			ifm.editor = null;
			ifm.hideSaveQuestion();
			ifm.removeOverlay();
		},
		removeOverlay: function() {
			$('#overlay').remove();
		},
		createDirForm: function() {
			$(document.body).prepend('<div class="overlay">\
				<form id="createDir">\
					<fieldset>\
						<label>Directoy name:</label>\
						<input type="text" name="dirname" value="" />\
						<button onclick="ifm.createDir();$(\'.overlay\').remove();return false;">Save</button><button onclick="$(\'.overlay\').remove();return false;">Cancel</button>\
					</fieldset>\
				</form>\
			</div>');
		},
		ajaxRequestDialog: function() {
			$(document.body).prepend('<div class="overlay">\
				<form id="ajaxrequest">\
				<fieldset>\
					<label>URL</label><br>\
					<input type="text" id="ajaxurl" required><br>\
					<label>Data</label><br>\
					<textarea id="ajaxdata"></textarea><br>\
					<label>Method</label><br>\
					<input type="radio" name="arMethod" value="GET">GET</input><input type="radio" name="arMethod" value="POST" checked="checked">POST</input><br>\
					<button onclick="ifm.ajaxRequest();return false;">Request</button>\
					<button onclick="$(\'.overlay\').remove();return false;">Close</button><br>\
					<label>Response</label><br>\
					<textarea id="ajaxresponse"></textarea>\
				</fieldset>\
				</form>\
			</div>');
		},
		ajaxRequest: function() {
			ifm.showLoading();
			$.ajax({
				url		: $("#ajaxurl").val(),
				cache	: false,
				data	: $('#ajaxdata').val().replace(/\n/g,"&"),
				type    : $('#ajaxrequest input[name=arMethod]:checked').val(),
				success	: function(response) { $("#ajaxresponse").text(response); },
				error	: function(e) { ifm.showMessage("Error: "+e, "e"); console.log(e); },
				complete: function() { ifm.hideLoading(); }
			});
		},
		saveFile: function() {
			var _content = ifm.editor.getValue();
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: ({
					api: "saveFile",
					dir: ifm.currentDir,
					filename: $("#showFile input[name^=filename]").val(),
					content: _content
				}),
				dataType: "json",
				success: function(data) {
							if(data.status == "OK") {
								ifm.showMessage("File successfully edited/created.", "s");
								ifm.refreshFileTable();
							} else ifm.showMessage("File could not be edited/created:"+data.message, "e");
						},
				error: function() { ifm.showMessage("General error occured", "e"); }
			});
			ifm.fileChanged = false;
		},
		editFile: function(name) {
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				dataType: "json",
				data: ({
					api: "getContent",
					dir: ifm.currentDir,
					filename: name
				}),
				success: function(data) {
							if(data.status == "OK" && data.data.content != null) {
								ifm.showFileForm(data.data.filename, data.data.content);
							}
							else if(data.status == "OK" && data.data.content == null) {
								ifm.showMessage("The content of this file cannot be fetched.", "e");
							}
							else ifm.showMessage("Error: "+data.message, "e");
						},
				error: function() { ifm.showMessage("This file can not be displayed or edited.", "e"); },
				complete: function() { ifm.hideLoading(); }
			});
		},
		deleteFileDialog: function(name) {
			$(document.body).prepend('<div class="overlay">\
				<form id="deleteFile">\
				<fieldset>\
					<label>Do you really want to delete the file '+name+'?\
					<button onclick="ifm.deleteFile(\''+ifm.JSEncode(name)+'\');$(\'.overlay\').remove();return false;">Yes</button><button onclick="$(\'.overlay\').remove();return false;">No</button>\
				</fieldset>\
				</form>\
			</div>');
		},
		deleteFile: function(name) {
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: ({
					api: "deleteFile",
					dir: ifm.currentDir,
					filename: name
				}),
				dataType: "json",
				success: function(data) {
							if(data.status == "OK") {
								ifm.showMessage("File successfully deleted", "s");
								ifm.refreshFileTable();
							} else ifm.showMessage("File could not be deleted", "e");
						},
				error: function() { ifm.showMessage("General error occured", "e"); }
			});
		},
		createDir: function() {
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: ({
					api: "createDir",
					dir: ifm.currentDir,
					dirname: $("#createDir input[name^=dirname]").val()
				}),
				dataType: "json",
				success: function(data){
						if(data.status == "OK") {
							ifm.showMessage("Directory sucessfully created.", "s");
							ifm.refreshFileTable();
						}
						else {
							ifm.showMessage("Directory could not be created: "+data.message, "e");
						}
					},
				error: function() { ifm.showMessage("General error occured.", "e"); }
			});
		},
		renameFileDialog: function(name) {
			$(document.body).prepend('<div class="overlay">\
				<form id="renameFile">\
				<fieldset>\
					<label>Rename '+name+' to:</label>\
					<input type="text" name="newname" />\
					<button onclick="ifm.renameFile(\''+ifm.JSEncode(name)+'\');$(\'.overlay\').remove();return false;">Rename</button><button onclick="$(\'.overlay\').remove();return false;">Cancel</button>\
				</fieldset>\
				</form>\
			</div>');
		},
		renameFile: function(name) {
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
		},
		extractFileDialog: function(name) {
			var fuckWorkarounds="";
			if(fuckWorkarounds.lastIndexOf(".") > 1)
				fuckWorkarounds = name.substr(0,name.length-4);
			else fuckWorkarounds = name;
			$(document.body).prepend('<div class="overlay">\
				<form id="extractFile">\
				<fieldset>\
					<label>Extract '+name+' to:</label>\
					<button onclick="ifm.extractFile(\''+ifm.JSEncode(name)+'\', 0);$(\'.overlay\').remove();return false;">here</button>\
					<button onclick="ifm.extractFile(\''+ifm.JSEncode(name)+'\', 1);$(\'.overlay\').remove();return false;">'+fuckWorkarounds+'/</button>\
					<button onclick="$(\'.overlay\').remove();return false;">Cancel</button>\
				</fieldset>\
				</form>\
			</div>');
		},
		extractFile: function(name, t) {
			var td = (t == 1)? name.substr(0,name.length-4) : "";
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: ({
					api: "extractFile",
					dir: ifm.currentDir,
					filename: name,
					targetdir: td
				}),
				dataType: "json",
				success: function(data) {
							if(data.status == "OK") {
								ifm.showMessage("File successfully extracted", "s");
								ifm.refreshFileTable();
							} else ifm.showMessage("File could not be extracted. Error: "+data.message, "e");
						},
				error: function() { ifm.showMessage("General error occured", "e"); }
			});
		},
		uploadFileDialog: function() {
			$(document.body).prepend('<div class="overlay">\
				<form id="uploadFile">\
				<fieldset>\
					<label>Upload file</label><br>\
					<input type="file" name="ufile" id="ufile"><br>\
					<label>new filename</label>\
					<input type="text" name="newfilename"><br>\
					<button onclick="ifm.uploadFile();$(\'.overlay\').remove();return false;">Upload</button>\
					<button onclick="$(\'.overlay\').remove();return false;">Cancel</button>\
				</fieldset>\
				</form>\
			</div>');
		},
		uploadFile: function() {
			var ufile = document.getElementById('ufile').files[0];
			var data = new FormData();
			var newfilename = $("#uploadFile input[name^=newfilename]").val();
			data.append('api', 'uploadFile');
			data.append('dir', ifm.currentDir);
			data.append('file', ufile);
			data.append('newfilename', newfilename);
			var id = ifm.generateGuid();
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: data,
				processData: false,
				contentType: false,
				dataType: "json",
				xhr: function(){
					var xhr = $.ajaxSettings.xhr() ;
					xhr.upload.onprogress = function(evt){ ifm.task_update(evt.loaded/evt.total*100,id); } ;
					xhr.upload.onload = function(){ console.log('Uploading '+newfilename+' done.') } ;
					return xhr ;
				},
				success: function(data) {
							if(data.status == "OK") {
								ifm.showMessage("File successfully uploaded", "s");
								if(data.cd == ifm.currentDir) ifm.refreshFileTable();
							} else ifm.showMessage("File could not be uploaded: "+data.message, "e");
						},
				error: function() { ifm.showMessage("General error occured", "e"); },
				complete: function() { ifm.task_done(id); }
			});
			ifm.task_add("Upload "+ufile.name, id);
		},
		changePermissions: function(e, name) {
			if(e.keyCode == '13')
				$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: ({
					api: "changePermissions",
					dir: ifm.currentDir,
					filename: name,
					chmod: e.target.value
				}),
				dataType: "json",
				success: function(data){
						if(data.status == "OK") {
							ifm.showMessage("Permissions successfully changed.", "s");
							ifm.refreshFileTable();
						}
						else {
							ifm.showMessage("Permissions could not be changed: "+data.message, "e");
						}
					},
				error: function() { ifm.showMessage("General error occured.", "e"); }
			});
		},
		remoteUploadDialog: function() {
			$(document.body).prepend('<div class="overlay">\
				<form id="uploadFile">\
				<fieldset>\
					<label>Remote upload URL</label><br>\
					<input type="text" id="url" name="url" required><br>\
					<label>Filename (required)</label>\
					<input type="text" id="filename" name="filename" required><br>\
					<label>Method</label>\
					<input type="radio" name="method" value="curl" checked="checked">cURL<input type="radio" name="method" value="file">file</input><br>\
					<button onclick="ifm.remoteUpload();$(\'.overlay\').remove();return false;">Upload</button>\
					<button onclick="$(\'.overlay\').remove();return false;">Cancel</button>\
				</fieldset>\
				</form>\
			</div>');
			// guess the wanted filename, because it is required
			// e.g http:/example.com/example.txt  => filename: example.txt
			$("#url").on("change keyup", function(){
				$("#filename").val($(this).val().substr($(this).val().lastIndexOf("/")+1));
			});
			// if the filename input field was edited manually remove the event handler above
			$("#filename").on("keyup", function() { $("#url").off(); });
		},
		remoteUpload: function() {
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
		},
		// --------------------
		// additional functions
		// --------------------
		showMessage: function(m, t) {
			var message = '<div id="mess"><div class="';
			if(t == "e") message += "message_error";
			else if(t == "s") message += "message_successful";
			else message += "message";
			message += '">'+m+'</div></div>';
			$(document.body).prepend(message);
			$("#mess").delay(2000).fadeOut('slow');
			setTimeout(function() { // remove the message from the DOM after 3 seconds
				$('#mess').remove();
			}, 3000);
		},
		showLoading: function() {
			var loading = '<div id="loading">'+ifm.loadingAnim+'</div>';
			if(document.getElementById("loading")==null)$(document.body).prepend(loading);
		},
		hideLoading: function() {
			$("#loading").remove();
		},
		pathCombine: function(a, b) {
			if(a == "" && b == "") return "";
			if(b[0] == "/") b = b.substring(1);
			if(a == "") return b;
			if(a[a.length-1] == "/") a = a.substring(0, a.length-1);
			if(b == "") return a;
			return a+"/"+b;
		},
		showSaveQuestion: function() {
			var a = '<div id="savequestion"><label>Do you want to save this file?</label><br><button onclick="ifm.saveFile();ifm.closeFileForm(); return false;">Save</button><button onclick="ifm.closeFileForm();return false;">Dismiss</button>';
			$(document.body).prepend(a);
			ifm.bindOverlayClickEvent();
		},
		hideSaveQuestion: function() { $("#savequestion").remove(); },
		handleMultiSelect: function() {
			var amount = $("input[name=multisel]:checked").length;
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
		},
		multiDelete: function() {
			var jel = $("input[name=multisel]:checked");
			if(jel.length == 0) {
				ifm.showMessage("No files chosen");
				return;
			}
			var ids = [];
			for(var i = 0; i < jel.length; i++) ids.push(jel[i].id);
			$.ajax({
				url: ifm.IFM_SCFN,
				type: "POST",
				data: ({
					api: "deleteMultipleFiles",
					dir: ifm.currentDir,
					filenames: ids
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
		},
		inArray: function(needle, haystack) {
			for(var i = 0; i < haystack.length; i++) { if(haystack[i] == needle) return true; }	return false;
		},
		task_add: function(name,id) { // uFI stands for uploadFileInformation
			if(!document.getElementById("waitqueue")) {
				$(document.body).prepend('<div id="waitqueue"></div>');
				//$("#waitqueue").on("mouseover", function() { $(this).toggleClass("left"); });
			}
			$("#waitqueue").append('<div id="'+id+'" class="progress"><div class="progress-bar progress-bar-success progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemax="100" style="100%"></div>'+name+'</div>');
		},
		task_done: function(id) {
			$("#"+id).remove();
			if($("#waitqueue>div").length == 0) {
				$("#waitqueue").remove();
			}
		},
		task_update: function(progress, id) {
			$('#'+id+' .progress-bar').css('width', progress+'%').attr('aria-valuenow', progress);    
		},
		generateGuid: function() {
			var result, i, j;
			result = '';
			for(j=0; j<20; j++) {
				i = Math.floor(Math.random()*16).toString(16).toUpperCase();
				result = result + i;
			}
			return result;
		},
		JSEncode: function(s) {
			return s.replace(/'/g, '\\x27').replace(/"/g, '\\x22');
		},
		// static button bindings and filetable initial filling
		init: function() {
			// fill file table
			this.refreshFileTable();
			// bind static buttons
			$("#refresh").click(function(){
				ifm.refreshFileTable();
			});
			$("#createFile").click(function(){
				ifm.showFileForm();
			});
			$("#createDir").click(function(){
				ifm.createDirForm();
			});
			$("#upload").click(function(){
				ifm.uploadFileDialog();
			});
		},
		// ---------------
		// further members
		// ---------------
		loadingAnim: '<div id="loadingAnim"><div class="blockG" id="rotateG_01"></div><div class="blockG" id="rotateG_02"></div><div class="blockG" id="rotateG_03"></div><div class="blockG" id="rotateG_04"></div><div class="blockG" id="rotateG_05"></div><div class="blockG" id="rotateG_06"></div><div class="blockG" id="rotateG_07"></div><div class="blockG" id="rotateG_08"></div></div>'
	}
}
$(document).ready(function() {ifm.init()}); // init ifm
