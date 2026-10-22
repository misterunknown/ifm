// @vitest-environment jsdom
/**
 * Tests for the file table (DataTables replacement) and context menu.
 * Oracle: src/templates/filetable.html + IFM.rebuildFileTable in src/ifm.js.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FileTable from '../src/components/FileTable.vue';
import { enrichItems } from '../src/api/fileLinks.js';
import { copyToClipboard } from '../src/store/ops.js';
import { flush, mountWithStore, testStore } from './support.js';

const API = 'https://files.test/index.php';

function fileRow(name, over = {}) {
    return {
        name,
        type: 'file',
        icon: 'icon fa fa-file-text-o',
        ext: 'txt',
        mime_type: 'text/plain',
        size_raw: 10,
        size: '10 B',
        lastmodified: 1700000000,
        fileperms: '-rw-r--r--',
        filepermmode: 'long',
        owner: 'u',
        group: 'g',
        ...over,
    };
}

function tableStore(config = {}) {
    const store = testStore({}, config);
    const raw = [
        { name: '..', type: 'dir', icon: 'icon fa fa-angle-up' },
        { name: 'docs', type: 'dir', icon: 'icon fa fa-folder-o' },
        fileRow('b.txt', { size_raw: 20, size: '20 B', lastmodified: 1700000020 }),
        fileRow('a.txt'),
        { ...fileRow('pic.png'), icon: 'icon fa fa-file-image-o', ext: 'png', mime_type: 'image/png' },
        { ...fileRow('arc.zip'), icon: 'icon fa fa-file-archive-o', ext: 'zip', mime_type: 'application/zip' },
    ];
    store.state.files = enrichItems(raw, {
        config: store.state.config,
        currentDir: '',
        apiBase: API,
        isMobile: false,
    });
    return store;
}

function rowNames(wrapper) {
    return wrapper.findAll('#filetable tbody tr').map((tr) => tr.attributes('data-filename'));
}

beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
});

afterEach(() => {
    // navigator/fetch stubs must not leak between tests (a stubbed navigator
    // without userAgent breaks event creation in later tests)
    vi.unstubAllGlobals();
});

describe('FileTable', () => {
    it('renders backend order with .. pinned and gates columns', () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        expect(rowNames(wrapper)).toEqual(['..', 'docs', 'b.txt', 'a.txt', 'pic.png', 'arc.zip']);
        expect(wrapper.find('tbody tr a.ifmitem').text()).toContain('[ up ]');
        // .. has no action buttons
        expect(wrapper.findAll('tbody tr')[0].findAll('td').at(-1).findAll('a')).toHaveLength(0);
        // download + permission cells follow the flags
        expect(wrapper.find('.th-download').exists()).toBe(true);
        expect(wrapper.find('input[name="newpermissions"]').exists()).toBe(true);
    });

    it('hides gated columns', () => {
        const store = tableStore({ showowner: 0, showgroup: 0, download: 0, showpermissions: 0 });
        store.state.files = enrichItems(
            [{ name: 'a.txt', type: 'file', icon: 'i', ext: 'txt', mime_type: 'text/plain' }],
            { config: store.state.config, currentDir: '', apiBase: API, isMobile: false },
        );
        const wrapper = mountWithStore(FileTable, store);
        expect(wrapper.find('.th-owner').exists()).toBe(false);
        expect(wrapper.find('.th-download').exists()).toBe(false);
        expect(wrapper.find('input[name="newpermissions"]').exists()).toBe(false);
    });

    it('sorts by name with .. pinned and persists the choice', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        await wrapper.find('.th-filename').trigger('click');
        expect(rowNames(wrapper)).toEqual(['..', 'a.txt', 'arc.zip', 'b.txt', 'docs', 'pic.png']);
        await wrapper.find('.th-filename').trigger('click');
        expect(rowNames(wrapper)).toEqual(['..', 'pic.png', 'docs', 'b.txt', 'arc.zip', 'a.txt']);
        expect(JSON.parse(localStorage.getItem('ifm-vue-filetable')).sort).toEqual({ key: 'name', dir: -1 });
    });

    it('sorts by size and filters across row text', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        await wrapper.find('.th-size').trigger('click');
        // directories report size 0, like the legacy data-order values
        expect(rowNames(wrapper)).toEqual(['..', 'docs', 'a.txt', 'pic.png', 'arc.zip', 'b.txt']);
        await wrapper.find('input[type="search"]').setValue('arc');
        expect(rowNames(wrapper)).toEqual(['arc.zip']);
    });

    it('pages long listings when configured', async () => {
        const store = tableStore({ paging: 1, pageLength: 2 });
        const wrapper = mountWithStore(FileTable, store);
        expect(rowNames(wrapper)).toEqual(['..', 'docs']);
        await wrapper.findAll('nav button')[1].trigger('click');
        expect(rowNames(wrapper)).toEqual(['b.txt', 'a.txt']);
        await wrapper.findAll('nav button')[0].trigger('click');
        expect(rowNames(wrapper)).toEqual(['..', 'docs']);
    });

    it('navigates into directories', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        await wrapper.findAll('#filetable tbody tr')[1].find('a.ifmitem').trigger('click');
        await flush();
        expect(store.state.currentDir).toBe('docs');
        expect(store.fetchCalls.find(([api]) => api === 'getRealpath')[1].get('dir')).toBe('docs');
    });

    it('toggles selection with ctrl-click', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        const cell = () => wrapper.findAll('#filetable tbody tr')[2].findAll('td')[0];
        await cell().trigger('click', { ctrlKey: true });
        expect(store.state.selected).toEqual(['b.txt']);
        expect(wrapper.findAll('#filetable tbody tr')[2].classes()).toContain('selectedItem');
        await cell().trigger('click', { ctrlKey: true });
        expect(store.state.selected).toEqual([]);
        // plain clicks never toggle
        await cell().trigger('click');
        expect(store.state.selected).toEqual([]);
    });

    it('dispatches row actions', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        const buttons = wrapper.findAll('#filetable tbody tr')[3].findAll('td').at(-1).findAll('a');
        expect(buttons.map((b) => b.attributes('name'))).toEqual([
            'do-edit',
            'do-copymove',
            'do-rename',
            'do-delete',
        ]);
        await buttons[2].trigger('click');
        expect(store.state.modal).toEqual({ name: 'rename', props: { filename: 'a.txt' } });
        store.state.modal = null;
        await buttons[0].trigger('click');
        await flush();
        expect(store.state.modal).toEqual({ name: 'file', props: { filename: 'a.txt', content: expect.anything() } });
        await buttons[3].trigger('click');
        expect(store.state.modal.name).toBe('delete');
    });

    it('edits permissions inline on Enter', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        const input = wrapper.findAll('input[name="newpermissions"]')[1];
        await input.setValue('600');
        await input.trigger('keydown.enter');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'changePermissions');
        expect(call[1].get('filename')).toBe('docs');
        expect(call[1].get('chmod')).toBe('600');
    });

    it('moves rows onto directories via drag and drop', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        const rows = wrapper.findAll('#filetable tbody tr');
        const setData = vi.fn();
        const start = new window.Event('dragstart', { bubbles: true });
        start.dataTransfer = { setData, setDragImage: () => {}, types: [] };
        await rows[3].element.dispatchEvent(start);
        expect(setData).toHaveBeenCalled();
        const payload = JSON.parse(setData.mock.calls[0][1]);
        expect(payload.name).toBe('a.txt');
        // drop onto docs
        const dirCell = rows[1].findAll('td')[0];
        const drop = new window.Event('drop', { bubbles: true });
        drop.dataTransfer = { types: [], getData: () => JSON.stringify(payload) };
        await dirCell.element.dispatchEvent(drop);
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'copyMove');
        expect(call[1].get('action')).toBe('move');
        expect(call[1].get('destination')).toBe('docs');
    });

    it('rejects drops onto themselves and ignores file drops', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        const rows = wrapper.findAll('#filetable tbody tr');
        const dropSelf = new window.Event('drop', { bubbles: true });
        dropSelf.dataTransfer = { types: [], getData: () => JSON.stringify({ name: 'docs' }) };
        await rows[1].findAll('td')[0].element.dispatchEvent(dropSelf);
        expect(store.state.toasts.at(-1).message).toBe('Source and destination are equal.');
        expect(store.fetchCalls.some(([api]) => api === 'copyMove')).toBe(false);

        const dropFiles = new window.Event('drop', { bubbles: true });
        dropFiles.dataTransfer = { types: ['Files'], getData: () => '[]' };
        await rows[1].findAll('td')[0].element.dispatchEvent(dropFiles);
        expect(store.fetchCalls.some(([api]) => api === 'copyMove')).toBe(false);
    });

    it('highlights dir rows for internal drags and ignores file drags', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        const row = wrapper.findAll('#filetable tbody tr')[1]; // docs dir
        const cell = row.findAll('td')[0].element;
        const internal = (type) => {
            const e = new window.Event(type, { bubbles: true, cancelable: true });
            e.dataTransfer = { types: [] };
            return e;
        };
        cell.dispatchEvent(internal('dragenter'));
        expect(row.classes()).toContain('highlightedItem');
        cell.dispatchEvent(internal('dragleave'));
        expect(row.classes()).not.toContain('highlightedItem');
        const over = internal('dragover');
        cell.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(true);
        // OS file drags never highlight rows or cancel the event
        const fileOver = internal('dragover');
        fileOver.dataTransfer = { types: ['Files'] };
        cell.dispatchEvent(fileOver);
        expect(fileOver.defaultPrevented).toBe(false);
        expect(row.classes()).not.toContain('highlightedItem');
    });

    it('previews images on hover for desktop', async () => {
        const store = tableStore();
        const wrapper = mountWithStore(FileTable, store);
        const link = wrapper.findAll('#filetable tbody tr')[4].find('a.ifmitem');
        await link.trigger('mouseenter', { clientX: 10, clientY: 10 });
        const preview = wrapper.find('.ifm-img-preview img');
        expect(preview.exists()).toBe(true);
        expect(preview.attributes('src')).toContain('api=proxy');
        await link.trigger('mouseleave');
        expect(wrapper.find('.ifm-img-preview').exists()).toBe(false);
    });
});

describe('ContextMenu', () => {
    // The table attaches to <body> and the menu teleports there: open the
    // menu with VTU trigger (synthetic native contextmenu events do not
    // reach the handler under jsdom), then use document queries for the
    // teleported menu.
    async function openMenu(store, rowIndex = 3) {
        const wrapper = mountWithStore(FileTable, store, {}, { attachTo: document.body });
        await wrapper.findAll('#filetable tbody tr')[rowIndex].trigger('contextmenu');
        return wrapper;
    }

    function menuButtons() {
        return Array.from(document.querySelectorAll('.ifm-context-menu button'));
    }

    function clickButton(button) {
        button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    }

    it('edits from the menu', async () => {
        const store = tableStore();
        await openMenu(store);
        expect(document.querySelector('.ifm-context-menu')).not.toBeNull();
        clickButton(menuButtons()[0]); // edit
        await flush();
        expect(store.state.modal).toEqual({ name: 'file', props: { filename: 'a.txt', content: expect.anything() } });
    });

    it('copies links verbatim or resolved against the page URL', async () => {
        vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
        // proxy hrefs are absolute: copied as-is (legacy copylink branch)
        const store = tableStore();
        await openMenu(store);
        // group 1 for a.txt: edit, rename, copylink
        clickButton(menuButtons()[2]);
        await flush();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            'https://files.test/index.php?api=proxy&dir=&filename=a.txt',
        );
        // docroot hrefs are relative: resolved against origin + script dir
        const docroot = tableStore({ isDocroot: true });
        await openMenu(docroot);
        clickButton(menuButtons()[2]);
        await flush();
        expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('http://localhost:3000/a.txt');
    });

    it('refuses multi-file downloads and opens archive/delete dialogs', async () => {
        const store = tableStore();
        store.state.selected = ['a.txt', 'b.txt'];
        await openMenu(store);
        const download = menuButtons().find((b) => b.textContent.includes('Download'));
        expect(download.querySelector('.badge').textContent).toBe('2');
        clickButton(download);
        expect(store.state.toasts.at(-1).message).toContain('not possible to download');

        await openMenu(store);
        const archive = menuButtons().find((b) => b.textContent.includes('archive'));
        clickButton(archive);
        expect(store.state.modal).toEqual({ name: 'createarchive', props: { items: expect.any(Array) } });
    });

    it('opens rename, move, and delete dialogs from the menu', async () => {
        // single a.txt row: edit, rename, copylink, copymove, download, archive, delete
        const store = tableStore();
        await openMenu(store);
        clickButton(menuButtons()[1]); // rename
        expect(store.state.modal).toEqual({ name: 'rename', props: { filename: 'a.txt' } });

        await openMenu(store);
        clickButton(menuButtons()[3]); // copy/move
        expect(store.state.modal.name).toBe('copymove');
        expect(store.state.modal.props.items.name).toBe('a.txt');

        await openMenu(store);
        clickButton(menuButtons()[6]); // delete
        expect(store.state.modal.name).toBe('delete');
        expect(store.state.modal.props.items.name).toBe('a.txt');
    });

    it('extracts archives from the menu', async () => {
        const store = tableStore();
        await openMenu(store, 5); // arc.zip row: extract first
        clickButton(menuButtons()[0]); // extract
        expect(store.state.modal).toEqual({ name: 'extract', props: { filename: 'arc.zip' } });
    });

    it('falls back to execCommand when the clipboard API is missing', async () => {
        // Legacy copyToClipboard path for non-secure contexts (plain http).
        vi.stubGlobal('navigator', {});
        document.execCommand = vi.fn().mockReturnValue(true);
        try {
            await copyToClipboard('https://h/f');
            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(document.querySelectorAll('textarea').length).toBe(0);
        } finally {
            delete document.execCommand;
        }
    });

    it('closes the menu on Escape like the legacy BootstrapMenu', async () => {
        const store = tableStore();
        await openMenu(store);
        expect(document.querySelector('.ifm-context-menu')).not.toBeNull();
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await flush();
        expect(document.querySelector('.ifm-context-menu')).toBeNull();
    });
});
