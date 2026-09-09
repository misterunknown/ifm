/**
 * Keyboard shortcuts and the window-level handlers (history, unload).
 *
 * Part of the IFM object; see ifm.core.js for how the parts are applied.
 */
IFM.parts.push( function( self ) {

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
		let dir = "";
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
		let isFormElement = function( el ) {
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
		let element = document.getElementsByClassName( 'highlightedItem' )[0];
		if( element )
			item = self.fileCache.find( x => x.guid == element.dataset.id );
		else
			item = false;

		// Some operations do not work if the highlighted item is the parent
		// directory. In these cases the keybindings are ignored.
		let selectedItems = Array.prototype.slice.call( document.getElementsByClassName( 'selectedItem' ) )
			.map( function( e ) { return self.fileCache.find( x => x.guid === e.dataset.id ) } ).filter( Boolean );

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
					if( element.querySelector( 'a.ifmitem' ) == document.activeElement ) {
						e.preventDefault();
						element.classList.toggle( 'highlightedItem' );
					}
					return;
					break;
				case ' ':
				case 'Enter':
					if( element.querySelector( 'a.ifmitem' ) == document.activeElement ) { 
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

});
