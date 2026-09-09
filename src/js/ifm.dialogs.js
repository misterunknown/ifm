/**
 * Every dialog the application opens. They render a template into a modal and
 * hand the collected input to the matching function in ifm.actions.js.
 *
 * Part of the IFM object; see ifm.core.js for how the parts are applied.
 */
IFM.parts.push( function( self ) {

	/**
	 * Shows a file, either a new file or an existing
	 */
	this.showFileDialog = function () {
		let filename = arguments.length > 0 ? arguments[0] : "newfile.txt";
		let content = arguments.length > 1 ? arguments[1] : "";
		self.showModal( Mustache.render( self.templates.file, { filename: filename, i18n: self.i18n } ), { large: true } );

		let isNewFile = arguments.length === 0;
		let originalFilename = filename;
		let form = document.getElementById( 'formFile' );
		let filenameInput = form.querySelector( 'input[name=filename]' );

		let checkFilename = function( value ) {
			let taken = ( isNewFile || value !== originalFilename ) && self.fileCache.some( x => x.name === value );
			filenameInput.classList.toggle( 'is-invalid', taken );
			document.getElementById( 'filenameError' ).textContent = taken ? self.i18n.name_already_exists : '';
			return !taken;
		};

		filenameInput.addEventListener( 'input', function() {
			if( filenameInput.classList.contains( 'is-invalid' ) ) checkFilename( filenameInput.value );
		});

		form.addEventListener( 'keypress', function( e ) {
			if( e.target.name == 'filename' && e.key == 'Enter' )
				e.preventDefault();
		});
		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'buttonSave':
					e.preventDefault();
					if( !checkFilename( filenameInput.value ) ) return;
					self.saveFile( filenameInput.value, self.editor.getValue() );
					self.isModalClosedByButton = true;
					self.hideModal();
					break;
				case 'buttonSaveNotClose':
					e.preventDefault();
					if( !checkFilename( filenameInput.value ) ) return;
					self.saveFile( filenameInput.value, self.editor.getValue() );
					break;
				case 'buttonClose':
					e.preventDefault();
					self.isModalClosedByButton = true;
					self.hideModal();
					break;
				}
		});

		$('#editoroptions').popover({
			html: true,
			title: self.i18n.options,
			content: function() {
				let aceEditor = self.editor;
				let aceSession = aceEditor.getSession();
				let content = self.getNodeFromString(
					Mustache.render(
						self.templates.file_editoroptions,
						{
							wordwrap: ( aceSession.getOption( 'wrap' ) == 'off' ? false : true ),
							invisible_chars: aceEditor.getOption( 'showInvisibles' ),
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
				if( el = content.querySelector("#editor-invisible-chars")) {
					el.addEventListener( 'change', function( e ) {
						aceEditor.setOption( 'showInvisibles', e.srcElement.checked );
					});
				}
				if( el = content.querySelector("#editor-softtabs" ))
					el.addEventListener( 'change', function( e ) {
						aceSession.setOption( 'useSoftTabs', e.srcElement.checked );
					});
				if( el = content.querySelector("#editor-tabsize" )) {
					el.addEventListener( 'change', function( e ) {
						aceSession.setOption( 'tabSize', e.srcElement.value );
					});
				}
				if( el = content.querySelector("#editor-syntax" )) {
					el.addEventListener( 'change', function( e ) {
						aceSession.getSession().setMode( e.target.value );
					});
				}
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
			let mode = ace.require( "ace/ext/modelist" ).getModeForPath( filename ).mode;
			if( self.inArray( mode, self.ace.modes.map( x => "ace/mode/"+x ) ) )
				self.editor.getSession().setMode( mode );
		}
		self.editor.commands.addCommand({
			name: "toggleFullscreen",
			bindKey: "Ctrl-Shift-F",
			exec: function(e) {
				let el = e.container;
				if (el.parentElement.tagName == "BODY") {
					el.remove();
					let fieldset = document.getElementsByClassName('modal-body')[0].firstElementChild;
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
						else self.showMessage( data.message, "e" );
					},
			error: function() { self.showMessage( self.i18n.file_display_error, "e" ); }
		});
	};

	/**
	 * Shows the create directory dialog
	 */
	this.showCreateDirDialog = function() {
		self.showModal( Mustache.render( self.templates.createdir, { i18n: self.i18n } ) );
		let form = document.forms.formCreateDir;
		let input = form.elements.dirname;

		let checkDirname = function( value ) {
			let taken = self.fileCache.some( x => x.name === value );
			input.classList.toggle( 'is-invalid', taken );
			document.getElementById( 'dirnameError' ).textContent = taken ? self.i18n.name_already_exists : '';
			return !taken;
		};

		input.addEventListener( 'input', function() {
			if( input.classList.contains( 'is-invalid' ) ) checkDirname( input.value );
		});

		input.addEventListener( 'keypress', function( e ) {
			if( e.key == 'Enter' ) {
				e.preventDefault();
				if( checkDirname( input.value ) ) {
					self.createDir( input.value );
					self.hideModal();
				}
			}
		});
		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'buttonSave':
					e.preventDefault();
					if( checkDirname( form.elements.dirname.value ) ) {
						self.createDir( form.elements.dirname.value );
						self.hideModal();
					}
					break;
				case 'buttonCancel':
					e.preventDefault();
					self.hideModal();
					break;
			}
		}, false );
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
		let form = document.forms.formDeleteFiles;
		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'buttonYes':
					e.preventDefault();
					self.deleteFiles( items );
					self.hideModal();
					break;
				case 'buttonNo':
					e.preventDefault();
					self.hideModal();
					break;
			}
		});
	};

	/**
	 * Show the rename file dialog
	 *
	 * @params string name - name of the file
	 */
	this.showRenameFileDialog = function( filename ) {
		self.showModal( Mustache.render( self.templates.renamefile, { filename: filename, i18n: self.i18n } ) );
		let form = document.forms.formRenameFile;
		form.elements.newname.addEventListener( 'keypress', function( e ) {
			if( e.key == 'Enter' ) {
				e.preventDefault();
				self.renameFile( filename, e.target.value );
				self.hideModal();
			}
		});
		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'buttonRename':
					e.preventDefault();
					self.renameFile( filename, form.elements.newname.value );
					self.hideModal();
					break;
				case 'buttonCancel':
					e.preventDefault();
					self.hideModal();
					break;
			}
		});
	};

	/**
	 * Show the copy/move dialog
	 *
	 * @params string name - name of the file
	 */
	this.showCopyMoveDialog = function( items ) {
		self.showModal( Mustache.render( self.templates.copymove, { i18n: self.i18n } ) );
		let tree = null;
		$.ajax({
			url: self.api,
			type: "POST",
			data: ({
				api: "getFolders"
			}),
			dataType: "json",
			success: function( data ) {
				tree = self.createFolderTree( document.getElementById( 'copyMoveTree' ), {
					nodes: data,
					load: function( path, done, fail ) {
						$.ajax({
							url: self.api,
							type: "POST",
							data: { api: "getFolders", dir: path },
							dataType: "json",
							success: done,
							error: function() {
								self.showMessage( self.i18n.folder_tree_load_error, "e" );
								fail();
							}
						});
					}
				});
			},
			error: function() { self.hideModal(); self.showMessage( self.i18n.folder_tree_load_error, "e" ) }
		});
		let form = document.forms.formCopyMove;
		// returns the target directory, or null while nothing is selected
		let selectedPath = function() { return tree ? tree.selectedPath() : null; };
		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'copyButton':
					e.preventDefault();
					if( selectedPath() === null ) { self.showMessage( self.i18n.folder_not_found, "e" ); break; }
					self.copyMove( items, selectedPath(), 'copy' );
					self.hideModal();
					break;
				case 'moveButton':
					e.preventDefault();
					if( selectedPath() === null ) { self.showMessage( self.i18n.folder_not_found, "e" ); break; }
					self.copyMove( items, selectedPath(), 'move' );
					self.hideModal();
					break;
				case 'cancelButton':
					e.preventDefault();
					self.hideModal();
					break;
			}
		});
	};

	/**
	 * Shows the extract file dialog
	 *
	 * @param {string} filename - name of the file
	 */
	this.showExtractFileDialog = function( filename ) {
		let targetDirSuggestion = ( filename.lastIndexOf( '.' ) > 1 ) ? filename.substr( 0, filename.lastIndexOf( '.' ) ) : filename;
		self.showModal( Mustache.render( self.templates.extractfile, { filename: filename, destination: targetDirSuggestion, i18n: self.i18n } ) );
		let form = document.forms.formExtractFile;
		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'buttonExtract':
					e.preventDefault();
					let loc = form.elements.extractTargetLocation.value;
					self.extractFile( filename, ( loc == "custom" ? form.elements.extractCustomLocation.value : loc ) ); 
					self.hideModal();
					break;
				case 'buttonCancel':
					e.preventDefault();
					self.hideModal();
					break;
			}
		});
		form.elements.extractCustomLocation.addEventListener( 'keypress', function( e ) {
			let loc = form.elements.extractTargetLocation.value;
			if( e.key == 'Enter' ) {
				e.preventDefault();
				self.extractFile( filename, ( loc == "custom" ? form.elements.extractCustomLocation.value : loc ) );
				self.hideModal();
			}
		});
		form.elements.extractCustomLocation.addEventListener( 'focus', function( e ) {
			form.elements.extractTargetLocation.value = 'custom';
		});
		form.querySelectorAll( '.ifm-extract-location-input' ).forEach( function( input ) {
			input.addEventListener( 'click', function() {
				form.elements.extractTargetLocation.value = input.dataset.radioValue;
			});
		});
	};

	/**
	 * Shows the upload file dialog
	 */
	this.showUploadFileDialog = function() {
		self.showModal( Mustache.render( self.templates.uploadfile, { i18n: self.i18n } ) );
		let form = document.forms.formUploadFile;
		let pendingFiles = [];
		let fileListEl = document.getElementById( 'uploadFileList' );

		let fileFingerprint = function( f ) {
			return f.name + '\0' + f.size + '\0' + f.lastModified;
		};

		let syncFileInputFromPending = function() {
			let input = form.elements.files;
			let dt = new DataTransfer();
			pendingFiles.forEach( function( f ) { dt.items.add( f ); } );
			input.files = dt.files;
		};

		let refreshUploadFileList = function() {
			fileListEl.innerHTML = '';
			pendingFiles.forEach( function( file, index ) {
				let li = document.createElement( 'li' );
				li.className = 'list-group-item d-flex justify-content-between align-items-center py-2';
				let nameSpan = document.createElement( 'span' );
				nameSpan.className = 'text-truncate me-2';
				nameSpan.textContent = file.name;
				nameSpan.title = file.name;
				let btn = document.createElement( 'button' );
				btn.type = 'button';
				btn.className = 'btn btn-sm btn-link text-danger p-0 flex-shrink-0';
				btn.setAttribute( 'data-upload-remove', String( index ) );
				btn.setAttribute( 'title', self.i18n.delete );
				btn.innerHTML = '<span class="icon fa fa-trash"></span>';
				li.appendChild( nameSpan );
				li.appendChild( btn );
				fileListEl.appendChild( li );
			} );
			// the native file input renders the selection itself, the list below
			// spells it out - so the label stays untouched
			syncFileInputFromPending();

			// Update visibility based on file count
			let fileListContainer = document.getElementById( 'uploadFileListContainer' );
			let filenameContainer = document.getElementById( 'filenameContainer' );

			// 2nd group: show only when 1+ files
			fileListContainer.hidden = pendingFiles.length < 1;

			// 3rd group: show only when exactly 1 file
			filenameContainer.hidden = pendingFiles.length !== 1;
		};

		form.elements.files.addEventListener( 'change', function( e ) {
			let added = Array.prototype.slice.call( e.target.files );
			let seen = {};
			pendingFiles.forEach( function( f ) { seen[fileFingerprint( f )] = true; } );
			added.forEach( function( f ) {
				let fp = fileFingerprint( f );
				if( ! seen[fp] ) {
					seen[fp] = true;
					pendingFiles.push( f );
				}
			} );
			e.target.value = '';
			refreshUploadFileList();
		} );

		fileListEl.addEventListener( 'click', function( e ) {
			let btn = e.target.closest( '[data-upload-remove]' );
			if( ! btn ) return;
			e.preventDefault();
			let i = parseInt( btn.getAttribute( 'data-upload-remove' ), 10 );
			if( i >= 0 && i < pendingFiles.length ) {
				pendingFiles.splice( i, 1 );
				refreshUploadFileList();
			}
		} );

		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'buttonUpload':
					e.preventDefault();
					let newfilename = form.elements.newfilename.value;
					let files = pendingFiles.slice();
					if( files.length === 0 ) {
						self.showMessage( self.i18n.upload_no_file, 'e' );
						return;
					}
					let existing_files;
					if (files.length > 1)
						existing_files = files.map(x => x.name).filter(item => self.fileCache.map(x => x.name).includes(item));
					else if (newfilename)
						existing_files = self.fileCache.map(x => x.name).indexOf(newfilename) !== -1 ? [newfilename] : [];
					else 
						existing_files = self.fileCache.map(x => x.name).indexOf(files[0].name) !== -1 ? [files[0].name] : [];
					if (existing_files.length > 0 && self.config.confirmoverwrite)
						self.showUploadConfirmOverwrite(files, existing_files, newfilename);
					else {
						if (files.length == 1)
							self.uploadFile(files[0], newfilename);
						else
							files.forEach( function( file ) {
								self.uploadFile( file );
							});
					}
					self.hideModal();
					break;
				case 'buttonCancel':
					e.preventDefault();
					self.hideModal();
					break;
			}
		});
	};

	this.showUploadConfirmOverwrite = function(files, existing_files, newfilename=undefined) {
		self.showModal(Mustache.render(self.templates.uploadconfirmoverwrite, {files: existing_files, i18n: self.i18n}));
		let form = document.forms.formUploadConfirmOverwrite;
		form.addEventListener('click', function(e) {
			switch (e.target.id) {
				case 'buttonConfirm':
					e.preventDefault();
					if (files.length == 1 && newfilename)
						self.uploadFile(files[0], newfilename);
					else
						files.forEach(function(file) {
							self.uploadFile(file);
						});
					self.hideModal();
					break;
				case 'buttonCancel':
					e.preventDefault();
					self.hideModal();
					break;
			}
		});
	};

	/**
	 * Show the remote upload dialog
	 */
	this.showRemoteUploadDialog = function() {
		self.showModal( Mustache.render( self.templates.remoteupload, { i18n: self.i18n } ) );
		let form = document.forms.formRemoteUpload;
		let urlChangeHandler = function( e ) {
			let basename = e.target.value.split( '/' ).pop().split( '?' )[0].split( '#' )[0];
			if( !basename ) return;
			let existingNames = self.fileCache.map( x => x.name );
			let finalName = basename;
			let counter = 1;
			let dotIdx = basename.lastIndexOf( '.' );
			while( existingNames.includes( finalName ) ) {
				finalName = dotIdx > 0
					? basename.substr( 0, dotIdx ) + ' (' + counter + ')' + basename.substr( dotIdx )
					: basename + ' (' + counter + ')';
				counter++;
			}
			form.elements.filename.value = finalName;
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
			switch (e.target.id) {
				case 'buttonUpload':
					e.preventDefault();
					self.remoteUpload( form.elements.url.value, form.elements.filename.value, form.elements.method.value );
					self.hideModal();
					break;
				case 'buttonCancel':
					e.preventDefault();
					self.hideModal();
					break;
			}
		});
	};

	/**
	 * Shows the ajax request dialog
	 */
	this.showAjaxRequestDialog = function() {
		self.showModal( Mustache.render( self.templates.ajaxrequest, { i18n: self.i18n } ) );
		let form = document.forms.formAjaxRequest;
		let dataContainer = document.getElementById( 'ajaxDataContainer' );

		let updateDataVisibility = function() {
			dataContainer.hidden = form.elements.arMethod.value !== 'POST';
		};
		Array.from( form.elements.arMethod ).forEach( function( r ) {
			r.addEventListener( 'change', updateDataVisibility );
		});
		updateDataVisibility();

		form.elements.ajaxurl.addEventListener( 'keypress', self.preventEnter );
		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'buttonRequest':
					e.preventDefault();
					let data = form.elements.arMethod.value === 'POST' ? form.elements.ajaxdata.value.replace( /\n/g, '&' ) : '';
					self.ajaxRequest( form.elements.ajaxurl.value, data, form.elements.arMethod.value );
					break;
				case 'buttonClose':
					e.preventDefault();
					self.hideModal();
					break;
			}
		});
	};

	/**
	 * Shows the search dialog
	 */
	this.showSearchDialog = function() {
		self.showModal( Mustache.render( self.templates.search, { lastSearch: self.search.lastSearch, i18n: self.i18n } ) );

		let updateResults = function( data ) {
			self.log( 'updated search results' );
			let searchresults = document.getElementById( 'searchResults' );
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

		let performSearch = function( pattern ) {
			if( !pattern || pattern.trim() === '' ) return;
			document.getElementById( 'searchResults' ).tBodies[0].innerHTML = '<tr><td style="text-align:center;"><span class="icon fa fa-spinner fa-spin"></span></td></tr>';
			self.search.lastSearch = pattern;
			$.ajax({
				url: self.api,
				type: "POST",
				data: {
					api: "searchItems",
					dir: self.currentDir,
					pattern: pattern
				},
				dataType: "json",
				success: function( data ) {
					if( data.status == 'ERROR' ) {
						self.hideModal();
						self.showMessage( data.message, "e" );
					} else {
						data.forEach( function(e) {
							e.folder = ( e.name.substr( 0, e.name.lastIndexOf( '/' ) ) ) ? e.name.substr( 0, e.name.lastIndexOf( '/' ) ) : '/';
							e.linkname = e.name.substr( e.name.lastIndexOf( '/' ) + 1 );
						});
						self.search.data = data;
						if( self.search.data ) self.search.data.currentDir = self.currentDir;
						updateResults( data );
					}
				}
			});
		};

		document.getElementById( 'searchPattern' ).addEventListener( 'keypress', function( e ) {
			if( e.key == 'Enter' ) {
				e.preventDefault();
				performSearch( e.target.value );
			}
		});

		document.getElementById( 'buttonSearch' ).addEventListener( 'click', function() {
			performSearch( document.getElementById( 'searchPattern' ).value );
		});
	};

	/**
	 * Shows the create archive dialog
	 */
	this.showCreateArchiveDialog = function( items ) {
		self.showModal( Mustache.render( self.templates.createarchive, { i18n: self.i18n } ) );

		let form = document.forms.formCreateArchive;
		form.elements.archivename.addEventListener( 'keypress', function( e ) {
			if( e.key == 'Enter' ) {
				e.preventDefault();
				if( self.createArchive( items, e.target.value ) )
					self.hideModal();
			}
		});
		form.addEventListener( 'click', function( e ) {
			switch (e.target.id) {
				case 'buttonSave':
					e.preventDefault();
					if( self.createArchive( items, form.elements.archivename.value ) )
						self.hideModal();
					break;
				case 'buttonCancel':
					e.preventDefault();
					self.hideModal();
					break;
			}
		}, false );
	};

});
