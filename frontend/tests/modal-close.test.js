// @vitest-environment jsdom
/**
 * Every dialog wires the Modal shell's close event to store.closeModal
 * (legacy dismiss buttons). Emitting close through the stub covers each
 * dialog template's onClose handler.
 */
import { afterEach, describe, expect, it } from 'vitest';

import AjaxModal from '../src/components/AjaxModal.vue';
import CopyMoveModal from '../src/components/CopyMoveModal.vue';
import CreateArchiveModal from '../src/components/CreateArchiveModal.vue';
import CreateDirModal from '../src/components/CreateDirModal.vue';
import DeleteModal from '../src/components/DeleteModal.vue';
import ExtractModal from '../src/components/ExtractModal.vue';
import FileEditorModal from '../src/components/FileEditorModal.vue';
import OverwriteModal from '../src/components/OverwriteModal.vue';
import RemoteUploadModal from '../src/components/RemoteUploadModal.vue';
import RenameModal from '../src/components/RenameModal.vue';
import SearchModal from '../src/components/SearchModal.vue';
import UploadModal from '../src/components/UploadModal.vue';
import { ModalStub, flush, mountDialog, testStore } from './support.js';

afterEach(() => {
    document.body.innerHTML = '';
});

const file = new File(['x'], 'a.txt');

const cases = [
    ['ajaxrequest', AjaxModal, {}],
    ['copymove', CopyMoveModal, { items: { name: 'a.txt' } }],
    ['createarchive', CreateArchiveModal, { items: { name: 'a.txt' } }],
    ['createdir', CreateDirModal, {}],
    ['delete', DeleteModal, { items: { name: 'a.txt' } }],
    ['extract', ExtractModal, { filename: 'a.zip' }],
    ['file', FileEditorModal, { filename: 'a.txt', content: '' }],
    ['overwrite', OverwriteModal, { files: [file], existing: ['b.txt'], newfilename: 'b.txt' }],
    ['remoteupload', RemoteUploadModal, {}],
    ['rename', RenameModal, { filename: 'a.txt' }],
    ['search', SearchModal, {}],
    ['upload', UploadModal, {}],
];

describe('dialog close wiring', () => {
    for (const [name, component, props] of cases) {
        it(`closes the ${name} dialog from the modal shell`, async () => {
            const store = testStore({ getFolders: async () => [] });
            store.state.modal = { name, props };
            const wrapper = mountDialog(component, store, props);
            await flush();
            wrapper.findComponent(ModalStub).vm.$emit('close');
            expect(store.state.modal).toBeNull();
        });
    }
});
