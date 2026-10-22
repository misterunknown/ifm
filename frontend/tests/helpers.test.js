/**
 * Unit tests for src/api/helpers.js.
 *
 * Oracle: the legacy implementation in src/ifm.js / src/main.php of this
 * same repository (pathCombine, hrefEncode, customStrftime, extract/upload
 * dialogs, archive validation, MIME edit gate). Vectors below are the legacy
 * semantics, not the new code's assumptions.
 */
import { describe, expect, it } from 'vitest';

process.env.TZ = 'UTC';

import {
    customStrftime,
    detectArchiveFormat,
    formatDate,
    generateGuid,
    hrefEncode,
    isEditable,
    isExtractable,
    natcasecmp,
    pathCombine,
    showImagePreview,
    splitSearchName,
    suggestExtractDir,
    suggestRemoteFilename,
} from '../src/api/helpers.js';

describe('pathCombine', () => {
    it('joins segments with single slashes', () => {
        expect(pathCombine('a', 'b')).toBe('a/b');
        expect(pathCombine('a/', '/b')).toBe('a/b');
        expect(pathCombine('a', 'b', 'c')).toBe('a/b/c');
    });
    it('drops empty and non-string segments like the legacy filter', () => {
        expect(pathCombine('', 'x')).toBe('x');
        expect(pathCombine(undefined, 'a')).toBe('a');
        expect(pathCombine()).toBe('');
        expect(pathCombine('', '')).toBe('');
    });
    it('keeps a leading slash of an absolute first segment', () => {
        expect(pathCombine('/', 'a')).toBe('/a');
        expect(pathCombine('/var/www', 'sub')).toBe('/var/www/sub');
    });
});

describe('hrefEncode', () => {
    it('encodes the legacy table and nothing else', () => {
        expect(hrefEncode('a#b?c&d=e+f')).toBe('a%23b%3Fc%26d%3De%2Bf');
        expect(hrefEncode('a/b')).toBe('a/b'); // slashes preserved
        expect(hrefEncode('a b')).toBe('a b'); // spaces preserved
        expect(hrefEncode('%')).toBe('%25');
        expect(hrefEncode('a"b{c}d[e]f\\g`h')).toBe('a%22b%7Bc%7Dd%5Be%5Df%5Cg%60h');
    });
});

describe('generateGuid', () => {
    it('produces 20 uppercase hex chars', () => {
        const g = generateGuid();
        expect(g).toMatch(/^[0-9A-F]{20}$/);
        expect(generateGuid()).not.toBe(g);
    });
});

describe('customStrftime / formatDate', () => {
    it('formats strftime tokens', () => {
        const d = new Date(2024, 5, 15, 10, 30, 5);
        expect(customStrftime(d, '%Y-%m-%d %H:%M:%S')).toBe('2024-06-15 10:30:05');
        expect(customStrftime(d, '%y')).toBe('24');
        expect(customStrftime(d, '%Q')).toBe('%Q'); // unknown tokens untouched
    });
    it('honours the customDateFormat config path', () => {
        expect(formatDate(0, { customFormat: '%Y-%m-%d' })).toBe('1970-01-01');
    });
});

describe('natcasecmp', () => {
    it('orders numerically like PHP strnatcasecmp', () => {
        expect(Math.sign(natcasecmp('file2', 'file10'))).toBe(-1);
        expect(Math.sign(natcasecmp('file10', 'file2'))).toBe(1);
        expect(natcasecmp('File', 'file')).toBe(0);
        expect(Math.sign(natcasecmp('a', 'b'))).toBe(-1);
        expect(Math.sign(natcasecmp('10', '9'))).toBe(1);
        expect(Math.sign(natcasecmp('a', 'a/b'))).toBe(-1);
    });
    it('sorts a listing the way the backend does', () => {
        const names = ['file10.txt', 'File2.txt', 'file1.txt', 'dir'];
        expect([...names].sort(natcasecmp)).toEqual(['dir', 'file1.txt', 'File2.txt', 'file10.txt']);
    });
});

describe('detectArchiveFormat', () => {
    it('accepts the four legacy formats case-insensitively', () => {
        expect(detectArchiveFormat('a.zip')).toBe('zip');
        expect(detectArchiveFormat('a.TAR.GZ')).toBe('tar.gz');
        expect(detectArchiveFormat('a.tar.bz2')).toBe('tar.bz2');
        expect(detectArchiveFormat('a.tar')).toBe('tar');
    });
    it('rejects anything else', () => {
        expect(detectArchiveFormat('a.rar')).toBeNull();
        expect(detectArchiveFormat('a.7z')).toBeNull();
        expect(detectArchiveFormat('zip')).toBeNull();
    });
});

describe('suggestExtractDir', () => {
    it('strips the last extension', () => {
        expect(suggestExtractDir('archive.tar.gz')).toBe('archive.tar');
        expect(suggestExtractDir('ab.zip')).toBe('ab');
        // single-char basenames keep the extension (legacy `> 1` check)
        expect(suggestExtractDir('a.zip')).toBe('a.zip');
    });
    it('leaves extensionless and dotfiles alone', () => {
        expect(suggestExtractDir('README')).toBe('README');
        expect(suggestExtractDir('.htaccess')).toBe('.htaccess');
    });
});

describe('suggestRemoteFilename', () => {
    it('takes the URL basename', () => {
        expect(suggestRemoteFilename('https://x.com/a.zip', [])).toBe('a.zip');
        expect(suggestRemoteFilename('https://x.com/a.zip?dl=1#frag', [])).toBe('a.zip');
    });
    it('dedupes against existing names like the legacy dialog', () => {
        expect(suggestRemoteFilename('https://x.com/a.zip', ['a.zip'])).toBe('a (1).zip');
        expect(suggestRemoteFilename('https://x.com/a.zip', ['a.zip', 'a (1).zip'])).toBe('a (2).zip');
        expect(suggestRemoteFilename('https://x.com/README', ['README'])).toBe('README (1)');
    });
    it('returns empty for a bare URL', () => {
        expect(suggestRemoteFilename('https://x.com/', [])).toBe('');
    });
});

describe('splitSearchName', () => {
    it('splits folder and link name', () => {
        expect(splitSearchName('sub/dir/f.txt')).toEqual({ folder: 'sub/dir', linkname: 'f.txt' });
        expect(splitSearchName('f.txt')).toEqual({ folder: '/', linkname: 'f.txt' });
    });
});

describe('isEditable', () => {
    const on = { edit: 1, disable_mime_detection: 0 };
    it('requires the edit flag', () => {
        expect(isEditable({ mime_type: 'text/plain' }, { edit: 0 })).toBe(false);
    });
    it('passes everything when mime detection is disabled', () => {
        expect(isEditable({ mime_type: 'image/png' }, { edit: 1, disable_mime_detection: 1 })).toBe(true);
    });
    it('applies the legacy MIME gate', () => {
        expect(isEditable({ mime_type: 'text/plain' }, on)).toBe(true);
        expect(isEditable({ mime_type: 'text/x-php' }, on)).toBe(true);
        expect(isEditable({ mime_type: 'application/json' }, on)).toBe(true);
        expect(isEditable({ mime_type: 'text/xml' }, on)).toBe(true);
        expect(isEditable({ mime_type: 'inode/x-empty' }, on)).toBe(true);
        expect(isEditable({ mime_type: 'image/png' }, on)).toBe(false);
        expect(isEditable({}, on)).toBe(false);
    });
});

describe('isExtractable', () => {
    it('matches the legacy extension list', () => {
        const cfg = { extract: 1 };
        for (const ext of ['zip', 'tar', 'tgz', 'tar.gz', 'tar.xz', 'tar.bz2']) {
            expect(isExtractable({ ext }, cfg)).toBe(true);
        }
        expect(isExtractable({ ext: 'rar' }, cfg)).toBe(false);
        expect(isExtractable({ ext: 'zip' }, { extract: 0 })).toBe(false);
    });
});

describe('showImagePreview', () => {
    it('shows only on desktop for image icons', () => {
        const img = { icon: 'icon fa fa-file-image-o' };
        expect(showImagePreview(img, false)).toBe(true);
        expect(showImagePreview(img, true)).toBe(false);
        expect(showImagePreview({ icon: 'icon fa fa-file-o' }, false)).toBe(false);
    });
});
