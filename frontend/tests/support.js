/**
 * Shared test support.
 *
 * Component tests use the REAL createStore() and IfmApi with fetch stubbed
 * at the transport level (mockBackend): DEFAULT handlers answer the boot
 * calls, per-test handlers override. This exercises the real request
 * encoding, store logic, and component wiring instead of mocking them away.
 */
import { vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { createStore } from '../src/store/index.js';

export const FULL_FLAGS = {
    auth: 0,
    language: 'en',
    ajaxrequest: 1,
    chmod: 1,
    copymove: 1,
    createdir: 1,
    createfile: 1,
    edit: 1,
    delete: 1,
    download: 1,
    extract: 1,
    upload: 1,
    remoteupload: 1,
    rename: 1,
    zipnload: 1,
    createarchive: 1,
    search: 1,
    paging: 0,
    pageLength: 50,
    showlastmodified: 1,
    showfilesize: 1,
    showowner: 1,
    showgroup: 1,
    showpermissions: 2,
    showhtdocs: 0,
    showhiddenfiles: 1,
    showpath: 0,
    contextmenu: 1,
    disable_mime_detection: 0,
    showrefresh: 1,
    forceproxy: 0,
    confirmoverwrite: 1,
    customDateFormat: false,
    inline: 0,
    isDocroot: false,
    root_public_url: '',
    csrf_token: 'tok',
};

/**
 * Stub global fetch with per-endpoint handlers.
 * @param handlers {Record<string, (params: URLSearchParams) => any>}
 * @returns list of [apiName, params] calls for assertions.
 */
export function mockBackend(handlers = {}) {
    const calls = [];
    vi.stubGlobal('fetch', async (url, opts) => {
        const params = new URLSearchParams(opts.body);
        const api = params.get('api');
        calls.push([api, params]);
        if (handlers[api]) {
            return { text: async () => JSON.stringify(await handlers[api](params)) };
        }
        return { text: async () => JSON.stringify({ status: 'OK' }) };
    });
    return calls;
}

export function testStore(handlers = {}, config = {}) {
    const calls = mockBackend({
        getConfig: async () => ({ ...FULL_FLAGS }),
        getI18N: async () => ({}),
        checkAuth: async () => ({ status: 'OK', message: 'Authenticated' }),
        getRealpath: async (params) => ({ realpath: params.get('dir') }),
        getFiles: async () => [],
        getFolders: async () => [],
        getContent: async (params) => ({ status: 'OK', data: { filename: params.get('filename'), content: 'content' } }),
        ...handlers,
    });
    const store = createStore('https://files.test/index.php');
    store.api.setCsrfToken('tok');
    store.state.config = { ...FULL_FLAGS, ...config };
    store.fetchCalls = calls;
    return store;
}

export function mountWithStore(component, store, props = {}, options = {}) {
    return mount(component, {
        props,
        global: { provide: { store } },
        ...options,
    });
}

// Render-function stub for the teleporting Modal shell: keeps dialog content
// inside the wrapper tree so tests can use wrapper.find(). The real Modal is
// covered by tests/chrome.test.js.
export const ModalStub = {
    props: ['large', 'dismissible'],
    emits: ['close'],
    render() {
        return h('div', { class: 'modal-stub' }, this.$slots.default ? this.$slots.default() : []);
    },
};

export function mountDialog(component, store, props = {}) {
    return mount(component, {
        props,
        global: { provide: { store }, stubs: { Modal: ModalStub } },
    });
}

/** Flush pending promises/microtasks. */
export function flush() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
