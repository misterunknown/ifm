<!-- Overwrite confirmation for uploads. Port of
  modal.uploadconfirmoverwrite.html + showUploadConfirmOverwrite. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formUploadConfirmOverwrite" @submit.prevent="confirm">
            <div class="modal-body">
                {{ store.t('upload_overwrite_hint') }}
            <ul>
                <li v-for="f in existing" :key="f">{{ f }}</li>
            </ul>
            {{ store.t('upload_overwrite_confirm') }}
        </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" id="buttonConfirm" @click="confirm">
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
import { inject } from 'vue';
import Modal from './Modal.vue';
import { uploadOne } from '../store/ops.js';

const store = inject('store');
const props = defineProps({
    files: { type: Array, required: true },
    existing: { type: Array, required: true },
    newfilename: { type: String, default: '' },
});

function confirm() {
    if (props.files.length === 1 && props.newfilename) uploadOne(store, props.files[0], props.newfilename);
    else props.files.forEach((file) => uploadOne(store, file));
    store.closeModal();
}
</script>
