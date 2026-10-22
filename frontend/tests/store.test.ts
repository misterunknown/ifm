import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  archiveFormat,
  boot,
  changeDirectory,
  changePermissions,
  closeModal,
  copyMove,
  createArchive,
  createDir,
  deleteFiles,
  extractFile,
  fileByGuid,
  getContent,
  login,
  modalControls,
  notify,
  notifyError,
  openModal,
  refreshFiles,
  remoteUpload,
  renameFile,
  saveFile,
  searchItems,
  selectedFiles,
  store,
  taskAdd,
  taskDone,
  taskUpdate,
  toggleSelect,
  tryCloseModal,
  uploadFiles,
} from '../src/store'
import { setCsrfToken } from '../src/api'
import { fakeConfig, flush, loadFiles, mockFetch, MockXHR, mockXHR, rawFiles, resetStore } from './helpers'

beforeEach(() => {
  resetStore()
  setCsrfToken('test-csrf-token')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// Routes the standard boot sequence: getConfig -> getI18N -> checkAuth ->
// getRealpath -> getFiles.
function mockBoot(handler?: (api: string, body: URLSearchParams) => unknown): void {
  mockFetch((api, body) => {
    if (handler) {
      const override = handler(api, body)
      if (override !== undefined) return override
    }
    switch (api) {
      case 'getConfig':
        return { ...fakeConfig(), csrf_token: 'tok' }
      case 'getI18N':
        return {}
      case 'checkAuth':
        if (body.get('inputLogin') === 'bad') return { status: 'ERROR', message: 'nope' }
        return { status: 'OK' }
      case 'getRealpath':
        return { realpath: body.get('dir') }
      case 'getFiles':
        return rawFiles()
      default:
        return { status: 'OK', message: 'ok' }
    }
  })
}

describe('boot', () => {
  it('loads config, i18n, auth and the file table', async () => {
    mockBoot()
    await boot()
    // the initial changeDirectory is fire-and-forget by design
    await flush()
    expect(store.booted).toBe(true)
    expect(store.authenticated).toBe(true)
    expect(store.files.length).toBeGreaterThan(0)
    expect(store.currentDir).toBe('')
  })
  it('honours the location hash as start directory', async () => {
    window.location.hash = '#/sub%20dir'
    mockBoot()
    await boot()
    await flush()
    expect(store.currentDir).toBe('/sub dir')
  })
  it('shows the login when not authenticated', async () => {
    mockBoot((api) => (api === 'checkAuth' ? { status: 'ERROR', message: 'no' } : undefined))
    await boot()
    expect(store.authenticated).toBe(false)
    expect(store.files).toEqual([])
  })
  it('tolerates a failing i18n load', async () => {
    mockBoot((api) => (api === 'getI18N' ? { status: 'ERROR', message: 'x' } : undefined))
    await boot()
    expect(store.authenticated).toBe(true)
  })
  it('reports a fatal boot error', async () => {
    mockFetch(() => new Error('down'))
    await boot()
    expect(store.booted).toBe(true)
    expect(store.bootError).toBeTruthy()
  })
  it('wires popstate and beforeunload', async () => {
    mockBoot()
    await boot()
    // popstate navigates without pushing
    const push = vi.spyOn(window.history, 'pushState')
    window.onpopstate?.call(window, { state: { dir: 'elsewhere' } } as PopStateEvent)
    await flush()
    expect(store.currentDir).toBe('elsewhere')
    expect(push).not.toHaveBeenCalled()
    // pending tasks arm the unload guard
    const evt = new Event('beforeunload')
    const prevent = vi.spyOn(evt, 'preventDefault')
    taskAdd('busy')
    window.onbeforeunload?.call(window, evt as unknown as BeforeUnloadEvent)
    expect(prevent).toHaveBeenCalled()
    const firstTask = store.tasks[0]
    if (firstTask) taskDone(firstTask.id)
    const evt2 = new Event('beforeunload')
    const prevent2 = vi.spyOn(evt2, 'preventDefault')
    window.onbeforeunload?.call(window, evt2 as unknown as BeforeUnloadEvent)
    expect(prevent2).not.toHaveBeenCalled()
  })
})

describe('login', () => {
  it('authenticates and enters the app', async () => {
    mockBoot()
    await login('admin', 'secret')
    expect(store.authenticated).toBe(true)
    expect(store.loginError).toBe('')
    expect(store.loginBusy).toBe(false)
  })
  it('shows the backend message on failure', async () => {
    mockBoot()
    store.authenticated = false
    await login('bad', 'wrong')
    expect(store.authenticated).toBe(false)
    expect(store.loginError).toBe('nope')
  })
})

describe('changeDirectory', () => {
  it('combines relative targets and pushes history', async () => {
    mockBoot()
    await boot()
    const push = vi.spyOn(window.history, 'pushState')
    store.currentDir = 'a'
    await changeDirectory('b')
    expect(store.currentDir).toBe('a/b')
    expect(push).toHaveBeenCalled()
    expect(store.selected.size).toBe(0)
  })
  it('toasts on failure without moving', async () => {
    mockBoot((api) => (api === 'getRealpath' ? { status: 'ERROR', message: 'bad dir' } : undefined))
    store.currentDir = 'keep'
    await changeDirectory('nope')
    expect(store.currentDir).toBe('keep')
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
})

describe('refreshFiles', () => {
  it('rejects non-array payloads', async () => {
    mockFetch(() => ({ status: 'OK' }))
    await refreshFiles()
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
  it('needs no config to stay silent', async () => {
    store.config = null
    let calls = 0
    mockFetch(() => {
      calls++
      return []
    })
    await refreshFiles()
    expect(calls).toBe(0)
  })
  it('prunes stale selection and highlight', async () => {
    loadFiles()
    const g = store.files[2].guid
    store.selected.add(g)
    store.highlighted = g
    mockFetch((api) => (api === 'getFiles' ? [] : { status: 'OK' }))
    await refreshFiles()
    expect(store.selected.size).toBe(0)
    expect(store.highlighted).toBe('')
  })
  it('boots without a csrf token and sends no header then', async () => {
    const headers: Array<Record<string, string>> = []
    mockFetch((api, _body, h) => {
      headers.push(h)
      if (api === 'getConfig') return { ...fakeConfig(), csrf_token: undefined }
      if (api === 'getI18N') return {}
      if (api === 'checkAuth') return { status: 'OK' }
      if (api === 'getRealpath') return { realpath: '' }
      if (api === 'getFiles') return rawFiles()
      return { status: 'OK' }
    })
    await boot()
    await flush()
    await saveFile('n.txt', 'x')
    expect(headers.length).toBeGreaterThan(0)
    expect(headers.every((h) => h['X-IFM-CSRF'] === undefined)).toBe(true)
  })
})

describe('selection helpers', () => {
  it('toggle, lookup and list', () => {
    loadFiles()
    const [a, b] = store.files
    toggleSelect(a.guid)
    toggleSelect(b.guid)
    toggleSelect(b.guid)
    expect(selectedFiles().map((f) => f.guid)).toEqual([a.guid])
    expect(fileByGuid('missing')).toBeUndefined()
  })
})

describe('mutating actions', () => {
  it('saveFile succeeds and fails', async () => {
    loadFiles()
    mockBoot()
    expect(await saveFile('n.txt', 'x')).toBe(true)
    expect(store.toasts.at(-1)).toMatchObject({ kind: 'success' })
    mockBoot((api) => (api === 'saveFile' ? { status: 'ERROR', message: 'denied' } : undefined))
    expect(await saveFile('n.txt', 'x')).toBe(false)
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
  it('createDir succeeds and fails', async () => {
    loadFiles()
    mockBoot()
    expect(await createDir('new')).toBe(true)
    mockBoot((api) => (api === 'createDir' ? { status: 'ERROR', message: 'denied' } : undefined))
    expect(await createDir('new')).toBe(false)
  })
  it('deleteFiles clears the selection', async () => {
    loadFiles()
    store.selected.add(store.files[2].guid)
    mockBoot()
    const target = store.files[2]
    if (target) await deleteFiles([target])
    expect(store.selected.size).toBe(0)
    mockBoot((api) => (api === 'delete' ? { status: 'ERROR', message: 'denied' } : undefined))
    const target2 = store.files[2]
    if (target2) await deleteFiles([target2])
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
  it('renameFile toasts both ways', async () => {
    loadFiles()
    mockBoot()
    await renameFile('a', 'b')
    expect(store.toasts.at(-1)?.kind).toBe('success')
    mockBoot((api) => (api === 'rename' ? { status: 'ERROR', message: 'denied' } : undefined))
    await renameFile('a', 'b')
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
  it('copyMove tracks a task and refreshes', async () => {
    loadFiles()
    const seen: string[] = []
    mockFetch((api) => {
      seen.push(api)
      return { status: 'OK', message: 'moved' }
    })
    const single = store.files[2]
    if (single) await copyMove([single], 'dest', 'move')
    expect(seen).toContain('copyMove')
    expect(seen).toContain('getFiles')
    expect(store.tasks).toEqual([])
    // multi-source tasks name the count instead of the file
    const multi = store.files.filter((f) => f.name !== '..').slice(0, 2)
    await copyMove(multi, 'dest', 'copy')
    mockFetch(() => ({ status: 'ERROR', message: 'denied' }))
    const one = store.files[2]
    if (one) await copyMove([one], 'dest', 'copy')
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
  it('extractFile and changePermissions toast both ways', async () => {
    loadFiles()
    mockBoot()
    await extractFile('a.zip', './')
    expect(store.toasts.at(-1)?.kind).toBe('success')
    await changePermissions('a', '644')
    expect(store.toasts.at(-1)?.kind).toBe('success')
    mockBoot((api) =>
      api === 'extract' || api === 'changePermissions' ? { status: 'ERROR', message: 'denied' } : undefined,
    )
    await extractFile('a.zip', './')
    await changePermissions('a', '644')
    expect(store.toasts.filter((t) => t.kind === 'danger')).toHaveLength(2)
  })
  it('remoteUpload tracks a task', async () => {
    loadFiles()
    mockBoot()
    await remoteUpload('http://x/y.txt', 'y.txt', 'curl')
    expect(store.toasts.at(-1)?.kind).toBe('success')
    expect(store.tasks).toEqual([])
    mockBoot((api) => (api === 'remoteUpload' ? { status: 'ERROR', message: 'denied' } : undefined))
    await remoteUpload('http://x/y.txt', 'y.txt', 'curl')
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
})

describe('archiveFormat', () => {
  it('detects supported suffixes case-insensitively', () => {
    expect(archiveFormat('a.ZIP')).toBe('zip')
    expect(archiveFormat('a.tar.gz')).toBe('tar.gz')
    expect(archiveFormat('a.tar.bz2')).toBe('tar.bz2')
    expect(archiveFormat('a.tar')).toBe('tar')
    expect(archiveFormat('a.7z')).toBeNull()
    expect(archiveFormat('zip')).toBeNull()
  })
})

describe('createArchive', () => {
  it('rejects unknown formats without a request', async () => {
    loadFiles()
    let calls = 0
    mockFetch(() => {
      calls++
      return { status: 'OK' }
    })
    expect(await createArchive([store.files[2]], 'a.7z')).toBe(false)
    expect(calls).toBe(0)
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
  it('creates archives and reports errors', async () => {
    loadFiles()
    mockFetch(() => ({ status: 'OK', message: 'archived' }))
    expect(await createArchive([store.files[2]], 'a.zip')).toBe(true)
    mockFetch(() => ({ status: 'ERROR', message: 'denied' }))
    expect(await createArchive([store.files[2]], 'a.zip')).toBe(false)
  })
})

describe('searchItems', () => {
  it('splits folder and linkname', async () => {
    loadFiles()
    mockFetch(() => [
      { name: './sub/hit.txt', type: 'file', icon: 'x' },
      { name: 'toplevel.txt', type: 'file', icon: 'x' },
    ])
    await searchItems('hit*')
    expect(store.searchResults[0]).toMatchObject({ folder: './sub', linkname: 'hit.txt' })
    expect(store.searchResults[1]).toMatchObject({ folder: '/', linkname: 'toplevel.txt' })
    expect(store.searchBaseDir).toBe('')
    expect(store.searchBusy).toBe(false)
  })
  it('closes the modal on error', async () => {
    loadFiles()
    openModal('search')
    mockFetch(() => ({ status: 'ERROR', message: 'denied' }))
    await searchItems('hit*')
    expect(store.modal.kind).toBeNull()
  })
})

describe('getContent', () => {
  it('returns data, null and error paths', async () => {
    loadFiles()
    mockFetch(() => ({ status: 'OK', data: { filename: 'a', content: 'hi' } }))
    expect(await getContent('a')).toEqual({ filename: 'a', content: 'hi' })
    mockFetch(() => ({ status: 'OK', data: { filename: 'a', content: null } }))
    expect(await getContent('a')).toBeNull()
    mockFetch(() => ({ status: 'ERROR', message: 'denied' }))
    expect(await getContent('a')).toBeNull()
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
})

describe('uploadFiles', () => {
  it('uploads with rename for single files and refreshes on cd match', async () => {
    loadFiles()
    mockXHR()
    let filesCalls = 0
    mockFetch((api) => {
      if (api === 'getFiles') filesCalls++
      return rawFiles()
    })
    uploadFiles([new File(['x'], 'a.txt')], 'renamed.txt')
    expect(MockXHR.last).not.toBeNull()
    expect(store.tasks[0]?.progress).toBeNull()
    MockXHR.last?.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 })
    expect(store.tasks[0]?.progress).toBe(50)
    MockXHR.last?.respondOk({ status: 'OK', cd: '' })
    await flush()
    expect(store.toasts.at(-1)?.kind).toBe('success')
    expect(filesCalls).toBeGreaterThan(0)
  })
  it('sends newfilename only for single uploads', async () => {
    loadFiles()
    mockXHR()
    const sent: FormData[] = []
    // wrap send to capture the payload
    const origSend = MockXHR.prototype.send
    MockXHR.prototype.send = function (this: MockXHR, body?: unknown) {
      if (body instanceof FormData) sent.push(body)
      origSend.call(this)
    }
    try {
      uploadFiles([new File(['x'], 'a.txt')], 'solo.txt')
      MockXHR.last?.respondOk({ status: 'OK', cd: '' })
      await flush()
      uploadFiles([new File(['x'], 'a.txt'), new File(['y'], 'b.txt')], 'ignored.txt')
      MockXHR.last?.respondOk({ status: 'OK', cd: '' })
      await flush()
    } finally {
      MockXHR.prototype.send = origSend
    }
    const get = (fd: FormData, k: string): string | null => fd.get(k) as string | null
    expect(get(sent[0], 'newfilename')).toBe('solo.txt')
    expect(get(sent[1], 'newfilename')).toBeNull()
  })
  it('skips refresh on cd mismatch and toasts on failure', async () => {
    loadFiles()
    mockXHR()
    let filesCalls = 0
    mockFetch((api) => {
      if (api === 'getFiles') filesCalls++
      return { status: 'OK' }
    })
    uploadFiles([new File(['x'], 'a.txt')])
    MockXHR.last?.respondOk({ status: 'OK', cd: 'elsewhere' })
    await flush()
    expect(filesCalls).toBe(0)
    uploadFiles([new File(['x'], 'a.txt')])
    MockXHR.last?.respondOk({ status: 'ERROR', message: 'denied' })
    await flush()
    expect(store.toasts.at(-1)?.kind).toBe('danger')
    expect(store.tasks).toEqual([])
  })
})

describe('notifications and tasks', () => {
  it('notify expires toasts', () => {
    vi.useFakeTimers()
    resetStore()
    notify('hello', 'success')
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(3000)
    expect(store.toasts).toHaveLength(0)
  })
  it('skips expiry for already dismissed toasts', () => {
    vi.useFakeTimers()
    resetStore()
    notify('hello', 'success')
    store.toasts.splice(0, 1)
    vi.advanceTimersByTime(3000)
    expect(store.toasts).toHaveLength(0)
  })
  it('notifyError unwraps ApiError and unknowns', async () => {
    resetStore()
    const { ApiError } = await import('../src/api')
    notifyError(new ApiError('login_failed'))
    expect(store.toasts.at(-1)?.message).toBe('Login failed.')
    notifyError(new Error('raw problem'))
    expect(store.toasts.at(-1)?.message).toBe('General error: No or broken response.')
    // non-ApiError values never leak backend-shaped payloads to the user
    notifyError({ status: 'ERROR', message: 'Backend says no' } as unknown as Error)
    expect(store.toasts.at(-1)?.message).toBe('General error: No or broken response.')
  })
  it('taskUpdate ignores unknown ids', () => {
    resetStore()
    const id = taskAdd('job')
    taskUpdate('missing', 50)
    taskUpdate(id, 50)
    expect(store.tasks[0].progress).toBe(50)
    taskDone(id)
    taskDone('missing')
    expect(store.tasks).toEqual([])
  })
})

describe('modal controls', () => {
  it('open/close and the close guard', () => {
    resetStore()
    openModal('createDir')
    expect(store.modal.kind).toBe('createDir')
    expect(store.contextMenu).toBeNull()
    modalControls.guard = () => false
    tryCloseModal()
    expect(store.modal.kind).toBe('createDir')
    modalControls.guard = () => true
    tryCloseModal()
    expect(store.modal.kind).toBeNull()
    closeModal()
  })
})
