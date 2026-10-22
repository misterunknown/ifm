<template>
  <Modal :title="t('ajax_request')">
    <div class="modal-body">
      <div class="mb-2">
        <label for="dlg-ajax-url" class="form-label">URL</label>
        <input
          id="dlg-ajax-url"
          v-model="url"
          type="url"
          class="form-control"
          placeholder="https://..."
          autocomplete="off"
          autofocus
          required
          @keydown.enter.prevent="send"
        />
      </div>
      <fieldset class="mb-2">
        <legend class="col-form-label">{{ t('method') }}</legend>
        <div class="form-check form-check-inline">
          <input id="dlg-ajax-get" v-model="method" class="form-check-input" type="radio" value="GET" />
          <label class="form-check-label" for="dlg-ajax-get">GET</label>
        </div>
        <div class="form-check form-check-inline">
          <input id="dlg-ajax-post" v-model="method" class="form-check-input" type="radio" value="POST" />
          <label class="form-check-label" for="dlg-ajax-post">POST</label>
        </div>
      </fieldset>
      <div v-if="method === 'POST'" class="mb-2">
        <label for="dlg-ajax-data" class="form-label">{{ t('data') }}</label>
        <textarea id="dlg-ajax-data" v-model="data" class="form-control" rows="4"></textarea>
      </div>
      <button type="button" class="btn btn-success" :disabled="!url" @click="send">{{ t('request') }}</button>
      <div class="mt-3">
        <label for="dlg-ajax-response" class="form-label">
          {{ t('response') }}
          <span v-if="status !== null" class="badge" :class="statusOk ? 'bg-success' : 'bg-danger'">{{ status }}</span>
        </label>
        <textarea id="dlg-ajax-response" v-model="response" class="form-control" rows="6" readonly></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Modal from '../Modal.vue'
import { closeModal } from '../../store'
import { t } from '../../i18n'

const url = ref('')
const method = ref('GET')
const data = ref('')
const response = ref('')
const status = ref<number | null>(null)
const statusOk = ref(false)

async function send(): Promise<void> {
  if (!url.value) return
  status.value = null
  response.value = ''
  try {
    const res = await fetch(url.value, {
      method: method.value,
      cache: 'no-store',
      body: method.value === 'POST' ? data.value.replace(/\n/g, '&') : undefined,
    })
    status.value = res.status
    statusOk.value = res.ok
    response.value = await res.text()
  } catch (e) {
    status.value = 0
    statusOk.value = false
    response.value = e instanceof Error ? e.message : String(e)
  }
}
</script>
