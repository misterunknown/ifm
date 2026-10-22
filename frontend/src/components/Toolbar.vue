<template>
  <nav class="navbar navbar-expand-lg navbar-dark fixed-top bg-dark">
    <div class="container">
      <a class="navbar-brand" href="#" @click.prevent="goRoot">IFM</a>
      <button
        class="navbar-toggler"
        type="button"
        :aria-label="t('toggle_nav')"
        aria-expanded="true"
        @click="collapsed = !collapsed"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" :class="{ show: !collapsed }" id="navbarCollapse">
        <div class="navbar-nav me-auto">
          <form class="d-flex mt-2 mt-md-0" @submit.prevent="gotoPath">
            <div class="input-group">
              <span class="input-group-text" id="currentDirLabel">{{ t('path_content') }}</span>
              <input
                id="currentDir"
                v-model="pathInput"
                class="form-control"
                aria-describedby="currentDirLabel"
                type="text"
              />
            </div>
          </form>
        </div>
        <ul class="navbar-nav">
          <li v-if="config.showrefresh" class="nav-item">
            <a class="nav-link" :title="t('refresh')" @click="refreshFiles">
              <FaIcon icon="arrows-rotate" class="nav-ico" /><span class="d-inline d-lg-none">{{ t('refresh') }}</span>
            </a>
          </li>
          <li v-if="config.search" class="nav-item">
            <a class="nav-link" :title="t('search')" @click="openModal('search')">
              <FaIcon icon="magnifying-glass" class="nav-ico" /><span class="d-inline d-lg-none">{{ t('search') }}</span>
            </a>
          </li>
          <li v-if="config.upload" class="nav-item">
            <a class="nav-link" :title="t('upload')" @click="openModal('upload')">
              <FaIcon icon="upload" class="nav-ico" /><span class="d-inline d-lg-none">{{ t('upload') }}</span>
            </a>
          </li>
          <li v-if="config.createfile" class="nav-item">
            <a class="nav-link" :title="t('file_new')" @click="newFile">
              <FaIcon icon="file-circle-plus" class="nav-ico" /><span class="d-inline d-lg-none">{{ t('file_new') }}</span>
            </a>
          </li>
          <li v-if="config.createdir" class="nav-item">
            <a class="nav-link" :title="t('folder_new')" @click="openModal('createDir')">
              <FaIcon icon="folder-plus" class="nav-ico" /><span class="d-inline d-lg-none">{{ t('folder_new') }}</span>
            </a>
          </li>
          <li v-if="config.remoteupload" class="nav-item">
            <a class="nav-link" :title="t('upload_remote')" @click="openModal('remoteUpload')">
              <FaIcon icon="cloud-arrow-up" class="nav-ico" /><span class="d-inline d-lg-none">{{ t('upload_remote') }}</span>
            </a>
          </li>
          <li v-if="config.ajaxrequest" class="nav-item">
            <a class="nav-link" :title="t('ajax_request')" @click="openModal('ajax')">
              <FaIcon icon="arrow-up-right-from-square" class="nav-ico" /><span class="d-inline d-lg-none">{{ t('ajax_request') }}</span>
            </a>
          </li>
          <li v-if="config.auth" class="nav-item">
            <a :href="logoutUrl()" class="nav-link" :title="t('logout')">
              <FaIcon icon="right-from-bracket" class="nav-ico" /><span class="d-inline d-lg-none">{{ t('logout') }}</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { changeDirectory, openModal, refreshFiles, store } from '../store'
import { logoutUrl } from '../api'
import { t } from '../i18n'
import type { IfmConfig } from '../api'

// Toolbar only renders once the config was loaded (see App.vue).
const config = computed((): IfmConfig => store.config as IfmConfig)
const collapsed = ref(true)
const pathInput = ref(store.currentDir)

watch(
  () => store.currentDir,
  (dir) => {
    pathInput.value = dir
  },
)

function gotoPath(): void {
  void changeDirectory(pathInput.value, { absolute: true })
  ;(document.activeElement as HTMLElement | null)?.blur?.()
}

function goRoot(): void {
  void changeDirectory('', { absolute: true })
}

function newFile(): void {
  openModal('editor', { filename: 'newfile.txt', content: '', isNew: true })
}
</script>
