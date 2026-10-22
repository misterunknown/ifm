<template>
  <Modal :title="t('upload')">
    <form @submit.prevent="submit">
      <div class="modal-body">
        <div class="mb-3">
          <label class="form-label" for="dlg-fileselect">{{ t('upload_file') }}</label>
          <input id="dlg-fileselect" type="file" class="form-control" multiple @change="onSelect" />
        </div>
        <div v-if="pending.length > 0" class="mb-3">
          <ul id="uploadFileList" class="list-group list-group-flush border rounded">
            <li
              v-for="(f, i) in pending"
              :key="fingerprint(f)"
              class="list-group-item d-flex justify-content-between align-items-center py-2"
            >
              <span class="text-truncate me-2" :title="f.name">{{ f.name }}</span>
              <button type="button" class="btn btn-sm btn-link text-danger p-0 flex-shrink-0" @click="pending.splice(i, 1)">
                <FaIcon icon="trash" />
              </button>
            </li>
          </ul>
        </div>
        <div v-if="pending.length === 1" class="mb-0">
          <label class="visually-hidden" for="dlg-newfilename">{{ t('filename_new') }}</label>
          <input
            id="dlg-newfilename"
            v-model="newfilename"
            type="text"
            class="form-control"
            :placeholder="t('filename_new')"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-primary" :disabled="pending.length === 0" autofocus>
          {{ t('upload') }}
        </button>
        <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Modal from '../Modal.vue'
import { closeModal, notify, openModal, store, uploadFiles } from '../../store'
import { t } from '../../i18n'

const pending = ref<File[]>([])
const newfilename = ref('')

function fingerprint(f: File): string {
  return `${f.name}\0${f.size}\0${f.lastModified}`
}

function onSelect(e: Event): void {
  const input = e.target as HTMLInputElement
  const added = [...(input.files ?? [])]
  const seen = new Set(pending.value.map(fingerprint))
  for (const f of added) {
    const fp = fingerprint(f)
    if (!seen.has(fp)) {
      seen.add(fp)
      pending.value.push(f)
    }
  }
  input.value = ''
}

function submit(): void {
  if (pending.value.length === 0) {
    notify(t('upload_no_file'), 'danger')
    return
  }
  const existingNames = store.files.map((x) => x.name)
  let existing: string[]
  if (pending.value.length > 1) {
    existing = pending.value.map((x) => x.name).filter((n) => existingNames.includes(n))
  } else if (newfilename.value) {
    existing = existingNames.includes(newfilename.value) ? [newfilename.value] : []
  } else {
    existing = existingNames.includes(pending.value[0].name) ? [pending.value[0].name] : []
  }
  const files = [...pending.value]
  const rename = newfilename.value || undefined
  if (existing.length > 0 && store.config?.confirmoverwrite) {
    openModal('overwrite', { files, existing, newfilename: rename })
  } else {
    closeModal()
    uploadFiles(files, rename)
  }
}
</script>
