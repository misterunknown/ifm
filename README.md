# IFM - improved file manager
This is a filemanager based on the "[Easy PHP File Manager](http://epfm.misterunknown.de)". It is also a single file solution which uses HTML5, CSS3, JavaScript and PHP, so it's like a client server system where HTML5/CSS3/JavaScript is the client and the PHP API acts as an server. So it is more dynamic and produces less traffic than the EPFM.
The IFM comes with a embedded Version of [jQuery](http://jquery.com) and [CodeMirror](http://codemirror.net).
## requirements
Client
  * HTML5 and CSS3 compatible browser
  * activated JavaScript

Server
  * >= PHP 5.4
  * optional: cURL extention (for remote upload)

## installation
Just copy this ifm.php to your webspace - thats all :)

## configuration
The configuration array is located at the top of the script, so you can customize it as you like. The directives in the array are commented and named laconically. If you have questions anyway [write me an email](mailto:marco@misterunknown.de).

## security information
The IFM was developed with the assumption that the highest level of operation is the scripts own location. So it is neither possible to nagivate nor to use any API function above the script root.

The configuration is convenant for the client part (JavaScript: ifm.config) as well as for the API part (PHP: $config).

IT IS HIGHLY RECOMMENDED TO RESTRICT ACCESS TO THE SCRIPT E.G. USING THE APACHE AUTHENTICATION.

## references
I used some nice free icons in my script which I want to mention here:
  * file icons: [Free file icons by Teambox](https://github.com/teambox/Free-file-icons)
  * other icons: [Mono icons from tutorial9.net](http://www.tutorial9.net/downloads/108-mono-icons-huge-set-of-minimal-icons/)

## developers
written by Marco Dickert [(website)](http://misterunknown.de)
designed by Sebastian Langer [(website)](http://sebastianl.de)
