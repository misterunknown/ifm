// Central state + all backend actions. Every toolbar button, context menu
// entry, keyboard shortcut and dialog funnels through these actions so the
// behavior stays identical no matter how it was triggered.
import { reactive } from 'vue'
import {
  ApiError,
  apiPost,
  apiUpload,
  enrichFileList,
  guid,
  pathCombine,
  setCsrfToken,
} from './api'
import type { EnrichedFile, FileItem, IfmConfig, SearchResult } from './api'
import { loadI18n, t } from './i18n'

export type ModalKind =
  | 'editor'
  | 'createDir'
  | 'delete'
  | 'rename'
  | 'copyMove'
  | 'extract'
  | 'upload'
  | 'overwrite'
  | 'remoteUpload'
  | 'ajax'
  | 'search'
  | 'createArchive'
  | 'preview'

export interface Task {
  id: string
  name: string
  progress: number | null
}

export interface Toast {
  id: string
  message: string
  kind: 'success' | 'danger' | 'info'
}

export interface PendingUpload {
  file: File
}

const ARCHIVE_FORMATS = ['.tar.bz2', '.tar.gz', '.zip', '.tar'] as const

export const store = reactive({
  config: null as IfmConfig | null,
  booted: false,
  bootError: '',
  authenticated: false,
  loginError: '',
  loginBusy: false,
  currentDir: '',
  files: [] as EnrichedFile[],
  filesLoading: false,
  selected: new Set<string>(),
  highlighted: '',
  sortKey: 'name' as 'name' | 'size' | 'date',
  sortDir: 1 as 1 | -1,
  filter: '',
  page: 1,
  tasks: [] as Task[],
  tasksExpanded: false,
  toasts: [] as Toast[],
  modal: { kind: null as ModalKind | null, payload: undefined as unknown } as {
    kind: ModalKind | null
    payload?: unknown
  },
  contextMenu: null as { x: number; y: number; guid: string } | null,
  searchBaseDir: '',
  searchPattern: '',
  searchResults: [] as SearchResult[],
  searchBusy: false,
  // folder tree selection inside the copy/move dialog
  copyMoveDest: '',
})

function authErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const key = e.message
    // ApiError carries the raw backend message or an i18n key for local
    // failures; t() falls back to the message itself when unknown.
    return t(key) === key && key !== 'general_error' ? key : t(key)
  }
  return t('general_error')
}

export function notify(message: string, kind: Toast['kind'] = 'info'): void {
  const id = guid()
  store.toasts.push({ id, message, kind })
  window.setTimeout(() => {
    const i = store.toasts.findIndex((x) => x.id === id)
    if (i >= 0) store.toasts.splice(i, 1)
  }, 3000)
}

export function notifyError(e: unknown): void {
  notify(authErrorMessage(e), 'danger')
}

export function taskAdd(name: string): string {
  const id = guid()
  store.tasks.unshift({ id, name, progress: null })
  return id
}

export function taskUpdate(id: string, progress: number): void {
  const task = store.tasks.find((x) => x.id === id)
  if (task) task.progress = progress
}

export function taskDone(id: string): void {
  const i = store.tasks.findIndex((x) => x.id === id)
  if (i >= 0) store.tasks.splice(i, 1)
}

// --- boot (mirrors initLoadConfig -> initLoadI18N -> initCheckAuth) ---

export async function boot(): Promise<void> {
  try {
    const config = await apiPost<IfmConfig>('getConfig', {})
    setCsrfToken(config.csrf_token ?? '')
    store.config = config
    try {
      await loadI18n()
    } catch {
      // boot fallback (English) stays active
    }
    try {
      await apiPost('checkAuth', {})
      store.authenticated = true
      enterApp()
    } catch {
      store.authenticated = false
    }
    store.booted = true
  } catch (e) {
    store.bootError = authErrorMessage(e)
    store.booted = true
  }
}

export async function login(username: string, password: string): Promise<void> {
  store.loginBusy = true
  store.loginError = ''
  try {
    await apiPost('checkAuth', { inputLogin: username, inputPassword: password })
    store.authenticated = true
    enterApp()
  } catch (e) {
    store.loginError = authErrorMessage(e)
  } finally {
    store.loginBusy = false
  }
}

function enterApp(): void {
  const hash = window.location.hash ? decodeURIComponent(window.location.hash.substring(1)) : ''
  void changeDirectory(hash, { absolute: true, pushState: false })
  window.onpopstate = (e: PopStateEvent) => {
    const state = e.state as { dir?: string } | null
    void changeDirectory(state && state.dir ? state.dir : '', { absolute: true, pushState: false })
  }
  window.onbeforeunload = (e: BeforeUnloadEvent) => {
    if (store.tasks.length > 0) {
      e.preventDefault()
    }
  }
}

// --- navigation ---

export async function changeDirectory(
  newdir: string,
  options: { absolute?: boolean; pushState?: boolean } = {},
): Promise<void> {
  const { absolute = false, pushState = true } = options
  const target = absolute ? newdir : pathCombine(store.currentDir, newdir)
  try {
    const data = await apiPost<{ realpath: string }>('getRealpath', { dir: target })
    store.currentDir = data.realpath
    store.selected.clear()
    store.highlighted = ''
    store.page = 1
    await refreshFiles()
    if (pushState) {
      window.history.pushState({ dir: store.currentDir }, store.currentDir, '#' + encodeURIComponent(store.currentDir))
    }
  } catch (e) {
    notifyError(e)
  }
}

export async function refreshFiles(): Promise<void> {
  if (!store.config) return
  store.filesLoading = true
  const taskId = taskAdd(t('refresh'))
  try {
    const data = await apiPost<FileItem[]>('getFiles', { dir: store.currentDir })
    if (!Array.isArray(data)) {
      notify(t('invalid_data'), 'danger')
      return
    }
    store.files = enrichFileList(data, store.config, store.currentDir)
    // drop selection/highlight of rows that no longer exist
    const guids = new Set(store.files.map((f) => f.guid))
    for (const g of [...store.selected]) if (!guids.has(g)) store.selected.delete(g)
    if (store.highlighted && !guids.has(store.highlighted)) store.highlighted = ''
  } catch (e) {
    notifyError(e)
  } finally {
    store.filesLoading = false
    taskDone(taskId)
  }
}

// --- selection helpers ---

export function fileByGuid(g: string): EnrichedFile | undefined {
  return store.files.find((f) => f.guid === g)
}

export function selectedFiles(): EnrichedFile[] {
  return store.files.filter((f) => store.selected.has(f.guid))
}

export function toggleSelect(g: string): void {
  if (store.selected.has(g)) store.selected.delete(g)
  else store.selected.add(g)
}

// --- file operations (all refresh the table + toast on success) ---

export async function saveFile(filename: string, content: string): Promise<boolean> {
  try {
    await apiPost('saveFile', { dir: store.currentDir, filename, content })
    notify(t('file_save_success'), 'success')
    await refreshFiles()
    return true
  } catch (e) {
    notifyError(e)
    return false
  }
}

export async function createDir(dirname: string): Promise<boolean> {
  try {
    await apiPost('createDir', { dir: store.currentDir, dirname })
    notify(t('folder_create_success'), 'success')
    await refreshFiles()
    return true
  } catch (e) {
    notifyError(e)
    return false
  }
}

export async function deleteFiles(items: EnrichedFile[]): Promise<void> {
  try {
    await apiPost('delete', { dir: store.currentDir, filenames: items.map((f) => f.name) })
    notify(t('file_delete_success'), 'success')
    store.selected.clear()
    await refreshFiles()
  } catch (e) {
    notifyError(e)
  }
}

export async function renameFile(filename: string, newname: string): Promise<void> {
  try {
    await apiPost('rename', { dir: store.currentDir, filename, newname })
    notify(t('file_rename_success'), 'success')
    await refreshFiles()
  } catch (e) {
    notifyError(e)
  }
}

export async function copyMove(sources: EnrichedFile[], destination: string, action: 'copy' | 'move'): Promise<void> {
  const id = taskAdd(`${t(action)} ${sources.length > 1 ? sources.length : sources[0].name} ${t('file_copy_to')} ${destination}`)
  try {
    const data = await apiPost<{ status: string; message: string }>('copyMove', {
      dir: store.currentDir,
      action,
      filenames: sources.map((f) => f.name),
      destination,
    })
    notify(data.message, 'success')
    store.selected.clear()
    await refreshFiles()
  } catch (e) {
    notifyError(e)
  } finally {
    taskDone(id)
  }
}

export async function extractFile(filename: string, targetdir: string): Promise<void> {
  const id = taskAdd(`extract ${filename}`)
  try {
    const data = await apiPost<{ status: string; message: string }>('extract', {
      dir: store.currentDir,
      filename,
      targetdir,
    })
    notify(data.message, 'success')
    await refreshFiles()
  } catch (e) {
    notifyError(e)
  } finally {
    taskDone(id)
  }
}

export function uploadFiles(files: File[], newfilename?: string): void {
  // Single-file rename only applies to single uploads (legacy behavior).
  const dir = store.currentDir
  for (const file of files) {
    // progress stays null (indeterminate bar) until the first progress event,
    // matching the legacy taskbar behavior
    const id = taskAdd(`Upload ${file.name}`)
    apiUpload(dir, file, files.length === 1 ? newfilename : undefined, (ratio) => taskUpdate(id, ratio * 100))
      .then((data) => {
        notify(t('file_upload_success'), 'success')
        if (!data.cd || data.cd === store.currentDir) void refreshFiles()
      })
      .catch((e: unknown) => notifyError(e))
      .finally(() => taskDone(id))
  }
}

export async function changePermissions(filename: string, chmod: string): Promise<void> {
  try {
    await apiPost('changePermissions', { dir: store.currentDir, filename, chmod })
    notify(t('permission_change_success'), 'success')
    await refreshFiles()
  } catch (e) {
    notifyError(e)
  }
}

export async function remoteUpload(url: string, filename: string, method: string): Promise<void> {
  const id = taskAdd(`${t('upload_remote')} ${filename}`)
  try {
    await apiPost('remoteUpload', { dir: store.currentDir, url, filename, method })
    notify(t('file_upload_success'), 'success')
    await refreshFiles()
  } catch (e) {
    notifyError(e)
  } finally {
    taskDone(id)
  }
}

export async function searchItems(pattern: string): Promise<void> {
  store.searchBusy = true
  store.searchPattern = pattern
  try {
    const data = await apiPost<FileItem[]>('searchItems', { dir: store.currentDir, pattern })
    store.searchBaseDir = store.currentDir
    store.searchResults = (Array.isArray(data) ? data : []).map((e) => {
      const name = e.name as string
      const slash = name.lastIndexOf('/')
      return {
        ...e,
        guid: guid(),
        folder: slash >= 0 ? name.substring(0, slash) : '/',
        linkname: slash >= 0 ? name.substring(slash + 1) : name,
      } as SearchResult
    })
  } catch (e) {
    notifyError(e)
    closeModal()
  } finally {
    store.searchBusy = false
  }
}

export function archiveFormat(archivename: string): string | null {
  const lower = archivename.toLowerCase()
  const hit = ARCHIVE_FORMATS.find((ext) => lower.endsWith(ext))
  return hit ? hit.slice(1) : null
}

export async function createArchive(items: EnrichedFile[], archivename: string): Promise<boolean> {
  const format = archiveFormat(archivename)
  if (!format) {
    notify(t('invalid_archive_format'), 'danger')
    return false
  }
  const id = taskAdd(`${t('create_archive')} ${archivename}`)
  try {
    const data = await apiPost<{ status: string; message: string }>('createArchive', {
      dir: store.currentDir,
      archivename,
      filenames: items.map((f) => f.name),
      format,
    })
    notify(data.message, 'success')
    store.selected.clear()
    await refreshFiles()
    return true
  } catch (e) {
    notifyError(e)
    return false
  } finally {
    taskDone(id)
  }
}

export async function getContent(filename: string): Promise<{ filename: string; content: string } | null> {
  try {
    const data = await apiPost<{ status: string; data: { filename: string; content: string } }>('getContent', {
      dir: store.currentDir,
      filename,
    })
    if (data.data.content == null) {
      notify(t('file_load_error'), 'danger')
      return null
    }
    return data.data
  } catch (e) {
    notifyError(e)
    return null
  }
}

// --- modal ---

export function openModal(kind: ModalKind, payload?: unknown): void {
  store.contextMenu = null
  store.modal = { kind, payload }
}

export function closeModal(): void {
  store.modal = { kind: null, payload: undefined }
}

// A modal (currently: the file editor with unsaved changes) can veto closing.
export const modalControls: { guard: null | (() => boolean) } = { guard: null }

export function tryCloseModal(): void {
  if (modalControls.guard && !modalControls.guard()) return
  closeModal()
}
