<!-- Top navigation bar. Port of src/templates/app.html navbar + the static
  button bindings in IFM.initApplication. Every action button is gated by the
  same backend config flag as the legacy template. -->
<template>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark" :class="{ 'fixed-top': !store.state.config.inline }">
        <div class="container">
            <a class="navbar-brand" href="#" @click.prevent>IFM</a>
            <button
                class="navbar-toggler"
                type="button"
                aria-controls="navbarCollapse"
                :aria-expanded="open"
                :aria-label="store.t('toggle_nav')"
                @click="open = !open"
            >
                <span class="navbar-toggler-icon"></span>
            </button>
            <div id="navbarCollapse" class="navbar-collapse" :class="{ collapse: true, show: open }">
                <div class="navbar-nav me-auto">
                    <form class="d-flex mt-2 mt-md-0" @submit.prevent="gotoPath">
                        <div class="input-group">
                            <span id="currentDirLabel" class="input-group-text">
                                {{ store.t('path_content') }} {{ showpath }}
                            </span>
                            <input
                                id="currentDir"
                                v-model="pathInput"
                                class="form-control"
                                aria-describedby="currentDirLabel"
                                type="text"
                            >
                        </div>
                    </form>
                </div>
                <ul class="navbar-nav">
                    <li v-if="store.state.config.showrefresh" class="nav-item">
                        <a id="refresh" class="nav-link" @click="store.refreshFiles()">
                            <span :title="store.t('refresh')" class="fa fa-2x fa-refresh fa-fw"></span>
                            <span class="d-inline d-lg-none">{{ store.t('refresh') }}</span>
                        </a>
                    </li>
                    <li v-if="store.state.config.search" class="nav-item">
                        <a id="search" class="nav-link" @click="store.openModal('search')">
                            <span :title="store.t('search')" class="fa fa-2x fa-search fa-fw"></span>
                            <span class="d-inline d-lg-none">{{ store.t('search') }}</span>
                        </a>
                    </li>
                    <li v-if="store.state.config.upload" class="nav-item">
                        <a id="upload" class="nav-link" @click="store.openModal('upload')">
                            <span :title="store.t('upload')" class="fa fa-2x fa-upload fa-fw"></span>
                            <span class="d-inline d-lg-none">{{ store.t('upload') }}</span>
                        </a>
                    </li>
                    <li v-if="store.state.config.createfile" class="nav-item">
                        <a id="createFile" class="nav-link" @click="store.openModal('file')">
                            <span :title="store.t('file_new')" class="fa-stack">
                                <span class="fa fa-file-o fa-stack-2x fa-fw"></span>
                                <span class="fa fa-plus fa-stack-1x fa-fw"></span>
                            </span>
                            <span class="d-inline d-lg-none">{{ store.t('file_new') }}</span>
                        </a>
                    </li>
                    <li v-if="store.state.config.createdir" class="nav-item">
                        <a id="createDir" class="nav-link" @click="store.openModal('createdir')">
                            <span :title="store.t('folder_new')" class="fa-stack">
                                <span class="fa fa-fw fa-folder-o fa-stack-2x"></span>
                                <span class="fa fa-fw fa-plus fa-stack-1x"></span>
                            </span>
                            <span class="d-inline d-lg-none">{{ store.t('folder_new') }}</span>
                        </a>
                    </li>
                    <li v-if="store.state.config.remoteupload" class="nav-item">
                        <a id="buttonRemoteUpload" class="nav-link" @click="store.openModal('remoteupload')">
                            <span :title="store.t('upload_remote')" class="fa fa-2x fa-cloud-upload fa-fw"></span>
                            <span class="d-inline d-lg-none">{{ store.t('upload_remote') }}</span>
                        </a>
                    </li>
                    <li v-if="store.state.config.ajaxrequest" class="nav-item">
                        <a id="buttonAjaxRequest" class="nav-link" @click="store.openModal('ajaxrequest')">
                            <span :title="store.t('ajax_request')" class="fa fa-2x fa-external-link fa-fw"></span>
                            <span class="d-inline d-lg-none">{{ store.t('ajax_request') }}</span>
                        </a>
                    </li>
                    <li v-if="store.state.config.auth" class="nav-item">
                        <a :href="store.api.logoutUrl()" id="buttonLogout" class="nav-link">
                            <span :title="store.t('logout')" class="fa fa-2x fa-sign-out fa-fw"></span>
                            <span class="d-inline d-lg-none">{{ store.t('logout') }}</span>
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
</template>

<script setup>
import { inject, ref, watch } from 'vue';

const store = inject('store');
const open = ref(false);
const showpath = '/';
const pathInput = ref(store.state.currentDir);

watch(
    () => store.state.currentDir,
    (dir) => {
        pathInput.value = dir;
    },
);

function gotoPath() {
    store.changeDirectory(pathInput.value, { absolute: true });
    document.activeElement?.blur();
}
</script>
