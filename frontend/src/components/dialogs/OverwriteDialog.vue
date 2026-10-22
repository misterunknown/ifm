<template>
  <Modal :title="t('upload')">
    <div class="modal-body">
      <p>{{ t('upload_overwrite_hint') }}</p>
      <ul>
        <li v-for="name in existing" :key="name">{{ name }}</li>
      </ul>
      <p>{{ t('upload_overwrite_confirm') }}</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-primary" autofocus @click="confirm">{{ t('upload') }}</button>
      <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '../Modal.vue'
import { closeModal, uploadFiles } from '../../store'
import { t } from '../../i18n'

export interface OverwritePayload {
  files: File[]
  existing: string[]
  newfilename?: string
}

const props = defineProps<{ payload: OverwritePayload }>()

const existing = props.payload.existing

function confirm(): void {
  closeModal()
  uploadFiles(props.payload.files, props.payload.newfilename)
}
</script>
