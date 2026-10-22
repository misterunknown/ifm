<template>
  <div class="container">
    <div class="d-flex align-items-center mb-2 gap-2">
      <input
        v-model="store.filter"
        class="form-control"
        :placeholder="t('filter')"
        style="max-width: 300px"
        @input="store.page = 1"
      />
      <span v-if="store.filesLoading" class="ms-2"><FaIcon icon="spinner" spin /></span>
    </div>
    <table id="filetable" class="table">
      <thead>
        <tr>
          <th class="th-filename all sortable" @click="toggleSort('name')">
            {{ t('filename') }}<span class="sort-ind">{{ sortInd('name') }}</span>
          </th>
          <th v-if="cfg.download" class="th-download all"></th>
          <th v-if="cfg.showlastmodified" class="th-lastmod sortable" @click="toggleSort('date')">
            {{ t('last_modified') }}<span class="sort-ind">{{ sortInd('date') }}</span>
          </th>
          <th v-if="cfg.showfilesize" class="th-size sortable" @click="toggleSort('size')">
            {{ t('size') }}<span class="sort-ind">{{ sortInd('size') }}</span>
          </th>
          <th v-if="cfg.showpermissions" class="th-permissions d-none d-md-table-cell">{{ t('permissions') }}</th>
          <th v-if="cfg.showowner" class="th-owner d-none d-lg-table-cell">{{ t('owner') }}</th>
          <th v-if="cfg.showgroup" class="th-group d-none d-xl-table-cell">{{ t('group') }}</th>
          <th class="th-buttons buttons all"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="f in pageRows"
          :key="f.guid"
          class="clickable-row"
          :class="[f.rowclasses, { selectedItem: store.selected.has(f.guid), highlightedItem: store.highlighted === f.guid }]"
          :data-guid="f.guid"
          :draggable="f.draggable && canMove"
          tabindex="0"
          @click="rowClick($event, f)"
          @focus="store.highlighted = f.guid"
          @contextmenu.prevent="openMenu($event, f)"
          @dragstart="dragStart($event, f)"
          @dragover="dragOver($event, f)"
          @dragleave="dragLeave($event)"
          @drop="drop($event, f)"
        >
          <td>
            <a
              :id="f.guid"
              class="ifmitem"
              :href="f.link"
              tabindex="0"
              @click="itemClick($event, f)"
              @mouseenter="hoverPreview($event, f)"
              @mousemove="movePreview($event)"
              @mouseleave="hidePreview"
            >
              <FaIcon :icon="faIcon(f.icon)" class="icon" />
              {{ f.linkname }}
            </a>
          </td>
          <td v-if="cfg.download">
            <a v-if="f.download.link" :href="f.download.link" :title="t('download')">
              <FaIcon :icon="faIcon(f.download.icon ?? '')" class="icon" />
            </a>
          </td>
          <td v-if="cfg.showlastmodified">{{ f.lastmodified_hr }}</td>
          <td v-if="cfg.showfilesize">{{ f.size }}</td>
          <td v-if="cfg.showpermissions" class="td-permissions d-none d-md-table-cell">
            <input
              type="text"
              size="11"
              name="newpermissions"
              class="form-control"
              :value="f.fileperms"
              :readonly="f.readonly || !canChmod"
              :disabled="!canChmod"
              @keyup.enter="commitPerm(f, $event)"
              @click.stop
            />
          </td>
          <td v-if="cfg.showowner" class="d-none d-lg-table-cell">{{ f.owner }}</td>
          <td v-if="cfg.showgroup" class="d-none d-xl-table-cell">{{ f.group }}</td>
          <td>
            <a
              v-for="b in f.buttons"
              :key="b.action"
              tabindex="0"
              :title="b.title"
              @click.stop="doButton(b.action, f)"
              @keyup.enter="doButton(b.action, f)"
            >
              <FaIcon :icon="faIcon(b.icon)" class="icon" />
            </a>
          </td>
        </tr>
        <tr v-if="pageRows.length === 0">
          <td :colspan="colCount" class="text-center text-muted">—</td>
        </tr>
      </tbody>
    </table>
    <nav v-if="cfg.paging && totalPages > 1" aria-label="pagination">
      <ul class="pagination pagination-sm">
        <li class="page-item" :class="{ disabled: store.page <= 1 }">
          <a class="page-link" @click="store.page = Math.max(1, store.page - 1)">‹</a>
        </li>
        <li class="page-item disabled">
          <span class="page-link">{{ store.page }} / {{ totalPages }}</span>
        </li>
        <li class="page-item" :class="{ disabled: store.page >= totalPages }">
          <a class="page-link" @click="store.page = Math.min(totalPages, store.page + 1)">›</a>
        </li>
      </ul>
    </nav>
  </div>
  <div v-if="preview" class="ifm-hover-preview" :style="{ left: preview.x + 'px', top: preview.y + 'px' }">
    <img :src="preview.src" class="imgpreview" alt="" />
  </div>
  <div class="container">
    <div class="card ifminfo">
      <div class="card-body p-2">
        <div class="ifminfo-footer-text">
          {{ t('footer') }}
          <a href="https://github.com/misterunknown/ifm/releases/tag/IFM_VERSION" target="_blank">IFM_VERSION</a>
        </div>
        <a
          class="ifminfo-github-link"
          href="http://github.com/misterunknown/ifm"
          target="_blank"
          :title="t('github')"
        >
          <FaIcon icon="fa-brands fa-github" class="icon" />
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  changeDirectory,
  changePermissions,
  copyMove,
  fileByGuid,
  getContent,
  openModal,
  selectedFiles,
  store,
  toggleSelect,
} from '../store'
import { downloadUrl, pathCombine, type EnrichedFile, type FileButton } from '../api'
import { faIcon } from '../icons'
import { t } from '../i18n'
import type { IfmConfig } from '../api'

const cfg = computed((): IfmConfig => store.config as IfmConfig)
const canMove = computed(() => !!cfg.value.copymove)
const canChmod = computed(() => !!cfg.value.chmod)

const colCount = computed(() => {
  let n = 2 // name + buttons
  if (cfg.value.download) n++
  if (cfg.value.showlastmodified) n++
  if (cfg.value.showfilesize) n++
  if (cfg.value.showpermissions) n++
  if (cfg.value.showowner) n++
  if (cfg.value.showgroup) n++
  return n
})

// --- sorting / filtering / pagination (replaces DataTables) ---
// Like the legacy DataTables `stateSave`, the view state survives reloads.

const TABLE_STATE_KEY = 'ifm-table-state'

interface TableState {
  sortKey: 'name' | 'size' | 'date'
  sortDir: 1 | -1
  filter: string
  page: number
}

function saveTableState(): void {
  try {
    const state: TableState = { sortKey: store.sortKey, sortDir: store.sortDir, filter: store.filter, page: store.page }
    window.localStorage.setItem(TABLE_STATE_KEY, JSON.stringify(state))
  } catch {
    // private mode etc. — the table simply starts unsorted
  }
}

function restoreTableState(): void {
  try {
    const raw = window.localStorage.getItem(TABLE_STATE_KEY)
    if (!raw) return
    const state = JSON.parse(raw) as Partial<TableState>
    if (state.sortKey === 'name' || state.sortKey === 'size' || state.sortKey === 'date') store.sortKey = state.sortKey
    if (state.sortDir === 1 || state.sortDir === -1) store.sortDir = state.sortDir
    if (typeof state.filter === 'string') store.filter = state.filter
    if (typeof state.page === 'number' && state.page >= 1) store.page = state.page
  } catch {
    // corrupt state — start fresh
  }
}

onMounted(restoreTableState)
watch([() => store.sortKey, () => store.sortDir, () => store.filter, () => store.page], saveTableState)

function toggleSort(key: 'name' | 'size' | 'date'): void {
  if (store.sortKey === key) store.sortDir = store.sortDir === 1 ? -1 : 1
  else {
    store.sortKey = key
    store.sortDir = 1
  }
}

function sortInd(key: 'name' | 'size' | 'date'): string {
  if (store.sortKey !== key) return '↕'
  return store.sortDir === 1 ? '▲' : '▼'
}

const visibleRows = computed((): EnrichedFile[] => {
  const q = store.filter.trim().toLowerCase()
  const rows = (q ? store.files.filter((f) => f.name.toLowerCase().includes(q)) : [...store.files]).sort((a, b) => {
    if (a.name === '..') return -1
    if (b.name === '..') return 1
    let cmp: number
    if (store.sortKey === 'size') cmp = (a.size_raw ?? 0) - (b.size_raw ?? 0)
    else if (store.sortKey === 'date') cmp = (a.lastmodified ?? 0) - (b.lastmodified ?? 0)
    else cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    return cmp * store.sortDir
  })
  return rows
})

const pageLength = computed(() => cfg.value.pageLength || 50)
const totalPages = computed(() => Math.max(1, Math.ceil(visibleRows.value.length / pageLength.value)))
const pageRows = computed((): EnrichedFile[] => {
  if (!cfg.value.paging) return visibleRows.value
  if (store.page > totalPages.value) store.page = totalPages.value
  const start = (store.page - 1) * pageLength.value
  return visibleRows.value.slice(start, start + pageLength.value)
})

// --- row actions ---

async function editFlow(f: EnrichedFile): Promise<void> {
  const data = await getContent(f.name)
  if (data) openModal('editor', { filename: data.filename, content: data.content, isNew: false })
}

function doButton(action: FileButton['action'], f: EnrichedFile): void {
  if (action === 'edit') void editFlow(f)
  else if (action === 'extract') openModal('extract', { filename: f.name })
  else if (action === 'copymove') {
    const sel = selectedFiles()
    openModal('copyMove', { guids: sel.length > 0 ? sel.map((x) => x.guid) : [f.guid] })
  } else if (action === 'rename') openModal('rename', { guid: f.guid })
  else if (action === 'delete') {
    const sel = selectedFiles()
    openModal('delete', { guids: sel.length > 0 ? sel.map((x) => x.guid) : [f.guid] })
  }
}

function itemClick(e: MouseEvent, f: EnrichedFile): void {
  if (f.type === 'dir') {
    e.preventDefault()
    e.stopPropagation()
    void changeDirectory(f.name)
    return
  }
  // Files navigate to their link (download/proxy/public URL). When there is
  // no usable link, media files open in the preview instead of going nowhere.
  if ((!f.link || f.link === '#') && (isPreviewable(f) || f.eaction === 'edit')) {
    e.preventDefault()
    if (isPreviewable(f)) openModal('preview', { guid: f.guid })
    else void editFlow(f)
  }
}

function rowClick(e: MouseEvent, f: EnrichedFile): void {
  const target = e.target as HTMLElement
  if (target.closest('a, input, button')) return
  if ((e.ctrlKey || e.metaKey) && f.name !== '..') toggleSelect(f.guid)
  store.highlighted = f.guid
}

function commitPerm(f: EnrichedFile, e: Event): void {
  const input = e.target as HTMLInputElement
  void changePermissions(f.name, input.value)
}

function openMenu(e: MouseEvent, f: EnrichedFile): void {
  store.highlighted = f.guid
  store.contextMenu = { x: e.clientX, y: e.clientY, guid: f.guid }
}

// --- media helpers ---

function isPreviewable(f: EnrichedFile): boolean {
  return f.icon.indexOf('file-image') !== -1 || f.icon.indexOf('file-audio') !== -1 || f.icon.indexOf('file-video') !== -1
}

function previewSrc(f: EnrichedFile): string {
  if (cfg.value.isDocroot) {
    return encodeURI(pathCombine(store.currentDir, f.name)).replace(/#/g, '%23').replace(/\?/g, '%3F')
  }
  return downloadUrl('proxy', store.currentDir, f.name)
}

// --- hover image preview (desktop only, like the legacy popover) ---

const preview = ref<{ src: string; x: number; y: number } | null>(null)

function hoverPreview(e: MouseEvent, f: EnrichedFile): void {
  if (!f.popover || f.type !== 'file') return
  preview.value = { src: previewSrc(f), x: e.clientX + 16, y: e.clientY + 16 }
}

function movePreview(e: MouseEvent): void {
  if (preview.value) {
    preview.value.x = e.clientX + 16
    preview.value.y = e.clientY + 16
  }
}

function hidePreview(): void {
  preview.value = null
}

// --- drag & drop move between directories ---

function dragStart(e: DragEvent, f: EnrichedFile): void {
  if (!e.dataTransfer || !canMove.value) return
  const sel = selectedFiles()
  const guids = sel.length > 0 && store.selected.has(f.guid) ? sel.map((x) => x.guid) : [f.guid]
  e.dataTransfer.setData('text/plain', JSON.stringify(guids))
}

function dragOver(e: DragEvent, f: EnrichedFile): void {
  if (!e.dataTransfer || !canMove.value || f.type !== 'dir') return
  // OS file drags carry "Files" types and are handled by the drop overlay.
  if (Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).classList.add('highlightedItem')
}

function dragLeave(e: DragEvent): void {
  ;(e.currentTarget as HTMLElement).classList.remove('highlightedItem')
}

function drop(e: DragEvent, dest: EnrichedFile): void {
  if (!e.dataTransfer || !canMove.value || dest.type !== 'dir') return
  if (Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) return
  e.preventDefault()
  e.stopPropagation()
  document.querySelectorAll('.highlightedItem').forEach((el) => el.classList.remove('highlightedItem'))
  try {
    const guids = JSON.parse(e.dataTransfer.getData('text/plain')) as string[]
    const sources = guids.map((g) => fileByGuid(g)).filter((x): x is EnrichedFile => !!x && x.name !== '..')
    if (sources.length === 0) return
    if (sources.some((s) => s.name === dest.name)) return
    void copyMove(sources, dest.name, 'move')
  } catch {
    // ignore malformed drags
  }
}
</script>
