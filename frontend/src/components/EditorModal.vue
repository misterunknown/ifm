<template>
  <Modal large :title="t('edit')" :cls="fullscreen ? 'editor-fullscreen' : ''">
    <form @submit.prevent="save(true)">
      <div class="modal-body">
        <div class="mb-2">
          <label for="editor-filename" class="form-label">{{ t('filename') }}:</label>
          <input
            id="editor-filename"
            v-model="filename"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': nameTaken }"
            name="filename"
            autofocus
            @keydown.enter.prevent
          />
          <div v-if="nameTaken" class="invalid-feedback">{{ t('name_already_exists') }}</div>
        </div>
        <div id="editor-content" ref="editorEl"></div>
        <div class="mt-2 d-flex gap-2">
          <button type="button" class="btn btn-secondary btn-sm" @click="showOptions = !showOptions">
            {{ t('editor_options') }}
          </button>
          <button type="button" class="btn btn-secondary btn-sm" @click="toggleFullscreen">
            <FaIcon icon="expand" />
          </button>
        </div>
        <div v-if="showOptions" class="card card-body mt-2">
          <div class="form-check form-switch">
            <input id="editor-wordwrap" v-model="wordwrap" class="form-check-input" type="checkbox" />
            <label class="form-check-label" for="editor-wordwrap">{{ t('word_wrap') }}</label>
          </div>
          <div class="form-check form-switch">
            <input id="editor-invisible-chars" v-model="invisibles" class="form-check-input" type="checkbox" />
            <label class="form-check-label" for="editor-invisible-chars">{{ t('invisible_chars') }}</label>
          </div>
          <div class="form-check form-switch">
            <input id="editor-softtabs" v-model="softtabs" class="form-check-input" type="checkbox" />
            <label class="form-check-label" for="editor-softtabs">{{ t('soft_tabs') }}</label>
          </div>
          <div class="input-group mt-2">
            <label class="input-group-text" for="editor-tabsize">{{ t('tab_size') }}</label>
            <input
              id="editor-tabsize"
              v-model.number="tabsize"
              class="form-control"
              type="number"
              min="1"
              max="9"
            />
          </div>
          <select v-model="mode" class="form-select mt-2">
            <option v-for="m in modes" :key="m" :value="m">{{ modeLabel(m) }}</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-success" :disabled="nameTaken">{{ t('save') }}</button>
        <button type="button" class="btn btn-danger" @click="requestClose">{{ t('close') }}</button>
      </div>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Modal from './Modal.vue'
import { ace, availableModes, modeForFilename, modeLabel } from '../ace'
import type { AceEditor } from '../ace-types'
import { closeModal, modalControls, saveFile, store, tryCloseModal } from '../store'
import { t } from '../i18n'

export interface EditorPayload {
  filename: string
  content: string
  isNew: boolean
}

const props = defineProps<{ payload: EditorPayload }>()

const editorEl = ref<HTMLElement | null>(null)
const filename = ref(props.payload.filename)
const originalFilename = props.payload.filename
const isNew = props.payload.isNew
const showOptions = ref(false)
const fullscreen = ref(false)
const wordwrap = ref(true)
const invisibles = ref(false)
const softtabs = ref(true)
const tabsize = ref(4)
const mode = ref(modeForFilename(props.payload.filename))
const modes = availableModes()
const dirty = ref(false)

let editor: AceEditor | null = null

const nameTaken = computed(() => {
  const v = filename.value
  return (isNew || v !== originalFilename) && store.files.some((x) => x.name === v)
})

function applyOptions(): void {
  const ed = editor
  if (!ed) return
  ed.getSession().setOption('wrap', wordwrap.value ? true : 'off')
  ed.setOption('showInvisibles', invisibles.value)
  ed.getSession().setOption('useSoftTabs', softtabs.value)
  ed.getSession().setOption('tabSize', tabsize.value)
  ed.getSession().setMode(mode.value)
  ed.resize()
}

watch([wordwrap, invisibles, softtabs, tabsize, mode], applyOptions)

function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
  window.setTimeout(() => editor?.resize(), 50)
}

async function save(stayOpen: boolean): Promise<void> {
  if (!editor || nameTaken.value) return
  const ok = await saveFile(filename.value, editor.getValue())
  if (ok) {
    dirty.value = false
    if (!stayOpen) closeModal()
  }
}

function requestClose(): void {
  tryCloseModal()
}

onMounted(() => {
  modalControls.guard = () => {
    if (dirty.value && !window.confirm(`${t('file_save_confirm')} ${filename.value}?`)) return false
    return true
  }
  if (editorEl.value) {
    editor = ace.edit(editorEl.value)
    editor.$blockScrolling = Infinity
    editor.setTheme('ace/theme/chrome')
    editor.getSession().setValue(props.payload.content)
    editor.focus()
    editor.on('change', () => {
      dirty.value = true
    })
    applyOptions()
    editor.commands.addCommand({
      name: 'toggleFullscreen',
      bindKey: 'Ctrl-Shift-F',
      exec: () => toggleFullscreen(),
    })
  }
})

onBeforeUnmount(() => {
  modalControls.guard = null
  editor?.destroy()
  editor = null
})
</script>
