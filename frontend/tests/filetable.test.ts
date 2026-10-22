import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FileTable from '../src/components/FileTable.vue'
import { store } from '../src/store'
import { flush, loadFiles, mockFetch, mockFetch as _mf, mountWithStubs, resetStore } from './helpers'

void _mf

beforeEach(() => {
  loadFiles()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetStore()
})

function rowNames(wrapper: ReturnType<typeof mountWithStubs>): string[] {
  return wrapper.findAll('#filetable tbody tr.clickable-row').map((r) => r.attributes('data-guid') ?? '')
}

function nameOf(guid: string): string {
  return store.files.find((f) => f.guid === guid)?.name ?? guid
}

function rowByName(wrapper: ReturnType<typeof mountWithStubs>, name: string) {
  const rows = wrapper.findAll('#filetable tbody tr.clickable-row')
  const row = rows.find((r) => nameOf(r.attributes('data-guid') ?? '') === name)
  if (!row) throw new Error(`row not found: ${name}`)
  return row
}

describe('rendering', () => {
  it('renders one row per file with action buttons', () => {
    const wrapper = mountWithStubs(FileTable)
    expect(rowNames(wrapper)).toHaveLength(store.files.length)
    // extract button for the archive, edit button for text
    expect(wrapper.find('a[title="extract"]').exists()).toBe(true)
    expect(wrapper.find('a[title="edit"]').exists()).toBe(true)
    // .. has no buttons
    const upRow = wrapper.find('tr[data-guid]')
    expect(upRow.exists()).toBe(true)
  })
  it('hides columns flagged off in the config', () => {
    resetStore()
    loadFiles({ showowner: 0, showgroup: 0, showpermissions: 0, showlastmodified: 0, showfilesize: 0, download: 0 })
    const wrapper = mountWithStubs(FileTable)
    for (const cls of ['th-owner', 'th-group', 'th-permissions', 'th-lastmod', 'th-size', 'th-download']) {
      expect(wrapper.find(`.${cls}`).exists(), cls).toBe(false)
    }
  })
  it('shows an empty state when the filter matches nothing', async () => {
    const wrapper = mountWithStubs(FileTable)
    store.filter = 'zzz-no-match'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#filetable tbody').text()).toContain('—')
  })
})

describe('sorting, filtering, pagination', () => {
  it('sorts by name ascending and descending, .. stays first', async () => {
    const wrapper = mountWithStubs(FileTable)
    const firstAsc = rowNames(wrapper).map(nameOf)
    expect(firstAsc[0]).toBe('..')
    await wrapper.find('th.th-filename').trigger('click')
    const desc = rowNames(wrapper).map(nameOf)
    expect(desc[0]).toBe('..')
    expect(desc.slice(1)).toEqual([...firstAsc.slice(1)].reverse())
  })
  it('sorts by size and date', async () => {
    const wrapper = mountWithStubs(FileTable)
    await wrapper.find('th.th-size').trigger('click')
    const bySize = rowNames(wrapper).map(nameOf)
    expect(bySize[0]).toBe('..')
    await wrapper.find('th.th-lastmod').trigger('click')
    await wrapper.find('th.th-lastmod').trigger('click')
    const byDateDesc = rowNames(wrapper).map(nameOf)
    expect(byDateDesc[0]).toBe('..')
    expect(byDateDesc[1]).toBe('blob.bin')
  })
  it('filters by name', async () => {
    const wrapper = mountWithStubs(FileTable)
    await wrapper.find('input[placeholder]').setValue('.txt')
    expect(rowNames(wrapper).map(nameOf)).toEqual(['notes.txt'])
  })
  it('paginates when enabled', async () => {
    resetStore()
    loadFiles({ paging: 1, pageLength: 2 })
    const wrapper = mountWithStubs(FileTable)
    expect(rowNames(wrapper)).toHaveLength(2)
    expect(wrapper.find('.pagination').exists()).toBe(true)
    await wrapper.findAll('.pagination .page-link')[2]?.trigger('click')
    expect(store.page).toBe(2)
    expect(rowNames(wrapper)).toHaveLength(2)
  })
})

describe('focus and keyboard activation', () => {
  it('highlights focused rows and activates buttons with enter', async () => {
    const wrapper = mountWithStubs(FileTable)
    const rows = wrapper.findAll('#filetable tbody tr.clickable-row')
    const row = rows[2]
    ;(row?.element as HTMLElement).focus()
    expect(store.highlighted).toBe(row?.attributes('data-guid'))
    await wrapper.findAll('a[title="rename"]')[0]?.trigger('keyup.enter')
    expect(store.modal.kind).toBe('rename')
  })
  it('pages backwards', async () => {
    resetStore()
    loadFiles({ paging: 1, pageLength: 2 })
    const wrapper = mountWithStubs(FileTable)
    store.page = 2
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.pagination .page-link')[0]?.trigger('click')
    expect(store.page).toBe(1)
  })
  it('edits link-less text files in place', async () => {
    resetStore()
    loadFiles({ download: 0, zipnload: 0 })
    mockFetch((api) => {
      if (api === 'getContent') return { status: 'OK', data: { filename: 'notes.txt', content: 'hi' } }
      return []
    })
    const wrapper = mountWithStubs(FileTable)
    const txtLink = wrapper.findAll('a.ifmitem').find((a) => a.text().includes('notes.txt'))
    await txtLink?.trigger('click')
    await flush()
    expect(store.modal.kind).toBe('editor')
  })
})

describe('selection and highlight', () => {
  it('ctrl-click toggles selection, plain click highlights', async () => {
    const wrapper = mountWithStubs(FileTable)
    const rows = wrapper.findAll('#filetable tbody tr.clickable-row')
    const fileRow = rows[1]
    await fileRow?.trigger('click', { ctrlKey: true })
    expect(store.selected.size).toBe(1)
    await fileRow?.trigger('click', { ctrlKey: true })
    expect(store.selected.size).toBe(0)
    await fileRow?.trigger('click')
    expect(store.highlighted).toBe(fileRow?.attributes('data-guid'))
  })
  it('never selects the parent entry', async () => {
    const wrapper = mountWithStubs(FileTable)
    const upRow = wrapper.findAll('#filetable tbody tr.clickable-row')[0]
    await upRow?.trigger('click', { ctrlKey: true })
    expect(store.selected.size).toBe(0)
  })
})

describe('row actions', () => {
  it('opens the editor for text files', async () => {
    mockFetch((api) => {
      if (api === 'getContent') return { status: 'OK', data: { filename: 'notes.txt', content: 'hi' } }
      return { status: 'OK' }
    })
    const wrapper = mountWithStubs(FileTable)
    await wrapper.find('a[title="edit"]').trigger('click')
    await flush()
    expect(store.modal.kind).toBe('editor')
  })
  it('opens dialogs for extract, rename, delete and copymove', async () => {
    const wrapper = mountWithStubs(FileTable)
    await wrapper.find('a[title="extract"]').trigger('click')
    expect(store.modal.kind).toBe('extract')
    await wrapper.findAll('a[title="rename"]')[0]?.trigger('click')
    expect(store.modal.kind).toBe('rename')
    await wrapper.findAll('a[title="delete"]')[0]?.trigger('click')
    expect(store.modal.kind).toBe('delete')
    await wrapper.findAll('a[title="copy/move"]')[0]?.trigger('click')
    expect(store.modal.kind).toBe('copyMove')
  })
  it('uses the selection for bulk dialogs', async () => {
    const wrapper = mountWithStubs(FileTable)
    const rows = wrapper.findAll('#filetable tbody tr.clickable-row')
    await rows[1]?.trigger('click', { ctrlKey: true })
    await rows[2]?.trigger('click', { ctrlKey: true })
    await wrapper.findAll('a[title="delete"]')[0]?.trigger('click')
    expect(store.modal.kind).toBe('delete')
    const payload = store.modal.payload as { guids: string[] }
    expect(payload.guids).toHaveLength(2)
  })
  it('changes directory on directory click', async () => {
    const seen: string[] = []
    mockFetch((api, body) => {
      seen.push(api)
      if (api === 'getRealpath') return { realpath: body.get('dir') }
      return []
    })
    const wrapper = mountWithStubs(FileTable)
    await rowByName(wrapper, 'docs').find('a.ifmitem').trigger('click')
    await flush()
    expect(seen).toContain('getRealpath')
    expect(store.currentDir).toBe('docs')
  })
  it('opens the preview when a media file has no link', async () => {
    resetStore()
    loadFiles({ download: 0, zipnload: 0 })
    const wrapper = mountWithStubs(FileTable)
    const imgLink = wrapper.findAll('a.ifmitem').find((a) => a.text().includes('photo.jpg'))
    await imgLink?.trigger('click')
    expect(store.modal.kind).toBe('preview')
  })
  it('commits permission edits on enter', async () => {
    const seen: Array<Record<string, string>> = []
    mockFetch((_api, body) => {
      seen.push(Object.fromEntries(body.entries()))
      return { status: 'OK' }
    })
    const wrapper = mountWithStubs(FileTable)
    const input = wrapper.findAll('input[name="newpermissions"]')[0]
    await input?.setValue('600')
    await input?.trigger('keyup.enter')
    await flush()
    const chmod = seen.find((s) => s['api'] === 'changePermissions')
    expect(chmod?.['chmod']).toBe('600')
  })
  it('opens the context menu on right click', async () => {
    const wrapper = mountWithStubs(FileTable)
    const rows = wrapper.findAll('#filetable tbody tr.clickable-row')
    await rows[1]?.trigger('contextmenu')
    expect(store.contextMenu?.guid).toBe(rows[1]?.attributes('data-guid'))
  })
})

describe('hover preview', () => {
  it('shows a thumbnail for images on desktop', async () => {
    const wrapper = mountWithStubs(FileTable)
    const imgLink = wrapper.findAll('a.ifmitem').find((a) => a.text().includes('photo.jpg'))
    await imgLink?.trigger('mouseenter', { clientX: 10, clientY: 20 })
    const preview = wrapper.find('.ifm-hover-preview img')
    expect(preview.exists()).toBe(true)
    expect(preview.attributes('src')).toContain('proxy')
    await imgLink?.trigger('mousemove', { clientX: 30, clientY: 40 })
    expect(wrapper.find('.ifm-hover-preview').exists()).toBe(true)
    await imgLink?.trigger('mouseleave')
    expect(wrapper.find('.ifm-hover-preview').exists()).toBe(false)
  })
  it('uses relative paths on docroots', async () => {
    resetStore()
    loadFiles({ isDocroot: true })
    const wrapper = mountWithStubs(FileTable)
    const imgLink = wrapper.findAll('a.ifmitem').find((a) => a.text().includes('photo.jpg'))
    await imgLink?.trigger('mouseenter', { clientX: 10, clientY: 20 })
    expect(wrapper.find('.ifm-hover-preview img').attributes('src')).toBe('photo.jpg')
  })
})

describe('drag and drop move', () => {
  function dragEvent(type: string, payload: unknown, types: string[] = []): Event {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & {
      dataTransfer: { types: string[]; setData: () => void; getData: () => string }
    }
    e.dataTransfer = {
      types,
      setData: () => {},
      getData: () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
    }
    return e
  }
  it('moves dropped files onto directories', async () => {
    const seen: Array<Record<string, string>> = []
    mockFetch((api, body) => {
      seen.push(Object.fromEntries(body.entries()))
      if (api === 'getFiles') return []
      return { status: 'OK', message: 'moved' }
    })
    const wrapper = mountWithStubs(FileTable)
    const srcGuid = rowByName(wrapper, 'notes.txt').attributes('data-guid') ?? ''
    rowByName(wrapper, 'notes.txt').element.dispatchEvent(dragEvent('dragstart', [srcGuid]))
    const dirRow = rowByName(wrapper, 'docs').element as HTMLElement
    dirRow.dispatchEvent(dragEvent('dragover', null))
    dirRow.dispatchEvent(dragEvent('drop', [srcGuid]))
    await flush()
    const cm = seen.find((s) => s['api'] === 'copyMove')
    expect(cm?.['action']).toBe('move')
    expect(cm?.['destination']).toBe('docs')
  })
  it('ignores malformed payloads and os file drops', async () => {
    let calls = 0
    mockFetch(() => {
      calls++
      return []
    })
    const wrapper = mountWithStubs(FileTable)
    const dirRow = rowByName(wrapper, 'docs').element as HTMLElement
    dirRow.dispatchEvent(dragEvent('drop', '{{{bad json'))
    dirRow.dispatchEvent(dragEvent('drop', ['x'], ['Files']))
    await flush()
    expect(calls).toBe(0)
  })
  it('clears the hover highlight on dragleave and ignores self-drops', async () => {
    let calls = 0
    mockFetch(() => {
      calls++
      return []
    })
    const wrapper = mountWithStubs(FileTable)
    const dirRow = rowByName(wrapper, 'docs').element as HTMLElement
    dirRow.dispatchEvent(dragEvent('dragover', null))
    expect(dirRow.classList.contains('highlightedItem')).toBe(true)
    dirRow.dispatchEvent(new Event('dragleave', { bubbles: true }))
    expect(dirRow.classList.contains('highlightedItem')).toBe(false)
    // dropping the destination onto itself does nothing
    const docsGuid = rowByName(wrapper, 'docs').attributes('data-guid') ?? ''
    dirRow.dispatchEvent(dragEvent('drop', [docsGuid]))
    await flush()
    expect(calls).toBe(0)
  })
  it('does nothing without move rights', async () => {
    resetStore()
    loadFiles({ copymove: 0 })
    const wrapper = mountWithStubs(FileTable)
    expect(wrapper.find('#filetable tbody tr.clickable-row')?.attributes('draggable')).toBe('false')
  })
})

describe('table state persistence', () => {
  it('restores sort, filter and page across mounts', async () => {
    window.localStorage.setItem(
      'ifm-table-state',
      JSON.stringify({ sortKey: 'size', sortDir: -1, filter: '.txt', page: 3 }),
    )
    mountWithStubs(FileTable)
    expect(store.sortKey).toBe('size')
    expect(store.sortDir).toBe(-1)
    expect(store.filter).toBe('.txt')
    expect(store.page).toBe(3)
  })
  it('saves state on change and ignores corrupt state', async () => {
    window.localStorage.setItem('ifm-table-state', '{{{corrupt')
    const wrapper = mountWithStubs(FileTable)
    expect(store.sortKey).toBe('name')
    await wrapper.find('th.th-filename').trigger('click')
    const saved = JSON.parse(window.localStorage.getItem('ifm-table-state') ?? '{}') as Record<string, unknown>
    expect(saved['sortDir']).toBe(-1)
  })
})
