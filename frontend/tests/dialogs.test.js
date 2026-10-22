// @vitest-environment jsdom
/**
 * Tests for the CRUD dialogs. Oracle: the modal templates and the
 * show, save, create, rename and delete flows in src/ifm.js.
 */
import { describe, expect, it, vi } from 'vitest';

import en from '../src/i18n/en.json';
import LoginModal from '../src/components/LoginModal.vue';
import CreateDirModal from '../src/components/CreateDirModal.vue';
import DeleteModal from '../src/components/DeleteModal.vue';
import RenameModal from '../src/components/RenameModal.vue';
import ExtractModal from '../src/components/ExtractModal.vue';
import CreateArchiveModal from '../src/components/CreateArchiveModal.vue';
import OverwriteModal from '../src/components/OverwriteModal.vue';
import { flush, mountDialog, testStore } from './support.js';

describe('LoginModal', () => {
    it('logs in and emits logged-in on success', async () => {
        const store = testStore({ checkAuth: async () => ({ status: 'OK' }) });
        const wrapper = mountDialog(LoginModal, store);
        await wrapper.find('#inputLogin').setValue('admin');
        await wrapper.find('#inputPassword').setValue('pw');
        await wrapper.find('#loginForm').trigger('submit');
        await flush();
        expect(wrapper.emitted('logged-in')).toHaveLength(1);
        const [, params] = store.fetchCalls.find(([api, p]) => api === 'checkAuth' && paramsHas(p, 'inputLogin'));
        expect(params.get('inputLogin')).toBe('admin');
        expect(params.get('inputPassword')).toBe('pw');
    });

    it('shows backend and transport failures in the alert', async () => {
        const store = testStore({ checkAuth: async () => ({ status: 'ERROR', message: 'Wrong credentials' }) });
        const wrapper = mountDialog(LoginModal, store);
        await wrapper.find('#loginForm').trigger('submit');
        await flush();
        expect(wrapper.find('.alert').text()).toBe('Wrong credentials');
        expect(wrapper.emitted('logged-in')).toBeUndefined();
    });

    it('shows a generic failure when the request fails', async () => {
        const store = testStore({
            checkAuth: async () => {
                throw new Error('down');
            },
        });
        const wrapper = mountDialog(LoginModal, store);
        await wrapper.find('#loginForm').trigger('submit');
        await flush();
        expect(wrapper.find('.alert').text()).toBe('Authentication failed');
    });
});

function paramsHas(params, key) {
    return params.get(key) !== null;
}

describe('CreateDirModal', () => {
    it('blocks taken names and creates fresh ones', async () => {
        const store = testStore();
        store.state.files = [{ name: 'taken' }];
        store.state.modal = { name: 'createdir', props: {} };
        const wrapper = mountDialog(CreateDirModal, store);
        await wrapper.find('#dirname').setValue('taken');
        expect(wrapper.find('#dirname').classes()).toContain('is-invalid');
        expect(wrapper.find('#dirnameError').text()).toBe(en.name_already_exists);
        await wrapper.find('#formCreateDir').trigger('submit');
        await flush();
        expect(store.fetchCalls.some(([api]) => api === 'createDir')).toBe(false);

        await wrapper.find('#dirname').setValue('fresh');
        await wrapper.find('#formCreateDir').trigger('submit');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'createDir');
        expect(call[1].get('dirname')).toBe('fresh');
        expect(store.state.modal).toBeNull();
    });
});

describe('DeleteModal', () => {
    it('confirms single and multiple deletions', async () => {
        const single = testStore();
        const one = mountDialog(DeleteModal, single, { items: { name: 'a.txt' } });
        expect(one.text()).toContain('a.txt');
        await one.find('#buttonYes').trigger('click');
        await flush();
        expect(single.fetchCalls.find(([api]) => api === 'delete')[1].getAll('filenames[]')).toEqual(['a.txt']);

        const multi = testStore();
        const many = mountDialog(DeleteModal, multi, { items: [{ name: 'a' }, { name: 'b' }] });
        expect(many.text()).toContain('2');
        await many.find('#buttonNo').trigger('click');
        expect(multi.fetchCalls.some(([api]) => api === 'delete')).toBe(false);
        expect(multi.state.modal).toBeNull();
    });
});

describe('RenameModal', () => {
    it('renames with the entered name', async () => {
        const store = testStore();
        const wrapper = mountDialog(RenameModal, store, { filename: 'old.txt' });
        expect(wrapper.find('#newname').element.value).toBe('old.txt');
        await wrapper.find('#newname').setValue('new.txt');
        await wrapper.find('#formRenameFile').trigger('submit');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'rename');
        expect(call[1].get('filename')).toBe('old.txt');
        expect(call[1].get('newname')).toBe('new.txt');
        expect(store.state.modal).toBeNull();
    });
});

describe('ExtractModal', () => {
    it('extracts to current dir, suggested subdir, or custom location', async () => {
        const store = testStore();
        const wrapper = mountDialog(ExtractModal, store, { filename: 'archive.tar.gz' });
        // default: current dir
        await wrapper.find('#formExtractFile').trigger('submit');
        await flush();
        expect(store.fetchCalls.find(([api]) => api === 'extract')[1].get('targetdir')).toBe('./');

        // focusing the custom field switches to the custom location
        const custom = wrapper.find('#extractCustomLocation');
        await custom.trigger('focus');
        await custom.setValue('elsewhere');
        await wrapper.find('#formExtractFile').trigger('submit');
        await flush();
        const calls = store.fetchCalls.filter(([api]) => api === 'extract');
        expect(calls[1][1].get('targetdir')).toBe('elsewhere');
        expect(store.state.modal).toBeNull();
    });

    it('offers the subdir suggestion', async () => {
        const store = testStore();
        const wrapper = mountDialog(ExtractModal, store, { filename: 'archive.tar.gz' });
        const radios = wrapper.findAll('input[type="radio"]');
        expect(radios.map((r) => r.element.value)).toEqual(['./', './archive.tar', 'custom']);
    });
});

describe('CreateArchiveModal', () => {
    it('sends valid names with the detected format and stays open', async () => {
        const store = testStore();
        store.state.modal = { name: 'createarchive', props: {} };
        const wrapper = mountDialog(CreateArchiveModal, store, { items: { name: 'a.txt' } });
        await wrapper.find('#archivename').setValue('out.zip');
        await wrapper.find('form').trigger('submit');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'createArchive');
        expect(call[1].get('archivename')).toBe('out.zip');
        expect(call[1].get('format')).toBe('zip');
        expect(call[1].getAll('filenames[]')).toEqual(['a.txt']);
        expect(store.state.modal).not.toBeNull();
    });

    it('rejects invalid formats without calling the backend', async () => {
        const store = testStore();
        const wrapper = mountDialog(CreateArchiveModal, store, { items: { name: 'a.txt' } });
        await wrapper.find('#archivename').setValue('out.rar');
        await wrapper.find('form').trigger('submit');
        await flush();
        expect(store.fetchCalls.some(([api]) => api === 'createArchive')).toBe(false);
        expect(store.state.toasts.at(-1).message).toBe(en.invalid_archive_format);
    });
});

describe('OverwriteModal', () => {
    it('uploads with the new name for single renamed files', async () => {
        const store = testStore();
        store.api.uploadFile = vi.fn().mockResolvedValue({ status: 'OK', cd: '' });
        const file = new File(['x'], 'a.txt');
        const wrapper = mountDialog(OverwriteModal, store, { files: [file], existing: ['b.txt'], newfilename: 'b.txt' });
        expect(wrapper.text()).toContain('b.txt');
        await wrapper.find('#buttonConfirm').trigger('click');
        await flush();
        expect(store.api.uploadFile).toHaveBeenCalledWith(file, '', 'b.txt', expect.any(Function));
    });

    it('uploads every file for multi-file confirms and closes on cancel', async () => {
        const store = testStore();
        store.api.uploadFile = vi.fn().mockResolvedValue({ status: 'OK', cd: '' });
        const files = [new File(['x'], 'a.txt'), new File(['y'], 'b.txt')];
        const wrapper = mountDialog(OverwriteModal, store, { files, existing: ['a.txt'], newfilename: '' });
        await wrapper.find('#buttonConfirm').trigger('click');
        await flush();
        expect(store.api.uploadFile).toHaveBeenCalledTimes(2);

        const other = testStore();
        const cancel = mountDialog(OverwriteModal, other, { files, existing: ['a.txt'], newfilename: '' });
        await cancel.find('#buttonCancel').trigger('click');
        expect(other.state.modal).toBeNull();
    });
});
