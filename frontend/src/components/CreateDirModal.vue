<!-- New-directory dialog. Port of modal.createdir.html + showCreateDirDialog,
  including the live name-taken validation. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formCreateDir" @submit.prevent="submit">
            <div class="modal-body">
                <fieldset>
                    <div class="form-group">
                        <label for="dirname">{{ store.t('directoryname') }}:</label>
                        <input
                            v-model="dirname"
                            class="form-control"
                            :class="{ 'is-invalid': nameTaken }"
                            id="dirname"
                            type="text"
                            name="dirname"
                            autofocus
                        >
                        <div class="invalid-feedback" id="dirnameError">
                            {{ nameTaken ? store.t('name_already_exists') : '' }}
                        </div>
                    </div>
                </fieldset>
            </div>
            <div class="modal-footer">
                <button type="submit" class="btn btn-success" id="buttonSave">{{ store.t('create') }}</button>
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
import { createDir } from '../store/ops.js';

const store = inject('store');
const dirname = ref('');

const nameTaken = computed(() => dirname.value !== '' && store.state.files.some((x) => x.name === dirname.value));

async function submit() {
    if (nameTaken.value) return;
    await createDir(store, dirname.value);
    store.closeModal();
}
</script>
