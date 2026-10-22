/**
 * Per-row enrichment ported from IFM.rebuildFileTable (src/ifm.js).
 *
 * Pure functions over backend item objects; the Vue table renders their
 * output instead of Mustache templates.
 */

import { formatDate, generateGuid, hrefEncode, isEditable, isExtractable, pathCombine, showImagePreview } from './helpers.js';

export function enrichItems(items, ctx) {
    const { config, currentDir, apiBase, isMobile } = ctx;
    return items.map((item) => {
        const out = enrichItem(item, { config, currentDir, apiBase, isMobile });
        out.guid = generateGuid();
        return out;
    });
}

export function enrichItem(item, { config, currentDir, apiBase, isMobile }) {
    const out = { ...item };
    out.linkname = out.name === '..' ? '[ up ]' : out.name;
    if (out.name === '..') out.fixtop = 100;
    out.download = { name: out.name === '..' ? '.' : out.name };
    out.lastmodified_hr = formatDate(out.lastmodified, {
        customFormat: config.customDateFormat || undefined,
    });
    if (!config.chmod) out.readonly = 'readonly';
    if (config.edit || config.rename || config.delete || config.extract || config.copymove) {
        out.ftbuttons = true;
        out.button = [];
    }
    if (out.type === 'dir') {
        if (config.download && config.zipnload) {
            out.download.action = 'zipnload';
            out.download.icon = 'icon fa fa-fw fa-cloud-download';
        }
        out.rowclasses = 'isDir';
    } else {
        if (config.download) {
            out.download.action = 'download';
            out.download.icon = 'icon fa fa-fw fa-download';
        }
        if (showImagePreview(out, isMobile)) out.popover = true;
        if (isExtractable(out, config)) {
            out.eaction = 'extract';
            out.button.push({ action: 'extract', icon: 'icon fa fa-fw fa-file-archive-o', title: 'extract' });
        } else if (isEditable(out, config)) {
            out.eaction = 'edit';
            out.button.push({ action: 'edit', icon: 'icon fa fa-fw fa-pencil', title: 'edit' });
        }
    }
    if (out.download.action) {
        out.download.link =
            `${apiBase}?api=${out.download.action}` +
            `&dir=${hrefEncode(currentDir)}&filename=${hrefEncode(out.download.name)}`;
    }
    out.link = buildItemLink(out, { config, currentDir, apiBase });
    if (!['.', '..'].includes(out.name)) {
        out.dragdrop = true;
        if (config.copymove) {
            out.button.push({ action: 'copymove', icon: 'icon fa fa-fw fa-files-o', title: 'copy/move' });
        }
        if (config.rename) {
            out.button.push({ action: 'rename', icon: 'icon fa fa-fw fa-terminal', title: 'rename' });
        }
        if (config.delete) {
            out.button.push({ action: 'delete', icon: 'icon fa fa-fw fa-trash', title: 'delete' });
        }
    }
    return out;
}

/**
 * Direct-click link for a row (legacy rebuildFileTable link logic).
 *
 * Note: the legacy code passes `window.location.path` (which is undefined in
 * browsers, so pathCombine drops it) as the first segment of the isDocroot
 * branch. The effective legacy output is therefore the relative
 * `currentDir/name` href-encoded as a whole; this port computes exactly that.
 */
export function buildItemLink(item, { config, currentDir, apiBase }) {
    if (config.isDocroot && !config.forceproxy) {
        return hrefEncode(pathCombine(currentDir, item.name));
    }
    if (config.download && config.zipnload) {
        if (config.root_public_url) {
            if (config.root_public_url.charAt(0) === '/') {
                return pathCombine(
                    window.location.origin,
                    config.root_public_url,
                    hrefEncode(currentDir),
                    hrefEncode(item.name),
                );
            }
            return pathCombine(
                config.root_public_url,
                hrefEncode(currentDir),
                hrefEncode(item.name),
            );
        }
        const action = item.download && item.download.action === 'zipnload' ? 'zipnload' : 'proxy';
        return (
            `${apiBase}?api=${action}` +
            `&dir=${hrefEncode(currentDir)}&filename=${hrefEncode(item.download.name)}`
        );
    }
    return '#';
}

/** Absolute URL for the context-menu "copy link" action (legacy copylink handler). */
export function buildAbsoluteLink(clickedLink, { origin, pathnameDir }) {
    if (clickedLink.toLowerCase().substr(0, 4) === 'http') return clickedLink;
    if (pathnameDir && pathnameDir.length > 0) {
        return pathCombine(origin, pathnameDir, clickedLink);
    }
    return pathCombine(origin, clickedLink);
}

/** Image-preview source for the hover popover (legacy drawCallback handler). */
export function previewSrc(item, { config, currentDir, apiBase }) {
    if (config.isDocroot) {
        return encodeURI(pathCombine(currentDir, item.name)).replace(/#/g, '%23').replace(/\?/g, '%3F');
    }
    return `${apiBase}?api=proxy&dir=${encodeURIComponent(currentDir)}&filename=${encodeURIComponent(item.name)}`;
}
