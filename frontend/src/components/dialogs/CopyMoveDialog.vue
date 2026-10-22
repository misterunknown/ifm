<template>
  <Modal :title="t('select_destination')">
    <div class="modal-body">
      <label class="form-label">{{ t('select_destination') }}:</label>
      <div v-if="files.length > 0" class="mb-2 text-muted small">
        <span v-for="f in files" :key="f.guid" class="badge bg-light text-dark me-1">{{ f.name }}</span>
      </div>
      <div id="copyMoveTree">
        <FolderTree v-model:selected="dest" />
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" :disabled="!dest" autofocus @click="go('copy')">{{ t('copy') }}</button>
      <button type="button" class="btn btn-secondary" :disabled="!dest" @click="go('move')">{{ t('move') }}</button>
      <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from '../Modal.vue'
import FolderTree from '../FolderTree.vue'
import { closeModal, copyMove, fileByGuid } from '../../store'
import { t } from '../../i18n'

const props = defineProps<{ guids: string[] }>()

const dest = ref('')

const files = computed(() => props.guids.map((g) => fileByGuid(g)).filter((x) => x !== undefined))

async function go(action: 'copy' | 'move'): Promise<void> {
  if (!dest.value) return
  closeModal()
  await copyMove(files.value, dest.value, action)
}
</script>
