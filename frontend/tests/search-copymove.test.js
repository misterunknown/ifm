// @vitest-environment jsdom
/**
 * Tests for the search dialog and the copy/move dialog with its lazy folder
 * tree. Oracle: showSearchDialog, showCopyMoveDialog, and the
 * bootstrap-treeview lazy loading in src/ifm.js.
 */
import { describe, expect, it } from 'vitest';

import en from '../src/i18n/en.json';
import SearchModal from '../src/components/SearchModal.vue';
import CopyMoveModal from '../src/components/CopyMoveModal.vue';
import FolderTree from '../src/components/FolderTree.vue';
import { flush, mountDialog, mountWithStore, testStore } from './support.js';

describe('SearchModal', () => {
    it('searches and splits folder/link names like the legacy dialog', async () => {
        const store = testStore({
            searchItems: async (params) => {
                expect(params.get('pattern')).toBe('*.txt');
                expect(params.get('dir')).toBe('sub');
                return [
                    { name: 'deep/hit.txt', icon: 'i', type: 'file' },
                    { name: 'top.txt', icon: 'i', type: 'file' },
                ];
            },
        });
        store.state.currentDir = 'sub';
        const wrapper = mountDialog(SearchModal, store);
        await wrapper.find('#searchPattern').setValue('*.txt');
        await wrapper.find('#searchForm').trigger('submit');
        await flush();
        const rows = wrapper.findAll('#searchResults .searchitem');
        expect(rows).toHaveLength(2);
        expect(rows[0].text()).toContain('hit.txt');
        expect(rows[0].text()).toContain('(deep)');
        expect(store.state.search.lastSearch).toBe('*.txt');
        expect(store.state.search.data.currentDir).toBe('sub');
    });

    it('ignores empty patterns and restores the last search', async () => {
        const store = testStore();
        store.state.search.lastSearch = 'prev';
        store.state.search.data = [{ name: 'prev.txt', icon: 'i', type: 'file' }];
        const wrapper = mountDialog(SearchModal, store);
        expect(wrapper.find('#searchPattern').element.value).toBe('prev');
        expect(wrapper.findAll('#searchResults .searchitem')).toHaveLength(1);
        await wrapper.find('#searchPattern').setValue('   ');
        await wrapper.find('#searchForm').trigger('submit');
        await flush();
        expect(store.fetchCalls.some(([api]) => api === 'searchItems')).toBe(false);
    });

    it('closes the dialog with an error on backend failure', async () => {
        const store = testStore({ searchItems: async () => ({ status: 'ERROR', message: 'denied' }) });
        store.state.modal = { name: 'search', props: {} };
        const wrapper = mountDialog(SearchModal, store);
        await wrapper.find('#searchPattern').setValue('x');
        await wrapper.find('#searchForm').trigger('submit');
        await flush();
        expect(store.state.modal).toBeNull();
        expect(store.state.toasts.at(-1).message).toBe('denied');
    });

    it('navigates into the result folder on click', async () => {
        const store = testStore({
            searchItems: async () => [{ name: 'deep/hit.txt', icon: 'i', type: 'file' }],
        });
        store.state.currentDir = 'sub';
        store.state.modal = { name: 'search', props: {} };
        const wrapper = mountDialog(SearchModal, store);
        await wrapper.find('#searchPattern').setValue('*.txt');
        await wrapper.find('#searchForm').trigger('submit');
        await flush();
        await wrapper.find('#searchResults .searchitem').trigger('click');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'getRealpath');
        expect(call[1].get('dir')).toBe('sub/deep');
        expect(store.state.modal).toBeNull();
    });
});

describe('FolderTree', () => {
    it('renders escaped labels and toggles lazy nodes', async () => {
        const store = testStore();
        const nodes = [
            { text: 'a &amp; b', lazyLoad: true, dataAttr: { path: '/r/a' } },
            { text: 'leaf', dataAttr: { path: '/r/leaf' } },
        ];
        const meta = { '/r/a': { expanded: false, loading: false, children: null } };
        const wrapper = mountWithStore(FolderTree, store, { nodes, meta, selectedPath: '/r/leaf' });
        expect(wrapper.find('[data-path="/r/a"] span').html()).toContain('a &amp; b');
        expect(wrapper.find('[data-path="/r/leaf"]').classes()).toContain('node-selected');
        await wrapper.find('[data-path="/r/leaf"]').trigger('click');
        expect(wrapper.emitted('select')).toEqual([['/r/leaf']]);
        await wrapper.findAll('li')[0].find('span').trigger('click');
        expect(wrapper.emitted('toggle')[0][0].dataAttr.path).toBe('/r/a');
    });
});

describe('CopyMoveModal', () => {
    const roots = [
        { text: '/ [root]', dataAttr: { path: '/var/www' } },
        { text: 'sub', lazyLoad: true, dataAttr: { path: '/var/www/sub' } },
    ];

    it('loads roots, expands lazy nodes, and copies to the selection', async () => {
        const store = testStore({
            getFolders: async (params) =>
                params.get('dir') ? [{ text: 'kid', dataAttr: { path: '/var/www/sub/kid' } }] : roots,
        });
        const wrapper = mountDialog(CopyMoveModal, store, { items: { name: 'a.txt' } });
        await flush();
        expect(wrapper.findAll('#copyMoveTree .node-label')).toHaveLength(2);
        // expanding the lazy node loads its children
        await wrapper.findAll('#copyMoveTree > ul > li')[1].find('span').trigger('click');
        await flush();
        expect(wrapper.find('[data-path="/var/www/sub/kid"]').exists()).toBe(true);
        // copy/move stay disabled without a destination (legacy threw instead)
        expect(wrapper.find('#copyButton').attributes('disabled')).not.toBeUndefined();
        await wrapper.find('[data-path="/var/www/sub/kid"]').trigger('click');
        await wrapper.find('#copyButton').trigger('click');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'copyMove');
        expect(call[1].get('action')).toBe('copy');
        expect(call[1].getAll('filenames[]')).toEqual(['a.txt']);
        expect(call[1].get('destination')).toBe('/var/www/sub/kid');
    });

    it('moves and closes on cancel without requesting', async () => {
        const store = testStore({ getFolders: async () => roots });
        store.state.modal = { name: 'copymove', props: {} };
        const wrapper = mountDialog(CopyMoveModal, store, { items: [{ name: 'a' }, { name: 'b' }] });
        await flush();
        await wrapper.find('[data-path="/var/www"]').trigger('click');
        await wrapper.find('#moveButton').trigger('click');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'copyMove');
        expect(call[1].get('action')).toBe('move');
        expect(call[1].getAll('filenames[]')).toEqual(['a', 'b']);
        expect(store.state.modal).toBeNull();

        const other = testStore({ getFolders: async () => roots });
        const cancel = mountDialog(CopyMoveModal, other, { items: { name: 'a' } });
        await flush();
        await cancel.find('#cancelButton').trigger('click');
        expect(other.fetchCalls.some(([api]) => api === 'copyMove')).toBe(false);
    });

    it('closes with an error when the tree fails to load', async () => {
        const store = testStore({
            getFolders: async () => {
                throw new Error('down');
            },
        });
        store.state.modal = { name: 'copymove', props: {} };
        mountDialog(CopyMoveModal, store, { items: { name: 'a' } });
        await flush();
        expect(store.state.modal).toBeNull();
        expect(store.state.toasts.at(-1).message).toBe(en.folder_tree_load_error);
    });
});
