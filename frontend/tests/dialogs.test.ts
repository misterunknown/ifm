import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreateDirDialog from '../src/components/dialogs/CreateDirDialog.vue'
import DeleteDialog from '../src/components/dialogs/DeleteDialog.vue'
import RenameDialog from '../src/components/dialogs/RenameDialog.vue'
import CopyMoveDialog from '../src/components/dialogs/CopyMoveDialog.vue'
import ExtractDialog from '../src/components/dialogs/ExtractDialog.vue'
import UploadDialog from '../src/components/dialogs/UploadDialog.vue'
import OverwriteDialog from '../src/components/dialogs/OverwriteDialog.vue'
import RemoteUploadDialog from '../src/components/dialogs/RemoteUploadDialog.vue'
import AjaxDialog from '../src/components/dialogs/AjaxDialog.vue'
import SearchDialog from '../src/components/dialogs/SearchDialog.vue'
import CreateArchiveDialog from '../src/components/dialogs/CreateArchiveDialog.vue'
import { store } from '../src/store'
import { flush, loadFiles, mockFetch, MockXHR, mockXHR, mountWithStubs, rawFiles, resetStore } from './helpers'

beforeEach(() => {
  loadFiles()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetStore()
})

function guidOf(name: string): string {
  const f = store.files.find((x) => x.name === name)
  if (!f) throw new Error(`missing file ${name}`)
  return f.guid
}

// Records every backend call as [api, body].
function captureFetch(): Array<[string, URLSearchParams]> {
  const calls: Array<[string, URLSearchParams]> = []
  mockFetch((api, body) => {
    calls.push([api, body])
    if (api === 'getFolders') return [{ text: 'sub', dataAttr: { path: '/sub' } }]
    if (api === 'getFiles') return rawFiles()
    if (api === 'getRealpath') return { realpath: body.get('dir') }
    if (api === 'searchItems')
      return [{ name: './sub/hit.txt', type: 'file', icon: 'icon fa fa-file-text-o' }]
    if (api === 'getContent') return { status: 'OK', data: { filename: 'x', content: 'y' } }
    return { status: 'OK', message: 'ok' }
  })
  return calls
}

describe('CreateDirDialog', () => {
  it('cancels without a request', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(CreateDirDialog)
    await wrapper.find('.modal-footer .btn-danger').trigger('click')
    expect(store.modal.kind).toBeNull()
    expect(calls).toHaveLength(0)
  })
  it('stays open when creation fails', async () => {
    mockFetch((api) => {
      if (api === 'createDir') return { status: 'ERROR', message: 'denied' }
      return []
    })
    const wrapper = mountWithStubs(CreateDirDialog)
    await wrapper.find('#dlg-dirname').setValue('brand-new')
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
  it('blocks taken names and creates new ones', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(CreateDirDialog)
    await wrapper.find('#dlg-dirname').setValue('docs')
    expect(wrapper.find('#dlg-dirname').classes()).toContain('is-invalid')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(calls.filter(([api]) => api === 'createDir')).toHaveLength(0)
    await wrapper.find('#dlg-dirname').setValue('brand-new')
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(calls.filter(([api]) => api === 'createDir')).toHaveLength(1)
    expect(store.modal.kind).toBeNull()
  })
})

describe('DeleteDialog', () => {
  it('confirms single and multiple deletions', async () => {
    const calls = captureFetch()
    const single = mountWithStubs(DeleteDialog, { props: { guids: [guidOf('notes.txt')] } })
    expect(single.text()).toContain('notes.txt')
    await single.find('.btn-danger').trigger('click')
    await flush()
    const del = calls.find(([api]) => api === 'delete')
    expect(del?.[1].getAll('filenames[]')).toEqual(['notes.txt'])
    expect(store.modal.kind).toBeNull()
    // the confirm refreshed the table with fresh guids — resolve again
    const multi = mountWithStubs(DeleteDialog, { props: { guids: [guidOf('notes.txt'), guidOf('photo.jpg')] } })
    expect(multi.text()).toContain('2')
    await multi.find('.btn-secondary').trigger('click')
    expect(store.modal.kind).toBeNull()
  })
})

describe('RenameDialog', () => {
  it('renders nothing for unknown files and cancels cleanly', async () => {
    const wrapper = mountWithStubs(RenameDialog, { props: { guid: 'missing' } })
    expect(wrapper.html()).toBe('<!--v-if-->')
    const wrapper2 = mountWithStubs(RenameDialog, { props: { guid: guidOf('notes.txt') } })
    await wrapper2.find('.modal-footer .btn-danger').trigger('click')
    expect(store.modal.kind).toBeNull()
  })
  it('renames to a new name only', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(RenameDialog, { props: { guid: guidOf('notes.txt') } })
    expect((wrapper.find('#dlg-newname').element as HTMLInputElement).value).toBe('notes.txt')
    // unchanged name stays disabled
    await wrapper.find('form').trigger('submit')
    expect(calls.filter(([api]) => api === 'rename')).toHaveLength(0)
    await wrapper.find('#dlg-newname').setValue('renamed.txt')
    await wrapper.find('form').trigger('submit')
    await flush()
    const rename = calls.find(([api]) => api === 'rename')
    expect(rename?.[1].get('newname')).toBe('renamed.txt')
    expect(store.modal.kind).toBeNull()
  })
})

describe('CopyMoveDialog', () => {
  it('copies and moves to the picked destination', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(CopyMoveDialog, { props: { guids: [guidOf('notes.txt')] } })
    await flush()
    expect(wrapper.text()).toContain('sub')
    const sub = wrapper.findAll('.ifm-tree-node').find((n) => n.text().includes('sub'))
    await sub?.trigger('click')
    await flush()
    await wrapper.findAll('.modal-footer .btn-secondary')[0]?.trigger('click')
    await flush()
    const copy = calls.find(([api]) => api === 'copyMove')
    expect(copy?.[1].get('action')).toBe('copy')
    expect(copy?.[1].get('destination')).toBe('/sub')
    expect(copy?.[1].getAll('filenames[]')).toEqual(['notes.txt'])
  })
  it('moves and cancels', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(CopyMoveDialog, { props: { guids: [guidOf('notes.txt')] } })
    await flush()
    const sub = wrapper.findAll('.ifm-tree-node').find((n) => n.text().includes('sub'))
    await sub?.trigger('click')
    await flush()
    await wrapper.findAll('.modal-footer .btn-secondary')[1]?.trigger('click')
    await flush()
    expect(calls.find(([api]) => api === 'copyMove')?.[1].get('action')).toBe('move')
    expect(store.modal.kind).toBeNull()
    const wrapper2 = mountWithStubs(CopyMoveDialog, { props: { guids: [guidOf('notes.txt')] } })
    await flush()
    await wrapper2.find('.modal-footer .btn-danger').trigger('click')
    expect(store.modal.kind).toBeNull()
    expect(calls.filter(([api]) => api === 'copyMove')).toHaveLength(1)
  })
  it('disables both buttons without a destination', async () => {
    captureFetch()
    const wrapper = mountWithStubs(CopyMoveDialog, { props: { guids: [guidOf('notes.txt')] } })
    await flush()
    const buttons = wrapper.findAll('.modal-footer .btn-secondary')
    expect(buttons[0]?.attributes('disabled')).toBeDefined()
    expect(buttons[1]?.attributes('disabled')).toBeDefined()
  })
  it('renders gracefully for unknown files', () => {
    captureFetch()
    const wrapper = mountWithStubs(CopyMoveDialog, { props: { guids: ['missing'] } })
    expect(wrapper.find('#copyMoveTree').exists()).toBe(true)
  })
})

describe('ExtractDialog', () => {
  it('toggles every target option and cancels', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(ExtractDialog, { props: { filename: 'archive.zip' } })
    await wrapper.find('input[placeholder="Current directory"]').trigger('click')
    await wrapper.find('input[value="custom"]').setValue(true)
    await wrapper.find('input[value="./archive"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flush()
    const targets = calls.filter(([api]) => api === 'extract').map(([, body]) => body.get('targetdir'))
    expect(targets).toEqual(['./archive'])
    const wrapper2 = mountWithStubs(ExtractDialog, { props: { filename: 'archive.zip' } })
    await wrapper2.find('.modal-footer .btn-danger').trigger('click')
    expect(store.modal.kind).toBeNull()
  })
  it('extracts without an extension straight into the base name', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(ExtractDialog, { props: { filename: 'README' } })
    expect(wrapper.text()).toContain('README')
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(calls.find(([api]) => api === 'extract')?.[1].get('targetdir')).toBe('./')
  })
  it('extracts to the current, suggested or custom directory', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(ExtractDialog, { props: { filename: 'archive.zip' } })
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(calls.find(([api]) => api === 'extract')?.[1].get('targetdir')).toBe('./')
    // the suggested directory option
    const suggested = mountWithStubs(ExtractDialog, { props: { filename: 'archive.zip' } })
    await suggested.find('input[placeholder="archive"]').trigger('click')
    await suggested.find('form').trigger('submit')
    await flush()
    const suggestedTargets = calls.filter(([api]) => api === 'extract').map(([, body]) => body.get('targetdir'))
    expect(suggestedTargets).toContain('./archive')
    const custom = mountWithStubs(ExtractDialog, { props: { filename: 'archive.zip' } })
    await custom.find('input[placeholder="Custom location"]').setValue('elsewhere')
    await custom.find('input[placeholder="Custom location"]').trigger('focus')
    await custom.find('form').trigger('submit')
    await flush()
    const targets = calls.filter(([api]) => api === 'extract').map(([, body]) => body.get('targetdir'))
    expect(targets).toContain('elsewhere')
  })
})

describe('UploadDialog', () => {
  function selectFiles(wrapper: ReturnType<typeof mountWithStubs>, files: File[]): void {
    const input = wrapper.find('#dlg-fileselect').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: files, configurable: true })
  }
  it('uploads new files directly', async () => {
    const calls = captureFetch()
    mockXHR()
    const wrapper = mountWithStubs(UploadDialog)
    selectFiles(wrapper, [new File(['x'], 'fresh.txt')])
    await wrapper.find('#dlg-fileselect').trigger('change')
    expect(wrapper.find('#uploadFileList').text()).toContain('fresh.txt')
    await wrapper.find('form').trigger('submit')
    expect(MockXHR.last).not.toBeNull()
    MockXHR.last?.respondOk({ status: 'OK', cd: '' })
    await flush()
    expect(calls.some(([api]) => api === 'upload')).toBe(false) // XHR, not fetch
    expect(store.modal.kind).toBeNull()
  })
  it('asks before overwriting and renames single uploads', async () => {
    captureFetch()
    mockXHR()
    const wrapper = mountWithStubs(UploadDialog)
    selectFiles(wrapper, [new File(['x'], 'notes.txt')])
    await wrapper.find('#dlg-fileselect').trigger('change')
    // rename field appears for single uploads
    expect(wrapper.find('#dlg-newfilename').exists()).toBe(true)
    await wrapper.find('#dlg-newfilename').setValue('renamed.txt')
    await wrapper.find('form').trigger('submit')
    // renamed.txt does not exist -> direct upload, no overwrite dialog
    expect(store.modal.kind).toBeNull()
  })
  it('opens the overwrite dialog for existing names', async () => {
    captureFetch()
    const wrapper = mountWithStubs(UploadDialog)
    selectFiles(wrapper, [new File(['x'], 'notes.txt')])
    await wrapper.find('#dlg-fileselect').trigger('change')
    await wrapper.find('form').trigger('submit')
    expect(store.modal.kind).toBe('overwrite')
    const payload = store.modal.payload as { existing: string[] }
    expect(payload.existing).toEqual(['notes.txt'])
  })
  it('dedups reselected files and flags multi overwrites', async () => {
    captureFetch()
    const wrapper = mountWithStubs(UploadDialog)
    const file = new File(['x'], 'notes.txt')
    selectFiles(wrapper, [file])
    await wrapper.find('#dlg-fileselect').trigger('change')
    selectFiles(wrapper, [file])
    await wrapper.find('#dlg-fileselect').trigger('change')
    expect(wrapper.findAll('#uploadFileList li')).toHaveLength(1)
    selectFiles(wrapper, [new File(['y'], 'other.txt')])
    await wrapper.find('#dlg-fileselect').trigger('change')
    await wrapper.find('form').trigger('submit')
    expect(store.modal.kind).toBe('overwrite')
    expect((store.modal.payload as { existing: string[] }).existing).toEqual(['notes.txt'])
  })
  it('cancels without uploading', async () => {
    captureFetch()
    const wrapper = mountWithStubs(UploadDialog)
    await wrapper.find('.modal-footer .btn-danger').trigger('click')
    expect(store.modal.kind).toBeNull()
  })
  it('survives empty change events and rename collisions', async () => {
    captureFetch()
    const wrapper = mountWithStubs(UploadDialog)
    const input = wrapper.find('#dlg-fileselect').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: null, configurable: true })
    await wrapper.find('#dlg-fileselect').trigger('change')
    expect(wrapper.findAll('#uploadFileList li')).toHaveLength(0)
    selectFiles(wrapper, [new File(['x'], 'fresh.txt')])
    await wrapper.find('#dlg-fileselect').trigger('change')
    await wrapper.find('#dlg-newfilename').setValue('notes.txt')
    await wrapper.find('form').trigger('submit')
    expect(store.modal.kind).toBe('overwrite')
    expect((store.modal.payload as { existing: string[] }).existing).toEqual(['notes.txt'])
  })
  it('removes pending files and requires at least one', async () => {
    captureFetch()
    const wrapper = mountWithStubs(UploadDialog)
    selectFiles(wrapper, [new File(['x'], 'a.txt'), new File(['y'], 'b.txt')])
    await wrapper.find('#dlg-fileselect').trigger('change')
    expect(wrapper.findAll('#uploadFileList li')).toHaveLength(2)
    await wrapper.findAll('#uploadFileList button')[0]?.trigger('click')
    expect(wrapper.findAll('#uploadFileList li')).toHaveLength(1)
    await wrapper.findAll('#uploadFileList button')[0]?.trigger('click')
    expect(wrapper.findAll('#uploadFileList li')).toHaveLength(0)
    await wrapper.find('form').trigger('submit')
    expect(store.toasts.at(-1)?.message).toBe('Please select at least one file.')
  })
})

describe('OverwriteDialog', () => {
  it('confirms the overwrite with the stored rename', async () => {
    mockXHR()
    const file = new File(['x'], 'notes.txt')
    const wrapper = mountWithStubs(OverwriteDialog, {
      props: { payload: { files: [file], existing: ['notes.txt'], newfilename: 'kept.txt' } },
    })
    expect(wrapper.text()).toContain('notes.txt')
    await wrapper.find('.btn-primary').trigger('click')
    expect(MockXHR.last).not.toBeNull()
    MockXHR.last?.respondOk({ status: 'OK', cd: '' })
    await flush()
    expect(store.toasts.at(-1)?.kind).toBe('success')
    expect(store.modal.kind).toBeNull()
  })
  it('cancels without uploading', async () => {
    mockXHR()
    const file = new File(['x'], 'notes.txt')
    const wrapper = mountWithStubs(OverwriteDialog, { props: { payload: { files: [file], existing: ['notes.txt'] } } })
    await wrapper.find('.btn-danger').trigger('click')
    expect(MockXHR.last).toBeNull()
    expect(store.modal.kind).toBeNull()
  })
})

describe('RemoteUploadDialog', () => {
  it('suggests a filename and uploads', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(RemoteUploadDialog)
    await wrapper.find('#dlg-remote-url').setValue('http://example.com/notes.txt')
    expect((wrapper.find('#dlg-remote-filename').element as HTMLInputElement).value).toBe('notes (1).txt')
    await wrapper.find('form').trigger('submit')
    await flush()
    const up = calls.find(([api]) => api === 'remoteUpload')
    expect(up?.[1].get('url')).toBe('http://example.com/notes.txt')
    expect(up?.[1].get('method')).toBe('curl')
    expect(store.modal.kind).toBeNull()
  })
  it('stops suggesting once the user typed a name', async () => {
    captureFetch()
    const wrapper = mountWithStubs(RemoteUploadDialog)
    await wrapper.find('#dlg-remote-filename').setValue('mine.txt')
    await wrapper.find('#dlg-remote-url').setValue('http://example.com/other.txt')
    expect((wrapper.find('#dlg-remote-filename').element as HTMLInputElement).value).toBe('mine.txt')
  })
  it('covers edge cases: empty submit, file method, bare hosts', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(RemoteUploadDialog)
    // enter with empty fields submits to the guard and returns
    await wrapper.find('#dlg-remote-url').trigger('keydown.enter')
    await wrapper.find('#dlg-remote-filename').trigger('keydown.enter')
    // url without a basename suggests nothing
    await wrapper.find('#dlg-remote-url').setValue('http://example.com/')
    expect((wrapper.find('#dlg-remote-filename').element as HTMLInputElement).value).toBe('')
    // extensionless collision counts up without an extension
    await wrapper.find('#dlg-remote-url').setValue('http://example.com/docs')
    expect((wrapper.find('#dlg-remote-filename').element as HTMLInputElement).value).toBe('docs (1)')
    await wrapper.find('#dlg-method-file').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flush()
    const up = calls.find(([api]) => api === 'remoteUpload')
    expect(up?.[1].get('method')).toBe('file')
    expect(up?.[1].get('filename')).toBe('docs (1)')
  })
})

describe('AjaxDialog', () => {
  it('cancels without requesting', async () => {
    const wrapper = mountWithStubs(AjaxDialog)
    await wrapper.find('.modal-footer .btn-danger').trigger('click')
    expect(store.modal.kind).toBeNull()
  })
  it('sends plain GET requests', async () => {
    const seen: Array<{ url: unknown; init?: { method?: string; body?: unknown } }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: { method?: string; body?: unknown }) => {
        seen.push({ url, init })
        return { ok: true, status: 200, text: async () => 'ok-body' }
      }),
    )
    const wrapper = mountWithStubs(AjaxDialog)
    await wrapper.find('#dlg-ajax-url').setValue('http://example.com/ping')
    await wrapper.find('.btn-success').trigger('click')
    await flush()
    expect(seen[0]?.init?.method).toBe('GET')
    expect(seen[0]?.init?.body).toBeUndefined()
    expect(wrapper.find('#dlg-ajax-response').element).toHaveProperty('value', 'ok-body')
  })
  function stubRaw(status: number, text: string): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: status >= 200 && status < 300, status, text: async () => text })),
    )
  }
  it('sends GET and POST and shows the response', async () => {
    const seen: Array<{ url: unknown; init?: { method?: string; body?: unknown } }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, init?: { method?: string; body?: unknown }) => {
        seen.push({ url, init })
        return { ok: true, status: 201, text: async () => 'created' }
      }),
    )
    const wrapper = mountWithStubs(AjaxDialog)
    expect(wrapper.find('#dlg-ajax-data').exists()).toBe(false)
    await wrapper.find('#dlg-ajax-url').setValue('http://example.com/api')
    await wrapper.find('#dlg-ajax-post').setValue(true)
    await wrapper.find('#dlg-ajax-data').setValue('a=1\nb=2')
    await wrapper.find('.btn-success').trigger('click')
    await flush()
    expect(seen[0]?.init?.body).toBe('a=1&b=2')
    expect(wrapper.find('#dlg-ajax-response').element).toHaveProperty('value', 'created')
    expect(wrapper.find('.badge').text()).toBe('201')
    stubRaw(500, 'broken')
    await wrapper.find('.btn-success').trigger('click')
    await flush()
    expect(wrapper.find('.badge').text()).toBe('500')
  })
  it('ignores requests without a url', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(AjaxDialog)
    await wrapper.find('#dlg-ajax-url').trigger('keydown.enter')
    expect(calls).toHaveLength(0)
    expect(wrapper.find('#dlg-ajax-response').element).toHaveProperty('value', '')
  })
  it('reports network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down')
      }),
    )
    const wrapper = mountWithStubs(AjaxDialog)
    await wrapper.find('#dlg-ajax-url').setValue('http://example.com/api')
    await wrapper.find('.btn-success').trigger('click')
    await flush()
    expect(wrapper.find('.badge').text()).toBe('0')
  })
})

describe('SearchDialog', () => {
  it('searches and jumps to results', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(SearchDialog)
    await wrapper.find('#dlg-search-pattern').setValue('hit*')
    await wrapper.find('form').trigger('submit')
    await flush()
    expect(wrapper.find('.searchitem').exists()).toBe(true)
    await wrapper.find('.searchitem').trigger('click')
    await flush()
    expect(store.modal.kind).toBeNull()
    expect(calls.map(([api]) => api)).toContain('getRealpath')
    // keyboard activation works the same way
    const wrapper2 = mountWithStubs(SearchDialog)
    await wrapper2.find('#dlg-search-pattern').setValue('hit*')
    await wrapper2.find('form').trigger('submit')
    await flush()
    await wrapper2.find('.searchitem').trigger('keyup.enter')
    await flush()
    expect(calls.filter(([api]) => api === 'getRealpath')).toHaveLength(2)
  })
  it('ignores empty patterns and shows the empty state', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(SearchDialog)
    await wrapper.find('form').trigger('submit')
    expect(calls.map(([api]) => api)).not.toContain('searchItems')
    expect(wrapper.find('tbody').text()).toBe('')
  })
  it('shows a spinner while searching', async () => {
    captureFetch()
    store.searchBusy = true
    const wrapper = mountWithStubs(SearchDialog)
    expect(wrapper.find('tbody').html()).toContain('spinner')
  })
})

describe('CreateArchiveDialog', () => {
  it('ignores empty names and unknown files', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(CreateArchiveDialog, { props: { guids: [guidOf('notes.txt')] } })
    await wrapper.find('form').trigger('submit')
    expect(calls.filter(([api]) => api === 'createArchive')).toHaveLength(0)
    const stale = mountWithStubs(CreateArchiveDialog, { props: { guids: ['missing'] } })
    await stale.find('#dlg-archivename').setValue('a.zip')
    await stale.find('form').trigger('submit')
    await flush()
    expect(calls.find(([api]) => api === 'createArchive')?.[1].getAll('filenames[]')).toEqual([])
  })
  it('validates the format and creates the archive', async () => {
    const calls = captureFetch()
    const wrapper = mountWithStubs(CreateArchiveDialog, { props: { guids: [guidOf('notes.txt')] } })
    await wrapper.find('#dlg-archivename').setValue('a.7z')
    await wrapper.find('form').trigger('submit')
    expect(calls.filter(([api]) => api === 'createArchive')).toHaveLength(0)
    expect(store.toasts.at(-1)?.kind).toBe('danger')
    await wrapper.find('#dlg-archivename').setValue('a.tar.gz')
    await wrapper.find('form').trigger('submit')
    await flush()
    const created = calls.find(([api]) => api === 'createArchive')
    expect(created?.[1].get('archivename')).toBe('a.tar.gz')
    expect(created?.[1].get('format')).toBe('tar.gz')
    expect(store.modal.kind).toBeNull()
  })
})
