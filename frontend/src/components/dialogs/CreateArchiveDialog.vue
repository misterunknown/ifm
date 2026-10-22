<template>
  <Modal :title="t('create_archive')">
    <form @submit.prevent="submit">
      <div class="modal-body">
        <div class="mb-2">
          <label for="dlg-archivename" class="form-label">{{ t('archivename') }}:</label>
          <input id="dlg-archivename" v-model="archivename" type="text" class="form-control" autofocus />
          <div class="form-text">zip, tar, tar.gz, tar.bz2</div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-success" :disabled="!archivename">{{ t('save') }}</button>
        <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from '../Modal.vue'
import { closeModal, createArchive, fileByGuid } from '../../store'
import { t } from '../../i18n'

const props = defineProps<{ guids: string[] }>()

const archivename = ref('')
const files = computed(() => props.guids.map((g) => fileByGuid(g)).filter((x) => x !== undefined))

async function submit(): Promise<void> {
  if (!archivename.value) return
  if (await createArchive(files.value, archivename.value)) closeModal()
}
</script>
