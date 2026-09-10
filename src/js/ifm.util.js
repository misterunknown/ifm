/**
 * Small helpers with no state of their own.
 *
 * Part of the IFM object; see ifm.core.js for how the parts are applied.
 */
IFM.parts.push( function( self ) {

	/**
	 * Picks the ace theme that goes with the current interface theme.
	 *
	 * The list of themes and which of them are dark comes from ace itself
	 * (ext/themelist). In the self-contained build only the themes bundled
	 * into the file are usable, so the choice is narrowed down to those;
	 * the CDN build can load any of them on demand.
	 *
	 * @param {boolean} dark - whether the dark variant is wanted
	 * @returns {string|null} - e.g. "ace/theme/cloud_editor_dark"
	 */
	this.getAceTheme = function( dark ) {
		let preferred = dark ? 'cloud_editor_dark' : 'cloud_editor';
		let themes = [];
		try {
			themes = ace.require( 'ace/ext/themelist' ).themes || [];
		} catch( e ) {
			// no theme list: fall back to the pair that ships with IFM
			return 'ace/theme/' + preferred;
		}

		// the self-contained build only has what was compiled into it
		if( self.ace && self.ace.files && self.ace.files.length )
			themes = themes.filter( function( theme ) {
				return self.ace.files.indexOf( 'theme-' + theme.name ) !== -1;
			});
		if( !themes.length ) return null;

		let matching = themes.filter( function( theme ) { return !!theme.isDark === !!dark; } );
		// nothing for this side: take whatever there is rather than none
		if( !matching.length ) matching = themes;

		let chosen = matching.find( function( theme ) { return theme.name === preferred; } ) || matching[0];
		return chosen.theme;
	};

	/**
	 * Applies the ace theme matching the interface to the open editor, if any.
	 */
	this.applyAceTheme = function() {
		if( !self.editor ) return;
		let theme = self.getAceTheme( document.documentElement.dataset.bsTheme === 'dark' );
		if( theme ) self.editor.setTheme( theme );
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
		let args = Array.prototype.slice.call(arguments);
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
	 * Formats a date like strftime
	 *
	 * @param {Date} date - Date object
	 * @param {string} format - strftime compatible format string
	 * @returns {string} - formatted date
	 */
	this.customStrftime = function(date, format) {
		const pad = (num, size = 2) => String(num).padStart(size, '0');

		const replacements = {
			'%Y': date.getFullYear(),
			'%m': pad(date.getMonth() + 1),
			'%d': pad(date.getDate()),
			'%H': pad(date.getHours()),
			'%M': pad(date.getMinutes()),
			'%S': pad(date.getSeconds()),
			'%y': String(date.getFullYear()).slice(-2),
			'%b': date.toLocaleString('default', { month: 'short' }),
			'%B': date.toLocaleString('default', { month: 'long' }),
			'%a': date.toLocaleString('default', { weekday: 'short' }),
			'%A': date.toLocaleString('default', { weekday: 'long' }),
		};

		return format.replace(/%[a-zA-Z]/g, match => replacements[match] || match);
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
		for ( let i = 0; i < haystack.length; i++ )
			if( haystack[i] == needle )
				return true;
		return false;
	};

	/**
	 * Formats a date from an unix timestamp
	 *
	 * @param {integer} timestamp - UNIX timestamp
	 */
	this.formatDate = function(timestamp) {
		let d = new Date(timestamp * 1000)

		if (self.config.customDateFormat) {
			return self.customStrftime(d, self.config.customDateFormat)
		} else {
			return d.toLocaleString(navigator.language || "en-US");
		}
	};

	this.getClipboardLink = function( relpath ) {
		let link = window.location.origin;
		link += window.location.pathname.substr( 0, window.location.pathname.lastIndexOf( "/" ) );
		link = self.pathCombine( link, relpath );
		return link;
	}

	this.getNodeFromString = function( s ) {
		let template = document.createElement( 'template');
		template.innerHTML = s;
		return template.content.childNodes[0];
	};

	this.getNodesFromString = function( s ) {
		let template = document.createElement( 'template');
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
	 * Checks if an element is within the viewport
	 *
	 * @param object el - element object
	 */
	this.isElementInViewport = function( el ) {
		let rect = el.getBoundingClientRect();
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
		let result, i, j;
		result = '';
		for ( j = 0; j < 20; j++ ) {
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
	this.log = function(m) {
		if (self.config.debug) {
			console.log("IFM (debug): " + m);
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

});
