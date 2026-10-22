<!-- Upload dialog. Port of modal.uploadfile.html + showUploadFileDialog:
  multi-file picker with dedupe, per-file removal, optional rename for a
  single file, and the confirm-overwrite handoff. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formUploadFile" @submit.prevent="submit">
            <div class="modal-body">
                <fieldset>
                    <div class="form-group mb-3">
                        <label class="form-label" for="fileselect">{{ fileLabel }}</label>
                        <input
                            ref="fileInput"
                            class="form-control"
                            type="file"
                            name="files"
                            id="fileselect"
                            multiple
                            @change="onSelect"
                        >
                    </div>
                    <div v-if="pending.length" class="form-group mb-3" id="uploadFileListContainer">
                        <ul id="uploadFileList" class="list-group list-group-flush border rounded">
                            <li
                                v-for="(file, index) in pending"
                                :key="`${file.name}-${file.size}-${file.lastModified}`"
                                class="list-group-item d-flex justify-content-between align-items-center py-2"
                            >
                                <span class="text-truncate me-2" :title="file.name">{{ file.name }}</span>
                                <button
                                    type="button"
                                    class="btn btn-sm btn-link text-danger p-0 flex-shrink-0"
                                    :title="store.t('delete')"
                                    @click="pending.splice(index, 1)"
                                >
                                    <span class="icon fa fa-trash"></span>
                                </button>
                        </li>
                    </ul>
                </div>
                <div v-if="pending.length === 1" class="form-group mb-0" id="filenameContainer">
                    <label class="visually-hidden" for="filename">{{ store.t('filename_new') }}</label>
                    <input
                        v-model="newfilename"
                        class="form-control"
                        type="text"
                        name="newfilename"
                        id="filename"
                        :placeholder="store.t('filename_new')"
                    >
                </div>
                </fieldset>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" id="buttonUpload" @click="submit">
                    {{ store.t('upload') }}
                </button>
                <button type="button" class="btn btn-danger" id="buttonCancel" @click="store.closeModal()">
                    {{ store.t('cancel') }}
                </button>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import Modal from './Modal.vue';
import { findExisting, uploadOne } from '../store/ops.js';

const store = inject('store');
const pending = ref([]);
const newfilename = ref('');
const fileInput = ref(null);

const fingerprint = (f) => `${f.name}\0${f.size}\0${f.lastModified}`;

const fileLabel = computed(() => {
    if (pending.value.length === 0) return store.t('upload_file');
    if (pending.value.length === 1) return pending.value[0].name;
    return `${store.t('upload_file')} (${pending.value.length})`;
});

function onSelect(e) {
    const seen = new Set(pending.value.map(fingerprint));
    for (const f of Array.from(e.target.files)) {
        if (!seen.has(fingerprint(f))) {
            seen.add(fingerprint(f));
            pending.value.push(f);
        }
    }
    e.target.value = '';
}

function submit() {
    const files = [...pending.value];
    if (files.length === 0) {
        store.notifyError(store.t('upload_no_file'));
        return;
    }
    let existing;
    if (files.length > 1) {
        existing = findExisting(store, files.map((x) => x.name));
    } else if (newfilename.value) {
        existing = findExisting(store, [newfilename.value]);
    } else {
        existing = findExisting(store, [files[0].name]);
    }
    if (existing.length > 0 && store.state.config.confirmoverwrite) {
        store.openModal('overwrite', { files, existing, newfilename: newfilename.value });
        return;
    }
    if (files.length === 1) uploadOne(store, files[0], newfilename.value);
    else files.forEach((file) => uploadOne(store, file));
    store.closeModal();
}
</script>
