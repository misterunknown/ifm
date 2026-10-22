<template>
  <Modal :title="t('upload_remote')">
    <form @submit.prevent="submit">
      <div class="modal-body">
        <div class="mb-2">
          <label for="dlg-remote-url" class="form-label">{{ t('upload_remote_url') }}</label>
          <input
            id="dlg-remote-url"
            v-model="url"
            type="url"
            class="form-control"
            placeholder="https://..."
            autocomplete="off"
            autofocus
            required
            @keydown.enter.prevent
          />
        </div>
        <div class="mb-2">
          <label for="dlg-remote-filename" class="form-label">{{ t('filename') }}</label>
          <input
            id="dlg-remote-filename"
            v-model="filename"
            type="text"
            class="form-control"
            :placeholder="t('filename')"
            required
            @keydown.enter.prevent
            @input="autosuggest = false"
          />
        </div>
        <fieldset class="mb-2">
          <legend class="col-form-label">{{ t('method') }}</legend>
          <div class="form-check form-check-inline">
            <input id="dlg-method-curl" v-model="method" class="form-check-input" type="radio" value="curl" />
            <label class="form-check-label" for="dlg-method-curl">cURL</label>
          </div>
          <div class="form-check form-check-inline">
            <input id="dlg-method-file" v-model="method" class="form-check-input" type="radio" value="file" />
            <label class="form-check-label" for="dlg-method-file">file</label>
          </div>
        </fieldset>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-primary">{{ t('upload') }}</button>
        <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '../Modal.vue'
import { closeModal, remoteUpload, store } from '../../store'
import { t } from '../../i18n'

const url = ref('')
const filename = ref('')
const method = ref('curl')
const autosuggest = ref(true)

watch(url, (u) => {
  if (!autosuggest.value) return
  const basename = u.split('/').pop()?.split('?')[0].split('#')[0] ?? ''
  if (!basename) return
  const existingNames = store.files.map((x) => x.name)
  let finalName = basename
  let counter = 1
  const dotIdx = basename.lastIndexOf('.')
  while (existingNames.includes(finalName)) {
    finalName =
      dotIdx > 0
        ? basename.substring(0, dotIdx) + ' (' + counter + ')' + basename.substring(dotIdx)
        : basename + ' (' + counter + ')'
    counter++
  }
  filename.value = finalName
})

async function submit(): Promise<void> {
  if (!url.value || !filename.value) return
  closeModal()
  await remoteUpload(url.value, filename.value, method.value)
}
</script>
