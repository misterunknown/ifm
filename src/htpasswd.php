<?php
/**
 * htpasswd parser
 */

class Htpasswd {
	public $users = [];

	public function __construct( $filename="" ) {
		if( $filename )
			$this->load( $filename );
	}

	/**
	 * Load a new htpasswd file
	 */
	public function load( $filename ) {
		unset( $this->users );
		if( file_exists( $filename ) && is_readable( $filename ) ) {
			$lines = file( $filename );
			foreach( $lines as $line ) {
				list( $user, $pass ) = explode( ":", $line );
				$this->users[$user] = trim( $pass );
			}
			return true;
		} else
			return false;
	}

	public function getUsers() {
		return array_keys( $this->users );
	}

	public function userExist( $user ) {
		return isset( $this->users[ $user ] );
	}

	public function verify( $user, $pass ) {
		if( isset( $this->users[$user] ) ) {
			return $this->verifyPassword( $pass, $this->users[$user] );
		} else {
			return false;
		}
	}

	public function verifyPassword( $pass, $hash ) {
		if( substr( $hash, 0, 4 ) == '$2y$' ) {
			return password_verify( $pass, $hash );
		} elseif( substr( $hash, 0, 6 ) == '$apr1$' ) {
			$apr1 = new APR1_MD5();
			return $apr1->check( $pass, $hash );
		} elseif( substr( $hash, 0, 5 ) == '{SHA}' ) {
			return base64_encode( sha1( $pass, TRUE ) ) == substr( $hash, 5 );
		} else { // assume CRYPT
			return crypt( $pass, $hash ) == $hash;
		}
	}
}

/**
 * APR1_MD5 class
 *
 * Source: https://github.com/whitehat101/apr1-md5/blob/master/src/APR1_MD5.php
 */
class APR1_MD5 {

    const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const APRMD5_ALPHABET = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    // Source/References for core algorithm:
    // http://www.cryptologie.net/article/126/bruteforce-apr1-hashes/
    // http://svn.apache.org/viewvc/apr/apr-util/branches/1.3.x/crypto/apr_md5.c?view=co
    // http://www.php.net/manual/en/function.crypt.php#73619
    // http://httpd.apache.org/docs/2.2/misc/password_encryptions.html
    // Wikipedia

    public static function hash($mdp, $salt = null) {
        if (is_null($salt))
            $salt = self::salt();
        $salt = substr($salt, 0, 8);
        $max = strlen($mdp);
        $context = $mdp.'$apr1$'.$salt;
        $binary = pack('H32', md5($mdp.$salt.$mdp));
        for($i=$max; $i>0; $i-=16)
            $context .= substr($binary, 0, min(16, $i));
        for($i=$max; $i>0; $i>>=1)
            $context .= ($i & 1) ? chr(0) : $mdp[0];
        $binary = pack('H32', md5($context));
        for($i=0; $i<1000; $i++) {
            $new = ($i & 1) ? $mdp : $binary;
            if($i % 3) $new .= $salt;
            if($i % 7) $new .= $mdp;
            $new .= ($i & 1) ? $binary : $mdp;
            $binary = pack('H32', md5($new));
        }
        $hash = '';
        for ($i = 0; $i < 5; $i++) {
            $k = $i+6;
            $j = $i+12;
            if($j == 16) $j = 5;
            $hash = $binary[$i].$binary[$k].$binary[$j].$hash;
        }
        $hash = chr(0).chr(0).$binary[11].$hash;
        $hash = strtr(
            strrev(substr(base64_encode($hash), 2)),
            self::BASE64_ALPHABET,
            self::APRMD5_ALPHABET
        );
        return '$apr1$'.$salt.'$'.$hash;
    }

    // 8 character salts are the best. Don't encourage anything but the best.
    public static function salt() {
        $alphabet = self::APRMD5_ALPHABET;
        $salt = '';
        for($i=0; $i<8; $i++) {
            $offset = hexdec(bin2hex(openssl_random_pseudo_bytes(1))) % 64;
            $salt .= $alphabet[$offset];
        }
        return $salt;
    }

    public static function check($plain, $hash) {
        $parts = explode('$', $hash);
        return self::hash($plain, $parts[2]) === $hash;
    }
}
