<!-- Delete confirmation. Port of modal.deletefile.html + showDeleteDialog. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formDeleteFiles" @submit.prevent="confirm">
            <div class="modal-body">
                <label v-if="multiple">
                    {{ store.t('file_delete_confirm') }} <code>{{ items.length }}</code>?
                </label>
                <label v-else>{{ store.t('file_delete_confirm') }} <code>{{ singleName }}</code>?</label>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-danger" id="buttonYes" @click="confirm">
                    {{ store.t('delete') }}
                </button>
                <button type="button" class="btn btn-secondary" id="buttonNo" @click="store.closeModal()">
                    {{ store.t('cancel') }}
                </button>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { computed, inject } from 'vue';
import Modal from './Modal.vue';
import { deleteFiles } from '../store/ops.js';

const store = inject('store');
const props = defineProps({
    items: { type: [Object, Array], required: true },
});

const multiple = computed(() => Array.isArray(props.items) && props.items.length > 1);
const singleName = computed(() => (Array.isArray(props.items) ? props.items[0].name : props.items.name));

async function confirm() {
    await deleteFiles(store, props.items);
    store.closeModal();
}
</script>
