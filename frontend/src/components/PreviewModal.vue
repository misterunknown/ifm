<template>
  <Modal v-if="file" large :title="file.name">
    <div class="modal-body text-center">
      <img v-if="kind === 'image'" :src="src" class="img-fluid imgpreview" :alt="file.name" />
      <audio v-else-if="kind === 'audio'" :src="src" controls class="w-100" />
      <video v-else-if="kind === 'video'" :src="src" controls class="w-100" style="max-height: 70vh" />
      <p v-else class="text-muted">{{ t('file_display_error') }}</p>
    </div>
    <div class="modal-footer">
      <a v-if="file.download.link" class="btn btn-primary" :href="file.download.link">{{ t('download') }}</a>
      <button type="button" class="btn btn-danger" @click="closeModal">{{ t('close') }}</button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Modal from './Modal.vue'
import { downloadUrl, pathCombine, type EnrichedFile } from '../api'
import { closeModal, fileByGuid, store } from '../store'
import { t } from '../i18n'

const props = defineProps<{ guid: string }>()

const file = computed((): EnrichedFile | undefined => fileByGuid(props.guid))

const kind = computed((): 'image' | 'audio' | 'video' | 'other' => {
  const icon = file.value?.icon ?? ''
  if (icon.indexOf('file-image') !== -1) return 'image'
  if (icon.indexOf('file-audio') !== -1) return 'audio'
  if (icon.indexOf('file-video') !== -1) return 'video'
  return 'other'
})

const src = computed((): string => {
  if (!file.value || !store.config) return ''
  if (store.config.isDocroot) {
    return encodeURI(pathCombine(store.currentDir, file.value.name)).replace(/#/g, '%23').replace(/\?/g, '%3F')
  }
  return downloadUrl('proxy', store.currentDir, file.value.name)
})
</script>
