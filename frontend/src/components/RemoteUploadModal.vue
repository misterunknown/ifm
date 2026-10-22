<!-- Remote-upload dialog. Port of modal.remoteupload.html +
  showRemoteUploadDialog, including the basename suggestion that stops
  overwriting the filename once the user edits it manually. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formRemoteUpload" @submit.prevent="submit">
            <div class="modal-body">
                <fieldset>
                    <div class="form-group mb-3">
                        <label for="url">{{ store.t('upload_remote_url') }}</label>
                        <input
                            v-model="url"
                            class="form-control"
                            type="url"
                            id="url"
                            name="url"
                            placeholder="https://..."
                            autocomplete="off"
                            autofocus
                            required
                            @keydown.enter.prevent
                        >
                    </div>
                    <div class="form-group mb-3">
                        <label for="filename">{{ store.t('filename') }}</label>
                        <input
                            v-model="filename"
                            class="form-control"
                            type="text"
                            id="filename"
                            name="filename"
                            :placeholder="store.t('filename')"
                            required
                            @keydown.enter.prevent
                            @input="touched = true"
                        >
                    </div>
                    <div class="form-group">
                        <legend>{{ store.t('method') }}</legend>
                        <div class="form-check form-check-inline">
                            <input
                                v-model="method"
                                class="form-check-input"
                                type="radio"
                                id="radiocurl"
                                name="method"
                                value="curl"
                            >
                            <label class="form-check-label" for="radiocurl">cURL</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input
                                v-model="method"
                                class="form-check-input"
                                type="radio"
                                id="radiofile"
                                name="method"
                                value="file"
                            >
                            <label class="form-check-label" for="radiofile">file</label>
                        </div>
                    </div>
                </fieldset>
            </div>
            <div class="modal-footer">
                <button type="submit" class="btn btn-primary" id="buttonUpload">{{ store.t('upload') }}</button>
                <button type="button" class="btn btn-danger" id="buttonCancel" @click="store.closeModal()">
                    {{ store.t('cancel') }}
                </button>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { inject, ref, watch } from 'vue';
import Modal from './Modal.vue';
import { suggestRemoteFilename } from '../api/helpers.js';
import { remoteUpload } from '../store/ops.js';

const store = inject('store');
const url = ref('');
const filename = ref('');
const method = ref('curl');
const touched = ref(false);

watch(url, (v) => {
    if (!touched.value) {
        filename.value = suggestRemoteFilename(
            v,
            store.state.files.map((x) => x.name),
        );
    }
});

async function submit() {
    await remoteUpload(store, url.value, filename.value, method.value);
    store.closeModal();
}
</script>
