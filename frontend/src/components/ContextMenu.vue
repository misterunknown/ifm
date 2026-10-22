<template>
  <div
    v-if="store.contextMenu && clicked"
    class="ifm-contextmenu"
    :style="{ left: menuX + 'px', top: menuY + 'px' }"
    @click.stop
  >
    <button v-if="showEdit" @click="doEdit">
      <FaIcon :icon="faIcon('fa-pencil')" class="icon" /> {{ t('edit') }}
    </button>
    <button v-if="showExtract" @click="doExtract">
      <FaIcon :icon="faIcon('fa-file-archive-o')" class="icon" /> {{ t('extract') }}
    </button>
    <button v-if="showRename" @click="doRename">
      <FaIcon :icon="faIcon('fa-terminal')" class="icon" /> {{ t('rename') }}
    </button>
    <button v-if="showCopyLink" @click="doCopyLink">
      <FaIcon :icon="faIcon('fa-external-link')" class="icon" /> {{ t('copylink') }}
    </button>
    <button v-if="showCopyMove" @click="doCopyMove">
      <FaIcon :icon="faIcon('fa-files-o')" class="icon" />
      <span>{{ t('copy') }}/{{ t('move') }}</span>
      <span v-if="selected.length > 0" class="badge bg-secondary ms-1">{{ selected.length }}</span>
    </button>
    <button v-if="showDownload" @click="doDownload">
      <FaIcon :icon="faIcon('fa-download')" class="icon" />
      <span>{{ t('download') }}</span>
      <span v-if="selected.length > 0" class="badge bg-secondary ms-1">{{ selected.length }}</span>
    </button>
    <button v-if="showArchive" @click="doArchive">
      <FaIcon :icon="faIcon('fa-file-archive-o')" class="icon" />
      <span>{{ t('create_archive') }}</span>
      <span v-if="selected.length > 0" class="badge bg-secondary ms-1">{{ selected.length }}</span>
    </button>
    <button v-if="showDelete" @click="doDelete">
      <FaIcon :icon="faIcon('fa-trash')" class="icon" />
      <span>{{ t('delete') }}</span>
      <span v-if="selected.length > 0" class="badge bg-secondary ms-1">{{ selected.length }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { clipboardLink, copyToClipboard } from '../api'
import { faIcon } from '../icons'
import { t } from '../i18n'
import { fileByGuid, getContent, notify, openModal, selectedFiles, store } from '../store'

const clicked = computed(() => (store.contextMenu ? fileByGuid(store.contextMenu.guid) : undefined))
const selected = computed(() => selectedFiles())
const cfg = computed(() => store.config)

const menuX = computed(() => Math.min(store.contextMenu?.x ?? 0, window.innerWidth - 220))
const menuY = computed(() => Math.min(store.contextMenu?.y ?? 0, window.innerHeight - 320))

const showEdit = computed(() => !!cfg.value?.edit && selected.value.length === 0 && clicked.value?.eaction === 'edit')
const showExtract = computed(
  () => !!cfg.value?.extract && selected.value.length === 0 && clicked.value?.eaction === 'extract',
)
const showRename = computed(
  () => !!cfg.value?.rename && selected.value.length === 0 && clicked.value?.name !== '..',
)
const showCopyLink = computed(() => selected.value.length === 0 && clicked.value?.name !== '..')
const showCopyMove = computed(() => !!cfg.value?.copymove && clicked.value?.name !== '..')
const showDownload = computed(() => !!cfg.value?.download && clicked.value !== undefined)
const showArchive = computed(() => !!cfg.value?.createarchive && clicked.value?.name !== '..')
const showDelete = computed(() => !!cfg.value?.delete && clicked.value?.name !== '..')

function close(): void {
  store.contextMenu = null
}

async function doEdit(): Promise<void> {
  const f = clicked.value
  close()
  if (!f) return
  const data = await getContent(f.name)
  if (data) openModal('editor', { filename: data.filename, content: data.content, isNew: false })
}

function doExtract(): void {
  const f = clicked.value
  close()
  if (f) openModal('extract', { filename: f.name })
}

function doRename(): void {
  const g = clicked.value?.guid
  close()
  if (g) openModal('rename', { guid: g })
}

async function doCopyLink(): Promise<void> {
  const f = clicked.value
  close()
  if (!f) return
  await copyToClipboard(clipboardLink(f))
  notify(t('copylink'), 'success')
}

function doCopyMove(): void {
  const guids = selected.value.length > 0 ? selected.value.map((x) => x.guid) : clicked.value ? [clicked.value.guid] : []
  close()
  if (guids.length > 0) openModal('copyMove', { guids })
}

function doDownload(): void {
  const sel = selected.value
  close()
  if (sel.length > 0) {
    notify('At the moment it is not possible to download a set of files.', 'info')
    return
  }
  const link = clicked.value?.download.link
  if (link) window.location.href = link
}

function doArchive(): void {
  const guids = selected.value.length > 0 ? selected.value.map((x) => x.guid) : clicked.value ? [clicked.value.guid] : []
  close()
  if (guids.length > 0) openModal('createArchive', { guids })
}

function doDelete(): void {
  const guids = selected.value.length > 0 ? selected.value.map((x) => x.guid) : clicked.value ? [clicked.value.guid] : []
  close()
  if (guids.length > 0) openModal('delete', { guids })
}
</script>
