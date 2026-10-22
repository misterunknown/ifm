/**
 * Pure helper functions ported 1:1 from src/ifm.js and src/main.php.
 *
 * These carry no Vue or DOM dependencies so they are unit-tested with vitest.
 * Behavioral oracle: the legacy implementation in this same repository.
 */

export function pathCombine(...args) {
    if (args.length === 0) return '';
    args = args.filter((x) => typeof x === 'string' && x !== '');
    if (args.length === 0) return '';
    let first = '';
    while (first.length < 1) first = args.shift();
    first = first.replace(/\/+$/g, '');
    if (!args.length) return first;
    args.forEach((v, i) => (args[i] = v.replace(/^\/*|\/*$/g, '')));
    args.unshift(first);
    return args.join('/');
}

export function hrefEncode(s) {
    return s
        .replace(/%/g, '%25')
        .replace(/;/g, '%3B')
        .replace(/\?/g, '%3F')
        .replace(/:/g, '%3A')
        .replace(/@/g, '%40')
        .replace(/&/g, '%26')
        .replace(/=/g, '%3D')
        .replace(/\+/g, '%2B')
        .replace(/\$/g, '%24')
        .replace(/,/g, '%2C')
        .replace(/</g, '%3C')
        .replace(/>/g, '%3E')
        .replace(/#/g, '%23')
        .replace(/"/g, '%22')
        .replace(/{/g, '%7B')
        .replace(/}/g, '%7D')
        .replace(/\|/g, '%7C')
        .replace(/\^/g, '%5E')
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D')
        .replace(/\\/g, '%5C')
        .replace(/`/g, '%60');
}

export function generateGuid() {
    let result = '';
    for (let j = 0; j < 20; j++) {
        result += Math.floor(Math.random() * 16).toString(16).toUpperCase();
    }
    return result;
}

export function customStrftime(date, format) {
    const pad = (num, size = 2) => String(num).padStart(size, '0');
    const replacements = {
        '%Y': date.getFullYear(),
        '%m': pad(date.getMonth() + 1),
        '%d': pad(date.getDate()),
        '%H': pad(date.getHours()),
        '%M': pad(date.getMinutes()),
        '%S': pad(date.getSeconds()),
        '%y': String(date.getFullYear()).slice(-2),
    };
    return format.replace(/%[a-zA-Z]/g, (match) => replacements[match] ?? match);
}

export function formatDate(timestamp, opts = {}) {
    const d = new Date(timestamp * 1000);
    if (opts.customFormat) return customStrftime(d, opts.customFormat);
    return d.toLocaleString(opts.locale || 'en-US');
}

/**
 * Case-insensitive natural-order comparison, matching PHP strnatcasecmp()
 * used by the backend to sort directory listings.
 */
export function natcasecmp(a, b) {
    const chunk = (s) => s.toLowerCase().match(/\d+|\D+/g) || [];
    const ax = chunk(a);
    const bx = chunk(b);
    const len = Math.max(ax.length, bx.length);
    for (let i = 0; i < len; i++) {
        if (i >= ax.length) return -1;
        if (i >= bx.length) return 1;
        if (ax[i] === bx[i]) continue;
        const an = /^\d+$/.test(ax[i]);
        const bn = /^\d+$/.test(bx[i]);
        if (an && bn) {
            const diff = parseInt(ax[i], 10) - parseInt(bx[i], 10);
            if (diff !== 0) return diff < 0 ? -1 : 1;
            return ax[i] < bx[i] ? -1 : 1;
        }
        return ax[i] < bx[i] ? -1 : 1;
    }
    return 0;
}

/** Archive extensions the backend can extract (frontend "extract" affordance). */
export const EXTRACTABLE_EXTS = ['zip', 'tar', 'tgz', 'tar.gz', 'tar.xz', 'tar.bz2'];

/** Archive formats accepted by the create-archive dialog. */
export const CREATE_ARCHIVE_FORMATS = ['.tar.bz2', '.tar.gz', '.zip', '.tar'];

/** Returns the backend `format` value for an archive name, or null if invalid. */
export function detectArchiveFormat(archivename) {
    const type = CREATE_ARCHIVE_FORMATS.find((ext) => archivename.toLowerCase().endsWith(ext));
    return type ? type.slice(1) : null;
}

/** Suggested extraction target dir for a file name (legacy showExtractFileDialog). */
export function suggestExtractDir(filename) {
    return filename.lastIndexOf('.') > 1 ? filename.substr(0, filename.lastIndexOf('.')) : filename;
}

/** Suggested remote-upload filename: URL basename, deduplicated against existing names. */
export function suggestRemoteFilename(url, existingNames) {
    const basename = url.split('/').pop().split('?')[0].split('#')[0];
    if (!basename) return '';
    let finalName = basename;
    let counter = 1;
    const dotIdx = basename.lastIndexOf('.');
    while (existingNames.includes(finalName)) {
        finalName =
            dotIdx > 0
                ? basename.substr(0, dotIdx) + ' (' + counter + ')' + basename.substr(dotIdx)
                : basename + ' (' + counter + ')';
        counter++;
    }
    return finalName;
}

/** Split a backend search-result name into folder + link name (legacy showSearchDialog). */
export function splitSearchName(name) {
    const idx = name.lastIndexOf('/');
    return {
        folder: idx >= 0 && name.substr(0, idx) ? name.substr(0, idx) : '/',
        linkname: name.substr(idx + 1),
    };
}

/**
 * Whether the file row gets the "edit" action (legacy rebuildFileTable).
 * Mirrors the MIME gate exactly, including the disable_mime_detection bypass.
 */
export function isEditable(item, config) {
    if (!config.edit) return false;
    if (config.disable_mime_detection) return true;
    return (
        typeof item.mime_type === 'string' &&
        (item.mime_type.substr(0, 4) === 'text' ||
            item.mime_type.indexOf('x-empty') !== -1 ||
            item.mime_type.indexOf('xml') !== -1 ||
            item.mime_type.indexOf('json') !== -1)
    );
}

/** Whether the file row gets the "extract" action (legacy rebuildFileTable). */
export function isExtractable(item, config) {
    return !!config.extract && EXTRACTABLE_EXTS.includes(item.ext);
}

/** Whether the file row shows the image-preview popover (desktop only). */
export function showImagePreview(item, isMobile) {
    return item.icon && item.icon.indexOf('file-image') !== -1 && isMobile === false;
}
