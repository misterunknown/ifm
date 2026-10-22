<!-- IFM Vue root. Boot sequence mirrors IFM.init():
  getConfig -> getI18N -> checkAuth -> app (or static login dialog).
  Shell mirrors src/templates/app.html: navbar, drop overlay, file table,
  info footer. Dialogs render from the single store.modal slot. -->
<template>
    <div v-if="bootError" class="container mt-5">
        <div class="alert alert-danger" role="alert">{{ bootError }}</div>
    </div>
    <template v-else-if="store.state.config">
        <Navbar />
        <div id="filedropoverlay" :class="{ visible: overlayVisible }">
            <h1>{{ store.t('upload_drop') }}</h1>
        </div>
        <main role="main">
            <FileTable />
            <div class="container">
                <div class="card ifminfo">
                    <div class="card-body p-2">
                        <div class="ifminfo-footer-text">
                            {{ store.t('footer') }}
                            <a :href="`https://github.com/misterunknown/ifm/releases/tag/${version}`" target="_blank">{{
                                version
                            }}</a>
                        </div>
                        <a
                            class="ifminfo-github-link"
                            href="http://github.com/misterunknown/ifm"
                            target="_blank"
                            :title="store.t('github')"
                        >
                            <span class="icon fa fa-github"></span>
                        </a>
                    </div>
                </div>
            </div>
        </main>
        <component
            :is="modalComponent"
            v-if="store.state.modal"
            v-bind="store.state.modal.props"
        />
        <LoginModal v-if="store.state.authed === false" @logged-in="initApplication" />
        <Toasts />
        <TasksFooter />
    </template>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import Navbar from './components/Navbar.vue';
import FileTable from './components/FileTable.vue';
import LoginModal from './components/LoginModal.vue';
import FileEditorModal from './components/FileEditorModal.vue';
import CreateDirModal from './components/CreateDirModal.vue';
import DeleteModal from './components/DeleteModal.vue';
import RenameModal from './components/RenameModal.vue';
import CopyMoveModal from './components/CopyMoveModal.vue';
import ExtractModal from './components/ExtractModal.vue';
import UploadModal from './components/UploadModal.vue';
import OverwriteModal from './components/OverwriteModal.vue';
import RemoteUploadModal from './components/RemoteUploadModal.vue';
import AjaxModal from './components/AjaxModal.vue';
import SearchModal from './components/SearchModal.vue';
import CreateArchiveModal from './components/CreateArchiveModal.vue';
import Toasts from './components/Toasts.vue';
import TasksFooter from './components/TasksFooter.vue';
import { APP_VERSION } from './store/index.js';
import { installGlobalHandlers } from './store/keybindings.js';
import { findExisting, uploadOne } from './store/ops.js';

const store = inject('store');
const bootError = ref('');
const overlayVisible = ref(false);
const version = APP_VERSION;
let uninstallKeys = null;

const MODALS = {
    file: FileEditorModal,
    createdir: CreateDirModal,
    delete: DeleteModal,
    rename: RenameModal,
    copymove: CopyMoveModal,
    extract: ExtractModal,
    upload: UploadModal,
    overwrite: OverwriteModal,
    remoteupload: RemoteUploadModal,
    ajaxrequest: AjaxModal,
    search: SearchModal,
    createarchive: CreateArchiveModal,
};

const modalComponent = computed(() => (store.state.modal ? MODALS[store.state.modal.name] : null));

async function initApplication() {
    store.state.authed = true;
    if (window.location.hash) {
        await store.changeDirectory(decodeURIComponent(window.location.hash.substring(1)));
    } else {
        await store.refreshFiles();
    }
}

async function boot() {
    try {
        const config = await store.api.getConfig();
        store.state.config = config;
        if (config.csrf_token) store.api.setCsrfToken(config.csrf_token);
    } catch {
        bootError.value = store.t('load_config_error');
        return;
    }
    try {
        store.state.i18n = await store.api.getI18N();
    } catch {
        bootError.value = store.t('load_text_error');
        return;
    }
    let auth;
    try {
        auth = await store.api.checkAuth();
    } catch {
        bootError.value = store.t('general_error');
        return;
    }
    if (auth.status === 'ERROR') {
        store.state.authed = false;
        return;
    }
    await initApplication();
}

// -- drag & drop upload overlay (legacy initApplication dragover handler) ------
function isFileEvent(e) {
    return Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1;
}

function onDragOver(e) {
    if (!store.state.config?.upload || !store.state.authed) return;
    if (isFileEvent(e)) {
        e.preventDefault();
        e.stopPropagation();
        overlayVisible.value = true;
    }
}

function onDragLeave(e) {
    if (e.target.id === 'filedropoverlay') overlayVisible.value = false;
}

function onDrop(e) {
    if (!overlayVisible.value) return;
    e.preventDefault();
    e.stopPropagation();
    overlayVisible.value = false;
    if (!isFileEvent(e)) return;
    const files = Array.from(e.dataTransfer.files);
    const existing = findExisting(store, files.map((x) => x.name));
    if (existing.length > 0 && store.state.config.confirmoverwrite) {
        store.openModal('overwrite', { files, existing, newfilename: '' });
    } else {
        files.forEach((file) => uploadOne(store, file));
    }
}

onMounted(() => {
    uninstallKeys = installGlobalHandlers(store);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    boot();
});

onBeforeUnmount(() => {
    if (uninstallKeys) uninstallKeys();
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('drop', onDrop);
});
</script>
