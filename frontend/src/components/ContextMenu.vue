<!-- Right-click context menu replacing BootstrapMenu (legacy rebuildFileTable).
  Groups, visibility rules, and badge counts mirror the legacy actions map.
  Emits `action(name)` for the parent to execute and `close` to dismiss. -->
<template>
    <teleport to="body">
        <div ref="root" class="ifm-context-menu" :style="{ left: x + 'px', top: y + 'px' }">
            <div v-if="canEdit || canExtract || canRename || canCopyLink" class="menu-group">
                <button v-if="canEdit" type="button" @click="emit('action', 'edit')">
                    <span class="icon fa fa-fw fa-pencil"></span>{{ store.t('edit') }}
                </button>
                <button v-if="canExtract" type="button" @click="emit('action', 'extract')">
                    <span class="icon fa fa-fw fa-file-archive-o"></span>{{ store.t('extract') }}
                </button>
                <button v-if="canRename" type="button" @click="emit('action', 'rename')">
                    <span class="icon fa fa-fw fa-terminal"></span>{{ store.t('rename') }}
                </button>
                <button v-if="canCopyLink" type="button" @click="emit('action', 'copylink')">
                    <span class="icon fa fa-fw fa-external-link"></span>{{ store.t('copylink') }}
                </button>
            </div>
            <div class="menu-group">
                <button v-if="canCopyMove" type="button" @click="emit('action', 'copymove')">
                    <span class="icon fa fa-fw fa-files-o"></span>
                    <span>{{ store.t('copy') }}/{{ store.t('move') }}</span>
                    <span v-if="selected.length" class="badge bg-secondary">{{ selected.length }}</span>
                </button>
                <button v-if="canDownload" type="button" @click="emit('action', 'download')">
                    <span class="icon fa fa-fw fa-download"></span>
                    <span>{{ store.t('download') }}</span>
                    <span v-if="selected.length" class="badge bg-secondary">{{ selected.length }}</span>
                </button>
                <button v-if="canArchive" type="button" @click="emit('action', 'createarchive')">
                    <span class="icon fa fa-fw fa-file-archive-o"></span>
                    <span>{{ store.t('create_archive') }}</span>
                    <span v-if="selected.length" class="badge bg-secondary">{{ selected.length }}</span>
                </button>
                <button v-if="canDelete" type="button" @click="emit('action', 'delete')">
                    <span class="icon fa fa-fw fa-trash"></span>
                    <span>{{ store.t('delete') }}</span>
                    <span v-if="selected.length" class="badge bg-secondary">{{ selected.length }}</span>
                </button>
            </div>
        </div>
    </teleport>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps({
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    clicked: { type: Object, required: true },
    selected: { type: Array, default: () => [] },
});
const emit = defineEmits(['action', 'close']);

const store = inject('store');
const root = ref(null);
const cfg = computed(() => store.state.config);

const canEdit = computed(() => cfg.value.edit && props.clicked.eaction === 'edit' && !props.selected.length);
const canExtract = computed(
    () => cfg.value.extract && props.clicked.eaction === 'extract' && !props.selected.length,
);
const canRename = computed(
    () => cfg.value.rename && !props.selected.length && props.clicked.name !== '..',
);
const canCopyLink = computed(() => !props.selected.length && props.clicked.name !== '..');
const canCopyMove = computed(() => cfg.value.copymove && props.clicked.name !== '..');
const canDownload = computed(() => !!cfg.value.download);
const canArchive = computed(() => cfg.value.createarchive && props.clicked.name !== '..');
const canDelete = computed(() => cfg.value.delete && props.clicked.name !== '..');

function onDocumentClick(e) {
    if (root.value && !root.value.contains(e.target)) emit('close');
}

function onKey(e) {
    if (e.key === 'Escape') emit('close');
}

onMounted(() => {
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKey);
});

onUnmounted(() => {
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onKey);
});
</script>
