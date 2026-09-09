/**
 * The file listing: fetching it, rendering it through DataTables, navigating
 * directories and moving the highlight around.
 *
 * Part of the IFM object; see ifm.core.js for how the parts are applied.
 */
IFM.parts.push( function( self ) {

	/**
	 * Refreshes the file table
	 */
	this.refreshFileTable = function () {
		let taskid = self.generateGuid();
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
			self.showMessage( data.message, "e" );
			return;
		} else if ( ! Array.isArray( data ) ) {
			self.showMessage( self.i18n.invalid_data, "e" );
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
					item.download.icon = "icon fa fa-fw fa-cloud-download";
				}
				item.rowclasses = "isDir";
			} else {
				if( self.config.download ) {
					item.download.action = "download";
					item.download.icon = "icon fa fa-fw fa-download";
				}
				if ((item.icon.indexOf( 'file-image' ) !== -1) && (ISMOBILE == false)) {
					item.popover = 'data-bs-toggle="popover"';
				}
				if( self.config.extract && self.inArray( item.ext, ["zip","tar","tgz","tar.gz","tar.xz","tar.bz2"] ) ) {
					item.eaction = "extract";
					item.button.push({
						action: "extract",
						icon: "icon fa fa-fw fa-file-archive-o",
						title: "extract"
					});
				} else if(
					self.config.edit &&
					(
						self.config.disable_mime_detection ||
						(
							typeof item.mime_type === "string" && (
								item.mime_type.substr( 0, 4 ) == "text"
								|| item.mime_type.indexOf("x-empty") != -1
								|| item.mime_type.indexOf("xml") != -1
								|| item.mime_type.indexOf("json") != -1
							)
						)
					)
				) {
					item.eaction = "edit";
					item.button.push({
						action: "edit",
						icon: "icon fa fa-fw fa-pencil",
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
						item.link = self.pathCombine(window.location.origin, self.config.root_public_url, self.hrefEncode(self.currentDir), self.hrefEncode(item.name) );
					else
						item.link = self.pathCombine(self.config.root_public_url, self.hrefEncode(self.currentDir), self.hrefEncode(item.name) );
				} else
					item.link = self.api+"?api="+(item.download.action=="zipnload"?"zipnload":"proxy")+"&dir="+self.hrefEncode(self.currentDir)+"&filename="+self.hrefEncode(item.download.name);
			} else
				item.link = '#';
			if( ! self.inArray( item.name, [".", ".."] ) ) {
				item.dragdrop = 'draggable="true"';
				if( self.config.copymove )
					item.button.push({
						action: "copymove",
						icon: "icon fa fa-fw fa-files-o",
						title: "copy/move"
					});
				if( self.config.rename )
					item.button.push({
						action: "rename",
						icon: "icon fa fa-fw fa-terminal",
						title: "rename"
					});
				if( self.config.delete )
					item.button.push({
						action: "delete",
						icon: "icon fa fa-fw fa-trash",
						title: "delete"
					});
			}
		});

		// save items to file cache
		self.fileCache = data;


		let filetable = document.getElementById( 'filetable' );

		// tear the old table down before touching the DOM, then restore the
		// header it emptied out, so that the column count matches the rows we
		// are about to render
		if( self.datatable ) {
			self.datatable.destroy();
			self.datatable = null;
			filetable.tHead.innerHTML = self.filetableHead;
		}

		// build new tbody and replace the old one with the new
		let newTBody = Mustache.render( self.templates.filetable, { items: data, config: self.config, i18n: self.i18n, api: self.api } );
		filetable.tBodies[0].remove();
		filetable.append( document.createElement( 'tbody' ) );
		filetable.tBodies[0].innerHTML = newTBody;

		self.datatable = $('#filetable').DataTable({
			paging: !!self.config.paging,
			pageLength: self.config.pageLength||50,
			info: false,
			autoWidth: false,
			columnDefs: [
				{ "orderable": false, "targets": ["th-download","th-permissions","th-buttons"] }
			],
			orderFixed: [0, 'desc'],
			language: {
				"search": self.i18n.filter
			},
			stateSave: true,
			responsive: true,
			drawCallback: function() {
				// has to be jquery, since this is a bootstrap feature
				$( 'a[data-bs-toggle="popover"]' ).popover({
					content: function() {
						let item = self.fileCache.find( x => x.guid == $(this).attr('id') );
						let popover = document.createElement( 'img' );
						if( self.config.isDocroot )
							popover.src = encodeURI( self.pathCombine( self.currentDir, item.name ) ).replace( /#/g, '%23' ).replace( /\?/g, '%3F' );
						else
							popover.src = self.api + "?api=proxy&dir=" + encodeURIComponent( self.currentDir ) + "&filename=" + encodeURIComponent( item.name );
						popover.classList.add( 'imgpreview' );
						return popover;
					},
					animation: true,
					placement: 'bottom',
					trigger: 'hover',
					html: true
				});
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
				let item = self.fileCache.find( function( x ) { if( x.guid === e.target.parentElement.dataset.id ) return x; } );
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

		// as we cannot specify the rows for datatable responsive plugin, and it intercepts all the clicks, we ignore all browser actions and change directory manually
		$('#filetable tbody tr.isDir td a.ifmitem').on('click', function(e){
			e.stopPropagation();
			e.preventDefault();
			self.changeDirectory( e.target.parentElement.parentElement.dataset.filename );
		});

		if( self.config.contextmenu && !!( self.config.edit || self.config.extract || self.config.rename || self.config.copymove || self.config.download || self.config.delete ) ) {
			// the menu delegates from the document, so one instance covers every
			// table rebuild
			if( !self.contextMenu ) self.contextMenu = self.createContextMenu( '.clickable-row', {
				fetchElementData: function( row ) {
					// the row carries its guid in data-id; digging through the cell
					// tree instead used to break whenever the column layout changed
					let itemOf = function( tr ) { return self.fileCache.find( x => x.guid == tr.dataset.id ); };
					let data = {};
					data.selected =
						Array.prototype.slice.call( document.getElementsByClassName( 'selectedItem' ) )
						.map( itemOf ).filter( Boolean );
					data.clicked = itemOf( row );
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
						iconClass: "icon fa fa-fw fa-pencil",
						isShown: function( data ) {
							return !!( self.config.edit && data.clicked.eaction == "edit" && !data.selected.length );
						}
					},
					extract: {
						name: self.i18n.extract,
						onClick: function( data ) {
							self.showExtractFileDialog( data.clicked.name );
						},
						iconClass: "icon fa fa-fw fa-file-archive-o",
						isShown: function( data ) {
							return !!( self.config.extract && data.clicked.eaction == "extract" && !data.selected.length );
						}
					},
					rename: {
						name: self.i18n.rename,
						onClick: function( data ) {
							self.showRenameFileDialog( data.clicked.name );
						},
						iconClass: "icon fa fa-fw fa-terminal",
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
						iconClass: "icon fa fa-fw fa-external-link",
						isShown: function( data ) { return !!( !data.selected.length && data.clicked.name != ".." ); }
					},
					copymove: {
						name: function( data ) {
							if( data.selected.length > 0 )
								return self.i18n.copy+'/'+self.i18n.move+' <span class="badge text-bg-secondary">'+data.selected.length+'</span>';
							else
								return self.i18n.copy+'/'+self.i18n.move;
						},
						onClick: function( data ) {
							if( data.selected.length > 0 )
								self.showCopyMoveDialog( data.selected );
							else
								self.showCopyMoveDialog( data.clicked );
						},
						iconClass: "icon fa fa-fw fa-files-o",
						isShown: function( data ) { return !!( self.config.copymove && data.clicked.name != ".." ); }
					},
					download: {
						name: function( data ) {
							if( data.selected.length > 0 )
								return self.i18n.download+' <span class="badge text-bg-secondary">'+data.selected.length+'</span>';
							else
								return self.i18n.download;
						},
						onClick: function( data ) {
							if( data.selected.length > 0 )
								self.showMessage( "At the moment it is not possible to download a set of files." );
							else
								window.location = data.clicked.download.link;
						},
						iconClass: "icon fa fa-fw fa-download",
						isShown: function() { return !!self.config.download; }
					},
					createarchive: {
						name: function( data ) {
							if( data.selected.length > 0 )
								return self.i18n.create_archive+' <span class="badge text-bg-secondary">'+data.selected.length+'</span>';
							else
								return self.i18n.create_archive;
						},
						onClick: function( data ) {
							if( data.selected.length > 0 )
								self.showCreateArchiveDialog( data.selected );
							else
								self.showCreateArchiveDialog( data.clicked );
						},
						iconClass: "icon fa fa-fw fa-file-archive-o",
						isShown: function( data ) { return !!( self.config.createarchive && data.clicked.name != ".." ); }
					},
					delete: {
						name: function( data ) {
							if( data.selected.length > 0 )
								return self.i18n.delete+' <span class="badge text-bg-secondary">'+data.selected.length+'</span>';
							else
								return self.i18n.delete;
						},
						onClick: function( data ) {
							if( data.selected.length > 0 )
								self.showDeleteDialog( data.selected );
							else
								self.showDeleteDialog( data.clicked );
						},
						iconClass: "icon fa fa-fw fa-trash",
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
	 * Highlights an item in the file table
	 *
	 * @param object param - either an element id or a jQuery object
	 */
	this.highlightItem = function( direction ) {
		let highlight = function( el ) {
			[].slice.call( el.parentElement.children ).forEach( function( e ) {
				e.classList.remove( 'highlightedItem' );
			});
			el.classList.add( 'highlightedItem' );
			el.firstElementChild.firstElementChild.focus();
			if( ! self.isElementInViewport( el ) ) {
				let scrollOffset =  0;
				if( direction=="prev" )
					scrollOffset = el.offset().top - ( window.innerHeight || document.documentElement.clientHeight ) + el.height() + 15;
				else
					scrollOffset = el.offset().top - 55;
				$('html, body').animate( { scrollTop: scrollOffset }, 200 );
			}
		};


		let highlightedItem = document.getElementsByClassName( 'highlightedItem' )[0];
		if( ! highlightedItem ) {
			if( document.activeElement.classList.contains( 'ifmitem' ) )
				highlight( document.activeElement.parentElement.parentElement );
			else 
				highlight( document.getElementById( 'filetable' ).tBodies[0].firstElementChild );
		} else  {
			let newItem = ( direction=="next" ? highlightedItem.nextElementSibling : highlightedItem.previousElementSibling );
			if( newItem != null )
				highlight( newItem );
		}
	};

});
