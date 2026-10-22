<template>
  <Modal :title="t('extract')">
    <form @submit.prevent="submit">
      <div class="modal-body">
        <p>{{ t('extract_filename') }} {{ filename }}:</p>
        <div class="input-group ifm-extract-option">
          <div class="input-group-text"><input v-model="loc" type="radio" name="extractTarget" value="./" /></div>
          <input class="form-control" type="text" placeholder="Current directory" readonly @click="loc = './'" />
        </div>
        <div class="input-group ifm-extract-option">
          <div class="input-group-text">
            <input v-model="loc" type="radio" name="extractTarget" :value="'./' + suggestion" />
          </div>
          <input class="form-control" type="text" :placeholder="suggestion" readonly @click="loc = './' + suggestion" />
        </div>
        <div class="input-group ifm-extract-option">
          <div class="input-group-text"><input v-model="loc" type="radio" name="extractTarget" value="custom" /></div>
          <input
            v-model="custom"
            type="text"
            class="form-control"
            placeholder="Custom location"
            @focus="loc = 'custom'"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-primary" autofocus>{{ t('extract') }}</button>
        <button type="button" class="btn btn-danger" @click="closeModal">{{ t('cancel') }}</button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from '../Modal.vue'
import { closeModal, extractFile } from '../../store'
import { t } from '../../i18n'

const props = defineProps<{ filename: string }>()

const suggestion = computed(() => {
  const i = props.filename.lastIndexOf('.')
  return i > 1 ? props.filename.substring(0, i) : props.filename
})

const loc = ref('./')
const custom = ref('')

async function submit(): Promise<void> {
  closeModal()
  await extractFile(props.filename, loc.value === 'custom' ? custom.value : loc.value)
}
</script>
