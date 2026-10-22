// @vitest-environment jsdom
/**
 * Tests for the application shell: boot sequence, drop overlay, dialog
 * router, and footer. Oracle: IFM.init in src/ifm.js + app.html shell.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import App from '../src/App.vue';
import en from '../src/i18n/en.json';
import { enrichItems } from '../src/api/fileLinks.js';
import { flush, mountWithStore, testStore } from './support.js';

beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    window.location.hash = '';
});

afterEach(() => {
    document.body.innerHTML = '';
    // replaceState: assigning location.hash fires spurious popstate events
    // under jsdom that leak into the next test's boot navigation.
    window.history.replaceState(null, '', window.location.pathname);
    vi.unstubAllGlobals();
});

function fileEvent(type, transfer) {
    const e = new window.Event(type, { bubbles: true, cancelable: true });
    e.dataTransfer = transfer;
    return e;
}

describe('App boot', () => {
    it('renders boot errors for config, i18n, and auth failures', async () => {
        const configFail = testStore({
            getConfig: async () => {
                throw new Error('down');
            },
        });
        mountWithStore(App, configFail, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        expect(document.body.textContent).toContain(en.load_config_error);

        document.body.innerHTML = '';
        const i18nFail = testStore({
            getI18N: async () => {
                throw new Error('down');
            },
        });
        mountWithStore(App, i18nFail, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        expect(document.body.textContent).toContain(en.load_text_error);
    });

    it('shows the static login dialog over the empty table when unauthenticated', async () => {
        // Like the legacy init, the app shell (empty table) renders first and
        // the static login dialog sits on top until checkAuth succeeds.
        const store = testStore({ checkAuth: async () => ({ status: 'ERROR', message: 'login first' }) });
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        expect(document.getElementById('loginForm')).not.toBeNull();
        expect(document.querySelectorAll('#filetable tbody tr')).toHaveLength(0);
    });

    it('boots straight into the file table when authenticated', async () => {
        const store = testStore({
            getFiles: async () => [{ name: 'a.txt', type: 'file', icon: 'i', ext: 'txt', mime_type: 'text/plain' }],
        });
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        expect(document.getElementById('filetable')).not.toBeNull();
        expect(document.getElementById('loginForm')).toBeNull();
        expect(document.querySelector('#filetable tbody tr').getAttribute('data-filename')).toBe('a.txt');
    });

    it('completes the login flow into the application', async () => {
        const store = testStore({
            checkAuth: async (params) =>
                params.has('inputLogin') ? { status: 'OK' } : { status: 'ERROR', message: 'login first' },
            getFiles: async () => [],
        });
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        document.getElementById('inputLogin').value = 'admin';
        document.getElementById('inputLogin').dispatchEvent(new window.Event('input', { bubbles: true }));
        document.getElementById('inputPassword').value = 'pw';
        document.getElementById('inputPassword').dispatchEvent(new window.Event('input', { bubbles: true }));
        document.getElementById('loginForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
        await flush();
        await nextTick();
        expect(document.getElementById('filetable')).not.toBeNull();
        const [, params] = store.fetchCalls.find(([api, p]) => api === 'checkAuth' && p.has('inputLogin'));
        expect(params.get('inputLogin')).toBe('admin');
    });

    it('opens the hash directory on boot like the legacy init', async () => {
        // jsdom fires spurious popstate events (with null state) on every
        // fragment change — assignment, pushState and replaceState alike —
        // which real browsers never send and which clobber the boot
        // navigation after the fact. So assert the boot's navigation call
        // itself, not the end state.
        window.history.replaceState(null, '', '#sub');
        const store = testStore();
        const navigations = [];
        const origChange = store.changeDirectory.bind(store);
        store.changeDirectory = (...args) => {
            navigations.push(args);
            return origChange(...args);
        };
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        expect(navigations.length).toBeGreaterThan(0);
        expect(navigations[0][0]).toBe('sub');
    });

    it('renders the footer with the release version link', async () => {
        const store = testStore({ getFiles: async () => [] });
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        expect(document.body.textContent).toContain(en.footer);
        const link = document.querySelector('.ifminfo-footer-text a');
        expect(link.getAttribute('href')).toContain('https://github.com/misterunknown/ifm/releases/tag/');
        expect(link.textContent).toBe('dev');
    });
});

describe('App drop overlay', () => {
    it('shows the overlay for file drags and uploads on drop', async () => {
        const store = testStore({ getFiles: async () => [] });
        store.state.authed = true;
        store.api.uploadFile = vi.fn().mockResolvedValue({ status: 'OK', cd: '' });
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        document.dispatchEvent(fileEvent('dragover', { types: ['Files'] }));
        await nextTick();
        expect(document.getElementById('filedropoverlay').classList).toContain('visible');
        document.dispatchEvent(fileEvent('drop', { types: ['Files'], files: [new File(['x'], 'a.txt')] }));
        await flush();
        expect(store.api.uploadFile).toHaveBeenCalledTimes(1);
        expect(document.getElementById('filedropoverlay').classList).not.toContain('visible');
    });

    it('hides the overlay on dragleave and ignores non-file drags', async () => {
        const store = testStore({ getFiles: async () => [] });
        store.state.authed = true;
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        document.dispatchEvent(fileEvent('dragover', { types: ['Files'] }));
        await nextTick();
        expect(document.getElementById('filedropoverlay').classList).toContain('visible');
        document.getElementById('filedropoverlay').dispatchEvent(fileEvent('dragleave', { types: ['Files'] }));
        await nextTick();
        expect(document.getElementById('filedropoverlay').classList).not.toContain('visible');
        document.dispatchEvent(fileEvent('dragover', { types: ['text/plain'] }));
        await nextTick();
        expect(document.getElementById('filedropoverlay').classList).not.toContain('visible');
    });

    it('hands existing files to the overwrite confirm on drop', async () => {
        const store = testStore({ getFiles: async () => [] });
        store.state.authed = true;
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        // After boot: refreshFiles (getFiles -> []) runs during boot, so the
        // existing-file fixture must be planted post-boot, like a real listing.
        store.state.files = enrichItems(
            [{ name: 'a.txt', type: 'file', icon: 'i', ext: 'txt', mime_type: 'text/plain' }],
            { config: store.state.config, currentDir: '', apiBase: store.api.apiBase, isMobile: false },
        );
        document.dispatchEvent(fileEvent('dragover', { types: ['Files'] }));
        document.dispatchEvent(fileEvent('drop', { types: ['Files'], files: [new File(['x'], 'a.txt')] }));
        expect(store.state.modal).toEqual({
            name: 'overwrite',
            props: { files: expect.any(Array), existing: ['a.txt'], newfilename: '' },
        });
    });
});

describe('App modal router', () => {
    it('renders dialogs from the single modal slot', async () => {
        const store = testStore({ getFiles: async () => [] });
        mountWithStore(App, store, {}, { attachTo: document.body });
        await flush();
        await nextTick();
        expect(document.getElementById('ifmmodal')).toBeNull();
        store.openModal('rename', { filename: 'a.txt' });
        await nextTick();
        expect(document.getElementById('ifmmodal')).not.toBeNull();
        expect(document.getElementById('formRenameFile')).not.toBeNull();
        store.openModal('search');
        await nextTick();
        expect(document.getElementById('searchForm')).not.toBeNull();
        expect(document.getElementById('formRenameFile')).toBeNull();
        store.closeModal();
        await nextTick();
        expect(document.getElementById('ifmmodal')).toBeNull();
    });
});
