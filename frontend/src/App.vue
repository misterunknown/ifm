<template>
  <div v-if="!store.booted" class="container mt-5 text-center">
    <FaIcon icon="spinner" spin class="icon" />
  </div>
  <div v-else-if="store.bootError" class="container mt-5">
    <div class="alert alert-danger" role="alert">{{ store.bootError }}</div>
  </div>
  <LoginForm v-else-if="!store.authenticated" />
  <template v-else>
    <Toolbar />
    <main role="main">
      <FileTable />
    </main>
    <TaskBar />
    <ModalHost />
    <ContextMenu />
    <div id="filedropoverlay" :class="{ visible: dragActive }" @dragleave="dragActive = false" @drop.prevent="onDrop">
      <h1>{{ t('upload_drop') }}</h1>
    </div>
  </template>
  <Toasts />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import Toolbar from './components/Toolbar.vue'
import FileTable from './components/FileTable.vue'
import TaskBar from './components/TaskBar.vue'
import ModalHost from './components/ModalHost.vue'
import ContextMenu from './components/ContextMenu.vue'
import LoginForm from './components/LoginForm.vue'
import Toasts from './components/Toasts.vue'
import { boot, openModal, store, uploadFiles } from './store'
import { installKeyboard } from './keyboard'
import { t } from './i18n'

const dragActive = ref(false)

function hasFiles(e: DragEvent): boolean {
  return Array.prototype.indexOf.call(e.dataTransfer?.types ?? [], 'Files') !== -1
}

function onDocumentClick(): void {
  if (store.contextMenu) store.contextMenu = null
}

function onDragOver(e: DragEvent): void {
  if (!store.config?.upload || !store.authenticated) return
  if (hasFiles(e)) {
    e.preventDefault()
    dragActive.value = true
  }
}

function onDrop(e: DragEvent): void {
  dragActive.value = false
  if (!store.config?.upload || !store.authenticated) return
  if (!hasFiles(e)) return
  e.preventDefault()
  e.stopPropagation()
  const files = [...(e.dataTransfer?.files ?? [])]
  if (files.length === 0) return
  const existingNames = store.files.map((x) => x.name)
  const existing = files.map((x) => x.name).filter((n) => existingNames.includes(n))
  if (existing.length > 0 && store.config.confirmoverwrite) {
    openModal('overwrite', { files, existing, newfilename: undefined })
  } else {
    uploadFiles(files)
  }
}

function onDragLeaveDoc(e: DragEvent): void {
  if ((e.target as HTMLElement).id === 'filedropoverlay') dragActive.value = false
}

// Safety net: never let the browser navigate away with a dropped file.
function onDropDoc(e: DragEvent): void {
  if (hasFiles(e)) e.preventDefault()
}

onMounted(() => {
  void boot()
  installKeyboard()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('dragover', onDragOver)
  document.addEventListener('dragleave', onDragLeaveDoc)
  document.addEventListener('drop', onDropDoc)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('dragover', onDragOver)
  document.removeEventListener('dragleave', onDragLeaveDoc)
  document.removeEventListener('drop', onDropDoc)
})
</script>
