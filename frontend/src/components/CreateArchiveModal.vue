<!-- Create-archive dialog. Port of modal.createarchive.html +
  showCreateArchiveDialog. Like the legacy dialog, it stays open after the
  request fires (createArchive returns false); cancel dismisses it. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formCreateArchive" @submit.prevent="submit">
            <div class="modal-body">
                <fieldset>
                    <div class="form-group">
                        <label for="archivename">{{ store.t('archivename') }}:</label>
                        <input
                            v-model="archivename"
                            id="archivename"
                            class="form-control"
                            type="text"
                            name="archivename"
                            autofocus
                        >
                    </div>
                </fieldset>
            </div>
            <div class="modal-footer">
                <button type="submit" class="btn btn-success" id="buttonSave">{{ store.t('save') }}</button>
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
import { createArchive } from '../store/ops.js';

const store = inject('store');
const props = defineProps({
    items: { type: [Object, Array], required: true },
});

const archivename = ref('');

async function submit() {
    await createArchive(store, props.items, archivename.value);
}
</script>
