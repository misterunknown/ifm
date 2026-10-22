<template>
  <Modal :title="t('folder_new')">
    <form @submit.prevent="submit">
      <div class="modal-body">
        <div class="mb-2">
          <label for="dlg-dirname" class="form-label">{{ t('directoryname') }}:</label>
          <input
            id="dlg-dirname"
            v-model="dirname"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': nameTaken }"
            autofocus
          />
          <div v-if="nameTaken" class="invalid-feedback">{{ t('name_already_exists') }}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-success" :disabled="!canSave">{{ t('create') }}</button>
        <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from '../Modal.vue'
import { closeModal, createDir, store } from '../../store'
import { t } from '../../i18n'

const dirname = ref('')

const nameTaken = computed(() => dirname.value !== '' && store.files.some((x) => x.name === dirname.value))
const canSave = computed(() => dirname.value.trim() !== '' && !nameTaken.value)

async function submit(): Promise<void> {
  if (!canSave.value) return
  if (await createDir(dirname.value)) closeModal()
}
</script>
