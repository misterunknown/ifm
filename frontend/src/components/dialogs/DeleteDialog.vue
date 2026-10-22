<template>
  <Modal :title="t('delete')">
    <div class="modal-body">
      <p v-if="files.length > 1">{{ t('file_delete_confirm') }} <code>{{ files.length }}</code>?</p>
      <p v-else>{{ t('file_delete_confirm') }} <code>{{ files[0]?.name }}</code>?</p>
      <ul v-if="files.length > 1">
        <li v-for="f in files" :key="f.guid"><code>{{ f.name }}</code></li>
      </ul>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-danger" @click="confirm" autofocus>{{ t('delete') }}</button>
      <button type="button" class="btn btn-secondary" @click="closeModal">{{ t('cancel') }}</button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Modal from '../Modal.vue'
import { closeModal, deleteFiles, fileByGuid } from '../../store'
import { t } from '../../i18n'

const props = defineProps<{ guids: string[] }>()

const files = computed(() => props.guids.map((g) => fileByGuid(g)).filter((x) => x !== undefined))

async function confirm(): Promise<void> {
  closeModal()
  await deleteFiles(files.value)
}
</script>
