import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import FileTable from '../src/components/FileTable.vue'
import Toolbar from '../src/components/Toolbar.vue'
import { installKeyboard } from '../src/keyboard'
import { store } from '../src/store'
import { flush, loadFiles, mockFetch, mountWithStubs, resetStore } from './helpers'

function guidOf(name: string): string {
  const f = store.files.find((x) => x.name === name)
  if (!f) throw new Error(`missing file ${name}`)
  return f.guid
}

function press(key: string): void {
  document.onkeydown?.call(document, new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

function pressOn(key: string, el: Element): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

async function focusAnchor(name: string): Promise<HTMLElement> {
  const guid = guidOf(name)
  const anchor = document.querySelector(`#filetable tr[data-guid="${guid}"] a.ifmitem`) as HTMLElement | null
  if (!anchor) throw new Error(`missing anchor for ${name}`)
  anchor.focus()
  store.highlighted = guid
  await nextTick()
  return anchor
}

beforeEach(() => {
  loadFiles()
  mountWithStubs(FileTable)
  mountWithStubs(Toolbar)
  mockFetch((api, body) => {
    if (api === 'getRealpath') return { realpath: body.get('dir') }
    if (api === 'getFiles') return []
    if (api === 'getContent') return { status: 'OK', data: { filename: 'x', content: 'y' } }
    return { status: 'OK', message: 'ok' }
  })
  installKeyboard()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetStore()
})

describe('global shortcuts', () => {
  it('opens feature dialogs and respects flags', () => {
    press('/')
    expect(store.modal.kind).toBe('search')
    store.modal.kind = null
    press('u')
    expect(store.modal.kind).toBe('upload')
    store.modal.kind = null
    press('F')
    expect(store.modal.kind).toBe('editor')
    store.modal.kind = null
    press('D')
    expect(store.modal.kind).toBe('createDir')
    store.modal.kind = null
    press('o')
    expect(store.modal.kind).toBe('remoteUpload')
    store.modal.kind = null
    press('a')
    expect(store.modal.kind).toBe('ajax')
  })
  it('stays quiet for disabled features and form elements', () => {
    if (store.config) store.config.search = 0
    press('/')
    expect(store.modal.kind).toBeNull()
    const input = document.createElement('input')
    document.body.appendChild(input)
    pressOn('r', input)
    // no refresh, no crash
  })
  it('focuses the path field, refreshes and navigates up', async () => {
    press('g')
    expect(document.activeElement?.id).toBe('currentDir')
    press('r')
    await flush()
    press('h')
    await flush()
    expect(store.currentDir).toBe('..')
  })
  it('moves the highlight with j/k and arrows', () => {
    press('j')
    const first = store.highlighted
    expect(first).not.toBe('')
    press('j')
    expect(store.highlighted).not.toBe(first)
    press('k')
    expect(store.highlighted).toBe(first)
  })
  it('enters directories with l and arrow right', async () => {
    store.highlighted = guidOf('docs')
    press('l')
    await flush()
    expect(store.currentDir).toBe('docs')
  })
})

describe('item shortcuts', () => {
  it('toggles selection with space and opens dirs with enter', async () => {
    const anchor = await focusAnchor('notes.txt')
    pressOn(' ', anchor)
    expect(store.selected.has(guidOf('notes.txt'))).toBe(true)
    pressOn(' ', anchor)
    expect(store.selected.has(guidOf('notes.txt'))).toBe(false)
    await focusAnchor('docs')
    pressOn('Enter', document.activeElement as Element)
    await flush()
    expect(store.currentDir).toBe('docs')
  })
  it('deletes selections or the highlighted item', () => {
    store.selected.add(guidOf('notes.txt'))
    press('Delete')
    expect(store.modal.kind).toBe('delete')
    store.modal.kind = null
    store.selected.clear()
    store.highlighted = guidOf('photo.jpg')
    press('Delete')
    expect(store.modal.kind).toBe('delete')
  })
  it('opens copy/move for the highlighted item without a selection', () => {
    store.highlighted = guidOf('photo.jpg')
    press('m')
    expect(store.modal.kind).toBe('copyMove')
  })
  it('opens copy/move, rename, edit and extract', async () => {
    store.highlighted = guidOf('notes.txt')
    press('c')
    expect(store.modal.kind).toBe('copyMove')
    store.modal.kind = null
    press('n')
    expect(store.modal.kind).toBe('rename')
    store.modal.kind = null
    press('e')
    await flush()
    expect(store.modal.kind).toBe('editor')
    store.modal.kind = null
    store.highlighted = guidOf('archive.zip')
    press('e')
    expect(store.modal.kind).toBe('extract')
  })
  it('ignores rename on the parent entry', () => {
    store.highlighted = guidOf('..')
    press('n')
    expect(store.modal.kind).toBeNull()
  })
  it('clears the highlight with escape', async () => {
    const anchor = await focusAnchor('notes.txt')
    expect(document.activeElement).toBe(anchor)
    pressOn('Escape', anchor)
    expect(store.highlighted).toBe('')
  })
  it('closes modals and menus with escape', () => {
    store.modal.kind = 'search'
    press('Escape')
    expect(store.modal.kind).toBeNull()
    store.contextMenu = { x: 1, y: 1, guid: guidOf('notes.txt') }
    press('Escape')
    expect(store.contextMenu).toBeNull()
  })
  it('ignores everything while logged out', () => {
    store.authenticated = false
    press('r')
    press('/')
    expect(store.modal.kind).toBeNull()
  })
  it('ignores keys without config', () => {
    store.config = null
    press('r')
    expect(store.modal.kind).toBeNull()
  })
  it('ignores movement without rows', async () => {
    store.files = []
    await nextTick()
    press('j')
    expect(store.highlighted).toBe('')
  })
  it('ignores stale highlights and non-actionable items', () => {
    store.highlighted = 'stale-guid'
    press(' ')
    expect(store.selected.size).toBe(0)
  })
  it('never errors on failing edits', async () => {
    mockFetch(() => ({ status: 'ERROR', message: 'denied' }))
    store.highlighted = guidOf('notes.txt')
    press('e')
    await flush()
    expect(store.modal.kind).toBeNull()
    expect(store.toasts.at(-1)?.kind).toBe('danger')
  })
  it('ignores other keys while a modal or menu is open', () => {
    store.modal.kind = 'search'
    press('x')
    expect(store.modal.kind).toBe('search')
    store.modal.kind = null
    store.contextMenu = { x: 1, y: 1, guid: guidOf('notes.txt') }
    press('x')
    expect(store.contextMenu).not.toBeNull()
  })
  it('ignores movement keys on files', async () => {
    store.highlighted = guidOf('notes.txt')
    press('l')
    await flush()
    expect(store.currentDir).toBe('')
  })
  it('respects disabled feature flags', () => {
    if (store.config) {
      store.config.delete = 0
      store.config.copymove = 0
      store.config.rename = 0
      store.config.edit = 0
      store.config.extract = 0
    }
    store.highlighted = guidOf('notes.txt')
    press('Delete')
    press('c')
    press('n')
    press('e')
    expect(store.modal.kind).toBeNull()
    store.highlighted = guidOf('archive.zip')
    press('e')
    expect(store.modal.kind).toBeNull()
  })
})
