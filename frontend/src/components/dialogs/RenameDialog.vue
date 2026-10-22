<template>
  <Modal v-if="file" :title="t('file_rename')">
    <form @submit.prevent="submit">
      <div class="modal-body">
        <div class="mb-2">
          <label for="dlg-newname" class="form-label">{{ t('rename_filename') }} {{ file.name }}:</label>
          <input id="dlg-newname" v-model="newname" type="text" class="form-control" autofocus />
        </div>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-secondary" :disabled="!canSave">{{ t('file_rename') }}</button>
        <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from '../Modal.vue'
import { closeModal, fileByGuid, renameFile } from '../../store'
import { t } from '../../i18n'

const props = defineProps<{ guid: string }>()

const file = computed(() => fileByGuid(props.guid))
const newname = ref(file.value?.name ?? '')

const canSave = computed(() => newname.value !== '' && newname.value !== file.value?.name)

async function submit(): Promise<void> {
  if (!canSave.value || !file.value) return
  closeModal()
  await renameFile(file.value.name, newname.value)
}
</script>
