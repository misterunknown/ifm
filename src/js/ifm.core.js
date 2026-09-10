// desktop browsers do not support window.orientation
const ISMOBILE = typeof window.orientation !== 'undefined';

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
	this.contextMenu = null; // Reference for the context menu
	this.filetableHead = null; // pristine <thead> markup of the file table

	// Hang the feature parts (the other ifm.*.js files) on this instance. They
	// are plain functions receiving the instance, so everything they define
	// keeps the closure it had when this was a single 2500 line file.
	IFM.parts.forEach( function( part ) { part.call( self, self ); } );

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
				// send the CSRF token with every POST request
				if( self.config.csrf_token ) {
					$.ajaxPrefilter( function( options ) {
						if( options.type && options.type.toUpperCase() === "POST" ) {
							options.headers = options.headers || {};
							options.headers['X-IFM-CSRF'] = self.config.csrf_token;
						}
					} );
				}
				// when ace comes from a CDN it can pull themes and modes from there
				// on demand; the self-contained build has to make do with what
				// was compiled into it
				let aceScript = document.querySelector( 'script[src*="/ace.min.js"], script[src*="/ace.js"]' );
				if( aceScript && window.ace && ace.config )
					ace.config.set( 'basePath', aceScript.src.replace( /\/ace(\.min)?\.js.*$/, '' ) );

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
				self.log("I18N loaded");
				self.initCheckAuth();
			},
			error: function() {
				throw new Error( self.i18n.load_text_error );
			}
		});
	};

	this.initCheckAuth = function() {
		$.ajax({
			url: self.api,
			type: "POST",
			data: {
				api: "checkAuth"
			},
			dataType: "json",
			success: function(d) {
				if (d.status == "ERROR") {
					self.showModal(Mustache.render(self.templates.login, {i18n: self.i18n}), {large: true}, {
						backdrop: 'static',
						keyboard: false
					});
					var form = document.forms.loginForm;
					form.addEventListener('click', function(e) {
						e.preventDefault();
						if (e.target.id == "buttonLogin") {
							$.ajax({
								url: self.api,
								type: "POST",
								data: {
									api: "checkAuth",
									inputLogin: form.elements[0].value,
									inputPassword: form.elements[1].value
								},
								dataType: "json",
								success: function(e) {
									if (e.status != "ERROR") {
										self.hideModal();
										self.initApplication();
									} else {
										var errorlogin = document.getElementById('loginError');
										errorlogin.classList.remove("d-none");
										errorlogin.innerHTML = e.message;
									}

								},
								error: function(e) {
									var errorlogin = document.getElementById('loginError');
									errorlogin.classList.remove("d-none");
									errorlogin.innerHTML = "Authentication failed";
								}
							});
						}
					});
				} else {
					self.initApplication();
				}
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
					generic: {
						hasdropdown: (!!self.config.ajaxrequest||!!self.config.remoteupload||!!self.config.auth)
					},
					ftbuttons: function(){
						return ( self.config.edit || self.config.rename || self.config.delete || self.config.zipnload || self.config.extract );
					}
				});

		// keep the pristine table header: DataTables strips the cells of hidden
		// columns from the DOM and (unlike 1.x) does not put them back on
		// destroy(), so every rebuild has to start from this copy
		self.filetableHead = document.getElementById( 'filetable' ).tHead.innerHTML;

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
					let div = document.getElementById( 'filedropoverlay' );
					div.style.display = 'block';
					div.ondrop = function( e ) {
						e.preventDefault();
						e.stopPropagation();
						let files = Array.from(e.dataTransfer.files);
						let existing_files = files.map(x => x.name).filter(item => self.fileCache.map(x => x.name).includes(item));
						if (existing_files.length > 0 && self.config.confirmoverwrite)
							self.showUploadConfirmOverwrite(files, existing_files);
						else 
							files.forEach(function(file) {
								self.uploadFile(file);
							});
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
					let div = document.getElementById( 'filedropoverlay' );
					if( div.style.display == 'block' )
						div.stye.display == 'none';
				}
			});

		// drag and drop of filetable items
		if( self.config.copymove ) {
			let isFile = function(e) { return Array.prototype.indexOf.call(e.dataTransfer.types, "Files") != -1 };
			document.addEventListener( 'dragstart', function( e ) {
				let selectedItems = document.getElementsByClassName( 'selectedItem' );
				let data;
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
				let dragImage = document.createElement( 'div' );
				dragImage.style.display = 'inline';
				dragImage.style.padding = '10px';
				dragImage.innerHTML = '<span class="icon fa fa-folder-open-o"></span> '+self.i18n.move+' '+( data.length || data.name );
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
						let source = JSON.parse( e.dataTransfer.getData( 'text' ) );
						self.log( "source:" );
						self.log( source );
						let destination = self.fileCache.find( x => x.guid === e.target.firstElementChild.id );
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

		self.initThemeSwitcher();

		// load initial file table
		if( window.location.hash ) {
			self.changeDirectory( decodeURIComponent( window.location.hash.substring( 1 ) ) );
		} else {
			this.refreshFileTable();
		}
	};

	/**
	 * Color mode switcher, cycling system -> light -> dark.
	 *
	 * "system" follows prefers-color-scheme; an explicit choice is remembered in
	 * localStorage and applied by the inline script in the document head, so the
	 * page never renders in the wrong theme first.
	 */
	this.initThemeSwitcher = function() {
		let button = document.getElementById( 'buttonTheme' );
		if( !button ) return;

		let icons = { auto: 'fa-adjust', light: 'fa-sun-o', dark: 'fa-moon-o' };
		let stored = function() {
			try {
				let m = localStorage.getItem( 'ifm_theme' );
				return ( m === 'light' || m === 'dark' ) ? m : 'auto';
			} catch( e ) { return 'auto'; }
		};

		let apply = function( mode ) {
			let effective = ( mode === 'auto' )
				? ( window.matchMedia( '(prefers-color-scheme: dark)' ).matches ? 'dark' : 'light' )
				: mode;
			document.documentElement.dataset.bsTheme = effective;
			self.applyAceTheme();

			let icon = document.getElementById( 'buttonThemeIcon' );
			let label = document.getElementById( 'buttonThemeLabel' );
			let text = self.i18n['theme_'+mode] || self.i18n.theme;
			icon.className = 'fa fa-2x fa-fw ' + icons[mode];
			icon.title = text;
			if( label ) label.textContent = text;
		};

		button.onclick = function() {
			let next = { auto: 'light', light: 'dark', dark: 'auto' }[ stored() ];
			try {
				if( next === 'auto' ) localStorage.removeItem( 'ifm_theme' );
				else localStorage.setItem( 'ifm_theme', next );
			} catch( e ) {}
			apply( next );
		};

		// follow the system while no explicit choice is stored
		window.matchMedia( '(prefers-color-scheme: dark)' ).addEventListener( 'change', function() {
			if( stored() === 'auto' ) apply( 'auto' );
		});

		apply( stored() );
	};

	this.init = function(id) {
		self.rootElement = document.getElementById(id);
		this.initLoadConfig();
	};
}

// filled by the ifm.*.js parts, applied by the constructor above
IFM.parts = [];
