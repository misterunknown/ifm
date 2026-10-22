/**
 * IFM backend API client.
 *
 * Speaks the exact same `?api=` contract as the legacy jQuery frontend
 * (src/ifm.js): form-urlencoded POSTs, session cookies, and the X-IFM-CSRF
 * header for state-changing calls. The PHP backend is unchanged.
 *
 * Every method returns the decoded JSON body. Callers check `status`
 * ("OK"/"ERROR") exactly like the legacy success handlers.
 */

import { hrefEncode } from './helpers.js';

export class IfmApiError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IfmApiError';
    }
}

// State-changing APIs subject to the backend CSRF + POST-method gate
// (see IFM::dispatch()). Kept here for documentation; the token is simply
// attached to every POST, which is what the legacy ajaxPrefilter did.
const STATE_CHANGING = new Set([
    'createDir',
    'saveFile',
    'delete',
    'rename',
    'extract',
    'upload',
    'copyMove',
    'changePermissions',
    'remoteUpload',
    'createArchive',
]);

export class IfmApi {
    constructor(apiBase) {
        // Legacy default: current URL without the hash fragment.
        this.apiBase = apiBase || window.location.href.replace(/#.*/, '');
        this.csrfToken = '';
    }

    setCsrfToken(token) {
        this.csrfToken = token || '';
    }

    async post(api, params = {}) {
        const body = new URLSearchParams();
        body.append('api', api);
        for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
                for (const v of value) body.append(`${key}[]`, v);
            } else if (value !== undefined && value !== null) {
                body.append(key, value);
            }
        }
        const headers = {};
        if (this.csrfToken) headers['X-IFM-CSRF'] = this.csrfToken;
        let res;
        try {
            res = await fetch(this.apiBase, {
                method: 'POST',
                credentials: 'same-origin',
                headers,
                body,
            });
        } catch (e) {
            throw new IfmApiError(`Network error calling ${api}: ${e.message}`);
        }
        return this.readJson(res, api);
    }

    /** Multipart upload with progress callbacks (XHR: fetch has no upload progress). */
    uploadFile(file, dir, newfilename, onProgress) {
        const data = new FormData();
        data.append('api', 'upload');
        data.append('dir', dir);
        data.append('file', file);
        if (newfilename) data.append('newfilename', newfilename);
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', this.apiBase);
            xhr.withCredentials = true;
            if (this.csrfToken) xhr.setRequestHeader('X-IFM-CSRF', this.csrfToken);
            if (onProgress && xhr.upload) {
                xhr.upload.onprogress = (evt) => {
                    if (evt.lengthComputable) onProgress((evt.loaded / evt.total) * 100);
                };
            }
            xhr.onload = () => {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    reject(new IfmApiError('Network error calling upload: invalid JSON response'));
                }
            };
            xhr.onerror = () => reject(new IfmApiError('Network error calling upload'));
            xhr.send(data);
        });
    }

    /** Arbitrary client-side HTTP probe (legacy ajaxRequest dialog). */
    async probeUrl(url, data, method) {
        const headers = {};
        let body;
        if (method === 'POST') {
            body = data;
            headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
        }
        let res;
        try {
            res = await fetch(url, { method, headers, body, cache: 'no-store' });
        } catch (e) {
            throw new IfmApiError(`Request failed: ${e.message}`);
        }
        return { status: res.status, text: await res.text() };
    }

    async readJson(res, api) {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new IfmApiError(`Invalid response for ${api}: not JSON`);
        }
    }

    // -- boot ----------------------------------------------------------------
    getConfig() {
        return this.post('getConfig');
    }

    getI18N(lang) {
        return this.post('getI18N', lang ? { lang } : {});
    }

    checkAuth() {
        return this.post('checkAuth');
    }

    login(inputLogin, inputPassword) {
        return this.post('checkAuth', { inputLogin, inputPassword });
    }

    logoutUrl() {
        return `${this.apiBase}?api=logout`;
    }

    // -- browsing -------------------------------------------------------------
    getRealpath(dir) {
        return this.post('getRealpath', { dir });
    }

    getFiles(dir) {
        return this.post('getFiles', { dir });
    }

    getFolders(dir) {
        return this.post('getFolders', dir ? { dir } : {});
    }

    // -- file ops --------------------------------------------------------------
    getContent(dir, filename) {
        return this.post('getContent', { dir, filename });
    }

    saveFile(dir, filename, content) {
        return this.post('saveFile', { dir, filename, content });
    }

    createDir(dir, dirname) {
        return this.post('createDir', { dir, dirname });
    }

    deleteFiles(dir, filenames) {
        return this.post('delete', { dir, filenames });
    }

    renameFile(dir, filename, newname) {
        return this.post('rename', { dir, filename, newname });
    }

    copyMove(dir, action, filenames, destination) {
        return this.post('copyMove', { dir, action, filenames, destination });
    }

    changePermissions(dir, filename, chmod) {
        return this.post('changePermissions', { dir, filename, chmod });
    }

    extractFile(dir, filename, targetdir) {
        return this.post('extract', { dir, filename, targetdir });
    }

    remoteUpload(dir, url, filename, method) {
        return this.post('remoteUpload', { dir, url, filename, method });
    }

    searchItems(dir, pattern) {
        return this.post('searchItems', { dir, pattern });
    }

    createArchive(dir, archivename, format, filenames) {
        return this.post('createArchive', { dir, archivename, format, filenames });
    }

    // -- direct (non-JSON) action links -----------------------------------------
    actionUrl(action, dir, filename) {
        return (
            `${this.apiBase}?api=${action}` +
            `&dir=${hrefEncode(dir)}&filename=${hrefEncode(filename)}`
        );
    }

    isStateChanging(api) {
        return STATE_CHANGING.has(api);
    }
}

/** Resolve the API base URL: explicit env override (dev proxy) or same-origin. */
export function resolveApiBase() {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_IFM_API) {
        return import.meta.env.VITE_IFM_API;
    }
    return window.location.href.replace(/#.*/, '');
}
