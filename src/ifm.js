/**
 * IFM constructor
 *
 * @param object params - object with some configuration values, currently you only can set the api url
 */
function IFM(params) {
	// reference to ourself, because "this" does not work within callbacks
	var self = this;

	params = params || {};
	// set the backend for the application
	self.api = params.api || window.location.href.replace(/#.*/, "");

	this.editor = null;		// global ace editor
	this.fileChanged = false;	// flag for check if file was changed already
	this.currentDir = "";		// this is the global variable for the current directory; it is used for AJAX requests
	this.rootElement = "";		// global root element, currently not used
	this.fileCache = [];		// holds the current set of files
	this.search = {};		// holds the last search query, as well as the search results

	// This indicates if the modal was closed by a button or not, to prevent the user
	// from accidentially close it while editing a file.
	this.isModalClosedByButton = false;

	this.datatable = null; // Reference for the data table

	/**
	 * Shows a bootstrap modal
	 *
	 * @param {string} content - HTML content of the modal
	 * @param {object} options - options for the modal ({ large: false })
	 */
	this.showModal = function( content, options ) {
		options = options || {};
		var modal = document.createElement( 'div' );
		modal.classList.add( 'modal', 'fade' );
		modal.id = 'ifmmodal';
		modal.attributes.role = 'dialog';
		var modalDialog = document.createElement( 'div' );
		modalDialog.classList.add( 'modal-dialog' );
		modalDialog.attributes.role = 'document';
		if( options.large == true ) modalDialog.classList.add( 'modal-lg' );
		var modalContent = document.createElement('div');
		modalContent.classList.add( 'modal-content' );
		modalContent.innerHTML = content;
		modalDialog.appendChild( modalContent );
		modal.appendChild( modalDialog );
		document.body.appendChild( modal );

		// For this we have to use jquery, because bootstrap modals depend on them. Also the bs.modal
		// events require jquery, as they cannot be handled by addEventListener()
		$(modal)
			.on( 'hide.bs.modal', function( e ) {
				if( document.forms.formFile && self.fileChanged && !self.isModalClosedByButton ) {
					self.log( "Prevented closing modal because the file was changed and no button was clicked." );
					e.preventDefault();
				} else
					$(this).remove();
			})
			.on( 'shown.bs.modal', function( e ) {
				var formElements = $(this).find('input, button');
				if( formElements.length > 0 ) {
					formElements.first().focus();
				}
			})
			.modal('show');
	};

	/**
	 * Hides a the current bootstrap modal
	 */
	this.hideModal = function() {
		// Hide the modal via jquery to get the hide.bs.modal event triggered
		$( '#ifmmodal' ).modal( 'hide' );
		self.isModalClosedByButton = false;
	};

	/**
	 * Refreshes the file table
	 */
	this.refreshFileTable = function () {
		var taskid = self.generateGuid();
		self.task_add( { id: taskid, name: self.i18n.refresh } );
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "getFiles",
				dir: self.currentDir
			},
			dataType: "json",
			success: self.rebuildFileTable,
			error: function() { self.showMessage( self.i18n.general_error, "e" ); },
			complete: function() { self.task_done( taskid ); }
		});
	};

	/**
	 * Rebuilds the file table with fetched items
	 *
	 * @param object data - object with items
	 */
	this.rebuildFileTable = function( data ) {
		if( data.status == "ERROR" ) {
			this.showMessage( data.message, "e" );
			return;
		} else if ( ! Array.isArray( data ) ) {
			this.showMessage( self.i18n.invalid_data, "e" );
			return;
		}
		data.forEach( function( item ) {
			item.guid = self.generateGuid();
			item.linkname = ( item.name == ".." ) ? "[ up ]" : item.name;
			if( item.name == ".." )
				item.fixtop = 100;
			item.download = {};
			item.download.name = ( item.name == ".." ) ? "." : item.name;
			item.lastmodified_hr = self.formatDate( item.lastmodified );
			if( ! self.config.chmod )
				item.readonly = "readonly";
			if( self.config.edit || self.config.rename || self.config.delete || self.config.extract || self.config.copymove ) {
				item.ftbuttons = true;
				item.button = [];
			}
			if( item.type == "dir" ) {
				if( self.config.download && self.config.zipnload ) {
					item.download.action = "zipnload";
					item.download.icon = "icon icon-download-cloud";
				}
				item.rowclasses = "isDir";
			} else {
				if( self.config.download ) {
					item.download.action = "download";
					item.download.icon = "icon icon-download";
				}
				if( item.icon.indexOf( 'file-image' ) !== -1  ) {
					item.popover = 'data-toggle="popover"';
				}
				if( self.config.extract && self.inArray( item.ext, ["zip","tar","tgz","tar.gz","tar.xz","tar.bz2"] ) ) {
					item.eaction = "extract";
					item.button.push({
						action: "extract",
						icon: "icon icon-archive",
						title: "extract"
					});
				} else if(
					self.config.edit &&
					(
						self.config.disable_mime_detection ||
						(
							typeof item.mime_type === "string" && (
								item.mime_type.substr( 0, 4 ) == "text"
								|| item.mime_type == "inode/x-empty"
								|| item.mime_type.indexOf( "xml" ) != -1
								|| item.mime_type.indexOf( "json" ) != -1
							)
						)
					)
				) {
					item.eaction = "edit";
					item.button.push({
						action: "edit",
						icon: "icon icon-pencil",
						title: "edit"
					});
				}
			}
			item.download.link = self.api+"?api="+item.download.action+"&dir="+self.hrefEncode(self.currentDir)+"&filename="+self.hrefEncode(item.download.name);
			if( self.config.isDocroot && !self.config.forceproxy )
				item.link = self.hrefEncode( self.pathCombine( window.location.path, self.currentDir, item.name ) );
			else if (self.config.download && self.config.zipnload) {
				if (self.config.root_public_url) {
					if (self.config.root_public_url.charAt(0) == "/")
						item.link = self.pathCombine(window.location.origin, self.config.root_public_url, self.currentDir, item.name);
					else
						item.link = self.pathCombine(self.config.root_public_url, self.currentDir, item.name);
				} else
					item.link = self.api+"?api="+(item.download.action=="zipnload"?"zipnload":"proxy")+"&dir="+self.hrefEncode(self.currentDir)+"&filename="+self.hrefEncode(item.download.name);
			} else
				item.link = '#';
			if( ! self.inArray( item.name, [".", ".."] ) ) {
				item.dragdrop = 'draggable="true"';
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

		// save items to file cache
		self.fileCache = data;


		// build new tbody and replace the old one with the new
		var newTBody = Mustache.render( self.templates.filetable, { items: data, config: self.config, i18n: self.i18n, api: self.api } );
		var filetable = document.getElementById( 'filetable' );
		filetable.tBodies[0].remove();
		filetable.append( document.createElement( 'tbody' ) );
		filetable.tBodies[0].innerHTML = newTBody;

		if( self.datatable ) self.datatable.destroy();
		self.datatable = $('#filetable').DataTable({
			paging: false,
			info: false,
			autoWidth: false,
			columnDefs: [
				{ "orderable": false, "targets": ["th-download","th-permissions","th-buttons"] }
			],
			orderFixed: [0, 'desc'],
			language: {
				"search": self.i18n.filter
			}
		});


		// add event listeners
		filetable.tBodies[0].addEventListener( 'keypress', function( e ) {
			if( e.target.name == 'newpermissions' && !!self.config.chmod && e.key == 'Enter' )
				self.changePermissions( e.target.dataset.filename, e.target.value );
		});
		filetable.tBodies[0].addEventListener( 'click', function( e ) {
			if( e.target.tagName == "TD" && e.target.parentElement.classList.contains( 'clickable-row' ) && e.target.parentElement.dataset.filename !== ".." && e.ctrlKey )
				e.target.parentElement.classList.toggle( 'selectedItem' );
			else if( e.target.classList.contains( 'ifmitem' ) || e.target.parentElement.classList.contains( 'ifmitem' ) ) {
				ifmitem = ( e.target.classList.contains( 'ifmitem' ) ? e.target : e.target.parentElement );
				if( ifmitem.dataset.type == "dir" ) {
					e.stopPropagation();
					e.preventDefault();
					self.changeDirectory( ifmitem.parentElement.parentElement.dataset.filename );
				}
			} else if( e.target.parentElement.name == 'start_download' ) {
				e.stopPropagation();
				e.preventDefault();
				document.forms["d_"+e.target.parentElement.dataset.guid].submit();
			} else if( e.target.parentElement.name && e.target.parentElement.name.substring(0, 3) == "do-" ) {
				e.stopPropagation();
				e.preventDefault();
				var item = self.fileCache.find( function( x ) { if( x.guid === e.target.parentElement.dataset.id ) return x; } );
				switch( e.target.parentElement.name.substr( 3 ) ) {
					case "rename":
						self.showRenameFileDialog( item.name );
						break;
					case "extract":
						self.showExtractFileDialog( item.name );
						break;
					case "edit":
						self.editFile( item.name );
						break;
					case "delete":
						self.showDeleteDialog( item );
						break;
					case "copymove":
						self.showCopyMoveDialog( item );
						break;
				}
			}
		});
		// has to be jquery, since this is a bootstrap feature
		$( 'a[data-toggle="popover"]' ).popover({
			content: function() {
				var item = self.fileCache.find( x => x.guid == $(this).attr('id') );
				var popover = document.createElement( 'img' );
				if( self.config.isDocroot )
					popover.src = encodeURI( self.pathCombine( self.currentDir, item.name ) ).replace( '#', '%23' ).replace( '?', '%3F' );
				else
					popover.src = self.api + "?api=proxy&dir=" + encodeURIComponent( self.currentDir ) + "&filename=" + encodeURIComponent( item.name );
				popover.classList.add( 'imgpreview' );
				return popover;
			},
			animated: 'fade',
			placement: 'bottom',
			trigger: 'hover',
			html: true
		});

		if( self.config.contextmenu && !!( self.config.edit || self.config.extract || self.config.rename || self.config.copymove || self.config.download || self.config.delete ) ) {
			// create the context menu, this also uses jquery, AFAIK
			var contextMenu = new BootstrapMenu( '.clickable-row', {
				fetchElementData: function( row ) {
					var data = {};
					data.selected =
						Array.prototype.slice.call( document.getElementsByClassName( 'selectedItem' ) )
						.map( function(e){ return self.fileCache.find( x => x.guid == e.children[0].children[0].id ); } );
					data.clicked = self.fileCache.find( x => x.guid == row[0].children[0].children[0].id );
					return data;
				},
				actionsGroups:[
					['edit', 'extract', 'rename', 'copylink'],
					['copymove', 'download', 'createarchive', 'delete']
				],
				actions: {
					edit: {
						name: self.i18n.edit,
						onClick: function( data ) {
							self.editFile( data.clicked.name );
						},
						iconClass: "icon icon-pencil",
						isShown: function( data ) {
							return !!( self.config.edit && data.clicked.eaction == "edit" && !data.selected.length );
						}
					},
					extract: {
						name: self.i18n.extract,
						onClick: function( data ) {
							self.showExtractFileDialog( data.clicked.name );
						},
						iconClass: "icon icon-archive",
						isShown: function( data ) {
							return !!( self.config.extract && data.clicked.eaction == "extract" && !data.selected.length );
						}
					},
					rename: {
						name: self.i18n.rename,
						onClick: function( data ) {
							self.showRenameFileDialog( data.clicked.name );
						},
						iconClass: "icon icon-terminal",
						isShown: function( data ) { return !!( self.config.rename && !data.selected.length && data.clicked.name != ".." ); }
					},
					copylink: {
						name: self.i18n.copylink,
						onClick: function( data ) {
							if( data.clicked.link.toLowerCase().substr(0,4) == "http" )
								self.copyToClipboard( data.clicked.link );
							else {
								var pathname = window.location.pathname.replace( /^\/*/g, '' ).split( '/' );
								pathname.pop();
								var link = self.pathCombine( window.location.origin, data.clicked.link )
								if( pathname.length > 0 )
									link = self.pathCombine( window.location.origin, pathname.join( '/' ), data.clicked.link )
								self.copyToClipboard( link );
							}
						},
						iconClass: "icon icon-link-ext",
						isShown: function( data ) { return !!( !data.selected.length && data.clicked.name != ".." ); }
					},
					copymove: {
						name: function( data ) {
							if( data.selected.length > 0 )
								return self.i18n.copy+'/'+self.i18n.move+' <span class="badge">'+data.selected.length+'</span>';
							else
								return self.i18n.copy+'/'+self.i18n.move;
						},
						onClick: function( data ) {
							if( data.selected.length > 0 )
								self.showCopyMoveDialog( data.selected );
							else
								self.showCopyMoveDialog( data.clicked );
						},
						iconClass: "icon icon-folder-empty",
						isShown: function( data ) { return !!( self.config.copymove && data.clicked.name != ".." ); }
					},
					download: {
						name: function( data ) {
							if( data.selected.length > 0 )
								return self.i18n.download+' <span class="badge">'+data.selected.length+'</span>';
							else
								return self.i18n.download;
						},
						onClick: function( data ) {
							if( data.selected.length > 0 )
								self.showMessage( "At the moment it is not possible to download a set of files." );
							else
								document.forms["d_"+data.clicked.guid].submit();
						},
						iconClass: "icon icon-download",
						isShown: function() { return !!self.config.download; }
					},
					createarchive: {
						name: function( data ) {
							if( data.selected.length > 0 )
								return self.i18n.create_archive+' <span class="badge">'+data.selected.length+'</span>';
							else
								return self.i18n.create_archive;
						},
						onClick: function( data ) {
							if( data.selected.length > 0 )
								self.showCreateArchiveDialog( data.selected );
							else
								self.showCreateArchiveDialog( data.clicked );
						},
						iconClass: "icon icon-archive",
						isShown: function( data ) { return !!( self.config.createarchive && data.clicked.name != ".." ); }
					},
					'delete': {
						name: function( data ) {
							if( data.selected.length > 0 )
								return self.i18n.delete+' <span class="badge">'+data.selected.length+'</span>';
							else
								return self.i18n.delete;
						},
						onClick: function( data ) {
							if( data.selected.length > 0 )
								self.showDeleteDialog( data.selected );
							else
								self.showDeleteDialog( data.clicked );
						},
						iconClass: "icon icon-trash",
						isShown: function( data ) { return !!( self.config.delete && data.clicked.name != ".." ); }
					}
				}
			});
		}
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
			error: function() { self.showMessage( self.i18n.general_error, "e" ); }
		});
	};

	/**
	 * Shows a file, either a new file or an existing
	 */
	this.showFileDialog = function () {
		var filename = arguments.length > 0 ? arguments[0] : "newfile.txt";
		var content = arguments.length > 1 ? arguments[1] : "";
		self.showModal( Mustache.render( self.templates.file, { filename: filename, i18n: self.i18n } ), { large: true } );

		var form = document.getElementById( 'formFile' );
		form.addEventListener( 'keypress', function( e ) {
			if( e.target.name == 'filename' && e.key == 'Enter' )
				e.preventDefault();
		});
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == "buttonSave" ) {
				e.preventDefault();
				self.saveFile( document.querySelector( '#formFile input[name=filename]' ).value, self.editor.getValue() );
				self.isModalClosedByButton = true;
				self.hideModal();
			} else if( e.target.id == "buttonSaveNotClose" ) {
				e.preventDefault();
				self.saveFile( document.querySelector( '#formFile input[name=filename]' ).value, self.editor.getValue() );
			} else if( e.target.id == "buttonClose" ) {
				e.preventDefault();
				self.isModalClosedByButton = true;
				self.hideModal();
			}
		});

		$('#editoroptions').popover({
			html: true,
			title: self.i18n.options,
			content: function() {
				// see https://github.com/twbs/bootstrap/issues/12571
				// var ihatethisfuckingpopoverworkaround = $('#editoroptions').data('bs.popover');
				// $(ihatethisfuckingpopoverworkaround.tip).find( '.popover-body' ).empty();

				var aceSession = self.editor.getSession();
				var content = self.getNodeFromString(
					Mustache.render(
						self.templates.file_editoroptions,
						{
							wordwrap: ( aceSession.getOption( 'wrap' ) == 'off' ? false : true ),
							softtabs: aceSession.getOption( 'useSoftTabs' ),
							tabsize: aceSession.getOption( 'tabSize' ),
							ace_includes: self.ace,
							ace_mode_selected: function() {
								return ( aceSession.$modeId == "ace/mode/"+this ) ? 'selected="selected"' : '';
							},
							i18n: self.i18n
						}
					)
				);
				if( el = content.querySelector("#editor-wordwrap" )) {
					el.addEventListener( 'change', function( e ) {
						aceSession.setOption( 'wrap', e.srcElement.checked );
					});
				}
				if( el = content.querySelector("#editor-softtabs" ))
					el.addEventListener( 'change', function( e ) {
						aceSession.setOption( 'useSoftTabs', e.srcElement.checked );
					});
				if( el = content.querySelector("#editor-tabsize" )) {
					console.log("Found tabSize");
					el.addEventListener( 'keydown', function( e ) {
						console.log("Got keydown");
						console.log("Set tabsize to "+e.srcElement.value);
						if( e.key == 'Enter' ) {
							console.log("Saw ENTER key");
							e.preventDefault();
							aceSession.setOption( 'tabSize', e.srcElement.value );
						}
					});
				}
				if( el = content.querySelector("#editor-syntax" ))
					el.addEventListener( 'change', function( e ) {
						aceSession.getSession().setMode( e.target.value );
					});
				return content;

			}
		});

		// Start ACE
		self.editor = ace.edit("content");
		self.editor.$blockScrolling = 'Infinity';
		self.editor.getSession().setValue(content);
		self.editor.focus();
		self.editor.on("change", function() { self.fileChanged = true; });
		if( self.ace && self.inArray( "ext-modelist", self.ace.files ) ) {
			var mode = ace.require( "ace/ext/modelist" ).getModeForPath( filename ).mode;
			if( self.inArray( mode, self.ace.modes.map( x => "ace/mode/"+x ) ) )
				self.editor.getSession().setMode( mode );
		}
		self.editor.commands.addCommand({
			name: "toggleFullscreen",
			bindKey: "Ctrl-Shift-F",
			exec: function(e) {
				var el = e.container;
				console.log("toggleFullscreen was called");
				console.log("el.parentElement.tagName is "+el.parentElement.tagName);
				if (el.parentElement.tagName == "BODY") {
					el.remove();
					var fieldset = document.getElementsByClassName('modal-body')[0].firstElementChild;
					fieldset.insertBefore(el, fieldset.getElementsByTagName('button')[0].previousElementSibling);
					el.style = Object.assign({}, ifm.tmpEditorStyles);
					ifm.tmpEditorStyles = undefined;
				} else {
					ifm.tmpEditorStyles = Object.assign({}, el.style);
					el.remove();
					document.body.appendChild(el);
					el.style.position = "absolute";
					el.style.top = 0;
					el.style.left = 0;
					el.style.zIndex = 10000;
					el.style.width = "100%";
					el.style.height = "100%";
				}
				e.resize();
				e.focus();
			}
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
							self.showMessage( self.i18n.file_save_success, "s" );
							self.refreshFileTable();
						} else self.showMessage( self.i18n.file_save_error + data.message, "e" );
					},
			error: function() { self.showMessage( self.i18n.general_error, "e" ); }
		});
		self.fileChanged = false;
	};

	/**
	 * Edit a file
	 *
	 * @params string name - name of the file
	 */
	this.editFile = function( filename ) {
		$.ajax({
			url: self.api,
			type: "POST",
			dataType: "json",
			data: ({
				api: "getContent",
				dir: self.currentDir,
				filename: filename
			}),
			success: function( data ) {
						if( data.status == "OK" && data.data.content != null ) {
							self.showFileDialog( data.data.filename, data.data.content );
						}
						else if( data.status == "OK" && data.data.content == null ) {
							self.showMessage( self.i18n.file_load_error, "e" );
						}
						else self.showMessage( self.i18n.error +data.message, "e" );
					},
			error: function() { self.showMessage( self.i18n.file_display_error, "e" ); }
		});
	};

	/**
	 * Shows the create directory dialog
	 */
	this.showCreateDirDialog = function() {
		self.showModal( Mustache.render( self.templates.createdir, { i18n: self.i18n } ) );
		var form = document.forms.formCreateDir;
		form.elements.dirname.addEventListener( 'keypress', function( e ) {
			if(e.key == 'Enter' ) {
				e.preventDefault();
				self.createDir( e.target.value );
				self.hideModal();
			}
		});
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'buttonSave' ) {
				e.preventDefault();
				self.createDir( form.elements.dirname.value );
				self.hideModal();
			} else if( e.target.id == 'buttonCancel' ) {
				e.preventDefault();
				self.hideModal();
			}
		}, false );
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
						self.showMessage( self.i18n.folder_create_error +data.message, "e" );
					}
				},
			error: function() { self.showMessage( self.i18n.general_error, "e" ); }
		});
	};

	/**
	 * Shows the delete dialog
	 */
	this.showDeleteDialog = function( items ) {
		self.showModal(	Mustache.render( self.templates.deletefile, {
			multiple: ( items.length > 1 ),
			count: items.length,
			filename: ( Array.isArray( items ) ? items[0].name : items.name ),
			i18n: self.i18n
		}));
		var form = document.forms.formDeleteFiles;
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'buttonYes' ) {
				e.preventDefault();
				self.deleteFiles( items );
				self.hideModal();
			} else if( e.target.id == 'buttonNo' ) {
				e.preventDefault();
				self.hideModal();
			}
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
	 * Show the rename file dialog
	 *
	 * @params string name - name of the file
	 */
	this.showRenameFileDialog = function( filename ) {
		self.showModal( Mustache.render( self.templates.renamefile, { filename: filename, i18n: self.i18n } ) );
		var form = document.forms.formRenameFile;
		form.elements.newname.addEventListener( 'keypress', function( e ) {
			if( e.key == 'Enter' ) {
				e.preventDefault();
				self.renameFile( filename, e.target.value );
				self.hideModal();
			}
		});
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'buttonRename' ) {
				e.preventDefault();
				self.renameFile( filename, form.elements.newname.value );
				self.hideModal();
			} else if( e.target.id == 'buttonCancel' ) {
				e.preventDefault();
				self.hideModal();
			}
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
						} else ifm.showMessage( self.i18n.file_rename_error +data.message, "e");
					},
			error: function() { ifm.showMessage( self.i18n.general_error, "e"); }
		});
	};

	/**
	 * Show the copy/move dialog
	 *
	 * @params string name - name of the file
	 */
	this.showCopyMoveDialog = function( items ) {
		self.showModal( Mustache.render( self.templates.copymove, { i18n: self.i18n } ) );
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "getFolders"
			}),
			dataType: "json",
			success: function( data ) {
				$( '#copyMoveTree' ).treeview({
					data: data,
					levels: 1,
					expandIcon: "icon icon-folder-empty",
					emptyIcon: "icon icon-folder-empty",
					collapseIcon: "icon icon-folder-open-empty",
					loadingIcon: "icon icon-spin5",
					lazyLoad: function( n, cb ) {
						$.ajax({
							url: self.api,
							type: "POST",
							data: {
								api: "getFolders",
								dir: n.dataAttr.path
							},
							dataType: "json",
							success: cb
						});
					}
				});
			},
			error: function() { self.hideModal(); self.showMessage( self.i18n.folder_tree_load_error, "e" ) }
		});
		var form = document.forms.formCopyMove;
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'copyButton' ) {
				e.preventDefault();
				self.copyMove( items, form.getElementsByClassName( 'node-selected' )[0].dataset.path, 'copy' );
				self.hideModal();
			} else if( e.target.id == 'moveButton' ) {
				e.preventDefault();
				self.copyMove( items, form.getElementsByClassName( 'node-selected' )[0].dataset.path, 'move' );
				self.hideModal();
			} else if( e.target.id == 'cancelButton' ) {
				e.preventDefault();
				self.hideModal();
			}
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
		var id = self.generateGuid();
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
	 * Shows the extract file dialog
	 *
	 * @param {string} filename - name of the file
	 */
	this.showExtractFileDialog = function( filename ) {
		var targetDirSuggestion = ( filename.lastIndexOf( '.' ) > 1 ) ? filename.substr( 0, filename.lastIndexOf( '.' ) ) : filename;
		self.showModal( Mustache.render( self.templates.extractfile, { filename: filename, destination: targetDirSuggestion, i18n: self.i18n } ) );
		var form = document.forms.formExtractFile;
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'buttonExtract' ) {
				e.preventDefault();
				var loc = form.elements.extractTargetLocation.value;
				self.extractFile( filename, ( loc == "custom" ? form.elements.extractCustomLocation.value : loc ) ); 
				self.hideModal();
			} else if( e.target.id == 'buttonCancel' ) {
				e.preventDefault();
				self.hideModal();
			}
		});
		form.elements.extractCustomLocation.addEventListener( 'keypress', function( e ) {
			var loc = form.elements.extractTargetLocation.value;
			if( e.key == 'Enter' ) {
				e.preventDefault();
				self.extractFile( filename, ( loc == "custom" ? form.elements.extractCustomLocation.value : loc ) );
				self.hideModal();
			}
		});
		form.elements.extractCustomLocation.addEventListener( 'focus', function( e ) {
			form.elements.extractTargetLocation.value = 'custom';
		});
	};

	/**
	 * Extracts a file
	 *
	 * @param string filename - name of the file
	 * @param string destination - name of the target directory
	 */
	this.extractFile = function( filename, destination ) {
		var id = self.generateGuid();
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
	 * Shows the upload file dialog
	 */
	this.showUploadFileDialog = function() {
		self.showModal( Mustache.render( self.templates.uploadfile, { i18n: self.i18n } ) );
		var form = document.forms.formUploadFile;
		form.elements.files.addEventListener( 'change', function( e ) {
			if( e.target.files.length > 1 )
				form.elements.newfilename.readOnly = true;
			else 
				form.elements.newfilename.readOnly = false;
		});
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'buttonUpload' ) {
				e.preventDefault();
				var files = Array.prototype.slice.call( form.elements.files.files );
				if( files.length > 1 )
					files.forEach( function( file ) {
						self.uploadFile( file );
					});
				else
					self.uploadFile( files[0], form.elements.newfilename.value );
				self.hideModal();
			} else if( e.target.id == 'buttonCancel' ) {
				e.preventDefault();
				self.hideModal();
			}
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
	 * Show the remote upload dialog
	 */
	this.showRemoteUploadDialog = function() {
		self.showModal( Mustache.render( self.templates.remoteupload, { i18n: self.i18n } ) );
		var form = document.forms.formRemoteUpload;
		var urlChangeHandler = function( e ) {
			form.elements.filename.value = e.target.value.substr( e.target.value.lastIndexOf( '/' ) + 1 );
		};
		form.elements.url.addEventListener( 'keypress', self.preventEnter );
		form.elements.url.addEventListener( 'change', urlChangeHandler );
		form.elements.url.addEventListener( 'keyup', urlChangeHandler );
		form.elements.filename.addEventListener( 'keypress', self.preventEnter );
		form.elements.filename.addEventListener( 'keyup', function( e ) {
			form.elements.url.removeEventListener( 'change', urlChangeHandler );
			form.elements.url.removeEventListener( 'keyup', urlChangeHandler );
		});
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'buttonUpload' ) {
				e.preventDefault();
				self.remoteUpload( form.elements.url.value, form.elements.filename.value, form.elements.method.value );
				self.hideModal();
			} else if( e.target.id == 'buttonCancel' ) {
				e.preventDefault();
				self.hideModal();
			}
		});
	};

	/**
	 * Remote uploads a file
	 */
	this.remoteUpload = function( url, filename, method ) {
		var id = ifm.generateGuid();
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
					self.showMessage( self.i18n.file_upload_error + data.message, "e" );
			},
			error: function() { self.showMessage( self.i18n.general_error, "e"); },
			complete: function() { self.task_done(id); }
		});
		self.task_add( { id: id, name: self.i18n.upload_remote+" "+filename } );
	};

	/**
	 * Shows the ajax request dialog
	 */
	this.showAjaxRequestDialog = function() {
		self.showModal( Mustache.render( self.templates.ajaxrequest, { i18n: self.i18n } ) );
		var form = document.forms.formAjaxRequest;
		form.elements.ajaxurl.addEventListener( 'keypress', self.preventEnter );
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'buttonRequest' ) {
				e.preventDefault();
				self.ajaxRequest( form.elements.ajaxurl.value, form.elements.ajaxdata.value.replace( /\n/g, '&' ), form.elements.arMethod.value );
			} else if( e.target.id == 'buttonClose' ) {
				e.preventDefault();
				self.hideModal();
			}
		});
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
			success	: function( response ) { document.getElementById( 'ajaxresponse' ).innerText = response; },
			error	: function(e) { self.showMessage("Error: "+e, "e"); self.log(e); }
		});
	};

	/**
	 * Shows the search dialog
	 */
	this.showSearchDialog = function() {
		self.showModal( Mustache.render( self.templates.search, { lastSearch: self.search.lastSearch, i18n: self.i18n } ) );

		var updateResults = function( data ) {
			self.log( 'updated search results' );
			var searchresults = document.getElementById( 'searchResults' );
			if( searchresults.tBodies[0] ) searchresults.tBodies[0].remove();
			searchresults.appendChild( document.createElement( 'tbody' ) );
			searchresults.tBodies[0].innerHTML = Mustache.render( self.templates.searchresults, { items: self.search.data } );
			searchresults.tBodies[0].addEventListener( 'click', function( e ) {
				if( e.target.classList.contains( 'searchitem' ) || e.target.parentElement.classList.contains( 'searchitem' ) ) {
					e.preventDefault();
					self.changeDirectory( self.pathCombine( self.search.data.currentDir, e.target.dataset.folder || e.target.parentElement.dataset.folder ), { absolute: true });
					self.hideModal();
				}
			});
			searchresults.tBodies[0].addEventListener( 'keypress', function( e ) {
				if( e.target.classList.contains( 'searchitem' ) || e.target.parentElement.classList.contains( 'searchitem' ) ) {
					e.preventDefault();
					e.target.click();
				}
			});
		};

		updateResults( self.search.data );

		document.getElementById( 'searchPattern' ).addEventListener( 'keypress', function( e ) {
			if( e.key == 'Enter' ) {
				e.preventDefault();
				if( e.target.value.trim() === '' ) return;
				document.getElementById( 'searchResults' ).tBodies[0].innerHTML = '<tr><td style="text-align:center;"><span class="icon icon-spin5 animate-spin"></span></td></tr>';
				self.search.lastSearch = e.target.value;
				$.ajax({
					url: self.api,
					type: "POST",
					data: {
						api: "searchItems",
						dir: self.currentDir,
						pattern: e.target.value
					},
					dataType: "json",
					success: function( data ) {
						if( data.status == 'ERROR' ) {
							self.hideModal();
							self.showMessage( data.message, "e" );
						} else {
							data.forEach( function(e) {
								e.folder = e.name.substr( 0, e.name.lastIndexOf( '/' ) );
								e.linkname = e.name.substr( e.name.lastIndexOf( '/' ) + 1 );
							});
							self.search.data = data;
							if( self.search.data ) self.search.data.currentDir = self.currentDir;
							updateResults( data );
						}
					}
				});
			}
		});
	};

	/**
	 * Shows the create archive dialog
	 */
	this.showCreateArchiveDialog = function( items ) {
		self.showModal( Mustache.render( self.templates.createarchive, { i18n: self.i18n } ) );

		var form = document.forms.formCreateArchive;
		form.elements.archivename.addEventListener( 'keypress', function( e ) {
			if( e.key == 'Enter' ) {
				e.preventDefault();
				self.createArchive( items, e.target.value );
				self.hideModal();
			}
		});
		form.addEventListener( 'click', function( e ) {
			if( e.target.id == 'buttonSave' ) {
				e.preventDefault();
				self.createArchive( items, form.elements.archivename.value );
				self.hideModal();
			} else if( e.target.id == 'buttonCancel' ) {
				e.preventDefault();
				self.hideModal();
			}
		}, false );
	};

	this.createArchive = function( items, archivename ) {
		var type = "";
		if( archivename.substr( -3 ).toLowerCase() == "zip" )
			type = "zip";
		else if( archivename.substr( -3 ).toLowerCase() == "tar" )
			type = "tar";
		else if( archivename.substr( -6 ).toLowerCase() == "tar.gz" )
			type = "tar.gz";
		else if( archivename.substr( -7 ).toLowerCase() == "tar.bz2" )
			type = "tar.bz2";
		else {
			self.showMessage( self.i18n.invalid_archive_format, "e" );
			return;
		}
		var id = self.generateGuid();
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
				format: type
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
		var msgType = ( t == "e" ) ? "danger" : ( t == "s" ) ? "success" : "info";
		var element = ( self.config.inline ) ? self.rootElement : "body";
		$.notify(
			{ message: m },
			{ type: msgType, delay: 3000, mouse_over: 'pause', offset: { x: 15, y: 65 }, element: element }
		);
	};

	/**
	 * Combines two path components
	 *
	 * @param {string} a - component 1
	 * @param {string} b - component 2
	 * @returns {string} - combined path
	 */
	this.pathCombine = function() {
		if( !arguments.length )
			return "";
		var args = Array.prototype.slice.call(arguments);
		args = args.filter( x => typeof x === 'string' && x != '' );

		if( args.length == 0 )
			return "";

		first = "";
		while( first.length < 1 )
			first = args.shift();

		first = first.replace( /\/+$/g, '' );
		if( !args.length )
			return first;

		args.forEach( (v, i) => args[i] = v.replace( /^\/*|\/*$/g, '' ) ); // */
		args.unshift( first );
		return args.join( '/' );
	};

	/**
	 * Prevents a user to submit a form via clicking enter
	 *
	 * @param object e - click event
	 */
	this.preventEnter = function(e) {
		if( e.key == 'Enter' )
			e.preventDefault();
	};

	/**
	 * Checks if an element is part of an array
	 *
	 * @param {object} needle - search item
	 * @param {array} haystack - array to search
	 * @returns {boolean}
	 */
	this.inArray = function(needle, haystack) {
		for( var i = 0; i < haystack.length; i++ )
			if( haystack[i] == needle )
				return true;
		return false;
	};

	/**
	 * Formats a date from an unix timestamp
	 *
	 * @param {integer} timestamp - UNIX timestamp
	 */
	this.formatDate = function( timestamp ) {
		var d = new Date( timestamp * 1000 );

		return d.toLocaleString(self.config.dateLocale);
	};

	this.getClipboardLink = function( relpath ) {
		var link = window.location.origin;
		link += window.location.pathname.substr( 0, window.location.pathname.lastIndexOf( "/" ) );
		link = self.pathCombine( link, relpath );
		return link;
	}

	this.getNodeFromString = function( s ) {
		var template = document.createElement( 'template');
		template.innerHTML = s;
		return template.content.childNodes[0];
	};

	this.getNodesFromString = function( s ) {
		var template = document.createElement( 'template');
		template.innerHTML = s;
		return template.content.childNodes;
	};

	// copypasted from https://hackernoon.com/copying-text-to-clipboard-with-javascript-df4d4988697f
	this.copyToClipboard = function( str ) {
		const el = document.createElement('textarea');
		el.value = str;
		el.setAttribute('readonly', '');
		el.style.position = 'absolute';
		el.style.left = '-9999px';
		document.body.appendChild(el);
		const selected =
			document.getSelection().rangeCount > 0
			? document.getSelection().getRangeAt(0)
			: false;
		el.select();
		document.execCommand('copy');
		document.body.removeChild(el);
		if (selected) {
			document.getSelection().removeAllRanges();
			document.getSelection().addRange(selected);
		}
	};

	/**
	 * Adds a task to the taskbar.
	 *
	 * @param object task - description of the task: { id: "guid", name: "Task Name", type: "(info|warning|danger|success)" }
	 */
	this.task_add = function( task ) {
		if( ! task.id ) {
			self.log( "Error: No task id given.");
			return false;
		}
		if( ! document.querySelector( "footer" ) ) {
			var newFooter = self.getNodeFromString( Mustache.render( self.templates.footer, { i18n: self.i18n } ) );
			newFooter.addEventListener( 'click', function( e ) {
				if( e.target.name == 'showAll' || e.target.parentElement.name == "showAll" ) {
					wq = newFooter.children.wq_container.children[0].children.waitqueue;
					if( wq.style.maxHeight == '70vh' ) {
						wq.style.maxHeight = '6rem';
						wq.style.overflow = 'hidden';
					} else {
						wq.style.maxHeight = '70vh';
						wq.style.overflow = 'auto';
					}
				}
			});
			document.body.appendChild( newFooter );
			document.body.style.paddingBottom = '9rem';
		}
		task.id = "wq-"+task.id;
		task.type = task.type || "info";
		var wq = document.getElementById( 'waitqueue' );
		wq.prepend( self.getNodeFromString( Mustache.render( self.templates.task, task ) ) );
		document.getElementsByName( 'taskCount' )[0].innerText = wq.children.length;
	};

	/**
	 * Removes a task from the taskbar
	 *
	 * @param string id - task identifier
	 */
	this.task_done = function( id ) {
		document.getElementById( 'wq-' + id ).remove();
		var wq = document.getElementById( 'waitqueue' );
		if( wq.children.length == 0 ) {
			document.getElementsByTagName( 'footer' )[0].remove();
			document.body.style.paddingBottom = 0;
		} else {
			document.getElementsByName( 'taskCount' )[0].innerText = wq.children.length;
		}
	};

	/**
	 * Updates a task
	 *
	 * @param integer progress - percentage of status
	 * @param string id - task identifier
	 */
	this.task_update = function( progress, id ) {
		var progbar = document.getElementById( 'wq-'+id ).getElementsByClassName( 'progress-bar' )[0];
		progbar.style.width = progress+'%';
		progbar.setAttribute( 'aria-valuenow', progress );
	};

	/**
	 * Highlights an item in the file table
	 *
	 * @param object param - either an element id or a jQuery object
	 */
	this.highlightItem = function( direction ) {
		var highlight = function( el ) {
			[].slice.call( el.parentElement.children ).forEach( function( e ) {
				e.classList.remove( 'highlightedItem' );
			});
			el.classList.add( 'highlightedItem' );
			el.firstElementChild.firstElementChild.focus();
			if( ! self.isElementInViewport( el ) ) {
				var scrollOffset =  0;
				if( direction=="prev" )
					scrollOffset = el.offset().top - ( window.innerHeight || document.documentElement.clientHeight ) + el.height() + 15;
				else
					scrollOffset = el.offset().top - 55;
				$('html, body').animate( { scrollTop: scrollOffset }, 200 );
			}
		};


		var highlightedItem = document.getElementsByClassName( 'highlightedItem' )[0];
		if( ! highlightedItem ) {
			if( document.activeElement.classList.contains( 'ifmitem' ) )
				highlight( document.activeElement.parentElement.parentElement );
			else 
				highlight( document.getElementById( 'filetable' ).tBodies[0].firstElementChild );
		} else  {
			var newItem = ( direction=="next" ? highlightedItem.nextElementSibling : highlightedItem.previousElementSibling );
			if( newItem != null )
				highlight( newItem );
		}
	};

	/**
	 * Checks if an element is within the viewport
	 *
	 * @param object el - element object
	 */
	this.isElementInViewport = function( el ) {
		var rect = el.getBoundingClientRect();
		return (
				rect.top >= 80 &&
				rect.left >= 0 &&
				rect.bottom <= ( ( window.innerHeight || document.documentElement.clientHeight ) ) &&
				rect.right <= ( window.innerWidth || document.documentElement.clientWidth )
			   );
	};

	/**
	 * Generates a GUID
	 */
	this.generateGuid = function() {
		var result, i, j;
		result = '';
		for( j = 0; j < 20; j++ ) {
			i = Math.floor( Math.random() * 16 ).toString( 16 ).toUpperCase();
			result = result + i;
		}
		return result;
	};

	/**
	 * Logs a message if debug mode is active
	 *
	 * @param string m - message text
	 */
	this.log = function( m ) {
		if( self.config.debug ) {
			console.log( "IFM (debug): " + m );
		}
	};

	/**
	 * Encodes a string for use in the href attribute of an anchor.
	 *
	 * @param string s - decoded string
	 */
	this.hrefEncode = function( s ) {
		return s
			.replace( /%/g, '%25' )
			.replace( /;/g, '%3B' )
			.replace( /\?/g, '%3F' )
			.replace( /:/g, '%3A' )
			.replace( /@/g, '%40' )
			.replace( /&/g, '%26' )
			.replace( /=/g, '%3D' )
			.replace( /\+/g, '%2B' )
			.replace( /\$/g, '%24' )
			.replace( /,/g, '%2C' )
			.replace( /</g, '%3C' )
			.replace( />/g, '%3E' )
			.replace( /#/g, '%23' )
			.replace( /"/g, '%22' )
			.replace( /{/g, '%7B' )
			.replace( /}/g, '%7D' )
			.replace( /\|/g, '%7C' )
			.replace( /\^/g, '%5E' )
			.replace( /\[/g, '%5B' )
			.replace( /\]/g, '%5D' )
			.replace( /\\/g, '%5C' )
			.replace( /`/g, '%60' )
		;
		// ` <- this comment prevents the vim syntax highlighting from breaking -.-
	};

	/**
	 * Handles the javascript onbeforeunload event
	 *
	 * @param object event - event object
	 */
	this.onbeforeunloadHandler = function( e ) {
		if( document.getElementById( 'waitqueue' ) ) {
			return self.i18n.remaining_tasks;
		}
	};

	/**
	 * Handles the javascript pop states
	 *
	 * @param object event - event object
	 */
	this.historyPopstateHandler = function( e ) {
		var dir = "";
		if( e.state && e.state.dir )
			dir = e.state.dir;
		self.changeDirectory( dir, { pushState: false, absolute: true } );
	};

	/**
	 * Handles keystrokes
	 *
	 * @param object e - event object
	 */
	this.handleKeystrokes = function( e ) {
		var isFormElement = function( el ) {
			do {
				if( self.inArray( el.tagName, ['INPUT', 'TEXTAREA'] ) ) {
					return true;
				}
			} while( ( el == el.parentElement ) !== false );
			return false;
		}

		if( isFormElement( e.target ) ) return;

		// global key events
		switch( e.key ) {
			case '/':
				if (self.config.search) {
					e.preventDefault();
					self.showSearchDialog();
				}
				break;
			case 'g':
				e.preventDefault();
				$('#currentDir').focus();
				return;
				break;
			case 'r':
				if (self.config.showrefresh) {
					e.preventDefault();
					self.refreshFileTable();
				}
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
		}

		// key events which need a highlighted item
		var element = document.getElementsByClassName( 'highlightedItem' )[0];
		if( element )
			item = self.fileCache.find( x => x.guid == element.children[0].children[0].id );
		else
			item = false;

		// Some operations do not work if the highlighted item is the parent
		// directory. In these cases the keybindings are ignored.
		var selectedItems = Array.prototype.slice.call( document.getElementsByClassName( 'selectedItem' ) )
			.map( function( e ) { return self.fileCache.find( x => x.guid === e.children[0].children[0].id ) } );

		switch( e.key ) {
			case 'Delete':
				if( self.config.delete )
					if( selectedItems.length > 0 ) {
						e.preventDefault();
						self.showDeleteDialog( selectedItems );
					} else if( item && item.name !== '..' )
						self.showDeleteDialog( item );
				return;
				break;
			case 'c':
			case 'm':
				if( self.config.copymove ) {
					if( selectedItems.length > 0 ) {
						e.preventDefault();
						self.showCopyMoveDialog( selectedItems );
					} else if( item && item.name !== '..' )
						self.showCopyMoveDialog( item );
				}
				return;
				break;
		}

		if( item )
			switch( e.key ) {
				case 'l':
				case 'ArrowRight':
					e.preventDefault();
					if( item.type == "dir" )
						self.changeDirectory( item.name );
					return;
					break;
				case 'Escape':
					if( element.children[0].children[0] == document.activeElement ) {
						e.preventDefault();
						element.classList.toggle( 'highlightedItem' );
					}
					return;
					break;
				case ' ':
				case 'Enter':
					if( element.children[0].children[0] == document.activeElement ) { 
						if( e.key == 'Enter' && element.classList.contains( 'isDir' ) ) {
							e.preventDefault();
							e.stopPropagation();
							self.changeDirectory( item.name );
						} else if( e.key == ' ' && item.name != ".." ) {
							e.preventDefault();
							e.stopPropagation();
							element.classList.toggle( 'selectedItem' );
						}
					}
					return;
					break;
				case 'e':
					if( self.config.edit && item.eaction == "edit" ) {
						e.preventDefault();
						self.editFile( item.name );
					} else if( self.config.extract && item.eaction == "extract" ) {
						e.preventDefault();
						self.showExtractFileDialog( item.name );
					}
					return;
					break;
				case 'n':
					e.preventDefault();
					if( self.config.rename ) {
						self.showRenameFileDialog( item.name );
					}
					return;
					break;
			}
	};

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
				if( self.config.ace_includes ) {
					self.ace = {};
					self.ace.files = self.config.ace_includes.split( '|' ).filter( x => x != "" );
					self.ace.modes = self.ace.files
						.filter( function(f){ if( f.substr(0,5)=="mode-" ) return f; } )
						.map( function(f){ return f.substr(5); } )
					self.ace.modes.unshift( "text" );
				}
				self.log( "configuration loaded" );
				self.initLoadTemplates();
			},
			error: function() {
				throw new Error( self.i18n.load_config_error );
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
				self.initLoadI18N();
			},
			error: function() {
				throw new Error( self.i18n.load_template_error );
			}
		});
	};

	this.initLoadI18N = function() {
		// load I18N from the backend
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "getI18N"
			},
			dataType: "json",
			success: function(d) {
				self.i18n = d;
				self.log( "I18N loaded" );
				self.initApplication();
			},
			error: function() {
				throw new Error( self.i18n.load_text_error );
			}
		});
	};
	
	this.initApplication = function() {
		self.rootElement.innerHTML = Mustache.render(
				self.templates.app,
				{
					showpath: "/",
					config: self.config,
					i18n: self.i18n,
					ftbuttons: function(){
						return ( self.config.edit || self.config.rename || self.config.delete || self.config.zipnload || self.config.extract );
					}
				});

		// bind static buttons
		if (el_r = document.getElementById('refresh'))
			el_r.onclick = function() { self.refreshFileTable(); };
		if (el_s = document.getElementById('search'))
			el_s.onclick = function() { self.showSearchDialog(); };
		//document.getElementById( 'refresh' ).onclick = function() { self.refreshFileTable(); };
		//document.getElementById( 'search' ).onclick = function() { self.showSearchDialog(); };
		if( self.config.createfile )
			document.getElementById( 'createFile' ).onclick = function() { self.showFileDialog(); };
		if( self.config.createdir )
			document.getElementById( 'createDir' ).onclick = function() { self.showCreateDirDialog(); };
		if( self.config.upload )
			document.getElementById( 'upload' ).onclick = function() { self.showUploadFileDialog(); };
		document.getElementById( 'currentDir' ).onkeypress = function( e ) {
			if( e.keyCode == 13 ) {
				e.preventDefault();
				self.changeDirectory( e.target.value, { absolute: true } );
				e.target.blur();
			}
		};
		if( self.config.remoteupload )
			document.getElementById( 'buttonRemoteUpload' ).onclick = function() { self.showRemoteUploadDialog(); };
		if( self.config.ajaxrequest )
			document.getElementById( 'buttonAjaxRequest' ).onclick = function() { self.showAjaxRequestDialog(); };
		if( self.config.upload )
			document.addEventListener( 'dragover', function( e ) {
				if( Array.prototype.indexOf.call(e.dataTransfer.types, "Files") != -1 ) {
					e.preventDefault();
					e.stopPropagation();
					var div = document.getElementById( 'filedropoverlay' );
					div.style.display = 'block';
					div.ondrop = function( e ) {
						e.preventDefault();
						e.stopPropagation();
						var files = e.dataTransfer.files;
						for( var i = 0; i < files.length; i++ ) {
							self.uploadFile( files[i] );
						}
						if( e.target.id == 'filedropoverlay' )
							e.target.style.display = 'none';
						else if( e.target.parentElement.id == 'filedropoverlay' ) {
							e.target.parentElement.style.display = 'none';
						}
					};
					div.ondragleave = function( e ) {
						e.preventDefault();
						e.stopPropagation();
						if( e.target.id == 'filedropoverlay' )
							e.target.style.display = 'none';
					};
				} else {
					var div = document.getElementById( 'filedropoverlay' );
					if( div.style.display == 'block' )
						div.stye.display == 'none';
				}
			});

		// drag and drop of filetable items
		if( self.config.copymove ) {
			var isFile = function(e) { return Array.prototype.indexOf.call(e.dataTransfer.types, "Files") != -1 };
			document.addEventListener( 'dragstart', function( e ) {
				var selectedItems = document.getElementsByClassName( 'selectedItem' );
				var data;
				if( selectedItems.length > 0 ) 
					data = self.fileCache.filter(
							x => self.inArray(
								x.guid,
								[].slice.call( selectedItems ).map( function( e ) { return e.dataset.id; } )
								)
							);
				else 
					data = self.fileCache.find( x => x.guid === e.target.dataset.id );
				e.dataTransfer.setData( 'text/plain', JSON.stringify( data ) );
				var dragImage = document.createElement( 'div' );
				dragImage.style.display = 'inline';
				dragImage.style.padding = '10px';
				dragImage.innerHTML = '<span class="icon icon-folder-open-empty"></span> '+self.i18n.move+' '+( data.length || data.name );
				document.body.appendChild( dragImage );
				setTimeout(function() {
					dragImage.remove();
				});
				e.dataTransfer.setDragImage( dragImage, 0, 0 );
			});
			document.addEventListener( 'dragover', function( e ) { if( ! isFile( e ) && e.target.parentElement.classList.contains( 'isDir' ) ) e.preventDefault(); } );
			document.addEventListener( 'dragenter', function( e ) {
				if( ! isFile( e ) && e.target.tagName == "TD" && e.target.parentElement.classList.contains( 'isDir' ) )
					e.target.parentElement.classList.add( 'highlightedItem' );
			});
			document.addEventListener( 'dragleave', function( e ) {
				if( ! isFile( e ) && e.target.tagName == "TD" && e.target.parentElement.classList.contains( 'isDir' ) )
					e.target.parentElement.classList.remove( 'highlightedItem' );
			});
			document.addEventListener( 'drop', function( e ) {
				if( ! isFile( e ) && e.target.tagName == "TD" && e.target.parentElement.classList.contains( 'isDir' ) ) {
					e.preventDefault();
					e.stopPropagation();
					try {
						var source = JSON.parse( e.dataTransfer.getData( 'text' ) );
						self.log( "source:" );
						self.log( source );
						var destination = self.fileCache.find( x => x.guid === e.target.firstElementChild.id );
						if( ! Array.isArray( source ) )
							source = [source];
						if( source.find( x => x.name === destination.name ) )
							self.showMessage( "Source and destination are equal." );
						else
							self.copyMove( source, destination.name, "move" );
					} catch( e ) {
						self.log( e );
					} finally {
						[].slice.call( document.getElementsByClassName( 'highlightedItem' ) ).forEach( function( e ) {
							e.classList.remove( 'highlightedItem' );
						});
					}
				}
			});
		}
		
		// handle keystrokes
		document.onkeydown = self.handleKeystrokes;

		// handle history manipulation
		window.onpopstate = self.historyPopstateHandler;

		// handle window.onbeforeunload
		window.onbeforeunload = self.onbeforeunloadHandler;

		// load initial file table
		if( window.location.hash ) {
			self.changeDirectory( decodeURIComponent( window.location.hash.substring( 1 ) ) );
		} else {
			this.refreshFileTable();
		}
	};

	this.init = function( id ) {
		self.rootElement = document.getElementById( id );
		this.initLoadConfig();
	};
}
