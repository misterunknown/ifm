<!-- Rename dialog. Port of modal.renamefile.html + showRenameFileDialog. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formRenameFile" @submit.prevent="submit">
            <div class="modal-body">
                <fieldset>
                    <div class="form-group">
                        <label for="newname">{{ store.t('rename_filename') }} {{ filename }}:</label>
                        <input
                            v-model="newname"
                            id="newname"
                            class="form-control"
                            type="text"
                            name="newname"
                            autofocus
                        >
                    </div>
                </fieldset>
            </div>
            <div class="modal-footer">
                <button type="submit" class="btn btn-secondary" id="buttonRename">{{ store.t('file_rename') }}</button>
                <button type="button" class="btn btn-danger" id="buttonCancel" @click="store.closeModal()">
                    {{ store.t('cancel') }}
                </button>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { inject, ref } from 'vue';
import Modal from './Modal.vue';
import { renameFile } from '../store/ops.js';

const store = inject('store');
const props = defineProps({
    filename: { type: String, required: true },
});

const newname = ref(props.filename);

async function submit() {
    await renameFile(store, props.filename, newname.value);
    store.closeModal();
}
</script>
