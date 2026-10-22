/**
 * Tests for src/api/client.js — request encoding, CSRF handling, and failure
 * shapes. Oracle: jQuery's form encoding + the backend's $_REQUEST/CSRF
 * handling in src/main.php.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = { location: { href: 'https://files.test/ifm.php?lang=de#sub', origin: 'https://files.test' } };

import { IfmApi, IfmApiError, resolveApiBase } from '../src/api/client.js';

function jsonResponse(obj) {
    return { text: async () => JSON.stringify(obj) };
}

describe('resolveApiBase', () => {
    it('keeps the query string (for ?lang=) and drops the hash like the legacy base', () => {
        expect(resolveApiBase()).toBe('https://files.test/ifm.php?lang=de');
    });
});

describe('post', () => {
    let api;
    beforeEach(() => {
        api = new IfmApi('https://h/index.php');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'OK' })));
    });

    it('sends form-encoded POSTs with arrays as key[] (jQuery style)', async () => {
        await api.post('delete', { dir: 'sub dir', filenames: ['a.txt', 'b.txt'] });
        const [url, opts] = fetch.mock.calls[0];
        expect(url).toBe('https://h/index.php');
        expect(opts.method).toBe('POST');
        expect(opts.credentials).toBe('same-origin');
        const body = new URLSearchParams(opts.body);
        expect(body.get('api')).toBe('delete');
        expect(body.get('dir')).toBe('sub dir');
        expect(body.getAll('filenames[]')).toEqual(['a.txt', 'b.txt']);
        expect(opts.headers).toEqual({});
    });

    it('attaches the CSRF token like the legacy ajaxPrefilter', async () => {
        api.setCsrfToken('tok');
        await api.post('saveFile', { dir: '', filename: 'a', content: 'x' });
        expect(fetch.mock.calls[0][1].headers).toEqual({ 'X-IFM-CSRF': 'tok' });
        api.setCsrfToken('');
        await api.post('getFiles', { dir: '' });
        expect(fetch.mock.calls[1][1].headers).toEqual({});
    });

    it('skips undefined/null params and unwraps JSON', async () => {
        fetch.mockResolvedValueOnce(jsonResponse([1, 2]));
        const data = await api.post('getFolders', { dir: undefined, extra: null });
        expect(data).toEqual([1, 2]);
        expect(fetch.mock.calls[0][1].body).not.toContain('dir');
    });

    it('throws IfmApiError on network and invalid-JSON failures', async () => {
        fetch.mockRejectedValueOnce(new Error('down'));
        await expect(api.post('getFiles', {})).rejects.toBeInstanceOf(IfmApiError);
        fetch.mockResolvedValueOnce({ text: async () => 'not json' });
        await expect(api.post('getFiles', {})).rejects.toBeInstanceOf(IfmApiError);
    });

    it('delegates endpoint helpers with exact backend params', async () => {
        await api.saveFile('d', 'f', 'c');
        const saved = new URLSearchParams(fetch.mock.calls[0][1].body);
        expect(saved.get('api')).toBe('saveFile');
        expect(saved.get('filename')).toBe('f');
        expect(saved.get('content')).toBe('c');
        await api.copyMove('d', 'move', ['a'], 'dest');
        const body = new URLSearchParams(fetch.mock.calls[1][1].body);
        expect(body.get('action')).toBe('move');
        expect(body.getAll('filenames[]')).toEqual(['a']);
        expect(body.get('destination')).toBe('dest');
        await api.login('admin', 'pw');
        const login = new URLSearchParams(fetch.mock.calls[2][1].body);
        expect(login.get('api')).toBe('checkAuth');
        expect(login.get('inputLogin')).toBe('admin');
        expect(login.get('inputPassword')).toBe('pw');
        expect(api.isStateChanging('saveFile')).toBe(true);
        expect(api.isStateChanging('getFiles')).toBe(false);
    });
});

describe('uploadFile', () => {
    class MockXHR {
        static instances = [];
        constructor() {
            MockXHR.instances.push(this);
            this.upload = {};
            this.headers = {};
        }
        open(method, url) {
            this.method = method;
            this.url = url;
        }
        setRequestHeader(k, v) {
            this.headers[k] = v;
        }
        send(data) {
            this.sent = data;
        }
    }

    beforeEach(() => {
        MockXHR.instances = [];
        vi.stubGlobal('XMLHttpRequest', MockXHR);
    });

    it('posts multipart FormData with credentials and CSRF', async () => {
        const api = new IfmApi('https://h/index.php');
        api.setCsrfToken('tok');
        const file = new File(['x'], 'a.bin');
        const promise = api.uploadFile(file, 'sub', 'b.bin', () => {});
        const xhr = MockXHR.instances[0];
        expect(xhr.method).toBe('POST');
        expect(xhr.withCredentials).toBe(true);
        expect(xhr.headers).toEqual({ 'X-IFM-CSRF': 'tok' });
        expect(xhr.sent.get('api')).toBe('upload');
        expect(xhr.sent.get('dir')).toBe('sub');
        expect(xhr.sent.get('file')).toBe(file);
        expect(xhr.sent.get('newfilename')).toBe('b.bin');
        xhr.responseText = '{"status":"OK"}';
        xhr.onload();
        await expect(promise).resolves.toEqual({ status: 'OK' });
    });

    it('omits newfilename when empty and reports progress', async () => {
        const api = new IfmApi('https://h/index.php');
        const seen = [];
        const promise = api.uploadFile(new File(['x'], 'a.bin'), '', '', (p) => seen.push(p));
        const xhr = MockXHR.instances[0];
        expect(xhr.sent.get('newfilename')).toBeNull();
        xhr.upload.onprogress({ lengthComputable: true, loaded: 1, total: 4 });
        expect(seen).toEqual([25]);
        xhr.responseText = '{"status":"OK"}';
        xhr.onload();
        await promise;
    });

    it('rejects on invalid JSON and transport errors', async () => {
        const api = new IfmApi('https://h/index.php');
        const bad = api.uploadFile(new File(['x'], 'a'), '', '');
        MockXHR.instances[0].responseText = 'broken';
        MockXHR.instances[0].onload();
        await expect(bad).rejects.toBeInstanceOf(IfmApiError);

        const down = api.uploadFile(new File(['x'], 'a'), '', '');
        MockXHR.instances[1].onerror();
        await expect(down).rejects.toBeInstanceOf(IfmApiError);
    });
});

describe('probeUrl', () => {
    let api;
    beforeEach(() => {
        api = new IfmApi('https://h/index.php');
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ status: 201, text: async () => 'created' }),
        );
    });

    it('probes GET without a body', async () => {
        const res = await api.probeUrl('https://x/y', '', 'GET');
        expect(res).toEqual({ status: 201, text: 'created' });
        const [, opts] = fetch.mock.calls[0];
        expect(opts.method).toBe('GET');
        expect(opts.body).toBeUndefined();
    });

    it('sends POST data form-encoded like the legacy probe', async () => {
        await api.probeUrl('https://x/y', 'a=1&b=2', 'POST');
        const [, opts] = fetch.mock.calls[0];
        expect(opts.body).toBe('a=1&b=2');
        expect(opts.headers['Content-Type']).toContain('application/x-www-form-urlencoded');
    });

    it('wraps network failures', async () => {
        fetch.mockRejectedValueOnce(new Error('nope'));
        await expect(api.probeUrl('https://x', '', 'GET')).rejects.toBeInstanceOf(IfmApiError);
    });
});

describe('action links', () => {
    it('builds download/logout hrefs with legacy encoding', () => {
        const api = new IfmApi('https://h/index.php');
        expect(api.actionUrl('download', 'sub dir', 'a#b.txt')).toBe(
            'https://h/index.php?api=download&dir=sub dir&filename=a%23b.txt',
        );
        expect(api.logoutUrl()).toBe('https://h/index.php?api=logout');
    });
});
