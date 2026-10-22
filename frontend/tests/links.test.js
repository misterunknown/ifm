/**
 * Unit tests for src/api/fileLinks.js.
 *
 * Oracle: IFM.rebuildFileTable in src/ifm.js — row enrichment, the download
 * href, the direct-click href matrix, the copylink absolute URL, and the
 * image-preview source.
 */
import { describe, expect, it } from 'vitest';

globalThis.window = { location: { origin: 'https://files.test' } };

import { buildAbsoluteLink, buildItemLink, enrichItem, previewSrc } from '../src/api/fileLinks.js';

const API = 'https://files.test/index.php';

function baseConfig(over = {}) {
    return {
        chmod: 1,
        edit: 1,
        rename: 1,
        delete: 1,
        extract: 1,
        copymove: 1,
        download: 1,
        zipnload: 1,
        disable_mime_detection: 0,
        isDocroot: false,
        forceproxy: 0,
        root_public_url: '',
        ...over,
    };
}

describe('enrichItem', () => {
    it('marks the parent entry like the legacy table', () => {
        const out = enrichItem(
            { name: '..', type: 'dir', icon: 'icon fa fa-angle-up' },
            { config: baseConfig(), currentDir: 'sub', apiBase: API, isMobile: false },
        );
        expect(out.linkname).toBe('[ up ]');
        expect(out.fixtop).toBe(100);
        expect(out.download.name).toBe('.');
        expect(out.rowclasses).toBe('isDir');
        expect(out.button).toEqual([]); // no actions for ".."
        expect(out.dragdrop).toBeUndefined();
    });

    it('gives directories the zipnload download action', () => {
        const out = enrichItem(
            { name: 'docs', type: 'dir', icon: 'icon fa fa-folder-o' },
            { config: baseConfig(), currentDir: '', apiBase: API, isMobile: false },
        );
        expect(out.download.action).toBe('zipnload');
        expect(out.download.link).toBe(`${API}?api=zipnload&dir=&filename=docs`);
    });

    it('gives editable text files the edit action and full buttons', () => {
        const out = enrichItem(
            { name: 'notes.txt', type: 'file', icon: 'icon fa fa-file-text-o', ext: 'txt', mime_type: 'text/plain' },
            { config: baseConfig(), currentDir: '', apiBase: API, isMobile: false },
        );
        expect(out.eaction).toBe('edit');
        expect(out.download.action).toBe('download');
        expect(out.download.link).toBe(`${API}?api=download&dir=&filename=notes.txt`);
        expect(out.button.map((b) => b.action)).toEqual(['edit', 'copymove', 'rename', 'delete']);
    });

    it('prefers extract over edit for archives', () => {
        const out = enrichItem(
            { name: 'a.zip', type: 'file', icon: 'icon fa fa-file-archive-o', ext: 'zip', mime_type: 'application/zip' },
            { config: baseConfig(), currentDir: '', apiBase: API, isMobile: false },
        );
        expect(out.eaction).toBe('extract');
        expect(out.button[0].action).toBe('extract');
    });

    it('honours chmod/permission flags', () => {
        const out = enrichItem(
            { name: 'f.txt', type: 'file', icon: 'x', ext: 'txt', mime_type: 'text/plain' },
            { config: baseConfig({ chmod: 0, copymove: 0, rename: 0, delete: 0 }), currentDir: '', apiBase: API, isMobile: false },
        );
        expect(out.readonly).toBe('readonly');
        expect(out.button.map((b) => b.action)).toEqual(['edit']);
    });

    it('sets the image popover flag on desktop only', () => {
        const item = { name: 'p.png', type: 'file', icon: 'icon fa fa-file-image-o', ext: 'png', mime_type: 'image/png' };
        expect(
            enrichItem(item, { config: baseConfig(), currentDir: '', apiBase: API, isMobile: false }).popover,
        ).toBe(true);
        expect(
            enrichItem(item, { config: baseConfig(), currentDir: '', apiBase: API, isMobile: true }).popover,
        ).toBeUndefined();
    });
});

describe('buildItemLink', () => {
    it('links relative files when serving from the docroot', () => {
        const item = { name: 'a b.txt', download: { name: 'a b.txt' } };
        expect(buildItemLink(item, { config: baseConfig({ isDocroot: true }), currentDir: 'sub', apiBase: API })).toBe(
            'sub/a b.txt',
        );
        expect(buildItemLink(item, { config: baseConfig({ isDocroot: true }), currentDir: '', apiBase: API })).toBe(
            'a b.txt',
        );
    });

    it('uses root_public_url when configured', () => {
        const item = { name: 'f.txt', download: { name: 'f.txt' } };
        expect(
            buildItemLink(item, { config: baseConfig({ root_public_url: '/pub' }), currentDir: 'd', apiBase: API }),
        ).toBe('https://files.test/pub/d/f.txt');
        expect(
            buildItemLink(item, { config: baseConfig({ root_public_url: 'pub/x' }), currentDir: 'd', apiBase: API }),
        ).toBe('pub/x/d/f.txt');
    });

    it('falls back to the proxy/zipnload API endpoints', () => {
        expect(
            buildItemLink(
                { name: 'f.txt', download: { name: 'f.txt', action: 'download' } },
                { config: baseConfig(), currentDir: '', apiBase: API },
            ),
        ).toBe(`${API}?api=proxy&dir=&filename=f.txt`);
        expect(
            buildItemLink(
                { name: 'docs', download: { name: 'docs', action: 'zipnload' } },
                { config: baseConfig(), currentDir: '', apiBase: API },
            ),
        ).toBe(`${API}?api=zipnload&dir=&filename=docs`);
    });

    it('links nowhere when downloads are disabled', () => {
        expect(
            buildItemLink(
                { name: 'f.txt', download: { name: 'f.txt' } },
                { config: baseConfig({ download: 0, zipnload: 0 }), currentDir: '', apiBase: API },
            ),
        ).toBe('#');
    });
});

describe('buildAbsoluteLink', () => {
    it('keeps absolute links as-is', () => {
        expect(buildAbsoluteLink('http://x/y', {})).toBe('http://x/y');
        expect(buildAbsoluteLink('HTTP://X/Y', {})).toBe('HTTP://X/Y');
    });
    it('resolves relative links against origin and script dir', () => {
        expect(buildAbsoluteLink('sub/f.txt', { origin: 'https://h', pathnameDir: 'ifm' })).toBe(
            'https://h/ifm/sub/f.txt',
        );
        expect(buildAbsoluteLink('sub/f.txt', { origin: 'https://h', pathnameDir: '' })).toBe('https://h/sub/f.txt');
    });
});

describe('previewSrc', () => {
    it('previews relative files from the docroot', () => {
        expect(previewSrc({ name: 'a#b.png' }, { config: baseConfig({ isDocroot: true }), currentDir: 'sub', apiBase: API })).toBe(
            'sub/a%23b.png',
        );
    });
    it('proxies previews otherwise', () => {
        expect(
            previewSrc({ name: 'a b.png' }, { config: baseConfig(), currentDir: 'sub', apiBase: API }),
        ).toBe(`${API}?api=proxy&dir=sub&filename=a%20b.png`);
    });
});
