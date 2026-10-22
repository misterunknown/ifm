<template>
  <EditorModal v-if="store.modal.kind === 'editor'" :payload="editorPayload" :key="editorKey" />
  <CreateDirDialog v-else-if="store.modal.kind === 'createDir'" />
  <DeleteDialog v-else-if="store.modal.kind === 'delete'" :guids="guidsPayload" />
  <RenameDialog v-else-if="store.modal.kind === 'rename'" :guid="guidPayload" />
  <CopyMoveDialog v-else-if="store.modal.kind === 'copyMove'" :guids="guidsPayload" />
  <ExtractDialog v-else-if="store.modal.kind === 'extract'" :filename="filenamePayload" />
  <UploadDialog v-else-if="store.modal.kind === 'upload'" />
  <OverwriteDialog v-else-if="store.modal.kind === 'overwrite'" :payload="overwritePayload" />
  <RemoteUploadDialog v-else-if="store.modal.kind === 'remoteUpload'" />
  <AjaxDialog v-else-if="store.modal.kind === 'ajax'" />
  <SearchDialog v-else-if="store.modal.kind === 'search'" />
  <CreateArchiveDialog v-else-if="store.modal.kind === 'createArchive'" :guids="guidsPayload" />
  <PreviewModal v-else-if="store.modal.kind === 'preview'" :guid="guidPayload" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import EditorModal, { type EditorPayload } from './EditorModal.vue'
import PreviewModal from './PreviewModal.vue'
import CreateDirDialog from './dialogs/CreateDirDialog.vue'
import DeleteDialog from './dialogs/DeleteDialog.vue'
import RenameDialog from './dialogs/RenameDialog.vue'
import CopyMoveDialog from './dialogs/CopyMoveDialog.vue'
import ExtractDialog from './dialogs/ExtractDialog.vue'
import UploadDialog from './dialogs/UploadDialog.vue'
import OverwriteDialog, { type OverwritePayload } from './dialogs/OverwriteDialog.vue'
import RemoteUploadDialog from './dialogs/RemoteUploadDialog.vue'
import AjaxDialog from './dialogs/AjaxDialog.vue'
import SearchDialog from './dialogs/SearchDialog.vue'
import CreateArchiveDialog from './dialogs/CreateArchiveDialog.vue'

const editorPayload = computed((): EditorPayload => store.modal.payload as EditorPayload)
// Remount the editor per file so ACE always starts from the opened content.
const editorKey = computed((): string => {
  const p = store.modal.payload as Partial<EditorPayload> | undefined
  return `${p?.filename ?? 'new'}:${p?.isNew === true ? 'new' : 'edit'}`
})
const guidsPayload = computed((): string[] => (store.modal.payload as { guids?: string[] } | undefined)?.guids ?? [])
const guidPayload = computed((): string => (store.modal.payload as { guid?: string } | undefined)?.guid ?? '')
const filenamePayload = computed(
  (): string => (store.modal.payload as { filename?: string } | undefined)?.filename ?? '',
)
const overwritePayload = computed((): OverwritePayload => store.modal.payload as OverwritePayload)
</script>
