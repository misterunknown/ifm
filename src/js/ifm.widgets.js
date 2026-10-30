/**
 * Reusable pieces of UI: modals, toasts, the folder tree and the context menu,
 * plus the task queue in the footer.
 *
 * Part of the IFM object; see ifm.core.js for how the parts are applied.
 */
IFM.parts.push( function( self ) {

	/**
	 * Shows a bootstrap modal
	 *
	 * @param {string} content - HTML content of the modal
	 * @param {object} options - options for the modal ({ large: false })
	 */
	this.showModal = function( content, options, modal_options ) {
		options = options || {};
		let modal = document.createElement( 'div' );
		modal.classList.add( 'modal' );
		modal.id = 'ifmmodal';
		// bootstrap needs a focusable container to handle ESC and focus trapping
		modal.setAttribute( 'tabindex', '-1' );
		modal.setAttribute( 'role', 'dialog' );
		let modalDialog = document.createElement( 'div' );
		modalDialog.classList.add( 'modal-dialog' );
		modalDialog.setAttribute( 'role', 'document' );
		if( options.large == true ) modalDialog.classList.add( 'modal-lg' );
		let modalContent = document.createElement('div');
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
				let target = $(this).find('[autofocus]').first();
				if( !target.length ) target = $(this).find('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), button').first();
				if( target.length ) target.focus();
			})
			.modal(modal_options)
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

	// --------------------
	// helper functions
	// --------------------

	/**
	 * Folder tree for the copy/move dialog, built on bootstrap's list group.
	 *
	 * Nodes come from the getFolders API as { text, dataAttr: { path } } plus
	 * lazyLoad: true for the ones that have subfolders; children are fetched
	 * the first time a node is expanded.
	 */
	this.createFolderTree = function( mount, options ) {
		let selectedPath = null;

		let makeNode = function( node, level ) {
			let wrapper = document.createElement( 'div' );

			let row = document.createElement( 'div' );
			row.className = 'list-group-item list-group-item-action ifm-tree-node';
			row.style.paddingLeft = ( 0.5 + level * 1.25 ) + 'rem';
			row.dataset.path = node.dataAttr.path;
			row.setAttribute( 'role', 'treeitem' );

			let toggle = document.createElement( 'span' );
			toggle.className = 'icon fa fa-fw ifm-tree-toggle' + ( node.lazyLoad ? ' fa-plus-square' : '' );
			let label = document.createElement( 'span' );
			label.className = 'ifm-tree-label';
			label.textContent = node.text;
			row.appendChild( toggle );
			row.appendChild( label );

			let children = document.createElement( 'div' );
			children.className = 'list-group ifm-tree-children';
			children.hidden = true;

			let loaded = false;
			toggle.addEventListener( 'click', function( e ) {
				if( !node.lazyLoad ) return;
				e.stopPropagation();
				if( loaded ) {
					children.hidden = !children.hidden;
					toggle.classList.toggle( 'fa-plus-square', children.hidden );
					toggle.classList.toggle( 'fa-minus-square-o', !children.hidden );
					return;
				}
				toggle.classList.remove( 'fa-plus-square' );
				toggle.classList.add( 'fa-spinner', 'fa-spin' );
				options.load( node.dataAttr.path, function( nodes ) {
					toggle.classList.remove( 'fa-spinner', 'fa-spin' );
					toggle.classList.add( 'fa-minus-square-o' );
					( nodes || [] ).forEach( function( child ) {
						children.appendChild( makeNode( child, level + 1 ) );
					});
					children.hidden = false;
					loaded = true;
				}, function() {
					toggle.classList.remove( 'fa-spinner', 'fa-spin' );
					toggle.classList.add( 'fa-plus-square' );
				});
			});

			row.addEventListener( 'click', function() {
				let active = mount.querySelector( '.ifm-tree-node.active' );
				if( active ) active.classList.remove( 'active' );
				row.classList.add( 'active' );
				selectedPath = node.dataAttr.path;
			});

			wrapper.appendChild( row );
			wrapper.appendChild( children );
			return wrapper;
		};

		mount.innerHTML = '';
		mount.classList.add( 'list-group' );
		mount.setAttribute( 'role', 'tree' );
		( options.nodes || [] ).forEach( function( node ) {
			mount.appendChild( makeNode( node, 0 ) );
		});

		return { selectedPath: function() { return selectedPath; } };
	};

	/**
	 * Context menu built on bootstrap's own dropdown markup.
	 *
	 * Takes the option shape of the unmaintained BootstrapMenu plugin it
	 * replaces - fetchElementData(row), actionsGroups, and actions with
	 * name/iconClass/isShown/onClick - so the action definitions stay as they
	 * are, but without its lodash and classnames dependencies.
	 */
	this.createContextMenu = function( selector, options ) {
		let menu = document.createElement( 'div' );
		menu.className = 'dropdown-menu ifm-contextmenu';
		menu.setAttribute( 'role', 'menu' );
		document.body.appendChild( menu );

		let close = function() { menu.classList.remove( 'show' ); };

		// returns the number of entries that ended up in the menu
		let build = function( data ) {
			menu.innerHTML = '';
			let keys = Object.keys( options.actions );
			let groups = ( options.actionsGroups || [] ).slice();
			let listed = groups.reduce( function( all, g ) { return all.concat( g ); }, [] );
			let ungrouped = keys.filter( function( k ) { return listed.indexOf( k ) === -1; } );
			if( ungrouped.length ) groups.push( ungrouped );

			let count = 0;
			groups.forEach( function( group ) {
				let visible = group.filter( function( key ) {
					let action = options.actions[key];
					return action && ( typeof action.isShown !== 'function' || action.isShown( data ) );
				});
				if( !visible.length ) return;
				if( count ) menu.appendChild( document.createElement( 'hr' ) ).className = 'dropdown-divider';
				visible.forEach( function( key ) {
					let action = options.actions[key];
					let entry = document.createElement( 'button' );
					entry.type = 'button';
					entry.className = 'dropdown-item';
					entry.innerHTML = ( action.iconClass ? '<span class="' + action.iconClass + '"></span> ' : '' )
						+ ( typeof action.name === 'function' ? action.name( data ) : action.name );
					entry.addEventListener( 'click', function( e ) {
						e.preventDefault();
						close();
						action.onClick( data );
					});
					menu.appendChild( entry );
					count++;
				});
			});
			return count;
		};

		document.addEventListener( 'contextmenu', function( e ) {
			let row = e.target.closest ? e.target.closest( selector ) : null;
			if( !row ) return;
			if( !build( options.fetchElementData( row ) ) ) return;
			e.preventDefault();

			// show it first so it can be measured, then keep it in the viewport
			menu.style.left = '0px';
			menu.style.top = '0px';
			menu.classList.add( 'show' );
			let width = menu.offsetWidth, height = menu.offsetHeight;
			menu.style.left = Math.max( 0, Math.min( e.clientX, window.innerWidth - width - 4 ) ) + 'px';
			menu.style.top = Math.max( 0, Math.min( e.clientY, window.innerHeight - height - 4 ) ) + 'px';
		});
		document.addEventListener( 'click', close );
		document.addEventListener( 'scroll', close, true );
		window.addEventListener( 'resize', close );
		document.addEventListener( 'keydown', function( e ) { if( e.key == 'Escape' ) close(); } );

		return menu;
	};

	/**
	 * Shows a notification
	 *
	 * @param string m - message text
	 * @param string t - message type (e: error, s: success)
	 */
	this.showMessage = function(m, t) {
		let msgType = ( t == "e" ) ? "danger" : ( t == "s" ) ? "success" : "info";
		let container = document.getElementById( 'ifmtoasts' );
		if( !container ) {
			container = document.createElement( 'div' );
			container.id = 'ifmtoasts';
			container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
			document.body.appendChild( container );
		}

		let toast = document.createElement( 'div' );
		toast.className = 'toast align-items-center border-0 text-bg-' + msgType;
		toast.setAttribute( 'role', 'alert' );
		toast.setAttribute( 'aria-live', ( t == "e" ) ? 'assertive' : 'polite' );
		toast.setAttribute( 'aria-atomic', 'true' );
		let flex = document.createElement( 'div' );
		flex.className = 'd-flex';
		let body = document.createElement( 'div' );
		body.className = 'toast-body';
		body.innerHTML = m;
		let close = document.createElement( 'button' );
		close.type = 'button';
		close.className = 'btn-close btn-close-white me-2 m-auto';
		close.setAttribute( 'data-bs-dismiss', 'toast' );
		close.setAttribute( 'aria-label', self.i18n.close || 'Close' );
		flex.appendChild( body );
		flex.appendChild( close );
		toast.appendChild( flex );
		container.appendChild( toast );

		// bootstrap pauses the timer while the toast is hovered or focused
		toast.addEventListener( 'hidden.bs.toast', function() { toast.remove(); } );
		new bootstrap.Toast( toast, { delay: 3000 } ).show();
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
			let newFooter = self.getNodeFromString( Mustache.render( self.templates.footer, { i18n: self.i18n } ) );
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
		let wq = document.getElementById( 'waitqueue' );
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
		let wq = document.getElementById( 'waitqueue' );
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
		let progress_el = document.getElementById( 'wq-'+id ).getElementsByClassName( 'progress' )[0];
		progress_el.getElementsByClassName( 'progress-bar' )[0].style.width = progress+'%';
		// in bootstrap 5.3 the aria state lives on .progress, not on the bar
		progress_el.setAttribute( 'aria-valuenow', progress );
	};

});
