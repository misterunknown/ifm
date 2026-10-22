<!-- Copy/move dialog. Port of modal.copymove.html + showCopyMoveDialog:
  lazy folder tree for the destination, copy/move/cancel actions.

  One deliberate difference: Copy/Move stay disabled until a destination is
  selected. The legacy dialog throws on click without a selection (reading
  .dataset of undefined) and silently does nothing. -->
<template>
    <Modal @close="store.closeModal()">
        <form id="formCopyMove" @submit.prevent>
            <div class="modal-body">
                <div class="form-group">
                    <label for="copyMoveTree">{{ store.t('select_destination') }}:</label>
                <div id="copyMoveTree">
                    <div v-if="loading" class="text-center"><span class="icon fa fa-spinner fa-spin"></span></div>
                    <FolderTree
                        v-else
                        :nodes="roots"
                        :meta="meta"
                        :selected-path="selected"
                        @select="selected = $event"
                        @toggle="toggle"
                    />
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button
                type="button"
                class="btn btn-secondary"
                id="copyButton"
                :disabled="!selected"
                @click="submit('copy')"
            >
                {{ store.t('copy') }}
            </button>
            <button
                type="button"
                class="btn btn-secondary"
                id="moveButton"
                :disabled="!selected"
                @click="submit('move')"
            >
                {{ store.t('move') }}
            </button>
                <button type="button" class="btn btn-danger" id="cancelButton" @click="store.closeModal()">
                    {{ store.t('cancel') }}
                </button>
            </div>
        </form>
    </Modal>
</template>

<script setup>
import { inject, onMounted, reactive, ref } from 'vue';
import Modal from './Modal.vue';
import FolderTree from './FolderTree.vue';
import { copyMove } from '../store/ops.js';

const store = inject('store');
const props = defineProps({
    items: { type: [Object, Array], required: true },
});

const roots = ref([]);
const loading = ref(true);
const selected = ref('');
const meta = reactive({});

async function loadChildren(path) {
    // NOTE: read back through the proxy — `meta[path] ??= {...}` would hand
    // back the raw literal, and later mutations would bypass reactivity
    // (fetched children would never render).
    if (!meta[path]) meta[path] = { expanded: false, loading: false, children: null };
    const entry = meta[path];
    if (entry.children) {
        entry.expanded = !entry.expanded;
        return;
    }
    entry.loading = true;
    try {
        entry.children = await store.api.getFolders(path);
        entry.expanded = true;
    } catch {
        entry.children = [];
    } finally {
        entry.loading = false;
    }
}

function toggle(node) {
    if (node.lazyLoad) loadChildren(node.dataAttr.path);
}

onMounted(async () => {
    try {
        roots.value = await store.api.getFolders();
    } catch {
        store.closeModal();
        store.notifyError(store.t('folder_tree_load_error'));
    } finally {
        loading.value = false;
    }
});

async function submit(action) {
    if (!selected.value) return;
    await copyMove(store, props.items, selected.value, action);
    store.closeModal();
}
</script>
