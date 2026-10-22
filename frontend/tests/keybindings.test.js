// @vitest-environment jsdom
/**
 * Tests for src/store/keybindings.js — every legacy shortcut in
 * IFM.handleKeystrokes plus history/unload handling. Oracle: the key map in
 * src/ifm.js and the README keybindings section.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installGlobalHandlers } from '../src/store/keybindings.js';

// jsdom has no layout engine: stub the scroll call browsers provide.
window.HTMLElement.prototype.scrollIntoView = () => {};

const ALL_FLAGS = {
    search: 1,
    showrefresh: 1,
    upload: 1,
    remoteupload: 1,
    ajaxrequest: 1,
    createfile: 1,
    createdir: 1,
    edit: 1,
    extract: 1,
    rename: 1,
    copymove: 1,
    delete: 1,
    download: 1,
};

function makeStore(config = {}) {
    return {
        state: {
            config: { ...ALL_FLAGS, ...config },
            authed: true,
            modal: null,
            files: [{ name: 'a.txt' }, { name: 'b.txt' }],
            selected: [],
            highlighted: -1,
            i18n: {},
            currentDir: '',
        },
        visibleRows: [],
        t: (k) => k,
        api: { getContent: vi.fn().mockResolvedValue({ status: 'OK', data: { filename: 'a.txt', content: 'x' } }) },
        openModal: vi.fn(),
        refreshFiles: vi.fn(),
        changeDirectory: vi.fn(),
        notify: vi.fn(),
        notifyError: vi.fn(),
    };
}

function key(key, target = document) {
    target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

let uninstall;
afterEach(() => {
    if (uninstall) uninstall();
    uninstall = null;
    document.body.innerHTML = '';
});

describe('global shortcuts', () => {
    let store;
    beforeEach(() => {
        store = makeStore();
        uninstall = installGlobalHandlers(store);
    });

    it.each([
        ['/', 'search', []],
        ['r', undefined, []],
        ['u', 'upload', []],
        ['o', 'remoteupload', []],
        ['a', 'ajaxrequest', []],
        ['F', 'file', []],
        ['D', 'createdir', []],
    ])('opens %s dialog on key %s', (k, modal) => {
        if (k === 'r') {
            key('r');
            expect(store.refreshFiles).toHaveBeenCalled();
            return;
        }
        key(k);
        expect(store.openModal).toHaveBeenCalledWith(modal);
    });

    it('honours feature flags', () => {
        store.state.config.search = 0;
        store.state.config.upload = 0;
        store.state.config.showrefresh = 0;
        key('/');
        key('u');
        key('r');
        expect(store.openModal).not.toHaveBeenCalled();
        expect(store.refreshFiles).not.toHaveBeenCalled();
    });

    it('focuses the path field on g and navigates up on h/Left/Backspace', () => {
        document.body.innerHTML = '<input id="currentDir">';
        key('g');
        expect(document.activeElement.id).toBe('currentDir');
        for (const k of ['h', 'ArrowLeft', 'Backspace']) key(k);
        expect(store.changeDirectory).toHaveBeenCalledTimes(3);
        expect(store.changeDirectory).toHaveBeenLastCalledWith('..');
    });

    it('ignores keys typed into form elements', () => {
        document.body.innerHTML = '<input id="in" value="u">';
        key('u', document.getElementById('in'));
        expect(store.openModal).not.toHaveBeenCalled();
    });

    it('pauses shortcuts while a dialog is open and before auth', () => {
        store.state.modal = { name: 'upload', props: {} };
        key('r');
        expect(store.refreshFiles).not.toHaveBeenCalled();
        store.state.modal = null;
        store.state.authed = false;
        key('r');
        expect(store.refreshFiles).not.toHaveBeenCalled();
    });
});

describe('highlight navigation', () => {
    let store;
    beforeEach(() => {
        store = makeStore();
        document.body.innerHTML = '<a id="g1" class="ifmitem" tabindex="0"></a><a id="g2" class="ifmitem" tabindex="0"></a>';
        store.visibleRows = [
            { guid: 'g1', name: 'a.txt', type: 'file' },
            { guid: 'g2', name: 'b.txt', type: 'dir' },
        ];
        uninstall = installGlobalHandlers(store);
    });

    it('highlights the focused row, else the first row', () => {
        key('j');
        expect(store.state.highlighted).toBe(0);
        expect(document.activeElement.id).toBe('g1');
    });

    it('moves next/prev within bounds and focuses links', () => {
        key('j');
        key('j');
        expect(store.state.highlighted).toBe(1);
        expect(document.activeElement.id).toBe('g2');
        key('j');
        expect(store.state.highlighted).toBe(1);
        key('k');
        expect(store.state.highlighted).toBe(0);
    });

    it('starts from the focused row when nothing is highlighted', () => {
        document.getElementById('g2').focus();
        key('j');
        expect(store.state.highlighted).toBe(1);
    });
});

describe('item shortcuts', () => {
    let store;
    beforeEach(() => {
        store = makeStore();
        document.body.innerHTML = '<a id="g1" class="ifmitem" tabindex="0"></a>';
        store.visibleRows = [{ guid: 'g1', name: 'a.txt', type: 'file', eaction: 'edit' }];
        store.state.highlighted = 0;
        document.getElementById('g1').focus();
        uninstall = installGlobalHandlers(store);
    });

    it('deletes selected items or the highlighted one (never ..)', () => {
        store.state.selected = ['b.txt'];
        key('Delete');
        expect(store.openModal).toHaveBeenCalledWith('delete', { items: [{ name: 'b.txt' }] });

        store.openModal.mockClear();
        store.state.selected = [];
        key('Delete');
        expect(store.openModal).toHaveBeenCalledWith('delete', { items: store.visibleRows[0] });

        store.openModal.mockClear();
        store.visibleRows = [{ guid: 'g1', name: '..', type: 'dir' }];
        key('Delete');
        expect(store.openModal).not.toHaveBeenCalled();
    });

    it('opens copy/move for selection or highlighted item', () => {
        store.state.selected = ['b.txt'];
        key('c');
        expect(store.openModal).toHaveBeenCalledWith('copymove', { items: [{ name: 'b.txt' }] });
        store.openModal.mockClear();
        store.state.selected = [];
        key('m');
        expect(store.openModal).toHaveBeenCalledWith('copymove', { items: store.visibleRows[0] });
    });

    it('edits, extracts, or renames via e/n', async () => {
        key('e');
        expect(store.api.getContent).toHaveBeenCalledWith('', 'a.txt');

        store.visibleRows = [{ guid: 'g1', name: 'a.zip', type: 'file', eaction: 'extract' }];
        key('e');
        expect(store.openModal).toHaveBeenCalledWith('extract', { filename: 'a.zip' });

        store.visibleRows = [{ guid: 'g1', name: 'a.txt', type: 'file', eaction: 'edit' }];
        key('n');
        expect(store.openModal).toHaveBeenCalledWith('rename', { filename: 'a.txt' });
    });

    it('toggles selection with Space and opens dirs with Enter', () => {
        key(' ');
        expect(store.state.selected).toEqual(['a.txt']);
        key(' ');
        expect(store.state.selected).toEqual([]);

        store.visibleRows = [{ guid: 'g1', name: 'docs', type: 'dir' }];
        key('Enter');
        expect(store.changeDirectory).toHaveBeenCalledWith('docs');
        key('l');
        expect(store.changeDirectory).toHaveBeenCalledWith('docs');
        key('ArrowRight');
        expect(store.changeDirectory).toHaveBeenCalledTimes(3);
    });

    it('clears the highlight on Escape when its link is focused', () => {
        key('Escape');
        expect(store.state.highlighted).toBe(-1);
    });
});

describe('history and unload', () => {
    it('navigates absolutely without pushing state on popstate', () => {
        const store = makeStore();
        uninstall = installGlobalHandlers(store);
        window.dispatchEvent(new window.PopStateEvent('popstate', { state: { dir: 'sub' } }));
        expect(store.changeDirectory).toHaveBeenCalledWith('sub', { pushState: false, absolute: true });
        window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
        expect(store.changeDirectory).toHaveBeenLastCalledWith('', { pushState: false, absolute: true });
    });

    it('warns on unload only while tasks are pending', () => {
        const store = makeStore();
        store.t = vi.fn((k) => k);
        uninstall = installGlobalHandlers(store);
        const free = new window.Event('beforeunload', { cancelable: true });
        window.dispatchEvent(free);
        expect(free.defaultPrevented).toBe(false);

        document.body.innerHTML = '<div id="waitqueue"></div>';
        const busy = new window.Event('beforeunload', { cancelable: true });
        window.dispatchEvent(busy);
        expect(busy.defaultPrevented).toBe(true);
        expect(store.t).toHaveBeenCalledWith('remaining_tasks');
    });
});
