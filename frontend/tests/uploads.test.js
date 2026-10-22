// @vitest-environment jsdom
/**
 * Tests for the upload flow, remote upload, and AJAX probe dialogs.
 * Oracle: showUploadFileDialog/showUploadConfirmOverwrite/uploadFile,
 * showRemoteUploadDialog/remoteUpload, showAjaxRequestDialog/ajaxRequest.
 */
import { describe, expect, it, vi } from 'vitest';

import en from '../src/i18n/en.json';
import UploadModal from '../src/components/UploadModal.vue';
import RemoteUploadModal from '../src/components/RemoteUploadModal.vue';
import AjaxModal from '../src/components/AjaxModal.vue';
import { flush, mountDialog, testStore } from './support.js';

function setInputFiles(wrapper, files) {
    const input = wrapper.find('#fileselect').element;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    return wrapper.find('#fileselect').trigger('change');
}

describe('UploadModal', () => {
    it('dedupes selected files and labels the picker', async () => {
        const store = testStore();
        const wrapper = mountDialog(UploadModal, store);
        const a = new File(['x'], 'a.txt');
        await setInputFiles(wrapper, [a, a, new File(['y'], 'b.txt')]);
        expect(wrapper.findAll('#uploadFileList li')).toHaveLength(2);
        expect(wrapper.find('label[for="fileselect"]').text()).toContain('(2)');
    });

    it('removes files and shows the rename box for single files only', async () => {
        const store = testStore();
        const wrapper = mountDialog(UploadModal, store);
        await setInputFiles(wrapper, [new File(['x'], 'a.txt'), new File(['y'], 'b.txt')]);
        expect(wrapper.find('#filenameContainer').exists()).toBe(false);
        await wrapper.find('#uploadFileList button').trigger('click');
        expect(wrapper.findAll('#uploadFileList li')).toHaveLength(1);
        expect(wrapper.find('#filenameContainer').exists()).toBe(true);
    });

    it('requires at least one file', async () => {
        const store = testStore();
        const wrapper = mountDialog(UploadModal, store);
        await wrapper.find('#buttonUpload').trigger('click');
        expect(store.state.toasts.at(-1).message).toBe(en.upload_no_file);
    });

    it('hands existing files to the overwrite confirm when configured', async () => {
        const store = testStore();
        store.state.files = [{ name: 'a.txt' }];
        const wrapper = mountDialog(UploadModal, store);
        await setInputFiles(wrapper, [new File(['x'], 'a.txt')]);
        await wrapper.find('#buttonUpload').trigger('click');
        expect(store.state.modal).toEqual({
            name: 'overwrite',
            props: { files: expect.any(Array), existing: ['a.txt'], newfilename: '' },
        });
    });

    it('uploads directly without conflicts', async () => {
        const store = testStore();
        store.api.uploadFile = vi.fn().mockResolvedValue({ status: 'OK', cd: '' });
        store.state.modal = { name: 'upload', props: {} };
        const wrapper = mountDialog(UploadModal, store);
        await setInputFiles(wrapper, [new File(['x'], 'fresh.txt')]);
        await wrapper.find('#buttonUpload').trigger('click');
        await flush();
        expect(store.api.uploadFile).toHaveBeenCalledTimes(1);
        expect(store.state.modal).toBeNull();
    });

    it('uploads a single file under its new name', async () => {
        const store = testStore();
        store.api.uploadFile = vi.fn().mockResolvedValue({ status: 'OK', cd: '' });
        const wrapper = mountDialog(UploadModal, store);
        await setInputFiles(wrapper, [new File(['x'], 'a.txt')]);
        await wrapper.find('#filename').setValue('renamed.txt');
        await wrapper.find('#buttonUpload').trigger('click');
        await flush();
        expect(store.api.uploadFile).toHaveBeenCalledWith(expect.any(File), '', 'renamed.txt', expect.any(Function));
    });

    it('skips the confirm when confirmoverwrite is off', async () => {
        const store = testStore({}, { confirmoverwrite: 0 });
        store.api.uploadFile = vi.fn().mockResolvedValue({ status: 'OK', cd: '' });
        store.state.files = [{ name: 'a.txt' }];
        const wrapper = mountDialog(UploadModal, store);
        await setInputFiles(wrapper, [new File(['x'], 'a.txt')]);
        await wrapper.find('#buttonUpload').trigger('click');
        await flush();
        expect(store.api.uploadFile).toHaveBeenCalledTimes(1);
        expect(store.state.modal).toBeNull();
    });
});

describe('RemoteUploadModal', () => {
    it('suggests the URL basename deduped, until edited manually', async () => {
        const store = testStore();
        store.state.files = [{ name: 'a.zip' }];
        const wrapper = mountDialog(RemoteUploadModal, store);
        await wrapper.find('#url').setValue('https://x.com/a.zip');
        expect(wrapper.find('#filename').element.value).toBe('a (1).zip');
        await wrapper.find('#filename').setValue('custom.zip');
        await wrapper.find('#url').setValue('https://x.com/other.zip');
        expect(wrapper.find('#filename').element.value).toBe('custom.zip');
    });

    it('remote-uploads with the chosen method', async () => {
        const store = testStore();
        store.state.modal = { name: 'remoteupload', props: {} };
        const wrapper = mountDialog(RemoteUploadModal, store);
        await wrapper.find('#url').setValue('https://x.com/a.zip');
        await wrapper.find('#radiofile').setChecked();
        await wrapper.find('#formRemoteUpload').trigger('submit');
        await flush();
        const call = store.fetchCalls.find(([api]) => api === 'remoteUpload');
        expect(call[1].get('url')).toBe('https://x.com/a.zip');
        expect(call[1].get('filename')).toBe('a.zip');
        expect(call[1].get('method')).toBe('file');
        expect(store.state.modal).toBeNull();
    });
});

describe('AjaxModal', () => {
    it('shows the data box for POST only and renders the response', async () => {
        const store = testStore();
        store.api.probeUrl = vi.fn().mockResolvedValue({ status: 201, text: 'created' });
        const wrapper = mountDialog(AjaxModal, store);
        expect(wrapper.find('#ajaxDataContainer').exists()).toBe(true);
        await wrapper.find('#radioget').setChecked();
        expect(wrapper.find('#ajaxDataContainer').exists()).toBe(false);
        await wrapper.find('#radiopost').setChecked();
        await wrapper.find('#ajaxurl').setValue('https://x/y');
        await wrapper.find('#ajaxdata').setValue('a=1\nb=2');
        await wrapper.find('#buttonRequest').trigger('click');
        await flush();
        expect(store.api.probeUrl).toHaveBeenCalledWith('https://x/y', 'a=1&b=2', 'POST');
        expect(wrapper.find('#ajaxresponse').element.value).toBe('created');
        expect(wrapper.find('#ajaxStatusCode').text()).toBe('201');
        expect(wrapper.find('#ajaxStatusCode').classes()).toContain('bg-success');
    });

    it('marks failed probes danger and stays open', async () => {
        const store = testStore();
        store.api.probeUrl = vi.fn().mockRejectedValue(new Error('nope'));
        const wrapper = mountDialog(AjaxModal, store);
        await wrapper.find('#ajaxurl').setValue('https://x/y');
        await wrapper.find('#buttonRequest').trigger('click');
        await flush();
        expect(wrapper.find('#ajaxStatusCode').text()).toBe('0');
        expect(wrapper.find('#ajaxStatusCode').classes()).toContain('bg-danger');
        // dialog stays open across requests like the legacy one
        expect(wrapper.find('#ajaxurl').exists()).toBe(true);
    });
});
